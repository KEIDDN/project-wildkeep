import { useEffect, useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import { ACTION_GROUPS, RESERVED, allBindings, codeLabel, codeOf, rebind, resetBindings, unbind, type Action } from "../../game/input/bindings";
import { setCapturingInput } from "../../game/input/capture";
import { audio } from "../../game/audio/AudioManager";
import { tDyn, t } from "../../i18n";

/**
 * Settings → Controls: every action with its keys. Click a key to change
 * it (the next key or mouse button you press), "+" adds an alternative,
 * right-click removes one. Taking a key another action used swaps them.
 */
export function ControlsSettings() {
  // Re-render when bindings change.
  useSettingsStore((s) => s.bindings);
  const bindings = allBindings();
  const [listening, setListening] = useState<{ action: Action; slot: number } | null>(null);

  useEffect(() => {
    if (!listening) return;
    setCapturingInput(true);
    let armed = false;
    // The click that started listening must not be taken as the new binding.
    const arm = setTimeout(() => (armed = true), 120);
    const finish = (code: string | null) => {
      if (code) {
        rebind(listening.action, code, listening.slot);
        audio.sfx("ui");
      }
      setListening(null);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = codeOf(e);
      if (code === "escape") return finish(null);
      if (RESERVED.has(code)) return audio.sfx("deny");
      finish(code);
    };
    const onMouse = (e: MouseEvent) => {
      if (!armed) return;
      e.preventDefault();
      e.stopPropagation();
      finish(`mouse${e.button}`);
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("contextmenu", noMenu, true);
    return () => {
      clearTimeout(arm);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("contextmenu", noMenu, true);
      // Let the game see keys again on the next frame (not this keypress).
      setTimeout(() => setCapturingInput(false), 0);
    };
  }, [listening]);

  return (
    <div className="settings controls">
      <p className="hint">{t("controls.hint")}</p>
      {ACTION_GROUPS.map((g) => (
        <div key={g.id} className="controls-group">
          <div className="section-title">{tDyn(`controls.group.${g.id}`)}</div>
          {g.actions.map((a) => (
            <div className="control-row" key={a}>
              <span className="control-name">{tDyn(`controls.action.${a}`)}</span>
              <span className="control-keys">
                {bindings[a].map((code, i) => {
                  const on = listening?.action === a && listening.slot === i;
                  return (
                    <button
                      type="button"
                      key={`${code}-${i}`}
                      className={`keycap${on ? " listening" : ""}`}
                      onClick={() => setListening({ action: a, slot: i })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        unbind(a, i);
                      }}
                    >
                      {on ? t("controls.press") : codeLabel(code)}
                    </button>
                  );
                })}
                {bindings[a].length < 3 &&
                  (listening?.action === a && listening.slot === bindings[a].length ? (
                    <button type="button" className="keycap listening">
                      {t("controls.press")}
                    </button>
                  ) : (
                    <button type="button" className="keycap keycap-add" title={t("controls.add")} onClick={() => setListening({ action: a, slot: bindings[a].length })}>
                      +
                    </button>
                  ))}
              </span>
            </div>
          ))}
        </div>
      ))}
      <div className="control-row fixed">
        <span className="control-name">{t("controls.fixedMenu")}</span>
        <span className="control-keys">
          <span className="keycap static">Esc</span>
        </span>
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            resetBindings();
            audio.sfx("ui");
          }}
        >
          {t("controls.reset")}
        </button>
      </div>
    </div>
  );
}
