import { useDungeonStore } from "../../store/dungeonStore";
import { useGameStore } from "../../store/gameStore";
import { getItem } from "../../data/items";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";

export function DungeonResultPanel() {
  const tier = useDungeonStore((s) => s.dungeon?.tier ?? 1);
  const gold = useDungeonStore((s) => s.runGoldEarned);
  const xp = useDungeonStore((s) => s.runXpEarned);
  const items = useDungeonStore((s) => s.runItemsFound);

  function returnToTown() {
    useDungeonStore.getState().reset();
    useGameStore.getState().closePanel();
    useGameStore.getState().setScene("town");
  }

  return (
    <Panel title={`Dungeon Tier ${tier} Cleared!`} width={420}>
      <div className="dungeon-result-stats">
        <div>Gold Earned: {gold}g</div>
        <div>XP Earned: {xp}</div>
      </div>
      <div className="dungeon-result-items">
        {items.length === 0 && <div className="empty-hint">No loot found this run.</div>}
        {items.map((i) => {
          const def = getItem(i.itemId);
          return <ItemIcon key={i.itemId} icon={def.icon} rarity={def.rarity} quantity={i.quantity} title={def.name} />;
        })}
      </div>
      <button onClick={returnToTown}>Return to Town</button>
    </Panel>
  );
}
