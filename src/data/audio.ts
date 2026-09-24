import type { MusicZone } from "./areas";

/**
 * Music comes from the `MUSIC/` folder in the project root. Files are
 * matched to themes by keyword in their filename (case-insensitive), so
 * "MAIN THEME.mp3", "main-theme.ogg" or "01 Tavern Theme.wav" all work.
 * Vite bundles whatever it finds; a missing theme just stays silent.
 */
const MUSIC_FILES = import.meta.glob("/MUSIC/*.{mp3,ogg,wav,m4a}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export type MusicTrackId = "main_theme" | "tavern_theme" | "dungeon_theme" | "night_theme";

const KEYWORDS: Record<MusicTrackId, RegExp> = {
  main_theme: /main|world|town|village/i,
  tavern_theme: /tavern|inn|casino/i,
  dungeon_theme: /dungeon|cave|mine/i,
  night_theme: /night/i,
};

function findTrack(id: MusicTrackId): string | null {
  for (const [path, url] of Object.entries(MUSIC_FILES)) {
    const name = path.split("/").pop() ?? "";
    if (KEYWORDS[id].test(name)) return url;
  }
  return null;
}

export const MUSIC_TRACKS: Record<MusicTrackId, { url: string | null; volume: number }> = {
  main_theme: { url: findTrack("main_theme"), volume: 0.7 },
  // Medieval bard + gambling energy.
  tavern_theme: { url: findTrack("tavern_theme"), volume: 0.65 },
  dungeon_theme: { url: findTrack("dungeon_theme"), volume: 0.7 },
  night_theme: { url: findTrack("night_theme"), volume: 0.6 },
};

/**
 * Which theme plays: area-specific music overrides the general day/night
 * choice (the tavern and anything underground ignore the clock).
 */
export function themeFor(zone: MusicZone, night: boolean): MusicTrackId {
  if (zone === "tavern") return "tavern_theme";
  if (zone === "underground") return "dungeon_theme";
  return night ? "night_theme" : "main_theme";
}

/** Sound effects are synthesized (see `game/audio/sfx.ts`) until real files
 * exist; any id listed here with a file overrides the synth version. */
export type SfxId =
  | "swing"
  | "chop"
  | "mine"
  | "collect"
  | "hit"
  | "enemy_hit"
  | "player_hurt"
  | "enemy_die"
  | "pickup"
  | "coin"
  | "chest"
  | "rare"
  | "door"
  | "ui"
  | "deny"
  | "levelup"
  | "potion"
  | "dice"
  | "card";

export const SFX_FILES: Partial<Record<SfxId, string>> = {};
