import { Container, Rectangle, RenderTexture, Sprite, type Renderer } from "pixi.js";
import type { AreaId, Rect, Vector2 } from "../../game/core/types";
import { CollisionWorld } from "../Collision";
import type { Entity, Interactable } from "../entities/Entity";
import { isInteractable } from "../entities/Entity";
import { Npc, Prop } from "../entities/Props";
import type { LightSource } from "../fx/Lighting";
import type { VisionMap } from "../fx/Vision";
import { ASSETS, buildingGlowPath, buildingPath, propPath, type BuildingMeta } from "../../data/assets";
import { tex } from "../textures";
import type { TravelRequest } from "../../store/worldStore";

export interface Trigger {
  rect: Rect;
  travel: TravelRequest;
  /** Only fires while the player is moving in this direction (edge exits). */
  requireDir?: "up" | "down" | "left" | "right";
  label?: string;
}

/**
 * One loaded map: its layers, collision, entities, spawn points, exits and
 * lights. Area builders (town.ts, forest.ts, …) fill it in using the helpers
 * below; the Game runs it.
 */
export class Area {
  readonly root = new Container();
  readonly ground = new Container();
  readonly entityLayer = new Container();
  /** Drawn over everything in the world (roof overhangs, chandeliers). */
  readonly above = new Container();
  /** Emissive things drawn *over* the darkness (lit windows). The Game
   * shows it in proportion to how dark it is. */
  readonly glow = new Container();
  readonly collision: CollisionWorld;
  readonly entities: Entity[] = [];
  readonly spawns: Record<string, Vector2 & { dir?: "up" | "down" | "side" }> = {};
  readonly triggers: Trigger[] = [];
  readonly staticLights: LightSource[] = [];
  ambient = 1;
  /** Line-of-sight fog (dungeon floors). Null = everything is visible. */
  vision: VisionMap | null = null;
  /** Skip drawing off-screen entities. Only worth it on big maps. */
  cull = false;
  /** Background colour outside the map (visible around small interiors). */
  backdrop = 0x0b0a10;
  /** What the camera may show. Defaults to the map itself; outdoor maps
   * extend it over a decorative surround (see Outdoor.finish) so the player
   * can stay centred right up to the playable edge. */
  viewBounds: Rect;

  readonly id: AreaId;
  readonly width: number;

  readonly height: number;

  constructor(
    id: AreaId,
    width: number,
    height: number,
    collisionCell = 16,
  ) {
    this.id = id;
    this.width = width;

    this.height = height;
    this.collision = new CollisionWorld(width, height, collisionCell);
    this.viewBounds = { x: 0, y: 0, w: width, h: height };
    this.entityLayer.sortableChildren = true;
    this.root.addChild(this.ground, this.entityLayer, this.above);
  }

  add<T extends Entity>(e: T): T {
    this.entities.push(e);
    this.entityLayer.addChild(e.view);
    e.syncView();
    // Stationary entities may declare a feet collider. Someone sitting on a
    // chair (already solid) doesn't get another one: it only spilled into
    // the aisle and closed gaps that plainly looked open.
    const c = (e as { collider?: { w: number; h: number } }).collider;
    if (c) {
      const r = { x: e.x - c.w / 2, y: e.y - c.h, w: c.w, h: c.h };
      const seated = e instanceof Npc && this.collision.blocked({ x: e.x - 1, y: e.y - 2, w: 2, h: 2 });
      if (!seated) this.collision.addRect(r);
    }
    return e;
  }

  remove(e: Entity): void {
    if (e.removed) return;
    const i = this.entities.indexOf(e);
    if (i >= 0) this.entities.splice(i, 1);
    e.destroy();
  }

  interactables(): Interactable[] {
    return this.entities.filter((e) => !e.removed && isInteractable(e)) as unknown as Interactable[];
  }

  // ---- builder helpers -----------------------------------------------------

  /** Static prop at a base point; `collider` is a feet box {w,h} centered at
   * the base, or an explicit rect relative to the base. */
  prop(id: string, x: number, y: number, opts: { collider?: { w: number; h: number; dx?: number; dy?: number }; flat?: boolean; tint?: number; scale?: number } = {}): Prop {
    const p = this.add(new Prop(x, y, tex(propPath(id)), { flat: opts.flat, tint: opts.tint, scale: opts.scale }));
    if (opts.collider) {
      const c = opts.collider;
      this.collision.addRect({ x: x - c.w / 2 + (c.dx ?? 0), y: y - c.h + (c.dy ?? 0), w: c.w, h: c.h });
    }
    return p;
  }

  /** Building whose bottom-left corner sits at (x, y). Returns the door rect
   * in world space (if the building has one). */
  building(id: string, x: number, bottomY: number): { meta: BuildingMeta; left: number; top: number; door?: Rect } {
    const meta = ASSETS.buildings[id];
    const top = bottomY - meta.h;
    this.add(new Prop(x + meta.w / 2, bottomY, tex(buildingPath(id))));
    if (meta.glow) {
      const g = new Sprite(tex(buildingGlowPath(id)));
      g.position.set(x, top);
      this.glow.addChild(g);
      // Warm light spilling from the windows onto the street.
      this.light({ x: x + meta.w / 2, y: bottomY - 18, radius: Math.min(90, meta.w * 0.55), color: 0xffb060, intensity: 0.5 });
    }
    const solid = meta.solid;
    this.collision.addRect({ x: x + solid.x, y: top + solid.y, w: solid.w, h: solid.h });
    const door = meta.door ? { x: x + meta.door.x, y: top + meta.door.y, w: meta.door.w, h: meta.door.h } : undefined;
    return { meta, left: x, top, door };
  }

  /**
   * Bake every flat, static decal (flowers, tufts, pebbles, rugs) into one
   * ground texture. They never move, animate or sort in front of anything,
   * so as separate entities they were only cost: thousands of sprites to
   * cull, sort and draw every frame.
   */
  bakeDecals(renderer: Renderer, bounds: Rect): void {
    const layer = new Container();
    const keep: Entity[] = [];
    for (const e of this.entities) {
      if (e instanceof Prop && e.isDecal) {
        const s = new Sprite(e.sprite.texture);
        s.anchor.set(0.5, 1);
        s.position.set(Math.round(e.x), Math.round(e.y));
        s.tint = e.sprite.tint;
        s.alpha = e.sprite.alpha;
        s.scale.copyFrom(e.sprite.scale);
        layer.addChild(s);
        e.destroy();
      } else keep.push(e);
    }
    this.entities.length = 0;
    this.entities.push(...keep);
    if (!layer.children.length) return;
    const baked = renderer.generateTexture({ target: layer, frame: new Rectangle(bounds.x, bounds.y, bounds.w, bounds.h), resolution: 1, antialias: false });
    baked.source.scaleMode = "nearest";
    layer.destroy({ children: true });
    const sprite = new Sprite(baked);
    sprite.position.set(bounds.x, bounds.y);
    this.ground.addChild(sprite);
  }

  solidRect(r: Rect): void {
    this.collision.addRect(r);
  }

  solidCells(x0: number, y0: number, w: number, h: number): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.collision.setSolidCell(x, y);
  }

  trigger(t: Trigger): void {
    this.triggers.push(t);
  }

  light(l: LightSource): void {
    this.staticLights.push(l);
  }

  destroy(): void {
    for (const e of this.entities) if (!e.removed) e.destroy();
    this.entities.length = 0;
    // Baked ground layers (terrain, cave, dungeon) are render textures owned
    // by this area alone; everything else uses shared, preloaded textures.
    const baked: RenderTexture[] = [];
    const collect = (c: Container) => {
      if (c instanceof Sprite && c.texture instanceof RenderTexture) baked.push(c.texture);
      for (const child of c.children) collect(child);
    };
    collect(this.ground);
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
    for (const t of baked) t.destroy(true);
    this.vision?.destroy();
  }
}
