/**
 * The Old Mine goes down. Each floor is a freshly generated cave (new seed
 * every expedition); what grows in it is decided here by depth bands, so
 * adding a new ore is one line.
 *
 *   1-2   stone, coal            5-9    + copper (iron pickaxe)
 *   3-4   + iron                 10-14  + silver
 *   15-19 + gold (steel pickaxe) 20+    + mithril, crystal
 *
 * Every 5th floor has a lift stop: once reached, expeditions can start there.
 * Rats and bats move in from floor 2; spiders and the restless dead from
 * floor 6: better ore, more danger.
 */

export interface MineFloorProfile {
  floor: number;
  /** Weighted node table for this depth. */
  nodes: { id: string; weight: number }[];
  nodeCount: number;
  chambers: number;
  /** Rockfall traps. */
  hazards: number;
  hazardDamage: number;
  chestChance: number;
  chestTier: number;
  ambient: number;
  /** Rock palette: column of the cliff block to use, and a tint. */
  rockBlock: number;
  rockTint: number;
  name: string;
  /** Things that live down here (deeper floors only), and how tough they
   * are in dungeon-floor terms. */
  creatures: { count: number; kinds: string[]; level: number };
}

const BANDS: { from: number; name: string; nodes: Record<string, number>; rockBlock: number; rockTint: number }[] = [
  { from: 1, name: "Upper Galleries", nodes: { cave_rock: 6, coal_vein: 3 }, rockBlock: 12, rockTint: 0x8a7a70 },
  { from: 3, name: "Upper Galleries", nodes: { cave_rock: 5, coal_vein: 3, iron_vein: 3 }, rockBlock: 12, rockTint: 0x8a7a70 },
  { from: 5, name: "Copper Seams", nodes: { cave_rock: 4, coal_vein: 2, iron_vein: 3, copper_vein: 4 }, rockBlock: 12, rockTint: 0x7a6a60 },
  { from: 10, name: "Silver Deeps", nodes: { cave_rock: 3, coal_vein: 2, iron_vein: 2, copper_vein: 2, silver_vein: 4, crystal: 1 }, rockBlock: 6, rockTint: 0x7a8088 },
  { from: 15, name: "Golden Veins", nodes: { cave_rock: 2, iron_vein: 1, silver_vein: 3, gold_vein: 3, crystal: 2 }, rockBlock: 6, rockTint: 0x606870 },
  { from: 20, name: "Mithril Heart", nodes: { cave_rock: 2, silver_vein: 2, gold_vein: 3, crystal: 2, mithril_vein: 3 }, rockBlock: 6, rockTint: 0x505868 },
];

export const MINE_LIFT_EVERY = 5;

export function mineFloorProfile(floor: number): MineFloorProfile {
  const f = Math.max(1, floor);
  let band = BANDS[0];
  for (const b of BANDS) if (f >= b.from) band = b;
  const nodes = Object.entries(band.nodes).map(([id, weight]) => ({ id, weight }));
  // Gem seams get likelier the deeper you go.
  if (f >= 4) nodes.push({ id: "gem_vein", weight: Math.min(2, 0.3 + f * 0.08) });
  return {
    floor: f,
    nodes,
    nodeCount: Math.min(26, 10 + f),
    chambers: Math.min(10, 4 + Math.floor(f / 2)),
    hazards: f < 3 ? 0 : Math.min(8, Math.floor(f / 2)),
    hazardDamage: 4 + Math.round(f * 1.2),
    chestChance: Math.min(0.9, 0.25 + f * 0.03),
    chestTier: 1 + Math.floor(f / 5),
    ambient: Math.max(0.3, 0.52 - f * 0.01),
    rockBlock: band.rockBlock,
    rockTint: band.rockTint,
    name: band.name,
    creatures: {
      // Floor 1 is peaceful; then vermin, then things that were once miners.
      count: f < 2 ? 0 : Math.min(8, 1 + Math.floor(f / 2)),
      kinds:
        f >= 15
          ? ["skeleton", "skeleton_rogue", "bone_rattler", "skeleton_archer", "cave_spider", "wraith"]
          : f >= 10
            ? ["skeleton", "bone_rattler", "cave_spider", "bat", "poison_slime"]
            : f >= 6
              ? ["bone_rattler", "cave_spider", "bat", "giant_rat"]
              : ["giant_rat", "bat", "giant_rat"],
      level: Math.max(1, Math.ceil(f * 0.55)),
    },
  };
}
