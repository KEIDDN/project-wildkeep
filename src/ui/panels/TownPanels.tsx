import { hasPerk } from "../../game/relationships";
import { drink, soberUp } from "../../game/tavern/drink";
import { currentTutorialStep } from "../../store/tutorialStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useTownStore } from "../../store/townStore";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore } from "../../store/uiStore";
import { useSocialStore } from "../../store/socialStore";
import { useTimeStore } from "../../store/timeStore";
import { audio } from "../../game/audio/AudioManager";
import { Panel } from "../components/Panel";
import { EmptySlot, ItemIcon } from "../components/ItemIcon";
import { sortStacks } from "./InventoryPanel";
import { houseLevelInfo } from "../../data/house";
import { houseUpgradeBlocker, upgradeHouse } from "../../game/actions";
import { getItem } from "../../data/items";
import { adjustHonor } from "../../game/social/honor";
import { eventActive } from "../../game/social/worldEvents";
import { houseDescription, houseName, housePerks, itemName } from "../../i18n/content";
import { t, type TKey } from "../../i18n";
import type { InventoryStack } from "../../game/save/schema";

/** The storage trunk in your cottage: click to move stacks across. */
export function StashPanel() {
  const bag = useInventoryStore((s) => s.stacks);
  const stash = useTownStore((s) => s.stash);
  const houseLevel = useTownStore((s) => s.buildingLevels.house ?? 1);
  const slots = houseLevelInfo(houseLevel).perks.stashSlots;

  const deposit = (s: InventoryStack) => {
    const merges = getItem(s.itemId).stackable && stash.some((x) => x.itemId === s.itemId && !!x.stolen === !!s.stolen);
    if (!merges && stash.length >= slots) {
      audio.sfx("deny");
      useUiStore.getState().pushToast(t("toast.trunkFull"), "warning");
      return;
    }
    if (useInventoryStore.getState().removeItem(s.itemId, s.quantity, s.stolen ? "stolen" : "clean")) {
      useTownStore.getState().depositToStash(s.itemId, s.quantity, !!s.stolen);
      audio.sfx("ui");
    }
  };
  const withdraw = (s: InventoryStack) => {
    if (useTownStore.getState().withdrawFromStash(s.itemId, s.quantity, !!s.stolen)) {
      useInventoryStore.getState().addItem(s.itemId, s.quantity, { stolen: !!s.stolen });
      audio.sfx("ui");
    }
  };

  return (
    <Panel title={t("stash.title")} subtitle={t("stash.subtitle", { used: stash.length, total: slots })} icon="chest" width={720}>
      <div className="stash-layout">
        <div>
          <div className="section-title">{t("stash.bag")}</div>
          <div className="bag-grid small">
            {sortStacks(bag).map((s, i) => (
              <ItemIcon key={`${s.itemId}-${i}`} itemId={s.itemId} quantity={s.quantity} stolen={s.stolen} size={44} onClick={() => deposit(s)} />
            ))}
            {Array.from({ length: Math.max(0, 24 - bag.length) }, (_, i) => (
              <EmptySlot key={i} size={44} />
            ))}
          </div>
        </div>
        <div className="stash-arrow">⇄</div>
        <div>
          <div className="section-title">{t("stash.trunk")}</div>
          <div className="bag-grid small">
            {sortStacks(stash).map((s, i) => (
              <ItemIcon key={`${s.itemId}-${i}`} itemId={s.itemId} quantity={s.quantity} stolen={s.stolen} size={44} onClick={() => withdraw(s)} />
            ))}
            {Array.from({ length: Math.max(0, slots - stash.length) }, (_, i) => (
              <EmptySlot key={i} size={44} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

const MENU: { id: "stew" | "ale" | "stout" | "spirits" | "round"; price: number; icon: string; name: TKey; desc: TKey }[] = [
  { id: "stew", price: 12, icon: "stew", name: "tavern.stew", desc: "tavern.stewDesc" },
  { id: "ale", price: 4, icon: "beer", name: "tavern.ale", desc: "tavern.aleDesc" },
  { id: "stout", price: 9, icon: "tankard", name: "tavern.stout", desc: "tavern.stoutDesc" },
  { id: "spirits", price: 16, icon: "potion_greater", name: "tavern.spirits", desc: "tavern.spiritsDesc" },
  { id: "round", price: 40, icon: "tankard", name: "tavern.round", desc: "tavern.roundDesc" },
];

/** Greta's menu. Festival days are half price. A round for the house buys
 * a little Honor (once a day — the village isn't *that* easily bought). */
export function TavernPanel() {
  const gold = usePlayerStore((s) => s.gold);
  const festival = eventActive("festival");
  const firstAle = currentTutorialStep()?.id === "drink";
  const priceOf = (base: number, id?: string) => (firstAle && id === "ale" ? 0 : Math.ceil((festival ? base / 2 : base) * (hasPerk("greta_discount") ? 0.75 : 1)));
  const order = (id: (typeof MENU)[number]["id"], price: number) => {
    const p = usePlayerStore.getState();
    if (!p.spendGold(price)) {
      audio.sfx("deny");
      useUiStore.getState().pushToast(t("toast.gretaEyebrow"), "warning");
      return;
    }
    audio.sfx(id === "round" ? "levelup" : "potion");
    if (id === "stew") {
      p.fullHeal();
      soberUp(25);
      useUiStore.getState().pushToast(t("toast.stewRestored"), "info");
    } else if (id === "ale" || id === "stout" || id === "spirits") {
      if (drink(id)) useUiStore.getState().closePanel();
      else useUiStore.getState().pushToast(t(`tavern.${id}Toast`), "info", { icon: "beer" });
    } else {
      drink("round");
      const social = useSocialStore.getState();
      social.addDeed("roundsBought");
      useUiStore.getState().pushToast(t("tavern.roundToast"), "levelup", { icon: "beer" });
      const day = useTimeStore.getState().day;
      if (!social.usedToday("round", day)) {
        social.useToday("round", day);
        adjustHonor(3);
      }
    }
  };
  return (
    <Panel title={t("tavern.title")} subtitle={t("tavern.subtitle")} icon="beer" width={540}>
      <div className="row-list">
        {MENU.map((m) => {
          const price = priceOf(m.price, m.id);
          return (
            <div className="shop-row" key={m.id}>
              <img className="menu-icon" src={`/icons/${m.icon}.png`} alt="" />
              <div className="shop-row-name">
                <span>{t(m.name)}</span>
                <small>{t(m.desc)}</small>
              </div>
              <button type="button" className="btn btn-small price-btn" disabled={gold < price} onClick={() => order(m.id, price)}>
                <img src="/icons/gold_coin.png" alt="" /> {price}
                {festival && <s className="old-price">{m.price}</s>}
              </button>
            </div>
          );
        })}
        <div className="shop-row">
          <img className="menu-icon" src="/icons/coin_bag.png" alt="" />
          <div className="shop-row-name">
            <span>{t("tavern.casino")}</span>
            <small>{t("tavern.casinoDesc")}</small>
          </div>
          <button type="button" className="btn btn-small" onClick={() => useUiStore.getState().openPanel("blackjack")}>
            {t("tavern.play")}
          </button>
        </div>
      </div>
    </Panel>
  );
}

/** Home improvements: see what the next level costs and gives. */
export function HousePanel() {
  const level = useTownStore((s) => s.buildingLevels.house ?? 1);
  const gold = usePlayerStore((s) => s.gold);
  useInventoryStore((s) => s.stacks);
  const next = level < 4 ? houseLevelInfo(level + 1) : null;
  const blocker = houseUpgradeBlocker();
  return (
    <Panel title={t("house.title")} subtitle={t("house.current", { name: houseName(level), n: level })} icon="house" width={620}>
      <div className="house-levels">
        {[1, 2, 3, 4].map((l) => (
          <div key={l} className={`house-pip${l <= level ? " done" : ""}${l === level + 1 ? " next" : ""}`}>
            <img src={`/icons/house.png`} alt="" />
            <span>{houseName(l)}</span>
          </div>
        ))}
      </div>
      <div className="section-title">{t("house.youHave")}</div>
      <ul className="perk-list">
        {housePerks(level).map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {next ? (
        <>
          <div className="section-title">{t("house.next", { name: houseName(next.level) })}</div>
          <p className="hint">{houseDescription(next.level)}</p>
          <ul className="perk-list next">
            {housePerks(next.level).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="materials">
            {next.cost!.materials.map((m) => {
              const have = useInventoryStore.getState().quantityOf(m.itemId);
              return (
                <span key={m.itemId} className={`mat${have >= m.quantity ? "" : " missing"}`} title={itemName(m.itemId)}>
                  <img src={`/icons/${getItem(m.itemId).icon}.png`} alt="" />
                  {have}/{m.quantity}
                </span>
              );
            })}
            <span className={`mat${gold >= next.cost!.gold ? "" : " missing"}`}>
              <img src="/icons/gold_coin.png" alt="" />
              {next.cost!.gold}
            </span>
          </div>
          <button type="button" className="btn btn-big" disabled={!!blocker} onClick={() => upgradeHouse() && useUiStore.getState().closePanel()}>
            {blocker ?? t("house.upgradeTo", { name: houseName(next.level) })}
          </button>
          <p className="hint">{t("house.hint")}</p>
        </>
      ) : (
        <p className="hint">{t("house.done")}</p>
      )}
    </Panel>
  );
}
