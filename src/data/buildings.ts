export type BuildingKind =
  | "house"
  | "store"
  | "blacksmith"
  | "dungeon_gate"
  | "forest_path";

export interface BuildingDef {
  id: string;
  kind: BuildingKind;
  name: string;
  sprite: string;
  spriteScale: number;
  position: { x: number; y: number }; // tile coords in the town scene
  interactRadius: number; // px
  promptLabel: string;
}

export const TOWN_BUILDINGS: BuildingDef[] = [
  {
    id: "player_house",
    kind: "house",
    name: "Your Tent",
    sprite: "/icons/tent.png",
    spriteScale: 3,
    position: { x: 3, y: 4 },
    interactRadius: 40,
    promptLabel: "Enter Tent",
  },
  {
    id: "general_store",
    kind: "store",
    name: "General Store",
    sprite: "/sprites/stations/store_counter.png",
    spriteScale: 1.6,
    position: { x: 9, y: 3 },
    interactRadius: 44,
    promptLabel: "Visit Store",
  },
  {
    id: "blacksmith",
    kind: "blacksmith",
    name: "Blacksmith",
    sprite: "/sprites/stations/anvil_single.png",
    spriteScale: 1.3,
    position: { x: 14, y: 4 },
    interactRadius: 44,
    promptLabel: "Visit Blacksmith",
  },
  {
    id: "dungeon_gate",
    kind: "dungeon_gate",
    name: "Dungeon Entrance",
    sprite: "/sprites/stations/campfire.png",
    spriteScale: 2.2,
    position: { x: 19, y: 7 },
    interactRadius: 44,
    promptLabel: "Enter Dungeon",
  },
  {
    id: "forest_path",
    kind: "forest_path",
    name: "Forest Path",
    sprite: "/sprites/props/tree_02.png",
    spriteScale: 0.5,
    position: { x: 1, y: 9 },
    interactRadius: 44,
    promptLabel: "Go to Forest",
  },
];
