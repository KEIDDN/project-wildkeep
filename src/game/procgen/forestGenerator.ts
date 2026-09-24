import { SeededRandom } from "../core/rng";
import type { BiomeEntrance, BiomeRules, PoiKind } from "../../data/biomes";
import type { SkillId } from "../../data/skills";

/**
 * Procedural forests. The generator decides where you can walk and what
 * grows there; the woods builder (engine/world/areas/woods.ts) renders it.
 *
 *  1. every entrance gets a clearing just inside the map edge; more
 *     clearings (big meadows and small pockets) are scattered with spacing
 *  2. clearings are joined along a minimum spanning tree + a loop or two,
 *     by *meandering* trails (wobbly polylines, 2–3 tiles wide)
 *  3. a smooth noise field splits the rest into dense thicket (impassable,
 *     wall-to-wall trees) and open woodland (walkable, scattered trunks you
 *     weave between) — so the forest has shape, not just corridors
 *  4. hidden glades hang off the network behind a thicket you must chop,
 *     sealed all round by dense growth
 *  5. anything you can't actually reach from the way in is grown over
 *     (flood fill), so nothing ever spawns where you can't get to it
 *  6. points of interest take a few clearings; resources grow in
 *     *clusters* — groves, outcrops, herb patches — mostly off the trail
 *
 * Same (rules, seed, progression) -> same forest.
 */

export interface ForestClearing {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface ForestLayout {
  seed: string;
  cols: number;
  rows: number;
  /** Trails as polylines (tile coords) with their width. */
  trails: { points: [number, number][]; width: number }[];
  clearings: ForestClearing[];
  nodes: [string, number, number][];
  /** Hidden glades and the thicket (tile, blocks the trail) guarding each. */
  glades: { clearing: ForestClearing; thicket: { x: number; y: number } }[];
  pois: { kind: PoiKind; x: number; y: number }[];
  entrances: { entrance: BiomeEntrance; edge: { x: number; y: number }; inside: { x: number; y: number } }[];
  /** 1 = walkable. Row-major, cols × rows. */
  walk: Uint8Array;
  /** 1 = trail surface. */
  trail: Uint8Array;
  /** 1 = open woodland (walkable, but not trail or clearing). */
  open: Uint8Array;
  /** Scattered trunks inside open woodland (tile coords). */
  woodTrees: [number, number][];
}

/** Smooth 2-D value noise in [0, 1]. */
function valueNoise(rng: SeededRandom, cols: number, rows: number, scale: number): (x: number, y: number) => number {
  const gw = Math.ceil(cols / scale) + 2;
  const gh = Math.ceil(rows / scale) + 2;
  const g = Array.from({ length: gw * gh }, () => rng.next());
  const at = (x: number, y: number) => g[Math.min(gh - 1, y) * gw + Math.min(gw - 1, x)];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / scale;
    const fy = y / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = s(fx - ix);
    const ty = s(fy - iy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
    return a + (b - a) * ty;
  };
}

export function generateForest(rules: BiomeRules, seed: string, skills: Partial<Record<SkillId, number>> = {}): ForestLayout {
  const rng = SeededRandom.fromString(`${rules.id}:${seed}`);
  const { cols, rows } = rules;
  const N = cols * rows;
  const idx = (x: number, y: number) => y * cols + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  const clearings: ForestClearing[] = [];
  const trails: ForestLayout["trails"] = [];

  // ---- entrances --------------------------------------------------------------------
  const entrances = rules.entrances.map((e) => {
    const edge = e.side === "west" ? { x: 0, y: e.at } : e.side === "east" ? { x: cols - 1, y: e.at } : e.side === "north" ? { x: e.at, y: 0 } : { x: e.at, y: rows - 1 };
    const inset = 6;
    const inside =
      e.side === "west" ? { x: inset, y: e.at } : e.side === "east" ? { x: cols - 1 - inset, y: e.at } : e.side === "north" ? { x: e.at, y: inset + 1 } : { x: e.at, y: rows - 1 - inset };
    clearings.push({ x: inside.x, y: inside.y, rx: 5, ry: 4 });
    trails.push({ points: [[edge.x, edge.y], [inside.x, inside.y]], width: 3 });
    return { entrance: e, edge, inside };
  });
  const entranceCount = clearings.length;

  if (rules.landmark) {
    const l = rules.landmark;
    clearings.push({ x: l.x + Math.floor(l.w / 2), y: l.y + l.h + 3, rx: 8, ry: 4 });
  }

  const fits = (c: ForestClearing, pad = 4) =>
    c.x - c.rx > 4 &&
    c.y - c.ry > 4 &&
    c.x + c.rx < cols - 5 &&
    c.y + c.ry < rows - 5 &&
    clearings.every((o) => Math.abs(c.x - o.x) > c.rx + o.rx + pad || Math.abs(c.y - o.y) > c.ry + o.ry + pad) &&
    (!rules.landmark ||
      !(c.x + c.rx > rules.landmark.x - 2 && c.x - c.rx < rules.landmark.x + rules.landmark.w + 2 && c.y - c.ry < rules.landmark.y + rules.landmark.h + 1));
  const target = entranceCount + (rules.landmark ? 1 : 0) + rules.clearings;
  for (let tries = 0; tries < 900 && clearings.length < target; tries++) {
    // A mix of broad meadows and little pockets.
    const big = rng.bool(0.55);
    const c = big ? { x: rng.int(8, cols - 9), y: rng.int(8, rows - 9), rx: rng.int(5, 8), ry: rng.int(4, 6) } : { x: rng.int(7, cols - 8), y: rng.int(7, rows - 8), rx: rng.int(3, 4), ry: rng.int(3, 4) };
    if (fits(c)) clearings.push(c);
  }

  // ---- trails: MST + loops, meandering ------------------------------------------------------
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < clearings.length) {
    let best: [number, number] = [0, 0];
    let bestD = Infinity;
    for (const i of inTree)
      for (let j = 0; j < clearings.length; j++) {
        if (inTree.has(j)) continue;
        const d = dist(clearings[i], clearings[j]);
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    edges.push(best);
    inTree.add(best[1]);
  }
  for (let l = 0; l < (clearings.length > 8 ? 2 : 1); l++) {
    const a = rng.int(0, clearings.length - 1);
    // Loop to a nearby-ish clearing, so it reads as a shortcut, not a highway.
    const near = clearings.map((c, i) => ({ i, d: dist(c, clearings[a]) })).filter((o) => o.i !== a).sort((p, q) => p.d - q.d);
    const b = near[Math.min(near.length - 1, rng.int(1, 3))]?.i ?? a;
    if (a !== b) edges.push([a, b]);
  }
  const wobble = (a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const steps = Math.max(2, Math.round(len / 2));
    const amp = Math.min(6, len * 0.18) * rng.float(0.5, 1);
    const freq = rng.float(0.8, 2.2);
    const phase = rng.float(0, Math.PI * 2);
    const pts: [number, number][] = [];
    let jitter = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      jitter = Math.max(-1.5, Math.min(1.5, jitter + rng.float(-0.6, 0.6)));
      const off = Math.sin(t * Math.PI) * (amp * Math.sin(t * Math.PI * 2 * freq + phase) + jitter);
      pts.push([Math.round(a.x + dx * t + nx * off), Math.round(a.y + dy * t + ny * off)]);
    }
    return pts;
  };
  for (const [i, j] of edges) if (i !== j) trails.push({ points: wobble(clearings[i], clearings[j]), width: rng.bool(0.2) ? 3 : 2 });

  // ---- rasterize trails ----------------------------------------------------------------------
  const trail = new Uint8Array(N);
  const stamp = (mask: Uint8Array, x: number, y: number, r: number) => {
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++)
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++)
        if (inMap(xx, yy) && (xx - x) ** 2 + (yy - y) ** 2 <= r * r + 0.5) mask[idx(xx, yy)] = 1;
  };
  // Stamped thin: terrain smoothing fills diagonal staircases, so a wobbly
  // 1-cell core already renders about two tiles wide.
  const strokeTrail = (t: { points: [number, number][]; width: number }) => {
    const r = t.width >= 3 ? 1 : 0.4;
    for (let i = 0; i < t.points.length - 1; i++) {
      const [x0, y0] = t.points[i];
      const [x1, y1] = t.points[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) stamp(trail, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), r);
    }
  };
  trails.forEach(strokeTrail);

  // ---- hidden glades ---------------------------------------------------------------------------
  const nearTrail = (x0: number, y0: number, x1: number, y1: number, pad = 3) => {
    for (let x = Math.min(x0, x1) - pad; x <= Math.max(x0, x1) + pad; x++) for (let y = Math.min(y0, y1) - pad; y <= Math.max(y0, y1) + pad; y++) if (inMap(x, y) && trail[idx(x, y)]) return true;
    return false;
  };
  const glades: ForestLayout["glades"] = [];
  const gladeZones: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let g = 0, tries = 0; g < rules.hiddenGlades && tries < 2000; tries++) {
    const c = { x: rng.int(9, cols - 10), y: rng.int(9, rows - 10), rx: 3, ry: 3 };
    if (!fits(c, 6)) continue;
    let near = clearings[0];
    for (const o of clearings) if (dist(o, c) < dist(near, c)) near = o;
    const fromAbove = near.y < c.y;
    const thicketY = fromAbove ? c.y - c.ry - 2 : c.y + c.ry + 2;
    if (Math.abs(near.y - c.y) < c.ry + 6) continue;
    if (nearTrail(c.x - c.rx, c.y - c.ry, c.x + c.rx, c.y + c.ry, 5)) continue;
    const zoneHit = (x0: number, y0: number, x1: number, y1: number) =>
      gladeZones.some((z) => Math.min(x0, x1) - 3 <= z.x1 && Math.max(x0, x1) + 3 >= z.x0 && Math.min(y0, y1) - 3 <= z.y1 && Math.max(y0, y1) + 3 >= z.y0);
    if (zoneHit(near.x, near.y, c.x, near.y) || zoneHit(c.x, near.y, c.x, c.y)) continue;
    gladeZones.push({ x0: c.x - c.rx - 4, y0: c.y - c.ry - 4, x1: c.x + c.rx + 4, y1: c.y + c.ry + 4 });
    clearings.push(c);
    const t = { points: [[near.x, near.y], [c.x, near.y], [c.x, c.y]] as [number, number][], width: 3 };
    trails.push(t);
    strokeTrail(t);
    glades.push({ clearing: c, thicket: { x: c.x, y: thicketY } });
    g++;
  }

  // ---- walkable space ------------------------------------------------------------------------
  const walk = new Uint8Array(N);
  const open = new Uint8Array(N);
  const inClearing = new Uint8Array(N);
  const noiseA = valueNoise(rng, cols, rows, 9);
  const noiseB = valueNoise(rng, cols, rows, 4);
  const border = 4;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = idx(x, y);
      if (trail[i]) {
        // Trails plus a tile of shoulder either side.
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(x + dx, y + dy) && x + dx > 0 && y + dy > 0 && x + dx < cols - 1 && y + dy < rows - 1) walk[idx(x + dx, y + dy)] = 1;
      }
      const edgeDist = Math.min(x, y, cols - 1 - x, rows - 1 - y);
      if (edgeDist < border) continue;
      const n = noiseA(x, y) * 0.75 + noiseB(x, y) * 0.25;
      if (n < rules.openness) {
        walk[i] = 1;
        open[i] = 1;
      }
    }
  for (const c of clearings)
    for (let y = c.y - c.ry; y <= c.y + c.ry; y++)
      for (let x = c.x - c.rx; x <= c.x + c.rx; x++) {
        if (!inMap(x, y)) continue;
        const d = ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2;
        if (d <= 1 + rng.float(-0.15, 0.1)) {
          walk[idx(x, y)] = 1;
          inClearing[idx(x, y)] = 1;
        }
      }
  // Seal each glade: dense growth all round, except the trail through the thicket.
  for (const g of glades) {
    const c = g.clearing;
    for (let y = c.y - c.ry - 5; y <= c.y + c.ry + 5; y++)
      for (let x = c.x - c.rx - 5; x <= c.x + c.rx + 5; x++) {
        if (!inMap(x, y)) continue;
        const inner = ((x - c.x) / (c.rx + 0.5)) ** 2 + ((y - c.y) / (c.ry + 0.5)) ** 2 <= 1;
        if (inner) continue;
        const approach = Math.abs(x - c.x) <= 2 && (g.thicket.y < c.y ? y < c.y : y > c.y) && trail[idx(x, y)];
        if (approach) {
          walk[idx(x, y)] = 1;
          continue;
        }
        walk[idx(x, y)] = 0;
        open[idx(x, y)] = 0;
      }
  }
  // Entrances cut through the border.
  for (const e of entrances)
    for (let d = -2; d <= 2; d++) {
      const x = e.entrance.side === "north" || e.entrance.side === "south" ? e.edge.x + d : e.edge.x;
      const y = e.entrance.side === "north" || e.entrance.side === "south" ? e.edge.y : e.edge.y + d;
      if (inMap(x, y)) walk[idx(x, y)] = 1;
    }

  // Grow over anything unreachable from the first way in.
  const seen = new Uint8Array(N);
  const q: number[] = [idx(entrances[0].inside.x, entrances[0].inside.y)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % cols;
    const y = (i - x) / cols;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (seen[j] || !walk[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  for (let i = 0; i < N; i++)
    if (walk[i] && !seen[i]) {
      walk[i] = 0;
      open[i] = 0;
    }
  for (let i = 0; i < N; i++) if (trail[i] || inClearing[i]) open[i] = 0;

  // ---- points of interest -----------------------------------------------------------------------
  const special = entranceCount + (rules.landmark ? 1 : 0);
  const openClearings = clearings.slice(special).filter((c) => !glades.some((g) => g.clearing === c) && c.rx >= 5 && walk[idx(c.x, c.y)]);
  const pois: ForestLayout["pois"] = [];
  const poiKinds = rng.shuffle(rules.pois);
  const taken = new Set<ForestClearing>();
  for (const kind of poiKinds.slice(0, Math.max(2, Math.min(5, Math.floor(openClearings.length / 2) + 1)))) {
    const c = openClearings.find((o) => !taken.has(o));
    if (!c) break;
    taken.add(c);
    pois.push({ kind, x: c.x, y: c.y });
  }

  // ---- resources: clusters ------------------------------------------------------------------------
  const used = new Uint8Array(N);
  const block = (x: number, y: number, r: number) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inMap(xx, yy)) used[idx(xx, yy)] = 1;
  };
  for (const p of pois) block(p.x, p.y, 3);
  for (const e of entrances) block(e.inside.x, e.inside.y, 2);
  for (const g of glades) block(g.thicket.x, g.thicket.y, 2);
  const nearTrailCell = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(x + dx, y + dy) && trail[idx(x + dx, y + dy)]) return true;
    return false;
  };
  const free = (x: number, y: number) => inMap(x, y) && walk[idx(x, y)] && !used[idx(x, y)] && !nearTrailCell(x, y) && walk[idx(x, y - 1)] && walk[idx(x, y + 1)];
  const table = rules.nodes.map((n) => ({ item: n.id, weight: n.weight * (n.skill ? 1 + ((skills[n.skill] ?? 1) - 1) * 0.05 : 1) }));
  const nodes: [string, number, number][] = [];
  const gladeCells = (x: number, y: number) => glades.some((g) => Math.abs(x - g.clearing.x) <= g.clearing.rx + 1 && Math.abs(y - g.clearing.y) <= g.clearing.ry + 1);
  for (let tries = 0; tries < rules.nodeCount * 30 && nodes.length < rules.nodeCount; tries++) {
    const cx = rng.int(5, cols - 6);
    const cy = rng.int(5, rows - 6);
    if (!free(cx, cy) || gladeCells(cx, cy)) continue;
    const kind = rng.weighted(table);
    // Groves and outcrops come in clumps; rare things alone.
    const rare = rules.nodes.find((n) => n.id === kind)!.weight < 1.5;
    const size = rare ? 1 : rng.int(2, rules.clusterMax);
    let placed = 0;
    for (let k = 0; k < size * 8 && placed < size && nodes.length < rules.nodeCount; k++) {
      const x = placed === 0 ? cx : cx + rng.int(-3, 3);
      const y = placed === 0 ? cy : cy + rng.int(-2, 2);
      if (!free(x, y) || gladeCells(x, y)) continue;
      nodes.push([kind, x, y]);
      block(x, y, 1);
      placed++;
    }
  }
  for (const g of glades)
    for (let i = 0, t = 0; i < 3 && t < 60; t++) {
      const x = rng.int(g.clearing.x - g.clearing.rx + 1, g.clearing.x + g.clearing.rx - 1);
      const y = rng.int(g.clearing.y - g.clearing.ry + 1, g.clearing.y + g.clearing.ry - 1);
      if (!inMap(x, y) || !walk[idx(x, y)] || used[idx(x, y)] || trail[idx(x, y)]) continue;
      nodes.push([rng.pick(rules.hiddenNodes), x, y]);
      block(x, y, 1);
      i++;
    }

  // ---- scattered trunks in open woodland ---------------------------------------------------------
  const woodTrees: [number, number][] = [];
  for (let y = 2; y < rows - 2; y++)
    for (let x = 2; x < cols - 2; x++) {
      const i = idx(x, y);
      if (!open[i] || used[i] || nearTrailCell(x, y)) continue;
      // Denser near the thickets, sparse in the middle of a glade of woods.
      let edge = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMap(x + dx, y + dy) && !walk[idx(x + dx, y + dy)]) edge++;
      if (!rng.bool(0.05 + Math.min(0.12, edge * 0.02))) continue;
      woodTrees.push([x, y]);
      block(x, y, 1);
    }

  return { seed, cols, rows, trails, clearings, nodes, glades, pois, entrances, walk, trail, open, woodTrees };
}
