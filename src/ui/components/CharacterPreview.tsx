import { useEffect, useRef } from "react";
import { getItem } from "../../data/items";
import type { EquipmentSaveState } from "../../game/save/schema";

/** Mask rows in /sprites/player/*_mask.png (see tools/build_player.py). */
const LAYER_ROWS = { armor: 0, boots: 1, helmet: 2, metal: 3 } as const;
const FRAME = 64;

const images = new Map<string, HTMLImageElement>();
function image(src: string): HTMLImageElement {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    images.set(src, img);
  }
  return img;
}

/**
 * "This is my character and this is what I'm wearing": the player sprite,
 * idling, with each worn piece's equipment layer tinted exactly as it is
 * in the world. Plain 2D canvas, redrawn a few times a second while open.
 */
export function CharacterPreview({ equipment, scale = 3 }: { equipment: EquipmentSaveState; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const tmp = (scratch.current ??= document.createElement("canvas"));
    tmp.width = tmp.height = FRAME;
    const tctx = tmp.getContext("2d")!;
    const body = image("/sprites/player/idle_down.png");
    const weaponIcon = equipment.weapon ? image(`/icons16/${getItem(equipment.weapon).icon}.png`) : null;
    const mask = image("/sprites/player/idle_down_mask.png");
    const look = (id?: string) => (id ? (getItem(id).look ?? null) : null);
    const layers: [keyof typeof LAYER_ROWS, number | null][] = [
      ["armor", look(equipment.armor)],
      ["boots", look(equipment.boots)],
      ["helmet", look(equipment.head)],
    ];
    let frame = 0;
    const draw = () => {
      if (!body.complete || !mask.complete) return;
      ctx.clearRect(0, 0, FRAME, FRAME);
      // The weapon on your back, behind you (as in the world).
      if (weaponIcon?.complete) {
        ctx.save();
        ctx.translate(FRAME / 2 + 4, FRAME * 0.75 - 13);
        ctx.rotate(0.2);
        ctx.drawImage(weaponIcon, -7, -7, 13, 13);
        ctx.restore();
      }
      ctx.drawImage(body, frame * FRAME, 0, FRAME, FRAME, 0, 0, FRAME, FRAME);
      for (const [layer, tint] of layers) {
        if (tint === null) continue;
        // Grey shading × tint, clipped back to the mask's shape.
        tctx.globalCompositeOperation = "source-over";
        tctx.clearRect(0, 0, FRAME, FRAME);
        tctx.drawImage(mask, frame * FRAME, LAYER_ROWS[layer] * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME);
        tctx.globalCompositeOperation = "multiply";
        tctx.fillStyle = `#${tint.toString(16).padStart(6, "0")}`;
        tctx.fillRect(0, 0, FRAME, FRAME);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(mask, frame * FRAME, LAYER_ROWS[layer] * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME);
        ctx.drawImage(tmp, 0, 0);
      }
    };
    body.onload = mask.onload = draw;
    if (weaponIcon) weaponIcon.onload = draw;
    draw();
    const id = setInterval(() => {
      frame = (frame + 1) % 4;
      draw();
    }, 170);
    return () => clearInterval(id);
  }, [equipment]);

  // The body occupies the middle of its 64px frame; crop to it.
  return (
    <div className="char-preview" style={{ width: 32 * scale, height: 40 * scale }}>
      <canvas ref={ref} width={FRAME} height={FRAME} style={{ width: FRAME * scale, height: FRAME * scale, left: -16 * scale, top: -10 * scale }} />
    </div>
  );
}
