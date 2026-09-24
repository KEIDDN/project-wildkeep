import { AREAS } from "../../data/areas";
import { themeFor } from "../../data/audio";
import { isNight } from "../time/clock";
import { useWorldStore } from "../../store/worldStore";
import { useTimeStore } from "../../store/timeStore";
import { audio } from "./AudioManager";

/**
 * The one place that decides what music plays. It watches where the player
 * is and what time it is; scenes never pick music themselves.
 *
 *   tavern                 -> tavern theme (any time)
 *   mine / dungeon         -> dungeon theme (any time)
 *   everywhere else        -> main theme by day, night theme at night
 */
export function startMusicDirector(): () => void {
  let lastArea = "";
  const update = () => {
    const area = useWorldStore.getState().area;
    const night = isNight(useTimeStore.getState().minute);
    // Stepping through a door gets a snappy crossfade; dusk falling over
    // the village gets a slow one.
    const fade = area !== lastArea ? 1.6 : 5;
    lastArea = area;
    audio.playTheme(themeFor(AREAS[area].music, night), fade);
  };
  update();
  const unsubWorld = useWorldStore.subscribe((s, prev) => {
    if (s.area !== prev.area) update();
  });
  const unsubTime = useTimeStore.subscribe((s, prev) => {
    if (isNight(s.minute) !== isNight(prev.minute)) update();
  });
  return () => {
    unsubWorld();
    unsubTime();
  };
}
