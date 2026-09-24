import { useState } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useWorldStore } from "../../store/worldStore";
import { useTimeStore } from "../../store/timeStore";
import { useTownStore } from "../../store/townStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useUiStore } from "../../store/uiStore";
import { useSocialStore } from "../../store/socialStore";
import { ITEMS, getItem } from "../../data/items";
import { NPCS } from "../../data/npcs";
import { RECIPES, type Recipe } from "../../data/recipes";
import { houseLevelInfo, MAX_HOUSE_LEVEL } from "../../data/house";
import { ownsItem } from "../../game/actions";
import { honorRank } from "../../game/social/honor";
import { RARITY_COLOR, RARITY_ORDER, rarityRank } from "../../game/core/types";
import { Panel } from "../components/Panel";
import { Bar } from "../components/Bar";
import { QuestJournal } from "./QuestPanels";
import { friendTier } from "../../data/relationships";
import { perksOf } from "../../game/relationships";
import { REP_GROUPS, repRank } from "../../game/social/reputation";
import { houseName, housePerks, itemName, npcName } from "../../i18n/content";
import { fmt, t, type TKey } from "../../i18n";

type Term = "short" | "medium" | "long" | "collection";

interface Goal {
  term: Term;
  title: string;
  detail: string;
  progress: number;
}

/** How close the materials in your bag get you to a recipe (0..1). */
function readiness(inputs: { itemId: string; quantity: number }[]): number {
  const inv = useInventoryStore.getState();
  if (!inputs.length) return 1;
  return Math.min(...inputs.map((m) => Math.min(1, inv.quantityOf(m.itemId) / m.quantity)));
}

/** The next forge upgrade on a ladder you're already climbing. */
function nextUpgrade(category: Recipe["category"]): Recipe | undefined {
  return RECIPES.find((r) => r.station === "forge" && r.category === category && !ownsItem(r.output.itemId) && (!r.upgradesFrom || ownsItem(r.upgradesFrom)));
}

function useGoals(): Goal[] {
  const progress = useWorldStore((s) => s.progress);
  const gambling = usePlayerStore((s) => s.skills.gambling.level);
  const houseLevel = useTownStore((s) => s.buildingLevels.house ?? 1);
  const hunted = useSocialStore((s) => s.deeds.animalsHunted);
  useInventoryStore((s) => s.stacks);
  usePlayerStore((s) => s.equipment);
  const goals: Goal[] = [];
  const need = (r: Recipe) => r.inputs.map((m) => `${useInventoryStore.getState().quantityOf(m.itemId)}/${m.quantity} ${itemName(m.itemId)}`).join(" · ");
  for (const [cat, label] of [
    ["tools", "journal.nextTool"],
    ["weapons", "journal.nextWeapon"],
    ["armor", "journal.nextArmor"],
  ] as const) {
    const r = nextUpgrade(cat);
    if (r) goals.push({ term: "short", title: t(label, { item: itemName(r.output.itemId) }), detail: need(r), progress: readiness(r.inputs) });
  }
  const mineTarget = Math.max(5, Math.ceil((progress.mineDeepest + 1) / 5) * 5);
  goals.push({ term: "medium", title: t("journal.reachMine", { n: mineTarget }), detail: t("journal.deepestSoFar", { n: progress.mineDeepest || 0 }), progress: progress.mineDeepest / mineTarget });
  const depthTarget = Math.max(5, Math.ceil((progress.dungeonDeepest + 1) / 5) * 5);
  goals.push({ term: "medium", title: t("journal.beatBoss", { n: depthTarget }), detail: t("journal.deepestSoFar", { n: progress.dungeonDeepest || 0 }), progress: progress.dungeonDeepest / depthTarget });
  if (houseLevel < MAX_HOUSE_LEVEL) {
    const next = houseLevelInfo(houseLevel + 1);
    goals.push({ term: "medium", title: t("journal.upgradeHome", { name: houseName(next.level) }), detail: housePerks(next.level)[0], progress: readiness(next.cost!.materials) });
  }
  goals.push({ term: "long", title: t("journal.abyss"), detail: t("journal.abyssDetail"), progress: Math.min(1, progress.dungeonDeepest / 20) });
  goals.push({ term: "long", title: t("journal.mithril"), detail: t("journal.mithrilDetail"), progress: Math.min(1, progress.mineDeepest / 20) });
  goals.push({ term: "long", title: t("journal.gambler"), detail: t("journal.gamblerDetail"), progress: Math.min(1, (gambling - 1) / 9) });
  goals.push({
    term: "collection",
    title: t("journal.legendary"),
    detail: t("journal.legendaryDetail"),
    progress: progress.discoveries.some((d) => d.startsWith("item:") && ITEMS[d.slice(5)]?.rarity === "legendary") ? 1 : 0,
  });
  goals.push({ term: "collection", title: t("journal.hunter"), detail: t("journal.hunterDetail"), progress: progress.discoveries.includes("item:hide") ? 1 : Math.min(0.9, hunted / 3) });
  goals.push({ term: "collection", title: t("journal.grove"), detail: t("journal.groveDetail"), progress: progress.discoveries.includes("ancient_grove") ? 1 : 0 });
  goals.push({ term: "collection", title: t("journal.glade"), detail: t("journal.gladeDetail"), progress: progress.discoveries.some((d) => d.startsWith("glade:")) ? 1 : 0 });
  return goals;
}

type Tab = "quests" | "goals" | "records" | "people" | "collection";

export function JournalPanel() {
  const [tab, setTab] = useState<Tab>((useUiStore.getState().panelData.tab as Tab) ?? "quests");
  const goals = useGoals();
  const progress = useWorldStore((s) => s.progress);
  const stats = useWorldStore((s) => s.stats);
  const social = useSocialStore();
  const day = useTimeStore((s) => s.day);
  const level = usePlayerStore((s) => s.level);
  const gold = usePlayerStore((s) => s.gold);
  const found = new Set(progress.discoveries.filter((d) => d.startsWith("item:")).map((d) => d.slice(5)));
  const all = Object.values(ITEMS)
    .filter((i) => !i.keyItem)
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || itemName(a.id).localeCompare(itemName(b.id)));
  const people = Object.entries(social.relationships)
    .filter(([id]) => NPCS[id])
    .sort((a, b) => b[1].friendship - a[1].friendship);

  const records: [TKey, string | number][] = [
    ["journal.rec.days", day],
    ["journal.rec.level", level],
    ["journal.rec.gold", fmt(gold)],
    ["journal.rec.honor", `${t(`honor.rank.${honorRank(social.honor)}`)} (${social.honor})`],
    ["journal.rec.deepest", progress.dungeonDeepest || t("common.none")],
    ["journal.rec.checkpoint", progress.dungeonCheckpoint ? t("common.floor", { n: progress.dungeonCheckpoint }) : t("common.none")],
    ["journal.rec.mine", progress.mineDeepest || t("common.none")],
    ["journal.rec.runs", progress.runsCompleted],
    ["journal.rec.bosses", progress.bossesSlain.length],
    ["journal.rec.enemies", stats.enemiesSlain],
    ["journal.rec.animals", social.deeds.animalsHunted],
    ["journal.rec.deaths", stats.deaths],
    ["journal.rec.won", `${fmt(stats.goldWonGambling)}g`],
    ["journal.rec.lost", `${fmt(stats.goldLostGambling)}g`],
    ["journal.rec.stolen", social.deeds.stolen],
    ["journal.rec.places", progress.discoveries.filter((d) => !d.startsWith("item:")).length],
  ];

  return (
    <Panel title={t("journal.title")} subtitle={t("journal.subtitle")} icon="journal" width={760}>
      <div className="tabs journal-tabs">
        {(["quests", "goals", "records", "people", "collection"] as const).map((k) => (
          <button type="button" key={k} className={`tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>
            {k === "quests" ? t("quests.tab") : k === "goals" ? t("journal.goals") : k === "records" ? t("journal.records") : k === "people" ? t("journal.people") : t("journal.collection", { n: found.size, total: all.length })}
          </button>
        ))}
      </div>

      {tab === "quests" && <QuestJournal />}

      {tab === "goals" && (
        <div className="goal-list">
          {goals.map((g) => (
            <div key={g.title} className={`goal${g.progress >= 1 ? " done" : ""}`}>
              <span className={`goal-term term-${g.term}`}>{t(`journal.term.${g.term}`)}</span>
              <div className="goal-body">
                <b>{g.title}</b>
                <small>{g.detail}</small>
                <Bar value={Math.round(Math.min(1, g.progress) * 100)} max={100} kind="xp" height={6} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "records" && (
        <div className="records">
          {records.map(([k, v]) => (
            <div className="stat" key={k}>
              <span>{t(k)}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      )}

      {tab === "people" && <Reputation />}
      {tab === "people" && (
        <div className="people">
          {people.length === 0 && <div className="empty-hint">{t("journal.nobody")}</div>}
          {people.map(([id, rel]) => (
            <div className="person" key={id}>
              <div className="person-head">
                <b>{npcName(NPCS[id])}</b>
                <span className="person-tier">{t(`gift.tier.${friendTier(rel.friendship)}`)}</span>
                <span className="hearts" title={`${rel.friendship}/100`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={rel.friendship >= (i + 1) * 20 ? "heart full" : rel.friendship > i * 20 ? "heart half" : "heart"}>
                      ♥
                    </span>
                  ))}
                </span>
              </div>
              <small className="person-loves">{rel.known?.length ? `${t("gift.loves")}: ${rel.known.map((i) => itemName(i)).join(", ")}` : t("gift.unknownLoves")}</small>
              {perksOf(id).map((perk) => (
                <small key={perk} className="person-perk">
                  ★ {t(`gift.perk.${perk}`)}
                </small>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "collection" && (
        <div className="collection">
          {RARITY_ORDER.map((r) => (
            <div key={r} className="collection-row">
              {all
                .filter((i) => i.rarity === r)
                .map((i) => (
                  <img
                    key={i.id}
                    src={`/icons/${getItem(i.id).icon}.png`}
                    alt=""
                    title={found.has(i.id) ? itemName(i.id) : "???"}
                    className={found.has(i.id) ? "found" : "unknown"}
                    style={{ borderColor: RARITY_COLOR[r] }}
                  />
                ))}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Village / Watch / Underworld standing, plus any bounty. */
function Reputation() {
  const rep = useSocialStore((s) => s.rep);
  const bounty = useSocialStore((s) => s.bounty);
  return (
    <div className="rep-row">
      {REP_GROUPS.map((g) => (
        <div key={g} className={`rep rep-${g}`}>
          <span className="rep-name">{t(`rep.name.${g}`)}</span>
          <div className="rep-bar">
            <i style={{ left: `${50 + Math.min(0, rep[g]) / 2}%`, width: `${Math.abs(rep[g]) / 2}%` }} className={rep[g] >= 0 ? "pos" : "neg"} />
          </div>
          <small>{t(`rep.rank.${repRank(rep[g])}`)}</small>
        </div>
      ))}
      {bounty > 0 && (
        <div className="rep rep-bounty">
          <span className="rep-name">{t("rep.bountyLabel")}</span>
          <b>{bounty}g</b>
        </div>
      )}
    </div>
  );
}
