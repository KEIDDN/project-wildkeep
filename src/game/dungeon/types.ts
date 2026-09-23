export type TileType = "floor" | "wall";

export type RoomType =
  | "entrance"
  | "combat"
  | "treasure"
  | "event"
  | "boss";

export interface DungeonEnemyInstance {
  instanceId: string;
  enemyDefId: string;
  tileX: number;
  tileY: number;
  isElite: boolean;
  defeated: boolean;
  currentHp: number;
}

export interface DungeonChest {
  instanceId: string;
  tileX: number;
  tileY: number;
  opened: boolean;
  isRare: boolean;
}

export interface DungeonRoomData {
  id: string;
  type: RoomType;
  gridX: number;
  gridY: number;
  tileOriginX: number;
  tileOriginY: number;
  width: number;
  height: number;
  enemies: DungeonEnemyInstance[];
  chest?: DungeonChest;
  cleared: boolean;
}

export interface DungeonData {
  seed: string;
  tier: number;
  width: number;
  height: number;
  tileGrid: TileType[][];
  rooms: DungeonRoomData[];
  entranceTile: { x: number; y: number };
  bossRoomId: string;
}
