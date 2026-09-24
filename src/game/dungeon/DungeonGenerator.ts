import { SeededRandom } from "../core/rng";
import { floorProfile } from "../../data/dungeonFloors";
import type { EnemyRank } from "../../data/enemies";
import type {
  ChestSpawn,
  DecorSpawn,
  DungeonFeature,
  DungeonData,
  DungeonRoom,
  EnemySpawn,
  NodeSpawn,
  RoomType,
  TilePoint,
} from "./types";

/**
 * Seeded rooms-and-corridors generator built for readability over
 * cleverness:
 *
 *   Entrance -> Room -> ... -> Boss      (the critical path, mostly eastward)
 *                 \-> Treasure / Resource / Shrine   (short side branches)
 *
 * Rooms are real rectangles with generous spacing, corridors are 3 tiles wide
 * L-shapes, and every room keeps at least three wall rows above it so the
 * renderer can draw proper north wall faces. Same seed + floor -> same
 * layout. How big, crowded and rich a floor is comes from its FloorProfile.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Dir = "E" | "W" | "N" | "S";

const PAD_X = 4; // min wall tiles between rooms horizontally
const PAD_Y = 5; // vertically (north faces are 3 tiles tall)

export function generateDungeon(seed: string, depth: number): DungeonData {
  const rng = SeededRandom.fromString(`${seed}:floor${depth}`);
  const profile = floorProfile(depth, seed);
  const rooms: (Box & { type: RoomType; pathIndex: number; parent?: number })[] = [];
  const corridors: Box[] = [];

  // ---- critical path -----------------------------------------------------
  const mainCount = profile.mainRooms + rng.int(0, 1);
  rooms.push({ x: 0, y: 0, w: rng.int(9, 11), h: rng.int(7, 8), type: "entrance", pathIndex: 0 });
  let lastDir: Dir = "E";

  for (let i = 1; i < mainCount; i++) {
    const isBoss = i === mainCount - 1;
    const prev = rooms[i - 1];
    let placed = false;
    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const dir = pickDir(rng, lastDir);
      const w = isBoss ? rng.int(15, 17) : rng.int(9, 15);
      const h = isBoss ? rng.int(10, 12) : rng.int(7, 10);
      const cand = placeNear(rng, prev, dir, w, h);
      if (overlapsAny(cand, rooms)) continue;
      rooms.push({ ...cand, type: isBoss ? "boss" : "combat", pathIndex: i, parent: i - 1 });
      lastDir = dir;
      placed = true;
    }
    if (!placed) {
      // Guaranteed fallback: keep going east, well clear of everything.
      const maxX = Math.max(...rooms.map((r) => r.x + r.w));
      const w = isBoss ? 16 : 11;
      const h = isBoss ? 11 : 8;
      rooms.push({ x: maxX + 6, y: prev.y, w, h, type: isBoss ? "boss" : "combat", pathIndex: i, parent: i - 1 });
      lastDir = "E";
    }
  }

  // ---- side branches -----------------------------------------------------
  // A different mix every floor: a couple of classics, then a draw from the
  // stranger rooms, so you never quite know what's behind the next door.
  const pool: { item: RoomType; weight: number }[] = [
    { item: "treasure", weight: 3 },
    { item: "resource", weight: 2 },
    { item: "shrine", weight: 1.5 },
    { item: "trap", weight: 2 },
    { item: "library", weight: 1.6 },
    ...(depth >= 2 ? [{ item: "rest" as RoomType, weight: 1.4 }, { item: "merchant" as RoomType, weight: 1.1 }, { item: "camp" as RoomType, weight: 1 }, { item: "secret" as RoomType, weight: 1.2 }] : []),
    ...(depth >= 3 ? [{ item: "arena" as RoomType, weight: 1.5 }] : []),
  ];
  const branchTypes: RoomType[] = [];
  const sideCount = Math.min(6, 3 + Math.floor(depth / 5) + rng.int(0, 1));
  for (let i = 0; i < sideCount; i++) {
    const avail = pool.filter((p) => !(branchTypes.includes(p.item) && ["merchant", "camp", "rest", "secret", "arena"].includes(p.item)));
    branchTypes.push(rng.weighted(avail));
  }
  // Some main-path rooms are quiet halls instead of another fight.
  for (const r of rooms) if (r.type === "combat" && r.pathIndex >= 3 && rng.bool(0.18)) r.type = "library";
  for (const type of branchTypes) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const parentIdx = rng.int(1, mainCount - 2);
      const parent = rooms[parentIdx];
      const dir = rng.pick<Dir>(["N", "S", "N", "S", "E", "W"]);
      const w = rng.int(7, 10);
      const h = rng.int(6, 8);
      const cand = placeNear(rng, parent, dir, w, h, 3, 6);
      if (overlapsAny(cand, rooms)) continue;
      rooms.push({ ...cand, type, pathIndex: -1, parent: parentIdx });
      break;
    }
  }

  // ---- corridors -----------------------------------------------------------
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const parent = rooms[room.parent!];
    corridors.push(...connect(rng, parent, room, rooms));
  }

  // ---- rasterize ---------------------------------------------------------
  const all = [...rooms, ...corridors];
  const minX = Math.min(...all.map((b) => b.x)) - 5;
  const minY = Math.min(...all.map((b) => b.y)) - 6;
  const maxX = Math.max(...all.map((b) => b.x + b.w)) + 5;
  const maxY = Math.max(...all.map((b) => b.y + b.h)) + 5;
  const width = maxX - minX;
  const height = maxY - minY;
  const grid: number[] = Array.from({ length: width * height }, () => 0);
  const carve = (b: Box) => {
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) grid[(y - minY) * width + (x - minX)] = 1;
  };
  rooms.forEach(carve);
  corridors.forEach(carve);

  const finalRooms: DungeonRoom[] = rooms.map((r, id) => ({
    id,
    type: r.type,
    x: r.x - minX,
    y: r.y - minY,
    w: r.w,
    h: r.h,
    pathIndex: r.pathIndex,
  }));

  const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && grid[y * width + x] === 1;

  // ---- doors on north walls --------------------------------------------------
  const northDoor = (room: DungeonRoom, width2: number): TilePoint => {
    // Candidate x where the 3 rows above are solid wall (room for the arch).
    const cands: number[] = [];
    for (let x = room.x + 1; x + width2 - 1 < room.x + room.w - 1; x++) {
      let ok = true;
      for (let dx = 0; dx < width2; dx++)
        for (let dy = 1; dy <= 3; dy++) if (floor(x + dx, room.y - dy)) ok = false;
      if (ok) cands.push(x);
    }
    const mid = room.x + Math.floor(room.w / 2) - Math.floor(width2 / 2);
    cands.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    return { x: cands[0] ?? mid, y: room.y - 1 };
  };

  const entranceRoom = finalRooms[0];
  const bossRoom = finalRooms[mainCount - 1];
  const entranceDoor = northDoor(entranceRoom, 2);
  const exitDoor = northDoor(bossRoom, 2);
  const spawn = { x: entranceDoor.x + 1, y: entranceRoom.y + 1 };

  // ---- population ---------------------------------------------------------
  const enemies: EnemySpawn[] = [];
  const chests: ChestSpawn[] = [];
  const nodes: NodeSpawn[] = [];
  const decor: DecorSpawn[] = [];
  const fountains: TilePoint[] = [];
  const features: DungeonFeature[] = [];
  const used = new Set<string>();
  const k = (x: number, y: number) => `${x},${y}`;
  const reserve = (p: TilePoint) => used.add(k(p.x, p.y));
  reserve(spawn);
  // Keep door approaches clear.
  for (const d of [entranceDoor, exitDoor]) for (let dx = 0; dx < 2; dx++) for (let dy = 1; dy <= 2; dy++) used.add(k(d.x + dx, d.y + dy));

  const freeSpot = (room: DungeonRoom, margin = 1): TilePoint | null => {
    for (let t = 0; t < 40; t++) {
      const x = rng.int(room.x + margin, room.x + room.w - 1 - margin);
      const y = rng.int(room.y + margin, room.y + room.h - 1 - margin);
      if (!floor(x, y) || used.has(k(x, y))) continue;
      if (touchesOutside(room, floor, x, y)) continue;
      // keep a 1-tile gap around blocking things so paths never get sealed
      let crowded = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (used.has(k(x + dx, y + dy))) crowded = true;
      if (crowded) continue;
      used.add(k(x, y));
      return { x, y };
    }
    return null;
  };

  const pickEnemy = () => rng.weighted(profile.enemies.map((e) => ({ item: e.id, weight: e.weight })));
  const rank = (): EnemyRank => (rng.bool(profile.eliteChance) ? "elite" : "normal");
  let enemyId = 0;
  let chestId = 0;
  let nodeId = 0;

  for (const room of finalRooms) {
    const area = room.w * room.h;
    if (room.type === "combat") {
      // The first combat rooms ease you in; later ones get crowded.
      const early = room.pathIndex > 0 && room.pathIndex <= 2;
      const count = Math.min(7, (early ? rng.int(1, 2) : rng.int(2, 3)) + (area > 120 && !early ? 1 : 0) + (early ? 0 : profile.crowd));
      // Each room is an encounter: a pack, archers behind a front line, a
      // swarm, a brute with escorts… (see FloorProfile.encounters).
      const encounter = early ? null : rng.weighted(profile.encounters.map((e) => ({ item: e, weight: e.weight })));
      const roster = encounter ? [...encounter.lead, ...Array.from({ length: Math.max(0, count - encounter.lead.length) }, () => rng.pick(encounter.fill))] : [];
      const total = encounter ? Math.min(8, roster.length + (encounter.extra ?? 0)) : count;
      for (let i = 0; i < total; i++) {
        const p = freeSpot(room, 2);
        const defId = encounter ? (roster[i] ?? rng.pick(encounter.fill)) : pickEnemy();
        if (p) enemies.push({ ...p, id: `e${enemyId++}`, defId, roomId: room.id, rank: early ? "normal" : rank() });
      }
      if (rng.bool(0.18)) {
        const p = freeSpot(room, 1);
        if (p) chests.push({ ...p, id: `c${chestId++}`, roomId: room.id, rare: false });
      }
      // Deeper (or trapped) floors hide spike plates among the fighting.
      if (!early && (profile.mutator === "traps" || (depth >= 8 && rng.bool(0.25)))) {
        const plates = profile.mutator === "traps" ? rng.int(3, 6) : rng.int(2, 3);
        for (let i = 0; i < plates; i++) {
          const p = freeSpot(room, 2);
          if (p) features.push({ kind: "spikes", x: p.x, y: p.y, roomId: room.id, n: i % 4 });
        }
      }
    } else if (room.type === "boss") {
      const center = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) + 1 };
      used.add(k(center.x, center.y));
      // The floor's guardian holds the stairs: a boss every 5th floor,
      // otherwise an elite.
      const guardianId = profile.bossFloor ? profile.bossId : pickEnemy();
      enemies.push({ ...center, id: `e${enemyId++}`, defId: guardianId, roomId: room.id, rank: profile.bossFloor ? "boss" : "elite", guardian: true });
      const guards = profile.bossFloor ? 2 + Math.floor(depth / 10) : 1 + Math.floor(depth / 6);
      for (let i = 0; i < guards; i++) {
        const p = freeSpot(room, 2);
        if (p) enemies.push({ ...p, id: `e${enemyId++}`, defId: pickEnemy(), roomId: room.id, rank: "normal" });
      }
      chests.push({
        x: exitDoor.x - 2 < room.x ? exitDoor.x + 3 : exitDoor.x - 2,
        y: room.y + 1,
        id: `c${chestId++}`,
        roomId: room.id,
        rare: true,
        bossReward: profile.bossFloor,
      });
      decor.push({ kind: "rug", x: center.x - 1, y: center.y - 2 });
      decor.push({ kind: "brazier", x: room.x + 1, y: room.y + 1 });
      decor.push({ kind: "brazier", x: room.x + room.w - 2, y: room.y + 1 });
    } else if (room.type === "treasure") {
      const p = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
      reserve(p);
      chests.push({ ...p, id: `c${chestId++}`, roomId: room.id, rare: rng.bool(Math.min(0.8, 0.3 + profile.chestTier * 0.08)) });
      if (rng.bool(0.6)) {
        const g = freeSpot(room, 1);
        if (g) enemies.push({ ...g, id: `e${enemyId++}`, defId: pickEnemy(), roomId: room.id, rank: rank() });
      }
      decor.push({ kind: "coffin", x: room.x, y: room.y });
    } else if (room.type === "resource") {
      // Deeper floors favour their newest (best) ores.
      const kinds = profile.ores;
      const count = rng.int(3, 5);
      for (let i = 0; i < count; i++) {
        const p = freeSpot(room, 1);
        const defId = rng.weighted(kinds.map((id, j) => ({ item: id, weight: 1 + j })));
        if (p) nodes.push({ ...p, id: `n${nodeId++}`, defId, roomId: room.id });
      }
    } else if (room.type === "shrine") {
      const f = northDoor(room, 1);
      fountains.push(f);
      for (let dy = 1; dy <= 2; dy++) used.add(k(f.x, f.y + dy));
    }

    else if (room.type === "trap") {
      // A grid of spike plates with a safe-ish zigzag; the prize in the middle.
      const c = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
      reserve(c);
      chests.push({ ...c, id: `c${chestId++}`, roomId: room.id, rare: rng.bool(0.35) });
      for (let y = room.y + 1; y < room.y + room.h - 1; y++)
        for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
          if (used.has(k(x, y)) || touchesOutside(room, floor, x, y) || (x + y) % 2 !== 0 || !rng.bool(0.55)) continue;
          features.push({ kind: "spikes", x, y, roomId: room.id, n: (x * 3 + y) % 4 });
        }
    } else if (room.type === "rest") {
      const c = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
      reserve(c);
      features.push({ kind: "campfire", ...c, roomId: room.id });
      features.push({ kind: "bedroll", x: c.x - 2, y: c.y + 1, roomId: room.id });
      used.add(k(c.x - 2, c.y + 1));
    } else if (room.type === "merchant") {
      const c = { x: room.x + Math.floor(room.w / 2), y: room.y + 2 };
      reserve(c);
      features.push({ kind: "merchant", ...c, roomId: room.id });
      decor.push({ kind: "crates", x: c.x + 2, y: c.y, wall: false });
      used.add(k(c.x + 2, c.y));
      used.add(k(c.x + 3, c.y));
    } else if (room.type === "arena") {
      const n = rng.int(2, 3) + (depth >= 8 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const p = freeSpot(room, 2);
        if (p) enemies.push({ ...p, id: `e${enemyId++}`, defId: pickEnemy(), roomId: room.id, rank: "elite" });
      }
      const p = freeSpot(room, 1);
      if (p) chests.push({ ...p, id: `c${chestId++}`, roomId: room.id, rare: true });
      decor.push({ kind: "brazier", x: room.x + 1, y: room.y + 1 });
      decor.push({ kind: "brazier", x: room.x + room.w - 2, y: room.y + 1 });
      decor.push({ kind: "blood", x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) });
    } else if (room.type === "library") {
      // Quiet: statues and pillars, shelves on the walls, a lore note, maybe a ghost.
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 3) {
        if (floor(x, room.y - 1)) continue;
        features.push({ kind: "bookcase", x, y: room.y, roomId: room.id });
        used.add(k(x, room.y));
      }
      for (const [dx, dy] of [
        [1, 2],
        [room.w - 2, 2],
      ]) {
        const p = { x: room.x + dx, y: room.y + dy };
        if (!touchesOutside(room, floor, p.x, p.y) && !used.has(k(p.x, p.y))) {
          features.push({ kind: rng.bool() ? "statue" : "pillar", ...p, roomId: room.id, n: rng.int(0, 1) });
          used.add(k(p.x, p.y));
        }
      }
      const note = freeSpot(room, 1);
      if (note) features.push({ kind: "lore", ...note, roomId: room.id, n: rng.int(0, 99) });
      if (rng.bool(0.4)) {
        const g = freeSpot(room, 2);
        if (g) enemies.push({ ...g, id: `e${enemyId++}`, defId: depth >= 6 ? "ghost" : "skeleton", roomId: room.id, rank: "normal" });
      }
      if (rng.bool(0.5)) {
        const s = freeSpot(room, 1);
        if (s) features.push({ kind: "skull", ...s, roomId: room.id });
      }
    } else if (room.type === "secret") {
      const c = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
      reserve(c);
      chests.push({ ...c, id: `c${chestId++}`, roomId: room.id, rare: true });
      const g = freeSpot(room, 1);
      if (g) nodes.push({ ...g, id: `n${nodeId++}`, defId: rng.pick(profile.ores.slice(-2)), roomId: room.id });
      // Seal every way in with a cracked wall.
      for (let y = room.y - 1; y <= room.y + room.h; y++)
        for (let x = room.x - 1; x <= room.x + room.w; x++) {
          const inside = x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
          if (inside || !floor(x, y)) continue;
          const touches = floor(x + 1, y) || floor(x - 1, y) || floor(x, y + 1) || floor(x, y - 1);
          const adjacentRoom = x >= room.x - 1 && x <= room.x + room.w && y >= room.y - 1 && y <= room.y + room.h;
          if (touches && adjacentRoom) features.push({ kind: "crack", x, y, roomId: room.id });
        }
    } else if (room.type === "camp") {
      const c = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
      reserve(c);
      features.push({ kind: "dice_table", ...c, roomId: room.id });
      features.push({ kind: "campfire", x: c.x, y: c.y - 2, roomId: room.id });
      used.add(k(c.x, c.y - 2));
      for (const [dx, dy, n] of [
        [-2, 0, 0],
        [2, 0, 1],
        [0, 2, 2],
      ]) {
        features.push({ kind: "goblin_player", x: c.x + dx, y: c.y + dy, roomId: room.id, n });
        used.add(k(c.x + dx, c.y + dy));
      }
    }

    // Dressing: wall lanterns + banners along north walls, clutter on floor.
    for (let x = room.x + 2; x < room.x + room.w - 2; x += rng.int(3, 5)) {
      if (floor(x, room.y - 1) || floor(x, room.y - 2)) continue;
      if (Math.abs(x - entranceDoor.x) <= 2 && room.id === entranceRoom.id) continue;
      if (Math.abs(x - exitDoor.x) <= 2 && room.id === bossRoom.id) continue;
      if (fountains.some((f) => f.y === room.y - 1 && Math.abs(f.x - x) <= 1)) continue;
      const roll = rng.next();
      if (roll < 0.45) decor.push({ kind: "lantern", x, y: room.y - 1, wall: true });
      else if (roll < 0.75) decor.push({ kind: rng.pick(["banner_red", "banner_blue", "banner_green"] as const), x, y: room.y - 1, wall: true });
      else if (roll < 0.85) decor.push({ kind: "chain", x, y: room.y - 1, wall: true });
    }
    const clutter = room.type === "boss" ? 1 : rng.int(1, 3);
    for (let i = 0; i < clutter; i++) {
      // Clutter hugs the walls so it never blocks the path through a room.
      const edge = rng.int(0, 3);
      const kind = rng.pick(["crates", "barrel", "coal_pile", "rubble", "pebble_a", "tomb_arch"] as const);
      // Wide props (crates are 3 tiles) keep a tile of clearance from side walls.
      const inset = kind === "crates" ? 2 : 0;
      const x = edge === 2 ? room.x + inset : edge === 3 ? room.x + room.w - 1 - inset : rng.int(room.x + 2, room.x + room.w - 3);
      const y = edge === 0 ? room.y : edge === 1 ? room.y + room.h - 1 : rng.int(room.y + 1, room.y + room.h - 2);
      if (used.has(k(x, y)) || !floor(x, y)) continue;
      if (touchesOutside(room, floor, x, y)) continue;
      used.add(k(x, y));
      if (kind === "crates") {
        used.add(k(x - 1, y));
        used.add(k(x + 1, y));
      }
      decor.push({ kind, x, y });
    }
    if (rng.bool(0.5)) {
      const p = { x: rng.int(room.x + 1, room.x + room.w - 2), y: rng.int(room.y + 1, room.y + room.h - 2) };
      decor.push({ kind: "blood", ...p });
    }
  }

  return {
    seed,
    floor: depth,
    width,
    height,
    grid,
    rooms: finalRooms,
    entranceDoor,
    spawn,
    exitDoor,
    fountains,
    enemies,
    chests,
    nodes,
    decor,
    features,
  };
}

function pickDir(rng: SeededRandom, last: Dir): Dir {
  const opposite: Record<Dir, Dir> = { E: "W", W: "E", N: "S", S: "N" };
  const weights: { item: Dir; weight: number }[] = [
    { item: "E", weight: 6 },
    { item: "S", weight: 3 },
    { item: "N", weight: 3 },
    { item: "W", weight: 1 },
  ];
  return rng.weighted(weights.filter((w) => w.item !== opposite[last]));
}

function placeNear(rng: SeededRandom, prev: Box, dir: Dir, w: number, h: number, minGap = 4, maxGap = 8): Box {
  const gap = rng.int(minGap, maxGap);
  const slideX = () => prev.x + rng.int(-(w - 4), prev.w - 4);
  const slideY = () => prev.y + rng.int(-(h - 4), prev.h - 4);
  switch (dir) {
    case "E":
      return { x: prev.x + prev.w + gap + 1, y: slideY(), w, h };
    case "W":
      return { x: prev.x - w - gap - 1, y: slideY(), w, h };
    case "S":
      return { x: slideX(), y: prev.y + prev.h + gap + 2, w, h };
    case "N":
      return { x: slideX(), y: prev.y - h - gap - 2, w, h };
  }
}

function overlapsAny(b: Box, others: Box[]): boolean {
  return others.some(
    (o) => b.x < o.x + o.w + PAD_X && b.x + b.w + PAD_X > o.x && b.y < o.y + o.h + PAD_Y && b.y + b.h + PAD_Y > o.y,
  );
}

function center(b: Box) {
  return { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) };
}

/** Two 3-wide segments forming an L between room centers. Tries both bend
 * orientations and prefers the one that doesn't graze a third room. */
function connect(rng: SeededRandom, a: Box, b: Box, rooms: Box[]): Box[] {
  const ca = center(a);
  const cb = center(b);
  const hFirst = (): Box[] => [seg(ca.x, ca.y, cb.x, ca.y), seg(cb.x, ca.y, cb.x, cb.y)];
  const vFirst = (): Box[] => [seg(ca.x, ca.y, ca.x, cb.y), seg(ca.x, cb.y, cb.x, cb.y)];
  const options = rng.bool() ? [hFirst(), vFirst()] : [vFirst(), hFirst()];
  const others = rooms.filter((r) => r !== a && r !== b);
  const clash = (segs: Box[]) =>
    segs.some((s) => others.some((o) => s.x < o.x + o.w + 1 && s.x + s.w + 1 > o.x && s.y < o.y + o.h + 2 && s.y + s.h + 1 > o.y));
  return options.find((o) => !clash(o)) ?? options[0];
}

function seg(x0: number, y0: number, x1: number, y1: number): Box {
  const minX = Math.min(x0, x1) - 1;
  const minY = Math.min(y0, y1) - 1;
  return { x: minX, y: minY, w: Math.abs(x1 - x0) + 3, h: Math.abs(y1 - y0) + 3 };
}

/** True if a tile sits next to floor outside its room — i.e. in the mouth of
 * a corridor, where clutter would block the way through. */
function touchesOutside(room: DungeonRoom, floor: (x: number, y: number) => boolean, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      const inside = nx >= room.x && nx < room.x + room.w && ny >= room.y && ny < room.y + room.h;
      if (!inside && floor(nx, ny)) return true;
    }
  return false;
}
