import { useEffect, useState } from "react";
import { GameCanvas } from "./ui/GameCanvas";
import { HUD } from "./ui/hud/HUD";
import { AreaBanner, FadeOverlay, LootRevealQueue, ToastList } from "./ui/hud/Notifications";
import { InventoryPanel } from "./ui/panels/InventoryPanel";
import { ShopPanel } from "./ui/panels/ShopPanel";
import { CraftingPanel } from "./ui/panels/CraftingPanel";
import { SkillsPanel } from "./ui/panels/SkillsPanel";
import { HousePanel, StashPanel, TavernPanel } from "./ui/panels/TownPanels";
import { BackRoomPanel, BlackjackPanel, RoulettePanel } from "./ui/panels/CasinoPanels";
import { MineLiftPanel } from "./ui/panels/WorldPanels";
import { DeathPanel, DungeonGatePanel, DungeonResultPanel, FloorClearedPanel } from "./ui/panels/DungeonPanels";
import { DialoguePanel, SettingsPanel } from "./ui/panels/SystemPanels";
import { BoardPanel } from "./ui/panels/QuestPanels";
import { HelpPanel, IntroOverlay, TipCard } from "./ui/panels/HelpPanels";
import { JournalPanel } from "./ui/panels/JournalPanel";
import { MapPanel } from "./ui/panels/MapPanel";
import { CharacterPanel } from "./ui/panels/CharacterPanel";
import { RepairPanel } from "./ui/panels/RepairPanel";
import { DebugPanel } from "./ui/panels/DebugPanel";
import { TitleScreen } from "./ui/TitleScreen";
import { useUiStore } from "./store/uiStore";
import { closeGame, saveGame } from "./game/save/gameSave";
import { persistence } from "./game/save/saveManager";
import { startTutorial } from "./game/tutorial";
import { useLanguage } from "./i18n";
import { startMusicDirector } from "./game/audio/musicDirector";
import { audio } from "./game/audio/AudioManager";
import { useTimeStore } from "./store/timeStore";
import { announceEvent, rollDailyEvent } from "./game/social/worldEvents";

/**
 * Two screens: the title (new game / load / settings / credits) and the
 * game itself. The game world only exists while a save slot is loaded.
 */
export default function App() {
  const [screen, setScreen] = useState<"title" | "game">("title");

  useEffect(() => persistence.migrateLegacy(), []);

  if (screen === "title") return <TitleScreen onPlay={() => setScreen("game")} />;
  return (
    <GameScreen
      onQuit={() => {
        closeGame();
        useUiStore.getState().closePanel();
        setScreen("title");
      }}
    />
  );
}

function GameScreen({ onQuit }: { onQuit: () => void }) {
  const activePanel = useUiStore((s) => s.activePanel);
  // Switching language re-renders every panel (the world keeps running).
  const lang = useLanguage();

  useEffect(() => {
    const stopTutorial = startTutorial();
    const stopMusic = startMusicDirector();
    // One world event (or a quiet day) per morning.
    const firstRoll = rollDailyEvent();
    if (firstRoll) setTimeout(() => announceEvent(firstRoll), 1500);
    const stopEvents = useTimeStore.subscribe((s, prev) => {
      if (s.day === prev.day) return;
      const ev = rollDailyEvent();
      if (ev) setTimeout(() => announceEvent(ev), 1200);
    });
    const autosave = setInterval(saveGame, 15000);
    const onUnload = () => saveGame();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      stopTutorial();
      stopMusic();
      stopEvents();
      audio.stopMusic(0.8);
      clearInterval(autosave);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  return (
    <div className={`app-root${activePanel && activePanel !== "dialogue" ? " panel-open" : ""}`}>
      <GameCanvas />
      <div className="ui-layer" key={lang}>
        <HUD />
        <AreaBanner />
        <ToastList />
        <LootRevealQueue />
        <TipCard />
        {activePanel === "inventory" && <InventoryPanel />}
        {activePanel === "shop" && <ShopPanel />}
        {activePanel === "crafting" && <CraftingPanel />}
        {activePanel === "house" && <HousePanel />}
        {activePanel === "skills" && <SkillsPanel />}
        {activePanel === "stash" && <StashPanel />}
        {activePanel === "tavern" && <TavernPanel />}
        {activePanel === "blackjack" && <BlackjackPanel />}
        {activePanel === "roulette" && <RoulettePanel />}
        {activePanel === "backRoom" && <BackRoomPanel />}
        {activePanel === "dungeonGate" && <DungeonGatePanel />}
        {activePanel === "dungeonResult" && <DungeonResultPanel />}
        {activePanel === "floorCleared" && <FloorClearedPanel />}
        {activePanel === "mineLift" && <MineLiftPanel />}
        {activePanel === "death" && <DeathPanel />}
        {activePanel === "settings" && <SettingsPanel onQuit={onQuit} />}
        {activePanel === "dialogue" && <DialoguePanel />}
        {activePanel === "help" && <HelpPanel />}
        {activePanel === "journal" && <JournalPanel />}
        {activePanel === "board" && <BoardPanel />}
        {activePanel === "map" && <MapPanel />}
        {activePanel === "character" && <CharacterPanel />}
        {activePanel === "repair" && <RepairPanel />}
        {activePanel === "debug" && import.meta.env.DEV && <DebugPanel />}
        <IntroOverlay />
        <FadeOverlay />
      </div>
    </div>
  );
}
