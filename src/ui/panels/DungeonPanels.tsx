import { useUiStore } from "../../store/uiStore";
import { useDungeonStore } from "../../store/dungeonStore";
import { useWorldStore } from "../../store/worldStore";
import { usePlayerStore } from "../../store/playerStore";
import { CHECKPOINT_EVERY, dangerFor, floorProfile, type DangerLevel } from "../../data/dungeonFloors";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import type { TravelRequest } from "../../store/worldStore";
import { useState } from "react";
import { getGame } from "../../engine/gameInstance";
import { audio } from "../../game/audio/AudioManager";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";
import { saveGame } from "../../game/save/gameSave";
import type { InventoryStack } from "../../game/save/schema";
import { floorThemeName, itemName } from "../../i18n/content";
import { t, tl } from "../../i18n";

const dangerText = (d: DangerLevel) => t(`dungeon.danger.${d}`);

/** Your current strength vs. a floor, as a coloured tag. */
function Danger({ floor }: { floor: number }) {
  const baseStats = usePlayerStore((s) => s.baseStats);
  const equipment = usePlayerStore((s) => s.equipment);
  const skills = usePlayerStore((s) => s.skills);
  const danger = dangerFor(floor, playerEffectiveStats({ baseStats, equipment, skills }));
  return <span className={`danger danger-${danger}`}>{dangerText(danger)}</span>;
}

/** The dungeon entrance: pick a starting floor (1 or an unlocked
 * checkpoint) and descend. */
export function DungeonGatePanel() {
  const surface = (useUiStore((s) => s.panelData.surface) as TravelRequest | undefined) ?? { area: "town", spawn: "barrow" };
  const progress = useWorldStore((s) => s.progress);
  const hp = usePlayerStore((s) => s.hp);
  const starts = [1];
  for (let f = CHECKPOINT_EVERY; f <= progress.dungeonCheckpoint; f += CHECKPOINT_EVERY) starts.push(f + 1);
  const [start, setStart] = useState(starts[starts.length - 1]);

  const enter = () => {
    useUiStore.getState().closePanel();
    useDungeonStore.getState().start(start, surface);
    saveGame();
    useWorldStore.getState().requestTravel({ area: "dungeon", spawn: "default" });
  };

  return (
    <Panel title={t("dungeon.gateTitle")} subtitle={t("dungeon.gateSubtitle")} icon="key" width={540}>
      <div className="gate-body">
        <ul className="gate-rules">
          {tl("dungeon.rules").map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li className="warn">{t("dungeon.rulesWarn")}</li>
        </ul>
        <div className="gate-stats">
          {t("dungeon.deepest")}: <b>{progress.dungeonDeepest || t("common.none")}</b> · {t("dungeon.checkpoint")}:{" "}
          <b>{progress.dungeonCheckpoint ? t("common.floor", { n: progress.dungeonCheckpoint }) : t("common.none")}</b> · {t("dungeon.runs")}: <b>{progress.runsCompleted}</b>
        </div>
        <div className="section-title">{t("dungeon.startAt")}</div>
        <div className="floor-picks">
          {starts.map((f) => (
            <button type="button" key={f} className={`btn btn-small${start === f ? " active" : ""}`} onClick={() => setStart(f)}>
              {t("common.floor", { n: f })}
            </button>
          ))}
        </div>
        <div className="floor-info">
          <b>{t("common.floor", { n: start })}</b> · {floorThemeName(floorProfile(start).theme.name)} · <Danger floor={start} />
        </div>
        {hp < 20 && <div className="warn">{t("dungeon.wounded")}</div>}
        <button type="button" className="btn btn-big" onClick={enter}>
          {t("dungeon.descend")}
        </button>
      </div>
    </Panel>
  );
}

/** At the stairs: push your luck, or bank the run. */
export function FloorClearedPanel() {
  const floor = useDungeonStore((s) => s.floor);
  const gold = useDungeonStore((s) => s.runGold);
  const items = useDungeonStore((s) => s.runItems);
  const hp = usePlayerStore((s) => s.hp);
  const next = floorProfile(floor + 1);
  return (
    <Panel title={t("dungeon.clearedTitle", { n: floor })} subtitle={t("dungeon.clearedSub")} icon="key" width={560} onClose={null}>
      <div className="result-stats">
        <div>
          <img src="/icons/gold_coin.png" alt="" /> <b>{gold}</b> {t("dungeon.goldCarried")}
        </div>
        <div>
          <b>{items.reduce((n, i) => n + i.quantity, 0)}</b> {t("dungeon.items")}
        </div>
        <div>
          <b>{hp}</b> {t("dungeon.hpLeft")}
        </div>
      </div>
      <LootGrid items={items} empty={t("dungeon.nothingYet")} />
      <div className="floor-info">
        {t("dungeon.next")}: <b>{t("common.floor", { n: floor + 1 })}</b> · {floorThemeName(next.theme.name)}
        {next.bossFloor && <span className="warn"> · {t("dungeon.bossFloor")}</span>} · <Danger floor={floor + 1} />
      </div>
      <div className="choice-row">
        <button type="button" className="btn btn-big" onClick={() => getGame()?.descendDungeon()}>
          {t("dungeon.descendTo", { n: floor + 1 })}
        </button>
        <button type="button" className="btn btn-big" onClick={() => getGame()?.exitDungeon("cleared")}>
          {t("dungeon.climbOut")}
        </button>
      </div>
      <p className="hint">{t("dungeon.carryHint")}</p>
    </Panel>
  );
}

export function DungeonResultPanel() {
  const outcome = useDungeonStore((s) => s.outcome);
  const floor = useDungeonStore((s) => s.floor);
  const startFloor = useDungeonStore((s) => s.startFloor);
  const gold = useDungeonStore((s) => s.runGold);
  const xp = useDungeonStore((s) => s.runXp);
  const items = useDungeonStore((s) => s.runItems);
  const slain = useDungeonStore((s) => s.enemiesSlain);

  const leave = () => {
    useUiStore.getState().closePanel();
    const surface = useDungeonStore.getState().surface;
    useDungeonStore.getState().reset();
    useWorldStore.getState().requestTravel(surface);
    audio.sfx("door");
  };

  return (
    <Panel
      title={outcome === "cleared" ? t("dungeon.backTitle") : t("dungeon.escapedTitle")}
      subtitle={t("dungeon.backSub", { from: startFloor, to: floor })}
      icon="chest"
      width={560}
      onClose={null}
    >
      <div className="result-stats">
        <div>
          <img src="/icons/gold_coin.png" alt="" /> <b>{gold}</b> {t("common.gold")}
        </div>
        <div>
          <b>{xp}</b> {t("common.xp")}
        </div>
        <div>
          <b>{slain}</b> {t("dungeon.slain")}
        </div>
      </div>
      <LootGrid items={items} empty={t("dungeon.noLoot")} />
      <button type="button" className="btn btn-big" onClick={leave}>
        {t("dungeon.returnSurface")}
      </button>
    </Panel>
  );
}

export function DeathPanel() {
  const data = useUiStore((s) => s.panelData) as { lostGold?: number; lostItems?: InventoryStack[]; inDungeon?: boolean; wall?: boolean };
  return (
    <Panel title={t("dungeon.deathTitle")} subtitle={t("dungeon.deathSub")} width={520} onClose={null} className="death">
      <div className="death-body">
        <p>
          {t("dungeon.deathText", { gold: data.lostGold ?? 0 })}
          {data.inDungeon ? t("dungeon.deathDungeon") : "."}
        </p>
        {data.inDungeon && data.wall && <p className="hint">{t("dungeon.wall")}</p>}
        {data.lostItems && data.lostItems.length > 0 && <LootGrid items={data.lostItems} empty="" dim />}
        <button type="button" className="btn btn-big" onClick={() => getGame()?.respawnAtHome()}>
          {t("dungeon.deathRetry")}
        </button>
      </div>
    </Panel>
  );
}

function LootGrid({ items, empty, dim }: { items: InventoryStack[]; empty: string; dim?: boolean }) {
  if (!items.length) return empty ? <div className="empty-hint">{empty}</div> : null;
  return (
    <div className="loot-grid">
      {items.map((i) => (
        <div key={i.itemId} className="loot-cell" title={itemName(i.itemId)}>
          <ItemIcon itemId={i.itemId} quantity={i.quantity} size={48} dim={dim} />
        </div>
      ))}
    </div>
  );
}
