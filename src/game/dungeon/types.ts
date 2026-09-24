import type { EnemyRank } from "../../data/enemies";

export type RoomType =
  | "entrance"
  | "combat"
  | "treasure"
  | "resource"
  | "shrine"
  | "boss"
  /** Spike traps guarding a chest. */
  | "trap"
  /** A campfire and a bedroll: rest once, recover. */
  | "rest"
  /** A goblin peddler who set up shop down here. Somehow. */
  | "merchant"
  /** Elites and a rare chest. */
  | "arena"
  /** Quiet hall: statues, shelves, something to read. */
  | "library"
  /** Hidden behind a cracked wall you have to break. */
  | "secret"
  /** Off-duty goblins playing dice. They'll let you join. */
  | "camp";

/** Things a room's renderer places beyond enemies/chests/nodes. */
export interface DungeonFeature extends TilePoint {
  kind: "spikes" | "campfire" | "bedroll" | "merchant" | "crack" | "lore" | "statue" | "pillar" | "bookcase" | "skull" | "goblin_player" | "dice_table";
  roomId: number;
  /** Variant / facing / index, depending on the kind. */
  n?: number;
}

/** Tile-space rectangle of a room's walkable floor. */
export interface DungeonRoom {
  id: number;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Index along the critical path (-1 for side rooms). */
  pathIndex: number;
}

export interface TilePoint {
  x: number;
  y: number;
}

export interface EnemySpawn extends TilePoint {
  id: string;
  defId: string;
  roomId: number;
  rank: EnemyRank;
  /** Holds the stairs down: killing it opens them. */
  guardian?: boolean;
}

export interface ChestSpawn extends TilePoint {
  id: string;
  roomId: number;
  rare: boolean;
  /** Boss-floor reward chest (special loot table). */
  bossReward?: boolean;
}

export interface NodeSpawn extends TilePoint {
  id: string;
  defId: string;
  roomId: number;
}

export type DecorKind =
  | "lantern"
  | "banner_red"
  | "banner_blue"
  | "banner_green"
  | "brazier"
  | "chain"
  | "coffin"
  | "tomb_arch"
  | "crates"
  | "barrel"
  | "coal_pile"
  | "rubble"
  | "pebble_a"
  | "stone_slab"
  | "blood"
  | "rug";

export interface DecorSpawn extends TilePoint {
  kind: DecorKind;
  /** Wall-mounted decor sits on the north wall face and has no collision. */
  wall?: boolean;
}

export interface DungeonData {
  seed: string;
  floor: number;
  width: number;
  height: number;
  /** Row-major; 1 = floor, 0 = wall/void. */
  grid: number[];
  rooms: DungeonRoom[];
  /** Arch in the entrance room's north wall — leads back to the surface. */
  entranceDoor: TilePoint;
  /** Player spawn just inside the entrance. */
  spawn: TilePoint;
  /** Stairs down in the last room's north wall; they open when the floor's
   * guardian (an elite, or the boss on every 5th floor) dies. */
  exitDoor: TilePoint;
  /** Healing fountain (shrine rooms), mounted on a north wall. */
  fountains: TilePoint[];
  enemies: EnemySpawn[];
  chests: ChestSpawn[];
  nodes: NodeSpawn[];
  decor: DecorSpawn[];
  features?: DungeonFeature[];
}

export function isFloor(d: DungeonData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= d.width || y >= d.height) return false;
  return d.grid[y * d.width + x] === 1;
}

export function roomAt(d: DungeonData, x: number, y: number): DungeonRoom | undefined {
  return d.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
