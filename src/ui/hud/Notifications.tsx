import { shopSellPrice } from "../../game/actions";
import { useEffect, useRef } from "react";
import { useUiStore } from "../../store/uiStore";
import { getItem } from "../../data/items";
import { RARITY_COLOR } from "../../game/core/types";
import { itemDesc, itemName } from "../../i18n/content";
import { t } from "../../i18n";

export function ToastList() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  const scheduled = useRef(new Set<number>());

  useEffect(() => {
    for (const t of toasts) {
      if (scheduled.current.has(t.id)) continue;
      scheduled.current.add(t.id);
      setTimeout(() => {
        scheduled.current.delete(t.id);
        dismiss(t.id);
      }, t.kind === "levelup" ? 4200 : 3000);
    }
  }, [toasts, dismiss]);

  return (
    <div className="toast-list">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} style={t.rarity ? { borderColor: RARITY_COLOR[t.rarity] } : undefined}>
          {t.icon && <img src={`/icons/${t.icon}.png`} alt="" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Big centered reveal for rare / epic / legendary drops, one at a time. */
export function LootRevealQueue() {
  const reveals = useUiStore((s) => s.lootReveals);
  const dismiss = useUiStore((s) => s.dismissLootReveal);
  const current = reveals[0];

  useEffect(() => {
    if (!current) return;
    const def = getItem(current.itemId);
    const ms = def.rarity === "legendary" ? 3600 : def.rarity === "epic" ? 3000 : 2300;
    const t = setTimeout(() => dismiss(current.id), ms);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  if (!current) return null;
  const def = getItem(current.itemId);
  const color = RARITY_COLOR[def.rarity];
  return (
    <div className={`loot-reveal loot-${def.rarity}`} key={current.id} style={{ ["--rarity" as string]: color }} onClick={() => dismiss(current.id)}>
      <div className="loot-rays" />
      <div className="loot-rarity">{t(`common.rarity.${def.rarity}`)}!</div>
      <div className="loot-icon">
        <img src={`/icons/${def.icon}.png`} alt="" />
      </div>
      <div className="loot-name">
        {itemName(def.id)}
        {current.quantity > 1 && <span className="loot-qty"> ×{current.quantity}</span>}
      </div>
      <div className="loot-desc">{itemDesc(def.id)}</div>
      {def.value > 0 && !def.keyItem && <div className="loot-value">{t("loot.worth", { n: shopSellPrice(def.id) })}</div>}
    </div>
  );
}

export function AreaBanner() {
  const banner = useUiStore((s) => s.areaBanner);
  if (!banner) return null;
  return (
    <div className="area-banner" key={banner.id}>
      <div className="area-banner-title">{banner.title}</div>
      {banner.subtitle && <div className="area-banner-sub">{banner.subtitle}</div>}
    </div>
  );
}

export function FadeOverlay() {
  const fading = useUiStore((s) => s.fading);
  return <div className={`fade-overlay${fading ? " on" : ""}`} />;
}
