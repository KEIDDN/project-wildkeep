import { Container, Sprite } from "pixi.js";
import { loadTexture, loadTile } from "../AssetManager";
import { buildFlatGround } from "../TileLayer";
import { TILE_ATLAS } from "../tileAtlas";
import { TILE_DISPLAY } from "../../../game/core/constants";
import { SeededRandom } from "../../../game/core/rng";
import { RESOURCE_NODES } from "../../../data/resourceNodes";
import type { Interactable, WorldSceneHandle } from "./sceneTypes";

const FOREST_TILES_WIDE = 26;
const FOREST_TILES_HIGH = 18;

// Source art varies wildly in native size per node type (a full tree prop
// vs. a small ore-chunk icon), so each gets its own display scale rather
// than one constant.
const NODE_SCALE: Record<string, number> = {
  tree: 0.65,
  rock: 1.6,
  ore_vein: 1.6,
  herb_patch: 1.6,
};

export interface ForestNodeState {
  defId: string;
  depleted: boolean;
  respawnAt: number;
  sprite: Sprite;
}

const LAYOUT: { defId: string; tx: number; ty: number }[] = [
  { defId: "tree", tx: 3, ty: 3 },
  { defId: "tree", tx: 6, ty: 2 },
  { defId: "tree", tx: 9, ty: 4 },
  { defId: "tree", tx: 4, ty: 8 },
  { defId: "tree", tx: 21, ty: 3 },
  { defId: "tree", tx: 18, ty: 6 },
  { defId: "rock", tx: 8, ty: 10 },
  { defId: "rock", tx: 14, ty: 12 },
  { defId: "rock", tx: 20, ty: 10 },
  { defId: "ore_vein", tx: 16, ty: 4 },
  { defId: "ore_vein", tx: 22, ty: 13 },
  { defId: "herb_patch", tx: 11, ty: 8 },
  { defId: "herb_patch", tx: 6, ty: 13 },
  { defId: "herb_patch", tx: 17, ty: 9 },
];

export async function createForestScene(): Promise<
  WorldSceneHandle & { nodeStates: ForestNodeState[] }
> {
  const container = new Container();
  const rng = SeededRandom.fromString("forest-v1");

  const grassTex = await loadTile(
    TILE_ATLAS.floors.sheet,
    TILE_ATLAS.floors.grass.x,
    TILE_ATLAS.floors.grass.y,
  );
  container.addChild(buildFlatGround(FOREST_TILES_WIDE, FOREST_TILES_HIGH, grassTex));

  const interactables: Interactable[] = [];
  const nodeStates: ForestNodeState[] = [];

  for (const placement of LAYOUT) {
    const def = RESOURCE_NODES[placement.defId];
    const tex = await loadTexture(def.sprite);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.85);
    sprite.scale.set(NODE_SCALE[def.id] ?? 1);
    const jitterX = rng.int(-6, 6);
    const jitterY = rng.int(-6, 6);
    const px = placement.tx * TILE_DISPLAY + jitterX;
    const py = placement.ty * TILE_DISPLAY + jitterY;
    sprite.position.set(px, py);
    container.addChild(sprite);

    nodeStates.push({ defId: def.id, depleted: false, respawnAt: 0, sprite });
    interactables.push({
      id: `node-${placement.defId}-${placement.tx}-${placement.ty}`,
      x: px,
      y: py,
      radius: 36,
      kind: "resourceNode",
      label: `Gather ${def.name}`,
      data: { def, state: nodeStates[nodeStates.length - 1] },
    });
  }

  const widthPx = FOREST_TILES_WIDE * TILE_DISPLAY;
  const heightPx = FOREST_TILES_HIGH * TILE_DISPLAY;

  return {
    container,
    widthPx,
    heightPx,
    isWalkable: (x, y) => x >= 8 && y >= 8 && x <= widthPx - 8 && y <= heightPx - 8,
    interactables,
    nodeStates,
    update: (_deltaSec) => {
      const now = performance.now();
      for (const node of nodeStates) {
        if (node.depleted && now >= node.respawnAt) {
          node.depleted = false;
          node.sprite.alpha = 1;
        }
      }
    },
    destroy: () => container.destroy({ children: true }),
  };
}
