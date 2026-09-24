import { ControlsSettings } from "./panels/ControlsSettings";
import { useEffect, useState } from "react";
import { SAVE_SLOTS, persistence, type SaveSlot, type SlotSummary } from "../game/save/saveManager";
import { deleteSlot, loadGame, newGame } from "../game/save/gameSave";
import { useSettingsStore } from "../store/settingsStore";
import { audio } from "../game/audio/AudioManager";
import { LANGUAGES, fmt, setLanguage, t, useLanguage } from "../i18n";

type View = "main" | "new" | "load" | "settings" | "credits";

/**
 * The first thing you see: title, New Game, Load Game, Settings, Credits.
 * Nothing in the world exists until a slot is chosen.
 */
export function TitleScreen({ onPlay }: { onPlay: () => void }) {
  useLanguage();
  const [view, setView] = useState<View>("main");
  const [slots, setSlots] = useState<(SlotSummary | null)[]>(() => SAVE_SLOTS.map((s) => persistence.summary(s)));
  const [confirm, setConfirm] = useState<SaveSlot | null>(null);
  const refresh = () => setSlots(SAVE_SLOTS.map((s) => persistence.summary(s)));
  const latest = slots.filter(Boolean).sort((a, b) => b!.savedAt - a!.savedAt)[0] ?? null;
  const anySave = slots.some(Boolean);

  useEffect(() => audio.playTheme("main_theme", 2), []);

  const click = () => audio.sfx("ui");
  const startNew = (slot: SaveSlot) => {
    newGame(slot);
    onPlay();
  };
  const load = (slot: SaveSlot) => {
    loadGame(slot);
    onPlay();
  };

  return (
    <div className="title-screen">
      <div className="title-sky">
        <div className="title-moon" />
        <div className="title-hills back" />
        <div className="title-hills front" />
        <div className="title-village">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="title-window" style={{ left: `${8 + i * 10.5}%`, animationDelay: `${i * 0.7}s` }} />
          ))}
        </div>
      </div>
      <div className="title-content">
        <h1 className="title-logo">Wildkeep</h1>
        <div className="title-tagline">{t("title.tagline")}</div>

        {view === "main" && (
          <div className="title-menu">
            {latest && (
              <button type="button" className="btn btn-big" onClick={() => (click(), load(latest.slot))}>
                {t("title.continue")} <span className="btn-note">{t("title.continueNote", { day: latest.day, level: latest.level })}</span>
              </button>
            )}
            <button type="button" className="btn btn-big" onClick={() => (click(), setView("new"))}>
              {t("title.newGame")}
            </button>
            <button type="button" className={`btn btn-big${anySave ? "" : " muted"}`} onClick={() => (click(), refresh(), setView("load"))}>
              {t("title.loadGame")} {!anySave && <span className="btn-note">{t("title.loadNone")}</span>}
            </button>
            <button type="button" className="btn btn-big" onClick={() => (click(), setView("settings"))}>
              {t("title.settings")}
            </button>
            <button type="button" className="btn btn-big" onClick={() => (click(), setView("credits"))}>
              {t("title.credits")}
            </button>
          </div>
        )}

        {(view === "new" || view === "load") && (
          <div className="title-slots">
            <div className="title-sub">{view === "new" ? t("title.chooseSlot") : t("title.loadSlot")}</div>
            {view === "load" && !anySave && <div className="title-empty">{t("title.noSavesYet")}</div>}
            {SAVE_SLOTS.map((slot, i) => {
              const s = slots[i];
              const disabled = view === "load" && !s;
              return (
                <div key={slot} className={`slot-card${disabled ? " empty" : ""}`}>
                  <button
                    type="button"
                    className="slot-main"
                    disabled={disabled}
                    onClick={() => {
                      click();
                      if (view === "load") load(slot);
                      else if (s) setConfirm(slot);
                      else startNew(slot);
                    }}
                  >
                    <b>{t("title.slot", { n: slot })}</b>
                    {s ? (
                      <span>
                        {t("title.slotSummary", { day: s.day, level: s.level, house: s.houseLevel, gold: fmt(s.gold) })}
                        {s.deepestFloor > 0 && t("title.slotDepth", { n: s.deepestFloor })}
                        <small>{new Date(s.savedAt).toLocaleString()}</small>
                      </span>
                    ) : (
                      <span className="muted">{view === "load" ? t("title.noSave") : t("title.emptySlot")}</span>
                    )}
                  </button>
                  {view === "load" && s && (
                    <button
                      type="button"
                      className="slot-delete"
                      title={t("title.deleteSlot")}
                      onClick={() => {
                        if (confirm === slot) {
                          deleteSlot(slot);
                          setConfirm(null);
                          refresh();
                        } else setConfirm(slot);
                      }}
                    >
                      {confirm === slot ? t("title.really") : "✕"}
                    </button>
                  )}
                </div>
              );
            })}
            {view === "new" && confirm !== null && (
              <div className="warn title-confirm">
                {t("title.overwrite", { n: confirm })}{" "}
                <button type="button" className="btn btn-small danger" onClick={() => startNew(confirm)}>
                  {t("title.overwriteBtn")}
                </button>{" "}
                <button type="button" className="btn btn-small" onClick={() => setConfirm(null)}>
                  {t("common.cancel")}
                </button>
              </div>
            )}
            <button type="button" className="btn" onClick={() => (click(), setConfirm(null), setView("main"))}>
              {t("common.back")}
            </button>
          </div>
        )}

        {view === "settings" && (
          <div className="title-panel">
            <LanguageSettings />
            <AudioSettings />
            <details className="title-controls">
              <summary>{t("menu.tabControls")}</summary>
              <ControlsSettings />
            </details>
            <button type="button" className="btn" onClick={() => (click(), setView("main"))}>
              {t("common.back")}
            </button>
          </div>
        )}

        {view === "credits" && (
          <div className="title-panel credits">
            <p>
              <b>{t("title.creditsLine1")}</b>
            </p>
            <p>{t("title.creditsArt")}</p>
            <p>{t("title.creditsMusic")}</p>
            <p>{t("title.creditsTech")}</p>
            <button type="button" className="btn" onClick={() => (click(), setView("main"))}>
              {t("common.back")}
            </button>
          </div>
        )}
      </div>
      <div className="title-footer">{t("title.footer")}</div>
    </div>
  );
}

/** English / Español. Saved in settings (localStorage), not in the save. */
export function LanguageSettings() {
  const lang = useLanguage();
  return (
    <div className="settings">
      <div className="section-title">{t("settings.language")}</div>
      <div className="lang-row">
        {LANGUAGES.map((l) => (
          <button
            type="button"
            key={l.id}
            className={`btn btn-small${lang === l.id ? " active" : ""}`}
            onClick={() => {
              audio.sfx("ui");
              setLanguage(l.id);
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Volume + screen shake, shared by the title screen and the in-game menu. */
export function AudioSettings() {
  const s = useSettingsStore();
  const slider = (label: string, key: "masterVolume" | "musicVolume" | "sfxVolume") => (
    <label className="setting">
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => s.update({ [key]: Number(e.target.value) })} />
      <b>{Math.round(s[key] * 100)}%</b>
    </label>
  );
  return (
    <div className="settings">
      <div className="section-title">{t("settings.audio")}</div>
      {slider(t("settings.master"), "masterVolume")}
      {slider(t("settings.music"), "musicVolume")}
      {slider(t("settings.effects"), "sfxVolume")}
      <label className="setting check">
        <input type="checkbox" checked={s.muted} onChange={(e) => s.update({ muted: e.target.checked })} /> {t("settings.mute")}
      </label>
      <div className="section-title">{t("settings.game")}</div>
      <label className="setting check">
        <input type="checkbox" checked={s.screenShake} onChange={(e) => s.update({ screenShake: e.target.checked })} /> {t("settings.shake")}
      </label>
      <label className="setting check">
        <input type="checkbox" checked={s.tips} onChange={(e) => s.update({ tips: e.target.checked })} /> {t("settings.tips")}
      </label>
    </div>
  );
}
