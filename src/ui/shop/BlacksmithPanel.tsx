import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useGameStore } from "../../store/gameStore";
import { getItem } from "../../data/items";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";

const STOCK = ["iron_sword", "iron_armor", "iron_axe", "iron_pickaxe"];

export function BlacksmithPanel() {
  const gold = usePlayerStore((s) => s.gold);
  const ownedTools = useInventoryStore((s) => s.stacks);
  const equipment = usePlayerStore((s) => s.equipment);

  function owns(itemId: string) {
    return (
      Object.values(equipment).includes(itemId) ||
      ownedTools.some((s) => s.itemId === itemId)
    );
  }

  function buy(itemId: string) {
    const def = getItem(itemId);
    if (owns(itemId)) {
      useGameStore.getState().pushToast("You already own this.", "info");
      return;
    }
    if (!usePlayerStore.getState().spendGold(def.value)) {
      useGameStore.getState().pushToast("Not enough gold.", "warning");
      return;
    }
    useInventoryStore.getState().addItem(itemId, 1);
    if (def.equipSlot) usePlayerStore.getState().equip(def.equipSlot, itemId);
    useGameStore.getState().pushToast(`Forged and equipped ${def.name}!`, "info");
  }

  return (
    <Panel title="Blacksmith" onClose={() => useGameStore.getState().closePanel()} width={460}>
      <div className="shop-gold">Your Gold: {gold}g</div>
      <div className="shop-list">
        {STOCK.map((itemId) => {
          const def = getItem(itemId);
          const already = owns(itemId);
          return (
            <div className="shop-row" key={itemId}>
              <ItemIcon icon={def.icon} rarity={def.rarity} size={32} />
              <div className="shop-row-name">
                <div>{def.name}</div>
                <div className="shop-row-desc">{def.description}</div>
              </div>
              <span className="shop-row-price">{def.value}g</span>
              <button disabled={already} onClick={() => buy(itemId)}>
                {already ? "Owned" : "Buy"}
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
