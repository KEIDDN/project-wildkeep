import { Graphics, Sprite, Texture } from "pixi.js";
import type { Game } from "../../Game";
import type { Area } from "../Area";
import { Outdoor } from "./outdoor";
import { TILE } from "../../../game/core/constants";
import { InteractSpot, npc } from "../../entities/Props";
import { Entity } from "../../entities/Entity";
import { Fireflies } from "../../fx/Fireflies";
import { useWorldStore } from "../../../store/worldStore";
import { useTimeStore } from "../../../store/timeStore";
import { getNpc } from "../../../data/npcs";
import { dialogueFor } from "../../../game/npcs";
import { questMarker } from "../../../game/quests";
import { isNight } from "../../../game/time/clock";
import { audio } from "../../../game/audio/AudioManager";
import { t, tl } from "../../../i18n";

/** Set when the star-lock turns (quest "star_lock"). */
export const TOWER_FLAG = "tower_open";

/**
 * The Crooked Tower on the western hill: somebody lives there, and they
 * don't want visitors. Until the star-lock turns it's a place of clues —
 * a riddle on a stone, a grumpy sign, lights in the windows at night, a
 * voice behind the door. Afterwards Ysolde opens up, and so does magic.
 *
 *   [Crooked Tower]
 *      \\ path
 *        \\______ road down to Wildkeep (east) →
 */
const COLS = 48;
const ROWS = 40;
const TOWER = { x: 16 * TILE, y: 14 * TILE }; // base centre

export function buildTowerHill(game: Game): Area {
  const o = new Outdoor(game, "tower_hill", COLS, ROWS, "tower-hill");
  const area = o.area;
  const ter = o.terrain;
  const R = o.rng;
  const open = !!useWorldStore.getState().progress.flags[TOWER_FLAG];

  // ---- paths --------------------------------------------------------------
  ter.path([[COLS - 1, 22], [34, 22], [34, 17], [16, 17]], 2, "dirt");
  ter.blob(16, 16, 4, 2, "dirt", R);
  ter.rect(15, 14, 3, 4, "cobble"); // flagstones up to the steps

  // ---- the tower ------------------------------------------------------------------
  area.add(new CrookedTower(TOWER.x, TOWER.y, area));
  // The plinth is solid; the steps in front of the door are where you stand.
  area.solidRect({ x: TOWER.x - 50, y: TOWER.y - 16, w: 100, h: 13 });
  o.reserve(11, 0, 11, 15);
  // A clear forecourt, so the tower reads from the road (no tree in front
  // of the door), with flagstones up to the steps.
  o.reserve(10, 14, 13, 6);
  // Braziers with a cold violet flame either side of the approach.
  for (const dx of [-34, 34]) {
    const b = area.prop("d_brazier_stone", TOWER.x + dx, TOWER.y + 14, { collider: { w: 12, h: 6 }, tint: 0xd8d0f0 });
    b.withLight({ radius: 44, color: 0xb890ff, intensity: 0.8, dy: -14, flicker: 0.7, flare: true });
  }
  // Crystals pushing up through the grass, as if the hill leaks magic.
  for (const [dx, dy, id] of [
    [-62, 6, "crystal_a"],
    [66, 2, "crystal_cluster"],
    [-48, 30, "crystal_b"],
    [58, 34, "crystal_c"],
  ] as [number, number, string][])
    area.prop(id, TOWER.x + dx, TOWER.y + dy, { collider: { w: 10, h: 5 } });

  // The door: a voice answers (quests), or it opens.
  const ysolde = getNpc("ysolde");
  area.add(
    new InteractSpot(
      TOWER.x,
      TOWER.y + 2,
      () =>
        open
          ? { verb: t("tower.knock"), target: t("tower.door") }
          : { verb: t("tower.knock"), target: t("tower.lockedDoor") },
      (g) => {
        audio.sfx("door", { pitch: 0.8 });
        // The quest business goes through Ysolde, even through a door.
        if (questMarker("ysolde") || open) {
          g.ui.showDialogue(open ? dialogueFor(ysolde) : { ...dialogueFor(ysolde), speaker: t("tower.voice") });
          return;
        }
        const lines = tl("tower.lockedLines");
        g.ui.showDialogue({ speaker: t("tower.door"), portrait: "key", lines: [lines[Math.floor(Math.random() * lines.length)]] });
      },
      { radius: 16, priority: 0, marker: !open },
    ),
  );
  area.spawns.door = { x: TOWER.x, y: TOWER.y + 14, dir: "up" };
  if (open) {
    const mage = npc("ysolde", TOWER.x + 30, TOWER.y + 12, { facingLeft: true });
    if (mage) area.add(mage);
  }

  // Clues: the riddle stone, the sign, the mushroom ring.
  area.prop("tomb_wood", 22 * TILE, 18 * TILE + 8, { collider: { w: 10, h: 5 } });
  area.add(
    new InteractSpot(22 * TILE, 18 * TILE + 10, () => ({ verb: t("prompt.read"), target: t("tower.sign") }), (g) => g.ui.showDialogue({ speaker: t("tower.sign"), portrait: "journal", lines: tl("tower.signLines") }), {
      radius: 14,
    }),
  );
  area.prop("d_statue_hooded", 10 * TILE, 18 * TILE, { collider: { w: 12, h: 6 } });
  area.add(
    new InteractSpot(10 * TILE, 18 * TILE + 4, () => ({ verb: t("prompt.read"), target: t("tower.tablet") }), (g) => g.ui.showDialogue({ speaker: t("tower.tablet"), portrait: "moonpetal", lines: tl("tower.tabletLines") }), {
      radius: 16,
    }),
  );
  o.reserve(9, 17, 2, 2);
  o.reserve(21, 17, 2, 2);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    area.prop("flower_blue_b", 27 * TILE + Math.cos(a) * 20, 11 * TILE + Math.sin(a) * 12, { flat: true });
  }
  o.node("mushroom", 27, 11);
  o.node("moonpetal", 6, 9);
  o.node("herb", 38, 30);
  o.node("tree", 40, 12);

  // ---- exits ----------------------------------------------------------------
  area.trigger({ rect: { x: COLS * TILE - 8, y: 20 * TILE, w: 8, h: 5 * TILE }, travel: { area: "town", spawn: "west" }, requireDir: "right" });
  area.spawns.east = { x: (COLS - 2) * TILE, y: 22 * TILE + 10, dir: "side" };
  area.spawns.default = area.spawns.east;

  // ---- borders + dressing ------------------------------------------------------
  o.forestWall(0, 0, COLS, 3, ["tree_pine_dark", "tree_pine", "tree_oak_dead"]);
  o.forestWall(0, 3, 2, ROWS - 3, ["tree_pine_dark", "tree_pine"]);
  o.forestWall(0, ROWS - 3, COLS, 3, ["tree_pine", "tree_oak", "tree_pine_dark"]);
  o.forestWall(COLS - 2, 3, 2, 17, ["tree_pine", "tree_oak"]);
  o.forestWall(COLS - 2, 25, 2, ROWS - 25, ["tree_pine", "tree_oak"]);
  for (let i = 0; i < 26; i++) {
    const x = R.int(3, COLS - 4);
    const y = R.int(4, ROWS - 5);
    if (o.freeArea(x - 1, y - 1, 3, 2)) o.tree(R.pick(["tree_pine_dark", "tree_pine", "tree_oak_dead", "tree_small"]), x, y);
  }
  o.scatter({ x: 2, y: 3, w: COLS - 4, h: ROWS - 6 }, 70, ["grass_tuft_a", "grass_tuft_b", "flower_blue", "flower_white", "flower_blue_b"]);
  o.scatter({ x: 2, y: 3, w: COLS - 4, h: ROWS - 6 }, 10, ["bush_olive", "rock_grey_medium", "fern"], true);
  area.add(new Fireflies(area, 22));
  area.ambient = 0.9;
  return o.finish({ trees: ["tree_pine_dark", "tree_pine", "tree_oak_dead", "tree_pine"] });
}

/**
 * The tower itself, painted in code (the art packs have no tower). Read
 * from the ground up: a stone plinth with steps and crystals set in it, a
 * straight lower drum, a carved band, then the upper drum that leans (the
 * "crooked" part, on purpose), a balcony, and a tall bent witch-hat roof
 * with a crescent finial. Lit windows, runes that drift round the upper
 * floors and motes off the roof tip say someone is home, and busy.
 */
class CrookedTower extends Entity {
  private glow = new Graphics();
  private magic = new Graphics();
  private t = 0;
  private flicker = 0;
  constructor(x: number, y: number, area: Area) {
    super(x, y);
    const { texture } = bakeTower();
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    this.view.addChild(sprite, this.magic);
    this.sortBias = 4;
    // Lit windows draw over the darkness (the emissive layer).
    this.glow.position.set(x, y);
    area.glow.addChild(this.glow);
  }

  update(dt: number, game: Game) {
    this.t += dt;
    const night = isNight(useTimeStore.getState().minute) || game.area.ambient < 0.5;
    // Runes circling the upper floors: in front of the tower on the near
    // side of the orbit, hidden behind it on the far side.
    const m = this.magic.clear();
    const { lean } = bakeTower();
    for (let i = 0; i < 5; i++) {
      const a = this.t * 0.6 + (i * Math.PI * 2) / 5;
      if (Math.sin(a) < -0.1) continue;
      const y = -122 - i * 9 + Math.sin(this.t * 1.7 + i) * 2;
      const x = Math.round(Math.cos(a) * 36 + lean(-y));
      const al = (night ? 0.9 : 0.55) * Math.min(1, Math.sin(a) + 0.4);
      const c = i % 2 ? 0xc8a8ff : 0x9ff0e8;
      m.rect(x - 1, Math.round(y), 3, 1).rect(x, Math.round(y) - 1, 1, 3).fill({ color: c, alpha: al });
    }
    if (Math.random() < dt * (night ? 5 : 2)) game.fx.twinkle(this.x + lean(226) + 12 + (Math.random() * 10 - 5), this.y - 222 + Math.random() * 8, night ? 0xe8d8ff : 0xfff8d8);

    this.flicker -= dt;
    if (this.flicker > 0) return;
    this.flicker = 0.12;
    const g = this.glow.clear();
    // The star lock and the crystals always glow a little; windows burn at night.
    const pulse = 0.5 + Math.sin(this.t * 2.2) * 0.25;
    for (const [cx, cy] of TOWER_CRYSTALS) g.rect(cx - 1, cy - 4, 3, 5).fill({ color: 0x9ff0e8, alpha: (night ? 0.8 : 0.35) * pulse });
    // The star on the door.
    g.rect(-1, -30, 3, 1).rect(0, -31, 1, 3).fill({ color: 0xffe08a, alpha: 0.35 + pulse * 0.4 });
    if (!night) return;
    const a = 0.6 + Math.sin(this.t * 3) * 0.12 + Math.random() * 0.1;
    const violet = Math.sin(this.t * 0.7) > 0.55;
    for (const w of TOWER_WINDOWS) {
      const col = w.rose ? 0xd8a8ff : violet ? 0xc890ff : 0xffc870;
      if (w.rose) g.circle(w.x + w.w / 2, w.y + w.h / 2, w.w / 2).fill({ color: col, alpha: a });
      else {
        // Arched: square body, rounded head.
        const r = w.w / 2;
        g.rect(w.x, w.y + r, w.w, w.h - r).fill({ color: col, alpha: a }).circle(w.x + r, w.y + r, r).fill({ color: col, alpha: a });
      }
      // A warmer core, so it reads as light rather than paint.
      g.rect(w.x + Math.floor(w.w / 2) - 1, w.y + w.h / 2, 2, w.h / 2 - 1).fill({ color: 0xfff0c8, alpha: a * 0.6 });
    }
  }

  light() {
    const night = isNight(useTimeStore.getState().minute);
    // A soft violet spill round the foot of the tower (strong light on the
    // grass read as a green spotlight).
    return night ? { x: this.x, y: this.y - 20, radius: 70, color: 0x9a80e0, intensity: 0.4, flicker: 0.4 } : null;
  }
}

/** Glowing bits, relative to the tower's base centre (filled by bakeTower). */
const TOWER_WINDOWS: { x: number; y: number; w: number; h: number; rose?: boolean }[] = [];
const TOWER_CRYSTALS: [number, number][] = [];

let towerBake: { texture: Texture; lean: (heightAboveBase: number) => number } | null = null;

function bakeTower(): { texture: Texture; lean: (h: number) => number } {
  if (towerBake) return towerBake;
  const W = 132;
  const H = 238;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const hex = (h: number): [number, number, number] => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const px = (x: number, y: number, col: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const [r, g, b] = hex(col);
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  };
  const CX = W / 2;
  const BASE = H - 1;
  // Height above the base line → horizontal lean (only the upper drum leans).
  const PLINTH = 16;
  const LOWER = 74;
  const UPPER = 58;
  const upperStart = PLINTH + LOWER + 5;
  const lean = (h: number) => (h <= upperStart ? 0 : Math.round(((h - upperStart) / UPPER) ** 1.3 * 7));
  const ROW = (h: number) => BASE - h;

  // Cylinder shading: light from the upper left.
  const STONE = [0xa49cb4, 0x8a829c, 0x726a86, 0x5a5270, 0x453e5a];
  const shade = (u: number) => STONE[u < -0.62 ? 0 : u < -0.1 ? 1 : u < 0.35 ? 2 : u < 0.72 ? 3 : 4];

  const drum = (h0: number, h1: number, r0: number, r1: number, brickH: number) => {
    for (let h = h0; h <= h1; h++) {
      const k = (h - h0) / Math.max(1, h1 - h0);
      const r = Math.round(r0 + (r1 - r0) * k);
      const off = lean(h);
      const row = Math.floor((h - h0) / brickH);
      for (let x = -r; x <= r; x++) {
        const u = x / r;
        const ang = Math.asin(Math.max(-1, Math.min(1, u)));
        // Brick joints: every course, and staggered verticals that curve with the wall.
        const joint = (h - h0) % brickH === 0 || Math.abs(((ang + (row % 2) * 0.22 + 4) % 0.44) - 0.22) < 0.035 / Math.max(0.35, Math.cos(ang));
        let col = shade(u);
        if (joint) col = u < -0.4 ? 0x6a6282 : 0x3a3450;
        px(CX + x + off, ROW(h), col);
      }
      px(CX - r - 1 + off, ROW(h), 0x241e34);
      px(CX + r + 1 + off, ROW(h), 0x241e34);
    }
  };
  const band = (h: number, r: number, thick: number) => {
    for (let dh = 0; dh < thick; dh++) {
      const off = lean(h + dh);
      for (let x = -r; x <= r; x++) {
        const u = x / r;
        px(CX + x + off, ROW(h + dh), dh === thick - 1 ? (u < 0 ? 0xc8c0d8 : 0x9a92b0) : dh === 0 ? 0x2a2438 : shade(u));
      }
    }
  };

  // ---- plinth: a squat octagon of big blocks, top face lit, front face shaded
  const PW = 50;
  for (let h = 0; h < PLINTH; h++) {
    const top = h >= PLINTH - 5;
    const w = top ? PW - (h - (PLINTH - 5)) * 2 : PW;
    for (let x = -w; x <= w; x++) {
      const edge = Math.abs(x) > w - 2;
      const block = !top && ((h % 6 === 0) || (x + 60 + (Math.floor(h / 6) % 2) * 7) % 14 === 0);
      const col = top ? (h === PLINTH - 1 ? 0x2a2438 : x < 0 ? 0x9a92aa : 0x8a829a) : edge ? 0x3a3448 : block ? 0x3e3850 : x < -20 ? 0x6e6680 : x > 20 ? 0x544c66 : 0x62597a;
      px(CX + x, ROW(h), col);
    }
  }
  // Steps up to the door.
  for (let s = 0; s < 3; s++)
    for (let h = 0; h < 4; h++)
      for (let x = -13 + s * 2; x <= 13 - s * 2; x++) px(CX + x, ROW(s * 4 + h), h === 3 ? 0xb0a8c0 : h === 0 ? 0x2a2438 : 0x7a7290);
  // Crystals set into the plinth corners.
  for (const [cx, big] of [
    [-40, true],
    [38, false],
    [-24, false],
    [26, true],
  ] as [number, boolean][]) {
    const hh = big ? 9 : 6;
    for (let h = 0; h < hh; h++) {
      const w = Math.max(0, Math.round((1 - h / hh) * (big ? 3 : 2)));
      for (let x = -w; x <= w; x++) px(CX + cx + x, ROW(PLINTH - 3 + h), x < 0 ? 0xc8fff8 : x === 0 ? 0x7fe0d8 : 0x3fa0a8);
    }
    TOWER_CRYSTALS.push([cx, -(PLINTH - 3 + hh / 2)]);
  }

  // ---- lower drum
  drum(PLINTH, PLINTH + LOWER, 31, 28, 7);
  // Ivy creeping up the lit side.
  for (let i = 0; i < 90; i++) {
    const h = PLINTH + Math.floor(Math.abs(Math.sin(i * 12.9898) * 43758.5) % 52);
    const x = -29 + Math.floor(Math.abs(Math.sin(i * 78.233) * 12345.6) % 14) - Math.floor((h - PLINTH) / 12);
    if (x < -30) continue;
    px(CX + x, ROW(h), i % 3 ? 0x4a7a3a : 0x6a9a4a);
  }
  // The door: deep arch, stone voussoirs, planks, the star lock.
  const doorH = 26;
  for (let h = PLINTH - 12; h <= PLINTH + doorH; h++)
    for (let x = -11; x <= 11; x++) {
      const dh = h - (PLINTH + doorH - 10);
      const arch = dh > 0 ? x * x + dh * dh * 1.2 : 0;
      if (arch > 121) continue;
      const frame = arch > 64 || Math.abs(x) > 8;
      const col = frame ? ((x + h) % 5 === 0 ? 0x3a3448 : 0x8a82a0) : x % 4 === 0 ? 0x3a2216 : Math.abs(x) < 1 ? 0x4a2a1a : 0x6e4428;
      if (h < PLINTH) {
        if (Math.abs(x) <= 8) px(CX + x, ROW(h), 0x2a1a14);
      } else px(CX + x, ROW(h), col);
    }
  for (const [dx, dy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [1, 1]]) px(CX + dx, ROW(PLINTH + 12) + dy, 0xffd54f);
  // Two tall arched windows on the lower drum.
  const archWindow = (cx: number, h0: number, w: number, hgt: number) => {
    const off = lean(h0);
    for (let h = h0 - 1; h <= h0 + hgt + 1; h++)
      for (let x = -w - 1; x <= w + 1; x++) {
        const dh = h - (h0 + hgt - w);
        if (dh > 0 && x * x + dh * dh > (w + 1) * (w + 1)) continue;
        const inside = Math.abs(x) <= w && h >= h0 && !(dh > 0 && x * x + dh * dh > w * w);
        px(CX + cx + x + off, ROW(h), inside ? (x === 0 && w > 2 ? 0x3a2a52 : 0x1c1430) : 0xb8b0c8);
      }
    TOWER_WINDOWS.push({ x: cx - w + off, y: -(h0 + hgt), w: w * 2 + 1, h: hgt });
  };
  archWindow(-14, PLINTH + 40, 3, 14);
  archWindow(12, PLINTH + 50, 3, 14);

  // ---- carved band, then the leaning upper drum
  band(PLINTH + LOWER + 1, 33, 4);
  drum(upperStart, upperStart + UPPER, 27, 24, 6);
  // Rose window: a round light with a star in it.
  {
    const hc = upperStart + 26;
    const off = lean(hc);
    for (let dy = -7; dy <= 7; dy++)
      for (let dx = -7; dx <= 7; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 7.4) continue;
        const star = Math.abs(dx) + Math.abs(dy) < 3 || (dx === 0 && Math.abs(dy) < 6) || (dy === 0 && Math.abs(dx) < 6);
        px(CX + dx + off, ROW(hc + dy), d > 6 ? 0xc8c0d8 : star ? 0x6a4a9a : 0x1c1430);
      }
    TOWER_WINDOWS.push({ x: off - 5, y: -(hc + 5), w: 11, h: 11, rose: true });
  }
  archWindow(-13, upperStart + 8, 2, 8);

  // ---- balcony: a ledge with a railing all the way round
  const balc = upperStart + UPPER + 1;
  band(balc, 32, 3);
  for (let x = -32; x <= 32; x++) {
    const off = lean(balc + 3);
    if (x % 5 === 0 || Math.abs(x) >= 31) for (let h = 0; h < 6; h++) px(CX + x + off, ROW(balc + 3 + h), x < 0 ? 0x5a3a24 : 0x3e2818);
    px(CX + x + off, ROW(balc + 8), x < 0 ? 0x8a5a32 : 0x6a4424);
  }

  // ---- the roof: a tall witch's hat of slate, bent over at the top
  const roofBase = balc + 4;
  const ROOF = H - 1 - roofBase - 12;
  for (let h = 0; h <= ROOF; h++) {
    const k = h / ROOF;
    const half = Math.round(35 * (1 - k) ** 1.15);
    const off = lean(roofBase) + Math.round(k * k * k * 16);
    const course = Math.floor(h / 5);
    for (let x = -half; x <= half; x++) {
      const u = half ? x / half : 0;
      // Scalloped shingle rows, lit from the left, a gold trim at the eaves.
      const scallop = h % 5 === 0 || (h % 5 === 1 && (x + course * 3 + 40) % 6 === 0);
      let col = u < -0.55 ? 0x5a4a9a : u < 0 ? 0x46397e : u < 0.5 ? 0x352a64 : 0x271e4c;
      if (scallop) col = 0x1c1638;
      if (Math.abs(x) === half) col = 0x140f28;
      if (h < 2) col = h === 0 ? 0x8a6a2a : 0xd8a840;
      px(CX + x + off, ROW(roofBase + h), col);
    }
  }
  // A dormer with its own little light, halfway up the roof.
  {
    const hd = roofBase + 18;
    const off = lean(roofBase) + 2;
    for (let h = 0; h < 11; h++)
      for (let x = -6; x <= 6; x++) {
        if (h > 6 && Math.abs(x) > 12 - h) continue;
        const inside = h >= 1 && h <= 5 && Math.abs(x) <= 2;
        px(CX - 10 + x + off, ROW(hd + h), inside ? 0x1c1430 : h > 6 ? 0x46397e : 0x8a829c);
      }
    TOWER_WINDOWS.push({ x: -12 + off, y: -(hd + 5), w: 5, h: 5 });
  }
  // Finial: a rod, a crescent moon and a star at the bent tip.
  const tipX = CX + lean(roofBase) + 16;
  const tipY = ROW(roofBase + ROOF);
  for (let i = 1; i <= 5; i++) px(tipX, tipY - i, 0xb08a3a);
  for (let a = 0; a < 20; a++) {
    const ang = (a / 20) * Math.PI * 1.3 + 0.9;
    px(tipX + Math.round(Math.cos(ang) * 3), tipY - 8 + Math.round(Math.sin(ang) * 3), 0xffd54f);
  }
  for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) px(tipX + 5 + dx, tipY - 12 + dy, 0xfff2a0);

  ctx.putImageData(img, 0, 0);
  const texture = Texture.from(c);
  texture.source.scaleMode = "nearest";
  towerBake = { texture, lean };
  return towerBake;
}
