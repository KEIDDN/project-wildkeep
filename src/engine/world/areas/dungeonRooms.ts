import { Graphics, Sprite } from "pixi.js";
import type { Area } from "../Area";
import type { Game } from "../../Game";
import { Entity, type Hittable } from "../../entities/Entity";
import { InteractSpot, Npc, Prop, npcVisual } from "../../entities/Props";
import { TILE } from "../../../game/core/constants";
import { TILESETS } from "../../../data/assets";
import { animFrames, tile } from "../../textures";
import type { DungeonData, DungeonFeature } from "../../../game/dungeon/types";
import { useDungeonStore } from "../../../store/dungeonStore";
import { usePlayerStore } from "../../../store/playerStore";
import { useUiStore } from "../../../store/uiStore";
import { getNpc } from "../../../data/npcs";
import { dialogueFor } from "../../../game/npcs";
import { playerEffectiveStats } from "../../../game/systems/playerStats";
import { awardSkillXp } from "../../../game/actions";
import { audio } from "../../../game/audio/AudioManager";
import { t, tl } from "../../../i18n";
import type { Stats } from "../../../game/core/types";
import { SeededRandom } from "../../../game/core/rng";

/**
 * The stranger dungeon rooms (see DungeonGenerator): spike halls, cracked
 * walls hiding secret rooms, a campfire to rest at, a goblin peddler, a
 * goblin dice game, quiet libraries with something to read.
 */
export function placeFeatures(area: Area, d: DungeonData): void {
  const seed = `${d.seed}:${d.floor}`;
  for (const f of d.features ?? []) {
    const x = (f.x + 0.5) * TILE;
    const y = (f.y + 1) * TILE - 2;
    switch (f.kind) {
      case "spikes":
        area.add(new SpikeTrap(x, (f.y + 0.5) * TILE, f.n ?? 0, d.floor));
        break;
      case "crack":
        area.add(new CrackedWall(area, f));
        break;
      case "campfire": {
        area.add(new Prop(x, y, animFrames("bonfire"), { fps: 8 }));
        const flame = area.add(new Prop(x, y - 3, animFrames("fire"), { fps: 10 }));
        flame.sortBias = 1;
        flame.withLight({ radius: 90, color: 0xffa040, intensity: 1, dy: -8, flicker: 1 });
        area.solidRect({ x: x - 10, y: y - 8, w: 20, h: 8 });
        break;
      }
      case "bedroll":
        area.add(new RestSpot(x, y, `${seed}:rest:${f.x},${f.y}`));
        break;
      case "merchant": {
        const def = getNpc("grisby");
        area.add(new Npc(x, y, npcVisual(def), def.name, (g) => g.ui.showDialogue(dialogueFor(def)), { def, face: "down" }));
        area.light({ x, y: y - 10, radius: 60, color: 0xffd080, intensity: 0.8, flicker: 0.5 });
        break;
      }
      case "bookcase":
        area.prop("d_bookcase_c", x, y + 2, { collider: { w: 16, h: 6 } });
        break;
      case "statue":
        area.prop(f.n ? "d_statue_hooded" : "d_statue_angel", x, y, { collider: { w: 12, h: 6 } });
        break;
      case "pillar":
        area.prop("d_ruin_pillar", x, y, { collider: { w: 12, h: 6 } });
        break;
      case "skull":
        area.prop("d_skull_big", x, y, { flat: true });
        break;
      case "lore":
        area.add(new LoreNote(x, y, f.n ?? 0));
        break;
      case "dice_table":
        area.add(new DiceGame(x, y, `${seed}:dice:${f.x},${f.y}`));
        break;
      case "goblin_player": {
        const def = getNpc("dice_goblin");
        const n = new Npc(x, y, npcVisual(def), def.name, (g) => g.ui.showDialogue(dialogueFor(def)), { def, facingLeft: f.n === 1 });
        area.add(n);
        break;
      }
    }
  }
}

/** Spike plates: rise and fall on a cycle; standing on raised spikes hurts. */
class SpikeTrap extends Entity {
  private t: number;
  private g = new Graphics();
  private up = false;
  private hitCd = 0;
  private dmg: number;

  constructor(x: number, y: number, phase: number, floor: number) {
    super(x, y);
    this.t = phase * 0.55;
    this.dmg = 3 + Math.round(floor * 0.9);
    this.sortBias = -9000;
    this.view.addChild(this.g);
    this.draw();
  }

  private draw() {
    const g = this.g.clear();
    g.rect(-7, -7, 14, 14).fill({ color: 0x1a1820, alpha: 0.55 }).stroke({ width: 1, color: 0x3a3844 });
    for (const [dx, dy] of [
      [-4, -4],
      [2, -4],
      [-4, 2],
      [2, 2],
    ]) {
      if (this.up) g.poly([dx, dy + 3, dx + 1.5, dy - 3, dx + 3, dy + 3]).fill(0xc8ccd8).stroke({ width: 0.5, color: 0x2a2830 });
      else g.rect(dx + 0.5, dy + 1, 2, 2).fill(0x5a5864);
    }
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.hitCd -= dt;
    const cycle = this.t % 2.2;
    const up = cycle > 1.4;
    if (up !== this.up) {
      this.up = up;
      this.draw();
      const near = Math.hypot(game.player.x - this.x, game.player.y - this.y) < 100;
      if (up && near) audio.sfx("swing", { pitch: 1.8, volume: 0.25 });
    }
    const p = game.player;
    if (this.up && this.hitCd <= 0 && Math.abs(p.x - this.x) < 8 && Math.abs(p.y - 2 - this.y) < 8 && !p.isInvulnerable) {
      this.hitCd = 0.8;
      p.hurt(game, this.dmg, this.x, this.y);
    }
  }
}

/** A cracked section of wall. A few good whacks and it gives way. */
class CrackedWall extends Entity implements Hittable {
  readonly hitRadius = 9;
  readonly stats: Stats = { maxHp: 1, attack: 0, defense: 0, crit: 0, luck: 0 };
  private hp = 3;
  private area: Area;
  private cx: number;
  private cy: number;
  private cracks = new Graphics();
  readonly roomId: number;

  constructor(area: Area, f: DungeonFeature) {
    super((f.x + 0.5) * TILE, (f.y + 1) * TILE);
    this.area = area;
    this.roomId = f.roomId;
    this.cx = f.x;
    this.cy = f.y;
    area.collision.setSolidCell(f.x, f.y, true);
    const s = new Sprite(tile(TILESETS.dungeon, 1, 1));
    s.anchor.set(0.5, 1);
    const top = new Sprite(tile(TILESETS.dungeon, 1, 0));
    top.anchor.set(0.5, 1);
    top.y = -TILE;
    this.view.addChild(top, s, this.cracks);
    this.drawCracks();
  }

  get dead(): boolean {
    return this.hp <= 0;
  }

  get centerY(): number {
    return this.y - 8;
  }

  private drawCracks() {
    const g = this.cracks.clear();
    const k = 3 - this.hp;
    g.moveTo(-5, -14).lineTo(-1, -9).lineTo(-3, -4).moveTo(-1, -9).lineTo(4, -7);
    if (k >= 1) g.moveTo(4, -7).lineTo(6, -2).moveTo(-3, -4).lineTo(-6, -1);
    if (k >= 2) g.moveTo(0, -16).lineTo(2, -12).lineTo(-1, -9).moveTo(6, -2).lineTo(3, 0);
    g.stroke({ width: 1, color: 0x0e0c14, alpha: 0.9 });
  }

  takeHit(game: Game): void {
    if (this.hp <= 0) return;
    this.hp--;
    game.fx.burst(this.x, this.y - 8, "stone", 6, { speed: 40, up: 30 });
    game.shake(1.5, 0.1);
    audio.sfx("mine", { pitch: 0.8 });
    if (this.hp > 0) {
      this.drawCracks();
      return;
    }
    // The whole seal comes down together.
    for (const e of [...this.area.entities]) if (e instanceof CrackedWall && e.roomId === this.roomId) e.crumble(game);
    game.ui.pushToast(t("rooms.secretFound"), "levelup", { icon: "key" });
    audio.sfx("rare");
    awardSkillXp("luck", 10);
  }

  private crumble(game: Game) {
    this.hp = 0;
    this.area.collision.setSolidCell(this.cx, this.cy, false);
    game.fx.burst(this.x, this.y - 10, "stone", 14, { speed: 70, up: 40 });
    game.removeEntity(this);
  }
}

/** A bedroll by the campfire: rest once, recover half your health. */
class RestSpot extends InteractSpot {
  constructor(x: number, y: number, key: string) {
    const used = () => useDungeonStore.getState().usedFountains.includes(key);
    super(
      x,
      y + 2,
      () => (used() ? { verb: t("prompt.restAt"), target: t("rooms.bedroll"), blocked: t("rooms.rested") } : { verb: t("prompt.restAt"), target: t("rooms.bedroll") }),
      (g) => {
        if (used()) return;
        useDungeonStore.getState().markFountainUsed(key);
        const p = usePlayerStore.getState();
        p.heal(Math.round(playerEffectiveStats(p).maxHp * 0.5));
        audio.sfx("potion");
        g.fx.burst(g.player.x, g.player.y - 12, "heal", 14, { speed: 20, up: 50 });
        g.ui.pushToast(t("rooms.restToast"), "info", { icon: "sleep" });
      },
      { radius: 18, priority: 0 },
    );
    const g = new Graphics();
    g.roundRect(-10, -5, 20, 9, 3).fill(0x6a3a2a).stroke({ width: 1, color: 0x2a1a14 });
    g.roundRect(-10, -5, 7, 9, 3).fill(0xd8c8a8);
    this.view.addChild(g);
    this.sortBias = -8000;
  }
}

/** A scrap of parchment with something odd written on it. */
class LoreNote extends InteractSpot {
  constructor(x: number, y: number, n: number) {
    super(
      x,
      y,
      () => ({ verb: t("prompt.read"), target: t("rooms.note") }),
      () => {
        const lines = tl("rooms.lore");
        useUiStore.getState().pushToast(lines[n % lines.length], "info", { icon: "scroll_return" });
      },
      { radius: 16 },
    );
    const g = new Graphics();
    g.rect(-5, -4, 10, 7).fill(0xe8dcb8).stroke({ width: 1, color: 0x6a5a3a });
    g.rect(-3, -2, 6, 1).fill(0x8a7a5a).rect(-3, 0, 5, 1).fill(0x8a7a5a);
    this.view.addChild(g);
    this.sortBias = -8000;
  }
}

/**
 * The goblins' dice table. Ten gold a throw: beat the goblins' roll and win
 * twenty-five. They get bored after three games (and a bit suspicious).
 */
class DiceGame extends InteractSpot {
  constructor(x: number, y: number, key: string) {
    let plays = 0;
    super(
      x,
      y + 4,
      () => (plays >= 3 ? { verb: t("rooms.dicePlay"), target: t("rooms.diceTable"), blocked: t("rooms.diceDone") } : { verb: t("rooms.dicePlay"), target: t("rooms.diceTable") }),
      (g) => {
        if (plays >= 3) return;
        const p = usePlayerStore.getState();
        if (!p.spendGold(10)) {
          g.ui.pushToast(t("rooms.diceBroke"), "warning");
          return;
        }
        plays++;
        const rng = SeededRandom.fromString(`${key}:${plays}:${Math.random()}`);
        const mine = rng.int(1, 6) + rng.int(1, 6);
        const theirs = rng.int(1, 6) + rng.int(1, 6);
        audio.sfx("dice");
        if (mine > theirs) {
          p.earnGold(25);
          awardSkillXp("gambling", 8);
          g.ui.pushToast(t("rooms.diceWin", { a: mine, b: theirs }), "gold", { icon: "dice" });
        } else g.ui.pushToast(t(mine === theirs ? "rooms.diceTie" : "rooms.diceLose", { a: mine, b: theirs }), "info", { icon: "dice" });
      },
      { radius: 20, priority: 0 },
    );
    const gfx = new Graphics();
    gfx.roundRect(-12, -8, 24, 12, 2).fill(0x5a3a22).stroke({ width: 1, color: 0x2a1a10 });
    gfx.rect(-4, -5, 3, 3).fill(0xf0ece0).rect(2, -4, 3, 3).fill(0xf0ece0);
    this.view.addChild(gfx);
  }
}
