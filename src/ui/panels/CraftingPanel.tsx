import { RichText } from "../components/Glyph";
import { useState } from "react";
import { useInventoryStore } from "../../store/inventoryStore";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore } from "../../store/uiStore";
import { getItem, type ItemDef } from "../../data/items";
import { recipesFor, type Recipe, type RecipeCategory, type StationId } from "../../data/recipes";
import { RESOURCE_NODES } from "../../data/resourceNodes";
import { craftBlocker, craftRecipe, ownsItem, craftGold } from "../../game/actions";
import { Panel } from "../components/Panel";
import { ItemIcon } from "../components/ItemIcon";
import { RARITY_INK } from "../../game/core/types";
import { itemDesc, itemName, nodeName, skillName, stationName, stationSubtitle } from "../../i18n/content";
import { t } from "../../i18n";

const STATION_ICON: Record<StationId, string> = { workbench: "craft", smelter: "iron_bar", forge: "anvil", kitchen: "stew" };

/** What a tool opens up: the nodes that need exactly its power. */
function toolUnlocks(def: ItemDef): string[] {
  if (!def.toolKind || !def.toolPower) return [];
  return Object.values(RESOURCE_NODES)
    .filter((n) => n.toolKind === def.toolKind && n.toolPowerRequired === def.toolPower)
    .map((n) => nodeName(n.id, n.name));
}

/** "+6 attack" versus whatever is worn in that slot now. */
function upgradeDelta(def: ItemDef): string | null {
  if (!def.equipSlot || def.equipSlot === "tool") return null;
  const current = usePlayerStore.getState().equipment[def.equipSlot];
  const cur = current ? (getItem(current).statBonus ?? {}) : {};
  const next = def.statBonus ?? {};
  const parts: string[] = [];
  for (const k of ["attack", "defense", "maxHp"] as const) {
    const d = (next[k] ?? 0) - (cur[k] ?? 0);
    if (d !== 0) parts.push(`${d > 0 ? "+" : ""}${d} ${t(`common.stat.${k}`)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * One panel for every crafting station (bench, smelter, forge, kitchen).
 * Recipes come from data/recipes.ts; the rules from game/actions. Each row
 * says why it matters: what a tool unlocks, what gear adds.
 */
export function CraftingPanel() {
  const station = ((useUiStore((s) => s.panelData.station) as StationId | undefined) ?? "workbench") as StationId;
  const gold = usePlayerStore((s) => s.gold);
  // Subscribe so the panel re-renders when materials / gear change.
  useInventoryStore((s) => s.stacks);
  usePlayerStore((s) => s.equipment);
  const all = recipesFor(station);
  const categories = [...new Set(all.map((r) => r.category))];
  const [tab, setTab] = useState<RecipeCategory | "all">("all");
  const recipes = tab === "all" ? all : all.filter((r) => r.category === tab);

  return (
    <Panel title={stationName(station)} subtitle={stationSubtitle(station)} icon={STATION_ICON[station]} width={720}>
      <div className="shop-header">
        <div className="hint">{station === "forge" ? t("crafting.forgeHint") : t("crafting.matsHint")}</div>
        <div className="gold-pill">
          <img src="/icons/gold_coin.png" alt="" /> {gold.toLocaleString()}
        </div>
      </div>
      {categories.length > 1 && (
        <div className="tabs craft-tabs">
          <button type="button" className={`tab${tab === "all" ? " active" : ""}`} onClick={() => setTab("all")}>
            {t("crafting.all")}
          </button>
          {categories.map((c) => (
            <button type="button" key={c} className={`tab${tab === c ? " active" : ""}`} onClick={() => setTab(c)}>
              {t(`crafting.category.${c}`)}
            </button>
          ))}
        </div>
      )}
      <div className="row-list">
        {recipes.map((r) => (
          <RecipeRow key={r.id} r={r} gold={gold} />
        ))}
      </div>
    </Panel>
  );
}

function RecipeRow({ r, gold }: { r: Recipe; gold: number }) {
  const def = getItem(r.output.itemId);
  const blocked = craftBlocker(r);
  const owned = blocked?.code === "owned";
  const inv = useInventoryStore.getState();
  // How many times the materials allow (for stackable outputs).
  const times = def.stackable ? Math.min(...r.inputs.map((m) => Math.floor(inv.quantityOf(m.itemId) / m.quantity))) : 0;
  const craftMany = (n: number) => {
    for (let i = 0; i < n; i++) if (!craftRecipe(r)) break;
  };
  const unlocks = owned ? [] : toolUnlocks(def);
  const delta = owned ? null : upgradeDelta(def);
  return (
    <div className={`forge-row${owned ? " owned" : ""}${!blocked ? " ready" : ""}`}>
      <ItemIcon itemId={r.output.itemId} quantity={r.output.quantity > 1 ? r.output.quantity : undefined} size={44} />
      <div className="forge-info">
        <div style={{ color: RARITY_INK[def.rarity] }}>
          {itemName(def.id)}
          {r.skill && <small className="skill-tag">{t("crafting.skillXp", { n: r.skill.xp, skill: skillName(r.skill.id) })}</small>}
        </div>
        <small><RichText text={itemDesc(def.id, true)} /></small>
        {(unlocks.length > 0 || delta) && <small className="craft-why">{unlocks.length > 0 ? t("crafting.unlocks", { what: unlocks.join(", ") }) : delta}</small>}
        <div className="materials">
          {r.upgradesFrom && <span className={`mat${ownsItem(r.upgradesFrom) ? "" : " missing"}`}>⟲ {itemName(r.upgradesFrom)}</span>}
          {r.inputs.map((m) => {
            const have = inv.quantityOf(m.itemId);
            return (
              <span key={m.itemId} className={`mat${have >= m.quantity ? "" : " missing"}`} title={itemName(m.itemId)}>
                <img src={`/icons/${getItem(m.itemId).icon}.png`} alt="" />
                {have}/{m.quantity}
              </span>
            );
          })}
          {r.gold ? (
            <span className={`mat${gold >= craftGold(r) ? "" : " missing"}`}>
              <img src="/icons/gold_coin.png" alt="" />
              {craftGold(r)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="craft-buttons">
        <button type="button" className="btn" disabled={!!blocked} onClick={() => craftRecipe(r)} title={blocked?.text ?? ""}>
          {owned ? t("crafting.owned") : r.upgradesFrom ? t("crafting.upgrade") : t("crafting.craft")}
        </button>
        {times > 1 && !blocked && (
          <button type="button" className="btn btn-small" onClick={() => craftMany(times)}>
            ×{times}
          </button>
        )}
      </div>
    </div>
  );
}
