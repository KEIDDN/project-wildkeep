import { SeededRandom } from "../core/rng";
import type { MineFloorProfile } from "../../data/mineFloors";

/**
 * Procedural mine floors: organic chambers joined by tunnels.
 *
 *  1. The entrance chamber sits at the bottom middle, with a shaft to the
 *     map edge (the way back up).
 *  2. Other chambers are scattered with generous spacing (north walls need
 *     room for their rock faces).
 *  3. Chambers are joined along a minimum spanning tree, plus a couple of
 *     extra tunnels so the cave has loops, not just dead ends.
 *  4. The ladder down goes in the chamber farthest (by walking) from the
 *     entrance — deeper always means exploring.
 *  5. Nodes, treasure, hazards and props are placed from the floor profile.
 *
 * Pure data: same seed + profile -> same cave. The engine only renders it.
 */

export interface CaveBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CaveData {
  seed: string;
  floor: number;
  width: number;
  height: number;
  /** Row-major, 1 = floor. */
  grid: Uint8Array;
  chambers: CaveBox[];
  /** Tunnels (for rails), as axis-aligned boxes. */
  tunnels: CaveBox[];
  spawn: { x: number; y: number };
  /** Bottom of the exit shaft (tile). */
  exit: { x: number; y: number };
  ladder: { x: number; y: number };
  nodes: { x: number; y: number; defId: string }[];
  hazards: { x: number; y: number }[];
  chests: { x: number; y: number; rare: boolean }[];
  props: { x: number; y: number; kind: string }[];
  lanterns: { x: number; y: number }[];
}

const PAD_X = 3;
const PAD_Y = 5;

export function generateCave(seed: string, profile: MineFloorProfile): CaveData {
  const rng = SeededRandom.fromString(`${seed}:mine${profile.floor}`);
  const W = 44 + profile.chambers * 3;
  const H = 36 + profile.chambers * 2;
  const grid = new Uint8Array(W * H);
  const isFloor = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === 1;
  const carve = (b: CaveBox) => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (x > 0 && y > 3 && x < W - 1 && y < H) grid[y * W + x] = 1;
  };

  // ---- chambers ----------------------------------------------------------------
  const entry: CaveBox = { x: Math.floor(W / 2) - 5, y: H - 11, w: 11, h: 6 };
  const chambers: CaveBox[] = [entry];
  const overlaps = (b: CaveBox) =>
    chambers.some((o) => b.x < o.x + o.w + PAD_X && b.x + b.w + PAD_X > o.x && b.y < o.y + o.h + PAD_Y && b.y + b.h + PAD_Y > o.y);
  for (let tries = 0; tries < 400 && chambers.length < profile.chambers; tries++) {
    const w = rng.int(7, 14);
    const h = rng.int(6, 9);
    const b = { x: rng.int(2, W - w - 2), y: rng.int(5, H - h - 12), w, h };
    if (!overlaps(b)) chambers.push(b);
  }

  // ---- tunnels: minimum spanning tree + a few loops ---------------------------------
  const center = (b: CaveBox) => ({ x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) });
  const dist = (a: CaveBox, b: CaveBox) => {
    const ca = center(a);
    const cb = center(b);
    return Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
  };
  const edges: [number, number][] = [];
  const inTree = new Set([0]);
  while (inTree.size < chambers.length) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const i of inTree)
      for (let j = 0; j < chambers.length; j++) {
        if (inTree.has(j)) continue;
        const d = dist(chambers[i], chambers[j]);
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    edges.push(best!);
    inTree.add(best![1]);
  }
  for (let k = 0; k < Math.min(2, chambers.length - 2); k++) {
    const a = rng.int(1, chambers.length - 1);
    const b = rng.int(1, chambers.length - 1);
    if (a !== b) edges.push([a, b]);
  }
  const tunnels: CaveBox[] = [];
  const seg = (x0: number, y0: number, x1: number, y1: number): CaveBox => ({
    x: Math.min(x0, x1) - 1,
    y: Math.min(y0, y1) - 1,
    w: Math.abs(x1 - x0) + 3,
    h: Math.abs(y1 - y0) + 3,
  });
  for (const [i, j] of edges) {
    const a = center(chambers[i]);
    const b = center(chambers[j]);
    if (rng.bool()) tunnels.push(seg(a.x, a.y, b.x, a.y), seg(b.x, a.y, b.x, b.y));
    else tunnels.push(seg(a.x, a.y, a.x, b.y), seg(a.x, b.y, b.x, b.y));
  }
  // Exit shaft from the entry chamber down to the map edge.
  const exitX = entry.x + Math.floor(entry.w / 2);
  tunnels.push({ x: exitX - 1, y: entry.y + entry.h - 1, w: 3, h: H - (entry.y + entry.h) + 1 });

  for (const c of chambers) carve(c);
  for (const t of tunnels) carve(t);
  // Roughen chamber edges so they read as dug rock, not rooms.
  for (const c of chambers) {
    for (let x = c.x; x < c.x + c.w; x++) {
      if (rng.bool(0.35)) carve({ x, y: c.y - 1, w: 1, h: 1 });
      if (rng.bool(0.35)) carve({ x, y: c.y + c.h, w: 1, h: 1 });
    }
    for (let y = c.y; y < c.y + c.h; y++) {
      if (rng.bool(0.35)) carve({ x: c.x - 1, y, w: 1, h: 1 });
      if (rng.bool(0.35)) carve({ x: c.x + c.w, y, w: 1, h: 1 });
    }
  }

  // ---- ladder: the chamber farthest from the entrance by walking ----------------------
  const spawn = { x: exitX, y: entry.y + entry.h - 2 };
  const distMap = bfs(grid, W, H, spawn.x, spawn.y);
  let far = 1;
  for (let i = 1; i < chambers.length; i++) {
    const c = center(chambers[i]);
    if (distMap[c.y * W + c.x] > distMap[center(chambers[far]).y * W + center(chambers[far]).x]) far = i;
  }
  const farC = chambers[far] ?? entry;

  // ---- placement -----------------------------------------------------------------------
  const used = new Uint8Array(W * H);
  const reserve = (x: number, y: number, r = 1) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) used[yy * W + xx] = 1;
  };
  // Keep the entrance, shaft and ladder approach clear.
  for (let y = entry.y; y < H; y++) reserve(exitX, y, 1);
  reserve(spawn.x, spawn.y, 2);
  const ladder = { x: farC.x + Math.floor(farC.w / 2), y: farC.y + Math.floor(farC.h / 2) };
  reserve(ladder.x, ladder.y, 2);

  const free = (x: number, y: number) => {
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (!isFloor(xx, yy) || used[yy * W + xx]) return false;
    return isFloor(x, y - 2);
  };
  const spotIn = (c: CaveBox): { x: number; y: number } | null => {
    for (let t = 0; t < 60; t++) {
      const x = rng.int(c.x, c.x + c.w - 1);
      const y = rng.int(c.y, c.y + c.h - 1);
      if (free(x, y)) return { x, y };
    }
    return null;
  };

  const nodes: CaveData["nodes"] = [];
  const others = chambers.slice(1);
  for (let i = 0; i < profile.nodeCount; i++) {
    // A couple of easy nodes by the entrance, the rest out in the cave.
    const c = i < 2 ? entry : rng.pick(others.length ? others : [entry]);
    const p = spotIn(c);
    if (!p) continue;
    const defId = i < 2 ? "cave_rock" : rng.weighted(profile.nodes.map((n) => ({ item: n.id, weight: n.weight })));
    nodes.push({ ...p, defId });
    reserve(p.x, p.y, 1);
  }

  const chests: CaveData["chests"] = [];
  if (rng.bool(profile.chestChance) && others.length) {
    // Treasure prefers a dead end (a chamber with one tunnel).
    const degree = chambers.map((_, i) => edges.filter(([a, b]) => a === i || b === i).length);
    const deadEnds = others.filter((_, i) => degree[i + 1] === 1 && chambers.indexOf(others[i]) !== far);
    const p = spotIn(rng.pick(deadEnds.length ? deadEnds : others));
    if (p) {
      chests.push({ ...p, rare: rng.bool(0.25 + profile.floor * 0.02) });
      reserve(p.x, p.y, 1);
    }
  }

  const hazards: CaveData["hazards"] = [];
  for (let i = 0; i < profile.hazards; i++) {
    const c = rng.pick(tunnels.slice(0, -1).concat(others));
    const x = rng.int(c.x, c.x + c.w - 1);
    const y = rng.int(c.y, c.y + c.h - 1);
    if (!isFloor(x, y) || used[y * W + x] || Math.abs(x - spawn.x) + Math.abs(y - spawn.y) < 8) continue;
    hazards.push({ x, y });
    used[y * W + x] = 1;
  }

  const props: CaveData["props"] = [];
  const PROPS = ["barrel", "crates", "coal_heap", "rubble", "pebble_a", "empty_crate", "rubble", "pebble_a"];
  for (const c of chambers) {
    const n = rng.int(0, 2);
    for (let i = 0; i < n; i++) {
      const p = spotIn(c);
      if (!p) continue;
      props.push({ ...p, kind: rng.pick(PROPS) });
      reserve(p.x, p.y, 1);
    }
  }

  const lanterns: CaveData["lanterns"] = [];
  for (const c of chambers) {
    for (let x = c.x + 2; x < c.x + c.w - 1; x += rng.int(4, 6)) {
      let y = c.y;
      while (y > 0 && isFloor(x, y - 1)) y--;
      if (!isFloor(x, y) || isFloor(x, y - 1) || isFloor(x, y - 2)) continue;
      lanterns.push({ x, y });
    }
  }

  return { seed, floor: profile.floor, width: W, height: H, grid, chambers, tunnels, spawn, exit: { x: exitX, y: H - 1 }, ladder, nodes, hazards, chests, props, lanterns };
}

/** Walking distance (in tiles) from a start tile to every floor tile. */
function bfs(grid: Uint8Array, W: number, H: number, sx: number, sy: number): Int32Array {
  const dist = new Int32Array(W * H).fill(-1);
  const q = [sy * W + sx];
  dist[q[0]] = 0;
  for (let head = 0; head < q.length; head++) {
    const i = q[head];
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (grid[j] !== 1 || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      q.push(j);
    }
  }
  return dist;
}
