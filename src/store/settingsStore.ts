import { create } from "zustand";
import { SETTINGS_KEY } from "../game/core/constants";
import type { Action } from "../game/input/bindings";

export type Language = "en" | "es";

export interface Settings {
  language: Language;
  masterVolume: number; // 0..1
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  screenShake: boolean;
  showFps: boolean;
  /** Contextual tip cards and the first-day objectives. */
  tips: boolean;
  /** Remapped controls (only the actions the player changed). */
  bindings: Partial<Record<Action, string[]>>;
}

const DEFAULTS: Settings = {
  language: "en",
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  screenShake: true,
  showFps: false,
  tips: true,
  bindings: {},
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

/** Player preferences, persisted separately from the save so wiping a save
 * doesn't reset volume. */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadSettings(),
  update: (patch) => {
    set(patch);
    const { update: _update, ...settings } = { ...get() };
    void _update;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable: settings just won't persist */
    }
  },
}));
