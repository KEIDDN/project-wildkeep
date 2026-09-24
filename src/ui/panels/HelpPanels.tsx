import { eventIs, keyLabel } from "../../game/input/bindings";
import { useEffect, useRef, useState } from "react";
import { useTutorialStore } from "../../store/tutorialStore";
import { useUiStore } from "../../store/uiStore";
import { HELP_TOPICS, HELP_TOPIC_ORDER, type HelpTopicId } from "../../data/tutorial";
import { audio } from "../../game/audio/AudioManager";
import { Panel } from "../components/Panel";
import { t, tl, type TListKey } from "../../i18n";
import { useAvoidPlayer } from "../hooks/useAvoidPlayer";

const topicTitle = (id: HelpTopicId) => t(`tutorial.topics.${id}.title`);
const topicLines = (id: HelpTopicId) => tl(`tutorial.topics.${id}.lines` as TListKey);

/** Help menu (H): every tutorial topic, readable any time. */
export function HelpPanel() {
  const seen = useTutorialStore((s) => s.seenTopics);
  const [topic, setTopic] = useState<HelpTopicId>((seen[seen.length - 1] as HelpTopicId) ?? "movement");
  const tp = HELP_TOPICS[topic] ? topic : "movement";
  return (
    <Panel title={t("help.title")} subtitle={t("help.subtitle")} icon="journal" width={720}>
      <div className="help-layout">
        <div className="help-list">
          {HELP_TOPIC_ORDER.map((id) => (
            <button type="button" key={id} className={`help-item${id === tp ? " active" : ""}${seen.includes(id) ? "" : " unseen"}`} onClick={() => setTopic(id)}>
              <img src={`/icons/${HELP_TOPICS[id].icon}.png`} alt="" />
              {topicTitle(id)}
            </button>
          ))}
        </div>
        <div className="help-body">
          <div className="help-title">
            <img src={`/icons/${HELP_TOPICS[tp].icon}.png`} alt="" /> {topicTitle(tp)}
          </div>
          {topicLines(tp).map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/**
 * Contextual tip card: shows the next queued help topic without pausing the
 * game. It closes itself once you've done what it teaches (see
 * game/tutorial.ts), after a while, or with the button — and hops to the
 * other side of the screen rather than cover your character.
 */
export function TipCard() {
  const topic = useTutorialStore((s) => s.queue[0]);
  const blocking = useUiStore((s) => s.activePanel === "intro" || s.activePanel === "dialogue");
  const ref = useRef<HTMLDivElement>(null);
  const avoid = useAvoidPlayer(ref, !!topic && !blocking);
  useEffect(() => {
    if (!topic) return;
    audio.sfx("ui");
    const tm = setTimeout(() => useTutorialStore.getState().dismissTip(), 20000);
    return () => clearTimeout(tm);
  }, [topic]);
  if (!topic || blocking) return null;
  return (
    <div ref={ref} className={`tip-card${avoid ? " avoid" : ""}`} key={topic}>
      <div className="tip-head">
        <img src={`/icons/${HELP_TOPICS[topic].icon}.png`} alt="" />
        <b>{topicTitle(topic)}</b>
      </div>
      {topicLines(topic).map((l) => (
        <p key={l}>{l}</p>
      ))}
      <button type="button" className="btn btn-small" onClick={() => useTutorialStore.getState().dismissTip()}>
        {t("tutorial.done")}
      </button>
    </div>
  );
}

/** A few lines of story when a new game begins. Opens itself on a fresh save. */
export function IntroOverlay() {
  const active = useUiStore((s) => s.activePanel === "intro");
  const introSeen = useTutorialStore((s) => s.introSeen);
  const [line, setLine] = useState(0);
  const lines = tl("intro.lines");

  useEffect(() => {
    if (!introSeen && !useUiStore.getState().activePanel) useUiStore.getState().openPanel("intro");
  }, [introSeen]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (eventIs(e, "interact") || [" ", "enter"].includes(e.key.toLowerCase())) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!active) return null;
  function finish() {
    useTutorialStore.getState().finishIntro();
    useUiStore.getState().closePanel();
  }
  function next() {
    audio.sfx("ui");
    if (line < lines.length - 1) setLine(line + 1);
    else finish();
  }
  const [before, after] = t("intro.continue").split("{key}");
  return (
    <div className="intro-overlay" onClick={next}>
      <div className="intro-text" key={line}>
        {lines[line]}
      </div>
      <div className="intro-hint">
        {before}
        <kbd>{keyLabel("interact")}</kbd>
        {after} ·{" "}
        <button
          type="button"
          className="link-btn"
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
        >
          {t("intro.skip")}
        </button>
      </div>
    </div>
  );
}
