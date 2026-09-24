import { Graphics } from "pixi.js";
import type { Outdoor } from "./outdoor";
import type { Game } from "../../Game";
import { TILE } from "../../../game/core/constants";
import { InteractSpot, Prop, npc } from "../../entities/Props";
import { tex } from "../../textures";
import { icon16Path } from "../../../data/assets";
import { stealable } from "./interiors";
import { Entity, type Hittable, type HitInfo } from "../../entities/Entity";
import { Animal } from "../../entities/Animal";
import { useSocialStore } from "../../../store/socialStore";
import { usePlayerStore } from "../../../store/playerStore";
import { useTimeStore } from "../../../store/timeStore";
import { adjustHonor } from "../../../game/social/honor";
import { adjustRep } from "../../../game/social/reputation";
import { restoreEnergy } from "../../../game/systems/vitals";
import { showTutorial } from "../../../game/tutorial";
import { audio } from "../../../game/audio/AudioManager";
import { t, tl } from "../../../i18n";

/**
 * Lower Wildkeep: the part of the village south of the old barrow lane.
 *
 *   ── south lane ─────────────╫──────────────────────────────
 *   [Weaver house] [Pell house] ║  [Hunter's Lodge]  training yard
 *   ══════════ Chapel Lane ═════╬═══════════════════════════════
 *   wayside shrine + alms box   ║  pig pen       [Baker's house]
 *                               ║ (road to Mirror Lake)
 */
export const LANE_Y = 51;

export function buildSouthDistrict(o: Outdoor): void {
  const area = o.area;
  const ter = o.terrain;

  ter.path([[6, LANE_Y], [58, LANE_Y]], 3, "dirt");
  ter.rect(6, 53, 14, 7, "cobble"); // shrine court
  ter.rect(46, 40, 13, 8, "dirt"); // training yard

  // ---- houses north of the lane ------------------------------------------------
  const houses: [string, number, string][] = [
    ["house_2", 6, "weaver"],
    ["house_3", 17, "pell"],
  ];
  for (const [sprite, tx, who] of houses) {
    const h = area.building(sprite, tx * TILE, (LANE_Y - 2) * TILE);
    o.reserve(tx, LANE_Y - 13, 8, 12);
    const dx = h.door!.x + h.door!.w / 2;
    const dy = h.door!.y + h.door!.h;
    area.add(new InteractSpot(dx, dy + 2, () => ({ verb: t("prompt.knock"), target: t(`south.door.${who}` as "south.door.weaver") }), (g) => knock(g, who), { radius: 14, priority: 0 }));
    area.prop("d_flower_box", h.left + 30, (LANE_Y - 2) * TILE + 3, { collider: { w: 16, h: 5 } });
  }
  // A pie cooling on the Pells' sill. Tempting.
  stealable(area, 21 * TILE, (LANE_Y - 2) * TILE + 6, "apple_pie", { key: "steal:pell_pie", target: "prompt.target.applePie", loot: { itemId: "apple_pie", quantity: 1 }, honor: 4 });

  // ---- Hunter's Lodge -------------------------------------------------------------
  const lodge = area.building("house_4", 33 * TILE, (LANE_Y - 2) * TILE);
  o.reserve(33, LANE_Y - 14, 8, 13);
  area.add(new InteractSpot(lodge.door!.x + lodge.door!.w / 2, lodge.door!.y + lodge.door!.h + 2, () => ({ verb: t("prompt.knock"), target: t("south.door.lodge") }), (g) => knock(g, "lodge"), { radius: 14, priority: 1 }));
  area.prop("log_pile", 42 * TILE, (LANE_Y - 3) * TILE, { collider: { w: 34, h: 8 } });
  area.prop("d_table_low", 31 * TILE + 4, (LANE_Y - 2) * TILE + 4, { collider: { w: 28, h: 8 } });
  area.prop("banner_green", 34 * TILE, (LANE_Y - 9) * TILE);
  // A drying rack of hides and antlers: this is where the hunter lives.
  area.prop("fence_rail", 44 * TILE + 8, (LANE_Y - 5) * TILE + 6, { collider: { w: 50, h: 6 } });
  for (const [dx, icon] of [[-16, "hide"], [0, "antler"], [16, "hide"]] as const) {
    const trophy = new Prop(44 * TILE + 8 + dx, (LANE_Y - 5) * TILE - 4, tex(icon16Path(icon)));
    trophy.sortBias = 3;
    area.add(trophy);
  }
  o.reserve(42, LANE_Y - 6, 5, 2);
  o.reserve(30, LANE_Y - 4, 3, 3);
  o.reserve(41, LANE_Y - 4, 3, 2);
  area.spawns.spot_lodge = { x: 31 * TILE + 4, y: (LANE_Y - 1) * TILE + 2 };

  // ---- training yard: straw dummies that swing back ----------------------------------
  for (let x = 46; x <= 58; x += 2) {
    o.prop("fence_post", x, 39, { w: 6, h: 4 });
  }
  for (let y = 40; y <= 46; y += 2) o.prop("fence_post", 59, y, { w: 6, h: 4 });
  for (const [x, y] of [
    [49, 43],
    [53, 43],
    [57, 44],
  ])
    area.add(new TrainingDummy(x * TILE, y * TILE));
  o.reserve(46, 39, 14, 9);
  area.spawns.spot_yard = { x: 51 * TILE, y: 46 * TILE };

  // ---- wayside shrine -----------------------------------------------------------------
  const sx = 13 * TILE;
  const sy = 56 * TILE;
  area.prop("d_statue_angel", sx, sy, { collider: { w: 16, h: 8 } });
  area.prop("d_plant_pot", sx - 36, sy + 2, { collider: { w: 10, h: 5 } });
  area.prop("d_plant_pot", sx + 36, sy + 2, { collider: { w: 10, h: 5 } });
  area.prop("d_bench_long", sx - 40, sy + 42, { collider: { w: 34, h: 7 } });
  area.prop("d_bench_long", sx + 40, sy + 42, { collider: { w: 34, h: 7 } });
  o.prop("lamp_post", 7, 53, { w: 6, h: 4 });
  o.prop("lamp_post", 19, 53, { w: 6, h: 4 });
  area.light({ x: sx, y: sy - 20, radius: 50, color: 0xfff0c0, intensity: 0.6, flicker: 0.3 });
  area.add(new InteractSpot(sx, sy + 6, () => ({ verb: t("south.pray"), target: t("south.shrine") }), (g) => pray(g), { radius: 18, priority: 0 }));
  area.prop("empty_crate", sx + 22, sy + 16, { collider: { w: 12, h: 6 } });
  area.add(new InteractSpot(sx + 22, sy + 20, () => ({ verb: t("south.donate"), target: t("south.almsBox") }), (g) => donate(g), { radius: 12, priority: 1 }));
  o.reserve(5, 52, 16, 9);
  area.spawns.spot_shrine = { x: sx - 20, y: sy + 26 };
  area.spawns.spot_lane = { x: 24 * TILE, y: (LANE_Y + 1) * TILE };

  // ---- pig pen ---------------------------------------------------------------------
  for (let x = 33; x <= 46; x += 2) {
    o.prop("fence_post", x, 53, { w: 6, h: 4 });
    o.prop("fence_post", x, 59, { w: 6, h: 4 });
  }
  for (let y = 54; y <= 58; y += 2) {
    o.prop("fence_post", 33, y, { w: 6, h: 4 });
    o.prop("fence_post", 47, y, { w: 6, h: 4 });
  }
  area.prop("d_hay_a", 36 * TILE, 56 * TILE, { collider: { w: 12, h: 5 } });
  area.prop("d_hay_b", 44 * TILE, 58 * TILE, { collider: { w: 12, h: 5 } });
  area.prop("barrel_water", 40 * TILE, 55 * TILE, { collider: { w: 12, h: 6 } });
  for (const [x, y] of [
    [38, 57],
    [42, 56],
  ]) {
    const pig = new Animal(x * TILE, y * TILE, "pig");
    pig.penned = { x: 34 * TILE, y: 54 * TILE, w: 12 * TILE, h: 4 * TILE };
    area.add(pig);
  }
  o.reserve(33, 53, 15, 7);
  area.spawns.spot_pen = { x: 40 * TILE, y: 52 * TILE + 8 };

  // ---- the Bakers' house ------------------------------------------------------------------
  const baker = area.building("house", 50 * TILE, 60 * TILE);
  o.reserve(50, 48, 8, 12);
  area.add(new InteractSpot(baker.door!.x + baker.door!.w / 2, baker.door!.y + baker.door!.h + 2, () => ({ verb: t("prompt.knock"), target: t("south.door.baker") }), (g) => knock(g, "baker"), { radius: 14, priority: 0 }));
  area.prop("d_sacks", 49 * TILE, 60 * TILE, { collider: { w: 14, h: 5 } });
  o.prop("lamp_post", 31, LANE_Y - 1, { w: 6, h: 4 });
  o.prop("lamp_post", 27, LANE_Y + 2, { w: 6, h: 4 });

  // ---- the people who live here -------------------------------------------------------------
  for (const [id, x, y] of [["kid_tilly", 23, LANE_Y + 1], ["kid_bo", 25, LANE_Y + 2]] as const) {
    const n = npc(id, x * TILE, y * TILE, { route: [{ x: x * TILE, y: y * TILE }, { x: (x + 6) * TILE, y: (y + 1) * TILE }, { x: (x + 3) * TILE, y: (y - 1) * TILE }] });
    if (n) area.add(n);
  }
}

/** Knocking on doors: somebody's always in, and has opinions. */
function knock(g: Game, who: string) {
  audio.sfx("door", { pitch: 1.2 });
  const lines = tl(`south.knock.${who}` as "south.knock.weaver");
  g.ui.pushToast(lines[Math.floor(Math.random() * lines.length)], "info", { icon: "house" });
}

/** Once a day: a quiet moment at the shrine. */
function pray(g: Game) {
  const social = useSocialStore.getState();
  const day = useTimeStore.getState().day;
  if (social.usedToday("shrine_pray", day)) {
    g.ui.pushToast(t("south.prayedAlready"), "info", { icon: "clover" });
    return;
  }
  social.useToday("shrine_pray", day);
  const e = restoreEnergy(15);
  usePlayerStore.getState().heal(15);
  g.fx.burst(g.player.x, g.player.y - 14, "heal", 14, { speed: 20, up: 40 });
  g.fx.ring(g.player.x, g.player.y - 10, 22, 0xfff0c0, 0.5);
  audio.sfx("levelup", { pitch: 1.3 });
  g.ui.pushToast(t("south.prayed", { n: Math.round(e) }), "levelup", { icon: "clover" });
}

/** Alms: gold for the poor box. Honor for your trouble (a few times a day). */
function donate(g: Game) {
  const p = usePlayerStore.getState();
  const social = useSocialStore.getState();
  const day = useTimeStore.getState().day;
  if (!p.spendGold(10)) {
    g.ui.pushToast(t("south.donateBroke"), "warning", { icon: "gold_coin" });
    return;
  }
  audio.sfx("coin", { pitch: 0.9 });
  // The first three donations a day count for something; after that it's just kind.
  const slot = [1, 2, 3].find((n) => !social.usedToday(`alms_${n}`, day));
  if (slot) {
    social.useToday(`alms_${slot}`, day);
    adjustHonor(1);
    adjustRep("village", 1, true);
    social.addDeed("helped");
    g.ui.pushToast(t("south.donated"), "info", { icon: "gold_coin" });
  } else g.ui.pushToast(t("south.donatedMore"), "info", { icon: "gold_coin" });
}

/**
 * A straw dummy on a post. Takes any beating, shows the numbers, and —
 * if you've been hitting it — swings back now and then with a telegraphed
 * blow you can parry (or dodge). Never actually hurts.
 */
class TrainingDummy extends Entity implements Hittable {
  readonly stats = { maxHp: 999, attack: 0, defense: 0, crit: 0, luck: 0 };
  readonly dead = false;
  private g = new Graphics();
  private tele = new Graphics();
  private wobble = 0;
  private engaged = 0;
  private swingTimer = 2.5;
  private winding = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.view.addChild(this.tele, this.g);
    this.draw(0);
  }

  get centerY() {
    return this.y - 12;
  }

  get hitRadius() {
    return 7;
  }

  takeHit(game: Game, damage: number, crit: boolean, fromX: number, _fromY: number, _knock?: number, info?: HitInfo) {
    this.wobble = (fromX < this.x ? 1 : -1) * (info?.heavy ? 1.6 : 1);
    this.engaged = 6;
    game.fx.text(this.x + (Math.random() * 6 - 3), this.y - 30, crit ? `${damage}!` : `${damage}`, crit ? 0xffd54f : 0xffffff, { size: crit || info?.heavy ? 10 : 8, bold: crit });
    game.fx.burst(this.x, this.y - 14, "leaf", 5, { speed: 30, up: 30 });
    audio.sfx("chop", { pitch: 1.4 });
    if (info?.heavy) game.shake(1.5, 0.1);
  }

  update(dt: number, game: Game) {
    this.wobble *= Math.pow(0.02, dt);
    this.engaged = Math.max(0, this.engaged - dt);
    const p = game.player;
    const near = Math.hypot(p.x - this.x, p.y - this.y) < 34;
    this.tele.clear();
    if (this.winding > 0) {
      this.winding -= dt;
      const k = 1 - this.winding / 0.7;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.tele
        .moveTo(0, 0)
        .lineTo(Math.cos(ang - 0.4) * 30, Math.sin(ang - 0.4) * 21)
        .lineTo(Math.cos(ang + 0.4) * 30, Math.sin(ang + 0.4) * 21)
        .closePath()
        .fill({ color: 0xff3a2a, alpha: 0.12 + k * 0.3 });
      if (this.winding <= 0) this.swing(game);
    } else if (this.engaged > 0 && near) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.swingTimer = 2.2 + Math.random() * 1.5;
        this.winding = 0.7;
        showTutorial("parry");
      }
    }
    this.draw(this.wobble);
  }

  private swing(game: Game) {
    const p = game.player;
    this.wobble = p.x < this.x ? -1.4 : 1.4;
    if (Math.hypot(p.x - this.x, p.y - this.y) > 36) return;
    if (p.tryParry(game, this.x, this.y)) {
      game.fx.text(this.x, this.y - 40, t("south.dummyParried"), 0x9fe8ff, { size: 7, life: 0.9 });
      return;
    }
    if (p.isInvulnerable) return;
    game.fx.text(p.x, p.y - 34, t("south.dummyBonk"), 0xffc080, { size: 8, bold: true, life: 0.8 });
    audio.sfx("hit", { pitch: 0.8 });
    game.shake(1, 0.08);
  }

  private draw(w: number) {
    const g = this.g.clear();
    const lean = Math.sin(w * 2) * 3;
    g.rect(-1, -6, 3, 8).fill(0x6a4a2a); // post
    g.ellipse(0, 1, 6, 2).fill({ color: 0, alpha: 0.25 });
    g.rect(-5 + lean * 0.5, -20, 10, 14).fill(0xd8b868).stroke({ width: 1, color: 0x6a5020 }); // straw body
    g.rect(-5 + lean * 0.5, -15, 10, 2).fill(0x8a3a2a); // belt
    g.rect(-9 + lean * 0.6, -18, 18, 2).fill(0x8a6a3a); // arms
    g.circle(lean, -24, 4).fill(0xe8d8a8).stroke({ width: 1, color: 0x6a5020 }); // sack head
    g.rect(lean - 2, -25, 1, 1).fill(0x2a1a10).rect(lean + 1, -25, 1, 1).fill(0x2a1a10);
  }
}
