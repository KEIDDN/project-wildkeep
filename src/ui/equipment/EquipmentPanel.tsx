import { usePlayerStore } from "../../store/playerStore";
import { useGameStore } from "../../store/gameStore";
import { getItem } from "../../data/items";
import type { EquipSlot } from "../../data/items";
import { computeEffectiveStats } from "../../game/systems/statsSystem";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";

const SLOTS: { slot: EquipSlot; label: string }[] = [
  { slot: "weapon", label: "Weapon" },
  { slot: "armor", label: "Armor" },
  { slot: "tool", label: "Tool" },
  { slot: "accessory", label: "Accessory" },
  { slot: "relic", label: "Relic" },
];

export function EquipmentPanel() {
  const equipment = usePlayerStore((s) => s.equipment);
  const baseStats = usePlayerStore((s) => s.baseStats);
  const level = usePlayerStore((s) => s.level);
  const equip = usePlayerStore((s) => s.equip);
  const stats = computeEffectiveStats(baseStats, equipment);

  return (
    <Panel title="Equipment" onClose={() => useGameStore.getState().closePanel()} width={440}>
      <div className="equip-summary">
        <div>Level {level}</div>
        <div>HP {stats.maxHp}</div>
        <div>Attack {stats.attack}</div>
        <div>Defense {stats.defense}</div>
        <div>Crit {Math.round(stats.crit * 100)}%</div>
        <div>Luck {Math.round(stats.luck * 100)}%</div>
      </div>
      <div className="equip-slots">
        {SLOTS.map(({ slot, label }) => {
          const itemId = equipment[slot];
          const def = itemId ? getItem(itemId) : null;
          return (
            <div className="equip-slot-row" key={slot}>
              <span className="equip-slot-label">{label}</span>
              {def ? (
                <>
                  <ItemIcon icon={def.icon} rarity={def.rarity} size={32} />
                  <span className="equip-slot-name">{def.name}</span>
                  <button className="small-btn" onClick={() => equip(slot, undefined)}>
                    Unequip
                  </button>
                </>
              ) : (
                <span className="equip-slot-empty">Empty</span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
