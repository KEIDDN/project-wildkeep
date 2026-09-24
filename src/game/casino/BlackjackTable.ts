import {
  canDouble,
  deal,
  dealerDraw,
  dealerShouldDraw,
  doubleDown,
  finishDealer,
  hit,
  newShoe,
  settle,
  stand,
  applyLuckyPush,
  type Card,
  type Round,
} from "./blackjack";

/** Where the table takes stakes from and pays winnings to. */
export interface Bank {
  gold(): number;
  take(amount: number): boolean;
  give(amount: number): void;
}

export interface SettledHand {
  round: Round;
  /** payout - stake (negative on a loss). */
  net: number;
}

/**
 * One Blackjack table as a small state machine, independent of React.
 *
 * Every action re-checks the phase against the *current* hand (never a
 * stale copy), stakes are taken exactly once, and each hand pays out exactly
 * once — so double-clicks, closing the panel mid-hand, or reopening the
 * table can't produce an impossible state. The shoe persists between visits
 * and is only reshuffled between hands.
 */
export class BlackjackTable {
  private shoe: Card[];
  private current: Round | null = null;
  private paid = false;
  private listeners = new Set<() => void>();
  private version = 0;

  private bank: Bank;
  private onSettled: (hand: SettledHand) => void;
  private luckyPush: () => number;
  private rand: () => number;

  constructor(bank: Bank, opts: { onSettled?: (hand: SettledHand) => void; luckyPushChance?: () => number; rand?: () => number } = {}) {
    this.bank = bank;
    this.onSettled = opts.onSettled ?? (() => {});
    this.luckyPush = opts.luckyPushChance ?? (() => 0);
    this.rand = opts.rand ?? Math.random;
    this.shoe = newShoe(this.rand);
  }

  get round(): Round | null {
    return this.current;
  }

  get inHand(): boolean {
    return !!this.current && this.current.phase !== "done";
  }

  get cardsLeft(): number {
    return this.shoe.length;
  }

  /** For React's useSyncExternalStore. */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  /** Start a hand. Returns false (and changes nothing) if not allowed. */
  deal(bet: number, maxBet: number): boolean {
    if (this.inHand) return false;
    bet = Math.floor(bet);
    if (bet <= 0 || bet > maxBet || bet > this.bank.gold()) return false;
    if (!this.bank.take(bet)) return false;
    this.paid = false;
    this.set(deal(this.shoe, bet, this.rand));
    return true;
  }

  hit(): boolean {
    if (this.current?.phase !== "player") return false;
    this.set(hit(this.current, this.shoe, this.rand));
    return true;
  }

  stand(): boolean {
    if (this.current?.phase !== "player") return false;
    this.set(stand(this.current));
    return true;
  }

  double(): boolean {
    const r = this.current;
    if (!r || !canDouble(r) || this.bank.gold() < r.bet) return false;
    if (!this.bank.take(r.bet)) return false;
    this.set(doubleDown(r, this.shoe, this.rand));
    return true;
  }

  get canDouble(): boolean {
    return !!this.current && canDouble(this.current) && this.bank.gold() >= this.current.bet;
  }

  /** One dealer step (called on a timer so the dealer "thinks"). Returns
   * true while the dealer still has work to do. */
  dealerStep(): boolean {
    const r = this.current;
    if (r?.phase !== "dealer") return false;
    if (dealerShouldDraw(r)) {
      this.set(dealerDraw(r, this.shoe, this.rand));
      return true;
    }
    this.set(settle(r));
    return false;
  }

  /** Walking away: play the hand out instantly (standing on what you have). */
  resolveNow(): void {
    const r = this.current;
    if (!r || r.phase === "done") return;
    this.set(finishDealer(r.phase === "player" ? stand(r) : r, this.shoe, this.rand));
  }

  private set(next: Round) {
    let r = next;
    if (r.phase === "done" && !this.paid) {
      this.paid = true;
      r = applyLuckyPush(r, this.luckyPush(), this.rand);
      if (r.payout > 0) this.bank.give(r.payout);
      this.current = r;
      this.onSettled({ round: r, net: r.payout - r.bet });
    } else this.current = r;
    this.version++;
    for (const fn of Array.from(this.listeners)) fn();
  }
}
