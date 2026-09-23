import { usePlayerStore } from "../../store/playerStore";
import { useGameStore } from "../../store/gameStore";
import { computeEffectiveStats } from "../../game/systems/statsSystem";
import { xpForLevel } from "../../game/systems/statsSystem";
import { ProgressBar } from "../components/ProgressBar";

export function HUD() {
  const hp = usePlayerStore((s) => s.hp);
  const xp = usePlayerStore((s) => s.xp);
  const level = usePlayerStore((s) => s.level);
  const gold = usePlayerStore((s) => s.gold);
  const baseStats = usePlayerStore((s) => s.baseStats);
  const equipment = usePlayerStore((s) => s.equipment);
  const scene = useGameStore((s) => s.scene);
  const prompt = useGameStore((s) => s.interactionPrompt);
  const openPanel = useGameStore((s) => s.openPanel);

  const stats = computeEffectiveStats(baseStats, equipment);
  const xpNeeded = xpForLevel(level);

  return (
    <>
      <div className="hud-top">
        <div className="hud-block">
          <div className="hud-level">Lv {level}</div>
          <ProgressBar value={hp} max={stats.maxHp} color="#5fd35f" label={`HP ${hp}/${stats.maxHp}`} />
          <ProgressBar value={xp} max={xpNeeded} color="#4fa9ff" label={`XP ${xp}/${xpNeeded}`} height={8} />
        </div>
        <div className="hud-gold">{gold}g</div>
        <div className="hud-scene">{sceneName(scene)}</div>
      </div>

      <div className="hud-actions">
        <button onClick={() => openPanel("inventory")}>Inventory (I)</button>
        <button onClick={() => openPanel("equipment")}>Equipment (C)</button>
      </div>

      {prompt && (
        <div className="interaction-prompt">
          <kbd>E</kbd> {prompt}
        </div>
      )}
    </>
  );
}

function sceneName(scene: string): string {
  if (scene === "town") return "Town";
  if (scene === "forest") return "Forest";
  if (scene === "dungeon") return "Dungeon";
  return scene;
}
