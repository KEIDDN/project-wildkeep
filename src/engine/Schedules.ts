import type { Area } from "./world/Area";
import type { Game } from "./Game";
import { Npc, npc } from "./entities/Props";
import { NPCS, type NpcDef } from "../data/npcs";
import { timeOfDay, type TimeOfDay } from "../game/time/clock";
import { useTimeStore } from "../store/timeStore";
import { SeededRandom } from "../game/core/rng";

/**
 * NPC routines. Townsfolk with a `schedule` (data/npcs.ts) are somewhere
 * different in the morning, the day, the evening and at night: a town spot
 * ("plaza", "market", "garden"…), the tavern, or home (off stage).
 *
 *  - When an area is built, everyone who should be there *now* is placed
 *    (town spots are `spot_<name>` spawns; the tavern passes its seats).
 *  - While you're in town, the director notices the time of day changing
 *    and sends people off: across town to their next spot, or to a door
 *    (home / the tavern), where they go inside.
 *
 * Kept deliberately light: no pathfinding, no simulation off-screen.
 */

export const HOME = "home";
export const TAVERN = "tavern";

/** Where a scheduled NPC is at this time of day (null = no schedule). */
export function scheduleSpot(def: NpcDef, period: TimeOfDay): string | null {
  if (!def.schedule) return null;
  return def.schedule[period] ?? HOME;
}

const scheduled = () => Object.values(NPCS).filter((d) => d.schedule);

/** How far people wander around a spot. Spots on a narrow walk (the
 * garden's cross-path) keep them on it instead of trampling the beds. */
const MILL: Record<string, { x: number; y: number }> = { garden: { x: 56, y: 0 } };
const millRange = (spot: string) => MILL[spot] ?? { x: 28, y: 11 };

/** A little loop around a spot so people mill about instead of standing. */
function milling(x: number, y: number, seed: string, spot = ""): { x: number; y: number }[] {
  const r = SeededRandom.fromString(seed);
  const m = millRange(spot);
  return [
    { x, y },
    { x: x + r.int(-m.x, m.x), y: y + r.int(-m.y, m.y) },
    { x: x + r.int(-m.x, m.x), y: y + r.int(-m.y, m.y) },
  ];
}

/** Town: place everyone whose schedule has them at one of its spots. */
export function placeTownsfolk(area: Area): void {
  const period = timeOfDay(useTimeStore.getState().minute);
  let i = 0;
  for (const def of scheduled()) {
    const spot = scheduleSpot(def, period);
    const p = spot ? area.spawns[`spot_${spot}`] : undefined;
    if (!p || !spot) continue;
    const r = SeededRandom.fromString(`${def.id}:${spot}`);
    // Vendors and the healer stand exactly on their mark.
    const exact = !!def.next || !!def.service;
    const m = millRange(spot);
    const x = exact ? p.x : p.x + r.int(-m.x, m.x);
    const y = exact ? p.y : p.y + r.int(-m.y, m.y);
    const n = npc(def.id, x, y);
    if (!n) continue;
    n.spot = spot;
    // Vendors and the healer stand their ground; everyone else mills about.
    if (!def.next && !def.service) n.setRoute(milling(p.x, p.y, `${def.id}:${i++}`, spot));
    area.add(n);
  }
}

/** Tavern: whoever's out for a drink right now takes a free seat. */
export function placeTavernGoers(area: Area, seats: { x: number; y: number; left?: boolean }[]): void {
  const period = timeOfDay(useTimeStore.getState().minute);
  const goers = scheduled().filter((d) => scheduleSpot(d, period) === TAVERN);
  goers.forEach((def, i) => {
    const s = seats[i % seats.length];
    if (!s) return;
    const n = npc(def.id, s.x, s.y, { facingLeft: !!s.left });
    if (n) {
      n.spot = TAVERN;
      area.add(n);
    }
  });
}

/** Watches the clock while you're in town and moves people along. */
export class ScheduleDirector {
  private period: TimeOfDay | null = null;
  private areaRef: Area | null = null;
  private timer = 0;

  update(dt: number, game: Game): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1;
    const period = timeOfDay(useTimeStore.getState().minute);
    if (game.area !== this.areaRef) {
      // New area: just remember where the day is.
      this.areaRef = game.area;
      this.period = period;
      return;
    }
    if (period === this.period || game.area.id !== "town") {
      this.period = period;
      return;
    }
    this.period = period;
    const area = game.area;
    for (const e of area.entities.slice()) {
      if (!(e instanceof Npc) || !e.def?.schedule || e.removed) continue;
      const target = scheduleSpot(e.def, period);
      if (!target || target === e.spot) continue;
      e.spot = target;
      const spot = area.spawns[`spot_${target}`];
      if (spot) {
        e.setRoute(null);
        e.walkTo(spot.x, spot.y, () => {
          if (!e.def?.next && !e.def?.service) e.setRoute(milling(spot.x, spot.y, `${e.def!.id}:${target}`, target));
        });
        continue;
      }
      // Off to a door, then inside.
      const door = target === TAVERN ? area.spawns.tavern_door : area.spawns.spot_home_door;
      e.setRoute(null);
      if (!door) {
        game.removeEntity(e);
        continue;
      }
      e.walkTo(door.x, door.y - 4, () => game.removeEntity(e));
    }
  }
}
