import type { Bank } from "./BlackjackTable";

/**
 * The Wheel of Fates — medieval roulette. Nineteen pockets: the Dragon (0),
 * nine Crimson and nine Shadow numbers (1-18). Colour and parity are
 * independent, so every even-money bet wins 9 times in 19.
 *
 *   Crimson / Shadow / Odd / Even   pays 1:1
 *   Single number (incl. the Dragon) pays 17:1
 *
 * The Dragon is the house's edge: 1/19 on every bet type (~5.3%).
 */
export type Colour = "crimson" | "shadow" | "dragon";
export type BetKind = "crimson" | "shadow" | "odd" | "even" | "number";

export interface Bet {
  kind: BetKind;
  /** For "number" bets. */
  number?: number;
  amount: number;
}

/** Pocket order around the wheel (clockwise from the top). */
export const WHEEL: number[] = [0, 11, 4, 15, 2, 13, 6, 17, 8, 1, 10, 3, 14, 5, 16, 7, 18, 9, 12];
const CRIMSON = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18]);

export function colourOf(n: number): Colour {
  return n === 0 ? "dragon" : CRIMSON.has(n) ? "crimson" : "shadow";
}

export function betWins(bet: Bet, result: number): boolean {
  switch (bet.kind) {
    case "crimson":
      return colourOf(result) === "crimson";
    case "shadow":
      return colourOf(result) === "shadow";
    case "odd":
      return result !== 0 && result % 2 === 1;
    case "even":
      return result !== 0 && result % 2 === 0;
    case "number":
      return bet.number === result;
  }
}

/** Gold returned for a winning bet (stake included). */
export function payoutFor(bet: Bet): number {
  return bet.kind === "number" ? bet.amount * 18 : bet.amount * 2;
}

export function betKey(bet: Pick<Bet, "kind" | "number">): string {
  return bet.kind === "number" ? `n${bet.number}` : bet.kind;
}

export interface Spin {
  result: number;
  bets: Bet[];
  stake: number;
  payout: number;
  settled: boolean;
}

/**
 * One table as a state machine: place bets -> spin (stakes taken, result
 * decided) -> settle (winnings paid, once). Settling is separate so the UI
 * can let the wheel finish turning before the purse changes.
 */
export class RouletteTable {
  private bets = new Map<string, Bet>();
  private current: Spin | null = null;
  private history: number[] = [];
  private listeners = new Set<() => void>();
  private version = 0;

  private bank: Bank;
  private onSettled: (spin: Spin) => void;
  private rand: () => number;

  constructor(bank: Bank, opts: { onSettled?: (spin: Spin) => void; rand?: () => number } = {}) {
    this.bank = bank;
    this.onSettled = opts.onSettled ?? (() => {});
    this.rand = opts.rand ?? Math.random;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  get placed(): Bet[] {
    return [...this.bets.values()];
  }

  get total(): number {
    return this.placed.reduce((s, b) => s + b.amount, 0);
  }

  get spin(): Spin | null {
    return this.current;
  }

  get spinning(): boolean {
    return !!this.current && !this.current.settled;
  }

  get recent(): number[] {
    return this.history;
  }

  /** Add chips to a bet spot. Refuses beyond the table limit or your purse. */
  place(kind: BetKind, amount: number, limit: number, number?: number): boolean {
    if (this.spinning || amount <= 0) return false;
    if (this.total + amount > limit || this.total + amount > this.bank.gold()) return false;
    const key = betKey({ kind, number });
    const cur = this.bets.get(key);
    this.bets.set(key, { kind, number, amount: (cur?.amount ?? 0) + amount });
    this.bump();
    return true;
  }

  clear(): void {
    if (this.spinning) return;
    this.bets.clear();
    this.bump();
  }

  /** Take the stakes and decide the pocket. Returns the result, or null. */
  spinWheel(): number | null {
    if (this.spinning || this.bets.size === 0) return null;
    const stake = this.total;
    if (!this.bank.take(stake)) return null;
    const result = WHEEL[Math.floor(this.rand() * WHEEL.length)];
    const bets = this.placed;
    const payout = bets.reduce((s, b) => s + (betWins(b, result) ? payoutFor(b) : 0), 0);
    this.current = { result, bets, stake, payout, settled: false };
    this.bump();
    return result;
  }

  /** Pay out the current spin (once). Bets stay on the board for a re-spin. */
  settle(): void {
    const s = this.current;
    if (!s || s.settled) return;
    s.settled = true;
    if (s.payout > 0) this.bank.give(s.payout);
    this.history = [s.result, ...this.history].slice(0, 12);
    this.onSettled(s);
    // Keep the same bets ready — but only while you can still afford them.
    if (this.total > this.bank.gold()) this.bets.clear();
    this.bump();
  }

  private bump() {
    this.version++;
    for (const fn of Array.from(this.listeners)) fn();
  }
}
