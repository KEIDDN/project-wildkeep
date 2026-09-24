import { Graphics, Sprite } from "pixi.js";
import { Entity, type Interactable } from "./Entity";
import type { Game } from "../Game";
import { TILE } from "../../game/core/constants";
import { tex } from "../textures";
import { icon16Path } from "../../data/assets";
import { getItem } from "../../data/items";
import { canWater, cropOf, growthOf, harvest, hasCan, hasHoe, hoursLeft, isRipe, isTilled, lastSeedUsed, plant, plotAt, plotKey, seedsOwned, stageOf, till, water, wateredToday } from "../../game/farming";
import { showTutorial } from "../../game/tutorial";
import { CROP_BY_SEED } from "../../data/crops";
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
  private soil = new Graphics();
  private plantG = new Graphics();
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
    this.view.addChild(this.soil, this.plantG);
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
          g.fx.burst(this.x, this.y - 6, "herb", 10, { speed: 30, up: 50 });
          g.fx.text(this.x, this.y - 22, `+${got.quantity} ${itemName(got.itemId)}`, 0xc8f0a0, { size: 7 });
          useUiStore.getState().pushItemToast(got.itemId, itemName(got.itemId), got.quantity, getItem(got.itemId).icon, getItem(got.itemId).rarity);
          audio.sfx("pickup");
        }
      });
      return;
    }
    if (!wateredToday(p)) {
      pl.performAction("collect", this.x, this.y - 4, (g) => {
        const n = water(this.tx, this.ty);
        if (!n) return;
        g.fx.burst(this.x, this.y - 10, "crystal", 8 + n * 2, { speed: 24, up: 8, height: 12, life: 0.5 });
        audio.sfx("potion", { pitch: 1.4 });
        if (canWater() === 0) g.fx.text(this.x, this.y - 22, t("farm.canEmptyShort"), 0x9fd8ff, { size: 7 });
      });
      return;
    }
    game.fx.text(this.x, this.y - 20, t("farm.readyIn", { h: hoursLeft(p) }), 0xe8e0c8, { size: 7 });
  }

  private doPlant(game: Game, seed: string) {
    if (!plant(this.key, seed)) return audio.sfx("deny");
    game.fx.burst(this.x, this.y - 2, "dust", 6, { speed: 16, up: 14, height: 1 });
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
      choices: seeds.slice(0, 6).map((s) => ({
        label: `${itemName(s)} (×${useInventoryStore.getState().quantityOf(s)}) — ${t("farm.days", { h: CROP_BY_SEED[s].hours })}`,
        onChoose: () => game.player.performAction("collect", this.x, this.y - 4, (g) => this.doPlant(g, s)),
      })),
    });
  }

  update(dt: number) {
    this.age += dt;
    // Soil dries out at dawn without anything else changing: re-check now and then.
    this.recheck -= dt;
    if (this.recheck <= 0) {
      this.recheck = 1;
      this.redraw();
    }
    if (this.fruit) this.fruit.y = -8 - Math.abs(Math.sin(this.age * 2.5)) * 1.5;
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
    this.drawn = sig;
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
    s.rect(-w / 2, top, w, w - 1).fill(wet ? 0x4a3020 : 0x7a5334);
    for (let i = 0; i < 3; i++) s.rect(-w / 2 + 1, top + 2 + i * 4, w - 2, 1).fill(wet ? 0x352216 : 0x5e3e26);
    if (wet) s.rect(-w / 2, top, w, 1).fill({ color: 0x9fd8ff, alpha: 0.35 });
    const g = this.plantG;
    g.clear();
    this.fruit?.destroy();
    this.fruit = null;
    const c = cropOf(p);
    if (!c || stage < 0) return;
    const leaf = 0x5aa33a;
    const cy = top + 9;
    if (stage === 0) g.rect(-1, cy, 2, 2).fill(0x3a2a18);
    if (stage >= 1) g.rect(-0.5, cy - 3, 1, 4).fill(leaf).rect(-3, cy - 3, 2, 1).fill(leaf).rect(1, cy - 4, 2, 1).fill(leaf);
    if (stage >= 2) g.rect(-4, cy - 6, 3, 2).fill(0x6ac04a).rect(1, cy - 7, 3, 2).fill(0x6ac04a).rect(-0.5, cy - 8, 1, 4).fill(leaf);
    if (stage >= 3) g.circle(-2, cy - 8, 1.2).fill(c.color).circle(2, cy - 9, 1.2).fill(c.color);
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
