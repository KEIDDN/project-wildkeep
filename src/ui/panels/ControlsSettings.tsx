import { useEffect, useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import { ACTION_GROUPS, RESERVED, bindingFor, codeLabel, codeOf, rebind, resetBindings, unbind, type Action, type BindDevice } from "../../game/input/bindings";
import { setCapturingInput } from "../../game/input/capture";
import { capturePadButton, useInputDevice } from "../../game/input/gamepad";
import { audio } from "../../game/audio/AudioManager";
import { tDyn, t } from "../../i18n";
import { Glyph } from "../components/Glyph";

type Listening = { action: Action; dev: BindDevice; replace?: string };

/**
 * Settings → Controls: every action with its keyboard keys and its controller
 * buttons. Click (or ✕ on) an input to change it — the next key / button you
 * press — "+" adds an alternative, right-click (or □) removes one. Taking an
 * input another action used swaps them. Keyboard and controller are remapped
 * independently.
 */
export function ControlsSettings() {
  // Re-render when bindings change.
  useSettingsStore((s) => s.bindings);
  useSettingsStore((s) => s.padBindings);
  const vibration = useSettingsStore((s) => s.vibration);
  const pad = useInputDevice();
  const [listening, setListening] = useState<Listening | null>(null);

  /** What the next controller button does while `l` waits for one. */
  const padFinish = (l: Listening) => (code: string | null) => {
    if (code && !RESERVED.has(code)) {
      rebind(l.action, code, l.replace);
      audio.sfx("ui");
    }
    setListening(null);
  };
  const listen = (l: Listening) => {
    setListening(l);
    // Armed right away, not after the re-render: a quick second press must not slip past.
    if (l.dev === "gamepad") capturePadButton(padFinish(l));
  };

  useEffect(() => {
    if (!listening) return;
    setCapturingInput(true);
    const finish = (code: string | null) => {
      if (code && !RESERVED.has(code)) {
        rebind(listening.action, code, listening.replace);
        audio.sfx("ui");
      }
      setListening(null);
    };
    const release = () => setTimeout(() => setCapturingInput(false), 0);

    if (listening.dev === "gamepad") {
      // The next controller button (Options / Start, or Esc, cancels).
      capturePadButton(padFinish(listening));
      const onKey = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (codeOf(e) === "escape") finish(null);
      };
      window.addEventListener("keydown", onKey, true);
      return () => {
        capturePadButton(null);
        window.removeEventListener("keydown", onKey, true);
        release();
      };
    }

    let armed = false;
    // The click that started listening must not be taken as the new binding.
    const arm = setTimeout(() => (armed = true), 120);
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
      release();
    };
  }, [listening]);

  const inputs = (a: Action, dev: BindDevice) => {
    const codes = bindingFor(a, dev);
    const max = dev === "gamepad" ? 2 : 3;
    const waiting = (replace?: string) => listening?.action === a && listening.dev === dev && listening.replace === replace;
    return (
      <span className={`control-keys ${dev === "gamepad" ? "pad-keys" : ""}`}>
        {codes.map((code) => (
          <button
            type="button"
            key={code}
            className={`keycap${waiting(code) ? " listening" : ""}${dev === "gamepad" ? " padcap" : ""}`}
            onClick={() => listen({ action: a, dev, replace: code })}
            onContextMenu={(e) => {
              e.preventDefault();
              unbind(a, code);
              audio.sfx("ui", { pitch: 0.8 });
            }}
          >
            {waiting(code) ? t(dev === "gamepad" ? "pad.press" : "controls.press") : dev === "gamepad" ? <Glyph code={code} /> : codeLabel(code)}
          </button>
        ))}
        {codes.length < max &&
          (waiting(undefined) ? (
            <button type="button" className="keycap listening">
              {t(dev === "gamepad" ? "pad.press" : "controls.press")}
            </button>
          ) : (
            <button type="button" className="keycap keycap-add" title={t("controls.add")} onClick={() => listen({ action: a, dev })}>
              +
            </button>
          ))}
      </span>
    );
  };

  return (
    <div className="settings controls">
      <p className="hint">{pad.device === "gamepad" ? t("pad.hint") : t("controls.hint")}</p>
      <div className="pad-status">
        <span className={pad.connected ? "pad-on" : "pad-off"}>🎮 {pad.connected ? t("pad.found", { name: pad.name || t("pad.generic"), family: t(`pad.family.${pad.family}`) }) : t("pad.none")}</span>
        <label className="setting check">
          <input type="checkbox" checked={vibration} onChange={(e) => useSettingsStore.getState().update({ vibration: e.target.checked })} /> {t("pad.vibration")}
        </label>
      </div>
      <div className="control-row control-head">
        <span className="control-name" />
        <span className="control-keys">{t("pad.keyboard")}</span>
        <span className="control-keys pad-keys">{t("pad.controller")}</span>
      </div>
      {ACTION_GROUPS.map((g) => (
        <div key={g.id} className="controls-group">
          <div className="section-title">{tDyn(`controls.group.${g.id}`)}</div>
          {g.actions.map((a) => (
            <div className="control-row" key={a}>
              <span className="control-name">{tDyn(`controls.action.${a}`)}</span>
              {inputs(a, "keyboard")}
              {inputs(a, "gamepad")}
            </div>
          ))}
        </div>
      ))}
      <div className="control-row fixed">
        <span className="control-name">{t("pad.aim")}</span>
        <span className="control-keys">
          <span className="keycap static">{t("controls.mouseAim")}</span>
        </span>
        <span className="control-keys pad-keys">
          <span className="keycap static padcap"><Glyph code="pad:rstick" /></span>
        </span>
      </div>
      <div className="control-row fixed">
        <span className="control-name">{t("pad.fixed")}</span>
        <span className="control-keys">
          <span className="keycap static">Esc</span>
        </span>
        <span className="control-keys pad-keys">
          <span className="keycap static padcap"><Glyph code="pad:start" /></span>
        </span>
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            resetBindings("keyboard");
            audio.sfx("ui");
          }}
        >
          {t("pad.resetKeys")}
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            resetBindings("gamepad");
            audio.sfx("ui");
          }}
        >
          {t("pad.resetPad")}
        </button>
      </div>
    </div>
  );
}
