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

  // ---- the tower ------------------------------------------------------------------
  area.add(new CrookedTower(TOWER.x, TOWER.y, area));
  area.solidRect({ x: TOWER.x - 26, y: TOWER.y - 14, w: 52, h: 12 });
  o.reserve(12, 3, 9, 12);

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
 * The tower itself, painted in code (the art packs have no tower): a
 * leaning stone cylinder with a patched violet cone roof, a star on the
 * door and windows that burn at night.
 */
class CrookedTower extends Entity {
  private glow = new Graphics();
  private t = 0;
  private flicker = 0;
  constructor(x: number, y: number, area: Area) {
    super(x, y);
    const sprite = new Sprite(bakeTower());
    sprite.anchor.set(0.5, 1);
    this.view.addChild(sprite);
    this.sortBias = 4;
    // Lit windows draw over the darkness (the emissive layer).
    this.glow.position.set(x, y);
    area.glow.addChild(this.glow);
  }

  update(dt: number, game: Game) {
    this.t += dt;
    this.flicker -= dt;
    if (this.flicker > 0) return;
    this.flicker = 0.12;
    const night = isNight(useTimeStore.getState().minute) || game.area.ambient < 0.5;
    const g = this.glow.clear();
    if (!night) return;
    // Windows: warm, with the odd violet pulse (someone's up to something).
    const a = 0.55 + Math.sin(this.t * 3) * 0.15 + Math.random() * 0.1;
    const violet = Math.sin(this.t * 0.7) > 0.6;
    for (const [wx, wy] of [
      [-1, -70],
      [14, -104],
    ])
      g.rect(wx, wy, 5, 8).fill({ color: violet ? 0xc890ff : 0xffd080, alpha: a });
  }

  light() {
    const night = isNight(useTimeStore.getState().minute);
    return night ? { x: this.x, y: this.y - 80, radius: 60, color: 0xb890ff, intensity: 0.6, flicker: 0.5 } : null;
  }
}

let towerTexture: Texture | null = null;

function bakeTower(): Texture {
  if (towerTexture) return towerTexture;
  const W = 84;
  const H = 156;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const px = (x: number, y: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  };
  const baseY = H - 1;
  const bodyH = 96;
  // Lean: each row up shifts right a little.
  const lean = (y: number) => Math.floor(((baseY - y) / bodyH) ** 1.6 * 9);
  // Stone body.
  for (let y = baseY - bodyH; y <= baseY; y++) {
    const off = lean(y);
    const half = 20;
    for (let x = -half; x <= half; x++) {
      const gx = W / 2 + x + off;
      const row = Math.floor((baseY - y) / 6);
      const brick = (x + half + (row % 2) * 5) % 10 === 0 || (baseY - y) % 6 === 0;
      const shade = x < -12 ? "#6a6478" : x > 12 ? "#4a4458" : "#7a748a";
      px(gx, y, brick ? "#3a3448" : shade);
    }
    px(W / 2 - 21 + off, y, "#2a2436");
    px(W / 2 + 21 + off, y, "#2a2436");
  }
  // Moss at the foot.
  for (let x = -20; x <= 20; x++) if ((x * 7) % 5 < 2) px(W / 2 + x, baseY - ((x * 3) % 4 === 0 ? 1 : 0), "#4a6a3a");
  // Door: arched planks with a gold star.
  for (let y = baseY - 18; y <= baseY; y++)
    for (let x = -6; x <= 6; x++) {
      const dy = baseY - 18 - y;
      if (y < baseY - 14 && x * x + dy * dy * 4 > 30) continue;
      px(W / 2 + x + lean(y), y, x % 4 === 0 ? "#4a2a1a" : "#7a4a2a");
    }
  const sx = W / 2 + lean(baseY - 10);
  for (const [dx, dy] of [
    [0, -2],
    [-1, -1],
    [0, -1],
    [1, -1],
    [-2, 0],
    [-1, 0],
    [0, 0],
    [1, 0],
    [2, 0],
    [-1, 1],
    [1, 1],
  ])
    px(sx + dx, baseY - 10 + dy, "#ffd54f");
  // Windows (dark by day; the glow draws over them at night).
  for (const [wx, wy] of [
    [-6, -70],
    [4, -104],
  ]) {
    const y0 = baseY + wy;
    for (let y = y0; y < y0 + 8; y++) for (let x = 0; x < 5; x++) px(W / 2 + wx + x + lean(y), y, "#1a1426");
    for (let x = -1; x < 6; x++) px(W / 2 + wx + x + lean(y0 + 8), y0 + 8, "#9a94aa");
  }
  // Cone roof, patched violet, leaning with the tower.
  const roofBase = baseY - bodyH;
  const roofH = 54;
  for (let y = roofBase; y > roofBase - roofH; y--) {
    const k = (roofBase - y) / roofH;
    const half = Math.round(26 * (1 - k));
    const off = lean(roofBase) + Math.round(k * 5 + k * k * 10);
    for (let x = -half; x <= half; x++) {
      const patch = ((x + 30) >> 3) + ((roofBase - y) >> 4);
      const col = x === -half || x === half ? "#2a1a3a" : patch % 3 === 0 ? "#6a4a9a" : x < 0 ? "#5a3a8a" : "#4a2a72";
      px(W / 2 + x + off, y, col);
    }
  }
  // Eaves and a crooked tip with a tiny star.
  for (let x = -26; x <= 26; x++) px(W / 2 + x + lean(roofBase), roofBase, "#2a1a3a");
  const tipX = W / 2 + lean(roofBase) + 15;
  px(tipX, roofBase - roofH, "#ffd54f");
  px(tipX + 1, roofBase - roofH - 1, "#ffd54f");
  px(tipX - 1, roofBase - roofH - 1, "#ffd54f");
  px(tipX, roofBase - roofH - 2, "#ffd54f");
  towerTexture = Texture.from(c);
  towerTexture.source.scaleMode = "nearest";
  return towerTexture;
}
