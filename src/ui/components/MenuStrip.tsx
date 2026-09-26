import { useUiStore, type PanelId } from "../../store/uiStore";
import { MENU_PAGES } from "../nav/padNav";
import { audio } from "../../game/audio/AudioManager";
import { tDyn } from "../../i18n";
import { Glyph } from "./Glyph";
import { useInputDevice } from "../../game/input/gamepad";

const ICON: Partial<Record<PanelId, string>> = {
  inventory: "chest",
  character: "armor_leather",
  skills: "skill_strength",
  journal: "journal",
  map: "map_scroll",
  help: "scroll_return",
  settings: "lantern_item",
};

/**
 * The game menu's top strip: every main page in one row, so the player always
 * sees where they are and what's next door. Click a page, or L1 / R1 on a
 * controller (the glyphs sit at the ends). Not a focus stop: the shoulders
 * own it, so ✕ never lands here by accident.
 */
export function MenuStrip({ current }: { current: PanelId }) {
  const pad = useInputDevice();
  return (
    <div className="menu-strip" data-nav="off">
      {pad.device === "gamepad" && <Glyph code="pad:lb" className="menu-strip-shoulder" />}
      {MENU_PAGES.map((p) => (
        <button
          type="button"
          key={p}
          className={`menu-strip-tab${p === current ? " active" : ""}`}
          onClick={() => {
            if (p === current) return;
            audio.sfx("ui");
            useUiStore.getState().openPanel(p);
          }}
        >
          {ICON[p] && <img src={`/icons/${ICON[p]}.png`} alt="" />}
          <span>{tDyn(`hub.${p}`)}</span>
        </button>
      ))}
      {pad.device === "gamepad" && <Glyph code="pad:rb" className="menu-strip-shoulder" />}
    </div>
  );
}
