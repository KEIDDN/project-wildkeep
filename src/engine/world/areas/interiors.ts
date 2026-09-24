import { placeTavernHappenings } from "../happenings";
import { Graphics, Sprite } from "pixi.js";
import { Area } from "../Area";
import type { Game } from "../../Game";
import { ASSETS, icon16Path, interiorPath } from "../../../data/assets";
import { tex } from "../../textures";
import { InteractSpot, Npc, StealSpot, npc } from "../../entities/Props";
import { Entity } from "../../entities/Entity";
import { usePlayerStore } from "../../../store/playerStore";
import { grantItems } from "../../../game/actions";
import { HIGH_STAKES_LEVEL } from "../../../game/casino/tables";
import { AREAS } from "../../../data/areas";
import { useUiStore } from "../../../store/uiStore";
import type { AreaId } from "../../../game/core/types";
import { currentHouseLevel } from "../../../game/systems/playerStats";
import { houseLevelInfo } from "../../../data/house";
import { useTimeStore } from "../../../store/timeStore";
import { useSocialStore } from "../../../store/socialStore";
import { timeOfDay } from "../../../game/time/clock";
import { getNpc } from "../../../data/npcs";
import { dialogueFor, npcAvailable } from "../../../game/npcs";
import { attemptSteal, type StealDef } from "../../../game/social/crime";
import { houseName, npcName } from "../../../i18n/content";
import { t } from "../../../i18n";
import { eventActive } from "../../../game/social/worldEvents";
import { adjustHonor } from "../../../game/social/honor";
import { audio } from "../../../game/audio/AudioManager";
import { placeTavernGoers } from "../../Schedules";

/**
 * Interiors are pre-composed backgrounds (flattened from the Pixel Crawler
 * tavern mockup, NPC layers stripped) with a separately authored collision
 * grid — the art never decides what's solid.
 */
function interiorBase(id: "house" | "tavern" | "shop" | "forge", areaId: AreaId): Area {
  const meta = ASSETS.interiors[id];
  const area = new Area(areaId, meta.w, meta.h, meta.cell);
  area.ambient = AREAS[areaId].ambientLight ?? 1;
  area.ground.addChild(new Sprite(tex(interiorPath(id))));
  if (meta.overlay) area.above.addChild(new Sprite(tex(`/sprites/interiors/${id}_above.png`)));
  meta.collision.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) if (row[cx] === "#") area.collision.setSolidCell(cx, cy);
  });
  return area;
}

/** A dark doorway cut into the bottom/side wall plus a mat, so exits read. */
function doorway(area: Area, x: number, y: number, w: number, h: number) {
  const g = new Graphics();
  g.rect(x, y, w, h).fill(0x120c0a);
  g.rect(x, y, w, 2).fill(0x3a2418);
  g.rect(x + 3, y - 7, w - 6, 6).fill({ color: 0x7a3b2a, alpha: 0.9 });
  g.rect(x + 4, y - 6, w - 8, 4).fill({ color: 0xa65a3a, alpha: 0.9 });
  area.ground.addChild(g);
}

/** Something pocketable, gone for the day once taken. */
export function stealable(area: Area, x: number, y: number, icon: string, def: StealDef) {
  const isUsed = () => useSocialStore.getState().usedToday(def.key, useTimeStore.getState().day);
  area.add(new StealSpot(x, y, tex(icon16Path(icon)), def, (g) => attemptSteal(g, x, y, def), isUsed));
}

export function buildHouse(_game: Game): Area {
  const area = interiorBase("house", "house");
  const level = currentHouseLevel();
  area.spawns.default = { x: 72, y: 150, dir: "up" };
  area.spawns.door = { x: 72, y: 150, dir: "up" };
  area.spawns.bed = { x: 64, y: 96, dir: "down" };

  doorway(area, 58, 162, 28, 14);
  area.trigger({ rect: { x: 56, y: 156, w: 32, h: 20 }, travel: { area: "town", spawn: "house_door" }, requireDir: "down" });
  area.add(new InteractSpot(72, 158, () => ({ verb: t("prompt.leave"), target: houseName(currentHouseLevel()) }), (g) => g.requestTravel("town", "house_door"), { radius: 14, marker: true }));

  // Bed: sleep until morning (heal, regrow the world, save).
  area.add(
    new InteractSpot(
      58,
      92,
      () => {
        const night = timeOfDay(useTimeStore.getState().minute);
        return { verb: t("prompt.sleepIn"), target: night === "night" || night === "evening" ? t("prompt.target.bed") : t("prompt.target.bedSkip") };
      },
      (game) => void game.sleep(),
      { radius: 22 },
    ),
  );

  // Planning desk by the nightstand: house upgrades.
  area.add(new InteractSpot(92, 70, () => ({ verb: t("prompt.plan"), target: t("prompt.target.homeImprovements") }), () => useUiStore.getState().openPanel("house"), { radius: 16 }));

  // Trophy shelf in the corner nook: your records and collection.
  area.add(new InteractSpot(28, 136, () => ({ verb: t("prompt.lookAt"), target: t("prompt.target.trophyShelf") }), () => useUiStore.getState().openPanel("journal", { tab: "records" }), { radius: 14 }));

  // Storage trunk under the table.
  area.add(new InteractSpot(118, 142, () => ({ verb: t("prompt.open"), target: t("prompt.target.trunk") }), () => useUiStore.getState().openPanel("stash"), { radius: 22 }));

  // Large House and up: the table doubles as a kitchen.
  if (houseLevelInfo(level).perks.workbench) {
    area.add(
      new InteractSpot(104, 118, () => ({ verb: t("prompt.cookAt"), target: t("prompt.target.kitchen") }), () => useUiStore.getState().openPanel("crafting", { station: "kitchen" }), {
        radius: 16,
      }),
    );
    area.prop("pot_a", 128, 112, { tint: 0xd8c8b0 });
  }

  // Home comforts that arrive with each upgrade.
  if (level >= 2) {
    area.prop("plant_leafy", 104, 150, { collider: { w: 8, h: 4 } });
    area.prop("pot_b", 44, 152, { collider: { w: 8, h: 4 } });
  }
  if (level >= 3) {
    area.prop("banner_red", 40, 60);
    area.light({ x: 72, y: 100, radius: 50, color: 0xffd8a0, intensity: 0.5 });
  }
  if (level >= 4) {
    area.prop("banner_blue", 128, 60);
    area.prop("vase", 36, 150, { collider: { w: 8, h: 4 } });
  }

  area.light({ x: 30, y: 140, radius: 40, color: 0xfff2d0, intensity: 0.6 });
  area.light({ x: 112, y: 40, radius: 60, color: 0xffd8a0, intensity: 0.5 });
  return area;
}

/**
 * Mira's General Store: walk in, go up to the counter, talk to Mira, shop.
 * (Selling only ever happens here, face to face.) The first chat of the
 * day is a proper conversation; after that she gets straight to business.
 */
export function buildShop(_game: Game): Area {
  const area = interiorBase("shop", "shop");
  area.spawns.default = { x: 72, y: 148, dir: "up" };
  area.spawns.door = { x: 72, y: 148, dir: "up" };

  doorway(area, 58, 162, 28, 14);
  area.trigger({ rect: { x: 56, y: 156, w: 32, h: 20 }, travel: { area: "town", spawn: "shop_door" }, requireDir: "down" });
  area.add(new InteractSpot(72, 158, () => ({ verb: t("prompt.leave"), target: t("prompt.target.generalStore") }), (g) => g.requestTravel("town", "shop_door"), { radius: 14, marker: true }));

  // Shelves and stock.
  area.prop("d_shelf_goods", 24, 98, { collider: { w: 24, h: 10 } });
  area.prop("d_rug_round", 72, 136, { flat: true });
  area.prop("d_plant_pot", 102, 156, { collider: { w: 8, h: 4 } });
  area.prop("wardrobe", 122, 96, { collider: { w: 24, h: 10 } });
  area.prop("crate_stack", 122, 156, { collider: { w: 28, h: 8 } });
  area.prop("barrel", 16, 136, { collider: { w: 12, h: 6 } });
  area.prop("barrel", 16, 154, { collider: { w: 12, h: 6 } });
  area.prop("barrel_water", 124, 122, { collider: { w: 12, h: 6 } });
  area.prop("pot_a", 46, 76);
  area.prop("vase", 98, 76);

  // Mira behind the counter.
  const mira = getNpc("mira");
  const keeper = npc("mira", 72, 82);
  if (keeper) area.add(keeper);
  const counter = area.prop("shop_counter", 72, 98, { collider: { w: 50, h: 12 } });
  counter.sortBias = 1;
  area.add(
    new InteractSpot(
      72,
      104,
      () => (npcAvailable(mira) ? { verb: t("prompt.talk"), target: npcName(mira) } : null),
      (g) => {
        const day = useTimeStore.getState().day;
        const social = useSocialStore.getState();
        if (social.usedToday("chat:mira", day)) useUiStore.getState().openPanel("shop");
        else {
          social.useToday("chat:mira", day);
          g.ui.showDialogue(dialogueFor(mira));
        }
      },
      { radius: 18, priority: 0 },
    ),
  );

  // A pie cooling on a barrel by the wall. Mira is *right there*, mind.
  stealable(area, 124, 108, "apple_pie", { key: "steal:shop_pie", target: "prompt.target.applePie", loot: { itemId: "apple_pie", quantity: 1 }, honor: 6 });

  area.light({ x: 72, y: 90, radius: 60, color: 0xffe0b0, intensity: 0.6 });
  area.light({ x: 30, y: 130, radius: 40, color: 0xfff2d0, intensity: 0.5 });
  return area;
}

/**
 * Bram's forge: a hot little stone room. Furnace (smelter) against the back
 * wall, Bram behind his anvil facing the door, stock and scrap around the
 * walls. Talk to Bram to forge; use the furnace to smelt.
 */
export function buildForge(_game: Game): Area {
  const area = interiorBase("forge", "forge");
  area.backdrop = 0x0e0c0c;
  area.spawns.default = { x: 80, y: 184, dir: "up" };
  area.spawns.door = area.spawns.default;

  doorway(area, 66, 198, 28, 14);
  area.trigger({ rect: { x: 62, y: 192, w: 36, h: 20 }, travel: { area: "town", spawn: "forge_door" }, requireDir: "down" });
  area.add(new InteractSpot(80, 194, () => ({ verb: t("prompt.leave"), target: t("prompt.target.forgeShort") }), (g) => g.requestTravel("town", "forge_door"), { radius: 14, marker: true }));

  // The furnace doubles as the smelter.
  area.prop("furnace", 112, 104, { collider: { w: 64, h: 18 } }).withLight({ radius: 90, color: 0xff7a2a, intensity: 1, dy: -18, flicker: 1 });
  area.add(new ForgeFire(112, 90));
  area.add(
    new InteractSpot(112, 112, () => ({ verb: t("prompt.use"), target: t("prompt.target.smelter") }), () => useUiStore.getState().openPanel("crafting", { station: "smelter" }), {
      radius: 18,
      priority: 1,
    }),
  );

  // Bram behind the anvil, facing whoever walks in.
  const bram = getNpc("bram");
  const smith = npc("bram", 34, 150, { face: "side", facingLeft: false });
  if (smith) area.add(smith);
  area.prop("anvil", 66, 152, { collider: { w: 46, h: 10 } });
  area.add(new AnvilWork(50, 140, () => !!smith && !smith.busy));
  area.add(
    new InteractSpot(
      58,
      160,
      () => (npcAvailable(bram) && smith ? { verb: t("prompt.talk"), target: npcName(bram) } : { verb: t("prompt.use"), target: t("prompt.target.anvil"), blocked: t("prompt.smithAway") }),
      (g) => {
        if (!smith) return;
        smith.interact(g);
      },
      { radius: 20, priority: 0 },
    ),
  );

  // Stock, scrap and the tools of the trade.
  area.prop("coal_heap", 146, 118, { collider: { w: 22, h: 6 } });
  area.prop("coal_crate", 146, 140, { collider: { w: 12, h: 6 } });
  area.prop("barrel_water", 58, 192, { collider: { w: 12, h: 6 } });
  area.prop("empty_crate", 28, 190, { collider: { w: 12, h: 6 } });
  area.prop("barrel", 42, 192, { collider: { w: 12, h: 6 } });
  // Finished work on display, a trough to quench it, a bench of tools.
  area.prop("d_armor_stand", 26, 112, { collider: { w: 12, h: 6 } });
  area.prop("d_quench_trough", 104, 162, { collider: { w: 20, h: 7 } });
  area.prop("d_smith_table", 124, 186, { collider: { w: 30, h: 8 } });
  // Repairs: Bram's mending bench (only while he's in).
  area.add(
    new InteractSpot(
      124,
      178,
      () => (npcAvailable(bram) && smith ? { verb: t("prompt.repairAt"), target: t("prompt.target.mendingBench") } : { verb: t("prompt.repairAt"), target: t("prompt.target.mendingBench"), blocked: t("prompt.smithAway") }),
      () => useUiStore.getState().openPanel("repair"),
      { radius: 16, priority: 1 },
    ),
  );
  area.prop("chain", 60, 84, { flat: true });
  area.prop("chain", 72, 80, { flat: true });
  area.prop("banner_red", 146, 76, { flat: true });
  stealable(area, 124, 172, "iron_bar", { key: "steal:forge_bar", target: "prompt.target.ironBar", loot: { itemId: "iron_bar", quantity: 1 }, honor: 8 });

  area.light({ x: 80, y: 150, radius: 70, color: 0xffb070, intensity: 0.45 });
  return area;
}

/** The furnace mouth: flickering embers over the sprite. */
class ForgeFire extends Entity {
  private t = 0;
  update(dt: number, game: Game): void {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.12 + Math.random() * 0.25;
    game.fx.burst(this.x + (Math.random() * 16 - 8), this.y, "spark", 1, { speed: 12, up: 30, life: 0.7 });
  }
}

/** Bram at work: a clang and a shower of sparks every few seconds, unless
 * he's busy talking to you. */
class AnvilWork extends Entity {
  private t = 1.5;
  private working: () => boolean;
  constructor(x: number, y: number, working: () => boolean) {
    super(x, y);
    this.working = working;
  }
  update(dt: number, game: Game): void {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1.1 + Math.random() * 1.8;
    if (!this.working()) return;
    game.fx.burst(this.x + 8, this.y, "spark", 6, { speed: 45, up: 40, life: 0.45 });
    if (Math.hypot(game.player.x - this.x, game.player.y - this.y) < 140) audio.sfx("mine", { pitch: 1.6, volume: 0.35 });
  }
}

export function buildTavern(_game: Game): Area {
  const area = interiorBase("tavern", "tavern");
  area.spawns.default = { x: 34, y: 436, dir: "side" };
  area.spawns.door = { x: 34, y: 436, dir: "side" };

  area.trigger({ rect: { x: 0, y: 412, w: 12, h: 36 }, travel: { area: "town", spawn: "tavern_door" }, requireDir: "left" });
  area.add(new InteractSpot(16, 436, () => ({ verb: t("prompt.leave"), target: t("prompt.target.tavernShort") }), (g) => g.requestTravel("town", "tavern_door"), { radius: 14, marker: true }));

  const add = (e: Npc | null) => e && area.add(e);

  // --- the bar -------------------------------------------------------------------------
  add(npc("greta", 298, 189));
  area.add(new InteractSpot(298, 226, () => ({ verb: t("prompt.orderFrom"), target: t("prompt.target.greta") }), () => useUiStore.getState().openPanel("tavern"), { radius: 22, priority: 0 }));
  add(npc("pip", 348, 190, { route: [{ x: 348, y: 190 }, { x: 420, y: 215 }, { x: 492, y: 166 }, { x: 396, y: 278 }, { x: 340, y: 286 }] }));
  add(npc("cook", 110, 120));
  add(npc("wick", 268, 232, { facingLeft: false }));

  // --- the hall: travellers, regulars, and the evening crowd ---------------------------------
  add(npc("rowan", 330, 306, { facingLeft: true }));
  add(npc("traveler_1", 470, 225, { facingLeft: true }));
  add(npc("traveler_2", 452, 262));
  add(npc("patron_1", 300, 230));
  add(npc("patron_2", 444, 270, { facingLeft: true }));
  add(npc("gambler_1", 500, 125));
  add(npc("gambler_2", 600, 110, { facingLeft: true }));
  add(npc("hob", 406, 304));
  add(npc("hooded", 612, 300, { facingLeft: true }));
  // Off-duty monsters, playing cards at the long table.
  add(npc("morg", 566, 214, { facingLeft: true }));
  add(npc("rattles", 566, 252, { facingLeft: true }));

  // Townsfolk out for the evening (data/npcs.ts schedules) take free seats.
  placeTavernGoers(area, [
    { x: 488, y: 214 },
    { x: 488, y: 290 },
    { x: 600, y: 290, left: true },
    { x: 250, y: 300 },
    { x: 360, y: 236 },
    { x: 430, y: 300, left: true },
    { x: 520, y: 330 },
  ]);

  // The bard plays on the rug by the stairs.
  const bard = npc("lyra", 200, 280);
  if (bard) {
    area.add(bard);
    area.add(new MusicNotes(200, 262));
    area.light({ x: 200, y: 270, radius: 50, color: 0xffd8a0, intensity: 0.6 });
    stealable(area, 216, 292, "coin_bag", { key: "steal:tip_jar", target: "prompt.target.tipJar", loot: { gold: [4, 12] }, honor: 8 });
  }

  placeTavernHappenings(area);

  // Things that aren't nailed down.
  stealable(area, 322, 204, "tankard", { key: "steal:tankard", target: "prompt.target.tankard", loot: { itemId: "greta_tankard", quantity: 1 }, honor: 6 });
  stealable(area, 540, 306, "coin_bag", { key: "steal:purse", target: "prompt.target.coinPurse", loot: { gold: [8, 20] }, honor: 10 });

  // --- the Gilded Gamble: casino corner on the raised platform ---------------------------
  add(npc("silas", 528, 108));
  area.add(new InteractSpot(560, 96, () => ({ verb: t("prompt.play"), target: t("prompt.target.blackjack") }), () => useUiStore.getState().openPanel("blackjack"), { radius: 18 }));
  add(npc("vex", 452, 104));
  area.add(new InteractSpot(487, 96, () => ({ verb: t("prompt.play"), target: t("prompt.target.wheel") }), () => useUiStore.getState().openPanel("roulette"), { radius: 18 }));

  // The back door by the bar: Silas's private room, for serious players.
  add(npc("bouncer", 372, 158, { facingLeft: true }));
  area.add(
    new InteractSpot(
      357,
      150,
      () =>
        usePlayerStore.getState().skills.gambling.level >= HIGH_STAKES_LEVEL
          ? { verb: t("prompt.enter"), target: t("prompt.target.backRoom") }
          : { verb: t("prompt.enter"), target: t("prompt.target.backRoom"), blocked: t("prompt.gamblingLevel", { n: HIGH_STAKES_LEVEL }) },
      () => useUiStore.getState().openPanel("backRoom"),
      { radius: 16, priority: 0 },
    ),
  );

  // The pantry off the kitchen: leftovers, once a day.
  const pantryKey = "pantry";
  const pantryUsed = () => useSocialStore.getState().usedToday(pantryKey, useTimeStore.getState().day);
  area.add(
    new InteractSpot(
      90,
      316,
      () =>
        pantryUsed()
          ? { verb: t("prompt.search"), target: t("prompt.target.leftovers"), blocked: t("prompt.emptyTomorrow") }
          : { verb: t("prompt.search"), target: t("prompt.target.leftovers") },
      (game) => {
        if (pantryUsed()) return;
        useSocialStore.getState().useToday(pantryKey, useTimeStore.getState().day);
        grantItems([
          { itemId: "forest_stew", quantity: 1 },
          { itemId: "mushroom", quantity: 2 },
        ]);
        game.ui.pushToast(t("toast.leftovers"), "info");
      },
      { radius: 18 },
    ),
  );

  // Brawl day: somebody has to stop this. (Or not. Your call.)
  if (eventActive("brawl")) {
    const brawlKey = "brawl_broken";
    const done = () => useSocialStore.getState().usedToday(brawlKey, useTimeStore.getState().day);
    area.add(
      new InteractSpot(
        420,
        246,
        () => (done() ? null : { verb: t("events.breakUp"), target: t("events.theBrawl") }),
        (game) => {
          if (done()) return;
          useSocialStore.getState().useToday(brawlKey, useTimeStore.getState().day);
          useSocialStore.getState().addDeed("helped");
          usePlayerStore.getState().heal(15);
          game.shake(3, 0.3);
          game.fx.burst(420, 236, "dust", 16, { speed: 60, up: 40 });
          game.ui.pushToast(t("events.brawlDone"), "levelup", { icon: "beer" });
          adjustHonor(5);
        },
        { radius: 40, priority: 0 },
      ),
    );
  }

  // Warm pools of light from the wall torches and hearth.
  for (const [x, y] of [
    [470, 136],
    [582, 136],
    [248, 264],
    [360, 264],
    [470, 264],
    [582, 264],
    [56, 376],
    [312, 376],
    [440, 376],
    [568, 376],
  ])
    area.light({ x, y, radius: 60, color: 0xffb060, intensity: 0.75, flicker: 1 });
  area.light({ x: 232, y: 70, radius: 70, color: 0xff8a40, intensity: 0.7, flicker: 1 });
  area.light({ x: 528, y: 80, radius: 70, color: 0xffe08a, intensity: 0.6 });
  return area;
}

/** Little musical notes drifting up from the bard. */
class MusicNotes extends Entity {
  private t = 0;
  update(dt: number, game: Game): void {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.7 + Math.random() * 0.6;
    const colors = [0xffe08a, 0xc8f0ff, 0xffb0d0];
    game.fx.text(this.x + (Math.random() * 16 - 8), this.y, Math.random() < 0.5 ? "♪" : "♫", colors[Math.floor(Math.random() * colors.length)], { size: 8, life: 1.4 });
  }
}
