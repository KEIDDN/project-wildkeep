/**
 * Your cottage as a progression track. Each level swaps the exterior
 * building sprite (see BUILDINGS in tools/build_assets.py), dresses the yard
 * and the interior a little more, and grants a couple of real benefits.
 */
export interface HouseLevel {
  level: number;
  name: string;
  /** Building sprite id used in the village. */
  sprite: string;
  description: string;
  cost?: { gold: number; materials: { itemId: string; quantity: number }[] };
  perks: {
    /** Stacks the storage trunk can hold. */
    stashSlots: number;
    /** Sleeping here leaves you Well Rested: bonus skill XP the next day. */
    restedXpBonus: number;
    /** Permanent max HP from home comforts. */
    maxHp: number;
    /** Unlocks the home workbench (cooking + alchemy recipes). */
    workbench: boolean;
  };
  /** Human-readable perk list for the upgrade panel. */
  perkText: string[];
}

export const HOUSE_LEVELS: HouseLevel[] = [
  {
    level: 1,
    name: "Small Cottage",
    sprite: "house",
    description: "Four log walls, a bed and a trunk. It's a start.",
    perks: { stashSlots: 16, restedXpBonus: 0, maxHp: 0, workbench: false },
    perkText: ["Storage trunk: 16 slots", "Sleep to start a new day"],
  },
  {
    level: 2,
    name: "Improved Cottage",
    sprite: "house_2",
    description: "Proper plank walls, a flower box and a door that closes.",
    cost: { gold: 200, materials: [{ itemId: "plank", quantity: 12 }, { itemId: "stone_brick", quantity: 8 }] },
    perks: { stashSlots: 28, restedXpBonus: 0.15, maxHp: 0, workbench: false },
    perkText: ["Storage trunk: 28 slots", "Well Rested: +15% skill XP the day after sleeping"],
  },
  {
    level: 3,
    name: "Large House",
    sprite: "house_3",
    description: "A timber-framed family house with a real kitchen.",
    cost: {
      gold: 600,
      materials: [
        { itemId: "plank", quantity: 30 },
        { itemId: "stone_brick", quantity: 20 },
        { itemId: "iron_bar", quantity: 6 },
        { itemId: "copper_bar", quantity: 4 },
      ],
    },
    perks: { stashSlots: 40, restedXpBonus: 0.2, maxHp: 10, workbench: true },
    perkText: ["Storage trunk: 40 slots", "Home workbench: cook stew and brew potions", "Well Rested: +20% skill XP", "+10 max HP"],
  },
  {
    level: 4,
    name: "Stone Manor",
    sprite: "house_4",
    description: "Brick, glass and a hearth worth coming home to.",
    cost: {
      gold: 1500,
      materials: [
        { itemId: "plank", quantity: 50 },
        { itemId: "stone_brick", quantity: 45 },
        { itemId: "iron_bar", quantity: 15 },
        { itemId: "silver_bar", quantity: 6 },
        { itemId: "hardwood", quantity: 20 },
      ],
    },
    perks: { stashSlots: 56, restedXpBonus: 0.3, maxHp: 25, workbench: true },
    perkText: ["Storage trunk: 56 slots", "Well Rested: +30% skill XP", "+25 max HP"],
  },
];

export const MAX_HOUSE_LEVEL = HOUSE_LEVELS.length;

export function houseLevelInfo(level: number): HouseLevel {
  return HOUSE_LEVELS[Math.max(0, Math.min(HOUSE_LEVELS.length - 1, level - 1))];
}
