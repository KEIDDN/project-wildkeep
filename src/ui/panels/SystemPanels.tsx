import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../../store/uiStore";
import { currentSlot, lastSavedAt, saveGame } from "../../game/save/gameSave";
import { AudioSettings, LanguageSettings } from "../TitleScreen";
import { t } from "../../i18n";
import { useTutorialStore } from "../../store/tutorialStore";
import { skipTutorial } from "../../game/tutorial";
import { audio } from "../../game/audio/AudioManager";
import { Panel } from "../components/Panel";
import { ControlsSettings } from "./ControlsSettings";
import { eventIs } from "../../game/input/bindings";
import { Glyph } from "../components/Glyph";
import { useNavLayer } from "../nav/padNav";

/** NPC dialogue box: click / E / Space advances, last line may open a panel. */
export function DialoguePanel() {
  const dialogue = useUiStore((s) => s.dialogue);
  const [line, setLine] = useState(0);

  useEffect(() => setLine(0), [dialogue]);

  const last = !!dialogue && line >= dialogue.lines.length - 1;
  const choices = last ? (dialogue?.choices ?? []) : [];
  const ref = useRef<HTMLDivElement>(null);
  // Controller: ✕ advances; on the last line it picks the focused choice. ○ closes, like Esc.
  useNavLayer(ref, {
    autoFocus: choices.length > 0,
    onConfirm: () => {
      if (choices.length) return false;
      advance();
      return true;
    },
    onCancel: () => useUiStore.getState().closePanel(),
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Number keys pick a choice; E/Space only advance when there's nothing to pick.
      const n = Number(e.key);
      if (choices.length && n >= 1 && n <= choices.length) {
        e.preventDefault();
        pick(n - 1);
        return;
      }
      if (eventIs(e, "interact") || [" ", "enter"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (!choices.length) advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!dialogue) return null;
  function advance() {
    if (!dialogue) return;
    audio.sfx("ui");
    if (line < dialogue.lines.length - 1) return setLine(line + 1);
    if (dialogue.choices?.length) return;
    dialogue.onEnd?.();
    // onEnd may have opened something else (another dialogue): leave it be.
    if (useUiStore.getState().dialogue !== dialogue) return;
    if (dialogue.next) useUiStore.getState().openPanel(dialogue.next, dialogue.nextData);
    else useUiStore.getState().closePanel();
  }
  function pick(i: number) {
    const c = choices[i];
    if (!c || c.disabled) return audio.sfx("deny");
    audio.sfx("ui");
    c.onChoose();
    if (useUiStore.getState().dialogue === dialogue && useUiStore.getState().activePanel === "dialogue") useUiStore.getState().closePanel();
  }

  return (
    <div className="dialogue" ref={ref} onClick={() => !choices.length && advance()}>
      <div className="dialogue-box">
        {dialogue.portrait && <img className="dialogue-portrait" src={`/icons/${dialogue.portrait}.png`} alt="" />}
        <div className="dialogue-content">
          <div className="dialogue-speaker">{dialogue.speaker}</div>
          <div className="dialogue-text" key={line}>
            {dialogue.lines[line]}
          </div>
          {choices.length > 0 ? (
            <div className="dialogue-choices">
              {choices.map((c, i) => (
                <button
                  type="button"
                  key={c.label}
                  className={`dialogue-choice tone-${c.tone ?? "neutral"}`}
                  disabled={c.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(i);
                  }}
                >
                  <kbd>{i + 1}</kbd> {c.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="dialogue-next">
              {line < dialogue.lines.length - 1 ? t("dialogue.next") : dialogue.next ? t("dialogue.continue") : t("dialogue.close")} <Glyph action="interact" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel({ onQuit }: { onQuit: () => void }) {
  const [savedAt, setSavedAt] = useState(() => lastSavedAt());
  const [tab, setTab] = useState<"game" | "controls">("game");
  const tutorialDone = useTutorialStore((s) => s.completed);
  const slot = currentSlot();
  const open = (panel: "help" | "journal" | "debug") => useUiStore.getState().openPanel(panel);
  return (
    <Panel title={t("menu.title")} subtitle={t("menu.paused", { slot: slot ?? "-" })} width={tab === "controls" ? 720 : 500}>
      <div className="tabs">
        <button type="button" className={`tab${tab === "game" ? " active" : ""}`} onClick={() => setTab("game")}>
          {t("menu.tabGame")}
        </button>
        <button type="button" className={`tab${tab === "controls" ? " active" : ""}`} onClick={() => setTab("controls")}>
          {t("menu.tabControls")}
        </button>
      </div>
      {tab === "controls" ? (
        <ControlsSettings />
      ) : (
        <div className="settings">
          <div className="settings-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                saveGame();
                setSavedAt(lastSavedAt());
                useUiStore.getState().pushToast(t("toast.saved"), "info");
              }}
            >
              {t("menu.save")}
            </button>
            <button type="button" className="btn" onClick={() => open("help")}>
              {t("menu.help")}
            </button>
            <button type="button" className="btn" onClick={() => open("journal")}>
              {t("menu.journal")}
            </button>
            {import.meta.env.DEV && (
              <button type="button" className="btn" onClick={() => open("debug")}>
                {t("menu.debug")}
              </button>
            )}
          </div>
          <p className="hint">
            {savedAt ? t("menu.lastSaved", { time: new Date(savedAt).toLocaleTimeString() }) : ""}
            {t("menu.autosave")}
          </p>
          <LanguageSettings />
          <AudioSettings />
          <div className="settings-actions">
            <button type="button" className="btn btn-small" onClick={() => useTutorialStore.getState().restart()}>
              {t("menu.restartTutorial")}
            </button>
            {!tutorialDone && (
              <button type="button" className="btn btn-small" onClick={() => (skipTutorial(), useUiStore.getState().closePanel())}>
                {t("menu.skipTutorial")}
              </button>
            )}
          </div>
          <div className="settings-actions">
            <button type="button" className="btn btn-big" onClick={() => useUiStore.getState().closePanel()}>
              {t("menu.resume")}
            </button>
            <button type="button" className="btn btn-big" onClick={onQuit}>
              {t("menu.quit")}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
