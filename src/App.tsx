import { useEffect } from "react";
import { GameCanvas } from "./rendering/pixi/GameCanvas";
import { HUD } from "./ui/hud/HUD";
import { ToastList } from "./ui/hud/ToastList";
import { InventoryPanel } from "./ui/inventory/InventoryPanel";
import { EquipmentPanel } from "./ui/equipment/EquipmentPanel";
import { ShopPanel } from "./ui/shop/ShopPanel";
import { BlacksmithPanel } from "./ui/shop/BlacksmithPanel";
import { HousePanel } from "./ui/town/HousePanel";
import { CombatPanel } from "./ui/dungeon/CombatPanel";
import { DungeonResultPanel } from "./ui/dungeon/DungeonResultPanel";
import { useGameStore } from "./store/gameStore";
import { loadGame, saveGame } from "./game/save/gameSave";

export default function App() {
  const activePanel = useGameStore((s) => s.activePanel);
  const closePanel = useGameStore((s) => s.closePanel);
  const openPanel = useGameStore((s) => s.openPanel);

  useEffect(() => {
    loadGame();
    const autosave = setInterval(saveGame, 20000);
    const onUnload = () => saveGame();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(autosave);
      window.removeEventListener("beforeunload", onUnload);
      saveGame();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === "escape") {
        if (useGameStore.getState().activePanel !== "combat") closePanel();
        return;
      }
      if (useGameStore.getState().activePanel) return;
      if (k === "i") openPanel("inventory");
      else if (k === "c") openPanel("equipment");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePanel, openPanel]);

  return (
    <div className="app-root">
      <div className="game-frame">
        <GameCanvas />
        <HUD />
        <ToastList />
        {activePanel === "inventory" && <InventoryPanel />}
        {activePanel === "equipment" && <EquipmentPanel />}
        {activePanel === "shop" && <ShopPanel />}
        {activePanel === "blacksmith" && <BlacksmithPanel />}
        {activePanel === "house" && <HousePanel />}
        {activePanel === "combat" && <CombatPanel />}
        {activePanel === "dungeonResult" && <DungeonResultPanel />}
      </div>
    </div>
  );
}
