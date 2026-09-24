// World units are source pixels: one tile is 16 world units, and the camera
// applies a single integer zoom to everything so pixel art stays crisp and
// every asset pack shares the same pixel grid.
export const TILE = 16;

// The camera picks the largest integer zoom that still shows roughly this
// much of the world, so bigger monitors see a bit more rather than blurrier art.
export const TARGET_VIEW_W = 480;
export const TARGET_VIEW_H = 280;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 6;

export const PLAYER_WALK_SPEED = 78; // world px / sec
export const PLAYER_RUN_SPEED = 118;

// Feet collider (world px). Characters collide by their feet, not their
// sprite, which is what makes walking "behind" things read correctly.
export const PLAYER_COLLIDER = { w: 10, h: 6 };

export const INTERACT_RANGE = 22;

export const SAVE_KEY = "wildkeep-save";
export const LEGACY_SAVE_KEY = "rpg-incremental-save";
export const SETTINGS_KEY = "wildkeep-settings";
export const SAVE_VERSION = 6;

/** Font stack for in-world text (Pixi). "WK Digits" only covers numerals
 * (see index.css), so numbers read clearly and letters stay Pixelify. */
export const WORLD_FONT = ["WK Digits", "Pixelify Sans", "monospace"];
