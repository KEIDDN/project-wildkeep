import { Sprite } from "pixi.js";
import { t } from "../../i18n";
import { thicketLabel, toolName } from "../../i18n/content";
import { Entity, type Interactable } from "./Entity";
import type { Game } from "../Game";
import type { Area } from "../world/Area";
import type { GatherTarget } from "./Player";
import { propPath } from "../../data/assets";
import { tex } from "../textures";
import { bestTool } from "../../game/systems/toolSystem";
import { usePlayerStore } from "../../store/playerStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { audio } from "../../game/audio/AudioManager";
import type { InteractionPrompt } from "../../store/uiStore";


/**
 * A wall of brambles across a trail. Chop through it (with a good enough
 * axe) to reach whatever it hides — a hidden glade, or an overgrown path to
 * a whole new area.
 */
export class Thicket extends Entity implements Interactable, GatherTarget {
  interactRadius = 30;
  interactPriority = 0;
  readonly toolTarget = true;
  readonly anim = "chop" as const;
  private hp = 5;
  private colliderId: number;
  private shake = 0;
  private fade = -1;

  private area: Area;
  private label: string;
  private toolPower: number;
  private onCleared: (game: Game) => void;

  constructor(x: number, y: number, area: Area, opts: { label: string; toolPower: number; width?: number; onCleared: (game: Game) => void }) {
    super(x, y);
    this.area = area;
    this.label = opts.label;
    this.toolPower = opts.toolPower;
    this.onCleared = opts.onCleared;
    const w = opts.width ?? 80;
    for (let bx = -w / 2 + 10; bx <= w / 2 - 10; bx += 15) {
      const s = new Sprite(tex(propPath(Math.round(bx) % 2 ? "bush_large_autumn" : "bush_large")));
      s.anchor.set(0.5, 1);
      s.position.set(bx, 2);
      s.tint = 0x8aa070;
      this.view.addChild(s);
    }
    this.colliderId = area.collision.addRect({ x: x - w / 2, y: y - 14, w, h: 16 });
  }

  get interactX() {
    return this.x;
  }

  get interactY() {
    return this.y + 6;
  }

  alive(): boolean {
    return this.hp > 0;
  }

  private missingTool(): string | null {
    const p = usePlayerStore.getState();
    const tool = bestTool("axe", p.equipment, useInventoryStore.getState().stacks);
    return (tool?.toolPower ?? 0) >= this.toolPower ? null : toolName("axe", this.toolPower);
  }

  prompt(): InteractionPrompt | null {
    if (!this.alive()) return null;
    const missing = this.missingTool();
    return { verb: t("prompt.chopThrough"), target: thicketLabel(this.label), blocked: missing ? t("prompt.needs", { tool: missing }) : undefined, selfHandled: true };
  }

  interact(game: Game): void {
    if (!this.alive()) return;
    const missing = this.missingTool();
    if (missing) {
      game.ui.pushToast(t("prompt.needsToCut", { tool: missing }), "warning");
      audio.sfx("deny");
      this.shake = 0.2;
      return;
    }
    game.player.startGather(this);
  }

  hit(game: Game): void {
    if (!this.alive()) return;
    this.hp--;
    this.shake = 0.2;
    game.fx.burst(this.x + (Math.random() * 30 - 15), this.y - 12, "leaf", 10, { speed: 50, up: 50 });
    game.fx.burst(this.x, this.y - 8, "wood", 4, { speed: 40, up: 40 });
    audio.sfx("chop");
    if (this.hp <= 0) {
      this.area.collision.removeRect(this.colliderId);
      this.fade = 0.6;
      game.shake(2, 0.2);
      this.onCleared(game);
    }
  }

  update(dt: number): void {
    if (this.shake > 0) {
      this.shake -= dt;
      this.view.pivot.x = this.shake > 0 ? Math.round(Math.sin(this.shake * 80) * 1.5) : 0;
    }
    if (this.fade >= 0) {
      this.fade -= dt;
      this.view.alpha = Math.max(0, this.fade / 0.6);
      if (this.fade <= 0) this.view.visible = false;
    }
  }
}
