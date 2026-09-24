/**
 * Blackjack rules, with no UI and no stores: pure functions over plain data
 * so the table can be tested and re-skinned freely.
 *
 * House rules at the Gilded Gamble:
 *   - 4-deck shoe, reshuffled when it runs low
 *   - dealer peeks for Blackjack, stands on all 17s
 *   - Blackjack pays 3:2, a win pays 1:1, a push returns the bet
 *   - double down on your first two cards (one more card, bet doubled)
 * No splitting or insurance: the house keeps a small edge, as it should.
 */

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export interface Card {
  rank: number; // 1 = Ace, 11-13 = J Q K
  suit: Suit;
}

export type Outcome = "blackjack" | "win" | "push" | "lose" | "bust" | "dealer_bust" | "dealer_blackjack";

export interface Round {
  bet: number;
  player: Card[];
  dealer: Card[];
  /** "player" = your turn; "dealer" = dealer drawing; "done" = settled. */
  phase: "player" | "dealer" | "done";
  doubled: boolean;
  outcome?: Outcome;
  /** Gold returned to the player (bet included). 0 on a loss. */
  payout: number;
  luckyPush?: boolean;
}

type Rand = () => number;

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const SHOE_DECKS = 4;
const RESHUFFLE_AT = 20;

export function newShoe(rand: Rand = Math.random, decks = SHOE_DECKS): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) shoe.push({ rank, suit });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

/** Draws from the shoe (mutates it). The shoe is only ever reshuffled
 * between hands (see `deal`), so a card can't reappear mid-hand; an empty
 * shoe mid-hand (impossible with 20+ cards left at the deal) still refills
 * rather than crash. */
export function draw(shoe: Card[], rand: Rand = Math.random): Card {
  if (shoe.length === 0) shoe.push(...newShoe(rand));
  return shoe.pop()!;
}

/** Reshuffles when the shoe is running low. Call only between hands. */
export function reshuffleIfLow(shoe: Card[], rand: Rand = Math.random): boolean {
  if (shoe.length >= RESHUFFLE_AT) return false;
  shoe.splice(0, shoe.length, ...newShoe(rand));
  return true;
}

export function cardValue(c: Card): number {
  return c.rank === 1 ? 11 : Math.min(10, c.rank);
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === 1) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function rankLabel(rank: number): string {
  return rank === 1 ? "A" : rank === 11 ? "J" : rank === 12 ? "Q" : rank === 13 ? "K" : String(rank);
}

/** Deals a new round. Naturals are settled immediately. */
export function deal(shoe: Card[], bet: number, rand: Rand = Math.random): Round {
  reshuffleIfLow(shoe, rand);
  const player = [draw(shoe, rand)];
  const dealer = [draw(shoe, rand)];
  player.push(draw(shoe, rand));
  dealer.push(draw(shoe, rand));
  const round: Round = { bet, player, dealer, phase: "player", doubled: false, payout: 0 };
  const pbj = isBlackjack(player);
  const dbj = isBlackjack(dealer);
  if (pbj || dbj) return settle({ ...round, phase: "done" });
  return round;
}

export function hit(round: Round, shoe: Card[], rand: Rand = Math.random): Round {
  if (round.phase !== "player") return round;
  const player = [...round.player, draw(shoe, rand)];
  const next = { ...round, player };
  const v = handValue(player).total;
  if (v > 21) return settle({ ...next, phase: "done" });
  if (v === 21) return { ...next, phase: "dealer" };
  return next;
}

export function stand(round: Round): Round {
  if (round.phase !== "player") return round;
  return { ...round, phase: "dealer" };
}

export function canDouble(round: Round): boolean {
  return round.phase === "player" && round.player.length === 2 && !round.doubled;
}

/** Double the bet, take exactly one card, then the dealer plays. The caller
 * must have taken the extra stake from the player first. */
export function doubleDown(round: Round, shoe: Card[], rand: Rand = Math.random): Round {
  if (!canDouble(round)) return round;
  const player = [...round.player, draw(shoe, rand)];
  const next: Round = { ...round, player, bet: round.bet * 2, doubled: true };
  if (handValue(player).total > 21) return settle({ ...next, phase: "done" });
  return { ...next, phase: "dealer" };
}

/** Whether the dealer takes another card. Stands on all 17s. */
export function dealerShouldDraw(round: Round): boolean {
  return round.phase === "dealer" && handValue(round.dealer).total < 17;
}

/** One dealer draw (the UI calls this on a timer for suspense). */
export function dealerDraw(round: Round, shoe: Card[], rand: Rand = Math.random): Round {
  if (!dealerShouldDraw(round)) return round;
  return { ...round, dealer: [...round.dealer, draw(shoe, rand)] };
}

/** Plays the dealer's hand out and settles (used when skipping animation). */
export function finishDealer(round: Round, shoe: Card[], rand: Rand = Math.random): Round {
  let r = round;
  while (dealerShouldDraw(r)) r = dealerDraw(r, shoe, rand);
  return r.phase === "dealer" ? settle({ ...r, phase: "done" }) : r;
}

export function settle(round: Round): Round {
  const p = handValue(round.player).total;
  const d = handValue(round.dealer).total;
  const pbj = isBlackjack(round.player) && !round.doubled;
  const dbj = isBlackjack(round.dealer);
  let outcome: Outcome;
  if (p > 21) outcome = "bust";
  else if (pbj && dbj) outcome = "push";
  else if (pbj) outcome = "blackjack";
  else if (dbj) outcome = "dealer_blackjack";
  else if (d > 21) outcome = "dealer_bust";
  else if (p > d) outcome = "win";
  else if (p === d) outcome = "push";
  else outcome = "lose";
  return { ...round, phase: "done", outcome, payout: payoutFor(outcome, round.bet) };
}

export function payoutFor(outcome: Outcome, bet: number): number {
  switch (outcome) {
    case "blackjack":
      return bet + Math.floor(bet * 1.5);
    case "win":
    case "dealer_bust":
      return bet * 2;
    case "push":
      return bet;
    default:
      return 0;
  }
}

/** Luck can (rarely) turn a push into a win. See skills.luckyPushChance. */
export function applyLuckyPush(round: Round, chance: number, rand: Rand = Math.random): Round {
  if (round.outcome !== "push" || rand() >= chance) return round;
  return { ...round, outcome: "win", payout: round.bet * 2, luckyPush: true };
}

export const OUTCOME_TEXT: Record<Outcome, string> = {
  blackjack: "BLACKJACK! Pays 3 to 2!",
  win: "You win!",
  dealer_bust: "Silas busts — you win!",
  push: "Push. Your bet is returned.",
  lose: "Silas wins this one.",
  bust: "Bust! Over twenty-one.",
  dealer_blackjack: "Silas flips a Blackjack. Ouch.",
};
