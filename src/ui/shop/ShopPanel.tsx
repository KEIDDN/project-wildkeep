import { useInventoryStore } from "../../store/inventoryStore";
import { usePlayerStore } from "../../store/playerStore";
import { useGameStore } from "../../store/gameStore";
import { getItem } from "../../data/items";
import { computeRelicEffects } from "../../game/systems/statsSystem";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";

const SELLABLE_CATEGORIES = new Set(["resource"]);
const POTION_PRICE = 15;

export function ShopPanel() {
  const stacks = useInventoryStore((s) => s.stacks);
  const gold = usePlayerStore((s) => s.gold);
  const equipment = usePlayerStore((s) => s.equipment);
  const relicEffects = computeRelicEffects(equipment);

  const sellable = stacks.filter((s) => SELLABLE_CATEGORIES.has(getItem(s.itemId).category));

  function sellAll(itemId: string) {
    const stack = useInventoryStore.getState().stacks.find((s) => s.itemId === itemId);
    if (!stack) return;
    const def = getItem(itemId);
    const total = Math.round(stack.quantity * def.value * (1 + relicEffects.sellValueBonus));
    useInventoryStore.getState().removeItem(itemId, stack.quantity);
    usePlayerStore.getState().earnGold(total);
    useGameStore.getState().pushToast(`Sold ${stack.quantity} ${def.name} for ${total}g`, "info");
  }

  function buyPotion() {
    if (!usePlayerStore.getState().spendGold(POTION_PRICE)) {
      useGameStore.getState().pushToast("Not enough gold.", "warning");
      return;
    }
    useInventoryStore.getState().addItem("health_potion", 1);
    useGameStore.getState().pushToast("Bought a Health Potion", "info");
  }

  return (
    <Panel title="General Store" onClose={() => useGameStore.getState().closePanel()} width={480}>
      <div className="shop-gold">Your Gold: {gold}g</div>

      <div className="shop-section-title">Sell Resources</div>
      <div className="shop-list">
        {sellable.length === 0 && <div className="empty-hint">Nothing to sell yet.</div>}
        {sellable.map((s) => {
          const def = getItem(s.itemId);
          const unitPrice = Math.round(def.value * (1 + relicEffects.sellValueBonus));
          return (
            <div className="shop-row" key={s.itemId}>
              <ItemIcon icon={def.icon} rarity={def.rarity} quantity={s.quantity} size={32} />
              <span className="shop-row-name">{def.name}</span>
              <span className="shop-row-price">{unitPrice}g ea</span>
              <button onClick={() => sellAll(s.itemId)}>Sell All</button>
            </div>
          );
        })}
      </div>

      <div className="shop-section-title">Buy</div>
      <div className="shop-row">
        <ItemIcon icon={getItem("health_potion").icon} rarity="common" size={32} />
        <span className="shop-row-name">Health Potion</span>
        <span className="shop-row-price">{POTION_PRICE}g</span>
        <button onClick={buyPotion}>Buy</button>
      </div>
    </Panel>
  );
}
