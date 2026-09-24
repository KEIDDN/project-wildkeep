import { useEffect, useRef, useState, type RefObject } from "react";
import { getGame } from "../../engine/gameInstance";

/** The player's on-screen box (CSS px), with a little breathing room. */
export function playerScreenBox(pad = 14): { left: number; top: number; right: number; bottom: number } | null {
  const g = getGame();
  if (!g?.player || !g.area) return null;
  const c = g.camera.worldToScreen(g.player.x, g.player.y - 14);
  const hw = 11 * g.camera.zoom + pad;
  const hh = 20 * g.camera.zoom + pad;
  return { left: c.x - hw, top: c.y - hh, right: c.x + hw, bottom: c.y + hh };
}

/**
 * True while the element would cover the player's character. Polled a few
 * times a second (never per frame) so HUD cards can step aside — tip cards
 * flip sides, the objective box fades, the prompt moves up.
 */
export function useAvoidPlayer(ref: RefObject<HTMLElement | null>, enabled = true): boolean {
  const [overlap, setOverlap] = useState(false);
  const avoiding = useRef(false);
  // Where the element sits when it isn't stepping aside (measured then).
  const home = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      const el = ref.current;
      const p = playerScreenBox();
      if (!el || !p) return;
      if (!avoiding.current || !home.current) {
        const r = el.getBoundingClientRect();
        home.current = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }
      const box = home.current;
      const hit = box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top;
      avoiding.current = hit;
      setOverlap((prev) => (prev === hit ? prev : hit));
    };
    check();
    const id = setInterval(check, 150);
    return () => clearInterval(id);
  }, [ref, enabled]);
  return overlap;
}
