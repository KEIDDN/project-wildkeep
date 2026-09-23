// Hand-picked flat-fill tile coordinates (in 16px tile units) within each
// source tileset. These sheets are full Wang/blob auto-tile sets; V0.1 only
// uses their solid interior tiles for simple flat ground. Swapping in real
// edge auto-tiling later is additive — it doesn't require touching callers.
export const TILE_ATLAS = {
  floors: {
    sheet: "/sprites/tiles/floors.png",
    grass: { x: 2, y: 11 },
    dirtPath: { x: 12, y: 11 },
    cobble: { x: 7, y: 11 },
  },
  walls: {
    sheet: "/sprites/tiles/walls.png",
    fill: { x: 8, y: 2 },
  },
} as const;
