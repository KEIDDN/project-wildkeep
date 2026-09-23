import { useEffect, useRef } from "react";
import { Application, Container, type Ticker } from "pixi.js";
import { PlayerVisual } from "../sprites/PlayerVisual";
import { createTownScene } from "./scenes/TownScene";
import { createForestScene, type ForestNodeState } from "./scenes/ForestScene";
import { createDungeonScene } from "./scenes/DungeonScene";
import type { Interactable, WorldSceneHandle } from "./scenes/sceneTypes";
import { usePlayerStore } from "../../store/playerStore";
import { useGameStore } from "../../store/gameStore";
import { useDungeonStore } from "../../store/dungeonStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { canGather, rollGatherDrops } from "../../game/systems/gatherSystem";
import type { ResourceNodeDef } from "../../data/resourceNodes";
import { PLAYER_MOVE_SPEED, TILE_DISPLAY } from "../../game/core/constants";
import { SeededRandom } from "../../game/core/rng";
import { rollChestLoot } from "../../game/systems/lootSystem";
import { getItem } from "../../data/items";
import type { BuildingDef } from "../../data/buildings";
import type { Direction, SceneId } from "../../game/core/types";
import { recordDungeonRunComplete } from "../../game/save/gameSave";

export const VIEW_W = 896;
export const VIEW_H = 560;

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cameraRef = useRef<Container | null>(null);
  const playerVisualRef = useRef<PlayerVisual | null>(null);
  const sceneRef = useRef<WorldSceneHandle | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const gatheringRef = useRef(false);
  const nearestRef = useRef<Interactable | null>(null);
  const switchingRef = useRef(false);

  useEffect(() => {
    let destroyed = false;
    const app = new Application();

    async function switchScene(sceneId: SceneId) {
      if (switchingRef.current) return;
      switchingRef.current = true;
      const camera = cameraRef.current;
      if (!camera) {
        switchingRef.current = false;
        return;
      }

      let handle: WorldSceneHandle;
      let spawnX: number;
      let spawnY: number;

      if (sceneId === "dungeon") {
        const dungeon = useDungeonStore.getState().dungeon;
        if (!dungeon) {
          useGameStore.getState().setScene("town");
          switchingRef.current = false;
          return;
        }
        handle = await createDungeonScene(dungeon);
        spawnX = dungeon.entranceTile.x * TILE_DISPLAY + TILE_DISPLAY / 2;
        spawnY = dungeon.entranceTile.y * TILE_DISPLAY + TILE_DISPLAY / 2;
      } else if (sceneId === "forest") {
        handle = await createForestScene();
        spawnX = 2 * TILE_DISPLAY;
        spawnY = 9 * TILE_DISPLAY;
      } else {
        handle = await createTownScene();
        spawnX = 10 * TILE_DISPLAY;
        spawnY = 8 * TILE_DISPLAY;
      }

      if (destroyed) {
        handle.destroy();
        switchingRef.current = false;
        return;
      }

      sceneRef.current?.destroy();
      camera.removeChildren();
      camera.addChild(handle.container);
      if (playerVisualRef.current) camera.addChild(playerVisualRef.current.sprite);
      sceneRef.current = handle;
      usePlayerStore.getState().setPosition({ x: spawnX, y: spawnY });
      switchingRef.current = false;
    }

    function startGather(interactable: Interactable) {
      if (gatheringRef.current) return;
      const { def, state } = interactable.data as {
        def: ResourceNodeDef;
        state: ForestNodeState;
      };
      if (state.depleted) return;
      const player = usePlayerStore.getState();
      const inventory = useInventoryStore.getState().stacks;
      if (!canGather(def, player.equipment, inventory)) {
        useGameStore
          .getState()
          .pushToast(`You need a better ${def.toolKind ?? "tool"} for this.`, "warning");
        return;
      }
      gatheringRef.current = true;
      const dx = interactable.x - player.position.x;
      const dy = interactable.y - player.position.y;
      const direction: Direction = Math.abs(dx) > Math.abs(dy) ? "side" : dy < 0 ? "up" : "down";
      player.setDirection(direction, dx < 0);
      player.setAction("gather");

      setTimeout(() => {
        const rng = new SeededRandom(Math.floor(Math.random() * 2 ** 31));
        const drops = rollGatherDrops(rng, def);
        for (const drop of drops) {
          useInventoryStore.getState().addItem(drop.itemId, drop.quantity);
        }
        usePlayerStore.getState().gainXp(def.xpReward);
        usePlayerStore.getState().gainSkillXp(def.skill, def.xpReward);
        const summary = drops.map((d) => `${d.quantity} ${getItem(d.itemId).name}`).join(", ");
        useGameStore.getState().pushToast(`Gathered ${summary}`, "loot");
        state.depleted = true;
        state.respawnAt = performance.now() + def.respawnMs;
        state.sprite.alpha = 0.35;
        usePlayerStore.getState().setAction("idle");
        gatheringRef.current = false;
      }, def.gatherTimeMs);
    }

    function openChest(interactable: Interactable) {
      const { chestInstanceId } = interactable.data as { chestInstanceId: string };
      const dungeonState = useDungeonStore.getState();
      const room = dungeonState.dungeon?.rooms.find((r) => r.chest?.instanceId === chestInstanceId);
      if (!room?.chest || room.chest.opened || !dungeonState.rng) return;
      const relicEffects = usePlayerStore.getState().relicEffects();
      const loot = rollChestLoot(dungeonState.rng, room.chest.isRare, relicEffects.rareLootChanceBonus);
      for (const l of loot) useInventoryStore.getState().addItem(l.itemId, l.quantity);
      dungeonState.markChestOpened(chestInstanceId);
      dungeonState.addRunReward(0, 0, loot);
      const summary = loot.map((l) => `${l.quantity} ${getItem(l.itemId).name}`).join(", ") || "nothing";
      useGameStore.getState().pushToast(`Chest: ${summary}`, "loot");
    }

    function completeDungeonRun() {
      const dungeonState = useDungeonStore.getState();
      recordDungeonRunComplete(dungeonState.dungeon?.tier ?? 1);
      dungeonState.markRunComplete();
      useGameStore.getState().openPanel("dungeonResult");
    }

    function handleInteract() {
      if (useGameStore.getState().activePanel) return;
      const nearest = nearestRef.current;
      if (!nearest) return;
      const gameState = useGameStore.getState();
      if (nearest.kind === "building") {
        const building = nearest.data as BuildingDef;
        if (building.kind === "house") gameState.openPanel("house");
        else if (building.kind === "store") gameState.openPanel("shop");
        else if (building.kind === "blacksmith") gameState.openPanel("blacksmith");
        else if (building.kind === "forest_path") gameState.setScene("forest");
        else if (building.kind === "dungeon_gate") {
          useDungeonStore.getState().start(1);
          gameState.setScene("dungeon");
        }
      } else if (nearest.kind === "resourceNode") {
        startGather(nearest);
      } else if (nearest.kind === "enemy") {
        const { enemyInstanceId } = nearest.data as { enemyInstanceId: string };
        useDungeonStore.getState().enterCombat(enemyInstanceId);
        gameState.openPanel("combat");
      } else if (nearest.kind === "chest") {
        openChest(nearest);
      } else if (nearest.kind === "exit") {
        completeDungeonRun();
      }
    }

    function tick(ticker: Ticker) {
      const scene = sceneRef.current;
      const playerVisual = playerVisualRef.current;
      const camera = cameraRef.current;
      if (!scene || !playerVisual || !camera) return;
      const deltaSec = ticker.deltaMS / 1000;
      scene.update(deltaSec);

      const gameState = useGameStore.getState();
      const blocked = gameState.activePanel !== null || gatheringRef.current;
      const player = usePlayerStore.getState();

      let dx = 0;
      let dy = 0;
      if (!blocked) {
        const keys = keysRef.current;
        if (keys["arrowup"] || keys["w"]) dy -= 1;
        if (keys["arrowdown"] || keys["s"]) dy += 1;
        if (keys["arrowleft"] || keys["a"]) dx -= 1;
        if (keys["arrowright"] || keys["d"]) dx += 1;
      }

      const moving = dx !== 0 || dy !== 0;
      if (moving) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        const nx = player.position.x + dx * PLAYER_MOVE_SPEED * deltaSec;
        const ny = player.position.y + dy * PLAYER_MOVE_SPEED * deltaSec;
        let fx = player.position.x;
        let fy = player.position.y;
        if (scene.isWalkable(nx, player.position.y)) fx = nx;
        if (scene.isWalkable(player.position.x, ny)) fy = ny;
        player.setPosition({ x: fx, y: fy });

        let direction: Direction = player.direction;
        let facingLeft = player.facingLeft;
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = "side";
          facingLeft = dx < 0;
        } else if (dy < 0) direction = "up";
        else if (dy > 0) direction = "down";
        player.setDirection(direction, facingLeft);
        if (!["attack", "gather", "hit", "dead"].includes(player.action)) {
          player.setAction("walk");
        }

        if (gameState.scene === "dungeon") {
          useDungeonStore.getState().movePlayerTile(
            Math.floor(fx / TILE_DISPLAY),
            Math.floor(fy / TILE_DISPLAY),
          );
        }
      } else if (player.action === "walk") {
        player.setAction("idle");
      }

      const freshPlayer = usePlayerStore.getState();
      playerVisual.update(freshPlayer.direction, freshPlayer.action, freshPlayer.facingLeft);
      playerVisual.setPosition(freshPlayer.position.x, freshPlayer.position.y);

      const halfW = VIEW_W / 2;
      const halfH = VIEW_H / 2;
      const camX = clamp(freshPlayer.position.x, halfW, Math.max(halfW, scene.widthPx - halfW));
      const camY = clamp(freshPlayer.position.y, halfH, Math.max(halfH, scene.heightPx - halfH));
      camera.position.set(-camX + halfW, -camY + halfH);

      let nearest: Interactable | null = null;
      let nearestDist = Infinity;
      for (const it of scene.interactables) {
        const d = Math.hypot(it.x - freshPlayer.position.x, it.y - freshPlayer.position.y);
        if (d <= it.radius && d < nearestDist) {
          nearest = it;
          nearestDist = d;
        }
      }
      nearestRef.current = nearest;
      const label = nearest ? nearest.label : null;
      if (useGameStore.getState().interactionPrompt !== label) {
        useGameStore.getState().setInteractionPrompt(label);
      }
    }

    (async () => {
      await app.init({
        width: VIEW_W,
        height: VIEW_H,
        backgroundColor: 0x14100c,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      hostRef.current?.appendChild(app.canvas);
      app.canvas.style.imageRendering = "pixelated";

      const camera = new Container();
      app.stage.addChild(camera);
      cameraRef.current = camera;

      const playerVisual = new PlayerVisual();
      await playerVisual.load();
      if (destroyed) return;
      playerVisualRef.current = playerVisual;

      await switchScene(useGameStore.getState().scene);
      app.ticker.add(tick);
    })();

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;
      if (k === "e" || k === " ") handleInteract();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const unsubscribe = useGameStore.subscribe((state, prev) => {
      if (state.scene !== prev.scene) void switchScene(state.scene);
    });

    return () => {
      destroyed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      unsubscribe();
      sceneRef.current?.destroy();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="game-canvas-host" />;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
