import { SPECIALISTS, type SpecialistId } from "../../data/shops";
import { useEffect, useRef, useState } from "react";
import { useInventoryStore } from "../../store/inventoryStore";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore } from "../../store/uiStore";
import { useSocialStore } from "../../store/socialStore";
import { getItem, type ItemDef } from "../../data/items";
import { GENERAL_STORE_STOCK } from "../../data/shops";
import { MYSTERY_STOCK, TRAVELLING_STOCK } from "../../data/worldEvents";
import { MERCHANTS, merchantStock, type StockLine } from "../../data/merchants";
import { getNpc } from "../../data/npcs";
import { useTimeStore } from "../../store/timeStore";
import { npcName } from "../../i18n/content";
import { audio } from "../../game/audio/AudioManager";
import { sellItem, shopBuyPrice, shopSellPrice, stolenSellPrice, unsellableReason } from "../../game/actions";
import { buyPriceFactor } from "../../game/social/honor";
import { gameEvents } from "../../game/events";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";
import { sortStacks } from "./InventoryPanel";
import { RARITY_INK, rarityRank } from "../../game/core/types";
import { itemDesc, itemName } from "../../i18n/content";
import { fmt, t } from "../../i18n";
import type { InventoryStack } from "../../game/save/schema";

type Stock = "general" | "travelling" | "mystery" | "merchant" | "fence" | SpecialistId;

const STOCKS: Record<Exclude<Stock, "merchant" | "fence" | SpecialistId>, StockLine[]> = {
  general: GENERAL_STORE_STOCK,
  travelling: TRAVELLING_STOCK,
  mystery: MYSTERY_STOCK,
};

/** Selling rare+ gear asks twice. */
const needsConfirm = (def: ItemDef) => !def.stackable && rarityRank(def.rarity) >= 2;

/**
 * A shop counter. Opened by talking to a shopkeeper (never from the street).
 * Mira's store buys and sells; travelling traders only sell.
 */
export function ShopPanel() {
  const stock = ((useUiStore((s) => s.panelData.stock) as Stock | undefined) ?? "general") as Stock;
  const merchantId = useUiStore((s) => s.panelData.merchant) as string | undefined;
  const day = useTimeStore((s) => s.day);
  const fence = stock === "fence";
  const spec = stock in SPECIALISTS ? SPECIALISTS[stock as SpecialistId] : null;
  const rate = spec?.rate ?? 1;
  const lines: StockLine[] = fence ? [] : spec ? [...spec.stock] : stock === "merchant" ? merchantStock(merchantId ?? "", day) : STOCKS[stock as keyof typeof STOCKS];
  const canSell = stock === "general" || fence || !!spec;
  const [tab, setTab] = useState<"sell" | "buy">(canSell ? "sell" : "buy");
  const [confirm, setConfirm] = useState<string | null>(null);
  const stacks = useInventoryStore((s) => s.stacks);
  const gold = usePlayerStore((s) => s.gold);
  const equipment = usePlayerStore((s) => s.equipment);
  const honor = useSocialStore((s) => s.honor);

  const sorted = sortStacks(stacks);
  const wanted = (id: string) => !spec || (spec.buys as readonly string[]).includes(id);
  const sellable = sorted.filter((s) => wanted(s.itemId) && !unsellableReason(s.itemId, !!s.stolen, fence) && !(spec && s.stolen));
  const kept = fence || spec ? [] : sorted.filter((s) => unsellableReason(s.itemId, !!s.stolen));
  const unitOf = (s: InventoryStack) => (s.stolen ? stolenSellPrice(s.itemId, fence) : Math.round(shopSellPrice(s.itemId) * rate));
  const materials = fence ? [] : sellable.filter((s) => getItem(s.itemId).category === "resource" && !s.stolen);
  const materialsTotal = materials.reduce((sum, s) => sum + Math.round(shopSellPrice(s.itemId) * rate) * s.quantity, 0);
  const worn = Object.values(equipment).filter((id): id is string => !!id);

  const sell = (s: InventoryStack, qty: number) => {
    const def = getItem(s.itemId);
    const key = `${s.itemId}:${qty}`;
    if (needsConfirm(def) && confirm !== key) {
      setConfirm(key);
      audio.sfx("ui");
      return;
    }
    setConfirm(null);
    const earned = sellItem(s.itemId, qty, !!s.stolen, fence, rate);
    if (earned > 0) {
      audio.sfx("coin");
      useUiStore.getState().pushToast(t("toast.sold", { item: `${qty > 1 ? `${qty}× ` : ""}${itemName(s.itemId)}`, gold: fmt(earned) }), "gold", { icon: def.icon });
    } else audio.sfx("deny");
  };

  const sellAllMaterials = () => {
    if (!materials.length) return;
    let total = 0;
    for (const s of materials) total += sellItem(s.itemId, s.quantity, false, false, rate);
    audio.sfx("coin");
    useUiStore.getState().pushToast(t("toast.soldAll", { gold: fmt(total) }), "gold", { icon: "coin_bag" });
  };

  const buy = (itemId: string, price: number) => {
    if (!usePlayerStore.getState().spendGold(price)) {
      audio.sfx("deny");
      useUiStore.getState().pushToast(t("toast.notEnoughGold"), "warning");
      return;
    }
    useInventoryStore.getState().addItem(itemId, 1);
    audio.sfx("coin");
    useUiStore.getState().pushToast(t("toast.bought", { item: itemName(itemId) }), "loot", { icon: getItem(itemId).icon, rarity: getItem(itemId).rarity });
    gameEvents.emit("itemBought", { itemId });
  };

  const factor = buyPriceFactor(honor);
  const merchant = stock === "merchant" && merchantId ? MERCHANTS[merchantId] : null;
  const title = fence
    ? t("rep.fence.title")
    : spec
    ? npcName(getNpc(spec.npc))
    : merchant
    ? npcName(getNpc(merchant.npc))
    : stock === "general"
      ? t("shop.title")
      : stock === "travelling"
        ? t("worldEvent.merchant.title")
        : t("worldEvent.stranger.title");
  const subtitle = fence ? t("rep.fence.subtitle") : spec ? t(stock === "hunter" ? "shop.hunterSubtitle" : "shop.anglerSubtitle") : merchant ? t("shop.merchantToday") : stock === "general" ? t("shop.subtitle") : stock === "travelling" ? t("worldEvent.merchant.desc") : t("worldEvent.stranger.desc");

  return (
    <Panel title={title} subtitle={subtitle} icon="coin_bag" width={660}>
      <div className="shop-header">
        <div className="tabs">
          {canSell && (
            <button type="button" className={`tab${tab === "sell" ? " active" : ""}`} onClick={() => setTab("sell")}>
              {t("shop.sell")}
            </button>
          )}
          <button type="button" className={`tab${tab === "buy" ? " active" : ""}`} onClick={() => setTab("buy")}>
            {t("shop.buy")}
          </button>
        </div>
        <Purse gold={gold} />
      </div>

      {tab === "sell" && canSell && (
        <>
          <button type="button" className="btn btn-big" disabled={!materials.length} onClick={sellAllMaterials}>
            {t("shop.sellAllMaterials")} <span className="btn-note">+{fmt(materialsTotal)}g</span>
          </button>
          <div className="row-list">
            {sorted.length === 0 && <div className="empty-hint">{t("shop.emptyBag")}</div>}
            {sorted.length > 0 && sellable.length === 0 && <div className="empty-hint">{t("shop.nothingSellable")}</div>}
            {sellable.map((s, i) => {
              const def = getItem(s.itemId);
              const unit = unitOf(s);
              const confirming = confirm?.startsWith(`${s.itemId}:`);
              return (
                <div className={`shop-row${confirming ? " confirming" : ""}`} key={`${s.itemId}-${i}`}>
                  <ItemIcon itemId={s.itemId} quantity={s.quantity} stolen={s.stolen} size={40} />
                  <div className="shop-row-name">
                    <span style={{ color: RARITY_INK[def.rarity] }}>{itemName(s.itemId)}</span>
                    <small>{confirming ? t("shop.confirmSell", { item: itemName(s.itemId), rarity: t(`common.rarity.${def.rarity}`).toLowerCase(), category: t(`common.category.${def.category}`) }) : t("shop.each", { n: fmt(unit) })}</small>
                  </div>
                  <button type="button" className={`btn btn-small${confirming ? " danger" : ""}`} onClick={() => sell(s, 1)}>
                    {confirming ? t("shop.confirm") : t("shop.sellOne")}
                  </button>
                  {s.quantity > 1 && (
                    <button type="button" className="btn btn-small" onClick={() => sell(s, s.quantity)}>
                      {t("shop.sellAll", { n: fmt(unit * s.quantity) })}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {(kept.length > 0 || worn.length > 0) && (
            <>
              <div className="section-title">{t("shop.kept")}</div>
              <div className="row-list kept">
                {worn.map((id) => (
                  <KeptRow key={`worn-${id}`} itemId={id} reason={t("shop.reason.equipped")} />
                ))}
                {kept.map((s, i) => (
                  <KeptRow key={`kept-${s.itemId}-${i}`} itemId={s.itemId} quantity={s.quantity} stolen={s.stolen} reason={t(`shop.reason.${unsellableReason(s.itemId, !!s.stolen)!}`)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "buy" && (
        <>
          {factor !== 1 && <div className={`hint honor-note${factor < 1 ? " good" : " bad"}`}>{factor < 1 ? t("shop.honorDiscount", { pct: Math.round((1 - factor) * 100) }) : t("shop.honorMarkup", { pct: Math.round((factor - 1) * 100) })}</div>}
          <div className="row-list">
            {lines.map(({ itemId, price: base, deal }) => {
              const def = getItem(itemId);
              const price = shopBuyPrice(base, { mira: stock === "general" });
              const afford = gold >= price;
              return (
                <div className="shop-row" key={itemId}>
                  <ItemIcon itemId={itemId} size={40} />
                  <div className="shop-row-name">
                    <span style={{ color: RARITY_INK[def.rarity] }}>
                      {itemName(itemId)} {deal && <span className="deal-tag">{t("shop.deal")}</span>}
                    </span>
                    <small>{itemDesc(itemId)}</small>
                  </div>
                  <button type="button" className="btn btn-small price-btn" disabled={!afford} title={afford ? undefined : t("shop.cantAfford")} onClick={() => buy(itemId, price)}>
                    <img src="/icons/gold_coin.png" alt="" /> {fmt(price)}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

function KeptRow({ itemId, quantity, stolen, reason }: { itemId: string; quantity?: number; stolen?: boolean; reason: string }) {
  return (
    <div className="shop-row kept-row">
      <ItemIcon itemId={itemId} quantity={quantity} stolen={stolen} size={32} dim />
      <div className="shop-row-name">
        <span>{itemName(itemId)}</span>
        <small>{reason}</small>
      </div>
      <span className="kept-tag">{t("shop.notSellable")}</span>
    </div>
  );
}

/** Your gold, with a little pop when it changes. */
function Purse({ gold }: { gold: number }) {
  const prev = useRef(gold);
  const [delta, setDelta] = useState<{ n: number; id: number } | null>(null);
  useEffect(() => {
    const d = gold - prev.current;
    prev.current = gold;
    if (d !== 0) setDelta({ n: d, id: performance.now() });
  }, [gold]);
  return (
    <div className="gold-pill" title={t("shop.purse")}>
      <img src="/icons/gold_coin.png" alt="" /> {fmt(gold)}
      {delta && (
        <span key={delta.id} className={`gold-delta ${delta.n > 0 ? "up" : "down"}`}>
          {delta.n > 0 ? "+" : ""}
          {fmt(delta.n)}
        </span>
      )}
    </div>
  );
}
