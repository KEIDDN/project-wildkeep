import { Panel } from "../components/Panel";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useUiStore } from "../../store/uiStore";
import { canAfford, repair, repairQuote, repairables, wearState, type Repairable } from "../../game/systems/durability";
import { getItem } from "../../data/items";
import { audio } from "../../game/audio/AudioManager";
import { itemName } from "../../i18n/content";
import { fmt, t } from "../../i18n";

/**
 * Bram's mending bench: everything worn or carried that isn't like new,
 * what it costs to fix (gold, plus an ingot for fine gear that's badly
 * worn), one button each or everything at once.
 */
export function RepairPanel() {
  // Re-render as things get fixed or paid for.
  usePlayerStore((s) => s.wear);
  usePlayerStore((s) => s.gold);
  useInventoryStore((s) => s.stacks);
  const list = repairables();
  const total = list.reduce((n, r) => n + (repairQuote(r.itemId, r.cur)?.gold ?? 0), 0);
  const fix = (r: Repairable) => {
    if (repair(r)) {
      audio.sfx("mine", { pitch: 1.2 });
      useUiStore.getState().pushToast(t("durability.repaired", { name: itemName(r.itemId) }), "info", { icon: getItem(r.itemId).icon });
    } else {
      audio.sfx("deny");
      useUiStore.getState().pushToast(t("durability.cantAfford"), "warning");
    }
  };
  const fixAll = () => {
    // Worn gear first, then the bag; re-read each time (indices shift).
    let done = 0;
    for (let guard = 0; guard < 40; guard++) {
      const next = repairables().find((r) => {
        const q = repairQuote(r.itemId, r.cur);
        return q && canAfford(q);
      });
      if (!next || !repair(next)) break;
      done++;
    }
    audio.sfx(done ? "mine" : "deny", { pitch: 1.2 });
    if (!done) useUiStore.getState().pushToast(t("durability.cantAfford"), "warning");
  };
  return (
    <Panel title={t("durability.repairTitle")} subtitle={t("durability.repairSubtitle")} icon="anvil" width={620}>
      {list.length === 0 ? (
        <p className="hint">{t("durability.nothing")}</p>
      ) : (
        <>
          <div className="repair-list">
            {list.map((r) => {
              const q = repairQuote(r.itemId, r.cur)!;
              const ws = wearState(r.cur, r.max);
              const def = getItem(r.itemId);
              return (
                <div className={`repair-row rarity-${def.rarity}`} key={r.key}>
                  <img src={`/icons/${def.icon}.png`} alt="" />
                  <div className="repair-name">
                    <b>{itemName(r.itemId)}</b>
                    {r.slot && <small> · {t("durability.equipped")}</small>}
                    <div className={`wearbar wear-${ws}`}>
                      <i style={{ width: `${(r.cur / r.max) * 100}%` }} />
                    </div>
                    <small className={`wear-${ws}`}>
                      {Math.floor(r.cur)}/{r.max} · {t(`durability.state.${ws}`)}
                    </small>
                  </div>
                  <span className="repair-cost">
                    {fmt(q.gold)}g{q.mats.length > 0 && ` ${t("durability.needs", { items: q.mats.map((m) => `${m.quantity}× ${itemName(m.itemId)}`).join(", ") })}`}
                  </span>
                  <button type="button" className="btn btn-small" disabled={!canAfford(q)} onClick={() => fix(r)}>
                    {t("durability.repair")}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="settings-actions">
            <button type="button" className="btn" onClick={fixAll}>
              {t("durability.repairAll", { n: fmt(total) })}
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
