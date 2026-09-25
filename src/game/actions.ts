import { getItem, type EquipSlot } from "../data/items";
import { SKILLS, type SkillId } from "../data/skills";
import { houseLevelInfo, MAX_HOUSE_LEVEL } from "../data/house";
import type { Recipe } from "../data/recipes";
import { usePlayerStore } from "../store/playerStore";
import { useInventoryStore } from "../store/inventoryStore";
import { useTownStore } from "../store/townStore";
import { useUiStore } from "../store/uiStore";
import { isWellRested } from "../store/timeStore";
import { audio } from "./audio/AudioManager";
import { rarityRank } from "./core/types";
import { gameEvents } from "./events";
import { currentHouseLevel } from "./systems/playerStats";
import { sellPrice } from "./systems/economy";
import { bestTool } from "./systems/toolSystem";
import { getGame } from "../engine/gameInstance";
import { useWorldStore } from "../store/worldStore";
import { useSocialStore } from "../store/socialStore";
import { buyPriceFactor, sellPriceFactor } from "./social/honor";
import { eventActive } from "./social/worldEvents";
import { MYSTERY_BOX_LOOT } from "../data/worldEvents";
import { CRAFT_GOLD_MULT } from "../data/shops";
import { hasPerk } from "./relationships";
import { itemName, skillName, houseName } from "../i18n/content";
import { t, tl } from "../i18n";
import { restoreEnergy } from "./systems/vitals";
import { fieldRepair, repairables } from "./systems/durability";
import { FENCE_RATE } from "./social/reputation";
import { soberUp } from "./tavern/drink";
import { recordRumor } from "./social/rumors";
import { Npc } from "../engine/entities/Props";
import { artisanGold, fenceRate, hagglerBuy, hagglerSell, healMult, xpMult } from "../data/talents";

/**
 * Cross-store gameplay actions used by both UI panels and the engine.
 * Stores stay dumb containers; rules that touch several of them live here.
 */

/**
 * Moves an item from the bag into its slot (the old one goes back in the
 * bag). Durability travels with the piece. `stackIndex` picks a particular
 * copy; otherwise the best-kept honest one.
 */
export function equipItem(itemId: string, stackIndex?: number): boolean {
  const def = getItem(itemId);
  if (!def.equipSlot) return false;
  const inv = useInventoryStore.getState();
  let idx = stackIndex ?? -1;
  if (idx < 0 || inv.stacks[idx]?.itemId !== itemId) {
    let best = Infinity;
    inv.stacks.forEach((s, i) => {
      if (s.itemId !== itemId) return;
      // Honest copies first, then the least worn.
      const score = (s.stolen ? 1e6 : 0) - (s.dur ?? 1e5);
      if (score < best) {
        best = score;
        idx = i;
      }
    });
  }
  const taken = idx >= 0 ? inv.takeStack(idx) : null;
  if (!taken) return false;
  const player = usePlayerStore.getState();
  const slot = def.equipSlot;
  const previous = player.equipment[slot];
  if (previous) inv.addItem(previous, 1, { dur: player.wear[slot] });
  player.equip(slot, itemId);
  player.setWear(slot, taken.dur);
  audio.sfx("ui");
  return true;
}

export function unequipSlot(slot: EquipSlot): void {
  const player = usePlayerStore.getState();
  const current = player.equipment[slot];
  if (!current) return;
  useInventoryStore.getState().addItem(current, 1, { dur: player.wear[slot] });
  player.equip(slot, undefined);
  player.setWear(slot, undefined);
  audio.sfx("ui");
}

/** Every copy of an item the player owns, equipped or carried. */
export function ownsItem(itemId: string): boolean {
  const eq = usePlayerStore.getState().equipment;
  return Object.values(eq).includes(itemId) || useInventoryStore.getState().hasItem(itemId);
}

/** Removes an owned item wherever it is (bag first, then equipment). */
export function consumeOwnedItem(itemId: string): boolean {
  if (useInventoryStore.getState().removeItem(itemId, 1)) return true;
  const player = usePlayerStore.getState();
  for (const [slot, id] of Object.entries(player.equipment)) {
    if (id === itemId) {
      player.equip(slot as EquipSlot, undefined);
      return true;
    }
  }
  return false;
}

/** Drinks the smallest potion that exists. Returns HP restored. */
export function quickDrinkPotion(): number {
  const inv = useInventoryStore.getState();
  const player = usePlayerStore.getState();
  const potionId = ["health_potion", "roast_meat", "forest_stew", "healroot_salve", "greater_potion", "moon_elixir"].find((id) => inv.hasItem(id));
  if (!potionId) {
    useUiStore.getState().pushToast(t("toast.noPotions"), "warning");
    audio.sfx("deny");
    return 0;
  }
  inv.removeItem(potionId, 1);
  const healed = player.heal(Math.round((getItem(potionId).healAmount ?? 0) * healMult(player.talents) * (hasPerk("may_potions") ? 1.1 : 1)));
  audio.sfx("potion");
  return healed;
}

/** Eat or drink one specific consumable from the bag. Returns HP restored. */
export function consumeFood(itemId: string): number {
  const def = getItem(itemId);
  if ((!def.healAmount && !def.energy && !def.mana) || !useInventoryStore.getState().removeItem(itemId, 1)) return 0;
  const healed = usePlayerStore.getState().heal(Math.round((def.healAmount ?? 0) * healMult(usePlayerStore.getState().talents)));
  const energy = def.energy ? restoreEnergy(def.energy) : 0;
  audio.sfx("potion");
  const game = getGame();
  if (game && def.mana) {
    game.player.mana = Math.min(game.player.maxMana, game.player.mana + def.mana);
    game.fx.text(game.player.x, game.player.y - 34, `+${def.mana}`, 0x8ab8ff, { size: 8, bold: true });
  }
  if (game && healed > 0) game.fx.text(game.player.x, game.player.y - 30, `+${healed}`, 0x7dff7d, { size: 9, bold: true });
  if (game && energy > 0) game.fx.text(game.player.x, game.player.y - 40, t("energy.restored", { n: Math.round(energy) }), 0xffe08a, { size: 7 });
  if (itemId === "firepepper") firepepperDare();
  return healed;
}

/**
 * Eating a firepepper raw: a dare, not a meal. It sobers you right up and
 * fills your stamina, costs a little skin (never your life), and if anyone
 * saw it, the whole village will hear about it by tomorrow.
 */
function firepepperDare(): void {
  soberUp(40);
  const p = usePlayerStore.getState();
  usePlayerStore.setState({ hp: Math.max(1, p.hp - 3) });
  const game = getGame();
  if (!game) return;
  const pl = game.player;
  pl.stamina = pl.maxStamina;
  game.fx.text(pl.x, pl.y - 48, t("npc.pepperSelf"), 0xff6a3a, { size: 10, bold: true, life: 1.2 });
  const f = pl.facingVector();
  for (let i = 0; i < 3; i++) setTimeout(() => game.fx.burst(pl.x + f.x * 10, pl.y - 18, "spark", 10, { speed: 70, up: 20, life: 0.35 }), i * 120);
  game.shake(2, 0.3);
  audio.sfx("hit", { pitch: 0.7 });
  // An audience makes it a story.
  const watchers = game.area.entities.filter((e): e is Npc => e instanceof Npc && !!e.def && Math.hypot(e.x - pl.x, e.y - pl.y) < 110);
  const lines = tl("npc.pepperReact");
  watchers.slice(0, 3).forEach((n, i) => setTimeout(() => !n.removed && n.say(game, lines[(i + Math.floor(Math.random() * lines.length)) % lines.length], 2.4), 400 + i * 500));
  if (watchers.length >= 2 || game.area.id === "tavern") recordRumor("firepepper");
}

/**
 * Grants items with the right amount of fanfare: common stuff becomes a
 * toast, rare+ gets the big animated reveal.
 */
export function grantItems(items: { itemId: string; quantity: number }[]): void {
  const ui = useUiStore.getState();
  const inv = useInventoryStore.getState();
  let bestRank = -1;
  for (const { itemId, quantity } of items) {
    inv.addItem(itemId, quantity);
    const def = getItem(itemId);
    const rank = rarityRank(def.rarity);
    bestRank = Math.max(bestRank, rank);
    if (rank >= 2) ui.pushLootReveal(itemId, quantity);
    else ui.pushItemToast(itemId, itemName(itemId), quantity, def.icon, def.rarity);
  }
  if (bestRank >= 2) {
    audio.sfx("rare");
    // Rare finds train Luck.
    awardSkillXp("luck", 6 * bestRank);
  } else if (items.length) audio.sfx("pickup");
}

/** Utility items with special effects (e.g. the Return Scroll). */
export function useUtilityItem(itemId: string): boolean {
  const def = getItem(itemId);
  if (def.useEffect === "open_box") return openMysteryBox(itemId);
  if (def.useEffect === "repair_kit" || def.useEffect === "whetstone") {
    const kind = def.useEffect === "repair_kit" ? "kit" : "whetstone";
    if (!repairables().some((r) => r.slot && (kind === "kit" || r.slot === "weapon" || r.slot === "tool"))) {
      useUiStore.getState().pushToast(t("durability.nothingToFix"), "info");
      audio.sfx("deny");
      return false;
    }
    if (!useInventoryStore.getState().removeItem(itemId, 1)) return false;
    const n = fieldRepair(kind);
    audio.sfx("mine", { pitch: 1.4 });
    useUiStore.getState().pushToast(kind === "kit" ? t("durability.kitUsed", { n }) : t("durability.whetUsed"), "info", { icon: def.icon });
    return true;
  }
  if (def.useEffect !== "return_home") return false;
  const game = getGame();
  const area = useWorldStore.getState().area;
  if (!game || (area !== "dungeon" && area !== "mine")) {
    useUiStore.getState().pushToast(t("toast.scrollBelow"), "warning");
    audio.sfx("deny");
    return false;
  }
  if (!useInventoryStore.getState().removeItem(itemId, 1)) return false;
  useUiStore.getState().closePanel();
  audio.sfx("rare");
  if (area === "dungeon") game.exitDungeon("retreated");
  else game.requestTravel("town", "mine");
  return true;
}

/** Fifty gold of pure hope. */
function openMysteryBox(itemId: string): boolean {
  if (!useInventoryStore.getState().removeItem(itemId, 1)) return false;
  const total = MYSTERY_BOX_LOOT.reduce((s, l) => s + l.weight, 0);
  let r = Math.random() * total;
  let pick = MYSTERY_BOX_LOOT[0];
  for (const l of MYSTERY_BOX_LOOT) {
    r -= l.weight;
    if (r <= 0) {
      pick = l;
      break;
    }
  }
  grantItems([{ itemId: pick.itemId, quantity: pick.quantity }]);
  useUiStore.getState().pushToast(t("events.boxOpened", { item: `${pick.quantity > 1 ? `${pick.quantity}× ` : ""}${itemName(pick.itemId)}` }), "info", { icon: getItem(pick.itemId).icon });
  audio.sfx("chest");
  return true;
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

/**
 * Character XP from any source (kills, quests, discoveries, crafting,
 * gathering…) with the Wanderer bonus and level-up fanfare. Returns the XP
 * actually granted.
 */
export function grantXp(amount: number): number {
  if (amount <= 0) return 0;
  const player = usePlayerStore.getState();
  const xp = Math.max(1, Math.round(amount * xpMult(player.talents)));
  const res = player.gainXp(xp);
  if (res.leveledUp) {
    const game = getGame();
    if (game) game.combat.levelUp(res.newLevel);
    else useUiStore.getState().pushToast(t("toast.levelUp", { n: res.newLevel }), "levelup");
  }
  return xp;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** Skill XP with the Well Rested bonus applied and level-up fanfare. */
export function awardSkillXp(skill: SkillId, amount: number): void {
  if (amount <= 0) return;
  const rested = isWellRested() ? houseLevelInfo(currentHouseLevel()).perks.restedXpBonus : 0;
  const gained = usePlayerStore.getState().gainSkillXp(skill, Math.round(amount * (1 + rested)));
  if (gained > 0) {
    const level = usePlayerStore.getState().skills[skill].level;
    useUiStore.getState().pushToast(t("toast.skillUp", { skill: skillName(skill), n: level }), "levelup", { icon: SKILLS[skill].icon });
    audio.sfx("levelup");
    // Getting better at anything makes you a better adventurer.
    grantXp(4 * level);
  }
}

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

/** What an honest merchant pays for one (relics, Honor and festivals count). */
export function shopSellPrice(itemId: string): number {
  const base = sellPrice(itemId, usePlayerStore.getState().equipment);
  const factor = sellPriceFactor(useSocialStore.getState().honor) * (eventActive("festival") ? 1.15 : 1) * hagglerSell(usePlayerStore.getState().talents);
  return Math.max(1, Math.round(base * factor));
}

/** What a merchant charges (Honor, Haggler, and Mira's friend discount in her store). */
export function shopBuyPrice(base: number, opts: { mira?: boolean } = {}): number {
  const friend = opts.mira && hasPerk("mira_discount") ? 0.9 : 1;
  return Math.max(1, Math.round(base * buyPriceFactor(useSocialStore.getState().honor) * hagglerBuy(usePlayerStore.getState().talents) * friend));
}

/** Why the shop won't take this, or null if it will. Equipped gear is never
 * in the bag, so it can't be sold by accident; key items and stolen goods
 * are refused outright. */
export function unsellableReason(itemId: string, stolen: boolean, fence = false): "key" | "stolen" | "worthless" | "bestTool" | null {
  const def = getItem(itemId);
  if (def.keyItem) return "key";
  // Stolen goods: only to a fence, or to Mira once she's stopped asking (Fence talent).
  if (stolen && !fence && fenceRate(usePlayerStore.getState().talents) <= 0) return "stolen";
  if (!stolen && fence) return "worthless";
  if (def.value <= 0) return "worthless";
  // Your only / best axe or pickaxe is progression, not loot.
  if (def.toolKind) {
    const p = usePlayerStore.getState();
    if (bestTool(def.toolKind, p.equipment, useInventoryStore.getState().stacks)?.id === itemId && p.equipment.tool !== itemId) return "bestTool";
  }
  return null;
}

/** What stolen goods fetch: the fence's cut, or Mira's (Fence talent). */
export function stolenSellPrice(itemId: string, fence: boolean): number {
  const rate = Math.max(fence ? FENCE_RATE : 0, fenceRate(usePlayerStore.getState().talents));
  return Math.max(1, Math.round(shopSellPrice(itemId) * rate));
}

/** Sells honest copies (or stolen ones, where someone will take them). Returns the gold earned. */
export function sellItem(itemId: string, quantity: number, stolen = false, fence = false, rate = 1): number {
  if (unsellableReason(itemId, stolen, fence)) return 0;
  const price = Math.round((stolen ? stolenSellPrice(itemId, fence) : shopSellPrice(itemId)) * rate) * quantity;
  if (!useInventoryStore.getState().removeItem(itemId, quantity, stolen ? "stolen" : "clean")) return 0;
  if (stolen) useSocialStore.getState().changeRep("underworld", 1);
  usePlayerStore.getState().earnGold(price);
  gameEvents.emit("itemSold", { itemId, quantity, gold: price });
  return price;
}

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

export type CraftBlock = { code: "owned" | "needs" | "missing" | "gold"; text: string };

/** Why a recipe can't be crafted right now, or null if it can. */
export function craftBlocker(r: Recipe): CraftBlock | null {
  const out = getItem(r.output.itemId);
  // Gear is one-of-a-kind: no point forging a second iron axe.
  if (!out.stackable && out.equipSlot && ownsItem(out.id)) return { code: "owned", text: t("crafting.owned") };
  if (r.upgradesFrom && !ownsItem(r.upgradesFrom)) return { code: "needs", text: t("crafting.needs", { item: itemName(r.upgradesFrom) }) };
  const inv = useInventoryStore.getState();
  for (const m of r.inputs) if (!inv.hasItem(m.itemId, m.quantity)) return { code: "missing", text: t("crafting.missing") };
  if (craftGold(r) > usePlayerStore.getState().gold) return { code: "gold", text: t("crafting.noGold") };
  return null;
}

/** Gold a recipe costs you (Artisan talent). */
export function craftGold(r: Recipe): number {
  const friend = r.station === "forge" && hasPerk("bram_discount") ? 0.85 : 1;
  return Math.round((r.gold ?? 0) * CRAFT_GOLD_MULT * artisanGold(usePlayerStore.getState().talents) * friend);
}

export function craftRecipe(r: Recipe): boolean {
  if (craftBlocker(r)) {
    audio.sfx("deny");
    return false;
  }
  const inv = useInventoryStore.getState();
  if (r.gold) usePlayerStore.getState().spendGold(craftGold(r));
  for (const m of r.inputs) inv.removeItem(m.itemId, m.quantity);
  // Upgrading: the old item is melted down into the new one.
  let wasEquipped = false;
  if (r.upgradesFrom) {
    wasEquipped = Object.values(usePlayerStore.getState().equipment).includes(r.upgradesFrom);
    consumeOwnedItem(r.upgradesFrom);
  }
  useInventoryStore.getState().addItem(r.output.itemId, r.output.quantity);
  const def = getItem(r.output.itemId);
  if (def.equipSlot && (wasEquipped || !usePlayerStore.getState().equipment[def.equipSlot])) equipItem(def.id);
  if (r.skill) awardSkillXp(r.skill.id, r.skill.xp);
  // Making gear is an achievement in itself.
  if (def.equipSlot) grantXp(10 + 15 * rarityRank(def.rarity));
  if (rarityRank(def.rarity) >= 1 && def.equipSlot) {
    audio.sfx("rare");
    useUiStore.getState().pushLootReveal(def.id, r.output.quantity);
  } else {
    audio.sfx("pickup");
    useUiStore.getState().pushItemToast(def.id, itemName(def.id), r.output.quantity, def.icon, def.rarity);
  }
  gameEvents.emit("crafted", { recipeId: r.id, itemId: def.id });
  return true;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function houseUpgradeBlocker(): string | null {
  const level = currentHouseLevel();
  if (level >= MAX_HOUSE_LEVEL) return t("house.blocker.max");
  const next = houseLevelInfo(level + 1);
  const cost = next.cost!;
  const inv = useInventoryStore.getState();
  for (const m of cost.materials) if (!inv.hasItem(m.itemId, m.quantity)) return t("house.blocker.materials");
  if (usePlayerStore.getState().gold < cost.gold) return t("house.blocker.gold");
  return null;
}

export function upgradeHouse(): boolean {
  if (houseUpgradeBlocker()) {
    audio.sfx("deny");
    return false;
  }
  const prev = houseLevelInfo(currentHouseLevel());
  const next = houseLevelInfo(prev.level + 1);
  const cost = next.cost!;
  usePlayerStore.getState().spendGold(cost.gold);
  for (const m of cost.materials) useInventoryStore.getState().removeItem(m.itemId, m.quantity);
  useTownStore.getState().setBuildingLevel("house", next.level);
  // New max HP from home comforts arrives topped up.
  usePlayerStore.getState().heal(next.perks.maxHp - prev.perks.maxHp);
  audio.sfx("levelup");
  useUiStore.getState().pushToast(t("toast.homeUpgraded", { name: houseName(next.level) }), "levelup", { icon: "house" });
  gameEvents.emit("houseUpgraded", { level: next.level });
  return true;
}
