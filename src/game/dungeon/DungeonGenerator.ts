import { SeededRandom } from "../core/rng";
import { enemiesForTier } from "../../data/enemies";
import type {
  DungeonData,
  DungeonEnemyInstance,
  DungeonRoomData,
  RoomType,
  TileType,
} from "./types";

const ROOM_W = 11;
const ROOM_H = 9;
const GRID_W = 4;
const GRID_H = 3;
const DOOR_SPAN = 3;

interface Cell {
  gx: number;
  gy: number;
}

const key = (gx: number, gy: number) => `${gx},${gy}`;

/**
 * Deterministic dungeon layout: random-walk carves a connected set of rooms
 * across a coarse grid, then each cell is stamped into a tile grid with
 * door gaps toward its carved neighbors. Same seed -> identical dungeon.
 */
export function generateDungeon(seed: string, tier: number): DungeonData {
  const rng = SeededRandom.fromString(`${seed}:${tier}`);

  const start: Cell = { gx: 0, gy: Math.floor(GRID_H / 2) };
  const visited = new Map<string, Cell>();
  visited.set(key(start.gx, start.gy), start);
  const order: Cell[] = [start];

  const targetRooms = 7 + rng.int(0, 2);
  const frontier: Cell[] = [start];

  while (order.length < targetRooms && frontier.length > 0) {
    const idx = rng.int(0, frontier.length - 1);
    const cell = frontier[idx];
    const neighbors = shuffledNeighbors(cell, rng).filter(
      (n) =>
        n.gx >= 0 &&
        n.gx < GRID_W &&
        n.gy >= 0 &&
        n.gy < GRID_H &&
        !visited.has(key(n.gx, n.gy)),
    );
    if (neighbors.length === 0) {
      frontier.splice(idx, 1);
      continue;
    }
    const next = neighbors[0];
    visited.set(key(next.gx, next.gy), next);
    order.push(next);
    frontier.push(next);
    if (order.length >= targetRooms) break;
  }

  const connections = buildConnections(order, visited);

  // Boss room = the carved room furthest (by path order) from the entrance.
  const bossCell = order[order.length - 1];

  const width = GRID_W * ROOM_W;
  const height = GRID_H * ROOM_H;
  const tileGrid: TileType[][] = Array.from({ length: height }, () =>
    Array<TileType>(width).fill("wall"),
  );

  const rooms: DungeonRoomData[] = [];
  let enemyCounter = 0;
  let chestCounter = 0;

  const treasureCount = Math.max(1, Math.floor(order.length / 4));
  const nonEntranceRooms = order.slice(1).filter(
    (c) => !(c.gx === bossCell.gx && c.gy === bossCell.gy),
  );
  const shuffledOthers = rng.shuffle(nonEntranceRooms);
  const treasureCells = new Set(
    shuffledOthers.slice(0, treasureCount).map((c) => key(c.gx, c.gy)),
  );

  for (const cell of order) {
    const isStart = cell.gx === start.gx && cell.gy === start.gy;
    const isBoss = cell.gx === bossCell.gx && cell.gy === bossCell.gy;
    let type: RoomType = "combat";
    if (isStart) type = "entrance";
    else if (isBoss) type = "boss";
    else if (treasureCells.has(key(cell.gx, cell.gy))) type = "treasure";
    else if (rng.bool(0.2)) type = "event";

    const originX = cell.gx * ROOM_W;
    const originY = cell.gy * ROOM_H;
    carveRoom(tileGrid, originX, originY, ROOM_W, ROOM_H);

    const cellConnections = connections.get(key(cell.gx, cell.gy)) ?? [];
    for (const dir of cellConnections) {
      carveDoor(tileGrid, originX, originY, dir);
    }

    const room: DungeonRoomData = {
      id: key(cell.gx, cell.gy),
      type,
      gridX: cell.gx,
      gridY: cell.gy,
      tileOriginX: originX,
      tileOriginY: originY,
      width: ROOM_W,
      height: ROOM_H,
      enemies: [],
      cleared: type !== "combat" && type !== "boss",
    };

    if (type === "combat" || type === "boss") {
      const pool = enemiesForTier(tier);
      const count = type === "boss" ? 1 : rng.int(1, 3);
      const enemies: DungeonEnemyInstance[] = [];
      for (let i = 0; i < count; i++) {
        const def = rng.pick(pool);
        const spot = randomFloorSpot(rng, originX, originY);
        const isElite = type === "boss";
        enemies.push({
          instanceId: `enemy-${enemyCounter++}`,
          enemyDefId: def.id,
          tileX: spot.x,
          tileY: spot.y,
          isElite,
          defeated: false,
          currentHp: isElite ? Math.round(def.stats.maxHp * 2.2) : def.stats.maxHp,
        });
      }
      room.enemies = enemies;
    }

    if (type === "treasure") {
      const spot = randomFloorSpot(rng, originX, originY);
      room.chest = {
        instanceId: `chest-${chestCounter++}`,
        tileX: spot.x,
        tileY: spot.y,
        opened: false,
        isRare: rng.bool(0.25),
      };
    }

    rooms.push(room);
  }

  return {
    seed,
    tier,
    width,
    height,
    tileGrid,
    rooms,
    entranceTile: {
      x: start.gx * ROOM_W + Math.floor(ROOM_W / 2),
      y: start.gy * ROOM_H + Math.floor(ROOM_H / 2),
    },
    bossRoomId: key(bossCell.gx, bossCell.gy),
  };
}

function shuffledNeighbors(cell: Cell, rng: SeededRandom): Cell[] {
  const dirs = rng.shuffle([
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ]);
  return dirs.map((d) => ({ gx: cell.gx + d.dx, gy: cell.gy + d.dy }));
}

type Dir = "N" | "S" | "E" | "W";

function buildConnections(
  order: Cell[],
  visited: Map<string, Cell>,
): Map<string, Dir[]> {
  const conns = new Map<string, Dir[]>();
  const add = (a: string, dir: Dir) => {
    const list = conns.get(a) ?? [];
    list.push(dir);
    conns.set(a, list);
  };
  for (const cell of order) {
    const k = key(cell.gx, cell.gy);
    const right = key(cell.gx + 1, cell.gy);
    const left = key(cell.gx - 1, cell.gy);
    const down = key(cell.gx, cell.gy + 1);
    const up = key(cell.gx, cell.gy - 1);
    // Any two visited, grid-adjacent cells get a door: this keeps the
    // dungeon connected and occasionally adds a loop, which reads as
    // intentional rather than a maze-generation artifact.
    if (visited.has(right)) {
      add(k, "E");
      add(right, "W");
    }
    if (visited.has(left)) {
      add(k, "W");
      add(left, "E");
    }
    if (visited.has(down)) {
      add(k, "S");
      add(down, "N");
    }
    if (visited.has(up)) {
      add(k, "N");
      add(up, "S");
    }
  }
  // Dedup
  for (const [k, dirs] of conns) {
    conns.set(k, Array.from(new Set(dirs)));
  }
  return conns;
}

function carveRoom(
  grid: TileType[][],
  originX: number,
  originY: number,
  w: number,
  h: number,
) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      grid[originY + y][originX + x] = isBorder ? "wall" : "floor";
    }
  }
}

function carveDoor(
  grid: TileType[][],
  originX: number,
  originY: number,
  dir: Dir,
) {
  const midX = originX + Math.floor(ROOM_W / 2);
  const midY = originY + Math.floor(ROOM_H / 2);
  const half = Math.floor(DOOR_SPAN / 2);
  if (dir === "E") {
    for (let i = -half; i <= half; i++) grid[midY + i][originX + ROOM_W - 1] = "floor";
  } else if (dir === "W") {
    for (let i = -half; i <= half; i++) grid[midY + i][originX] = "floor";
  } else if (dir === "S") {
    for (let i = -half; i <= half; i++) grid[originY + ROOM_H - 1][midX + i] = "floor";
  } else if (dir === "N") {
    for (let i = -half; i <= half; i++) grid[originY][midX + i] = "floor";
  }
}

function randomFloorSpot(
  rng: SeededRandom,
  originX: number,
  originY: number,
): { x: number; y: number } {
  const x = originX + rng.int(2, ROOM_W - 3);
  const y = originY + rng.int(2, ROOM_H - 3);
  return { x, y };
}
