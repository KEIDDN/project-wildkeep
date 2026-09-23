import { usePlayerStore } from "../../store/playerStore";
import { useGameStore } from "../../store/gameStore";
import { Panel } from "../components/Panel";

export function HousePanel() {
  function rest() {
    usePlayerStore.getState().fullHeal();
    useGameStore.getState().pushToast("You rest and recover to full HP.", "info");
    useGameStore.getState().closePanel();
  }

  return (
    <Panel title="Your Tent" onClose={() => useGameStore.getState().closePanel()} width={380}>
      <p className="house-flavor">
        A cramped but familiar tent. Someday you'll afford real walls.
      </p>
      <button onClick={rest}>Rest until morning</button>
      <p className="house-hint">
        Upgrading your home to a proper house is coming in a future expansion —
        it will unlock storage, crafting, and passive bonuses.
      </p>
    </Panel>
  );
}
