// Source pixel-art tiles are authored at 16px; we render at 2x for a crisp,
// comfortably sized viewport without blurring (nearest-neighbor scaling).
export const TILE_SIZE = 16;
export const RENDER_SCALE = 2;
export const TILE_DISPLAY = TILE_SIZE * RENDER_SCALE;

// Character sprite sheets use a 64x64 source canvas per frame with the
// character's feet sitting ~48px down (16px of empty padding below).
export const ENTITY_FRAME = 64;
export const ENTITY_ANCHOR_Y = 48 / ENTITY_FRAME;

export const PLAYER_MOVE_SPEED = 90; // px/sec at display scale
export const SAVE_KEY = "rpg-incremental-save";
export const SAVE_VERSION = 1;
