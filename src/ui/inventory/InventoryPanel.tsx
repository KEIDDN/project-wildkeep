import { useState } from "react";
import { useInventoryStore } from "../../store/inventoryStore";
import { usePlayerStore } from "../../store/playerStore";
import { getItem, isEquipment } from "../../data/items";
import { RARITY_COLOR } from "../../game/core/types";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";
import { useGameStore } from "../../store/gameStore";

export function InventoryPanel() {
  const stacks = useInventoryStore((s) => s.stacks);
  const equip = usePlayerStore((s) => s.equip);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedStack = stacks.find((s) => s.itemId === selected);
  const selectedDef = selectedStack ? getItem(selectedStack.itemId) : null;

  function onUseOrEquip() {
    if (!selectedDef) return;
    if (isEquipment(selectedDef) && selectedDef.equipSlot) {
      equip(selectedDef.equipSlot, selectedDef.id);
      useGameStore.getState().pushToast(`Equipped ${selectedDef.name}`, "info");
    } else if (selectedDef.healAmount) {
      const removed = useInventoryStore.getState().removeItem(selectedDef.id, 1);
      if (removed) {
        usePlayerStore.getState().heal(selectedDef.healAmount);
        useGameStore.getState().pushToast(`Restored ${selectedDef.healAmount} HP`, "info");
      }
    }
  }

  return (
    <Panel title="Inventory" onClose={() => useGameStore.getState().closePanel()} width={480}>
      <div className="inventory-grid">
        {stacks.length === 0 && <div className="empty-hint">Your bag is empty. Go gather something!</div>}
        {stacks.map((stack) => {
          const def = getItem(stack.itemId);
          return (
            <ItemIcon
              key={stack.itemId}
              icon={def.icon}
              rarity={def.rarity}
              quantity={stack.quantity}
              selected={selected === stack.itemId}
              onClick={() => setSelected(stack.itemId)}
              title={def.name}
            />
          );
        })}
      </div>
      {selectedDef && (
        <div className="item-detail">
          <div className="item-detail-title" style={{ color: RARITY_COLOR[selectedDef.rarity] }}>
            {selectedDef.name}
          </div>
          <div className="item-detail-desc">{selectedDef.description}</div>
          {selectedDef.statBonus && (
            <div className="item-detail-stats">
              {Object.entries(selectedDef.statBonus)
                .map(([k, v]) => `+${v} ${k}`)
                .join("  ")}
            </div>
          )}
          <div className="item-detail-actions">
            {(isEquipment(selectedDef) || selectedDef.healAmount) && (
              <button onClick={onUseOrEquip}>
                {isEquipment(selectedDef) ? "Equip" : "Use"}
              </button>
            )}
            <span className="item-detail-value">Sell: {selectedDef.value}g</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
