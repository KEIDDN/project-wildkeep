import type { AreaId } from "../../game/core/types";
import type { Game } from "../Game";
import type { Area } from "./Area";
import { buildTown } from "./areas/town";
import { buildAncientGrove, buildDeepForest, buildForest } from "./areas/forests";
import { buildForge, buildHouse, buildShop, buildTavern } from "./areas/interiors";
import { buildDungeon } from "./areas/dungeon";
import { buildMine } from "./areas/mine";
import { buildLake } from "./areas/lake";
import { buildTowerHill } from "./areas/towerHill";

/** Area id -> builder. Adding a new area = one builder + one line here. */
const BUILDERS: Record<AreaId, (game: Game) => Area> = {
  town: buildTown,
  forest: buildForest,
  deep_forest: buildDeepForest,
  ancient_grove: buildAncientGrove,
  mine: buildMine,
  house: buildHouse,
  shop: buildShop,
  tavern: buildTavern,
  forge: buildForge,
  dungeon: buildDungeon,
  lake: buildLake,
  tower_hill: buildTowerHill,
};

export async function buildArea(id: AreaId, game: Game): Promise<Area> {
  return BUILDERS[id](game);
}
