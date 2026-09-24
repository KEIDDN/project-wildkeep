import { durabilityOf, maxDurability, wearState } from "../../game/systems/durability";
import { getGame } from "../../engine/gameInstance";
import { useState } from "react";
import { useInventoryStore } from "../../store/inventoryStore";
import { usePlayerStore } from "../../store/playerStore";
import { useSocialStore } from "../../store/socialStore";
import { getItem, weaponProfile, type EquipSlot, type ItemDef } from "../../data/items";
import { getEnemy } from "../../data/enemies";
import { STAMINA } from "../../data/combat";
import { staminaBonus } from "../../data/talents";
import type { EquipmentSaveState } from "../../game/save/schema";
import { RARITY_COLOR, RARITY_INK, rarityRank } from "../../game/core/types";
import { computeRelicEffects } from "../../game/systems/statsSystem";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { useUiStore } from "../../store/uiStore";
import { useTownStore } from "../../store/townStore";
import { equipItem, unequipSlot, useUtilityItem, consumeFood, shopSellPrice } from "../../game/actions";
import { honorRank } from "../../game/social/honor";
import { Panel } from "../components/Panel";
import { EmptySlot, ItemIcon } from "../components/ItemIcon";
import { CharacterPreview } from "../components/CharacterPreview";
import type { InventoryStack } from "../../game/save/schema";
import { enemyName, itemDesc, itemName } from "../../i18n/content";
import { t } from "../../i18n";

/**
 * Paper doll: every slot sits next to the part of the body it covers, so
 * "this is my character and this is what I'm wearing" reads at a glance.
 */
const DOLL: { slot: EquipSlot | "offhand"; area: string; ghost: string }[] = [
  { slot: "head", area: "head", ghost: "helm_iron" },
  { slot: "armor", area: "armor", ghost: "armor_cloth" },
  { slot: "boots", area: "boots", ghost: "boots_leather" },
  { slot: "tool", area: "tool", ghost: "pickaxe_rusty" },
  { slot: "weapon", area: "weapon", ghost: "sword_wood" },
  { slot: "offhand", area: "offhand", ghost: "key" },
  { slot: "accessory", area: "accessory", ghost: "ring_gold" },
  { slot: "relic", area: "relic", ghost: "clover" },
];

const CATEGORY_ORDER = ["weapon", "armor", "tool", "accessory", "relic", "consumable", "utility", "resource"];
const BAG_SLOTS = 35;

export function sortStacks(stacks: InventoryStack[]): InventoryStack[] {
  return [...stacks].sort((a, b) => {
    const da = getItem(a.itemId);
    const db = getItem(b.itemId);
    return (
      Number(!!db.keyItem) - Number(!!da.keyItem) ||
      CATEGORY_ORDER.indexOf(da.category) - CATEGORY_ORDER.indexOf(db.category) ||
      rarityRank(db.rarity) - rarityRank(da.rarity) ||
      itemName(da.id).localeCompare(itemName(db.id)) ||
      Number(!!a.stolen) - Number(!!b.stolen)
    );
  });
}

type Selection = { itemId: string; from: "bag" | EquipSlot; stolen?: boolean };

export function InventoryPanel() {
  const stacks = useInventoryStore((s) => s.stacks);
  const equipment = usePlayerStore((s) => s.equipment);
  const baseStats = usePlayerStore((s) => s.baseStats);
  const level = usePlayerStore((s) => s.level);
  const skills = usePlayerStore((s) => s.skills);
  const talents = usePlayerStore((s) => s.talents);
  const honor = useSocialStore((s) => s.honor);
  const [selected, setSelected] = useState<Selection | null>(null);

  const houseLevel = useTownStore((s) => s.buildingLevels.house ?? 1);
  const wear = usePlayerStore((s) => s.wear);
  const stats = playerEffectiveStats({ baseStats, equipment, skills, talents, wear }, houseLevel);
  const relic = computeRelicEffects(equipment);
  const sorted = sortStacks(stacks);
  const selectedDef = selected ? getItem(selected.itemId) : null;

  const use = (def: ItemDef) => {
    if (def.equipSlot) equipItem(def.id);
    else if (def.healAmount || def.energy || def.mana) consumeFood(def.id);
    else if (def.useEffect) useUtilityItem(def.id);
  };
  const act = (def: ItemDef) => {
    if (!selected) return;
    if (selected.from !== "bag") {
      unequipSlot(selected.from);
      setSelected(null);
      return;
    }
    use(def);
    if (def.equipSlot || !useInventoryStore.getState().hasItem(def.id)) setSelected(null);
  };

  return (
    <Panel title={t("inventory.title")} subtitle={t("inventory.subtitle", { n: level })} icon="chest" width={800}>
      <div className="inv-layout">
        <div className="inv-left">
          <div className="section-title">{t("inventory.doll")}</div>
          <div className="doll">
            <div className="doll-figure">
              <CharacterPreview equipment={equipment} scale={3} />
            </div>
            {DOLL.map(({ slot, area, ghost }) => {
              const id = slot === "offhand" ? undefined : equipment[slot];
              return (
                <div key={slot} className={`doll-slot doll-${area}`} title={slot === "offhand" ? t("inventory.offhandSoon") : undefined}>
                  {id ? (
                    <ItemIcon
                      itemId={id}
                      size={48}
                      selected={selected?.from === slot}
                      onClick={() => setSelected({ itemId: id, from: slot as EquipSlot })}
                      onDoubleClick={() => unequipSlot(slot as EquipSlot)}
                      dur={{ cur: durabilityOf(slot as EquipSlot), max: maxDurability(id) }}
                    />
                  ) : (
                    <EmptySlot size={48} ghost={ghost} />
                  )}
                  <span className={`equip-label${slot === "offhand" ? " locked" : ""}`}>{t(`inventory.slot.${slot}`)}</span>
                </div>
              );
            })}
          </div>
          <div className="stat-list">
            <Stat label={t("inventory.stat.maxHp")} value={stats.maxHp} />
            <Stat label={t("inventory.stat.attack")} value={stats.attack} />
            <Stat label={t("inventory.stat.defense")} value={stats.defense} />
            <Stat label={t("inventory.stat.crit")} value={`${Math.round(stats.crit * 100)}%`} />
            <Stat label={t("inventory.stat.luck")} value={`${Math.round(stats.luck * 100)}%`} />
            <Stat wide label={t("inventory.stat.honor")} value={`${t(`honor.rank.${honorRank(honor)}`)} (${honor})`} />
            <Stat wide label={t("combat.weaponStat")} value={`${t(`combat.weapon.${weaponProfile(equipment.weapon).kind}`)} · ${t(`combat.damageType.${weaponProfile(equipment.weapon).damageType}`)}`} />
            <Stat label={t("combat.stamina")} value={Math.round(getGame()?.player?.maxStamina ?? STAMINA.max + staminaBonus(talents))} />
            {relic.sellValueBonus > 0 && <Stat label={t("inventory.stat.sellBonus")} value={`+${Math.round(relic.sellValueBonus * 100)}%`} />}
            {relic.rareLootChanceBonus > 0 && <Stat label={t("inventory.stat.rareLoot")} value={`+${Math.round(relic.rareLootChanceBonus * 100)}%`} />}
          </div>
          <button type="button" className="link-btn" onClick={() => useUiStore.getState().openPanel("skills")}>
            {t("inventory.skills")} — {t("inventory.skillDetails")}
          </button>
        </div>

        <div className="inv-right">
          <div className="section-title">{t("inventory.bag")}</div>
          <div className="bag-grid">
            {sorted.map((s, i) => (
              <ItemIcon
                key={`${s.itemId}-${s.stolen ? "s" : ""}-${i}`}
                itemId={s.itemId}
                quantity={s.quantity}
                stolen={s.stolen}
                size={44}
                dur={s.dur !== undefined ? { cur: s.dur, max: maxDurability(s.itemId) } : null}
                selected={selected?.from === "bag" && selected.itemId === s.itemId && !!selected.stolen === !!s.stolen}
                onClick={() => setSelected({ itemId: s.itemId, from: "bag", stolen: s.stolen })}
                onDoubleClick={() => {
                  const def = getItem(s.itemId);
                  use(def);
                  if (def.equipSlot || !useInventoryStore.getState().hasItem(def.id)) setSelected(null);
                }}
              />
            ))}
            {Array.from({ length: Math.max(0, BAG_SLOTS - sorted.length) }, (_, i) => (
              <EmptySlot key={`e${i}`} size={44} />
            ))}
          </div>

          <div className="item-detail">
            {selectedDef ? (
              <ItemDetail
                def={selectedDef}
                equipped={selected?.from !== "bag"}
                stolen={selected?.stolen}
                onAct={() => act(selectedDef)}
                dur={selected && selected.from !== "bag" ? durabilityOf(selected.from) : sorted.find((s) => s.itemId === selectedDef.id && !!s.stolen === !!selected?.stolen)?.dur}
              />
            ) : (
              <div className="empty-hint">{t("inventory.selectHint")}</div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, wide }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={`stat${wide ? " wide" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function itemBonuses(def: ItemDef): string[] {
  const bonuses = Object.entries(def.statBonus ?? {}).map(([k, v]) =>
    k === "crit" || k === "luck" ? `+${Math.round((v as number) * 100)}% ${t(`common.stat.${k}`)}` : `+${v} ${t(`common.stat.${k as "maxHp" | "attack" | "defense"}`)}`,
  );
  const fx = def.relicEffects ?? {};
  if (fx.sellValueBonus) bonuses.push(t("inventory.bonus.sellValue", { pct: Math.round(fx.sellValueBonus * 100) }));
  if (fx.rareLootChanceBonus) bonuses.push(t("inventory.bonus.rareLoot", { pct: Math.round(fx.rareLootChanceBonus * 100) }));
  if (fx.gatherSpeedBonus) bonuses.push(t("inventory.bonus.gatherSpeed", { pct: Math.round(fx.gatherSpeedBonus * 100) }));
  if (def.toolPower) bonuses.push(t("inventory.bonus.toolTier", { n: def.toolPower }));
  if (def.lightBonus) bonuses.push(t("inventory.bonus.light"));
  if (def.healAmount) bonuses.push(t("inventory.bonus.heal", { n: def.healAmount }));
  return bonuses;
}

/** Weapon family + damage type + special traits, in words. */
function weaponLine(def: ItemDef): string | null {
  if (def.equipSlot !== "weapon") return null;
  const w = weaponProfile(def.id);
  const parts = [`${t(`combat.weapon.${w.kind}`)} · ${t(`combat.damageType.${w.damageType}`)}`, t(`combat.weaponInfo.${w.kind}`)];
  if (def.bane) parts.push(t("combat.bane"));
  return parts.join(" — ");
}

/** Stat changes if you swapped this in for what's in its slot now. */
function compareLine(def: ItemDef, equipment: EquipmentSaveState): { text: string; up: boolean }[] {
  if (!def.equipSlot) return [];
  const cur = equipment[def.equipSlot];
  if (!cur || cur === def.id) return [];
  const a = getItem(cur).statBonus ?? {};
  const b = def.statBonus ?? {};
  const out: { text: string; up: boolean }[] = [];
  for (const k of ["attack", "defense", "maxHp", "crit", "luck"] as const) {
    const d = (b[k] ?? 0) - (a[k] ?? 0);
    if (Math.abs(d) < 1e-6) continue;
    const v = k === "crit" || k === "luck" ? `${Math.round(d * 100)}%` : String(d);
    out.push({ text: `${d > 0 ? "+" : ""}${v} ${t(`common.stat.${k}`)}`, up: d > 0 });
  }
  return out;
}

export function ItemDetail({ def, equipped, stolen, onAct, dur }: { def: ItemDef; equipped?: boolean; stolen?: boolean; onAct?: () => void; dur?: number }) {
  const maxDur = maxDurability(def.id);
  const curDur = Math.floor(Math.min(maxDur, dur ?? maxDur));
  const bonuses = itemBonuses(def);
  const equipment = usePlayerStore((s) => s.equipment);
  const compare = compareLine(def, equipment);
  const action = equipped
    ? t("inventory.action.unequip")
    : def.equipSlot
      ? t("inventory.action.equip")
      : def.healAmount || def.mana || def.energy
        ? t(def.id.includes("potion") || def.id.includes("elixir") || def.id.includes("salve") ? "inventory.action.drink" : "inventory.action.eat")
        : def.useEffect
          ? t(def.useEffect === "return_home" ? "inventory.action.read" : "inventory.action.use")
          : null;
  return (
    <div className="detail">
      <img className={`detail-icon rarity-${def.rarity}`} src={`/icons/${def.icon}.png`} alt="" style={{ ["--rarity" as string]: RARITY_COLOR[def.rarity] }} />
      <div className="detail-body">
        <div className="detail-headrow">
          <div className="detail-name" style={{ color: RARITY_INK[def.rarity] }}>
            {itemName(def.id)}
          </div>
          <div className="detail-footer">
            <span className="detail-value" title={t("inventory.sellsFor")}>
              <img src="/icons/gold_coin.png" alt="" /> {def.value > 0 && !def.keyItem ? shopSellPrice(def.id) : "—"}
            </span>
            {action && onAct && (
              <button type="button" className="btn" onClick={onAct}>
                {action}
              </button>
            )}
          </div>
        </div>
        <div className="detail-rarity">
          {t(`common.rarity.${def.rarity}`)} {t(`common.category.${def.category}`)}
          {def.keyItem && <span className="tag tag-key">{t("inventory.keyItem")}</span>}
          {stolen && <span className="tag tag-stolen">{t("inventory.stolenTag")}</span>}
        </div>
        <div className="detail-desc">{itemDesc(def.id)}</div>
        {bonuses.length > 0 && <div className="detail-bonus">{bonuses.join(" · ")}</div>}
        {weaponLine(def) && <div className="detail-weapon">{weaponLine(def)}</div>}
        {maxDur > 0 && (
          <div className={`detail-dur wear-${wearState(curDur, maxDur)}`}>
            {t("durability.label")}: {curDur}/{maxDur} · {t(`durability.state.${wearState(curDur, maxDur)}`)}
          </div>
        )}
        {def.uniqueFrom && <div className="detail-unique">{t("inventory.uniqueFrom", { name: enemyName(def.uniqueFrom, getEnemy(def.uniqueFrom).name) })}</div>}
        {!equipped && compare.length > 0 && (
          <div className="detail-compare">
            <span>{t("inventory.vsEquipped")}</span>
            {compare.map((c) => (
              <b key={c.text} className={c.up ? "up" : "down"}>
                {c.up ? "▲" : "▼"} {c.text}
              </b>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
