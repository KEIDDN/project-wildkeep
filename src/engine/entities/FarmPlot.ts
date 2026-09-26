import { Graphics, Sprite } from "pixi.js";
import { Entity, type Interactable } from "./Entity";
import type { Game } from "../Game";
import { TILE } from "../../game/core/constants";
import { tex } from "../textures";
import { icon16Path } from "../../data/assets";
import { getItem } from "../../data/items";
import { canWater, cropOf, growthOf, harvest, hasCan, hasHoe, hoursLeft, isRipe, isTilled, lastSeedUsed, plant, plotAt, plotKey, seedsOwned, stageOf, till, water, wateredToday } from "../../game/farming";
import { showTutorial } from "../../game/tutorial";
import { CROP_BY_SEED, type CropDef } from "../../data/crops";
import type { LightSource } from "../fx/Lighting";
import { audio } from "../../game/audio/AudioManager";
import { useUiStore } from "../../store/uiStore";
import { useFarmStore } from "../../store/farmStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { itemName } from "../../i18n/content";
import { t } from "../../i18n";

/**
 * One tile of your garden. E does the obvious thing: plant (the last seed
 * you used; Shift+E to pick another), water (soaks the neighbours too),
 * harvest. The plant is drawn from shapes and grows through four stages;
 * ripe crops show the real thing, bobbing.
 */
export class FarmPlot extends Entity implements Interactable {
  interactRadius = 12;
  interactPriority = 2;
  readonly toolTarget = true;
  private soil = new Graphics();
  /** Dark, damp soil drawn over the dry soil; fades in when watered. */
  private wetG = new Graphics();
  private plantG = new Graphics();
  /** Seconds since the plant last grew a stage (drives the little pop). */
  private pop = 1;
  /** 0..1 how soaked-in the water is (animates after watering). */
  private soak = 1;
  private shownStage = -2;
  private shownWet = false;
  /** Planting squash: the seed goes in, the soil settles. */
  private squash = 1;
  private fruit: Sprite | null = null;
  private readonly key: string;
  private readonly tx: number;
  private readonly ty: number;
  private drawn = "";
  private age = Math.random() * 6;
  private recheck = 1;
  private unsub: () => void;

  constructor(tx: number, ty: number) {
    super(tx * TILE + TILE / 2, ty * TILE + TILE - 2);
    this.tx = tx;
    this.ty = ty;
    this.key = plotKey(tx, ty);
    this.sortBias = -6;
    this.view.addChild(this.soil, this.wetG, this.plantG);
    this.redraw();
    this.unsub = useFarmStore.subscribe(() => this.redraw());
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y - 4;
  }

  /** What E does here, spelled out — including what's missing. */
  prompt() {
    const p = plotAt(this.key);
    const c = cropOf(p);
    if (!c) {
      if (!isTilled(p)) return hasHoe() ? { verb: t("farm.till"), target: t("farm.soil") } : { verb: t("farm.till"), target: t("farm.soil"), blocked: t("farm.needHoe") };
      const seed = lastSeedUsed();
      return seed ? { verb: t("farm.plant"), target: itemName(seed) } : { verb: t("farm.plant"), target: t("farm.tilledSoil"), blocked: t("farm.noSeeds") };
    }
    const name = itemName(c.item);
    if (isRipe(p)) return { verb: t("farm.harvest"), target: name };
    if (!wateredToday(p)) {
      if (!hasCan()) return { verb: t("farm.water"), target: name, blocked: t("farm.needCan") };
      if (canWater() <= 0) return { verb: t("farm.water"), target: name, blocked: t("farm.canEmpty") };
      return { verb: t("farm.water"), target: `${name} (${t("farm.canLeft", { n: canWater() })})` };
    }
    return { verb: t("farm.growing", { pct: Math.floor(growthOf(p) * 100) }), target: name, blocked: t("farm.readyIn", { h: hoursLeft(p) }), selfHandled: true };
  }

  interact(game: Game) {
    const p = plotAt(this.key);
    const pl = game.player;
    if (!p.crop) {
      if (!isTilled(p)) {
        pl.performAction("mine", this.x, this.y - 4, (g) => {
          const res = till(this.key);
          if (!res) return;
          this.squash = 0;
          g.fx.burst(this.x, this.y - 4, "dust", 10, { speed: 30, up: 24, height: 1 });
          g.fx.burst(this.x, this.y - 4, "coal", 4, { speed: 20, up: 20, height: 1 });
          audio.sfx("mine", { pitch: 0.7 });
          if (res.worm) g.fx.text(this.x, this.y - 22, t("farm.worm"), 0xf0c0c0, { size: 7 });
          showTutorial("farming");
        });
        return;
      }
      const shift = game.input.held("sprint");
      const seed = lastSeedUsed();
      if (shift || !seed) return this.chooseSeed(game);
      pl.performAction("collect", this.x, this.y - 4, (g) => this.doPlant(g, seed));
      return;
    }
    if (isRipe(p)) {
      pl.performAction("collect", this.x, this.y - 4, (g) => {
        const got = harvest(this.key);
        if (got) {
          // Pulled up in a puff of soil and leaves, then it hops into your arms.
          g.fx.burst(this.x, this.y - 4, "dust", 6, { speed: 26, up: 22, height: 1 });
          g.fx.burst(this.x, this.y - 8, "herb", 10, { speed: 30, up: 50 });
          const icon = tex(icon16Path(getItem(got.itemId).icon));
          for (let i = 0; i < Math.min(3, got.quantity); i++) {
            const sp = new Sprite(icon);
            sp.anchor.set(0.5, 1);
            setTimeout(() => {
              if (g.area && !this.removed) g.fx.fly(sp, this.x + (i - 1) * 3, this.y - 6, () => ({ x: g.player.x, y: g.player.y - 14 }), 0.42, i === 0 ? () => audio.sfx("pickup", { pitch: 1.1 }) : undefined);
              else sp.destroy();
            }, i * 70);
          }
          g.fx.text(this.x, this.y - 22, `+${got.quantity} ${itemName(got.itemId)}`, 0xc8f0a0, { size: 7 });
          useUiStore.getState().pushItemToast(got.itemId, itemName(got.itemId), got.quantity, getItem(got.itemId).icon, getItem(got.itemId).rarity);
          audio.sfx("collect", { pitch: 1.3 });
        }
      });
      return;
    }
    if (!wateredToday(p)) {
      pl.performAction("collect", this.x, this.y - 4, (g) => {
        const n = water(this.tx, this.ty);
        if (!n) return;
        g.fx.burst(this.x, this.y - 10, "crystal", 8 + n * 2, { speed: 24, up: 8, height: 12, life: 0.5 });
        g.fx.ring(this.x, this.y - 6, 10, 0x9fd8ff, 0.35);
        audio.sfx("potion", { pitch: 1.4 });
        if (canWater() === 0) g.fx.text(this.x, this.y - 22, t("farm.canEmptyShort"), 0x9fd8ff, { size: 7 });
      });
      return;
    }
    game.fx.text(this.x, this.y - 20, t("farm.readyIn", { h: hoursLeft(p) }), 0xe8e0c8, { size: 7 });
  }

  private doPlant(game: Game, seed: string) {
    if (!plant(this.key, seed)) return audio.sfx("deny");
    // The seed drops in, the soil settles over it.
    this.squash = 0;
    const s = new Sprite(tex(icon16Path(getItem(seed).icon)));
    s.anchor.set(0.5, 1);
    s.scale.set(0.5);
    game.fx.fly(s, game.player.x, game.player.y - 12, () => ({ x: this.x, y: this.y - 5 }), 0.3, () => game.fx.burst(this.x, this.y - 3, "dust", 6, { speed: 16, up: 14, height: 1 }));
    audio.sfx("collect", { pitch: 1.2 });
  }

  /** A little menu of the seeds you're carrying. */
  private chooseSeed(game: Game) {
    const seeds = seedsOwned();
    if (!seeds.length) {
      audio.sfx("deny");
      useUiStore.getState().pushToast(t("farm.noSeeds"), "warning", { icon: "seed_turnip" });
      return;
    }
    useUiStore.getState().showDialogue({
      speaker: t("farm.whatToPlant"),
      portrait: "seed_turnip",
      lines: [t("farm.pickSeed")],
      choices: seeds.slice(0, 8).map((s) => ({
        label: `${itemName(s)} (×${useInventoryStore.getState().quantityOf(s)}) — ${t("farm.days", { h: CROP_BY_SEED[s].hours })}`,
        onChoose: () => game.player.performAction("collect", this.x, this.y - 4, (g) => this.doPlant(g, s)),
      })),
    });
  }

  update(dt: number, game?: Game) {
    this.age += dt;
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt * 2.6);
      // Overshoot and settle: 1 → 1.35 → 1.
      const k = this.pop;
      this.plantG.scale.set(1 + Math.sin(k * Math.PI) * 0.35 * (1 - k));
    }
    if (this.soak < 1) {
      this.soak = Math.min(1, this.soak + dt * 1.8);
      this.drawWet();
    }
    if (this.squash < 1) {
      this.squash = Math.min(1, this.squash + dt * 4);
      const k = this.squash;
      this.soil.scale.set(1 + Math.sin(k * Math.PI) * 0.12, 1 - Math.sin(k * Math.PI) * 0.15);
    }
    // Magic crops shimmer after dark.
    const c = cropOf(plotAt(this.key));
    if (c?.glow && game && game.lighting.night > 0.4 && stageOf(plotAt(this.key)) >= 2 && Math.random() < dt * 1.5) game.fx.twinkle(this.x + (Math.random() * 10 - 5), this.y - 6 - Math.random() * 8, 0xbffff4);
    // Soil dries out at dawn without anything else changing: re-check now and then.
    this.recheck -= dt;
    if (this.recheck <= 0) {
      this.recheck = 1;
      this.redraw();
    }
    if (this.fruit) this.fruit.y = -10 - Math.abs(Math.sin(this.age * 2.5)) * 1.5;
  }

  light(): LightSource | null {
    const p = plotAt(this.key);
    const c = cropOf(p);
    if (!c?.glow || stageOf(p) < 2) return null;
    return { x: this.x, y: this.y - 8, radius: 22 + stageOf(p) * 4, color: 0x7ff0e0, intensity: 0.55, flicker: 0.3 };
  }

  private drawWet() {
    const w = TILE - 2;
    const top = -TILE + 3;
    const g = this.wetG.clear();
    if (!this.shownWet) return;
    // Water darkens the soil from the middle out.
    const k = this.soak;
    const rx = (w / 2) * Math.min(1, k * 1.4);
    const ry = ((w - 1) / 2) * Math.min(1, k * 1.4);
    const cx = 0;
    const cy = top + (w - 1) / 2;
    g.rect(cx - rx, cy - ry, rx * 2, ry * 2).fill({ color: 0x2a1a10, alpha: 0.42 });
    for (let i = 0; i < 3; i++) if (k > 0.5) g.rect(-w / 2 + 1, top + 2 + i * 4, w - 2, 1).fill({ color: 0x1e120a, alpha: 0.5 * (k - 0.5) * 2 });
    g.rect(-w / 2, top, w, 1).fill({ color: 0x9fd8ff, alpha: 0.35 * k });
    // A glint or two of standing water.
    if (k > 0.7) g.rect(-3, top + 5, 2, 1).fill({ color: 0xbfe8ff, alpha: 0.5 }).rect(3, top + 9, 1, 1).fill({ color: 0xbfe8ff, alpha: 0.4 });
  }

  /** Redraws only when what's shown changes (stage, water, crop). */
  private redraw() {
    if (this.removed) return;
    const p = plotAt(this.key);
    const stage = stageOf(p);
    const wet = wateredToday(p);
    const tilled = isTilled(p);
    const sig = `${p.crop}|${stage}|${wet}|${tilled}`;
    if (sig === this.drawn) return;
    const firstDraw = this.drawn === "";
    this.drawn = sig;
    // Grew a stage while you watched (or since you last looked): pop.
    if (!firstDraw && stage > this.shownStage && this.shownStage >= 0) this.pop = 0;
    this.shownStage = stage;
    if (wet !== this.shownWet) {
      this.shownWet = wet;
      this.soak = wet && !firstDraw ? 0 : 1;
      this.drawWet();
    }
    const s = this.soil;
    s.clear();
    const w = TILE - 2;
    const top = -TILE + 3;
    if (!tilled) {
      // Hard, weedy ground: needs the hoe first.
      s.rect(-w / 2, top, w, w - 1).fill(0x8a6a44);
      for (let i = 0; i < 5; i++) s.rect(-w / 2 + ((i * 5) % (w - 2)), top + 2 + ((i * 3) % (w - 5)), 2, 1).fill(0x5a8a3a);
      s.rect(-w / 2, top, w, w - 1).stroke({ width: 1, color: 0x6a4a2a, alpha: 0.6 });
      this.plantG.clear();
      this.fruit?.destroy();
      this.fruit = null;
      return;
    }
    // Turned soil: furrows with a lit ridge on each, so it reads as dug.
    s.rect(-w / 2, top, w, w - 1).fill(0x7a5334);
    for (let i = 0; i < 3; i++) s.rect(-w / 2 + 1, top + 2 + i * 4, w - 2, 1).fill(0x5e3e26).rect(-w / 2 + 1, top + 1 + i * 4, w - 2, 1).fill(0x8e6440);
    s.rect(-w / 2, top + w - 2, w, 1).fill(0x5a3a22);
    const g = this.plantG;
    g.clear();
    g.position.set(0, top + 11);
    this.fruit?.destroy();
    this.fruit = null;
    const c = cropOf(p);
    if (!c || stage < 0) return;
    drawPlant(g, c, stage);
    if (stage >= 4) {
      this.fruit = new Sprite(tex(icon16Path(getItem(c.item).icon)));
      this.fruit.anchor.set(0.5, 1);
      this.fruit.scale.set(0.75);
      this.view.addChild(this.fruit);
    }
  }

  destroy(): void {
    this.unsub();
    super.destroy();
  }
}

const LEAF = 0x5aa33a;
const LEAF_LIGHT = 0x7ccc52;
const LEAF_DARK = 0x3f7f2a;

/**
 * The plant itself, by family and stage (0 seed · 1 sprout · 2 young ·
 * 3 budding · 4 ripe). Origin is the soil line at the middle of the plot;
 * everything is whole pixels so it sits with the rest of the art.
 */
function drawPlant(g: Graphics, c: CropDef, stage: number) {
  if (stage === 0) {
    g.rect(-1, -1, 2, 1).fill(0x3a2a18).rect(0, -2, 1, 1).fill(0x6a4a2a);
    return;
  }
  if (stage === 1) {
    // Every sprout starts the same way: two seed leaves.
    g.rect(0, -3, 1, 3).fill(LEAF).rect(-2, -4, 2, 1).fill(LEAF_LIGHT).rect(1, -4, 2, 1).fill(LEAF_LIGHT);
    return;
  }
  const big = stage >= 3;
  switch (c.shape) {
    case "root": {
      // A leafy tuft; the root's shoulder shows at the soil once it's budding.
      const h = big ? 8 : 6;
      g.rect(-3, -h + 2, 1, h - 2).fill(LEAF_DARK).rect(0, -h, 1, h).fill(LEAF).rect(2, -h + 1, 1, h - 1).fill(LEAF_DARK);
      g.rect(-4, -h + 1, 2, 1).fill(LEAF_LIGHT).rect(1, -h - 1, 2, 1).fill(LEAF_LIGHT).rect(3, -h + 2, 2, 1).fill(LEAF_LIGHT);
      if (big) g.rect(-2, -1, 5, 2).fill(c.color).rect(-1, -2, 3, 1).fill(c.color);
      break;
    }
    case "bush": {
      const r = big ? 5 : 3.5;
      g.circle(0, -r, r).fill(LEAF_DARK).circle(-1, -r - 1, r - 1).fill(LEAF).circle(1, -r - 2, r - 2).fill(LEAF_LIGHT);
      if (big) g.rect(-3, -4, 2, 2).fill(c.color).rect(2, -6, 2, 2).fill(c.color).rect(-1, -8, 2, 2).fill(c.color);
      break;
    }
    case "stake": {
      // A cane with the vine climbing it; fruit hangs off once it's budding.
      const h = big ? 13 : 9;
      g.rect(2, -h - 1, 1, h + 1).fill(0x8a5a32);
      for (let y = 1; y < h; y += 3) g.rect(y % 2 ? -2 : 3, -y - 1, 2, 2).fill(y % 2 ? LEAF : LEAF_LIGHT).rect(1, -y, 1, 2).fill(LEAF_DARK);
      if (big) g.rect(-2, -h + 4, 2, 2).fill(c.color).rect(4, -h + 7, 2, 2).fill(c.color).rect(-1, -5, 2, 2).fill(c.color);
      break;
    }
    case "stalk": {
      const h = big ? 14 : 9;
      g.rect(0, -h, 1, h).fill(LEAF).rect(-3, -h + 5, 3, 1).fill(LEAF_LIGHT).rect(1, -h + 3, 3, 1).fill(LEAF_LIGHT).rect(-3, -h + 9, 3, 1).fill(LEAF_DARK).rect(1, -h + 8, 3, 1).fill(LEAF_DARK);
      if (big) g.rect(-1, -h - 2, 3, 2).fill(0xe8d070).rect(1, -h + 5, 2, 3).fill(c.color);
      break;
    }
    case "vine": {
      // Sprawls sideways across the bed, one big fruit forming underneath.
      const r = big ? 6 : 4;
      g.ellipse(-2, -2, r, 2.5).fill(LEAF_DARK).circle(-r + 1, -3, 2).fill(LEAF).circle(r - 3, -3, 2).fill(LEAF_LIGHT).rect(-r, -2, r * 2 - 2, 1).fill(LEAF);
      if (big) g.circle(1, -2, 2.5).fill(c.color).rect(0, -5, 1, 1).fill(LEAF_DARK);
      break;
    }
    case "head": {
      // Outer leaves open out; the pale head swells in the middle.
      const r = big ? 5 : 4;
      g.ellipse(0, -2, r + 1, 3).fill(LEAF_DARK).circle(-r + 1, -3, 2).fill(LEAF).circle(r - 1, -3, 2).fill(LEAF);
      g.circle(0, -3, big ? 3 : 2).fill(c.color).rect(-1, -5, 2, 1).fill(0xc8f0a8);
      break;
    }
    case "herb": {
      const h = big ? 9 : 6;
      g.rect(-2, -h + 2, 1, h - 2).fill(LEAF_DARK).rect(0, -h, 1, h).fill(LEAF).rect(2, -h + 1, 1, h - 1).fill(LEAF);
      for (let y = 2; y < h; y += 2) g.rect(y % 4 ? -4 : 1, -y, 2, 1).fill(LEAF_LIGHT);
      if (big) g.rect(-2, -h + 1, 1, 1).fill(0xf0e0a0).rect(0, -h - 1, 1, 1).fill(0xf0e0a0).rect(2, -h, 1, 1).fill(0xf0e0a0).rect(-1, -1, 3, 1).fill(c.color);
      break;
    }
  }
  if (c.glow && stage >= 2) g.rect(-1, -2, 3, 1).fill({ color: 0xbffff4, alpha: 0.8 });
}
