import { REGIONS, regionStatus, type RegionId, type RegionStatus, type WorldFacts } from "../data/world";
import { useWorldStore } from "../store/worldStore";
import { usePlayerStore } from "../store/playerStore";
import { useQuestStore } from "../store/questStore";

/** Everything the world map / region gates need to know, from the stores. */
export function worldFacts(): WorldFacts {
  const p = useWorldStore.getState().progress;
  return {
    discoveries: p.discoveries,
    flags: p.flags,
    level: usePlayerStore.getState().level,
    dungeonDeepest: p.dungeonDeepest,
    mineDeepest: p.mineDeepest,
    questsDone: useQuestStore.getState().done,
  };
}

export function allRegionStatus(): Record<RegionId, RegionStatus> {
  const f = worldFacts();
  return Object.fromEntries(REGIONS.map((r) => [r.id, regionStatus(r, f)])) as Record<RegionId, RegionStatus>;
}
