import type { PanelId } from "../../store/uiStore";
import type { TKey } from "../../i18n";
import { HIGH_STAKES_LEVEL, ROULETTE_LEVEL } from "./tables";

/**
 * Every casino game in one list. A new game (Pachinko, Poker vs. NPCs…) is:
 *   1. a rules/state-machine module in game/casino/ that takes a `Bank`
 *      (see BlackjackTable, RouletteTable) and reports results through
 *      `recordGamble` for stats, skill XP and events;
 *   2. a panel in ui/panels/CasinoPanels.tsx;
 *   3. an entry here (the tavern menu and the back room read this list).
 */
export interface CasinoGame {
  id: string;
  panel: PanelId;
  name: TKey;
  /** Gambling level needed to sit down. */
  minLevel: number;
  /** Playable in the back room at double limits. */
  highStakes: boolean;
}

export const CASINO_GAMES: CasinoGame[] = [
  { id: "blackjack", panel: "blackjack", name: "casino.hsBlackjack", minLevel: 1, highStakes: true },
  { id: "roulette", panel: "roulette", name: "casino.hsWheel", minLevel: ROULETTE_LEVEL, highStakes: true },
  // Future: { id: "pachinko", panel: "pachinko", … }, { id: "poker", panel: "poker", … }
];

export { HIGH_STAKES_LEVEL };
