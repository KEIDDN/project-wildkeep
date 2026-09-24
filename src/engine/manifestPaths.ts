import { ASSETS, TILESETS, animPath, animalPath, buildingGlowPath, buildingPath, characterPath, icon16Path, interiorPath, propPath } from "../data/assets";
import { ITEMS } from "../data/items";
import { PLAYER_SHEET_PATHS } from "./entities/Player";
import { VILLAGER_SHEET_PATHS } from "./entities/villager";

/** Every texture the world renderer can use, derived from the manifest. */
export function allAssetPaths(): string[] {
  const paths: string[] = [...Object.values(TILESETS), ...PLAYER_SHEET_PATHS, ...VILLAGER_SHEET_PATHS];
  for (const id of Object.keys(ASSETS.props)) paths.push(propPath(id));
  for (const id of Object.keys(ASSETS.anims)) paths.push(animPath(id));
  for (const [id, meta] of Object.entries(ASSETS.buildings)) {
    paths.push(buildingPath(id));
    if (meta.glow) paths.push(buildingGlowPath(id));
  }
  for (const [id, anims] of Object.entries(ASSETS.characters)) for (const a of Object.keys(anims)) paths.push(characterPath(id, a));
  for (const [id, meta] of Object.entries(ASSETS.interiors)) {
    paths.push(interiorPath(id));
    if (meta.overlay) paths.push(`/sprites/interiors/${id}_above.png`);
  }
  for (const id of Object.keys(ASSETS.animals ?? {})) paths.push(animalPath(id));
  for (const def of Object.values(ITEMS)) paths.push(icon16Path(def.icon));
  // World-sized icons used by props that aren't items (tip jar, purse…).
  for (const icon of ["gold_coin", "coin_bag", "glyph_shield", "watering_can", "hoe", "rod_wood", "bait_worm", "hide", "antler"]) paths.push(icon16Path(icon));
  return [...new Set(paths)];
}
