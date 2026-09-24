import type { AreaId } from "../game/core/types";

/**
 * The world beyond the screen: every region the map knows about, where it
 * sits, how it connects, and what opens it. The map (ui/panels/MapPanel)
 * and the gates in the world read this, so adding a region = one entry here
 * (+ its area builder once it's playable).
 *
 * Map coordinates are in map pixels on a 256×160 canvas (the map is drawn at
 * that size and scaled up with nearest-neighbour, so it's pixel art too).
 *
 * Status of a region for the player:
 *  - visited:  you've been there.
 *  - open:     you could go (the way is open), but haven't.
 *  - rumoured: you've heard of it; the way isn't open yet (shown as a "?").
 *  - hidden:   not on your map at all.
 */
export type RegionId =
  "wildkeep" | "home" | "tavern" | "old_mine" | "barrow" | "whisperwood" | "deepwood" | "crypt" | "ancient_grove" | "mirror_lake" | "tower_hill" | "greyfang" | "mirefen" | "ashen_hollow" | "saltmere";

export type RegionKind = "settlement" | "home" | "wilds" | "dungeon" | "landmark" | "frontier";

/** What the map needs to know about the player's progress (see game/world.ts). */
export interface WorldFacts {
  discoveries: string[];
  flags: Record<string, boolean>;
  level: number;
  dungeonDeepest: number;
  mineDeepest: number;
  questsDone: string[];
}

export interface RegionDef {
  id: RegionId;
  kind: RegionKind;
  icon: string;
  x: number;
  y: number;
  /** Areas that count as "being here" (for the you-are-here marker). */
  areas: string[];
  /** Road links drawn on the map (each pair drawn once). */
  links?: RegionId[];
  /** Is the way open? */
  open: (f: WorldFacts) => boolean;
  /** Have you been there? */
  visited: (f: WorldFacts) => boolean;
  /** Before it's open: do you at least know it exists? Default: always. */
  rumoured?: (f: WorldFacts) => boolean;
  /** Label size on the map. */
  major?: boolean;
  /** What you can do there (shown in the tooltip once you know the place). */
  tags?: RegionTag[];
}

export type RegionTag = "shop" | "rest" | "farm" | "gamble" | "gather" | "hunt" | "fish" | "fight" | "loot" | "mine" | "quests" | "magic" | "mystery";

const seen = (f: WorldFacts, key: string) => f.discoveries.includes(key);
const always = () => true;
const never = () => false;

export const REGIONS: RegionDef[] = [
  {
    id: "wildkeep",
    kind: "settlement",
    icon: "map_house",
    x: 118,
    y: 92,
    areas: ["town", "shop", "forge"],
    links: ["home", "tavern", "old_mine", "barrow", "whisperwood", "mirror_lake", "tower_hill"],
    tags: ["shop", "quests", "farm", "gamble"],
    open: always,
    visited: always,
    major: true,
  },
  { id: "home", kind: "home", icon: "house", x: 99, y: 97, areas: ["house"], tags: ["rest", "farm"], open: always, visited: always },
  { id: "tavern", kind: "settlement", icon: "map_tavern", x: 138, y: 86, areas: ["tavern"], tags: ["gamble", "quests"], open: always, visited: (f) => seen(f, "area:tavern") },
  {
    id: "old_mine",
    kind: "dungeon",
    icon: "map_mine",
    x: 118,
    y: 68,
    areas: ["mine"],
    links: ["greyfang"],
    tags: ["mine", "fight", "loot"],
    open: always,
    visited: (f) => seen(f, "area:mine") || f.mineDeepest > 0,
  },
  { id: "barrow", kind: "dungeon", icon: "map_portal", x: 100, y: 110, areas: [], tags: ["fight", "loot"], open: always, visited: (f) => f.dungeonDeepest > 0 },
  {
    id: "whisperwood",
    kind: "wilds",
    icon: "map_tree",
    x: 160,
    y: 94,
    areas: ["forest"],
    links: ["deepwood", "mirefen"],
    tags: ["gather", "hunt", "fight"],
    open: always,
    visited: (f) => seen(f, "area:forest"),
    major: true,
  },
  {
    id: "deepwood",
    kind: "wilds",
    icon: "map_bigtree",
    x: 178,
    y: 62,
    areas: ["deep_forest"],
    links: ["ancient_grove", "crypt"],
    tags: ["gather", "hunt", "fight"],
    open: always,
    visited: (f) => seen(f, "area:deep_forest"),
    rumoured: (f) => seen(f, "area:forest"),
    major: true,
  },
  {
    id: "crypt",
    kind: "dungeon",
    icon: "map_portal",
    x: 198,
    y: 72,
    areas: [],
    tags: ["fight", "loot"],
    open: (f) => seen(f, "area:deep_forest"),
    visited: (f) => seen(f, "crypt"),
    rumoured: (f) => seen(f, "area:deep_forest"),
  },
  {
    id: "ancient_grove",
    kind: "wilds",
    icon: "map_crystal",
    x: 190,
    y: 30,
    areas: ["ancient_grove"],
    tags: ["gather", "mystery"],
    open: (f) => !!f.flags.grove_path_cleared,
    visited: (f) => seen(f, "area:ancient_grove"),
    rumoured: (f) => seen(f, "area:deep_forest"),
  },
  {
    id: "mirror_lake",
    kind: "wilds",
    icon: "map_lake",
    x: 134,
    y: 128,
    areas: ["lake"],
    links: ["saltmere"],
    tags: ["fish", "gather"],
    open: always,
    visited: (f) => seen(f, "area:lake"),
  },
  {
    id: "tower_hill",
    kind: "landmark",
    icon: "map_tower",
    x: 70,
    y: 60,
    areas: ["tower_hill"],
    links: ["ashen_hollow"],
    tags: ["magic", "mystery"],
    open: always,
    visited: (f) => seen(f, "area:tower_hill"),
    major: true,
  },
  // The frontier: places people talk about. No road there — yet.
  { id: "greyfang", kind: "frontier", icon: "map_mountain", x: 122, y: 22, areas: [], open: never, visited: never },
  { id: "mirefen", kind: "frontier", icon: "map_camp", x: 222, y: 124, areas: [], open: never, visited: never },
  { id: "ashen_hollow", kind: "frontier", icon: "map_ruins", x: 34, y: 108, areas: [], open: never, visited: never, rumoured: (f) => f.level >= 3 || seen(f, "area:tower_hill") },
  { id: "saltmere", kind: "frontier", icon: "map_isle", x: 176, y: 148, areas: [], open: never, visited: never, rumoured: (f) => seen(f, "area:lake") },
];

export const REGION_BY_ID: Record<RegionId, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

export type RegionStatus = "visited" | "open" | "rumoured" | "hidden";

export function regionStatus(r: RegionDef, f: WorldFacts): RegionStatus {
  if (r.visited(f)) return "visited";
  if (r.open(f)) return "open";
  if (!r.rumoured || r.rumoured(f)) return "rumoured";
  return "hidden";
}

/** Which region an area (and, for dungeons, its entrance) belongs to. */
export function regionOfArea(area: AreaId, dungeonSurface?: string): RegionId {
  if (area === "dungeon") return dungeonSurface === "deep_forest" ? "crypt" : "barrow";
  return REGIONS.find((r) => r.areas.includes(area))?.id ?? "wildkeep";
}
