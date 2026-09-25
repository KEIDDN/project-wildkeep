import { Application, Container, Culler, Graphics, Text, TextureSource } from "pixi.js";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { Effects } from "./fx/Effects";
import { Lighting, type LightSource } from "./fx/Lighting";
import { Player } from "./entities/Player";
import { Pickup } from "./entities/Pickup";
import { Projectile } from "./entities/Projectile";
import { PERFECT_DODGE } from "../data/combat";
import type { Enemy } from "./entities/Enemy";
import { Entity, type Interactable } from "./entities/Entity";
import type { Area } from "./world/Area";
import { buildArea } from "./world/areas";
import { preload, uploadAllTextures } from "./textures";
import { allAssetPaths } from "./manifestPaths";
import { CombatSystem } from "./CombatSystem";
import type { AreaId, Vector2 } from "../game/core/types";
import { INTERACT_RANGE, TILE, WORLD_FONT } from "../game/core/constants";
import { AREAS } from "../data/areas";
import { t } from "../i18n";
import { areaName, areaSubtitle, floorThemeName, itemName, mineBandName } from "../i18n/content";
import { BarkDirector } from "./BarkDirector";
import { rememberWildKill } from "./world/areas/encounters";
import { ScheduleDirector } from "./Schedules";
import { Weather } from "./fx/Weather";
import { eventActive } from "../game/social/worldEvents";
import "../game/social/crime";
import { dangerFor, floorProfile } from "../data/dungeonFloors";
import { mineFloorProfile } from "../data/mineFloors";
import { useMineStore } from "../store/mineStore";
import { getItem } from "../data/items";
import { audio } from "../game/audio/AudioManager";
import { grantItems, grantXp, quickDrinkPotion } from "../game/actions";
import { gameEvents } from "../game/events";
import { GAME_MINUTES_PER_SECOND, daylight } from "../game/time/clock";
import { useTimeStore } from "../store/timeStore";
import { currentTutorialStep } from "../store/tutorialStore";
import { houseLevelInfo } from "../data/house";
import { currentHouseLevel } from "../game/systems/playerStats";
import { saveGame } from "../game/save/gameSave";
import { initQuests, questDef, questGuide } from "../game/quests";
import { bountyDialogue, initReputation } from "../game/social/reputation";
import { initFarming } from "../game/farming";
import { giftDialogue } from "../game/relationships";
import { drunkLevel, initDrink, morningAfter } from "../game/tavern/drink";
import { Npc } from "./entities/Props";
import { isMarketDay } from "./world/happenings";
import { placeQuestItems } from "./world/questSpawns";
import { usePlayerStore } from "../store/playerStore";
import { useInventoryStore } from "../store/inventoryStore";
import { useWorldStore, type TravelRequest } from "../store/worldStore";
import { useDungeonStore } from "../store/dungeonStore";
import { useUiStore, type PanelId } from "../store/uiStore";
import { isCapturingInput } from "../game/input/capture";
import { refillEnergy, spendEnergy } from "../game/systems/vitals";
import { showTutorial } from "../game/tutorial";
import { useSocialStore } from "../store/socialStore";
import { useSettingsStore } from "../store/settingsStore";
import { roomAt } from "../game/dungeon/types";
import { playerEffectiveStats } from "../game/systems/playerStats";
import { initRumors, recordRumor } from "../game/social/rumors";
import { removeFromStacks } from "../store/inventoryStore";

/**
 * Owns the PixiJS application and runs the world: the current Area, the
 * player, camera, lighting and effects. React never touches any of this; it
 * reads and writes Zustand stores, and the Game reacts to those.
 */
export class Game {
  app!: Application;
  camera = new Camera();
  input!: Input;
  fx = new Effects();
  lighting!: Lighting;
  player!: Player;
  area!: Area;
  combat = new CombatSystem(this);
  barks = new BarkDirector();
  schedules = new ScheduleDirector();
  weather = new Weather();

  private world = new Container();
  private worldUi = new Container();
  /** Emissive layer over the darkness (lit windows), camera-transformed. */
  private glowWorld = new Container();
  private promptMarker = new Container();
  private focused: Interactable | null = null;
  private transitioning = false;
  private destroyed = false;
  private regenTimer = 0;
  private saveTimer = 0;
  private dungeonTick = 0;
  private time = 0;
  private unsubs: (() => void)[] = [];
  private backdrop = new Graphics();
  /** Fraction of a game minute not yet written to the time store. */
  private minuteAcc = 0;
  private movedAcc = 0;
  private lastPlayerPos = { x: 0, y: 0 };
  private guideArrow = new Graphics();

  get ui() {
    return useUiStore.getState();
  }

  async init(host: HTMLElement, onProgress: (p: number) => void): Promise<void> {
    TextureSource.defaultOptions.scaleMode = "nearest";
    this.app = new Application();
    await this.app.init({
      resizeTo: host,
      background: 0x0b0a10,
      antialias: false,
      resolution: Math.max(1, Math.round(window.devicePixelRatio || 1)),
      autoDensity: true,
      roundPixels: true,
      // Pixi 8.15+ unloads GPU data for anything not drawn for 60s. With
      // camera culling that meant buildings you'd walked away from were
      // re-uploaded (and visibly popped back in) when you returned. The game
      // preloads a small fixed texture set, so keep everything resident.
      gcActive: false,
    });
    if (this.destroyed) {
      // React StrictMode unmounted us mid-init.
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.style.imageRendering = "pixelated";

    // Load everything up front: it's a few hundred small PNGs and it keeps
    // area switches instant.
    const paths = allAssetPaths();
    const chunk = 40;
    for (let i = 0; i < paths.length; i += chunk) {
      await preload(paths.slice(i, i + chunk));
      onProgress(Math.min(1, (i + chunk) / paths.length));
      if (this.destroyed) return;
    }
    await Promise.all([document.fonts?.load("16px 'Pixelify Sans'"), document.fonts?.load("700 16px 'Pixelify Sans'"), document.fonts?.load("16px 'WK Digits'", "0123456789")]).catch(() => undefined);
    // Upload every texture to the GPU now instead of the first time it
    // scrolls into view.
    uploadAllTextures(this.app.renderer);

    this.input = new Input(this.app.canvas);
    this.lighting = new Lighting(this.app.renderer);
    this.app.stage.addChild(this.backdrop, this.world, this.lighting.sprite, this.glowWorld, this.lighting.flares, this.worldUi);
    this.worldUi.addChild(this.fx.textLayer, this.promptMarker);
    this.buildPromptMarker();
    this.app.stage.addChild(this.weather.view, this.guideArrow);

    this.player = new Player(0, 0);
    this.player.game = this;
    initQuests();
    initFarming();
    initReputation((id) => questDef(id)?.kind ?? null);
    initDrink();
    initRumors();

    const world = useWorldStore.getState();
    const pos = world.position;
    try {
      await this.loadArea(world.area, pos.x >= 0 ? pos : world.resumeSpawn);
    } catch (err) {
      console.error(`Failed to load saved area ${world.area}`, err);
      await this.loadArea("town", "default");
    }

    this.unsubs.push(
      useWorldStore.subscribe((s, prev) => {
        if (s.pendingTravel && s.pendingTravel !== prev.pendingTravel) void this.travel(s.pendingTravel);
        // Magic learned: the mana bar appears, full.
        if (s.progress.flags.magic_learned && !prev.progress.flags.magic_learned) {
          this.player.mana = this.player.maxMana;
          this.ui.pushToast(t("magic.learned"), "levelup", { icon: "spellbook" });
          this.fx.ring(this.player.x, this.player.y - 12, 30, 0x9ad0ff, 0.6);
        }
      }),
    );
    this.player.mana = this.player.maxMana;
    this.app.ticker.add((t) => this.tick(Math.min(0.05, t.deltaMS / 1000)));
  }

  // ---------------------------------------------------------------------------
  // Areas
  // ---------------------------------------------------------------------------

  private async loadArea(id: AreaId, spawn: string | Vector2): Promise<void> {
    if (this.area) {
      // The player and the particle layer outlive areas: detach them first.
      const i = this.area.entities.indexOf(this.player);
      if (i >= 0) this.area.entities.splice(i, 1);
      this.player.view.removeFromParent();
      this.fx.layer.removeFromParent();
      this.world.removeChildren();
      this.glowWorld.removeChildren();
      this.area.destroy();
    }
    this.fx.clear();
    this.focused = null;
    const area = await buildArea(id, this);
    this.area = area;
    this.lighting.setVision(area.vision);
    this.world.addChild(area.root);
    this.glowWorld.removeChildren();
    this.glowWorld.addChild(area.glow);
    area.entityLayer.addChild(this.fx.layer);
    this.fx.layer.zIndex = 1e7;
    area.add(this.player);

    const sp = typeof spawn === "string" ? area.spawns[spawn] ?? area.spawns.default : spawn;
    this.player.resetForArea(sp.x, sp.y, typeof spawn === "string" ? area.spawns[spawn]?.dir ?? "down" : "down");
    placeQuestItems(this, area);
    this.camera.bounds = area.viewBounds;
    this.onResize();
    this.camera.snapTo(this.player.x, this.player.y - 12);
    this.lastPlayerPos = { x: this.player.x, y: this.player.y };
    this.applyAmbient();

    // Music follows the world store's area (see game/audio/musicDirector).
    useWorldStore.getState().completeTravel(id);
    useWorldStore.getState().setPosition({ x: this.player.x, y: this.player.y });
    gameEvents.emit("areaEntered", { area: id });

    if (id === "dungeon") {
      const ds = useDungeonStore.getState();
      if (ds.surface.area === "deep_forest") useWorldStore.getState().discover("crypt");
      spendEnergy("delve");
      const p = floorProfile(ds.floor, ds.seed);
      const twist = p.mutator ? ` · ${t(`dungeon.mutator.${p.mutator}.name`)}` : "";
      this.ui.showAreaBanner(t("area.floorBanner", { n: ds.floor }), `${floorThemeName(p.theme.name)}${p.bossFloor ? ` · ${t("area.bossBelow")}` : twist}`);
      if (p.mutator) this.ui.pushToast(t(`dungeon.mutator.${p.mutator}.desc`), "warning");
      if (useWorldStore.getState().recordDungeonFloor(ds.floor) && ds.floor > 1) {
        this.ui.pushToast(t("toast.newDepth", { n: ds.floor }), "levelup");
        if (ds.floor >= 5) recordRumor("deepDive", { floor: ds.floor });
        this.ui.pushToast(t("toast.depthXp", { xp: grantXp(ds.floor * 12) }), "info");
      }
    } else if (id === "mine") {
      const floor = useMineStore.getState().floor;
      spendEnergy("delve");
      this.ui.showAreaBanner(t("area.mineBanner", { n: floor }), mineBandName(mineFloorProfile(floor).name));
    } else {
      this.ui.showAreaBanner(areaName(id), areaSubtitle(id));
      // First time anywhere is worth something.
      if (id !== "house" && useWorldStore.getState().discover(`area:${id}`)) {
        this.ui.pushToast(t("toast.discovered", { name: areaName(id), xp: grantXp(40) }), "levelup");
        // New places go on the map.
        if (id !== "town") showTutorial("map");
      }
      // A bounty on your head? The watch meets you in the street.
      if (id === "town") {
        const social = useSocialStore.getState();
        const today = useTimeStore.getState().day;
        if (isMarketDay() && !social.usedToday("market_toast", today)) {
          social.useToday("market_toast", today);
          this.ui.pushToast(t("hap.marketDay"), "levelup", { icon: "coin_bag" });
        }
        const stop = bountyDialogue();
        if (stop && Math.random() < 0.6) setTimeout(() => !this.destroyed && !useUiStore.getState().activePanel && this.ui.showDialogue(stop), 1200);
      }
    }
    this.ui.setBossBar(null);
  }

  /** Fade out, swap area, fade in. */
  async travel(req: TravelRequest): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.cancelGather();
    this.ui.setFading(true);
    audio.sfx("door");
    await wait(260);
    if (this.destroyed) return;
    try {
      await this.loadArea(req.area, req.spawn);
    } catch (err) {
      // Never leave the player on a black screen: fall back to the village.
      console.error(`Failed to load area ${req.area}`, err);
      await this.loadArea("town", "default");
    }
    saveGame();
    await wait(60);
    this.ui.setFading(false);
    this.transitioning = false;
  }

  requestTravel(area: AreaId, spawn: string | Vector2 = "default"): void {
    useWorldStore.getState().requestTravel({ area, spawn });
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  private tick(dt: number): void {
    if (!this.area || this.destroyed) return;
    this.time += dt;
    const blocked = useUiStore.getState().activePanel !== null || this.transitioning;
    this.player.frozen = blocked;

    this.handleHotkeys(blocked);
    if (!blocked) this.advanceClock(dt);

    // Copy: entities may spawn/despawn others (or themselves) while updating.
    // An entity removed during its own update has a destroyed view, so it must
    // not be synced afterwards.
    for (const e of this.area.entities.slice()) {
      if (e.removed || e.isStatic) continue;
      e.update(dt, this);
      if (!e.removed) e.syncView();
    }

    if (!blocked) {
      this.checkTriggers();
      this.updateInteraction();
    } else {
      this.setFocus(null);
    }

    this.passiveRegen(dt);
    if (!blocked) this.barks.update(dt, this);
    if (!blocked) this.schedules.update(dt, this);
    if (this.area.id === "dungeon") this.dungeonUpdate(dt);

    const mv = this.player.moveDir;
    const sway = this.drunkView(dt);
    this.camera.follow(this.player.x + sway, this.player.y - 12, dt, mv.x, mv.y);
    this.camera.update(dt);
    this.camera.apply(this.world);
    this.camera.apply(this.worldUi);
    this.camera.apply(this.glowWorld);
    this.fx.update(dt);
    this.applyAmbient();
    const lights = this.collectLights();
    this.lighting.update(dt, this.camera, lights);
    this.glowWorld.alpha = this.lighting.night;
    this.weather.active = AREAS[this.area.id].kind === "outdoor" && eventActive("storm");
    this.weather.update(dt, this.camera.screenW, this.camera.screenH);
    this.drawGuideArrow();
    this.trackMovement();
    if (this.area.cull) this.cullWorld();
    this.drawBackdrop();

    this.saveTimer += dt;
    if (this.saveTimer > 1) {
      this.saveTimer = 0;
      if (!this.transitioning) useWorldStore.getState().setPosition({ x: Math.round(this.player.x), y: Math.round(this.player.y) });
    }
    this.input.endFrame();
  }

  private handleHotkeys(blocked: boolean) {
    const ui = useUiStore.getState();
    const input = this.input;
    // The Controls screen is listening for a new key: don't act on it.
    if (isCapturingInput()) return;
    if (input.codePressed("escape")) {
      if (ui.activePanel && ui.activePanel !== "death" && ui.activePanel !== "intro") ui.closePanel();
      else if (!ui.activePanel) ui.openPanel("settings");
      return;
    }
    // Toggle-able panels. Each key opens its panel, or closes it if it's the one open.
    const toggles: [boolean, PanelId][] = [
      [input.pressed("inventory"), "inventory"],
      [input.pressed("character"), "character"],
      [input.pressed("skills"), "skills"],
      [input.pressed("help"), "help"],
      [input.pressed("journal"), "journal"],
      [input.pressed("map"), "map"],
    ];
    if (import.meta.env.DEV) toggles.push([input.codePressed("`"), "debug"]);
    for (const [hit, panel] of toggles) {
      if (!hit) continue;
      if (ui.activePanel === panel) ui.closePanel();
      else if (!ui.activePanel) ui.openPanel(panel);
      return;
    }
    if (blocked) return;
    if (input.pressed("potion")) {
      const healed = quickDrinkPotion();
      if (healed > 0) {
        this.fx.text(this.player.x, this.player.y - 30, `+${healed}`, 0x7dff7d, { size: 9, bold: true });
        this.fx.burst(this.player.x, this.player.y - 12, "heal", 12, { speed: 20, up: 50 });
      }
    }
    // Gift: give the person you're facing something.
    if (input.pressed("gift") && this.focused instanceof Npc && this.focused.def && !this.player.busy) {
      this.focused.faceToward(this.player.x, this.player.y);
      this.ui.showDialogue(giftDialogue(this.focused.def.id));
      return;
    }
    // Fishing: interact strikes (or reels in).
    if (input.pressed("interact") && this.player.state === "fish") {
      this.player.fishingInput(this);
      return;
    }
    if (input.pressed("interact") && this.focused && !this.player.busy) {
      const target = this.focused;
      const p = target.prompt(this);
      if (p?.blocked && !p.selfHandled) {
        this.ui.pushToast(p.blocked, "warning");
        audio.sfx("deny");
      } else {
        target.interact(this);
        gameEvents.emit("interacted", { what: target.constructor.name });
      }
    }
  }

  private checkTriggers() {
    const p = this.player;
    for (const t of this.area.triggers) {
      const r = t.rect;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        if (t.requireDir) {
          const a = this.input.axis();
          const ok =
            (t.requireDir === "up" && a.y < 0) ||
            (t.requireDir === "down" && a.y > 0) ||
            (t.requireDir === "left" && a.x < 0) ||
            (t.requireDir === "right" && a.x > 0);
          if (!ok) continue;
        }
        void this.travel(t.travel);
        return;
      }
    }
  }

  private updateInteraction() {
    const p = this.player;
    if (p.busy) {
      this.setFocus(null);
      return;
    }
    const f = p.facingVector();
    // Probe slightly in front of the player so facing matters.
    const px = p.x + f.x * 6;
    const py = p.y + f.y * 6;
    let best: Interactable | null = null;
    let bestScore = Infinity;
    for (const it of this.area.interactables()) {
      const d = Math.hypot(it.interactX - px, it.interactY - py);
      if (d > Math.max(INTERACT_RANGE, it.interactRadius)) continue;
      if (!it.prompt(this)) continue;
      const score = d + (it.interactPriority ?? 2) * 4;
      if (score < bestScore) {
        best = it;
        bestScore = score;
      }
    }
    this.setFocus(best);
  }

  private setFocus(it: Interactable | null) {
    this.focused = it;
    const prompt = it ? it.prompt(this) : null;
    this.ui.setPrompt(prompt);
    this.promptMarker.visible = !!it;
    if (it) {
      const bob = Math.round(Math.sin(this.time * 5) * 1.5);
      this.promptMarker.position.set(Math.round(it.interactX), Math.round(this.markerY(it) + bob));
      this.promptMarker.alpha = prompt?.blocked ? 0.5 : 1;
    }
  }

  private markerY(it: Interactable): number {
    const e = it as unknown as Entity & { view: Container };
    const h = e.view?.height ?? 16;
    const y = it.interactY - Math.min(48, Math.max(18, h)) - 6;
    // Never float the marker over the player's own head.
    const p = this.player;
    if (Math.abs(it.interactX - p.x) < 14 && y > p.y - 44 && y < p.y + 4) return p.y - 44;
    return y;
  }

  private buildPromptMarker() {
    const g = new Graphics();
    g.roundRect(-5, -6, 10, 10, 2).fill(0x1a1016);
    g.roundRect(-4, -5, 8, 8, 1).fill(0xf1e0c0);
    const t = new Text({ text: "E", style: { fontFamily: WORLD_FONT, fontSize: 7, fill: 0x2a1a20, fontWeight: "700" }, resolution: 8 });
    t.anchor.set(0.5);
    t.position.set(0, -1.5);
    this.promptMarker.addChild(g, t);
    this.promptMarker.visible = false;
  }

  private passiveRegen(dt: number) {
    if (!AREAS[this.area.id].townRegen || this.player.state === "dead") return;
    this.regenTimer += dt;
    if (this.regenTimer >= 1.2) {
      this.regenTimer = 0;
      usePlayerStore.getState().heal(1);
    }
  }

  private collectLights(): LightSource[] {
    if (!this.lighting.enabled) return [];
    const lights: LightSource[] = [...this.area.staticLights];
    const eq = usePlayerStore.getState().equipment;
    const lantern = Object.values(eq).reduce((n, id) => n + (id ? (getItem(id).lightBonus ?? 0) : 0), 0);
    // Your own lantern: underground it's all the vision you have.
    const under = AREAS[this.area.id].kind === "underground";
    const base = under ? 100 : 64;
    lights.push({ x: this.player.x, y: this.player.y - 10, radius: base + lantern, color: under ? 0xffe2b8 : 0xffd9a8, intensity: under ? 1.05 : 0.75, flicker: 0.4, flare: false });
    for (const e of this.area.entities) {
      const l = e.light?.();
      if (l) lights.push(l);
    }
    const vision = this.area.vision;
    if (!vision) return lights;
    // Sight reaches a little past your own light: dim shapes at the edge of
    // the lantern glow. Torches you haven't discovered stay hidden.
    vision.update(this.player.x, this.player.y - 6, (base + lantern) / TILE + 4);
    return lights.filter((l) => vision.seenAt(Math.floor(l.x / TILE), Math.floor((l.y + 8) / TILE)));
  }

  // ---------------------------------------------------------------------------
  // Time of day
  // ---------------------------------------------------------------------------

  private advanceClock(dt: number) {
    this.minuteAcc += dt * GAME_MINUTES_PER_SECOND;
    if (this.minuteAcc >= 1) {
      const whole = Math.floor(this.minuteAcc);
      this.minuteAcc -= whole;
      useTimeStore.getState().advance(whole);
    }
  }

  /** Precise time of day (the store only holds whole minutes). */
  get minuteOfDay(): number {
    return useTimeStore.getState().minute + this.minuteAcc;
  }

  /** Outdoors follows the sun; interiors and caves keep their own light. */
  private applyAmbient() {
    const info = AREAS[this.area.id];
    if (info.kind === "underground") {
      this.lighting.setUnderground(this.area.ambient * 0.34);
      return;
    }
    if (info.kind !== "outdoor") {
      this.lighting.setAmbientLevel(this.area.ambient);
      return;
    }
    let [r, g, b] = daylight(this.minuteOfDay);
    // Storm days are grey and blue.
    if (eventActive("storm")) [r, g, b] = [r * 0.72, g * 0.76, b * 0.88];
    // Extra dimming for shady places like the Deepwood canopy.
    const a = this.area.ambient;
    const dim = (c: number) => a + (1 - a) * c * 0.35;
    this.lighting.setAmbientColor(r * dim(0x6a / 255), g * dim(0x70 / 255), b * dim(0xa8 / 255));
  }

  private drunkBlur = -1;
  private swayT = 0;

  /** The world sways and blurs when you've had a few; at 100 you pass out. */
  private drunkView(dt: number): number {
    const d = drunkLevel();
    const blur = d >= 50 ? Math.round(((d - 40) / 60) * 10) / 10 : 0;
    if (blur !== this.drunkBlur) {
      this.drunkBlur = blur;
      this.app.canvas.style.filter = blur > 0 ? `blur(${blur}px) saturate(1.25)` : "";
    }
    if (d >= 100 && !this.transitioning && this.player.state !== "dead") void this.passOut();
    if (d < 25) return 0;
    this.swayT += dt;
    return Math.sin(this.swayT * 1.3) * ((d - 20) / 80) * 10;
  }

  /** Too much. Everything goes dark, and it's morning, and you're home, and… */
  async passOut(): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.cancelGather();
    this.ui.closePanel();
    this.ui.setFading(true);
    audio.sfx("player_hurt", { pitch: 0.6 });
    // Everyone will hear about this.
    recordRumor("passedOut", undefined, "greta");
    await wait(1200);
    if (this.destroyed) return;
    useTimeStore.getState().sleep(false);
    refillEnergy(0.5);
    this.minuteAcc = 0;
    const p = usePlayerStore.getState();
    p.heal(Math.round(playerEffectiveStats(p).maxHp * 0.5));
    await this.loadArea("house", "bed");
    const story = morningAfter();
    saveGame();
    await wait(400);
    this.ui.setFading(false);
    this.transitioning = false;
    this.ui.showDialogue({ speaker: t("drunk.morningTitle"), portrait: "beer", lines: [t("drunk.morningIntro"), story] });
  }

  /** Sleep until the next morning: heal, regrow the world, save. */
  async sleep(): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.cancelGather();
    this.ui.setFading(true);
    await wait(900);
    if (this.destroyed) return;
    const house = houseLevelInfo(currentHouseLevel());
    const wellRested = house.perks.restedXpBonus > 0;
    const day = useTimeStore.getState().sleep(wellRested);
    useSocialStore.getState().setDrunk(0);
    this.minuteAcc = 0;
    usePlayerStore.getState().fullHeal();
    refillEnergy(1);
    useWorldStore.getState().clearNodeRespawns();
    saveGame();
    gameEvents.emit("slept", { day });
    this.player.resetForArea(this.area.spawns.bed?.x ?? this.player.x, this.area.spawns.bed?.y ?? this.player.y, "down");
    this.camera.snapTo(this.player.x, this.player.y - 12);
    await wait(500);
    this.ui.setFading(false);
    this.transitioning = false;
    this.ui.showAreaBanner(t("area.dayBanner", { n: day }), wellRested ? t("area.wellRested", { pct: Math.round(house.perks.restedXpBonus * 100) }) : t("area.newDay"));
    this.ui.pushToast(t("toast.slept"), "info", { icon: "sleep" });
  }

  // ---------------------------------------------------------------------------
  // Tutorial guidance
  // ---------------------------------------------------------------------------

  private trackMovement() {
    const d = Math.hypot(this.player.x - this.lastPlayerPos.x, this.player.y - this.lastPlayerPos.y);
    this.lastPlayerPos = { x: this.player.x, y: this.player.y };
    if (d > 0 && d < 40) {
      this.movedAcc += d;
      if (this.movedAcc >= 24) {
        gameEvents.emit("moved", { distance: this.movedAcc });
        this.movedAcc = 0;
      }
    }
  }

  /** A bobbing arrow over the current tutorial target — or pinned to the
   * screen edge, pointing the way, when the target is off-screen. */
  private drawGuideArrow() {
    const g = this.guideArrow;
    const step = currentTutorialStep();
    // The tutorial's target first; otherwise the tracked quest's.
    const aim = step?.target && step.target.area === this.area.id ? step.target : questGuide(this.area.id);
    const target = aim && aim.area === this.area.id ? this.area.spawns[aim.spawn] : null;
    if (!target || this.transitioning) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const cam = this.camera;
    const p = cam.worldToScreen(target.x, target.y - 26);
    // Keep clear of the HUD: tutorial box on top, hotbar at the bottom.
    const margin = 48;
    const top = 150;
    const bottom = 110;
    const w = cam.screenW;
    const h = cam.screenH;
    const onScreen = p.x > margin && p.x < w - margin && p.y > top && p.y < h - bottom;
    const s = cam.zoom;
    g.clear();
    if (onScreen) {
      const bob = Math.sin(this.time * 5) * 3 * s;
      g.position.set(Math.round(p.x), Math.round(p.y + bob));
      g.rotation = 0;
      g.poly([-5 * s, -6 * s, 5 * s, -6 * s, 0, 2 * s]).fill(0xffd54f).stroke({ width: s, color: 0x2a1a20 });
    } else {
      const cx = Math.max(margin, Math.min(w - margin, p.x));
      const cy = Math.max(top, Math.min(h - bottom, p.y));
      const ang = Math.atan2(p.y - h / 2, p.x - w / 2);
      const pulse = 1 + Math.sin(this.time * 6) * 0.12;
      g.position.set(Math.round(cx), Math.round(cy));
      g.rotation = ang;
      g.poly([7 * s * pulse, 0, -4 * s, -5 * s, -4 * s, 5 * s]).fill(0xffd54f).stroke({ width: s, color: 0x2a1a20 });
    }
  }

  /**
   * Skip drawing entities far off-screen. The margin is deliberately
   * generous (half a screen on every side), so anything you could walk to in
   * the next moment is already drawn: the world never visibly assembles
   * itself around the player. Entity views don't recurse (cullableChildren is
   * off), so this is one bounds check per entity.
   */
  private cullWorld() {
    const w = this.camera.screenW;
    const h = this.camera.screenH;
    const mx = Math.max(200, w * 0.5);
    const my = Math.max(200, h * 0.5);
    Culler.shared.cull(this.world, { x: -mx, y: -my, width: w + mx * 2, height: h + my * 2 }, false);
  }

  private drawBackdrop() {
    const w = this.camera.screenW;
    const h = this.camera.screenH;
    this.backdrop.clear().rect(0, 0, w, h).fill(this.area.backdrop);
  }

  onResize(): void {
    if (!this.app?.renderer) return;
    // `app.screen` is in CSS pixels, the same space as the stage. (Dividing
    // renderer.width by the resolution again made HiDPI screens think they
    // were a quarter of their size: off-centre camera, culling that only drew
    // the top-left of the screen, and lighting that covered a rectangle.)
    this.camera.resize(this.app.screen.width, this.app.screen.height);
    Entity.snap = this.camera.zoom;
  }

  shake(mag: number, dur: number): void {
    if (useSettingsStore.getState().screenShake) this.camera.shake(mag, dur);
  }

  // ---------------------------------------------------------------------------
  // Entities & loot
  // ---------------------------------------------------------------------------

  private freezeUntil = 0;
  private slowUntil = 0;
  private slowSpeed = 1;

  /**
   * Impact freeze: the world all but stops for a few frames (up to ~90ms),
   * and anything longer eases out as slow motion. Short, hard stops are what
   * make a hit land; the old version only slowed things to 20%, which read
   * as lag rather than impact.
   */
  hitStop(ms: number): void {
    const now = performance.now();
    const freeze = Math.min(ms, 90);
    this.freezeUntil = Math.max(this.freezeUntil, now + freeze);
    if (ms > freeze) this.slowMo(ms, 0.3);
    this.applyTimeScale();
    setTimeout(() => this.applyTimeScale(), freeze + 1);
  }

  /** A stretch of slow motion (perfect dodges, parries). */
  slowMo(ms: number, speed: number): void {
    const now = performance.now();
    if (now + ms > this.slowUntil) {
      this.slowUntil = now + ms;
      this.slowSpeed = speed;
    }
    this.applyTimeScale();
    setTimeout(() => this.applyTimeScale(), ms + 1);
  }

  private applyTimeScale(): void {
    if (this.destroyed || !this.app?.ticker) return;
    const now = performance.now();
    this.app.ticker.speed = now < this.freezeUntil ? 0.04 : now < this.slowUntil ? this.slowSpeed : 1;
  }

  removeEntity(e: Entity): void {
    this.area.remove(e);
  }

  spawnPickup(x: number, y: number, kind: "item" | "gold", itemId: string, quantity: number): void {
    if (quantity <= 0 || !this.area) return;
    this.area.add(new Pickup(x, y, kind, itemId, quantity));
  }

  collectPickup(p: Pickup): void {
    this.area.remove(p);
    gameEvents.emit("pickupCollected", { itemId: p.itemId, gold: p.kind === "gold" });
    if (p.kind === "gold") {
      usePlayerStore.getState().earnGold(p.quantity);
      this.fx.text(this.player.x, this.player.y - 28, `+${p.quantity}g`, 0xffd54f, { size: 8 });
      audio.sfx("coin");
      if (this.area.id === "dungeon") useDungeonStore.getState().addRunLoot(p.quantity, 0, []);
      return;
    }
    grantItems([{ itemId: p.itemId, quantity: p.quantity }]);
    this.fx.text(this.player.x, this.player.y - 28, `+${p.quantity} ${itemName(p.itemId)}`, 0xf5ecd6, { size: 7 });
    if (this.area.id === "dungeon") useDungeonStore.getState().addRunLoot(0, 0, [{ itemId: p.itemId, quantity: p.quantity }]);
  }

  enemies(): Enemy[] {
    return this.area.entities.filter((e) => (e as Enemy).def?.stats && !(e as Enemy).dead) as Enemy[];
  }

  enemySeparation(self: Enemy): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    for (const o of this.enemies()) {
      if (o === self) continue;
      const dx = self.x - o.x;
      const dy = self.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 18) {
        sx += (dx / d) * (18 - d) * 0.3;
        sy += (dy / d) * (18 - d) * 0.3;
      }
    }
    return { x: sx, y: sy };
  }

  /** Only a few monsters may wind up a melee attack at once; the rest circle. */
  attackTokenFree(self: Enemy): boolean {
    const limit = self.floor >= 10 ? 3 : 2;
    let n = 0;
    for (const e of this.enemies()) if (e !== self && e.engaging && !e.isBoss) n++;
    return n < limit;
  }

  /** Is something about to hit the player right now (for perfect dodges)? */
  perfectDodgeWindow(x: number, y: number, window = PERFECT_DODGE.window): boolean {
    for (const e of this.enemies()) if (e.threatens(x, y, window)) return true;
    for (const e of this.area.entities) if (e instanceof Projectile && e.hostile && Math.hypot(e.x - x, e.y - y) < 34) return true;
    return false;
  }

  onEnemyKilled(enemy: Enemy): void {
    this.combat.rewardKill(enemy);
    // Last one standing nearby: a beat of slow motion to savour it.
    if (!enemy.isBoss && !enemy.summoned && !this.enemies().some((e) => e !== enemy && Math.hypot(e.x - enemy.x, e.y - enemy.y) < 140)) this.hitStop(110);
    rememberWildKill(enemy.spawnId);
    useWorldStore.getState().bumpStat("enemiesSlain");
    gameEvents.emit("enemyKilled", { enemyId: enemy.def.id, boss: enemy.rank === "boss" });
    if (enemy.rank === "boss") {
      useWorldStore.getState().recordBoss(enemy.def.id);
      if (floorProfile(enemy.floor).bossFloor) {
        useWorldStore.getState().unlockDungeonCheckpoint(enemy.floor);
        this.ui.pushToast(t("toast.checkpoint", { n: enemy.floor + 1 }), "levelup");
      }
    }
    if (enemy.guardian) {
      this.ui.setBossBar(null);
      this.ui.pushToast(t("toast.guardianFalls", { name: enemy.name }), "levelup");
      this.area.entities.forEach((e) => (e as unknown as { onBossDefeated?: (g: Game) => void }).onBossDefeated?.(this));
    }
  }

  onBossAggro(enemy: Enemy): void {
    this.ui.setBossBar({ name: enemy.name, hp: enemy.hp, maxHp: enemy.stats.maxHp });
  }

  // ---------------------------------------------------------------------------
  // Dungeon bookkeeping
  // ---------------------------------------------------------------------------

  private dungeonUpdate(dt: number) {
    this.dungeonTick += dt;
    if (this.dungeonTick < 0.15) return;
    this.dungeonTick = 0;
    const ds = useDungeonStore.getState();
    const d = ds.dungeon;
    if (!d) return;
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor((this.player.y - 2) / TILE);
    ds.setPlayerTile(tx, ty);
    const room = roomAt(d, tx, ty);
    if (room) ds.exploreRoom(room.id);
    const boss = this.enemies().find((e) => e.guardian);
    if (boss && useUiStore.getState().bossBar) this.ui.setBossBar({ name: boss.name, hp: Math.max(0, boss.hp), maxHp: boss.stats.maxHp });
  }

  /** At the stairs: push deeper, or bank the run. */
  floorCleared(): void {
    this.ui.openPanel("floorCleared");
  }

  /** Down one floor. HP carries over, so the potion count matters. */
  descendDungeon(): void {
    this.ui.closePanel();
    useDungeonStore.getState().descend();
    this.requestTravel("dungeon", "default");
  }

  /** Leave the dungeon. Clearing and retreating both keep the run's loot. */
  exitDungeon(outcome: "cleared" | "retreated"): void {
    const ds = useDungeonStore.getState();
    ds.finish(outcome);
    if (outcome === "cleared") useWorldStore.getState().recordRunComplete();
    this.ui.openPanel("dungeonResult");
  }

  // ---------------------------------------------------------------------------
  // Death
  // ---------------------------------------------------------------------------

  onPlayerDeathAnimationDone(): void {
    const inDungeon = this.area.id === "dungeon";
    const player = usePlayerStore.getState();
    const lostGold = Math.floor(player.gold * (inDungeon ? 0.25 : 0.1));
    let lostItems: { itemId: string; quantity: number }[] = [];
    if (inDungeon) {
      // Everything found this run is dropped in the dark.
      const ds = useDungeonStore.getState();
      let stacks = useInventoryStore.getState().stacks;
      for (const it of ds.runItems) {
        const owned = stacks.reduce((s, x) => (x.itemId === it.itemId ? s + x.quantity : s), 0);
        const q = Math.min(owned, it.quantity);
        if (q > 0) {
          stacks = removeFromStacks(stacks, it.itemId, q) ?? stacks;
          lostItems.push({ itemId: it.itemId, quantity: q });
        }
      }
      useInventoryStore.getState().loadFrom(stacks);
      ds.finish("died");
    } else lostItems = [];
    player.loseGold(lostGold);
    useWorldStore.getState().bumpStat("deaths");
    // Out of your depth? Say so: gear (not grinding the same floor) is the answer.
    const floor = useDungeonStore.getState().floor;
    const danger = inDungeon ? dangerFor(floor, this.playerStats()) : "easy";
    this.ui.openPanel("death", { lostGold, lostItems, inDungeon, wall: danger === "risky" || danger === "deadly" });
  }

  respawnAtHome(): void {
    this.ui.closePanel();
    usePlayerStore.getState().fullHeal();
    this.player.revive();
    useDungeonStore.getState().reset();
    this.requestTravel("house", "bed");
  }

  /** Effective combat stats of the player right now. */
  playerStats() {
    const s = usePlayerStore.getState();
    return playerEffectiveStats(s);
  }

  destroy(): void {
    this.destroyed = true;
    for (const u of this.unsubs) u();
    this.input?.destroy();
    if (this.app?.renderer) {
      this.area?.destroy();
      this.lighting?.destroy();
      this.app.destroy(true, { children: true });
    }
  }
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

