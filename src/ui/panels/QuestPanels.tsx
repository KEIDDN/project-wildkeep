import { useRef } from "react";
import { useQuestStore } from "../../store/questStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useUiStore } from "../../store/uiStore";
import { useTutorialStore } from "../../store/tutorialStore";
import { usePlayerStore } from "../../store/playerStore";
import { acceptQuest, boardOffers, canTakeBoard, completeQuest, declinedToday, isReady, objectiveText, openOffers, progressLabel, questDef, questText } from "../../game/quests";
import type { QuestDef, QuestReward } from "../../data/quests";
import { getNpc } from "../../data/npcs";
import { getItem } from "../../data/items";
import { audio } from "../../game/audio/AudioManager";
import { Panel } from "../components/Panel";
import { itemName, npcName } from "../../i18n/content";
import { t } from "../../i18n";
import { useAvoidPlayer } from "../hooks/useAvoidPlayer";

/** Keep the quest views live: they read the stores through helpers. */
function useQuestTick() {
  useQuestStore((s) => s.active);
  useQuestStore((s) => s.done);
  useQuestStore((s) => s.tracked);
  useInventoryStore((s) => s.stacks);
  usePlayerStore((s) => s.level);
}

function RewardLine({ r }: { r: QuestReward }) {
  const parts: string[] = [];
  if (r.gold) parts.push(t("quests.rewardGold", { n: r.gold }));
  if (r.xp) parts.push(t("quests.rewardXp", { n: r.xp }));
  if (r.talentPoints) parts.push(t("quests.rewardTalent", { n: r.talentPoints }).replace(" (K)", ""));
  for (const i of r.items ?? []) parts.push(`${i.count > 1 ? `${i.count}× ` : ""}${itemName(i.item)}`);
  if (!parts.length) return null;
  return (
    <div className="quest-rewards">
      <span>{t("quests.rewards")}:</span> {parts.join(" · ")}
    </div>
  );
}

function giverName(def: QuestDef): string {
  return def.giver === "board" ? t("quests.boardTarget") : npcName(getNpc(def.giver));
}

/** Journal tab: what you're doing, what you've done. */
export function QuestJournal() {
  useQuestTick();
  const active = useQuestStore((s) => s.active);
  const done = useQuestStore((s) => s.done);
  const tracked = useQuestStore((s) => s.tracked);
  const ids = Object.keys(active);
  const offers = openOffers();
  if (!ids.length && !done.length && !offers.length) return <div className="empty-hint">{t("quests.none")}</div>;
  return (
    <div className="quest-list">
      {offers.length > 0 && (
        <>
          <div className="section-title">{t("quests.onOffer")}</div>
          <p className="hint">{t("quests.onOfferHint")}</p>
          <div className="quest-offers">
            {offers.map((def) => (
              <div key={def.id} className={`quest-offer kind-${def.kind}`}>
                <span className={`quest-kind kind-${def.kind}`}>{t(`quests.kind.${def.kind}`)}</span>
                <b>{questText(def).title}</b>
                <span className="quest-giver">
                  {t("quests.askGiver", { name: giverName(def) })}
                  {declinedToday(def.id) && ` · ${t("quests.tomorrow")}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {ids.length > 0 && <div className="section-title">{t("quests.active")}</div>}
      {ids.map((id) => {
        const def = questDef(id);
        if (!def) return null;
        const text = questText(def);
        const prog = progressLabel(id);
        return (
          <div key={id} className={`quest-card kind-${def.kind}${isReady(id) ? " ready" : ""}`}>
            <div className="quest-card-head">
              <span className={`quest-kind kind-${def.kind}`}>{t(`quests.kind.${def.kind}`)}</span>
              <b>{text.title}</b>
              <span className="quest-giver">{giverName(def)}</span>
            </div>
            <small className="quest-summary">{text.summary}</small>
            <div className="quest-objective">
              ▸ {objectiveText(id)} {prog && <span className="quest-progress">{prog}</span>}
            </div>
            <RewardLine r={def.rewards} />
            <div className="quest-actions">
              <button type="button" className={`btn btn-small${tracked === id ? " active" : ""}`} onClick={() => useQuestStore.getState().track(tracked === id ? null : id)}>
                {tracked === id ? t("quests.tracked") : t("quests.track")}
              </button>
              {def.kind === "board" && (
                <button type="button" className="btn btn-small" onClick={() => useQuestStore.getState().abandon(id)}>
                  {t("quests.abandon")}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {done.filter((id) => !id.startsWith("board:")).length > 0 && <div className="section-title">{t("quests.done")}</div>}
      <div className="quest-done">
        {done
          .filter((id) => !id.startsWith("board:"))
          .map((id) => {
            const def = questDef(id);
            return def ? <span key={id}>✓ {questText(def).title}</span> : null;
          })}
      </div>
    </div>
  );
}

/** The notice board by the plaza: three contracts a day, two at a time. */
export function BoardPanel() {
  useQuestTick();
  const offers = boardOffers();
  const active = useQuestStore((s) => s.active);
  const done = useQuestStore((s) => s.done);
  return (
    <Panel title={t("quests.boardTitle")} subtitle={t("quests.boardSubtitle")} icon="journal" width={620}>
      <div className="quest-list">
        {offers.map((id) => {
          const def = questDef(id);
          if (!def) return null;
          const text = questText(def);
          const taken = !!active[id];
          const finished = done.includes(id);
          const ready = taken && isReady(id);
          const obj = def.stages[0];
          const icon = obj.kind === "gather" ? getItem(obj.items[0].item).icon : obj.kind === "hunt" ? "bow_wood" : "sword_iron";
          return (
            <div key={id} className={`quest-card board-card${finished ? " done" : ""}${ready ? " ready" : ""}`}>
              <div className="quest-card-head">
                <img src={`/icons/${icon}.png`} alt="" />
                <b>{text.title}</b>
              </div>
              <small className="quest-summary">{text.summary}</small>
              {taken && (
                <div className="quest-objective">
                  ▸ {objectiveText(id)} {progressLabel(id) && <span className="quest-progress">{progressLabel(id)}</span>}
                </div>
              )}
              <RewardLine r={def.rewards} />
              <div className="quest-actions">
                {finished ? (
                  <span className="quest-status">{t("quests.boardDone")}</span>
                ) : ready ? (
                  <button type="button" className="btn btn-small" onClick={() => completeQuest(id)}>
                    {t("quests.boardHandIn")}
                  </button>
                ) : taken ? (
                  <span className="quest-status">{t("quests.boardTaken")}</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      if (!canTakeBoard()) {
                        audio.sfx("deny");
                        useUiStore.getState().pushToast(t("quests.boardFull"), "warning");
                        return;
                      }
                      acceptQuest(id);
                    }}
                  >
                    {t("quests.boardTake")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** The tracked quest's current objective, under the clock area. Hidden
 * while the tutorial is still guiding you. */
export function QuestTracker() {
  useQuestTick();
  const tracked = useQuestStore((s) => s.tracked);
  const tutorialDone = useTutorialStore((s) => s.completed);
  const panel = useUiStore((s) => s.activePanel);
  const ref = useRef<HTMLDivElement>(null);
  const def = tracked ? questDef(tracked) : null;
  const visible = !!def && !!tracked && tutorialDone && panel !== "dialogue";
  const avoid = useAvoidPlayer(ref, visible);
  if (!visible || !def || !tracked) return null;
  const prog = progressLabel(tracked);
  return (
    <div ref={ref} className={`quest-tracker${avoid ? " avoid" : ""}${isReady(tracked) ? " ready" : ""}`}>
      <div className="quest-tracker-title">{questText(def).title}</div>
      <div className="quest-tracker-obj">
        {objectiveText(tracked)} {prog && <span className="quest-progress">{prog}</span>}
      </div>
    </div>
  );
}
