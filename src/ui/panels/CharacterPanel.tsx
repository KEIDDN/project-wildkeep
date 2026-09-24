import { useState } from "react";
import { Panel } from "../components/Panel";
import { Bar } from "../components/Bar";
import { CharacterPreview } from "../components/CharacterPreview";
import { usePlayerStore } from "../../store/playerStore";
import { useSocialStore } from "../../store/socialStore";
import { useTownStore } from "../../store/townStore";
import { getItem, weaponProfile, EQUIP_SLOTS } from "../../data/items";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { xpForLevel } from "../../game/systems/statsSystem";
import { buyPriceFactor, honorRank, sellPriceFactor } from "../../game/social/honor";
import { REP_GROUPS, repRank } from "../../game/social/reputation";
import { maxEnergy } from "../../game/systems/vitals";
import { maxMana } from "../../game/systems/magic";
import { getGame } from "../../engine/gameInstance";
import { durabilityOf, maxDurability, wearState } from "../../game/systems/durability";
import { itemName } from "../../i18n/content";
import { fmt, t, tDyn } from "../../i18n";

/**
 * The character sheet (C): who you are, what you can do, and what the
 * village thinks of you — Honor and each group's opinion, spelled out in
 * plain words (what it changes, what moves it).
 */
export function CharacterPanel() {
  const [tab, setTab] = useState<"stats" | "standing">("stats");
  const level = usePlayerStore((s) => s.level);
  const honor = useSocialStore((s) => s.honor);
  return (
    <Panel title={t("character.title")} subtitle={t("character.subtitle", { level, rank: t(`honor.rank.${honorRank(honor)}`) })} icon="armor_leather" width={820}>
      <div className="tabs">
        <button type="button" className={`tab${tab === "stats" ? " active" : ""}`} onClick={() => setTab("stats")}>
          {t("character.tabStats")}
        </button>
        <button type="button" className={`tab${tab === "standing" ? " active" : ""}`} onClick={() => setTab("standing")}>
          {t("character.tabStanding")}
        </button>
      </div>
      {tab === "stats" ? <StatsSheet /> : <Standing />}
    </Panel>
  );
}

function StatsSheet() {
  const p = usePlayerStore();
  const houseLevel = useTownStore((s) => s.buildingLevels.house ?? 1);
  const stats = playerEffectiveStats(p, houseLevel);
  const weapon = weaponProfile(p.equipment.weapon);
  const stamina = getGame()?.player?.maxStamina ?? 0;
  const mana = maxMana();
  const row = (icon: string, label: string, value: string, hint?: string) => (
    <div className="char-stat" title={hint}>
      <img src={`/icons/${icon}.png`} alt="" />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
  return (
    <div className="char-sheet">
      <div className="char-left">
        <div className="char-portrait">
          <CharacterPreview equipment={p.equipment} scale={4} />
        </div>
        <div className="char-level">
          <b>{t("common.lv", { n: p.level })}</b>
          <Bar value={p.xp} max={xpForLevel(p.level)} kind="xp" height={12} label={`${fmt(p.xp)} / ${fmt(xpForLevel(p.level))} ${t("common.xp")}`} />
        </div>
        <div className="char-gear">
          {EQUIP_SLOTS.map((slot) => {
            const id = p.equipment[slot];
            if (!id) return null;
            const def = getItem(id);
            const max = maxDurability(id);
            const cur = durabilityOf(slot);
            const ws = max ? wearState(cur, max) : null;
            return (
              <div key={slot} className={`char-gear-row rarity-${def.rarity}`}>
                <img src={`/icons/${def.icon}.png`} alt="" />
                <span className="char-gear-name">{itemName(id)}</span>
                {ws && (
                  <span className={`wear wear-${ws}`} title={t(`durability.state.${ws}`)}>
                    {cur}/{max}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="char-right">
        <div className="section-title">{t("character.vitals")}</div>
        <div className="char-stats">
          {row("glyph_heart", t("hud.health"), `${p.hp} / ${stats.maxHp}`)}
          {row("glyph_bolt", t("combat.stamina"), `${Math.round(stamina)}`, t("character.staminaHint"))}
          {row("glyph_sun", t("energy.label"), `${Math.ceil(p.energy)} / ${maxEnergy()}`, t("character.energyHint"))}
          {mana > 0 && row("glyph_mana", t("hud.mana"), `${mana}`)}
        </div>
        <div className="section-title">{t("character.combat")}</div>
        <div className="char-stats">
          {row("sword_iron", t("character.attack"), `${stats.attack}`)}
          {row("glyph_shield", t("character.defense"), `${stats.defense}`)}
          {row("sword_steel", t("character.crit"), `${Math.round((stats.crit + weapon.crit) * 100)}%`)}
          {row("clover", t("character.luck"), `${(stats.luck * 100).toFixed(1)}%`)}
        </div>
        <div className="char-weapon">
          <b>{tDyn(`combat.weapon.${weapon.kind}`)}</b> · {tDyn(`combat.damageType.${weapon.damageType}`)} — {tDyn(`combat.weaponInfo.${weapon.kind}`)}
        </div>
        <p className="hint">{t("character.statsHint")}</p>
      </div>
    </div>
  );
}

function Meter({ value, labels }: { value: number; labels?: [string, string] }) {
  const pct = ((value + 100) / 200) * 100;
  return (
    <div className="standing-meter">
      <div className="standing-track">
        <span className="standing-zero" />
        <span className="standing-mark" style={{ left: `${pct}%` }} />
      </div>
      {labels && (
        <div className="standing-ends">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

function Standing() {
  const honor = useSocialStore((s) => s.honor);
  const rep = useSocialStore((s) => s.rep);
  const bounty = useSocialStore((s) => s.bounty);
  const deeds = useSocialStore((s) => s.deeds);
  const rank = honorRank(honor);
  const buy = Math.round((buyPriceFactor(honor) - 1) * 100);
  const sell = Math.round((sellPriceFactor(honor) - 1) * 100);
  const pct = (n: number) => (n > 0 ? `+${n}%` : `${n}%`);
  return (
    <div className="standing">
      <div className={`standing-honor honor-${rank}`}>
        <div className="standing-head">
          <b>{t("hud.honor")}</b>
          <span className="standing-rank">
            {t(`honor.rank.${rank}`)} ({honor > 0 ? `+${honor}` : honor})
          </span>
        </div>
        <Meter value={honor} labels={[t("honor.rank.villain"), t("honor.rank.hero")]} />
        <p className="standing-text">{tDyn(`character.honorMeans.${rank}`)}</p>
        <ul className="standing-effects">
          <li>{buy === 0 && sell === 0 ? t("character.pricesFair") : t("character.prices", { buy: pct(buy), sell: pct(sell) })}</li>
          <li>{tDyn(`character.honorPerk.${rank}`)}</li>
        </ul>
        <div className="standing-how">
          <div>
            <b className="good">{t("character.raises")}</b> {t("character.raisesList")}
          </div>
          <div>
            <b className="bad">{t("character.lowers")}</b> {t("character.lowersList")}
          </div>
        </div>
      </div>
      <div className="standing-groups">
        {REP_GROUPS.map((g) => {
          const v = rep[g];
          const r = repRank(v);
          return (
            <div key={g} className={`standing-group rep-${r}`}>
              <div className="standing-head">
                <b>{t(`rep.name.${g}`)}</b>
                <span className="standing-rank">
                  {t(`rep.rank.${r}`)} ({v > 0 ? `+${v}` : v})
                </span>
              </div>
              <Meter value={v} />
              <p className="standing-text">{tDyn(`character.group.${g}`)}</p>
            </div>
          );
        })}
      </div>
      <div className="standing-foot">
        {bounty > 0 ? <span className="bad">{t("character.bounty", { n: bounty })}</span> : <span>{t("character.noBounty")}</span>}
        <span>{t("character.deeds", { helped: deeds.helped, stolen: deeds.stolen, caught: deeds.caught, rounds: deeds.roundsBought, hunted: deeds.animalsHunted })}</span>
        <span className="hint">{t("character.recoverable")}</span>
      </div>
    </div>
  );
}
