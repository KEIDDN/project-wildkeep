import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { t } from "../../../i18n";
import { Area } from "../Area";
import type { Game } from "../../Game";
import { TILE } from "../../../game/core/constants";
import { TILESETS, propPath } from "../../../data/assets";
import { animFrames, tex, tile } from "../../textures";
import { SeededRandom } from "../../../game/core/rng";
import { isFloor, type DungeonData, type TilePoint } from "../../../game/dungeon/types";
import { useDungeonStore } from "../../../store/dungeonStore";
import { Enemy } from "../../entities/Enemy";
import { Chest } from "../../entities/Chest";
import { ResourceNode } from "../../entities/ResourceNode";
import { Entity, type Interactable } from "../../entities/Entity";
import { InteractSpot, Prop } from "../../entities/Props";
import type { LightSource } from "../../fx/Lighting";
import { usePlayerStore } from "../../../store/playerStore";
import { floorProfile } from "../../../data/dungeonFloors";
import { audio } from "../../../game/audio/AudioManager";
import { placeFeatures } from "./dungeonRooms";

const D = TILESETS.dungeon;
const FLOOR_TILES: [number, number][] = [
  [4, 0], [5, 0], [6, 0], [7, 0],
  [4, 1], [5, 1], [6, 1], [7, 1],
  [4, 2], [5, 2], [6, 2], [7, 2],
];
const RIM_DARK = 0x1c2230;

/**
 * Renders a generated DungeonData into an Area: floor tiles, proper 3-tall
 * north wall faces with a lit ledge, rim lines on side/south walls, room
 * dressing, and all the live entities (enemies, chests, ore, doors).
 */
export function buildDungeon(game: Game): Area {
  const ds = useDungeonStore.getState();
  const d = ds.dungeon;
  if (!d) throw new Error("No active dungeon run");
  const area = new Area("dungeon", d.width * TILE, d.height * TILE);
  area.cull = true;
  const profile = floorProfile(d.floor, d.seed);
  const theme = profile.theme;
  const RIM = theme.rim;
  area.ambient = theme.ambient;
  area.backdrop = 0x0c0b12;
  const rng = SeededRandom.fromString(`${d.seed}:render`);

  // ---- collision -----------------------------------------------------------------
  for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) if (!isFloor(d, x, y)) area.collision.setSolidCell(x, y);

  // ---- tiles (baked) -----------------------------------------------------------------
  const layer = new Container();
  const put = (t: Texture, x: number, y: number) => {
    const s = new Sprite(t);
    s.position.set(x * TILE, y * TILE);
    layer.addChild(s);
  };
  const bg = new Graphics().rect(0, 0, d.width * TILE, d.height * TILE).fill(0x0c0b12);
  layer.addChild(bg);

  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      if (!isFloor(d, x, y)) continue;
      const [fx, fy] = rng.bool(0.7) ? FLOOR_TILES[(x * 7 + y * 13) % 4] : rng.pick(FLOOR_TILES);
      put(tile(D, fx, fy), x, y);
    }

  // Rugs + blood decals go on the floor before walls.
  for (const dec of d.decor) {
    if (dec.kind === "rug") {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) if (isFloor(d, dec.x + dx, dec.y + dy)) put(tile(D, dx, 19 + dy), dec.x + dx, dec.y + dy);
    } else if (dec.kind === "blood") {
      put(tile(D, rng.pick([8, 9, 7]), rng.pick([11, 12, 13])), dec.x, dec.y);
    }
  }

  // North wall faces: floor with wall above gets bricks (2 tiles) + ledge.
  const doorCells = new Set<string>();
  const markDoor = (p: TilePoint, w: number) => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < 3; dy++) doorCells.add(`${p.x + dx},${p.y - dy}`);
  };
  markDoor(d.entranceDoor, 2);
  markDoor(d.exitDoor, 2);
  for (const f of d.fountains) doorCells.add(`${f.x},${f.y}`);

  const shade = new Graphics();
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      if (!isFloor(d, x, y) || isFloor(d, x, y - 1)) continue;
      const col = x % 3;
      const variant = (x * 31 + y * 17) % 7 === 0 ? 5 : 1; // occasional alt brick row
      if (!doorCells.has(`${x},${y - 1}`)) put(tile(D, col, variant === 5 ? 6 : 2), x, y - 1);
      if (!isFloor(d, x, y - 2) && !doorCells.has(`${x},${y - 2}`)) put(tile(D, col, variant === 5 ? 5 : 1), x, y - 2);
      if (!isFloor(d, x, y - 3) && !isFloor(d, x, y - 2) && !doorCells.has(`${x},${y - 3}`)) put(tile(D, col, 0), x, y - 3);
      // Soft shadow cast onto the floor by the wall.
      shade.rect(x * TILE, y * TILE, TILE, 5).fill({ color: 0x000000, alpha: 0.28 });
    }
  layer.addChild(shade);

  // Rims on the other wall edges so every wall has a readable outline.
  const rim = new Graphics();
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      if (isFloor(d, x, y)) continue;
      const px = x * TILE;
      const py = y * TILE;
      const faceBelow = isFloor(d, x, y + 1) || isFloor(d, x, y + 2) || isFloor(d, x, y + 3);
      if (isFloor(d, x, y - 1)) rim.rect(px, py, TILE, 2).fill(RIM).rect(px, py + 2, TILE, 1).fill(RIM_DARK);
      if (isFloor(d, x - 1, y) && !faceBelow) rim.rect(px, py, 2, TILE).fill(RIM).rect(px + 2, py, 1, TILE).fill(RIM_DARK);
      if (isFloor(d, x + 1, y) && !faceBelow) rim.rect(px + TILE - 2, py, 2, TILE).fill(RIM).rect(px + TILE - 3, py, 1, TILE).fill(RIM_DARK);
    }
  layer.addChild(rim);

  // Entrance arch (open) and the boss exit (portcullis until the boss dies).
  const arch = (p: TilePoint, tx: number, ty: number) => {
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 3; dy++) put(tile(D, tx + dx, ty + dy), p.x + dx, p.y - 2 + dy);
  };
  arch(d.entranceDoor, 0, 10);
  for (const f of d.fountains) put(tile(D, 4, 18), f.x, f.y);

  const baked = game.app.renderer.generateTexture({ target: layer, resolution: 1, antialias: false });
  baked.source.scaleMode = "nearest";
  layer.destroy({ children: true });
  const ground = new Sprite(baked);
  // Each depth band has its own stone: barrow grey, crypt blue, bone halls
  // bleached, abyss violet.
  ground.tint = theme.tint;
  area.ground.addChild(ground);

  // ---- doors -------------------------------------------------------------------------
  const entrance = { x: (d.entranceDoor.x + 1) * TILE, y: (d.entranceDoor.y + 1) * TILE + 2 };
  area.spawns.default = { x: (d.spawn.x + 0.5) * TILE, y: (d.spawn.y + 1) * TILE - 2, dir: "down" };
  area.light({ x: entrance.x, y: entrance.y - 18, radius: 46, color: 0xbfd8ff, intensity: 0.8 });
  area.add(
    new InteractSpot(entrance.x, entrance.y + 2, () => ({ verb: t("prompt.retreatTo"), target: t("prompt.target.surface") }), (g) => g.exitDungeon("retreated"), {
      radius: 18,
      marker: true,
    }),
  );
  area.add(new ExitGate(d, ds.guardianDefeated));

  for (const f of d.fountains) {
    const key = `${f.x},${f.y}`;
    const fx = (f.x + 0.5) * TILE;
    const fy = (f.y + 1) * TILE + 2;
    area.light({ x: fx, y: fy - 10, radius: 44, color: 0x7fc8ff, intensity: 0.8, flicker: 0.3 });
    area.add(
      new InteractSpot(
        fx,
        fy,
        () => (useDungeonStore.getState().usedFountains.includes(key) ? null : { verb: t("prompt.drinkFrom"), target: t("prompt.target.spring") }),
        (g) => {
          useDungeonStore.getState().markFountainUsed(key);
          usePlayerStore.getState().fullHeal();
          audio.sfx("potion");
          g.fx.burst(g.player.x, g.player.y - 12, "heal", 20, { speed: 25, up: 60 });
          g.ui.pushToast(t("toast.spring"), "info");
        },
        { radius: 18, priority: 0 },
      ),
    );
  }

  // ---- dressing --------------------------------------------------------------------
  for (const dec of d.decor) {
    const x = (dec.x + 0.5) * TILE;
    if (dec.kind === "rug" || dec.kind === "blood") continue;
    if (dec.wall) {
      const y = (dec.y + 1) * TILE - 2;
      const p = area.add(new Prop(x, y, tex(propPath(dec.kind)), { flat: true }));
      if (dec.kind === "lantern") p.withLight({ radius: 58, color: 0xffb35a, intensity: 0.85, dy: -8, flicker: 1 });
      continue;
    }
    const y = (dec.y + 1) * TILE - 2;
    if (dec.kind === "brazier") {
      area.add(new Prop(x, y, animFrames("bonfire"), { fps: 8 }));
      const flame = area.add(new Prop(x, y - 3, animFrames("fire"), { fps: 10 }));
      flame.sortBias = 1;
      flame.withLight({ radius: 84, color: 0xff9a40, intensity: 1, dy: -8, flicker: 1 });
      area.solidRect({ x: x - 10, y: y - 8, w: 20, h: 8 });
      continue;
    }
    const collider = ["crates", "barrel", "coffin", "tomb_arch", "coal_pile"].includes(dec.kind) ? { w: dec.kind === "crates" ? 40 : 12, h: 6 } : undefined;
    area.prop(dec.kind, x, y, { collider, flat: !collider });
  }

  // ---- live entities ---------------------------------------------------------------------
  for (const e of d.enemies) {
    if (ds.defeatedEnemies.includes(e.id)) continue;
    area.add(new Enemy((e.x + 0.5) * TILE, (e.y + 1) * TILE - 3, e.defId, e.id, d.floor, e.rank, !!e.guardian));
  }
  for (const c of d.chests) {
    area.add(
      new Chest(
        (c.x + 0.5) * TILE,
        (c.y + 1) * TILE - 2,
        c.id,
        c.rare,
        profile.chestTier,
        ds.openedChests.includes(c.id),
        (id) => useDungeonStore.getState().markChestOpened(id),
        (r) => area.solidRect(r),
        { bossReward: c.bossReward, floor: d.floor, lootLuck: profile.lootLuck },
      ),
    );
  }
  for (const n of d.nodes) {
    area.add(new ResourceNode((n.x + 0.5) * TILE, (n.y + 1) * TILE - 2, n.defId, `dungeon:${d.seed}:${d.floor}:${n.id}`, area));
  }
  placeFeatures(area, d);
  return area;
}

/** Portcullis over the stairs down in the last room's north wall; lifts when
 * the floor's guardian dies. */
class ExitGate extends Entity implements Interactable {
  interactRadius = 20;
  interactPriority = 0;
  private open: boolean;
  private closedTiles: Sprite[] = [];
  private openTiles: Sprite[] = [];
  private glow = 0;

  constructor(d: DungeonData, open: boolean) {
    super((d.exitDoor.x + 1) * TILE, (d.exitDoor.y + 1) * TILE);
    this.sortBias = -10000;
    this.open = open;
    for (let dx = 0; dx < 2; dx++)
      for (let dy = 0; dy < 3; dy++) {
        const closed = new Sprite(tile(TILESETS.dungeon, 2 + dx, 7 + dy));
        const opened = new Sprite(tile(TILESETS.dungeon, 0 + dx, 10 + dy));
        for (const s of [closed, opened]) {
          s.position.set((dx - 1) * TILE, (dy - 3) * TILE);
          this.view.addChild(s);
        }
        this.closedTiles.push(closed);
        this.openTiles.push(opened);
      }
    this.refresh();
  }

  private refresh() {
    this.closedTiles.forEach((s) => (s.visible = !this.open));
    this.openTiles.forEach((s) => (s.visible = this.open));
  }

  onBossDefeated(game: Game) {
    this.open = true;
    this.refresh();
    game.fx.burst(this.x, this.y - 16, "spark", 30, { speed: 60, up: 60 });
    game.shake(3, 0.4);
    audio.sfx("door");
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y + 4;
  }

  prompt() {
    return this.open
      ? { verb: t("prompt.take"), target: t("prompt.target.stairsDown") }
      : { verb: t("prompt.sealed"), target: t("prompt.target.stairs"), blocked: t("prompt.guardianSeals") };
  }

  interact(game: Game) {
    if (this.open) game.floorCleared();
  }

  update(dt: number) {
    this.glow += dt;
  }

  light(): LightSource | null {
    return this.open
      ? { x: this.x, y: this.y - 18, radius: 60 + Math.sin(this.glow * 3) * 4, color: 0xffe08a, intensity: 1 }
      : { x: this.x, y: this.y - 18, radius: 30, color: 0xff6040, intensity: 0.5 };
  }
}
