import { Graphics } from "pixi.js";
import type { Game } from "../../Game";
import type { Outdoor } from "./outdoor";
import type { ForestLayout } from "../../../game/procgen/forestGenerator";
import type { ForestBiomeId } from "../../../data/biomes";
import { TILE } from "../../../game/core/constants";
import { SeededRandom } from "../../../game/core/rng";
import { InteractSpot, Npc, Prop, npcVisual } from "../../entities/Props";
import { Enemy } from "../../entities/Enemy";
import { getNpc, type NpcDef } from "../../../data/npcs";
import { MERCHANTS } from "../../../data/merchants";
import { tex } from "../../textures";
import { icon16Path } from "../../../data/assets";
import { useSocialStore } from "../../../store/socialStore";
import { useTimeStore } from "../../../store/timeStore";
import { useInventoryStore } from "../../../store/inventoryStore";
import { usePlayerStore } from "../../../store/playerStore";
import { useUiStore } from "../../../store/uiStore";
import { grantItems, awardSkillXp } from "../../../game/actions";
import { adjustHonor } from "../../../game/social/honor";
import { dialogueFor } from "../../../game/npcs";
import { audio } from "../../../game/audio/AudioManager";
import { interpolate, t } from "../../../i18n";
import { npcLines, npcName } from "../../../i18n/content";
import { isNight } from "../../../game/time/clock";

/**
 * Forest life beyond the trees: who (and what) you might run into today.
 *
 *  - encounters: a lost woodsman, a herb-hungry granny, a knight following a
 *    squirrel, an orc on his day off, a prophet who listens to mushrooms, a
 *    sleepwalker at night — lightweight, one-off, remembered for the day
 *  - travelling merchants: a stall in a clearing, stock that changes daily
 *  - wild things: slimes and shroomlings by day, wolves after dark, goblins
 *    and bandits deeper in; anything you kill stays dead until tomorrow
 *
 * It's all seeded by forest + day, so leaving and coming back finds the same
 * people in the same places.
 */

type EncounterKind = "merchant" | "lost_axe" | "herb_buyer" | "lost_knight" | "off_duty_orc" | "prophet" | "sleepwalker";

interface Roll {
  kind: EncounterKind;
  weight: number;
  night?: "only" | "never";
}

const TABLE: Record<ForestBiomeId, { count: [number, number]; rolls: Roll[] }> = {
  forest: {
    count: [2, 3],
    rolls: [
      { kind: "merchant", weight: 3 },
      { kind: "lost_axe", weight: 2, night: "never" },
      { kind: "herb_buyer", weight: 2, night: "never" },
      { kind: "lost_knight", weight: 1.5 },
      { kind: "off_duty_orc", weight: 1.5, night: "never" },
      { kind: "prophet", weight: 1 },
      { kind: "sleepwalker", weight: 3, night: "only" },
    ],
  },
  deep_forest: {
    count: [1, 2],
    rolls: [
      { kind: "merchant", weight: 3 },
      { kind: "lost_knight", weight: 2 },
      { kind: "off_duty_orc", weight: 1, night: "never" },
      { kind: "prophet", weight: 2 },
    ],
  },
  ancient_grove: {
    count: [1, 1],
    rolls: [
      { kind: "prophet", weight: 3 },
      { kind: "merchant", weight: 1 },
    ],
  },
};

/** Which merchants turn up where. */
const MERCHANT_ODDS: Record<ForestBiomeId, { id: string; weight: number }[]> = {
  forest: [
    { id: "olwen", weight: 3 },
    { id: "rika", weight: 3 },
    { id: "grisby", weight: 2 },
    { id: "reginald", weight: 1 },
    { id: "lou", weight: 1 },
  ],
  deep_forest: [
    { id: "grisby", weight: 3 },
    { id: "reginald", weight: 2 },
    { id: "rika", weight: 2 },
    { id: "lou", weight: 1 },
  ],
  ancient_grove: [{ id: "olwen", weight: 1 }],
};

/** Wild enemies per forest: [kind, count] by day and by night, and how
 * tough they are in dungeon-floor terms. */
const WILD: Record<ForestBiomeId, { level: number; day: [string, number][]; night: [string, number][] }> = {
  forest: { level: 1, day: [["slime", 3], ["shroomling", 2]], night: [["slime", 2], ["wolf", 3]] },
  deep_forest: { level: 3, day: [["goblin", 3], ["poison_slime", 2], ["wolf", 1], ["bandit", 1]], night: [["wolf", 4], ["goblin", 1], ["wraith", 1]] },
  ancient_grove: { level: 6, day: [["shroomling", 3], ["treant", 1]], night: [["ghost", 3], ["treant", 1]] },
};

const today = () => useTimeStore.getState().day;
const used = (key: string) => useSocialStore.getState().usedToday(key, today());
const use = (key: string) => useSocialStore.getState().useToday(key, today());

function say(def: NpcDef, key: string, params: Record<string, string | number> = {}) {
  const lines = npcLines(def, key) ?? [];
  useUiStore.getState().showDialogue({ speaker: npcName(def), portrait: def.portrait, lines: lines.map((l) => interpolate(l, params)) });
}

/** An NPC whose conversation depends on quest state. */
function questNpc(o: Outdoor, id: string, x: number, y: number, talk: (game: Game, def: NpcDef) => void, face: "down" | "side" = "down"): Npc {
  const def = getNpc(id);
  const n = new Npc(x, y, npcVisual(def), def.name, (g) => talk(g, def), { def, face, facingLeft: face === "side" ? true : undefined });
  o.area.add(n);
  return n;
}

export function placeForestLife(game: Game, o: Outdoor, layout: ForestLayout, biome: ForestBiomeId, seed: string): void {
  const night = isNight(useTimeStore.getState().minute);
  const rng = SeededRandom.fromString(`${seed}:encounters:${night ? "n" : "d"}`);
  const T = TILE;

  // Free clearings: not an entrance, not a POI, not a glade.
  const specials = new Set([...layout.entrances.map((e) => `${e.inside.x},${e.inside.y}`), ...layout.pois.map((p) => `${p.x},${p.y}`)]);
  const glades = new Set(layout.glades.map((g) => g.clearing));
  const spots = rng.shuffle(layout.clearings.filter((c) => !glades.has(c) && !specials.has(`${c.x},${c.y}`) && c.rx >= 3));
  const takeSpot = () => spots.shift();

  const cfg = TABLE[biome];
  const pool = cfg.rolls.filter((r) => (night ? r.night !== "never" : r.night !== "only"));
  const n = rng.int(cfg.count[0], cfg.count[1]);
  const chosen = new Set<EncounterKind>();
  for (let i = 0; i < n * 4 && chosen.size < n && pool.length; i++) chosen.add(rng.weighted(pool.map((r) => ({ item: r.kind, weight: r.weight }))));

  for (const kind of chosen) {
    const c = takeSpot();
    if (!c) break;
    const x = c.x * T + 8;
    const y = c.y * T + 8;
    const key = `enc:${seed}:${kind}`;
    o.reserve(c.x - 2, c.y - 1, 5, 3);
    switch (kind) {
      case "merchant": {
        const mid = rng.weighted(MERCHANT_ODDS[biome].map((m) => ({ item: m.id, weight: m.weight })));
        const m = MERCHANTS[mid];
        const def = getNpc(m.npc);
        o.area.add(new Npc(x, y - 4, npcVisual(def), def.name, (g) => g.ui.showDialogue(dialogueFor(def)), { def, face: "down" }));
        // A stall: crates, a banner, a lantern for after dark.
        o.area.prop("crates", x + 26, y + 2, { collider: { w: 40, h: 6 } });
        o.area.prop(rng.pick(["banner_red", "banner_blue", "banner_green"]), x - 18, y - 2);
        o.area.prop("lantern", x + 12, y - 16).withLight({ radius: 60, color: 0xffc070, intensity: 0.9, flicker: 0.6 });
        break;
      }
      case "lost_axe": {
        // Bertha lies somewhere far from Ottis.
        const far = [...layout.clearings].filter((k) => !glades.has(k)).sort((a, b) => Math.hypot(b.x - c.x, b.y - c.y) - Math.hypot(a.x - c.x, a.y - c.y))[0];
        const found = () => used(`${key}:found`);
        const done = () => used(`${key}:done`);
        questNpc(o, "ottis", x, y, (g, def) => {
          if (done()) say(def, "quest:done");
          else if (found()) {
            use(`${key}:done`);
            say(def, "quest:found");
            usePlayerStore.getState().earnGold(35);
            grantItems([{ itemId: "wood", quantity: 5 }]);
            adjustHonor(4);
            useSocialStore.getState().addDeed("helped");
            awardSkillXp("woodcutting", 15);
            audio.sfx("rare");
            g.ui.pushToast(t("encounter.axeReward"), "gold", { icon: "axe_rusty" });
          } else if (used(`${key}:asked`)) say(def, "quest:waiting");
          else {
            use(`${key}:asked`);
            say(def, "quest:start");
          }
        });
        if (far && !found() && !done()) {
          const ax = far.x * T + 8 + rng.int(-24, 24);
          const ay = far.y * T + 8 + rng.int(-10, 10);
          const icon = new Prop(ax, ay, tex(icon16Path("axe_rusty")));
          icon.sprite.rotation = 0.6;
          o.area.add(icon);
          o.area.add(
            new InteractSpot(
              ax,
              ay + 4,
              () => (found() ? null : { verb: t("prompt.pickUp"), target: t("encounter.bertha") }),
              (g) => {
                if (found()) return;
                use(`${key}:found`);
                icon.view.visible = false;
                audio.sfx("pickup");
                g.ui.pushToast(used(`${key}:asked`) ? t("encounter.berthaFound") : t("encounter.berthaFoundEarly"), "info", { icon: "axe_rusty" });
              },
              { radius: 16 },
            ),
          );
        }
        break;
      }
      case "herb_buyer": {
        questNpc(o, "petunia", x, y, (g, def) => {
          if (used(`${key}:done`)) return say(def, "quest:done");
          const have = useInventoryStore.getState().quantityOf("herb", "clean");
          if (have >= 5) {
            useInventoryStore.getState().removeItem("herb", 5, "clean");
            use(`${key}:done`);
            say(def, "quest:ready");
            usePlayerStore.getState().earnGold(45);
            adjustHonor(3);
            useSocialStore.getState().addDeed("helped");
            audio.sfx("coin");
            g.ui.pushToast(t("encounter.herbReward"), "gold", { icon: "herb" });
          } else if (used(`${key}:asked`)) say(def, "quest:waiting", { have });
          else {
            use(`${key}:asked`);
            say(def, "quest:start");
          }
        });
        break;
      }
      case "lost_knight": {
        questNpc(o, "sir_loin", x, y, (g, def) => {
          if (used(`${key}:done`)) return say(def, "quest:done");
          use(`${key}:done`);
          say(def, "quest:start");
          grantItems([{ itemId: rng.pick(["return_scroll", "greater_potion", "arrow"]), quantity: 1 }]);
          usePlayerStore.getState().earnGold(20);
          g.ui.pushToast(t("encounter.knightReward"), "gold", { icon: "sword_iron" });
        });
        break;
      }
      case "off_duty_orc": {
        // A checked cloth, a sandwich, and an orc who really doesn't want trouble.
        const cloth = new Graphics();
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) cloth.rect(x - 8 + i * 8, y + 2 + j * 6, 8, 6).fill((i + j) % 2 ? 0x3a6ab8 : 0xf2e6d0);
        o.area.ground.addChild(cloth);
        const def = getNpc("grubnak");
        const orc = new Npc(x - 14, y + 4, npcVisual(def), def.name, (g) => {
          g.ui.showDialogue(dialogueFor(def));
          if (!used(`${key}:snack`)) {
            use(`${key}:snack`);
            setTimeout(() => {
              grantItems([{ itemId: "roast_meat", quantity: 1 }]);
              useUiStore.getState().pushToast(t("encounter.orcSnack"), "info", { icon: "meat_roast" });
            }, 600);
          }
        }, { def, facingLeft: false });
        o.area.add(orc);
        o.area.prop("pot_b", x + 20, y + 6);
        break;
      }
      case "prophet": {
        questNpc(o, "prophet", x, y, (g, def) => {
          const lines = npcLines(def, "prophecy") ?? [];
          const pick = SeededRandom.fromString(`${key}:${today()}`).int(0, Math.max(0, lines.length - 1));
          useUiStore.getState().showDialogue({ speaker: npcName(def), portrait: def.portrait, lines: [...(npcLines(def, "intro") ?? []), lines[pick] ?? ""] });
          if (!used(`${key}:heard`)) {
            use(`${key}:heard`);
            awardSkillXp("luck", 10);
          }
          void g;
        });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          o.area.prop("mushroom_a", x + Math.cos(a) * 22, y + 6 + Math.sin(a) * 12, { flat: true });
        }
        o.area.light({ x, y: y - 6, radius: 44, color: 0xd08aff, intensity: 0.6, flicker: 0.4 });
        break;
      }
      case "sleepwalker": {
        if (used(`${key}:home`)) break;
        const def = getNpc("sleepwalker");
        const walker = new Npc(x, y, npcVisual(def), def.name, (g) => {
          g.ui.showDialogue(dialogueFor(def));
          if (used(`${key}:home`)) return;
          use(`${key}:home`);
          adjustHonor(3);
          useSocialStore.getState().addDeed("helped");
          setTimeout(() => useUiStore.getState().pushToast(t("encounter.sleepwalkerHome"), "info", { icon: "sleep" }), 800);
          walker.walkTo(walker.x + 200, walker.y + 40, () => g.removeEntity(walker));
        }, { def, route: [{ x, y }, { x: x + 40, y: y + 10 }, { x: x + 10, y: y + 30 }, { x: x - 30, y: y + 8 }] });
        o.area.add(walker);
        break;
      }
    }
  }

  placeWild(game, o, layout, biome, seed, night, spots);
}

function placeWild(_game: Game, o: Outdoor, layout: ForestLayout, biome: ForestBiomeId, seed: string, night: boolean, freeClearings: { x: number; y: number; rx: number; ry: number }[]) {
  const wild = WILD[biome];
  const rng = SeededRandom.fromString(`${seed}:wild:${night ? "n" : "d"}`);
  const cols = layout.cols;
  const safe = (x: number, y: number) =>
    layout.walk[y * cols + x] === 1 &&
    !layout.trail[y * cols + x] &&
    layout.entrances.every((e) => Math.hypot(e.inside.x - x, e.inside.y - y) > 16) &&
    layout.pois.every((p) => Math.hypot(p.x - x, p.y - y) > 6);
  let i = 0;
  for (const [kind, count] of night ? wild.night : wild.day) {
    for (let k = 0; k < count; k++, i++) {
      const id = `wild:${seed}:${night ? "n" : "d"}:${i}`;
      if (used(id)) continue;
      // Out in the open (clearings, trail verges) where you can see them
      // coming — never lurking invisible under a canopy.
      let tx = -1;
      let ty = -1;
      for (let tries = 0; tries < 80; tries++) {
        const x = rng.int(4, cols - 5);
        const y = rng.int(4, layout.rows - 5);
        if (safe(x, y) && (!layout.open[y * cols + x] || tries > 60)) {
          tx = x;
          ty = y;
          break;
        }
      }
      if (tx < 0 && freeClearings.length) {
        const c = rng.pick(freeClearings);
        tx = c.x;
        ty = c.y;
      }
      if (tx < 0) continue;
      const elite = kind === "treant" || rng.bool(0.06);
      o.area.add(new Enemy(tx * TILE + 8, ty * TILE + 13, kind, id, wild.level, elite ? "elite" : "normal"));
    }
  }
}

/** Remember kills in the wild for the rest of the day (see Game.onEnemyKilled). */
export function rememberWildKill(spawnId: string): void {
  if (spawnId.startsWith("wild:")) use(spawnId);
}
