import { LEGACY_SAVE_KEY, SAVE_KEY, SAVE_VERSION } from "../core/constants";
import { hasItemDef } from "../../data/items";
import { DEFAULT_SAVE, type InventoryStack, type SaveData } from "./schema";
import { freshSkills, type SkillState } from "../systems/skills";
import type { SkillId } from "../../data/skills";

export const SAVE_SLOTS = [1, 2, 3] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

const slotKey = (slot: SaveSlot) => `${SAVE_KEY}-${slot}`;

/** What the title screen shows for a slot. */
export interface SlotSummary {
  slot: SaveSlot;
  savedAt: number;
  day: number;
  level: number;
  houseLevel: number;
  gold: number;
  deepestFloor: number;
}

/**
 * Thin persistence abstraction over localStorage with three save slots.
 * Swapping to IndexedDB later only means changing these bodies.
 */
export const persistence = {
  /** One-time move of the pre-slots save into slot 1. */
  migrateLegacy(): void {
    try {
      const legacy = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
      if (legacy && !localStorage.getItem(slotKey(1))) localStorage.setItem(slotKey(1), legacy);
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  },

  load(slot: SaveSlot): SaveData | null {
    try {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (err) {
      console.warn("Failed to load save data", err);
      return null;
    }
  },

  save(slot: SaveSlot, data: SaveData): void {
    try {
      localStorage.setItem(slotKey(slot), JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch (err) {
      console.warn("Failed to save game", err);
    }
  },

  clear(slot: SaveSlot): void {
    localStorage.removeItem(slotKey(slot));
  },

  summary(slot: SaveSlot): SlotSummary | null {
    const d = this.load(slot);
    if (!d) return null;
    return {
      slot,
      savedAt: d.savedAt,
      day: d.time.day,
      level: d.player.level,
      houseLevel: d.town.buildingLevels.house ?? 1,
      gold: d.player.gold,
      deepestFloor: d.progress.dungeonDeepest,
    };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(data: any): SaveData {
  const d = structuredClone(DEFAULT_SAVE);
  if (!data || typeof data !== "object") return d;
  if (typeof data.savedAt === "number") d.savedAt = data.savedAt;

  if (data.player) {
    d.player = { ...d.player, ...data.player, equipment: { ...data.player.equipment }, skills: migrateSkills(data.player.skills) };
  }
  if (Array.isArray(data.inventory)) d.inventory = sanitizeStacks(data.inventory);
  if (data.progress) d.progress = { ...d.progress, ...data.progress, flags: { ...data.progress.flags } };
  else if (data.dungeonProgress) {
    // v2/v3: tiers. Clearing tier I = beating the floor-5 boss.
    const cleared = data.dungeonProgress.highestTierCleared ?? 0;
    d.progress.dungeonCheckpoint = Math.min(10, cleared * 5);
    d.progress.dungeonDeepest = d.progress.dungeonCheckpoint;
    d.progress.runsCompleted = data.dungeonProgress.runsCompleted ?? 0;
  }
  if (data.stats) d.stats = { ...d.stats, ...data.stats };
  if (data.town) {
    d.town = {
      buildingLevels: { house: 1, ...data.town.buildingLevels },
      stash: sanitizeStacks(data.town.stash ?? []),
    };
  }
  if ((data.version ?? 1) >= 2 && data.world) {
    d.world = { ...d.world, ...data.world, nodeRespawns: { ...data.world.nodeRespawns } };
    // Never resume inside a dungeon: runs aren't persisted mid-way.
    if (d.world.area === "dungeon" || d.world.area === "mine") d.world = { ...DEFAULT_SAVE.world, area: "town", x: -1, y: -1, spawn: "default" };
  }

  if (data.time && typeof data.time.day === "number") d.time = { ...d.time, ...data.time };
  // v4: honor, relationships, deeds, today's event.
  if (data.social && typeof data.social === "object") {
    d.social = {
      ...d.social,
      ...data.social,
      deeds: { ...d.social.deeds, ...data.social.deeds },
      relationships: { ...data.social.relationships },
      used: { ...data.social.used },
      event: { ...d.social.event, ...data.social.event },
      rep: { ...d.social.rep, ...data.social.rep },
      rumors: Array.isArray(data.social.rumors) ? data.social.rumors.filter((r: { kind?: unknown; day?: unknown } | null) => r && typeof r.kind === "string" && typeof r.day === "number").slice(0, 10) : [],
    };
  }
  // v5: quests.
  if (data.quests && typeof data.quests === "object") {
    d.quests = {
      active: { ...data.quests.active },
      done: [...(data.quests.done ?? [])],
      tracked: data.quests.tracked ?? null,
      board: { day: data.quests.board?.day ?? 0, offers: [...(data.quests.board?.offers ?? [])] },
    };
  }
  if (data.farm && typeof data.farm.plots === "object") d.farm = { plots: structuredClone(data.farm.plots), ...(typeof data.farm.can === "number" ? { can: data.farm.can } : {}) };
  // Saves from before the intro existed have already started playing.
  if (data.tutorial) d.tutorial = { ...d.tutorial, introSeen: true, ...data.tutorial, seenTopics: [...(data.tutorial.seenTopics ?? [])] };
  // v5 rewrote the introduction: an unfinished one restarts (done steps skip themselves).
  if ((data.version ?? 1) < 5 && !d.tutorial.completed) d.tutorial.step = 0;

  // v6: farming needs tools now — anyone who already had the garden gets them.
  if ((data.version ?? 1) < 6 && d.progress.flags.farm_unlocked) {
    for (const id of ["hoe", "watering_can"]) if (!d.inventory.some((s) => s.itemId === id) && !Object.values(d.player.equipment).includes(id)) d.inventory.push({ itemId: id, quantity: 1 });
  }

  // Drop equipment that no longer exists.
  for (const [slot, id] of Object.entries(d.player.equipment)) {
    if (id && !hasItemDef(id)) delete d.player.equipment[slot as keyof typeof d.player.equipment];
  }
  d.version = SAVE_VERSION;
  return d;
}

/** v2 skills were bare levels ({ combat: 3 }); v3 tracks level + xp and
 * renamed combat to strength. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateSkills(old: any): SkillState {
  const skills = freshSkills();
  if (!old || typeof old !== "object") return skills;
  for (const id of Object.keys(skills) as SkillId[]) {
    const v = old[id] ?? (id === "strength" ? old.combat : undefined);
    if (typeof v === "number") skills[id] = { level: Math.max(1, Math.floor(v)), xp: 0 };
    else if (v && typeof v.level === "number") skills[id] = { level: Math.max(1, v.level), xp: Math.max(0, v.xp ?? 0) };
  }
  return skills;
}

function sanitizeStacks(stacks: InventoryStack[]): InventoryStack[] {
  return stacks
    .filter((s) => s && hasItemDef(s.itemId) && s.quantity > 0)
    .map((s) => ({
      itemId: s.itemId,
      quantity: s.quantity,
      ...(s.stolen ? { stolen: true } : {}),
      ...(typeof s.dur === "number" ? { dur: s.dur } : {}),
      ...(typeof s.slot === "number" && s.slot >= 0 ? { slot: Math.floor(s.slot) } : {}),
    }));
}
