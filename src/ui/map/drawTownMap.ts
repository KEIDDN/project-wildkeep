import { TOWN_COLS, TOWN_ROWS, TOWN_SHAPES, type TownGround } from "../../data/townMap";

/** Pixels per town tile on the plan canvas. */
export const TOWN_PX = 3;

const GROUND: Record<TownGround, [number, number, number]> = {
  street: [176, 136, 92],
  plaza: [168, 160, 150],
  soil: [122, 84, 56],
  water: [104, 150, 176],
  yard: [160, 140, 104],
};

/** Wildkeep from above: grass, cliffs, tree line, streets and roofs. */
export function drawTownMap(ctx: CanvasRenderingContext2D): void {
  const W = TOWN_COLS * TOWN_PX;
  const H = TOWN_ROWS * TOWN_PX;
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const put = (x: number, y: number, c: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  const tile = (tx: number, ty: number, c: [number, number, number]) => {
    for (let y = 0; y < TOWN_PX; y++) for (let x = 0; x < TOWN_PX; x++) put(tx * TOWN_PX + x, ty * TOWN_PX + y, c);
  };
  let seed = 11;
  const r = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let ty = 0; ty < TOWN_ROWS; ty++)
    for (let tx = 0; tx < TOWN_COLS; tx++) {
      // Cliffs along the top, the tree line around the edges.
      if (ty < 5) tile(tx, ty, ty === 4 ? [104, 86, 72] : [128, 110, 92]);
      else if ((ty >= TOWN_ROWS - 4 && (tx < 27 || tx > 31)) || (tx < 2 && (ty < 17 || ty > 19)) || (tx >= TOWN_COLS - 2 && (ty < 17 || ty > 19))) tile(tx, ty, r() < 0.5 ? [72, 110, 60] : [58, 94, 52]);
      else tile(tx, ty, r() < 0.12 ? [150, 168, 96] : [166, 180, 108]);
    }
  for (const s of TOWN_SHAPES) {
    if (s.kind !== "ground") continue;
    const c = GROUND[s.ground!];
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) tile(x, y, c);
  }
  // Tilled rows in the garden.
  for (let y = 22; y < 28; y += 2) for (let x = 4; x < 13; x++) tile(x, y, [98, 66, 44]);
  for (const s of TOWN_SHAPES) {
    if (s.kind !== "building") continue;
    const roof = s.roof ?? 0x7a4a3a;
    const c: [number, number, number] = [(roof >> 16) & 255, (roof >> 8) & 255, roof & 255];
    const dark: [number, number, number] = [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7];
    for (let y = s.y * TOWN_PX; y < (s.y + s.h) * TOWN_PX; y++)
      for (let x = s.x * TOWN_PX; x < (s.x + s.w) * TOWN_PX; x++) {
        const edge = x === s.x * TOWN_PX || y === s.y * TOWN_PX || x === (s.x + s.w) * TOWN_PX - 1 || y === (s.y + s.h) * TOWN_PX - 1;
        // Roof ridges: every other row a shade darker.
        put(x, y, edge ? [58, 36, 32] : (y - s.y * TOWN_PX) % 3 === 2 ? dark : c);
      }
  }
  ctx.putImageData(img, 0, 0);
}
