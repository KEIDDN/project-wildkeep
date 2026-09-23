import type { SeededRandom } from "../core/rng";
import type { Stats } from "../core/types";

export interface AttackResult {
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
}

const MIN_HIT_CHANCE = 0.85;

export function resolveAttack(
  attacker: Stats,
  defender: Stats,
  rng: SeededRandom,
): AttackResult {
  if (rng.next() > MIN_HIT_CHANCE + attacker.luck * 0.1) {
    return { damage: 0, isCrit: false, isMiss: true };
  }
  const mitigated = Math.max(1, attacker.attack - defender.defense * 0.6);
  const variance = rng.float(0.85, 1.15);
  const isCrit = rng.next() < attacker.crit;
  const critMult = isCrit ? 1.6 : 1;
  const damage = Math.max(1, Math.round(mitigated * variance * critMult));
  return { damage, isCrit, isMiss: false };
}

export function defendedDamage(result: AttackResult): AttackResult {
  return { ...result, damage: Math.round(result.damage * 0.4) };
}
