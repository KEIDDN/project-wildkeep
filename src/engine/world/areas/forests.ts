import { ANIMALS } from "../../../data/animals";
import { animalName } from "../../../i18n/content";
import type { Game } from "../../Game";
import { t } from "../../../i18n";
import { areaName, thicketLabel } from "../../../i18n/content";
import type { Area } from "../Area";
import { buildWoods, type WoodsConfig } from "./woods";
import type { Outdoor } from "./outdoor";
import { TILE } from "../../../game/core/constants";
import { BIOMES, type BiomeEntrance, type ForestBiomeId } from "../../../data/biomes";
import { ASSETS, buildingPath } from "../../../data/assets";
import { generateForest, type ForestLayout } from "../../../game/procgen/forestGenerator";
import { InteractSpot, Prop, npc } from "../../entities/Props";
import { Chest } from "../../entities/Chest";
import { Thicket } from "../../entities/Thicket";
import { animFrames, tex } from "../../textures";
import { useUiStore } from "../../../store/uiStore";
import { useWorldStore } from "../../../store/worldStore";
import { useTimeStore } from "../../../store/timeStore";
import { usePlayerStore } from "../../../store/playerStore";
import { awardSkillXp, grantXp } from "../../../game/actions";
import { audio } from "../../../game/audio/AudioManager";
import { Graphics } from "pixi.js";
import { Animal } from "../../entities/Animal";
import { StealSpot } from "../../entities/Props";
import { FOREST_FAUNA } from "../../../data/animals";
import { SeededRandom } from "../../../game/core/rng";
import { useSocialStore } from "../../../store/socialStore";
import { attemptSteal, type StealDef } from "../../../game/social/crime";
import { grantItems } from "../../../game/actions";
import { icon16Path } from "../../../data/assets";
import { itemName } from "../../../i18n/content";
import { tl } from "../../../i18n";
import { eventActive } from "../../../game/social/worldEvents";
import { placeForestLife } from "./encounters";
import { Fireflies } from "../../fx/Fireflies";

/**
 * Whisperwood, Deepwood and the Ancient Grove: all procedural. The layout
 * comes from the biome rules + a seed that changes every day, so the woods
 * regrow into new shapes overnight while entrances and landmarks stay put.
 */

/** Things used up in today's forests (camp chests, shrine blessings,
 * satchels) — remembered in the save until tomorrow. */
const usedToday = {
  has: (key: string) => useSocialStore.getState().usedToday(key, useTimeStore.getState().day),
  add: (key: string) => useSocialStore.getState().useToday(key, useTimeStore.getState().day),
};

function exitFor(e: BiomeEntrance, cols: number, rows: number): WoodsConfig["exits"][number] {
  const T = TILE;
  switch (e.side) {
    case "west":
      return { trigger: { rect: { x: 0, y: (e.at - 2) * T, w: 8, h: 5 * T }, travel: e.to, requireDir: "left" }, spawnName: e.spawn, spawn: { x: 2 * T, y: e.at * T + 10, dir: "side" } };
    case "east":
      return { trigger: { rect: { x: cols * T - 8, y: (e.at - 2) * T, w: 8, h: 5 * T }, travel: e.to, requireDir: "right" }, spawnName: e.spawn, spawn: { x: (cols - 2) * T, y: e.at * T + 10, dir: "side" } };
    case "north":
      return { trigger: { rect: { x: (e.at - 2) * T, y: 0, w: 5 * T, h: 8 }, travel: e.to, requireDir: "up" }, spawnName: e.spawn, spawn: { x: e.at * T + 8, y: 2 * T + 8, dir: "down" } };
    case "south":
      return { trigger: { rect: { x: (e.at - 2) * T, y: rows * T - 8, w: 5 * T, h: 8 }, travel: e.to, requireDir: "down" }, spawnName: e.spawn, spawn: { x: e.at * T + 8, y: (rows - 2) * T, dir: "up" } };
  }
}

function buildBiome(game: Game, id: ForestBiomeId, extra?: (o: Outdoor, layout: ForestLayout) => void): Area {
  const rules = BIOMES[id];
  const day = useTimeStore.getState().day;
  const skills = usePlayerStore.getState().skills;
  const seed = `${id}-day${day}`;
  const layout = generateForest(rules, seed, {
    woodcutting: skills.woodcutting.level,
    mining: skills.mining.level,
    gathering: skills.gathering.level,
  });
  const flags = useWorldStore.getState().progress.flags;

  const area = buildWoods(game, {
    id,
    seed,
    layout,
    ground: rules.ground,
    trail: rules.trail,
    treeKinds: rules.treeKinds,
    exits: rules.entrances.map((e) => exitFor(e, rules.cols, rules.rows)),
    decor: rules.decor,
    bushKinds: rules.bushKinds,
    ambient: rules.ambient,
    extra: (o) => {
      // Hidden glades behind thickets.
      for (const g of layout.glades) {
        o.area.add(
          new Thicket((g.thicket.x + 0.5) * TILE, (g.thicket.y + 1) * TILE, o.area, {
            label: "Thicket",
            toolPower: rules.thicketPower,
            onCleared: (game2) => {
              if (useWorldStore.getState().discover(`glade:${id}`)) {
                game2.ui.pushToast(t("toast.hiddenGladeFirst"), "levelup");
                awardSkillXp("luck", 10);
                grantXp(60);
              } else game2.ui.pushToast(t("toast.hiddenGlade"), "info");
            },
          }),
        );
      }
      // Gated entrances (the overgrown path to the Ancient Grove).
      for (const e of layout.entrances) {
        const gate = e.entrance.gate;
        if (!gate || flags[gate.flag]) continue;
        const mid = { x: (e.edge.x + e.inside.x) / 2, y: (e.edge.y + e.inside.y) / 2 };
        o.area.add(
          new Thicket((mid.x + 0.5) * TILE, (mid.y + 1) * TILE, o.area, {
            label: gate.label,
            toolPower: gate.toolPower,
            width: 96,
            onCleared: (game2) => {
              useWorldStore.getState().setFlag(gate.flag);
              audio.sfx("rare");
              game2.ui.pushToast(t("toast.gateOpens", { label: thicketLabel(gate.label) }), "levelup");
            },
          }),
        );
      }
      for (const p of layout.pois) placePoi(o, p, seed, id);
      placeForestLife(game, o, layout, id, seed);
      extra?.(o, layout);
    },
  });
  area.cull = true;
  spawnFauna(area, id, layout, seed);
  area.add(new Fireflies(area, id === "forest" ? 30 : 22));
  // Glowing things light up the gloom.
  for (const e of area.entities) {
    const def = (e as { def?: { id: string } }).def;
    if (def?.id === "mushroom") area.light({ x: e.x, y: e.y - 6, radius: 26, color: 0x7fffd0, intensity: 0.6 });
    if (def?.id === "emberbloom") area.light({ x: e.x, y: e.y - 10, radius: 24, color: 0xff7a5a, intensity: 0.5 });
  }
  return area;
}

/** Points of interest: small set pieces that make a clearing memorable. */
function placePoi(o: Outdoor, p: ForestLayout["pois"][number], seed: string, biome: ForestBiomeId) {
  const T = TILE;
  const x = (p.x + 0.5) * T;
  const y = (p.y + 1) * T;
  const key = `${seed}:${p.kind}`;
  const tier = biome === "forest" ? 1 : biome === "deep_forest" ? 2 : 3;
  if (p.kind === "camp") {
    // An abandoned camp: dead campfire, a log, a forgotten chest.
    o.area.add(new Prop(x, y, animFrames("bonfire"), { fps: 6 }));
    const fire = o.area.add(new Prop(x, y - 3, animFrames("fire"), { fps: 9 }));
    fire.sortBias = 1;
    fire.withLight({ radius: 56, color: 0xffa040, intensity: 0.85, dy: -8, flicker: 1 });
    o.area.solidRect({ x: x - 10, y: y - 8, w: 20, h: 8 });
    o.area.prop("log_pile", x - 30, y + 4, { collider: { w: 26, h: 6 } });
    o.area.prop("bench", x + 34, y + 2, { collider: { w: 50, h: 6 } });
    o.area.add(
      new Chest(x, y - 22, key, tier >= 2, tier, usedToday.has(key), () => usedToday.add(key), (r) => o.area.solidRect(r)),
    );
  } else if (p.kind === "shrine") {
    o.area.prop("stone_slab", x, y, { collider: { w: 40, h: 6 } });
    o.area.prop("tomb_arch", x - 26, y - 2, { collider: { w: 12, h: 5 } });
    o.area.prop("tomb_arch", x + 26, y - 2, { collider: { w: 12, h: 5 } });
    o.area.light({ x, y: y - 10, radius: 46, color: 0x9ec8ff, intensity: 0.8, flicker: 0.4 });
    o.area.add(
      new InteractSpot(
        x,
        y + 8,
        () => (usedToday.has(key) ? { verb: t("prompt.restAt"), target: t("prompt.target.shrine"), blocked: t("prompt.shrineQuiet") } : { verb: t("prompt.prayAt"), target: t("prompt.target.shrine") }),
        (game) => {
          if (usedToday.has(key)) return;
          usedToday.add(key);
          usePlayerStore.getState().fullHeal();
          awardSkillXp("luck", 15);
          audio.sfx("levelup");
          game.fx.burst(game.player.x, game.player.y - 12, "heal", 20, { speed: 20, up: 60 });
          game.ui.pushToast(t("toast.shrineBlessing"), "levelup", { icon: "clover" });
        },
        { radius: 20, priority: 0 },
      ),
    );
  } else if (p.kind === "satchel") {
    // Someone's lost satchel, spilled on the path. Once a day.
    placeSatchel(o, x, y, key, tier);
  } else if (p.kind === "den") {
    // An animal den: a mossy boulder with a burrow, and its residents nearby.
    o.area.prop("rock_large", x, y, { collider: { w: 30, h: 10 } });
    o.area.prop("bush_large", x + 26, y - 2, { collider: { w: 20, h: 6 } });
    const g = new Graphics().ellipse(x - 4, y + 3, 6, 3).fill({ color: 0x1a120e, alpha: 0.9 });
    o.area.ground.addChild(g);
    const rng = SeededRandom.fromString(key);
    const kinds = biome === "forest" ? ["rabbit", "rabbit", "fox"] : ["fox", "boar", "rabbit"];
    for (let i = 0; i < 3; i++) o.area.add(new Animal(x + rng.int(-40, 40), y + rng.int(14, 34), rng.pick(kinds)));
  } else if (p.kind === "statue") {
    // A statue nobody remembers putting up, with an inscription nobody asked for.
    o.area.prop("tomb_arch", x, y, { collider: { w: 16, h: 6 } });
    o.area.prop("flower_white_b", x - 12, y + 4, { flat: true });
    o.area.prop("flower_blue_b", x + 12, y + 5, { flat: true });
    const rng = SeededRandom.fromString(key);
    const pick = rng.int(0, 99);
    o.area.add(
      new InteractSpot(x, y + 6, () => ({ verb: t("prompt.read"), target: t("prompt.target.statue") }), () => {
        const lines = tl("toast.statue");
        useUiStore.getState().pushToast(lines[pick % lines.length], "info", { icon: "scroll_return" });
      }, { radius: 18 }),
    );
  } else if (p.kind === "picnic") {
    // An abandoned picnic. The pie is unguarded. The woods judge silently.
    const g = new Graphics();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.rect(x - 20 + i * 10, y - 12 + j * 8, 10, 8).fill((i + j) % 2 ? 0xd84a3a : 0xf2e6d0);
    o.area.ground.addChild(g);
    o.area.prop("pot_b", x + 16, y - 6);
    const pieKey = `steal:picnic:${key}`;
    const isUsed = () => useSocialStore.getState().usedToday(pieKey, useTimeStore.getState().day);
    const def: StealDef = { key: pieKey, target: "prompt.target.picnicPie", loot: { itemId: "apple_pie", quantity: 1 }, honor: 2 };
    o.area.add(new StealSpot(x - 4, y - 2, tex(icon16Path("apple_pie")), def, (game) => attemptSteal(game, x, y, def), isUsed));
  } else if (p.kind === "ruins") {
    // Tumbled stones of something that used to matter. There's usually
    // something left behind.
    const rng = SeededRandom.fromString(key);
    o.area.prop("stone_slab", x - 18, y - 10, { collider: { w: 36, h: 6 } });
    o.area.prop("rubble_grey", x + 22, y - 4, { flat: true });
    o.area.prop("rock_grey_medium", x + 30, y + 10, { collider: { w: 18, h: 7 } });
    o.area.prop("tomb_arch", x - 34, y + 8, { collider: { w: 12, h: 5 } });
    o.area.prop("pebble_b", x + 4, y + 12, { flat: true });
    if (rng.bool(0.6)) o.area.add(new Chest(x + 6, y + 2, key, tier >= 2 || rng.bool(0.25), tier, usedToday.has(key), () => usedToday.add(key), (r) => o.area.solidRect(r)));
    else placeSatchel(o, x + 6, y + 4, key, tier);
  } else if (p.kind === "fallen_giant") {
    // A huge tree came down in a storm; mushrooms and firewood everywhere.
    for (let i = 0; i < 3; i++) o.area.prop("log_long", x - 36 + i * 30, y - 2 + (i % 2), { collider: { w: 28, h: 6 } });
    o.area.prop("stump_oak", x + 58, y, { collider: { w: 18, h: 7 } });
    for (let i = 0; i < 6; i++) o.area.prop(i % 2 ? "mushroom_a" : "mushroom_big", x - 40 + i * 16, y + 8 + (i % 3) * 2, { flat: i % 2 === 1 });
    o.node("mushroom", p.x - 1, p.y + 2);
    o.node("tree", p.x + 3, p.y + 3);
  } else if (p.kind === "stump_circle") {
    // Stumps in a perfect circle. Nobody admits to it.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      o.area.prop(i % 2 ? "stump_oak" : "stump_oak_autumn", x + Math.cos(a) * 36, y + Math.sin(a) * 22, { collider: { w: 16, h: 6 } });
    }
    const rng = SeededRandom.fromString(key);
    const pick = rng.int(0, 99);
    o.area.add(
      new InteractSpot(x, y + 4, () => ({ verb: t("prompt.lookAt"), target: t("prompt.target.stumpCircle") }), () => {
        const lines = tl("toast.stumpCircle");
        useUiStore.getState().pushToast(lines[pick % lines.length], "info", { icon: "wood" });
        if (usedToday.has(key)) return;
        usedToday.add(key);
        awardSkillXp("luck", 6);
      }, { radius: 20 }),
    );
  } else if (p.kind === "fairy_ring") {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      o.area.prop("mushroom_a", x + Math.cos(a) * 34, y + Math.sin(a) * 20, { flat: true });
    }
    o.area.light({ x, y: y - 4, radius: 50, color: 0xb0ffd8, intensity: 0.7, flicker: 0.5 });
    // A moonpetal blooms in the middle at night.
    o.node("moonpetal", p.x, p.y);
  }
  o.reserve(p.x - 3, p.y - 3, 7, 6);
}

export function buildForest(game: Game): Area {
  return buildBiome(game, "forest", (o, layout) => {
    const west = layout.entrances.find((e) => e.entrance.spawn === "west")!;
    // Hale the woodcutter keeps an eye on the way in.
    const hale = npc("hale", (west.inside.x + 2) * TILE, (west.inside.y - 2) * TILE);
    if (hale) o.area.add(hale);
    const north = layout.entrances.find((e) => e.entrance.spawn === "north")!;
    o.area.add(
      new InteractSpot((north.inside.x + 2) * TILE, (north.inside.y + 1) * TILE, () => ({ verb: t("prompt.read"), target: t("prompt.target.signpost") }), () =>
        useUiStore.getState().pushToast(t("toast.signpost", { north: areaName("deep_forest"), west: areaName("town") }), "info"),
      ),
    );
    o.prop("lamp_post", north.inside.x + 2, north.inside.y + 1, { w: 6, h: 4 });
    // World event: a golden glow — rare growth right by the trail in.
    if (eventActive("golden_glow")) {
      const c = layout.clearings.find((cl) => Math.abs(cl.x - west.inside.x) + Math.abs(cl.y - west.inside.y) > 10) ?? layout.clearings[0];
      const rare = ["golden_tree", "healroot", "golden_tree", "crystal", "healroot", "emberbloom"];
      let placed = 0;
      for (let r = 1; r <= 4 && placed < rare.length; r++)
        for (let a = 0; a < 8 && placed < rare.length; a++) {
          const tx = Math.round(c.x + Math.cos((a / 8) * Math.PI * 2) * r * 2);
          const ty = Math.round(c.y + Math.sin((a / 8) * Math.PI * 2) * r * 1.5);
          if (!o.freeArea(tx - 1, ty - 1, 3, 2, true)) continue;
          o.node(rare[placed++], tx, ty);
          o.area.light({ x: tx * TILE + 8, y: ty * TILE, radius: 30, color: 0xffe080, intensity: 0.7, flicker: 0.3 });
        }
    }
  });
}

export function buildDeepForest(game: Game): Area {
  return buildBiome(game, "deep_forest", (o) => {
    // The Sunken Crypt — a second way into the Depths.
    const l = BIOMES.deep_forest.landmark!;
    const meta = ASSETS.buildings.crypt_entrance;
    const cx = (l.x + l.w / 2) * TILE;
    const bottom = (l.y + l.h) * TILE;
    o.area.add(new Prop(cx, bottom, tex(buildingPath("crypt_entrance"))));
    o.area.solidRect({ x: cx - meta.w / 2, y: bottom - meta.h + meta.solid.y, w: meta.w, h: meta.solid.h - 2 });
    o.reserve(l.x, l.y, l.w, l.h);
    o.area.add(
      new InteractSpot(cx, bottom + 4, () => ({ verb: t("prompt.descendInto"), target: t("prompt.target.crypt") }), () =>
        useUiStore.getState().openPanel("dungeonGate", { surface: { area: "deep_forest", spawn: "crypt" } }),
      { radius: 20, priority: 0, marker: true }),
    );
    o.area.spawns.crypt = { x: cx, y: bottom + 16, dir: "down" };
    for (const x of [cx - 40, cx + 40]) {
      o.area.prop("tomb_arch", x, bottom + 10, { collider: { w: 12, h: 6 } });
      o.area.light({ x, y: bottom, radius: 40, color: 0x7fb0ff, intensity: 0.7, flicker: 0.6 });
    }
    o.area.light({ x: cx, y: bottom - 20, radius: 60, color: 0x6aa0ff, intensity: 0.6, flicker: 0.4 });
  });
}

export function buildAncientGrove(game: Game): Area {
  const area = buildBiome(game, "ancient_grove");
  if (useWorldStore.getState().discover("ancient_grove")) {
    useUiStore.getState().pushToast(t("toast.foundGrove"), "levelup");
    awardSkillXp("luck", 20);
    grantXp(120);
  }
  return area;
}

/** A lost satchel on the path: a little gold and a random find, once a day. */
function placeSatchel(o: Outdoor, x: number, y: number, key: string, tier: number) {
  const satKey = `satchel:${key}`;
  const icon = new Prop(x, y, tex(icon16Path("coin_bag")));
  o.area.add(icon);
  o.area.add(
    new InteractSpot(
      x,
      y + 4,
      () => (usedToday.has(satKey) ? null : { verb: t("prompt.search"), target: t("prompt.target.satchel") }),
      (game) => {
        if (usedToday.has(satKey)) return;
        usedToday.add(satKey);
        icon.view.visible = false;
        const rng = SeededRandom.fromString(satKey);
        if (rng.bool(0.15)) {
          game.ui.pushToast(t("toast.satchelEmpty"), "info");
          return;
        }
        const table = tier === 1 ? ["health_potion", "arrow", "herb", "iron_ore", "feather"] : ["greater_potion", "silver_ore", "return_scroll", "sapphire", "arrow"];
        const itemId = rng.pick(table);
        const qty = itemId === "arrow" ? rng.int(4, 8) : rng.int(1, 2);
        const gold = rng.int(5, 12) * tier;
        usePlayerStore.getState().earnGold(gold);
        grantItems([{ itemId, quantity: qty }]);
        game.ui.pushToast(t("toast.satchel", { items: `${gold}g + ${qty}× ${itemName(itemId)}` }), "loot", { icon: "coin_bag" });
        audio.sfx("chest");
      },
      { radius: 16 },
    ),
  );
  if (usedToday.has(satKey)) icon.view.visible = false;
}

/** Woodland animals, placed in open clearings away from the way in. */
function spawnFauna(area: Area, id: ForestBiomeId, layout: ForestLayout, seed: string) {
  const fauna = FOREST_FAUNA[id];
  if (!fauna) return;
  const rng = SeededRandom.fromString(`${seed}:fauna`);
  const spots = layout.clearings.filter((c) => !layout.entrances.some((e) => Math.abs(e.inside.x - c.x) + Math.abs(e.inside.y - c.y) < 8));
  if (!spots.length) return;
  for (let i = 0; i < fauna.count; i++) {
    const c = spots[i % spots.length];
    const kind = rng.weighted(fauna.kinds.map((k) => ({ item: k.id, weight: k.weight })));
    const x = (c.x + rng.float(-c.rx + 1, c.rx - 1)) * TILE;
    const y = (c.y + rng.float(-c.ry + 1, c.ry - 1)) * TILE;
    area.add(new Animal(x, y, kind));
  }
  // Now and then something special wanders in. The whole wood feels it.
  const day = useTimeStore.getState().day;
  const rare = SeededRandom.fromString(`${seed}:rare:${day}`);
  for (const r of fauna.rare) {
    if (!rare.bool(r.chance)) continue;
    const c = rare.pick(spots);
    area.add(new Animal(c.x * TILE, c.y * TILE, r.id));
    useUiStore.getState().pushToast(t("hunt.rareNear", { name: animalName(r.id, ANIMALS[r.id].name) }), "levelup", { icon: "bow_wood" });
    break;
  }
}
