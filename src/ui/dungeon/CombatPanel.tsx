import { useEffect, useRef, useState } from "react";
import { useDungeonStore } from "../../store/dungeonStore";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useGameStore } from "../../store/gameStore";
import { getEnemy } from "../../data/enemies";
import { getItem } from "../../data/items";
import { defendedDamage, resolveAttack } from "../../game/systems/combatSystem";
import { rollLoot } from "../../game/systems/lootSystem";
import { computeEffectiveStats } from "../../game/systems/statsSystem";
import { ProgressBar } from "../components/ProgressBar";

type Phase = "player" | "enemy" | "won" | "lost" | "fled";

export function CombatPanel() {
  const enemyInstanceId = useDungeonStore((s) => s.activeCombatEnemyId);
  const dungeon = useDungeonStore((s) => s.dungeon);
  const [log, setLog] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("player");
  const [defending, setDefending] = useState(false);
  const [enemyHp, setEnemyHp] = useState(0);
  const busyRef = useRef(false);

  const enemyInstance = dungeon?.rooms
    .flatMap((r) => r.enemies)
    .find((e) => e.instanceId === enemyInstanceId);
  const enemyDef = enemyInstance ? getEnemy(enemyInstance.enemyDefId) : null;

  useEffect(() => {
    if (enemyInstance) {
      setEnemyHp(enemyInstance.currentHp);
      setLog([`A ${enemyDef?.name ?? "foe"} blocks your path!`]);
      setPhase("player");
      setDefending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemyInstanceId]);

  const hp = usePlayerStore((s) => s.hp);
  const baseStats = usePlayerStore((s) => s.baseStats);
  const equipment = usePlayerStore((s) => s.equipment);

  if (!enemyInstance || !enemyDef) return null;

  const stats = computeEffectiveStats(baseStats, equipment);
  const rng = useDungeonStore.getState().rng;

  function pushLog(line: string) {
    setLog((l) => [...l.slice(-4), line]);
  }

  function enemyTurn(wasDefending: boolean) {
    if (!rng) return;
    setPhase("enemy");
    setTimeout(() => {
      usePlayerStore.getState().setAction("hit");
      let result = resolveAttack(enemyDef!.stats, stats, rng);
      if (wasDefending) result = defendedDamage(result);
      if (result.isMiss) {
        pushLog(`${enemyDef!.name} misses!`);
      } else {
        usePlayerStore.getState().takeDamage(result.damage);
        pushLog(
          `${enemyDef!.name} hits you for ${result.damage}${result.isCrit ? " (crit!)" : ""}.`,
        );
      }
      setTimeout(() => usePlayerStore.getState().setAction("idle"), 250);

      if (usePlayerStore.getState().hp <= 0) {
        setPhase("lost");
        busyRef.current = false;
        return;
      }
      setPhase("player");
      busyRef.current = false;
    }, 500);
  }

  function onAttack() {
    if (busyRef.current || phase !== "player" || !rng) return;
    busyRef.current = true;
    setDefending(false);
    usePlayerStore.getState().setAction("attack");
    const result = resolveAttack(stats, enemyDef!.stats, rng);
    setTimeout(() => {
      if (result.isMiss) {
        pushLog("You miss!");
      } else {
        const remaining = useDungeonStore.getState().damageEnemy(enemyInstance!.instanceId, result.damage);
        setEnemyHp(remaining);
        pushLog(`You hit ${enemyDef!.name} for ${result.damage}${result.isCrit ? " (crit!)" : ""}.`);
        if (remaining <= 0) {
          resolveVictory();
          return;
        }
      }
      usePlayerStore.getState().setAction("idle");
      enemyTurn(false);
    }, 400);
  }

  function onDefend() {
    if (busyRef.current || phase !== "player") return;
    busyRef.current = true;
    setDefending(true);
    pushLog("You brace for the next hit.");
    enemyTurn(true);
  }

  function onUseItem() {
    if (busyRef.current || phase !== "player") return;
    const inv = useInventoryStore.getState();
    if (!inv.hasItem("health_potion")) {
      pushLog("No potions left.");
      return;
    }
    busyRef.current = true;
    inv.removeItem("health_potion", 1);
    const def = getItem("health_potion");
    usePlayerStore.getState().heal(def.healAmount ?? 0);
    pushLog(`You drink a potion, healing ${def.healAmount} HP.`);
    enemyTurn(false);
  }

  function onRun() {
    if (busyRef.current || phase !== "player" || !rng) return;
    busyRef.current = true;
    if (rng.bool(0.6)) {
      pushLog("You escape the fight!");
      setPhase("fled");
      setTimeout(() => {
        useDungeonStore.getState().clearCombat();
        useGameStore.getState().closePanel();
      }, 700);
    } else {
      pushLog("Couldn't get away!");
      enemyTurn(false);
    }
  }

  function resolveVictory() {
    const relicEffects = usePlayerStore.getState().relicEffects();
    const xp = enemyInstance!.isElite ? enemyDef!.xpReward * 3 : enemyDef!.xpReward;
    const goldRange = enemyDef!.goldReward;
    const gold = Math.round(
      (rng!.int(goldRange[0], goldRange[1]) * (enemyInstance!.isElite ? 3 : 1)) *
        (1 + relicEffects.sellValueBonus),
    );
    const loot = rollLoot(rng!, enemyDef!.loot, relicEffects.rareLootChanceBonus);

    usePlayerStore.getState().gainXp(xp);
    usePlayerStore.getState().gainSkillXp("combat", xp);
    usePlayerStore.getState().earnGold(gold);
    for (const item of loot) useInventoryStore.getState().addItem(item.itemId, item.quantity);
    useDungeonStore.getState().markEnemyDefeated(enemyInstance!.instanceId);
    useDungeonStore.getState().addRunReward(gold, xp, loot);

    const lootText = loot.length
      ? ` Loot: ${loot.map((l) => `${l.quantity} ${getItem(l.itemId).name}`).join(", ")}.`
      : "";
    pushLog(`${enemyDef!.name} defeated! +${xp} XP, +${gold} gold.${lootText}`);
    setPhase("won");
    setTimeout(() => {
      useGameStore.getState().closePanel();
    }, 1200);
  }

  function onDefeatAcknowledge() {
    usePlayerStore.getState().fullHeal();
    useDungeonStore.getState().clearCombat();
    useGameStore.getState().closePanel();
    useGameStore.getState().setScene("town");
    useGameStore.getState().pushToast("You were defeated and dragged back to town.", "warning");
  }

  return (
    <div className="combat-overlay">
      <div className="combat-panel">
        <div className="combat-row">
          <div className="combat-side">
            <div className="combat-name">You</div>
            <ProgressBar value={hp} max={stats.maxHp} color="#5fd35f" label={`${hp}/${stats.maxHp}`} />
          </div>
          <div className="combat-vs">VS</div>
          <div className="combat-side">
            <div className="combat-name">{enemyInstance.isElite ? `Elite ${enemyDef.name}` : enemyDef.name}</div>
            <ProgressBar
              value={enemyHp}
              max={enemyInstance.isElite ? enemyDef.stats.maxHp * 2.2 : enemyDef.stats.maxHp}
              color="#e05a4e"
              label={`${enemyHp}/${enemyInstance.isElite ? Math.round(enemyDef.stats.maxHp * 2.2) : enemyDef.stats.maxHp}`}
            />
          </div>
        </div>

        <div className="combat-log">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {phase === "player" && !busyRef.current && (
          <div className="combat-actions">
            <button onClick={onAttack}>Attack</button>
            <button onClick={onDefend}>Defend</button>
            <button onClick={onUseItem}>Use Potion</button>
            <button onClick={onRun}>Run</button>
          </div>
        )}
        {defending && phase !== "player" && (
          <div className="combat-hint">Defending — incoming damage reduced.</div>
        )}
        {phase === "lost" && (
          <div className="combat-actions">
            <button onClick={onDefeatAcknowledge}>You were defeated...</button>
          </div>
        )}
      </div>
    </div>
  );
}
