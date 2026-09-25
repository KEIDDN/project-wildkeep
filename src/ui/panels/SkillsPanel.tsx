import { useState } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore } from "../../store/uiStore";
import { audio } from "../../game/audio/AudioManager";
import { TALENTS, TALENT_BRANCHES, canLearn, pointsSpent, rank, respecCost, talentPoints, type TalentBranch, type TalentDef, type TalentId } from "../../data/talents";
import { useWorldStore } from "../../store/worldStore";
import { useTimeStore } from "../../store/timeStore";
import { useTownStore } from "../../store/townStore";
import { SKILLS, SKILL_ORDER, MAX_SKILL_LEVEL, skillXpForLevel, type SkillId } from "../../data/skills";
import { houseLevelInfo } from "../../data/house";
import { doubleYieldChance, gatherPowerBonus, luckyPushChance, maxBetFor, rareFindBonus, skillStatBonus } from "../../game/systems/skills";
import { Panel } from "../components/Panel";
import { Bar } from "../components/Bar";
import { skillName, skillTrainedBy } from "../../i18n/content";
import { t, tDyn } from "../../i18n";

/** What the current level of a skill is doing for you, in plain words. */
function perkText(id: SkillId, level: number, skills: ReturnType<typeof usePlayerStore.getState>["skills"]): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  switch (id) {
    case "strength":
      return t("skills.perk.strength", { n: skillStatBonus(skills).attack ?? 0 });
    case "defense":
      return t("skills.perk.defense", { def: skillStatBonus(skills).defense ?? 0, hp: skillStatBonus(skills).maxHp ?? 0 });
    case "luck":
      return t("skills.perk.luck", { luck: (skillStatBonus(skills).luck! * 100).toFixed(1), push: pct(luckyPushChance(level)) });
    case "gambling":
      return t("skills.perk.gambling", { n: maxBetFor(level) });
    default:
      return t("skills.perk.gather", { power: pct(gatherPowerBonus(level)), double: pct(doubleYieldChance(level)), rare: pct(rareFindBonus(level)) });
  }
}

export function SkillsPanel() {
  const [tab, setTab] = useState<"skills" | "talents">(() => {
    const s = usePlayerStore.getState();
    return talentPoints(s.level, s.talents, s.bonusTalentPoints) > 0 ? "talents" : "skills";
  });
  const points = usePlayerStore((s) => talentPoints(s.level, s.talents, s.bonusTalentPoints));
  return (
    <Panel title={t("skills.title")} subtitle={tab === "talents" ? t("skills.talentsSub") : t("skills.grow")} icon="skill_strength" width={tab === "talents" ? 1120 : 620}>
      <div className="tabs">
        <button type="button" className={`tab${tab === "skills" ? " active" : ""}`} onClick={() => setTab("skills")}>
          {t("talents.skillsTab")}
        </button>
        <button type="button" className={`tab${tab === "talents" ? " active" : ""}`} onClick={() => setTab("talents")}>
          {t("talents.tab")} {points > 0 && <span className="talent-badge">{points}</span>}
        </button>
      </div>
      {tab === "skills" ? <SkillList /> : <TalentTree />}
    </Panel>
  );
}

const TREE_TOP = 44;
/** Row spacing: roomy on tall screens, compact enough on 720p that the
 * detail box below the tree still fits. */
const nodeRow = () => Math.max(72, Math.min(96, Math.floor((window.innerHeight - 440) / 4)));

function TalentTree() {
  const talents = usePlayerStore((s) => s.talents);
  const level = usePlayerStore((s) => s.level);
  const bonus = usePlayerStore((s) => s.bonusTalentPoints);
  const gold = usePlayerStore((s) => s.gold);
  const magicOpen = useWorldStore((s) => !!s.progress.flags.magic_learned);
  const [confirm, setConfirm] = useState(false);
  const [hover, setHover] = useState<TalentId | null>(null);
  const cost = respecCost(level);
  const spent = pointsSpent(talents);
  const points = talentPoints(level, talents, bonus);
  const learn = (id: TalentId) => {
    if (usePlayerStore.getState().learnTalent(id)) {
      audio.sfx("levelup");
      useUiStore.getState().pushToast(t("talents.learned", { name: tDyn(`talents.${id}.name`) }), "levelup", { icon: TALENTS.find((d) => d.id === id)!.icon });
    } else audio.sfx("deny");
  };
  const respec = () => {
    if (!confirm) return setConfirm(true);
    setConfirm(false);
    if (usePlayerStore.getState().respecTalents()) {
      audio.sfx("coin");
      useUiStore.getState().pushToast(t("talents.respecDone"), "info", { icon: "journal" });
    } else {
      audio.sfx("deny");
      useUiStore.getState().pushToast(t("talents.respecBroke", { n: cost }), "warning");
    }
  };
  // Build identity: the branch you've put the most into.
  const perBranch = TALENT_BRANCHES.map((b) => ({ b, n: TALENTS.filter((d) => d.branch === b).reduce((n, d) => n + rank(talents, d.id), 0) }));
  const top = perBranch.reduce((a, c) => (c.n > a.n ? c : a), { b: "combat" as TalentBranch, n: 0 });
  const focus = hover ? TALENTS.find((d) => d.id === hover)! : null;
  const statusOf = (d: TalentDef) => canLearn(d, talents, level, bonus, magicOpen);
  const rows = Math.max(...TALENTS.map((d) => d.tier)) + 1;
  const NODE_ROW = nodeRow();
  return (
    <>
      <div className="talent-head">
        <span className={`talent-points${points > 0 ? " has" : ""}`}>{points > 0 ? t("talents.points", { n: points }) : t("talents.pointsNone")}</span>
        <span className="talent-style">{top.n > 0 ? tDyn(`talents.style.${top.b}`) : t("talents.style.none")}</span>
        {spent > 0 && (
          <button type="button" className={`btn btn-small${confirm ? " btn-danger" : ""}`} disabled={gold < cost} onClick={respec} onMouseLeave={() => setConfirm(false)}>
            {confirm ? t("talents.respecConfirm", { n: cost }) : t("talents.respec", { n: cost })}
          </button>
        )}
      </div>
      <div className="ttree" style={{ height: TREE_TOP + rows * NODE_ROW + 10 }}>
        {TALENT_BRANCHES.map((b, bi) => {
          const defs = TALENTS.filter((d) => d.branch === b);
          const sealed = b === "magic" && !magicOpen;
          const n = perBranch[bi].n;
          // Node centres in % of the branch width (x) and px (y); the link
          // SVG uses the same units.
          const pos = (d: TalentDef) => ({ x: 20 + d.col * 30, y: TREE_TOP + d.tier * NODE_ROW + 30 });
          // A link that skips a row bows sideways around any node in its way.
          const bow = (parent: TalentDef, d: TalentDef) => {
            const blocked = defs.some((o) => o.tier > parent.tier && o.tier < d.tier && Math.abs(o.col - (parent.col + ((d.col - parent.col) * (o.tier - parent.tier)) / (d.tier - parent.tier))) < 0.6);
            return blocked ? (parent.col + d.col <= 2 ? -17 : 17) : 0;
          };
          return (
            <div className={`ttree-branch branch-${b}${sealed ? " sealed" : ""}`} key={b}>
              <div className="ttree-title">
                {t(`talents.branch.${b}`)}
                {n > 0 && <span className="ttree-count">{n}</span>}
              </div>
              <svg className="ttree-links" viewBox={`0 0 100 ${TREE_TOP + rows * NODE_ROW + 10}`} preserveAspectRatio="none">
                {defs
                  .filter((d) => d.requires)
                  .map((d) => {
                    const parent = defs.find((p) => p.id === d.requires!.id)!;
                    const a = pos(parent);
                    const c = pos(d);
                    const lit = rank(talents, parent.id) >= d.requires!.rank;
                    const owned = rank(talents, d.id) > 0;
                    const off = bow(parent, d);
                    const path = off
                      ? `M ${a.x} ${a.y} C ${a.x + off} ${a.y + (c.y - a.y) * 0.3}, ${c.x + off} ${a.y + (c.y - a.y) * 0.7}, ${c.x} ${c.y}`
                      : `M ${a.x} ${a.y} C ${a.x} ${(a.y + c.y) / 2}, ${c.x} ${(a.y + c.y) / 2}, ${c.x} ${c.y}`;
                    return (
                      <path
                        key={d.id}
                        d={path}
                        className={`ttree-link${owned ? " owned" : lit ? " lit" : ""}`}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
              </svg>
              {defs.map((d) => {
                const r = rank(talents, d.id);
                const st = statusOf(d);
                const p = pos(d);
                return (
                  <button
                    type="button"
                    key={d.id}
                    className={`tnode${d.keystone ? " keystone" : ""}${r > 0 ? " owned" : ""}${r >= d.maxRank ? " maxed" : ""}${st === "ok" ? " available" : ""}${st === "locked" || st === "level" || st === "sealed" ? " locked" : ""}${hover === d.id ? " hovered" : ""}`}
                    style={{ left: `${p.x}%`, top: p.y }}
                    onMouseEnter={() => setHover(d.id)}
                    onFocus={() => setHover(d.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => (st === "ok" ? learn(d.id) : audio.sfx("deny"))}
                  >
                    <img src={`/icons/${d.icon}.png`} alt="" />
                    <span className="tnode-rank">
                      {r}/{d.maxRank}
                    </span>
                  </button>
                );
              })}
              {sealed && <div className="ttree-seal">{t("talents.sealed")}</div>}
            </div>
          );
        })}
      </div>
      <div className="tdetail">
        {focus ? (
          <>
            <img src={`/icons/${focus.icon}.png`} alt="" />
            <div className="tdetail-body">
              <div className="tdetail-head">
                <b>{tDyn(`talents.${focus.id}.name`)}</b>
                <span className="tdetail-rank">{t("talents.rank", { r: rank(talents, focus.id), max: focus.maxRank })}</span>
                <span className={`tdetail-branch branch-${focus.branch}`}>{t(`talents.branch.${focus.branch}`)}</span>
              </div>
              <div className="tdetail-desc">{tDyn(`talents.${focus.id}.desc`)}</div>
              <div className="tdetail-status">
                {(() => {
                  const st = statusOf(focus);
                  if (st === "ok") return <span className="good">{t("talents.clickToLearn")}</span>;
                  if (st === "maxed") return t("talents.maxed");
                  if (st === "sealed") return t("talents.sealed");
                  if (st === "locked") return t("talents.needs", { name: tDyn(`talents.${focus.requires!.id}.name`), r: focus.requires!.rank });
                  if (st === "level") return t("talents.needsLevel", { n: focus.level! });
                  return t("talents.pointsNone");
                })()}
              </div>
            </div>
          </>
        ) : (
          <div className="tdetail-empty">{t("talents.hover")}</div>
        )}
      </div>
    </>
  );
}

function SkillList() {
  const skills = usePlayerStore((s) => s.skills);
  const restedDay = useTimeStore((s) => s.restedDay);
  const day = useTimeStore((s) => s.day);
  const houseLevel = useTownStore((s) => s.buildingLevels.house ?? 1);
  const rested = restedDay === day ? houseLevelInfo(houseLevel).perks.restedXpBonus : 0;
  return (
    <>
      {rested > 0 && <div className="hint">{t("skills.rested", { pct: Math.round(rested * 100) })}</div>}
      <div className="skill-list">
        {SKILL_ORDER.map((id) => {
          const def = SKILLS[id];
          const { level, xp } = skills[id];
          const need = skillXpForLevel(level);
          return (
            <div className="skill-row" key={id}>
              <img className="skill-icon" src={`/icons/${def.icon}.png`} alt="" />
              <div className="skill-body">
                <div className="skill-head">
                  <b>{skillName(id)}</b>
                  <span className="skill-level">{t("common.lv", { n: level })}</span>
                </div>
                {level < MAX_SKILL_LEVEL ? <Bar value={xp} max={need} kind="xp" height={12} label={`${xp} / ${need} ${t("common.xp")}`} /> : <small>{t("skills.mastered")}</small>}
                <small className="skill-perk">{perkText(id, level, skills)}</small>
                <small className="skill-train">{skillTrainedBy(id)}</small>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
