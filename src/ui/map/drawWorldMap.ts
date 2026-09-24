import { REGIONS, REGION_BY_ID, type RegionId, type RegionStatus } from "../../data/world";

/**
 * Paints the world map as pixel art on a small canvas (MAP_W × MAP_H map
 * pixels; CSS scales it up with nearest-neighbour). Terrain is procedural
 * but seeded, so the map looks the same every time; roads and fog depend on
 * what the player has found.
 */
export const MAP_W = 256;
export const MAP_H = 160;

type RGB = [number, number, number];

const C = {
  paper: [226, 196, 150] as RGB,
  paperDark: [198, 162, 112] as RGB,
  ink: [92, 58, 40] as RGB,
  grass: [176, 186, 118] as RGB,
  grassDark: [150, 164, 98] as RGB,
  tree: [78, 116, 62] as RGB,
  treeDark: [50, 82, 50] as RGB,
  deep: [40, 66, 52] as RGB,
  grove: [70, 140, 120] as RGB,
  rock: [150, 136, 118] as RGB,
  rockDark: [104, 90, 80] as RGB,
  snow: [240, 236, 226] as RGB,
  water: [104, 150, 176] as RGB,
  waterDeep: [74, 116, 150] as RGB,
  waterLight: [160, 196, 206] as RGB,
  swamp: [110, 124, 84] as RGB,
  road: [140, 100, 66] as RGB,
  roadFaint: [178, 146, 110] as RGB,
  fog: [214, 186, 142] as RGB,
  cliff: [128, 104, 86] as RGB,
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth-ish value noise for coastlines and forest edges. */
function makeNoise(seed: number) {
  const r = rng(seed);
  const G = 17;
  const grid = Array.from({ length: G * G }, () => r());
  const at = (x: number, y: number) => grid[((y % G) + G) % G * G + (((x % G) + G) % G)];
  return (x: number, y: number, scale: number) => {
    const fx = x / scale;
    const fy = y / scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Terrain type per map pixel (computed once, cached). */
type Terrain = "grass" | "forest" | "deep" | "grove" | "mountain" | "water" | "sea" | "swamp" | "cliff" | "ruins" | "hill";

let terrainCache: Terrain[] | null = null;

function terrain(): Terrain[] {
  if (terrainCache) return terrainCache;
  const n = makeNoise(7);
  const n2 = makeNoise(21);
  const out: Terrain[] = Array.from({ length: MAP_W * MAP_H });
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const v = n(x, y, 14) * 0.7 + n2(x, y, 5) * 0.3;
      let t: Terrain = "grass";
      // Mountains along the north (Greyfang), a ridge edge that wobbles.
      if (y < 30 + v * 16 && !(x > 160 && y > 14)) t = "mountain";
      // The cliffs above Wildkeep, with the mine road cut through them.
      else if (y >= 72 && y <= 75 && x > 88 && x < 150 && Math.abs(x - 118) > 3) t = "cliff";
      // Forests: the east (Whisperwood → Deepwood), the grove at the top.
      else if (x > 142 && y > 36 && y < 116 && v > 0.32) t = y < 80 && x > 158 ? "deep" : "forest";
      else if (x > 168 && y <= 44 && v > 0.3) t = "grove";
      // Woods on the western hills around the tower.
      else if (x < 92 && y > 34 && y < 100 && v > 0.52) t = "forest";
      else if (x > 52 && x < 92 && y > 42 && y < 76 && v > 0.36) t = "hill";
      // Mirror Lake and the sea to the south-east (Saltmere).
      else if (((x - 134) / 17) ** 2 + ((y - 130) / 9) ** 2 < 1 + (v - 0.5) * 0.6) t = "water";
      else if (y > 146 - (x - 150) * 0.25 + v * 8 && x > 120) t = "sea";
      // Mirefen marsh.
      else if (((x - 222) / 26) ** 2 + ((y - 126) / 16) ** 2 < 1 + (v - 0.5)) t = "swamp";
      // Ashen Hollow: the burnt village to the west.
      else if (((x - 34) / 16) ** 2 + ((y - 108) / 10) ** 2 < 1 && v > 0.4) t = "ruins";
      else if (x < 70 && y > 118 && v > 0.45) t = "forest";
      out[y * MAP_W + x] = t;
    }
  terrainCache = out;
  return out;
}

/** A little river from the lake down to the sea. */
const RIVER: [number, number][] = [
  [150, 132],
  [160, 138],
  [166, 146],
  [172, 156],
];

export interface MapDrawInput {
  status: Record<RegionId, RegionStatus>;
  /** Frame counter for water shimmer (redraws are cheap). */
  frame: number;
}

export function drawWorldMap(ctx: CanvasRenderingContext2D, input: MapDrawInput): void {
  const img = ctx.createImageData(MAP_W, MAP_H);
  const px = img.data;
  const ter = terrain();
  const r = rng(99);
  const put = (x: number, y: number, c: RGB, a = 1) => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    const i = (y * MAP_W + x) * 4;
    px[i] = px[i] * (1 - a) + c[0] * a;
    px[i + 1] = px[i + 1] * (1 - a) + c[1] * a;
    px[i + 2] = px[i + 2] * (1 - a) + c[2] * a;
    px[i + 3] = 255;
  };
  const tAt = (x: number, y: number): Terrain => ter[Math.max(0, Math.min(MAP_H - 1, y)) * MAP_W + Math.max(0, Math.min(MAP_W - 1, x))];

  // 1. Ground colours.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = tAt(x, y);
      const speck = r() < 0.08;
      let c: RGB;
      switch (t) {
        case "water":
          c = (x + y * 3 + Math.floor(input.frame / 8)) % 23 === 0 ? C.waterLight : C.water;
          break;
        case "sea":
          c = (x * 2 + y + Math.floor(input.frame / 10)) % 29 === 0 ? C.waterLight : y > 152 ? C.waterDeep : C.water;
          break;
        case "swamp":
          c = speck ? C.treeDark : (x + y) % 5 === 0 ? C.water : C.swamp;
          break;
        case "mountain":
          c = speck ? C.rockDark : C.rock;
          break;
        case "cliff":
          c = C.cliff;
          break;
        case "ruins":
          c = speck ? C.rockDark : C.grassDark;
          break;
        case "hill":
          c = speck ? C.grass : C.grassDark;
          break;
        default:
          c = speck ? C.grassDark : C.grass;
      }
      put(x, y, c);
    }

  // 2. Shorelines: a darker edge where water meets land.
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const t = tAt(x, y);
      if (t !== "water" && t !== "sea") continue;
      const edge = [tAt(x - 1, y), tAt(x + 1, y), tAt(x, y - 1), tAt(x, y + 1)].some((n) => n !== "water" && n !== "sea");
      if (edge) put(x, y, C.waterDeep);
    }
  for (let i = 0; i < RIVER.length - 1; i++) line(RIVER[i], RIVER[i + 1], (x, y) => {
    put(x, y, C.water);
    put(x + 1, y, C.water);
  });

  // 3. Trees and peaks as little glyphs on a grid (so they read as pixel art).
  for (let y = 2; y < MAP_H; y += 4)
    for (let x = (y / 4) % 2 ? 2 : 4; x < MAP_W; x += 5) {
      const jx = x + Math.floor(r() * 2);
      const jy = y + Math.floor(r() * 2);
      const t = tAt(jx, jy);
      if (t === "forest" || t === "deep" || t === "grove") {
        const leaf = t === "deep" ? C.deep : t === "grove" ? C.grove : C.tree;
        const dark = t === "grove" ? C.deep : C.treeDark;
        // A 3×4 pine-ish blob: top pixel, wider middle, trunk.
        put(jx, jy - 2, leaf);
        put(jx - 1, jy - 1, leaf);
        put(jx, jy - 1, leaf);
        put(jx + 1, jy - 1, dark);
        put(jx - 1, jy, dark);
        put(jx, jy, leaf);
        put(jx + 1, jy, dark);
        put(jx, jy + 1, C.ink, 0.7);
      }
    }
  for (let y = 6; y < 44; y += 7)
    for (let x = (y / 7) % 2 ? 3 : 7; x < MAP_W; x += 9) {
      const jx = x + Math.floor(r() * 3);
      const jy = y + Math.floor(r() * 3);
      if (tAt(jx, jy) !== "mountain" || tAt(jx, jy + 3) !== "mountain") continue;
      // A peak: triangle with a sunlit left face and snow cap.
      for (let k = 0; k < 5; k++)
        for (let d = -k; d <= k; d++) put(jx + d, jy - 4 + k, d < 0 ? C.rock : C.rockDark);
      put(jx, jy - 4, C.snow);
      put(jx - 1, jy - 3, C.snow);
      put(jx, jy - 3, C.snow);
    }
  // Ruins: broken walls.
  for (const [x, y] of [
    [28, 104],
    [34, 110],
    [40, 105],
    [31, 113],
  ]) {
    put(x, y, C.rockDark);
    put(x + 1, y, C.rockDark);
    put(x + 2, y, C.rockDark);
    put(x, y - 1, C.rockDark);
    put(x + 2, y - 2, C.rockDark);
  }

  // 4. Roads between known places (faint dashes towards rumoured ones).
  const drawn = new Set<string>();
  for (const a of REGIONS) {
    for (const bId of a.links ?? []) {
      const b = REGION_BY_ID[bId];
      const key = [a.id, b.id].sort().join("|");
      if (drawn.has(key)) continue;
      drawn.add(key);
      const sa = input.status[a.id];
      const sb = input.status[b.id];
      if (sa === "hidden" || sb === "hidden") continue;
      const known = (sa === "visited" || sa === "open") && (sb === "visited" || sb === "open");
      let i = 0;
      // Roads wiggle a little, like they were drawn by hand.
      const mx = (a.x + b.x) / 2 + (((a.x * 7 + b.y * 3) % 7) - 3);
      const my = (a.y + b.y) / 2 + (((a.y * 5 + b.x) % 7) - 3);
      const seg = (p: [number, number], q: [number, number]) =>
        line(p, q, (x, y) => {
          i++;
          if (known ? i % 4 !== 0 : i % 4 < 2) put(x, y, known ? C.road : C.roadFaint, known ? 1 : 0.8);
        });
      seg([a.x, a.y], [Math.round(mx), Math.round(my)]);
      seg([Math.round(mx), Math.round(my)], [b.x, b.y]);
    }
  }

  // 5. Fog of war: parchment over everything far from what you know.
  const lit = REGIONS.filter((reg) => input.status[reg.id] === "visited" || input.status[reg.id] === "open").map((reg) => ({ x: reg.x, y: reg.y, r: reg.major ? 34 : 24 }));
  const dim = REGIONS.filter((reg) => input.status[reg.id] === "rumoured").map((reg) => ({ x: reg.x, y: reg.y, r: 14 }));
  const fogN = makeNoise(5);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      let clear = 0;
      for (const l of lit) clear = Math.max(clear, 1 - Math.hypot(x - l.x, y - l.y) / l.r);
      for (const l of dim) clear = Math.max(clear, (1 - Math.hypot(x - l.x, y - l.y) / l.r) * 0.55);
      const edge = clear + (fogN(x, y, 6) - 0.5) * 0.35;
      if (edge < 0.15) {
        // Unknown land: the shapes still show through, washed out like an
        // old survey, with a light hatch — you can see there's more world.
        put(x, y, C.fog, edge < 0 ? 0.74 : 0.62);
        if ((x + y) % 6 === 0) put(x, y, C.paperDark, 0.45);
      } else if (edge < 0.3) put(x, y, C.fog, 0.4);
    }

  // 6. Paper frame: darker burnt edge.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const d = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (d < 2) put(x, y, C.ink, 0.9);
      else if (d < 5) put(x, y, C.paperDark, 0.5 - d * 0.08);
    }
  ctx.putImageData(img, 0, 0);
}

/** Bresenham between two points. */
function line(a: [number, number], b: [number, number], plot: (x: number, y: number) => void) {
  let [x0, y0] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
