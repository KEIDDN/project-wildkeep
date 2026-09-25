import { useEffect, useRef } from "react";
import { useDungeonStore } from "../../store/dungeonStore";
import { isFloor } from "../../game/dungeon/types";
import { useAvoidPlayer } from "../hooks/useAvoidPlayer";

const CELL = 3;
const REVEAL = 6;

/**
 * Dungeon minimap with fog of war: tiles near where you've walked and every
 * room you've entered are revealed. Entrance (blue), exit gate (red / gold
 * when open) and unopened chests (yellow) show once seen — so you always
 * know where you came from and where you're going.
 */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const seen = useRef<{ seed: string | null; cells: Set<number> }>({ seed: null, cells: new Set() });
  const dungeon = useDungeonStore((s) => s.dungeon);
  const playerTile = useDungeonStore((s) => s.playerTile);
  const explored = useDungeonStore((s) => s.exploredRooms);
  const opened = useDungeonStore((s) => s.openedChests);
  const bossDefeated = useDungeonStore((s) => s.guardianDefeated);

  useEffect(() => {
    const canvas = canvasRef.current;
    const d = dungeon;
    if (!canvas || !d) return;
    const s = seen.current;
    if (s.seed !== d.seed) {
      s.seed = d.seed;
      s.cells = new Set();
    }
    for (let dy = -REVEAL; dy <= REVEAL; dy++)
      for (let dx = -REVEAL; dx <= REVEAL; dx++) {
        if (dx * dx + dy * dy > REVEAL * REVEAL) continue;
        const x = playerTile.x + dx;
        const y = playerTile.y + dy;
        if (x >= 0 && y >= 0 && x < d.width && y < d.height) s.cells.add(y * d.width + x);
      }
    for (const id of explored) {
      const r = d.rooms[id];
      for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) s.cells.add(y * d.width + x);
    }

    canvas.width = d.width * CELL;
    canvas.height = d.height * CELL;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const idx of s.cells) {
      const x = idx % d.width;
      const y = Math.floor(idx / d.width);
      if (!isFloor(d, x, y)) continue;
      ctx.fillStyle = "#8d8aa0";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
    const mark = (x: number, y: number, color: string, size = CELL * 2) => {
      if (!s.cells.has(y * d.width + x)) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * CELL + CELL / 2 - size / 2, y * CELL + CELL / 2 - size / 2, size, size);
    };
    mark(d.entranceDoor.x, d.entranceDoor.y + 1, "#5fb4ff", CELL * 2.5);
    mark(d.exitDoor.x, d.exitDoor.y + 1, bossDefeated ? "#ffd54f" : "#e0453a", CELL * 2.5);
    for (const c of d.chests) if (!opened.includes(c.id)) mark(c.x, c.y, c.rare ? "#ffb23e" : "#f1e0a0");
    for (const f of d.fountains) mark(f.x, f.y + 1, "#7fe0ff");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(playerTile.x * CELL - 1, playerTile.y * CELL - 1, CELL + 2, CELL + 2);
    ctx.fillStyle = "#3dff7a";
    ctx.fillRect(playerTile.x * CELL, playerTile.y * CELL, CELL, CELL);
  }, [dungeon, playerTile, explored, opened, bossDefeated]);

  // Near a map corner the camera stops and the player can walk under it.
  const avoid = useAvoidPlayer(boxRef, !!dungeon);
  if (!dungeon) return null;
  return (
    <div className={`minimap${avoid ? " avoid" : ""}`} ref={boxRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
