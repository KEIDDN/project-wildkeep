import { NoticeBoard } from "../questSpawns";
import { isMarketDay, placeTownHappenings } from "../happenings";
import { FarmPlot } from "../../entities/FarmPlot";
import { waterSpot } from "../waterSpots";
import { buildSouthDistrict } from "./townSouth";
import { openPlots } from "../../../game/farming";
import type { Area } from "../Area";
import { Outdoor } from "./outdoor";
import { TILE } from "../../../game/core/constants";
import { ASSETS } from "../../../data/assets";
import { InteractSpot, Prop, npc } from "../../entities/Props";
import { animFrames, tex } from "../../textures";
import { buildingPath } from "../../../data/assets";
import { useUiStore } from "../../../store/uiStore";
import { houseLevelInfo } from "../../../data/house";
import { houseName } from "../../../i18n/content";
import { t } from "../../../i18n";
import { todayEvent } from "../../../game/social/worldEvents";
import { useSocialStore } from "../../../store/socialStore";
import { usePlayerStore } from "../../../store/playerStore";
import { adjustHonor } from "../../../game/social/honor";
import { Animal } from "../../entities/Animal";
import { currentHouseLevel } from "../../../game/systems/playerStats";
import { useMineStore } from "../../../store/mineStore";
import { useTimeStore } from "../../../store/timeStore";
import { useWorldStore } from "../../../store/worldStore";
import type { Game } from "../../Game";
import { placeTownsfolk } from "../../Schedules";
import { Fireflies } from "../../fx/Fireflies";
import { SeededRandom } from "../../../game/core/rng";
import { audio } from "../../../game/audio/AudioManager";
import { awardSkillXp } from "../../../game/actions";
import { tl } from "../../../i18n";

/** Shops keep hours: the world runs on the clock. */
const SHOP_HOURS: [number, number] = [7, 20];
const FORGE_HOURS: [number, number] = [8, 19];

function isOpen([from, to]: [number, number]): boolean {
  const h = useTimeStore.getState().minute / 60;
  return h >= from && h < to;
}

function openHours(target: string, verb: string, hours: [number, number]) {
  return isOpen(hours) ? { verb, target } : { verb, target, blocked: t("prompt.closedUntil", { time: `${String(hours[0]).padStart(2, "0")}:00` }) };
}

function addNpc(area: Area, n: ReturnType<typeof npc>) {
  if (n) area.add(n);
}

/** A new expedition every time: fresh caves. With lift stops unlocked, the
 * lift panel lets you choose how deep to start. */
function enterMine(g: Game) {
  if (useWorldStore.getState().progress.mineCheckpoint >= 5) {
    useUiStore.getState().openPanel("mineLift");
    return;
  }
  useMineStore.getState().start(1);
  g.requestTravel("mine", "entrance");
}

/**
 * Wildkeep village. Everything faces a main street running east–west:
 *
 *   ~~~~~~~~~~~~~~ cliffs ~~~~~~[Old Mine]~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *   [House]    [Shop]      |path|     [Smithy]     [ Tipsy Wyvern  ]
 *   ==================== main street ============================> Forest
 *   gardens         [   plaza + bonfire   ]   forge yard, bench, smelter
 *   [Old Barrow]=========south lane
 *   [houses]              ║  [Hunter's Lodge]  training yard
 *   ========== Chapel Lane ╬==============================  (townSouth.ts)
 *   wayside shrine        ║  pig pen        [Bakers]
 *   ~~~~~~~~~~~~~~~~~ tree line ║ road to Mirror Lake ~~~~~~~~~~~~~~
 *   (west, off the main street: the road up to the Crooked Tower)
 */
const COLS = 64;
const ROWS = 68;
const STREET_Y = 17; // first street row (buildings sit right above it)

export function buildTown(game: Game): Area {
  const o = new Outdoor(game, "town", COLS, ROWS, "wildkeep-town");
  const ter = o.terrain;
  const area = o.area;
  const R = o.rng;

  // ---- terrain -------------------------------------------------------------
  ter.path([[1, STREET_Y + 1], [COLS - 1, STREET_Y + 1]], 3, "dirt"); // main street
  ter.rect(22, 20, 15, 9, "cobble"); // plaza
  ter.path([[30, 5], [30, STREET_Y]], 3, "dirt"); // mine road
  ter.path([[29, 28], [29, 36], [9, 36]], 3, "dirt"); // south lane to the barrow
  ter.path([[29, 36], [29, ROWS - 1]], 3, "dirt"); // on south to Mirror Lake
  ter.rect(4, 22, 9, 6, "dirt"); // garden soil
  ter.blob(50, 32, 5, 3, "dirt", R);
  ter.smooth();

  // ---- cliffs + the Old Mine ----------------------------------------------
  const cliffBottom = 5 * TILE;
  const mineX = 28 * TILE + 8;
  const mineMeta = ASSETS.buildings.mine_entrance;
  const cliffMeta = ASSETS.buildings.cliff_face;
  for (let x = -40; x < COLS * TILE; x += cliffMeta.w - 8) {
    if (x + cliffMeta.w > mineX + 10 && x < mineX + mineMeta.w - 10) continue;
    area.add(new Prop(x + cliffMeta.w / 2, cliffBottom, tex(buildingPath("cliff_face"))));
  }
  // Fill the gap either side of the mine mouth with trimmed cliff pieces.
  area.add(new Prop(mineX - 40, cliffBottom, tex(buildingPath("cliff_face"))));
  area.add(new Prop(mineX + mineMeta.w + 40, cliffBottom, tex(buildingPath("cliff_face"))));
  const mine = area.add(new Prop(mineX + mineMeta.w / 2, cliffBottom, tex(buildingPath("mine_entrance"))));
  mine.sortBias = 2;
  area.solidCells(0, 0, COLS, 5);
  o.reserve(0, 0, COLS, 6);
  const mineDoorX = mineX + 40;
  area.add(
    new InteractSpot(mineDoorX, cliffBottom + 4, () => ({ verb: t("prompt.enter"), target: t("prompt.target.oldMine") }), enterMine, {
      radius: 20,
      priority: 0,
      marker: true,
    }),
  );

  area.spawns.mine = { x: mineDoorX, y: cliffBottom + 14, dir: "down" };
  o.prop("lamp_post", 27, 5, { w: 6, h: 4 });
  o.prop("lamp_post", 33, 5, { w: 6, h: 4 });
  o.prop("crates", 25, 6, { w: 44, h: 8 });
  o.prop("coal_pile", 35, 6);
  addNpc(area, npc("apprentice", 35 * TILE, 8 * TILE));

  // ---- buildings along the street -----------------------------------------
  const bottom = STREET_Y * TILE;
  const houseLevel = currentHouseLevel();
  const house = area.building(houseLevelInfo(houseLevel).sprite, 4 * TILE, bottom);
  const shop = area.building("shop", 15 * TILE, bottom);
  const smith = area.building("blacksmith", 35 * TILE, bottom);
  const tavern = area.building("tavern", 45 * TILE, bottom);
  o.reserve(3, 5, 10, 12);
  o.reserve(14, 5, 10, 12);
  o.reserve(34, 5, 10, 12);
  o.reserve(44, 4, 18, 13);

  const door = (d: { x: number; y: number; w: number; h: number } | undefined) => ({ x: d!.x + d!.w / 2, y: d!.y + d!.h });
  const hd = door(house.door);
  const sd = door(shop.door);
  const bd = door(smith.door);
  const td = door(tavern.door);
  area.spawns.house_door = { x: hd.x, y: hd.y + 12, dir: "down" };
  area.spawns.tavern_door = { x: td.x, y: td.y + 12, dir: "down" };
  area.spawns.shop_door = { x: sd.x, y: sd.y + 12, dir: "down" };
  area.spawns.forge_door = { x: bd.x, y: bd.y + 12, dir: "down" };

  area.add(new InteractSpot(hd.x, hd.y + 2, () => ({ verb: t("prompt.enter"), target: houseName(currentHouseLevel()) }), (g) => g.requestTravel("house", "door"), { radius: 14, priority: 0 }));
  dressHouseYard(area, house.left, house.top, house.meta.w, hd.x, bottom, houseLevel);
  area.add(new InteractSpot(td.x, td.y + 2, () => ({ verb: t("prompt.enter"), target: t("prompt.target.tavern") }), (g) => g.requestTravel("tavern", "door"), { radius: 16, priority: 0 }));
  // The store is a real place: go in, talk to Mira at the counter.
  area.add(
    new InteractSpot(sd.x, sd.y + 2, () => openHours(t("prompt.target.generalStore"), t("prompt.enter"), SHOP_HOURS), (g) => isOpen(SHOP_HOURS) && g.requestTravel("shop", "door"), {
      radius: 14,
      priority: 0,
    }),
  );
  // Bram's forge is a real place too: walk in, find him at the anvil.
  area.add(
    new InteractSpot(bd.x, bd.y + 2, () => openHours(t("prompt.target.forge"), t("prompt.enter"), FORGE_HOURS), (g) => isOpen(FORGE_HOURS) && g.requestTravel("forge", "door"), {
      radius: 14,
      priority: 0,
    }),
  );
  // Walking straight into a door also enters.
  // (The building's solid box stops the feet just below the door, so the
  // trigger sits on the doorstep.)
  area.trigger({ rect: { x: hd.x - 8, y: hd.y, w: 16, h: 9 }, travel: { area: "house", spawn: "door" }, requireDir: "up" });
  area.trigger({ rect: { x: td.x - 9, y: td.y, w: 18, h: 9 }, travel: { area: "tavern", spawn: "door" }, requireDir: "up" });
  if (isOpen(SHOP_HOURS)) area.trigger({ rect: { x: sd.x - 8, y: sd.y, w: 16, h: 9 }, travel: { area: "shop", spawn: "door" }, requireDir: "up" });
  if (isOpen(FORGE_HOURS)) area.trigger({ rect: { x: bd.x - 8, y: bd.y, w: 16, h: 9 }, travel: { area: "forge", spawn: "door" }, requireDir: "up" });

  // Shop frontage: barrels and crates (Mira herself is inside).
  o.prop("barrel", 14, STREET_Y - 1, { w: 12, h: 6 });
  o.prop("crate_stack", 24, STREET_Y - 1, { w: 28, h: 6 });

  // Timber yard across the street from the smithy (the furnace and anvil
  // live inside the forge now).
  area.prop("crates", 41 * TILE, 22 * TILE + 10, { collider: { w: 44, h: 8 } });
  area.prop("coal_heap", 44 * TILE + 8, 23 * TILE, { collider: { w: 24, h: 6 } });
  // Carpenter's bench: planks, cut stone, basic tools, potions.
  area.prop("table_long", 41 * TILE, 27 * TILE, { collider: { w: 72, h: 10 } });
  area.prop("log_long", 38 * TILE + 4, 27 * TILE + 4, { flat: true });
  area.add(
    new InteractSpot(41 * TILE, 27 * TILE + 8, () => ({ verb: t("prompt.craftAt"), target: t("prompt.target.bench") }), () => useUiStore.getState().openPanel("crafting", { station: "workbench" }), {
      radius: 26,
      priority: 1,
    }),
  );
  o.reserve(37, 25, 10, 3);
  o.reserve(37, 20, 10, 4);
  o.prop("coal_crate", 37, 22, { w: 12, h: 6 });
  o.prop("barrel_water", 47, 22, { w: 12, h: 6 });
  waterSpot(area, 47 * TILE + 8, 22 * TILE + 16);
  o.prop("log_pile", 47, 24, { w: 28, h: 8 });

  // Tavern dressing.
  o.prop("barrel", 44, STREET_Y - 1, { w: 12, h: 6 });
  o.prop("barrel", 61, STREET_Y - 1, { w: 12, h: 6 });
  o.prop("bench", 55, STREET_Y + 3, { w: 54, h: 8 });

  // ---- plaza ------------------------------------------------------------------
  area.add(new Prop(29 * TILE + 8, 24 * TILE + 8, animFrames("bonfire"), { fps: 8 }));
  const fire = area.add(new Prop(29 * TILE + 8, 24 * TILE + 5, animFrames("fire"), { fps: 10 }));
  fire.sortBias = 1;
  fire.withLight({ radius: 70, color: 0xffa040, intensity: 0.9, dy: -8, flicker: 1 });
  area.solidRect({ x: 29 * TILE - 4, y: 24 * TILE, w: 24, h: 10 });
  o.reserve(28, 23, 4, 3);
  o.prop("bench", 26, 21, { w: 54, h: 8 });
  o.prop("bench", 31, 27, { w: 54, h: 8 });
  o.prop("lamp_post", 22, 20, { w: 6, h: 4 });
  o.prop("lamp_post", 36, 20, { w: 6, h: 4 });
  o.prop("lamp_post", 22, 28, { w: 6, h: 4 });
  o.prop("lamp_post", 36, 28, { w: 6, h: 4 });
  area.spawns.default = { x: 29 * TILE + 8, y: 26 * TILE + 8, dir: "down" };

  // ---- the Old Barrow: tier I dungeon at the end of the south lane ----------
  const barrowMeta = ASSETS.buildings.crypt_entrance;
  const barrowLeft = 9 * TILE + 8 - (barrowMeta.door!.x + barrowMeta.door!.w / 2);
  const barrowBottom = 35 * TILE;
  const barrow = area.add(new Prop(barrowLeft + barrowMeta.w / 2, barrowBottom, tex(buildingPath("crypt_entrance"))));
  barrow.sortBias = 2;
  area.solidRect({ x: barrowLeft + barrowMeta.solid.x, y: barrowBottom - barrowMeta.h + barrowMeta.solid.y, w: barrowMeta.solid.w, h: barrowMeta.solid.h - 4 });
  o.reserve(6, 30, 7, 6);
  const barrowDoorX = 9 * TILE + 8;
  area.add(
    new InteractSpot(barrowDoorX, barrowBottom + 2, () => ({ verb: t("prompt.enter"), target: t("prompt.target.barrow") }), () => useUiStore.getState().openPanel("dungeonGate", { surface: { area: "town", spawn: "barrow" } }), {
      radius: 20,
      priority: 0,
      marker: true,
    }),
  );
  area.spawns.barrow = { x: barrowDoorX, y: barrowBottom + 14, dir: "down" };
  o.prop("lamp_post", 6, 35, { w: 6, h: 4 });
  o.prop("lamp_post", 12, 34, { w: 6, h: 4 });
  // Frame the barrow mouth: boulders either side, old graves, trees behind.
  area.prop("rock_grey_large", barrowLeft - 8, barrowBottom - 2, { collider: { w: 26, h: 10 } });
  area.prop("rock_grey_medium", barrowLeft + barrowMeta.w + 8, barrowBottom - 4, { collider: { w: 20, h: 8 } });
  area.prop("tomb_wood", 5 * TILE, 33 * TILE, { collider: { w: 10, h: 5 } });
  area.prop("tomb_wood", 13 * TILE + 4, 32 * TILE + 6, { collider: { w: 10, h: 5 } });
  o.tree("tree_oak_dead", 7, 29, false);
  o.tree("tree_pine_dark", 11, 29, false);
  area.light({ x: barrowDoorX, y: barrowBottom - 14, radius: 30, color: 0x9ab8ff, intensity: 0.6, flicker: 0.5 });
  addNpc(area, npc("tobin", 14 * TILE, 35 * TILE + 8, { facingLeft: true }));

  // ---- gardens + tutorial resources (west) --------------------------------
  // Your garden: tilled plots once Hob has turned the soil (more with each
  // house level); until then, and on plots not yet open, just weeds.
  const plots = new Set(openPlots().map(([x, y]) => `${x},${y}`));
  for (const [x, y] of openPlots()) area.add(new FarmPlot(x, y));
  for (let x = 4; x < 13; x += 2) for (let y = 22; y < 28; y += 2) if (![0, 1].some((dx) => [0, 1].some((dy) => plots.has(`${x + dx},${y + dy}`)))) o.prop(R.pick(["plant_leafy", "sprout", "fern"]), x, y, undefined, { flat: false });
  area.spawns.garden = { x: 8 * TILE + 8, y: 24 * TILE + 8 };
  // The garden's water barrel: refill the watering can here.
  area.prop("barrel_water", 14 * TILE + 8, 25 * TILE + 4, { collider: { w: 12, h: 6 } });
  waterSpot(area, 14 * TILE + 8, 25 * TILE + 8);
  for (let x = 3; x <= 13; x++) {
    if (x === 8) continue;
    o.prop("fence_post", x, 21, { w: 6, h: 4 });
    o.prop("fence_post", x, 28, { w: 6, h: 4 });
  }
  o.node("tree", 16, 25);
  o.node("tree", 19, 30);
  o.node("rock", 15, 32);
  o.node("herb", 18, 27);
  o.node("herb", 17, 33);

  // ---- west road up to the Crooked Tower ------------------------------------
  area.trigger({ rect: { x: 0, y: STREET_Y * TILE, w: 10, h: 3 * TILE }, travel: { area: "tower_hill", spawn: "east" }, requireDir: "left" });
  area.spawns.west = { x: 24, y: (STREET_Y + 1) * TILE + 10, dir: "side" };

  // ---- south road to Mirror Lake --------------------------------------------
  area.trigger({ rect: { x: 27 * TILE, y: ROWS * TILE - 8, w: 5 * TILE, h: 8 }, travel: { area: "lake", spawn: "north" }, requireDir: "down" });
  area.spawns.south = { x: 29 * TILE + 8, y: (ROWS - 2) * TILE, dir: "up" };
  o.prop("lamp_post", 27, ROWS - 6, { w: 6, h: 4 });

  // ---- east exit to the forest ---------------------------------------------
  area.trigger({ rect: { x: COLS * TILE - 10, y: STREET_Y * TILE, w: 10, h: 3 * TILE }, travel: { area: "forest", spawn: "west" }, requireDir: "right" });
  area.spawns.east = { x: COLS * TILE - 24, y: (STREET_Y + 1) * TILE + 10, dir: "side" };
  o.prop("lamp_post", 62, STREET_Y - 1, { w: 6, h: 4 });

  // ---- the Nettlebys' cottage (where the townsfolk go home at night) -------------
  const cottage = area.building("house", 52 * TILE, 35 * TILE);
  o.reserve(51, 23, 10, 13);
  const cd = door(cottage.door);
  area.spawns.spot_home_door = { x: cd.x, y: cd.y + 6 };
  area.add(new InteractSpot(cd.x, cd.y + 2, () => ({ verb: t("prompt.knock"), target: t("prompt.target.cottage") }), (g) => g.ui.pushToast(t("toast.cottageKnock"), "info", { icon: "house" }), { radius: 14, priority: 0 }));
  area.prop("d_flower_box", cottage.left + 22, 35 * TILE + 3, { collider: { w: 16, h: 5 } });
  area.prop("d_flower_box", cottage.left + 106, 35 * TILE + 3, { collider: { w: 16, h: 5 } });

  // ---- market (south of the plaza) ----------------------------------------------
  const stalls: [string, number][] = [["d_stall_red", 33], ["d_stall_green", 36], ["d_stall_blue", 39]];
  for (const [id, tx] of stalls) area.prop(id, tx * TILE + 8, 33 * TILE, { collider: { w: 26, h: 10 } });
  o.reserve(32, 29, 10, 5);
  // Vendors stand beside their stalls (the awnings are taller than they are).
  area.spawns.spot_stall_bella = { x: 33 * TILE - 8, y: 33 * TILE + 6 };
  area.spawns.spot_stall_tomas = { x: 36 * TILE - 7, y: 33 * TILE + 6 };
  area.spawns.spot_market = { x: 36 * TILE + 8, y: 35 * TILE + 4 };
  o.prop("d_sacks", 41, 32, { w: 14, h: 5 });
  o.prop("d_hay_a", 31, 32, { w: 10, h: 5 });
  // The third stall: a travelling trader, some days.
  const hour = useTimeStore.getState().minute / 60;
  if (hour >= 8 && hour < 18 && todayEvent()?.id !== "merchant") {
    const rng = SeededRandom.fromString(`market:${useTimeStore.getState().day}`);
    if (isMarketDay() || rng.bool(0.65)) addNpc(area, npc(rng.pick(["grisby", "lucky_lou", "sir_reginald", "olwen", "rika"]), 39 * TILE - 6, 33 * TILE + 6, { face: "down" }));
  }

  // ---- the wishing fountain ------------------------------------------------------
  area.prop("d_fountain_big", 24 * TILE, 33 * TILE, { collider: { w: 22, h: 10 } });
  o.reserve(22, 30, 5, 4);
  area.spawns.spot_fountain = { x: 24 * TILE, y: 35 * TILE };
  area.add(new InteractSpot(24 * TILE, 33 * TILE + 8, () => ({ verb: t("prompt.tossCoin"), target: t("prompt.target.fountain") }), (g) => wishingFountain(g), { radius: 18 }));

  // ---- the notice board (daily contracts) -------------------------------------------
  area.add(new NoticeBoard(20 * TILE + 8, 23 * TILE));
  o.reserve(19, 21, 3, 3);
  area.spawns.notice_board = { x: 20 * TILE + 8, y: 23 * TILE + 12 };

  // ---- graveyard by the barrow ----------------------------------------------------
  area.prop("d_tomb_a", 3 * TILE + 8, 31 * TILE, { collider: { w: 12, h: 5 } });
  area.prop("d_tomb_c", 15 * TILE + 8, 30 * TILE, { collider: { w: 12, h: 5 } });
  area.prop("d_tomb_e", 16 * TILE + 8, 33 * TILE, { collider: { w: 12, h: 5 } });
  area.prop("d_statue_hooded", 14 * TILE + 12, 32 * TILE, { collider: { w: 12, h: 6 } });
  o.reserve(2, 29, 2, 3);
  o.reserve(14, 29, 4, 5);

  // ---- where people hang out (see engine/Schedules.ts) ------------------------------
  area.spawns.spot_plaza = { x: 27 * TILE, y: 23 * TILE };
  area.spawns.spot_garden = { x: 8 * TILE + 8, y: 24 * TILE + 8 };
  area.spawns.spot_mine = { x: 30 * TILE, y: 9 * TILE };
  area.spawns.spot_street_w = { x: 11 * TILE, y: 19 * TILE };
  area.spawns.spot_street_e = { x: 55 * TILE, y: 19 * TILE };
  area.spawns.spot_forge = { x: 42 * TILE, y: 25 * TILE };
  o.prop("d_hay_b", 14, 23, { w: 12, h: 5 });
  o.prop("d_log_stack", 38, 25, { w: 14, h: 5 });

  // ---- Lower Wildkeep (Chapel Lane, the shrine, the lodge, the pen) ---------
  buildSouthDistrict(o);

  // ---- borders + dressing ---------------------------------------------------
  o.forestWall(0, 5, 2, STREET_Y - 6, ["tree_oak", "tree_pine", "tree_oak_autumn"]);
  o.forestWall(0, STREET_Y + 4, 2, ROWS - STREET_Y - 4, ["tree_oak", "tree_pine", "tree_oak_autumn"]);
  o.forestWall(0, ROWS - 4, 27, 4, ["tree_oak", "tree_pine", "tree_tall", "tree_oak_autumn"]);
  o.forestWall(32, ROWS - 4, COLS - 32, 4, ["tree_oak", "tree_pine", "tree_tall", "tree_oak_autumn"]);
  o.forestWall(COLS - 2, 5, 2, STREET_Y - 5, ["tree_pine", "tree_oak"]);
  o.forestWall(COLS - 2, STREET_Y + 3, 2, ROWS - STREET_Y - 3, ["tree_pine", "tree_oak"]);
  for (const [x, y] of [
    [44, 31],
    [3, 34],
    [24, 41],
    [45, 38],
  ])
    o.tree(R.pick(["tree_oak", "tree_pine", "tree_small"]), x, y);
  o.scatter({ x: 2, y: 20, w: COLS - 4, h: ROWS - 24 }, 120);
  o.scatter({ x: 2, y: 20, w: COLS - 4, h: ROWS - 24 }, 14, ["bush_green", "bush_lime", "rock_small", "bush_olive"], true);
  o.scatter({ x: 2, y: 5, w: COLS - 4, h: 1 }, 10, ["grass_tuft_a", "grass_tuft_b", "flower_yellow"]);

  addNpc(area, npc("finn", 47 * TILE, 31 * TILE, { facingLeft: true }));
  placeTownHappenings(area);
  dressForEvent(o);
  addLife(o);
  addNpc(area, npc("watchman", 30 * TILE, 21 * TILE, { route: [{ x: 23 * TILE, y: 22 * TILE }, { x: 36 * TILE, y: 22 * TILE }, { x: 36 * TILE, y: 27 * TILE }, { x: 23 * TILE, y: 27 * TILE }] }));

  return o.finish();
}

/** Townsfolk on their daily rounds (placed after the dressing so they
 * never end up inside a bush). */
function addLife(o: Outdoor) {
  placeTownsfolk(o.area);
  o.area.add(new Fireflies(o.area, 10));
}

/** A coin in the fountain: usually nothing, sometimes a little luck,
 * occasionally the fountain has opinions. */
function wishingFountain(g: Game) {
  const player = usePlayerStore.getState();
  if (!player.spendGold(1)) {
    g.ui.pushToast(t("toast.fountainBroke"), "warning", { icon: "gold_coin" });
    return;
  }
  audio.sfx("coin", { pitch: 1.3 });
  g.fx.burst(24 * TILE, 33 * TILE - 20, "spark", 8, { speed: 20, up: 30 });
  const day = useTimeStore.getState().day;
  const social = useSocialStore.getState();
  const lines = tl("toast.fountainWish");
  if (!social.usedToday("fountain_luck", day) && Math.random() < 0.3) {
    social.useToday("fountain_luck", day);
    awardSkillXp("luck", 12);
    g.ui.pushToast(t("toast.fountainLucky"), "levelup", { icon: "clover" });
  } else g.ui.pushToast(lines[Math.floor(Math.random() * lines.length)], "info", { icon: "gold_coin" });
}

/** Today's world event, if it happens in the village. */
function dressForEvent(o: Outdoor) {
  const area = o.area;
  const ev = todayEvent();
  if (!ev) return;
  const day = useTimeStore.getState().day;
  if (ev.id === "merchant") {
    // Zoltan's stall by the plaza bonfire.
    addNpc(area, npc("merchant_travel", 25 * TILE, 25 * TILE + 8));
    area.prop("crates", 23 * TILE + 4, 25 * TILE + 12, { collider: { w: 40, h: 6 } });
    area.prop("banner_red", 25 * TILE, 24 * TILE);
    area.light({ x: 25 * TILE, y: 25 * TILE, radius: 50, color: 0xffd080, intensity: 0.7 });
  } else if (ev.id === "stranger") {
    addNpc(area, npc("stranger_box", 34 * TILE, 26 * TILE + 8, { facingLeft: true }));
    area.prop("chest_closed", 35 * TILE + 4, 26 * TILE + 12, { collider: { w: 14, h: 6 } });
  } else if (ev.id === "festival") {
    // Bunting, lanterns, and people who'd normally be elsewhere.
    for (const [bx, by] of [
      [22, 21],
      [36, 21],
      [22, 28],
      [36, 28],
      [29, 20],
    ])
      area.prop(bx % 2 ? "banner_green" : "banner_red", bx * TILE + 8, by * TILE);
    for (const [lx, ly] of [
      [25, 22],
      [33, 22],
      [25, 27],
      [33, 27],
    ])
      area.light({ x: lx * TILE, y: ly * TILE, radius: 46, color: 0xffc070, intensity: 0.8, flicker: 0.6 });
    addNpc(area, npc("hob", 26 * TILE, 23 * TILE));
    addNpc(area, npc("lyra", 32 * TILE, 23 * TILE, { facingLeft: true }));
    addNpc(area, npc("wick", 34 * TILE, 27 * TILE, { facingLeft: true }));
  } else if (ev.id === "pig" && !useSocialStore.getState().usedToday("pig_caught", day)) {
    // Duchess is loose. Catch her (walk up and press E) for Hob.
    const pig = new Animal(8 * TILE, 25 * TILE, "pig");
    pig.onCatch = (game, self) => {
      const social = useSocialStore.getState();
      if (social.usedToday("pig_caught", useTimeStore.getState().day)) return;
      social.useToday("pig_caught", useTimeStore.getState().day);
      social.addDeed("helped");
      game.ui.pushToast(t("events.pigCaught"), "info", { icon: "meat_raw" });
      game.removeEntity(self);
      setTimeout(() => {
        usePlayerStore.getState().earnGold(60);
        useUiStore.getState().pushToast(t("events.pigReturned"), "gold", { icon: "coin_bag" });
        adjustHonor(5);
      }, 1400);
    };
    area.add(pig);
    addNpc(area, npc("hob", 10 * TILE, 19 * TILE + 8));
  }
}

/** The yard around your home gets cosier with every upgrade. */
function dressHouseYard(area: Area, left: number, top: number, w: number, doorX: number, bottom: number, level: number) {
  // Chimney smoke: somebody lives here.
  const chimneyX: Record<number, number> = { 1: 94, 2: 94, 3: 14, 4: 94 };
  const smoke = new Prop(left + chimneyX[level] + 12, top + 6, animFrames("smoke"), { fps: 6, alpha: 0.7 });
  smoke.sortBias = 400;
  area.add(smoke);
  if (level >= 2) {
    area.prop("pot_a", doorX - 20, bottom + 3, { collider: { w: 8, h: 4 } });
    area.prop("pot_b", doorX + 20, bottom + 3, { collider: { w: 8, h: 4 } });
    for (const dx of [-34, -26, 26, 34]) area.prop(dx < 0 ? "flower_red" : "flower_yellow", doorX + dx, bottom + 2, { flat: true });
  }
  if (level >= 3) {
    area.prop("lamp_post", left - 6, bottom + 2, { collider: { w: 6, h: 4 } }).withLight({ radius: 52, color: 0xffc77a, intensity: 0.9, dy: -30, flicker: 0.4 });
    area.prop("barrel_water", left + w + 6, bottom, { collider: { w: 12, h: 6 } });
  }
  if (level >= 4) {
    area.prop("banner_green", left + 8, bottom - 26);
    area.prop("banner_green", left + w - 8, bottom - 26);
    area.prop("vase", doorX - 42, bottom + 3, { collider: { w: 8, h: 4 } });
    area.prop("vase", doorX + 42, bottom + 3, { collider: { w: 8, h: 4 } });
  }
}
