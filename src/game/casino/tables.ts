import { usePlayerStore } from "../../store/playerStore";
import { useWorldStore } from "../../store/worldStore";
import { audio } from "../audio/AudioManager";
import { awardSkillXp } from "../actions";
import { gameEvents } from "../events";
import { luckyPushChance } from "../systems/skills";
import { gamblingWinMult } from "../../data/talents";
import { drunkLuck } from "../tavern/drink";
import { BlackjackTable, type Bank } from "./BlackjackTable";
import { RouletteTable } from "./roulette";

/** The player's purse, as seen by the casino tables. */
let staked = 0;
export const playerBank: Bank = {
  gold: () => usePlayerStore.getState().gold,
  take: (n) => {
    const ok = usePlayerStore.getState().spendGold(n);
    if (ok) staked += n;
    return ok;
  },
  // Card Sharp: a cut of the profit on top (never of your own stake back).
  give: (n) => {
    const profit = Math.max(0, n - staked);
    staked = 0;
    usePlayerStore.getState().earnGold(n + Math.round(profit * (gamblingWinMult(usePlayerStore.getState().talents) - 1)));
  },
};

/** Shared bookkeeping for any casino game: stats, skill XP, events. */
export function recordGamble(game: string, stake: number, net: number, big = false): void {
  if (net > 0) useWorldStore.getState().bumpStat("goldWonGambling", net);
  else if (net < 0) useWorldStore.getState().bumpStat("goldLostGambling", -net);
  // Every round trains Gambling; winning trains it more.
  awardSkillXp("gambling", Math.round((4 + stake / 10) * (net > 0 ? 1.5 : 1)));
  if (big) awardSkillXp("luck", 5);
  audio.sfx(big ? "rare" : net > 0 ? "coin" : net === 0 ? "ui" : "deny");
  gameEvents.emit("gambled", { game, stake, net });
}

/** Silas's table. It lives for the whole session, so its shoe (and any hand
 * in progress) survives closing and reopening the panel. */
export const blackjackTable = new BlackjackTable(playerBank, {
  luckyPushChance: () => luckyPushChance(usePlayerStore.getState().skills.luck.level) + drunkLuck(),
  onSettled: ({ round, net }) => recordGamble("blackjack", round.bet, net, round.outcome === "blackjack" || !!round.luckyPush),
});

/** Madame Vex's Wheel of Fates. */
export const rouletteTable = new RouletteTable(playerBank, {
  onSettled: (spin) => recordGamble("roulette", spin.stake, spin.payout - spin.stake, spin.payout >= spin.stake * 10),
});

/** Gambling level needed to sit at the wheel. */
export const ROULETTE_LEVEL = 3;
/** Gambling level the back room's bouncer asks for. */
export const HIGH_STAKES_LEVEL = 5;
