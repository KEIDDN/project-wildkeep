import type { Stats } from "../core/types";

export interface AttackResult {
  damage: number;
  isCrit: boolean;
}

/** Real-time hits always land (aiming is the skill check); defense
 * mitigates, crits multiply, and a little variance keeps numbers lively. */
export function resolveAttack(attacker: Stats, defender: Stats, rand: () => number = Math.random): AttackResult {
  const mitigated = Math.max(1, attacker.attack - defender.defense * 0.7);
  const variance = 0.85 + rand() * 0.3;
  const isCrit = rand() < attacker.crit;
  const damage = Math.max(1, Math.round(mitigated * variance * (isCrit ? 1.75 : 1)));
  return { damage, isCrit };
}
