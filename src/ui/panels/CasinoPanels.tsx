import { drunkLimitMult } from "../../game/tavern/drink";
import { hasPerk } from "../../game/relationships";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useWorldStore } from "../../store/worldStore";
import { audio } from "../../game/audio/AudioManager";
import { Panel } from "../components/Panel";
import { handValue, rankLabel, type Card } from "../../game/casino/blackjack";
import { HIGH_STAKES_LEVEL, ROULETTE_LEVEL, blackjackTable as table, rouletteTable as wheel } from "../../game/casino/tables";
import { WHEEL, colourOf, type BetKind, type Colour } from "../../game/casino/roulette";
import { useUiStore } from "../../store/uiStore";
import { maxBetFor } from "../../game/systems/skills";
import { tableLimitMult } from "../../data/talents";
import { CASINO_GAMES } from "../../game/casino/registry";
import { t } from "../../i18n";

const CHIPS = [5, 10, 25, 50, 100, 250, 500, 1000];

/**
 * The Gilded Gamble's Blackjack table. All state lives in the
 * BlackjackTable (game/casino); this component renders it and paces the
 * dealer, one card at a time.
 */
export function BlackjackPanel() {
  useSyncExternalStore(table.subscribe, table.getVersion);
  const gold = usePlayerStore((s) => s.gold);
  const gambling = usePlayerStore((s) => s.skills.gambling);
  const stats = useWorldStore((s) => s.stats);
  const highStakes = !!useUiStore((s) => s.panelData.highStakes);
  const maxBet = maxBetFor(gambling.level) * (highStakes ? 2 : 1) * tableLimitMult(usePlayerStore.getState().talents) * (hasPerk("silas_limit") ? 1.5 : 1) * drunkLimitMult();
  const [bet, setBet] = useState(10);
  const round = table.round;
  const phase = round?.phase;
  const stake = Math.min(bet, maxBet);

  // Dealer draws on a timer so the reveal has some suspense.
  useEffect(() => {
    if (phase !== "dealer") return;
    const t = setTimeout(() => {
      if (table.dealerStep()) audio.sfx("card");
    }, 520);
    return () => clearTimeout(t);
  }, [phase, round]);

  // Walking away mid-hand stands on what you have.
  useEffect(() => () => table.resolveNow(), []);

  const act = (ok: boolean, sound: "card" | "deny" = "card") => audio.sfx(ok ? sound : "deny");
  const inHand = table.inHand;
  const betOk = stake > 0 && stake <= gold;
  const hideHole = phase === "player";
  const net = phase === "done" && round ? round.payout - round.bet : 0;

  return (
    <Panel title={t("casino.bjTitle")} subtitle={t("casino.bjSubtitle")} icon="coin_bag" width={640} className="casino">
      <div className="bj-table">
        <div className="bj-row">
          <div className="bj-label">
            {t("casino.dealer")} {round && <b>{hideHole ? handValue([round.dealer[0]]).total : handValue(round.dealer).total}</b>}
          </div>
          <div className="bj-hand">
            {round ? round.dealer.map((c, i) => <PlayingCard key={i} card={c} hidden={hideHole && i === 1} index={i} />) : <div className="bj-empty">{t("casino.placeBet")}</div>}
          </div>
        </div>
        <div className={`bj-result ${phase === "done" ? (net > 0 ? "win" : net === 0 ? "push" : "lose") : ""}`}>
          {!round
            ? t("casino.beatDealer")
            : phase === "done"
              ? `${round.luckyPush ? t("casino.luckyPush") : t(`casino.outcome.${round.outcome!}`)} ${net > 0 ? `+${net}g` : net < 0 ? `${net}g` : ""}`
              : phase === "dealer"
                ? t("casino.dealerDraws")
                : t("casino.hitOrStand")}
        </div>
        <div className="bj-row">
          <div className="bj-label">
            {t("casino.you")} {round && <b>{handValue(round.player).total}</b>}
            {round?.doubled && <span className="bj-tag">{t("casino.doubled")}</span>}
          </div>
          <div className="bj-hand">
            {round?.player.map((c, i) => (
              <PlayingCard key={i} card={c} index={i} />
            ))}
          </div>
        </div>
      </div>

      {inHand ? (
        <div className="bj-actions">
          <button type="button" className="btn btn-big" disabled={phase !== "player"} onClick={() => act(table.hit())}>
            {t("casino.hit")}
          </button>
          <button type="button" className="btn btn-big" disabled={phase !== "player"} onClick={() => act(table.stand(), "card")}>
            {t("casino.stand")}
          </button>
          <button type="button" className="btn btn-big" disabled={!table.canDouble} onClick={() => act(table.double())}>
            {t("casino.double")}
          </button>
        </div>
      ) : (
        <>
          <div className="bet-row">
            {CHIPS.map((c) => (
              <button
                type="button"
                key={c}
                className={`chip${stake === c ? " active" : ""}`}
                disabled={c > maxBet || c > gold}
                title={c > maxBet ? t("casino.limitTip", { level: gambling.level, max: maxBet }) : undefined}
                onClick={() => setBet(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-big" disabled={!betOk} onClick={() => act(table.deal(stake, maxBet))}>
            {gold < stake ? t("casino.notEnough") : round ? t("casino.dealAgain", { n: stake }) : t("casino.deal", { n: stake })}
          </button>
        </>
      )}
      <div className="casino-stats">{t("casino.stats", { level: gambling.level, max: maxBet, won: stats.goldWonGambling, lost: stats.goldLostGambling, gold })}</div>
    </Panel>
  );
}

const SUIT_GLYPH = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" } as const;

function PlayingCard({ card, hidden, index }: { card: Card; hidden?: boolean; index: number }) {
  if (hidden) return <div className="pcard back" style={{ animationDelay: `${index * 0.08}s` }} />;
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const glyph = SUIT_GLYPH[card.suit];
  return (
    <div className={`pcard${red ? " red" : ""}`} style={{ animationDelay: `${index * 0.08}s` }}>
      <span className="pcard-corner">
        {rankLabel(card.rank)}
        <br />
        {glyph}
      </span>
      <span className="pcard-pip">{glyph}</span>
      <span className="pcard-corner flip">
        {rankLabel(card.rank)}
        <br />
        {glyph}
      </span>
    </div>
  );
}

const GLYPH: Record<Colour, string> = { crimson: "✦", shadow: "☾", dragon: "♛" };
const POCKET_COLOUR: Record<Colour, string> = { crimson: "#9a2a2a", shadow: "#23202c", dragon: "#b8862a" };

/**
 * Madame Vex's Wheel of Fates. The table (game/casino/roulette) decides the
 * pocket the moment you spin; the wheel then turns to it and the purse is
 * only paid once it stops.
 */
export function RoulettePanel() {
  useSyncExternalStore(wheel.subscribe, wheel.getVersion);
  const gold = usePlayerStore((s) => s.gold);
  const gambling = usePlayerStore((s) => s.skills.gambling);
  const highStakes = !!useUiStore((s) => s.panelData.highStakes);
  const limit = maxBetFor(gambling.level) * (highStakes ? 2 : 1) * tableLimitMult(usePlayerStore.getState().talents) * (hasPerk("silas_limit") ? 1.5 : 1) * drunkLimitMult();
  const [chip, setChip] = useState(10);
  const [rotation, setRotation] = useState(0);
  const spin = wheel.spin;
  const spinning = wheel.spinning;

  // Walking away mid-spin still pays out what the wheel decided.
  useEffect(() => () => wheel.settle(), []);

  if (gambling.level < ROULETTE_LEVEL) {
    return (
      <Panel title={t("casino.wheelTitle")} subtitle={t("casino.wheelLocked")} icon="coin_bag" width={480} className="casino">
        <p className="hint">{t("casino.wheelLockedText", { need: ROULETTE_LEVEL, have: gambling.level })}</p>
      </Panel>
    );
  }

  const bet = (kind: BetKind, number?: number) => audio.sfx(wheel.place(kind, chip, limit, number) ? "coin" : "deny");
  const onSpin = () => {
    const result = wheel.spinWheel();
    if (result === null) {
      audio.sfx("deny");
      return;
    }
    audio.sfx("dice");
    const step = 360 / WHEEL.length;
    const idx = WHEEL.indexOf(result);
    // Turning the wheel by θ moves pocket i to angle i·step + θ, so the
    // result is under the pointer when θ ≡ -idx·step. Always spin clockwise:
    // five full turns plus whatever is left to reach that angle.
    const mod = (v: number) => ((v % 360) + 360) % 360;
    setRotation(rotation + 360 * 5 + mod(mod(-idx * step) - rotation));
    setTimeout(() => wheel.settle(), 3600);
  };

  const amountOn = (kind: BetKind, number?: number) => wheel.placed.find((b) => b.kind === kind && (kind !== "number" || b.number === number))?.amount;
  const net = spin?.settled ? spin.payout - spin.stake : 0;

  return (
    <Panel
      title={highStakes ? t("casino.backRoom") : t("casino.wheelTitle")}
      subtitle={`${t("casino.wheelSubtitle")}${highStakes ? t("casino.highStakes") : ""}`}
      icon="coin_bag"
      width={760}
      className="casino"
    >
      <div className="rl-layout">
        <div className="rl-wheel-wrap">
          <div className="rl-pointer" />
          <svg className="rl-wheel" viewBox="-100 -100 200 200" style={{ transform: `rotate(${rotation}deg)` }}>
            {WHEEL.map((n, i) => {
              const step = (Math.PI * 2) / WHEEL.length;
              const a0 = i * step - Math.PI / 2 - step / 2;
              const a1 = a0 + step;
              const p = (a: number, r: number) => `${Math.cos(a) * r},${Math.sin(a) * r}`;
              const mid = a0 + step / 2;
              const c = colourOf(n);
              return (
                <g key={n}>
                  <path d={`M0,0 L${p(a0, 92)} A92,92 0 0,1 ${p(a1, 92)} Z`} fill={POCKET_COLOUR[c]} stroke="#e8c070" strokeWidth="1" />
                  <text x={Math.cos(mid) * 76} y={Math.sin(mid) * 76} transform={`rotate(${(mid * 180) / Math.PI + 90} ${Math.cos(mid) * 76} ${Math.sin(mid) * 76})`} className="rl-num">
                    {n === 0 ? "♛" : n}
                  </text>
                  <text x={Math.cos(mid) * 56} y={Math.sin(mid) * 56} className="rl-glyph">
                    {GLYPH[c]}
                  </text>
                </g>
              );
            })}
            <circle r="40" fill="#5a3418" stroke="#e8c070" strokeWidth="3" />
            <circle r="12" fill="#e8c070" />
          </svg>
          <div className={`rl-result ${spin?.settled ? colourOf(spin.result) : ""}`}>
            {!spin
              ? t("casino.placeBets")
              : !spin.settled
                ? t("casino.wheelTurns")
                : `${spin.result === 0 ? t("casino.dragon") : `${spin.result} ${t(`casino.colour.${colourOf(spin.result)}`)}`} · ${net > 0 ? `+${net}g` : net < 0 ? `${net}g` : t("casino.even")}`}
          </div>
          <div className="rl-history">
            {wheel.recent.map((n, i) => (
              <span key={i} className={`rl-chip ${colourOf(n)}`}>
                {n === 0 ? "♛" : n}
              </span>
            ))}
          </div>
        </div>
        <div className="rl-board">
          <div className="rl-outside">
            {(["crimson", "shadow", "odd", "even"] as const).map((k) => (
              <button type="button" key={k} className={`rl-spot rl-${k}`} disabled={spinning} onClick={() => bet(k)}>
                {k === "crimson" ? `✦ ${t("casino.crimson")}` : k === "shadow" ? `☾ ${t("casino.shadow")}` : k === "odd" ? t("casino.odd") : t("casino.evenBet")}
                {amountOn(k) && <b className="rl-stake">{amountOn(k)}</b>}
              </button>
            ))}
          </div>
          <div className="rl-numbers">
            {[0, ...Array.from({ length: 18 }, (_, i) => i + 1)].map((n) => (
              <button type="button" key={n} className={`rl-num-spot ${colourOf(n)}`} disabled={spinning} onClick={() => bet("number", n)}>
                {n === 0 ? "♛" : n}
                {amountOn("number", n) && <b className="rl-stake">{amountOn("number", n)}</b>}
              </button>
            ))}
          </div>
          <div className="bet-row">
            {CHIPS.map((c) => (
              <button type="button" key={c} className={`chip${chip === c ? " active" : ""}`} disabled={c > limit || c > gold} onClick={() => setChip(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="choice-row">
            <button type="button" className="btn" disabled={spinning || !wheel.placed.length} onClick={() => wheel.clear()}>
              {t("casino.clear")}
            </button>
            <button type="button" className="btn btn-big" disabled={spinning || !wheel.placed.length || wheel.total > gold} onClick={onSpin}>
              {t("casino.spin", { n: wheel.total })}
            </button>
          </div>
        </div>
      </div>
      <div className="casino-stats">{t("casino.wheelStats", { level: gambling.level, max: limit, gold })}</div>
    </Panel>
  );
}

/** Silas's private room: the same games at twice the table limit. */
export function BackRoomPanel() {
  const gambling = usePlayerStore((s) => s.skills.gambling.level);
  const open = (panel: "blackjack" | "roulette") => useUiStore.getState().openPanel(panel, { highStakes: true });
  if (gambling < HIGH_STAKES_LEVEL)
    return (
      <Panel title={t("casino.backRoom")} subtitle={t("casino.membersOnly")} icon="key" width={440}>
        <p className="hint">{t("casino.bruteSays", { n: HIGH_STAKES_LEVEL })}</p>
      </Panel>
    );
  return (
    <Panel title={t("casino.backRoom")} subtitle={t("casino.backRoomSub")} icon="key" width={440}>
      <div className="choice-row">
        {CASINO_GAMES.filter((g) => g.highStakes).map((g) => (
          <button type="button" key={g.id} className="btn btn-big" onClick={() => open(g.panel as "blackjack" | "roulette")} disabled={gambling < g.minLevel}>
            {t(g.name)}
          </button>
        ))}
      </div>
    </Panel>
  );
}
