import { Graphics, Sprite } from "pixi.js";
import { Entity, type Interactable } from "../entities/Entity";
import { Enemy } from "../entities/Enemy";
import type { Game } from "../Game";
import type { Area } from "./Area";
import type { LightSource } from "../fx/Lighting";
import { tex } from "../textures";
import { icon16Path } from "../../data/assets";
import { getItem } from "../../data/items";
import { pendingFinds } from "../../game/quests";
import { useInventoryStore } from "../../store/inventoryStore";
import { useDungeonStore } from "../../store/dungeonStore";
import { useUiStore } from "../../store/uiStore";
import { gameEvents } from "../../game/events";
import { audio } from "../../game/audio/AudioManager";
import { SeededRandom } from "../../game/core/rng";
import { PLAYER_COLLIDER } from "../../game/core/constants";
import { itemName } from "../../i18n/content";
import { t } from "../../i18n";

/**
 * Puts quest items into the world when you walk into the right area: a
 * glinting object at a spot you can actually reach (flood-filled from where
 * you're standing), usually with a few monsters who've taken a liking to
 * it. The guide arrow points there (spawn `quest_<id>`).
 */
export function placeQuestItems(game: Game, area: Area): void {
  const finds = pendingFinds(area.id);
  if (!finds.length) return;
  const level = area.id === "dungeon" ? useDungeonStore.getState().floor : 2;
  for (const f of finds) {
    const spot = reachableSpot(area, game.player.x, game.player.y, `${f.questId}:${area.id}:${level}`);
    if (!spot) continue;
    area.add(new QuestItem(spot.x, spot.y, f.item, `quest_${f.questId}`));
    area.spawns[`quest_${f.questId}`] = { x: spot.x, y: spot.y };
    f.guards.forEach((g, i) => {
      const a = (i / Math.max(1, f.guards.length)) * Math.PI * 2;
      const x = spot.x + Math.cos(a) * 26;
      const y = spot.y + Math.sin(a) * 16;
      if (!area.collision.blocked({ x: x - 5, y: y - 6, w: 10, h: 6 })) area.add(new Enemy(x, y, g, `quest:${f.questId}:${i}`, level, "normal"));
    });
  }
}

/** A walkable point well away from the player that they can actually get to. */
function reachableSpot(area: Area, px: number, py: number, seed: string): { x: number; y: number } | null {
  const step = 8;
  const cols = Math.ceil(area.width / step);
  const rows = Math.ceil(area.height / step);
  const free = (cx: number, cy: number) => {
    const x = cx * step + step / 2;
    const y = cy * step + step / 2;
    return !area.collision.blocked({ x: x - PLAYER_COLLIDER.w / 2, y: y - PLAYER_COLLIDER.h, w: PLAYER_COLLIDER.w, h: PLAYER_COLLIDER.h });
  };
  const start = { x: Math.floor(px / step), y: Math.floor(py / step) };
  const seen = new Uint8Array(cols * rows);
  const queue: number[] = [start.y * cols + start.x];
  seen[queue[0]] = 1;
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    const cx = i % cols;
    const cy = (i / cols) | 0;
    const x = cx * step + step / 2;
    const y = cy * step + step / 2;
    const d = Math.hypot(x - px, y - py);
    // Keep a margin from walls so the item (and its guards) sit in the open.
    if (d > 200 && free(cx - 2, cy) && free(cx + 2, cy) && free(cx, cy - 2) && free(cx, cy + 2)) candidates.push({ x, y, d });
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (seen[j] || !free(nx, ny)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  if (!candidates.length) return null;
  // Prefer the far half of what's reachable: it should take a little finding.
  candidates.sort((a, b) => a.d - b.d);
  const far = candidates.slice(Math.floor(candidates.length * 0.5));
  return SeededRandom.fromString(seed).pick(far);
}

/** The thing a quest sent you to find: bobbing, glinting, lit. */
class QuestItem extends Entity implements Interactable {
  interactRadius = 18;
  interactPriority = 0;
  private icon: Sprite;
  private glint = new Graphics();
  private age = 0;
  private readonly itemId: string;
  private readonly spawnKey: string;

  constructor(x: number, y: number, itemId: string, spawnKey: string) {
    super(x, y);
    this.itemId = itemId;
    this.spawnKey = spawnKey;
    const shadow = new Graphics().ellipse(0, 0, 5, 2).fill({ color: 0, alpha: 0.3 });
    this.icon = new Sprite(tex(icon16Path(getItem(itemId).icon)));
    this.icon.anchor.set(0.5, 1);
    this.view.addChild(shadow, this.glint, this.icon);
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y;
  }

  prompt() {
    return { verb: t("prompt.take"), target: itemName(this.itemId) };
  }

  interact(game: Game) {
    if (this.removed) return;
    useInventoryStore.getState().addItem(this.itemId, 1);
    useUiStore.getState().pushLootReveal(this.itemId, 1);
    gameEvents.emit("pickupCollected", { itemId: this.itemId, gold: false });
    audio.sfx("rare");
    game.fx.burst(this.x, this.y - 8, "gold", 16, { speed: 40, up: 60 });
    delete game.area.spawns[this.spawnKey];
    game.removeEntity(this);
  }

  update(dt: number) {
    this.age += dt;
    this.icon.y = -2 - Math.round(Math.abs(Math.sin(this.age * 3)) * 3);
    this.glint.clear();
    const r = 7 + Math.sin(this.age * 4) * 1.5;
    this.glint.ellipse(0, 0, r, r * 0.45).stroke({ width: 1, color: 0xffe08a, alpha: 0.6 });
  }

  light(): LightSource {
    return { x: this.x, y: this.y - 8, radius: 30, color: 0xffe08a, intensity: 0.8, flicker: 0.3 };
  }
}

/** The village notice board: daily contracts (see BoardPanel). Drawn in
 * code — posts, a plank, pinned notes that flap a little. */
export class NoticeBoard extends Entity implements Interactable {
  interactRadius = 20;
  interactPriority = 1;
  readonly collider = { w: 26, h: 4 };
  private notes: Graphics[] = [];
  private age = Math.random() * 10;

  constructor(x: number, y: number) {
    super(x, y);
    const g = new Graphics();
    const wood = 0x7a4a2a;
    const dark = 0x3a2216;
    // posts
    g.rect(-13, -30, 3, 30).fill(wood).stroke({ width: 1, color: dark });
    g.rect(10, -30, 3, 30).fill(wood).stroke({ width: 1, color: dark });
    // board + little roof
    g.rect(-16, -30, 32, 20).fill(0x9a6a3a).stroke({ width: 1, color: dark });
    g.rect(-15, -29, 30, 1).fill(0xb8844a);
    g.poly([-18, -30, 0, -37, 18, -30]).fill(0x6a3a22).stroke({ width: 1, color: dark });
    const shadow = new Graphics().ellipse(0, 0, 15, 3).fill({ color: 0, alpha: 0.25 });
    this.view.addChild(shadow, g);
    const spots: [number, number, number][] = [
      [-12, -27, 0xf1e6c8],
      [-2, -28, 0xe8dcb8],
      [7, -26, 0xf6ecd4],
    ];
    for (const [nx, ny, c] of spots) {
      const n = new Graphics();
      n.rect(0, 0, 8, 10).fill(c).stroke({ width: 1, color: 0x6a5a48 });
      n.rect(2, 2, 4, 1).fill(0x6a5a48).rect(2, 4, 3, 1).fill(0x6a5a48).rect(2, 6, 4, 1).fill(0x6a5a48);
      n.circle(4, 0.5, 1).fill(0xc83a2a);
      n.position.set(nx, ny);
      this.notes.push(n);
      g.addChild(n);
    }
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y + 2;
  }

  prompt() {
    return { verb: t("prompt.read"), target: t("quests.boardTarget") };
  }

  interact(game: Game) {
    game.ui.openPanel("board");
    audio.sfx("ui");
  }

  update(dt: number) {
    this.age += dt;
    this.notes.forEach((n, i) => (n.skew.x = Math.sin(this.age * 2 + i) * 0.06));
  }
}
