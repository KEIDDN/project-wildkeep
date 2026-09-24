import { useState } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useWorldStore } from "../../store/worldStore";
import { useTimeStore } from "../../store/timeStore";
import { useDungeonStore } from "../../store/dungeonStore";
import { useMineStore } from "../../store/mineStore";
import { useTutorialStore } from "../../store/tutorialStore";
import { useUiStore } from "../../store/uiStore";
import { SKILL_ORDER, SKILLS, type SkillId } from "../../data/skills";
import { AREAS } from "../../data/areas";
import type { AreaId } from "../../game/core/types";
import { formatClock } from "../../game/time/clock";
import { Panel } from "../components/Panel";
import { useSocialStore } from "../../store/socialStore";
import { WORLD_EVENTS } from "../../data/worldEvents";
import { announceEvent } from "../../game/social/worldEvents";
import { adjustHonor } from "../../game/social/honor";

const MATERIAL_KITS: Record<string, [string, number][]> = {
  Starter: [["wood", 40], ["stone", 40], ["herb", 20], ["coal", 20], ["iron_ore", 20]],
  Metals: [["iron_bar", 20], ["copper_bar", 10], ["silver_bar", 10], ["gold_bar", 10], ["mithril_bar", 10], ["coal", 30]],
  House: [["plank", 60], ["stone_brick", 50], ["iron_bar", 20], ["copper_bar", 6], ["silver_bar", 6], ["hardwood", 20]],
  Rare: [["crystal", 10], ["ruby", 3], ["sapphire", 3], ["ancient_wood", 10], ["moonpetal", 6], ["healroot", 10], ["orc_tusk", 6], ["leather", 20], ["bone", 20]],
};

/** Development tools. Only built into `npm run dev`. */
export function DebugPanel() {
  const [floor, setFloor] = useState(5);
  const [skill, setSkill] = useState<SkillId>("mining");
  const [lvl, setLvl] = useState(10);
  const minute = useTimeStore((s) => s.minute);
  const day = useTimeStore((s) => s.day);
  const close = () => useUiStore.getState().closePanel();
  const travel = (area: AreaId, spawn = "default") => {
    close();
    useWorldStore.getState().requestTravel({ area, spawn });
  };
  const setTime = (m: number) => useTimeStore.getState().set(day, m);

  return (
    <Panel title="Debug" subtitle="Development tools — not in release builds" icon="key" width={640}>
      <div className="debug">
        <div className="section-title">Player</div>
        <div className="settings-actions">
          <button type="button" className="btn btn-small" onClick={() => usePlayerStore.getState().earnGold(1000)}>
            +1000 gold
          </button>
          <button type="button" className="btn btn-small" onClick={() => usePlayerStore.getState().gainXp(500)}>
            +500 XP
          </button>
          <button type="button" className="btn btn-small" onClick={() => usePlayerStore.getState().fullHeal()}>
            Full heal
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => usePlayerStore.setState((s) => ({ baseStats: { ...s.baseStats, maxHp: s.baseStats.maxHp >= 900 ? 40 : 999 }, hp: 999 }))}
          >
            Toggle god HP
          </button>
        </div>
        <div className="settings-actions">
          <select value={skill} onChange={(e) => setSkill(e.target.value as SkillId)}>
            {SKILL_ORDER.map((id) => (
              <option key={id} value={id}>
                {SKILLS[id].name}
              </option>
            ))}
          </select>
          <input type="number" min={1} max={50} value={lvl} onChange={(e) => setLvl(Number(e.target.value))} />
          <button type="button" className="btn btn-small" onClick={() => usePlayerStore.setState((s) => ({ skills: { ...s.skills, [skill]: { level: lvl, xp: 0 } } }))}>
            Set skill level
          </button>
        </div>
        <div className="settings-actions">
          {Object.entries(MATERIAL_KITS).map(([name, items]) => (
            <button type="button" key={name} className="btn btn-small" onClick={() => items.forEach(([id, q]) => useInventoryStore.getState().addItem(id, q))}>
              Kit: {name}
            </button>
          ))}
        </div>

        <div className="section-title">World events & honor</div>
        <div className="settings-actions">
          {WORLD_EVENTS.map((e) => (
            <button type="button" key={e.id} className="btn btn-small" onClick={() => (useSocialStore.getState().setEvent(day, e.id), announceEvent(e))}>
              {e.id}
            </button>
          ))}
          <button type="button" className="btn btn-small" onClick={() => useSocialStore.getState().setEvent(day, null)}>
            none
          </button>
          <button type="button" className="btn btn-small" onClick={() => adjustHonor(20)}>
            honor +20
          </button>
          <button type="button" className="btn btn-small" onClick={() => adjustHonor(-20)}>
            honor −20
          </button>
          <button type="button" className="btn btn-small" onClick={() => useInventoryStore.getState().addItem("arrow", 20)}>
            +20 arrows
          </button>
        </div>
        <div className="section-title">Teleport</div>
        <div className="settings-actions">
          {(["town", "house", "tavern", "forest", "deep_forest", "ancient_grove"] as AreaId[]).map((a) => (
            <button type="button" key={a} className="btn btn-small" onClick={() => travel(a, a === "ancient_grove" || a === "deep_forest" ? "south" : a === "forest" ? "west" : "default")}>
              {AREAS[a].name}
            </button>
          ))}
        </div>

        <div className="section-title">Depths & Mine</div>
        <div className="settings-actions">
          <input type="number" min={1} max={60} value={floor} onChange={(e) => setFloor(Math.max(1, Number(e.target.value)))} />
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              useDungeonStore.getState().start(floor, { area: "town", spawn: "barrow" });
              travel("dungeon");
            }}
          >
            Depths at floor
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              useMineStore.getState().start(floor);
              travel("mine", "entrance");
            }}
          >
            Mine at floor
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              const s = useWorldStore.getState();
              s.unlockDungeonCheckpoint(Math.floor(floor / 5) * 5);
              s.recordMineFloor(floor);
              s.setFlag("grove_path_cleared");
            }}
          >
            Unlock checkpoints + grove
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              const area = useWorldStore.getState().area;
              if (area === "mine") {
                useMineStore.getState().start(useMineStore.getState().floor);
                travel("mine", "entrance");
              } else if (area === "dungeon") {
                useDungeonStore.getState().start(useDungeonStore.getState().floor, useDungeonStore.getState().surface);
                travel("dungeon");
              }
            }}
          >
            Regenerate seed
          </button>
        </div>

        <div className="section-title">
          Time — Day {day}, {formatClock(minute)}
        </div>
        <div className="settings-actions">
          <button type="button" className="btn btn-small" onClick={() => useTimeStore.getState().advance(60)}>
            +1 hour
          </button>
          <button type="button" className="btn btn-small" onClick={() => setTime(6 * 60)}>
            Dawn
          </button>
          <button type="button" className="btn btn-small" onClick={() => setTime(12 * 60)}>
            Noon
          </button>
          <button type="button" className="btn btn-small" onClick={() => setTime(18 * 60 + 30)}>
            Evening
          </button>
          <button type="button" className="btn btn-small" onClick={() => setTime(22 * 60)}>
            Night
          </button>
          <button type="button" className="btn btn-small" onClick={() => useTimeStore.getState().set(day + 1, minute)}>
            +1 day
          </button>
        </div>
        <div className="section-title">Tutorial</div>
        <div className="settings-actions">
          <button type="button" className="btn btn-small" onClick={() => useTutorialStore.getState().skip()}>
            Skip tutorial
          </button>
          <button type="button" className="btn btn-small" onClick={() => useTutorialStore.getState().restart()}>
            Restart tutorial
          </button>
        </div>
      </div>
    </Panel>
  );
}
