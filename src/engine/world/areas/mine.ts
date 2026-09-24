import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { t } from "../../../i18n";
import { Area } from "../Area";
import type { Game } from "../../Game";
import { TILE } from "../../../game/core/constants";
import { TILESETS, propPath } from "../../../data/assets";
import { MINE_LIFT_EVERY, mineFloorProfile } from "../../../data/mineFloors";
import { tex, tile } from "../../textures";
import { generateCave, type CaveData } from "../../../game/procgen/caveGenerator";
import { ResourceNode } from "../../entities/ResourceNode";
import { InteractSpot, Prop, npc } from "../../entities/Props";
import { Chest } from "../../entities/Chest";
import { Enemy } from "../../entities/Enemy";
import { SeededRandom } from "../../../game/core/rng";
import { Entity } from "../../entities/Entity";
import { useUiStore } from "../../../store/uiStore";
import { useMineStore } from "../../../store/mineStore";
import { useWorldStore } from "../../../store/worldStore";
import { audio } from "../../../game/audio/AudioManager";

/**
 * The Old Mine, one procedurally generated floor at a time (see
 * game/procgen/caveGenerator + data/mineFloors). This file only turns the
 * generated CaveData into tiles, collision and entities.
 */
const CLIFF = TILESETS.cliffs;
const FLOOR = TILESETS.floors;

/** Chests opened on this expedition (seed:floor:index). */
const openedChests = new Set<string>();

export function buildMine(game: Game): Area {
  const { seed, floor } = useMineStore.getState();
  const profile = mineFloorProfile(floor);
  const cave = generateCave(seed, profile);
  const W = cave.width;
  const H = cave.height;
  const area = new Area("mine", W * TILE, H * TILE);
  area.cull = true;
  area.ambient = profile.ambient;
  area.backdrop = 0x140e0a;

  const isFloor = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && cave.grid[y * W + x] === 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isFloor(x, y)) area.collision.setSolidCell(x, y);

  area.ground.addChild(bakeCave(game, cave, profile.rockBlock, profile.rockTint));

  // ---- resource nodes, treasure, hazards, dressing ---------------------------------------
  for (const n of cave.nodes) {
    area.add(new ResourceNode((n.x + 0.5) * TILE, (n.y + 1) * TILE - 2, n.defId, `mine:${seed}:${floor}:${n.x},${n.y}`, area));
  }
  cave.chests.forEach((c, i) => {
    const id = `${seed}:${floor}:${i}`;
    area.add(
      new Chest((c.x + 0.5) * TILE, (c.y + 1) * TILE - 2, id, c.rare, profile.chestTier, openedChests.has(id), (cid) => openedChests.add(cid), (r) => area.solidRect(r)),
    );
  });
  for (const h of cave.hazards) area.add(new RockfallTrap((h.x + 0.5) * TILE, (h.y + 0.5) * TILE, profile.hazardDamage));
  // Deeper galleries aren't empty. (Never in the entrance chamber.)
  const crng = SeededRandom.fromString(`${seed}:${floor}:creatures`);
  const lairs = cave.chambers.slice(1);
  for (let i = 0; i < profile.creatures.count && lairs.length; i++) {
    const c = lairs[i % lairs.length];
    const x = (c.x + crng.int(1, Math.max(1, c.w - 2)) + 0.5) * TILE;
    const y = (c.y + crng.int(1, Math.max(1, c.h - 2)) + 1) * TILE - 3;
    if (area.collision.blocked({ x: x - 5, y: y - 6, w: 10, h: 6 })) continue;
    area.add(new Enemy(x, y, crng.pick(profile.creatures.kinds), `mine:${i}`, profile.creatures.level, "normal"));
  }
  for (const p of cave.props) {
    const big = ["barrel", "crates", "coal_heap", "empty_crate"].includes(p.kind);
    area.prop(p.kind, (p.x + 0.5) * TILE, (p.y + 1) * TILE - 1, { collider: big ? { w: Math.min(40, tex(propPath(p.kind)).width - 4), h: 7 } : undefined, flat: !big });
  }
  for (const l of cave.lanterns) {
    const lamp = new Prop((l.x + 0.5) * TILE, l.y * TILE + 2, tex(propPath("lantern")));
    lamp.sortBias = -8;
    area.add(lamp);
    area.light({ x: (l.x + 0.5) * TILE, y: l.y * TILE - 6, radius: 64, color: 0xffb865, intensity: 0.85, flicker: 1 });
  }

  // ---- ways in and out ------------------------------------------------------------------------
  const exitX = (cave.exit.x + 0.5) * TILE;
  area.spawns.default = { x: (cave.spawn.x + 0.5) * TILE, y: (cave.spawn.y + 1) * TILE - 2, dir: "up" };
  area.spawns.entrance = area.spawns.default;
  area.light({ x: exitX, y: (H - 1) * TILE, radius: 70, color: 0xdfe8ff, intensity: 0.9 });
  area.trigger({ rect: { x: exitX - 24, y: (H - 1) * TILE + 6, w: 48, h: 10 }, travel: { area: "town", spawn: "mine" }, requireDir: "down" });
  area.add(
    new InteractSpot(exitX, (H - 2) * TILE + 8, () => ({ verb: t("prompt.climbTo"), target: t("prompt.target.surface") }), (g) => g.requestTravel("town", "mine"), {
      radius: 18,
      marker: true,
    }),
  );

  const lx = (cave.ladder.x + 0.5) * TILE;
  const ly = (cave.ladder.y + 1) * TILE - 4;
  area.add(new Ladder(lx, ly));
  area.light({ x: lx, y: ly - 6, radius: 40, color: 0xffd08a, intensity: 0.7 });
  area.add(
    new InteractSpot(
      lx,
      ly + 4,
      () => ({ verb: t("prompt.climbDownTo"), target: t("prompt.target.floor", { n: floor + 1 }) }),
      (g) => {
        useMineStore.getState().descend();
        g.requestTravel("mine", "entrance");
      },
      { radius: 18, priority: 0 },
    ),
  );

  // Lift stops: the entrance and every 5th floor.
  if (floor === 1 || floor % MINE_LIFT_EVERY === 0) {
    const liftX = area.spawns.default.x + 34;
    const liftY = area.spawns.default.y;
    area.prop("lever", liftX, liftY, { collider: { w: 12, h: 5 } });
    area.add(
      new InteractSpot(liftX, liftY + 4, () => ({ verb: t("prompt.use"), target: t("prompt.target.lift") }), () => useUiStore.getState().openPanel("mineLift"), { radius: 18, priority: 1 }),
    );
  }
  useWorldStore.getState().recordMineFloor(floor);

  if (floor === 1) {
    const dorrin = npc("dorrin", area.spawns.default.x - 40, area.spawns.default.y - 6);
    if (dorrin) area.add(dorrin);
  }
  return area;
}

/** Floor tiles, rock faces and rails baked into one texture. */
function bakeCave(game: Game, cave: CaveData, rockBlock: number, rockTint: number): Sprite {
  const W = cave.width;
  const H = cave.height;
  const isFloor = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && cave.grid[y * W + x] === 1;
  const layer = new Container();
  const put = (t: Texture, x: number, y: number, tint?: number) => {
    const s = new Sprite(t);
    s.position.set(x * TILE, y * TILE);
    if (tint !== undefined) s.tint = tint;
    layer.addChild(s);
  };
  const faceCells = new Set<number>();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const floorTile = tile(FLOOR, 11 + ((x * 7 + y * 13) % 3), 10);
      if (isFloor(x, y)) {
        put(floorTile, x, y);
        continue;
      }
      const col = rockBlock + 1 + ((x * 5 + y * 3) % 4);
      if (isFloor(x, y + 1)) {
        // Bottom of the rock face: ragged edge over the dirt floor.
        put(floorTile, x, y);
        put(tile(CLIFF, col, 12), x, y);
        faceCells.add(y * W + x);
      } else if (isFloor(x, y + 2)) {
        put(tile(CLIFF, col, 7), x, y);
        faceCells.add(y * W + x);
      } else put(tile(CLIFF, rockBlock + 2 + ((x + y) % 2), 2 + ((x * 3 + y) % 2)), x, y, rockTint);
    }

  // Rim lines where rock meets floor on the sides / south so every edge reads.
  const rim = new Graphics();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isFloor(x, y) || faceCells.has(y * W + x)) continue;
      const px = x * TILE;
      const py = y * TILE;
      if (isFloor(x, y - 1)) rim.rect(px, py, TILE, 2).fill(0x1e120a).rect(px, py + 2, TILE, 1).fill(0x7a5030);
      if (isFloor(x - 1, y)) rim.rect(px, py, 2, TILE).fill(0x1e120a).rect(px + 2, py, 1, TILE).fill(0x7a5030);
      if (isFloor(x + 1, y)) rim.rect(px + TILE - 2, py, 2, TILE).fill(0x1e120a).rect(px + TILE - 3, py, 1, TILE).fill(0x7a5030);
    }
  layer.addChild(rim);

  // Mine-cart rails along the long tunnels.
  const rails = new Graphics();
  for (const t of cave.tunnels) {
    if (Math.max(t.w, t.h) < 8) continue;
    if (t.w > t.h) {
      const py = (t.y + 1) * TILE;
      for (let x = (t.x + 1) * TILE; x < (t.x + t.w - 1) * TILE; x += 6) rails.rect(x, py + 2, 2, 12).fill(0x5a3a22);
      rails.rect((t.x + 1) * TILE, py + 3, (t.w - 2) * TILE, 1).fill(0x9a9aa4).rect((t.x + 1) * TILE, py + 12, (t.w - 2) * TILE, 1).fill(0x9a9aa4);
    } else {
      const px = (t.x + 1) * TILE;
      for (let y = (t.y + 1) * TILE; y < (t.y + t.h - 1) * TILE; y += 6) rails.rect(px + 2, y, 12, 2).fill(0x5a3a22);
      rails.rect(px + 3, (t.y + 1) * TILE, 1, (t.h - 2) * TILE).fill(0x9a9aa4).rect(px + 12, (t.y + 1) * TILE, 1, (t.h - 2) * TILE).fill(0x9a9aa4);
    }
  }
  layer.addChild(rails);

  const baked = game.app.renderer.generateTexture({ target: layer, resolution: 1, antialias: false });
  baked.source.scaleMode = "nearest";
  layer.destroy({ children: true });
  return new Sprite(baked);
}

/** A hole in the floor with a ladder poking out: the way down. */
class Ladder extends Entity {
  constructor(x: number, y: number) {
    super(x, y);
    this.sortBias = -9000;
    const g = new Graphics();
    g.ellipse(0, -6, 11, 7).fill(0x0a0604).ellipse(0, -6, 11, 7).stroke({ width: 1, color: 0x3a2414 });
    g.rect(-6, -20, 2, 16).fill(0x8a5a32).rect(4, -20, 2, 16).fill(0x8a5a32);
    for (let yy = -18; yy < -4; yy += 4) g.rect(-5, yy, 10, 1).fill(0xb07a44);
    this.view.addChild(g);
  }

  get isStatic(): boolean {
    return true;
  }
}

/**
 * Cracked ceiling: step under it and dust starts to fall — you have a moment
 * to move before the rocks come down. Rearms after a while.
 */
class RockfallTrap extends Entity {
  private state: "armed" | "warning" | "cooldown" = "armed";
  private timer = 0;
  private cracks = new Graphics();
  private shadow = new Graphics();
  private damage: number;

  constructor(x: number, y: number, damage: number) {
    super(x, y);
    this.damage = damage;
    this.sortBias = -9500;
    this.cracks
      .moveTo(-6, -1)
      .lineTo(-1, 1)
      .lineTo(3, -2)
      .lineTo(7, 1)
      .moveTo(-1, 1)
      .lineTo(0, 4)
      .stroke({ width: 1, color: 0x2a1a10, alpha: 0.7 });
    this.view.addChild(this.shadow, this.cracks);
  }

  update(dt: number, game: Game): void {
    const p = game.player;
    const near = Math.hypot(p.x - this.x, p.y - this.y) < 14;
    this.timer -= dt;
    if (this.state === "armed" && near) {
      this.state = "warning";
      this.timer = 0.75;
      audio.sfx("mine", { pitch: 0.6, volume: 0.5 });
    }
    if (this.state === "warning") {
      if (Math.random() < dt * 30) game.fx.burst(this.x + (Math.random() * 12 - 6), this.y - 40, "dust", 1, { speed: 5, up: -30, life: 0.5 });
      const k = 1 - Math.max(0, this.timer) / 0.75;
      this.shadow.clear().ellipse(0, 0, 4 + k * 8, 2 + k * 3).fill({ color: 0, alpha: 0.2 + k * 0.3 });
      if (this.timer <= 0) {
        this.state = "cooldown";
        this.timer = 8;
        this.shadow.clear();
        game.fx.burst(this.x, this.y - 6, "stone", 16, { speed: 50, up: 40 });
        game.shake(3, 0.25);
        audio.sfx("mine", { pitch: 0.5 });
        if (Math.hypot(p.x - this.x, p.y - this.y) < 15) p.hurt(game, this.damage, this.x, this.y - 10);
      }
    }
    if (this.state === "cooldown" && this.timer <= 0) this.state = "armed";
  }
}
