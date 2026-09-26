import { getItem, weaponProfile } from "../data/items";
import { icon16Path } from "../data/assets";
import { hasTex, tex } from "./textures";
import blades from "../data/generated/player_blades.json";

/**
 * One visual identity per weapon, derived from its icon — the same picture
 * the bag, the paper doll and the sheath on your back already use:
 *
 *   - swords swing the body sheet's blade, tinted with the icon's own metal
 *     colour (not a hand-picked value that drifts from the art);
 *   - everything else (daggers, spears, maces, cleavers…) is drawn in the
 *     hand from its icon, at the grip the build step measured per frame
 *     (tools/build_player.py split_blades), so a maul is never swung as a sword.
 */

export type BladeFrame = { x: number; y: number; len: number } | null;
export const BLADES = blades as Record<"side" | "down" | "up", BladeFrame[]>;

/** Swung as the sheet's own blade (true) or drawn from the icon (false). */
export function swingsSheetBlade(itemId: string | undefined): boolean {
  if (!itemId) return true;
  const kind = weaponProfile(itemId).kind;
  return kind === "sword" || kind === "bow";
}

/** How big the icon is drawn in hand, per weapon family. */
export function heldScale(itemId: string): number {
  switch (weaponProfile(itemId).kind) {
    case "dagger":
      return 0.72;
    case "spear":
      return 1.2;
    case "maul":
      return 0.95;
    default:
      return 0.9;
  }
}

const tints = new Map<string, number | null>();

/**
 * The icon's metal colour: the average of its brightest opaque pixels (the
 * blade / head, not the grip), normalised so the brightest channel is full —
 * a multiply tint that keeps the sheet's shading. Falls back to the item's
 * `look` if the icon can't be read.
 */
export function iconTint(itemId: string | undefined): number | null {
  if (!itemId) return null;
  if (tints.has(itemId)) return tints.get(itemId)!;
  const def = getItem(itemId);
  let tint: number | null = def.look ?? null;
  try {
    const path = icon16Path(def.icon);
    if (hasTex(path) && typeof document !== "undefined") {
      const src = tex(path).source.resource as CanvasImageSource & { width: number; height: number };
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(src, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const px: [number, number, number, number][] = [];
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 200) continue;
          const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
          // Outline pixels are near-black: never part of the colour.
          if (lum > 40) px.push([d[i], d[i + 1], d[i + 2], lum]);
        }
        if (px.length >= 4) {
          px.sort((a, b) => b[3] - a[3]);
          const top = px.slice(0, Math.max(3, Math.ceil(px.length * 0.45)));
          const avg = [0, 1, 2].map((k) => top.reduce((s, p) => s + p[k], 0) / top.length);
          const m = Math.max(...avg, 1);
          const [r, g, b] = avg.map((v) => Math.round(Math.min(255, (v / m) * 255)));
          tint = (r << 16) | (g << 8) | b;
        }
      }
    }
  } catch {
    /* unreadable icon: keep `look` */
  }
  tints.set(itemId, tint);
  return tint;
}
