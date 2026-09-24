import { useWorldStore } from "../../store/worldStore";
import { usePlayerStore } from "../../store/playerStore";
import { manaWellBonus } from "../../data/talents";

/**
 * Magic foundation. Mana only exists once you've been taught at the
 * Crooked Tower (world flag `magic_learned`); until then the bar is hidden
 * and spells can't be cast.
 */
export const MAGIC_FLAG = "magic_learned";

export function magicLearned(): boolean {
  return !!useWorldStore.getState().progress.flags[MAGIC_FLAG];
}

/** Spark: the first spell. A bolt of lightning where you're looking. */
export const SPARK = { cost: 12, cooldown: 0.45, speed: 250, range: 190 };
/** Mana per second (before Attunement). */
export const MANA_REGEN = 2.4;

export function maxMana(): number {
  if (!magicLearned()) return 0;
  const p = usePlayerStore.getState();
  return 30 + Math.min(40, p.level * 2) + manaWellBonus(p.talents);
}
