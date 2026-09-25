import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { audio } from "../../game/audio/AudioManager";

export interface MenuAction {
  label: string;
  icon?: string;
  onSelect: () => void;
  /** Visually set apart (e.g. the main action). */
  primary?: boolean;
}

export interface MenuState {
  x: number;
  y: number;
  title?: string;
  actions: MenuAction[];
}

/**
 * Small right-click menu. Opens at the cursor (kept on screen), closes on
 * any outside press, Escape, wheel, or after picking something.
 */
export function ContextMenu({ menu, onClose }: { menu: MenuState | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu) return setPos(null);
    const el = ref.current;
    const w = el?.offsetWidth ?? 160;
    const h = el?.offsetHeight ?? 100;
    setPos({ x: Math.min(menu.x, window.innerWidth - w - 8), y: Math.min(menu.y, window.innerHeight - h - 8) });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      // Capture phase: Escape closes the menu only, not the window under it.
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Let the opening right-click finish before listening.
    const id = setTimeout(() => {
      window.addEventListener("pointerdown", down, true);
      window.addEventListener("wheel", onClose, true);
    }, 0);
    window.addEventListener("keydown", key, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("wheel", onClose, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  return createPortal(
    <div ref={ref} className="ctx-menu" style={{ left: pos?.x ?? menu.x, top: pos?.y ?? menu.y, visibility: pos ? "visible" : "hidden" }} onContextMenu={(e) => e.preventDefault()}>
      {menu.title && <div className="ctx-title">{menu.title}</div>}
      {menu.actions.map((a) => (
        <button
          type="button"
          key={a.label}
          className={`ctx-item${a.primary ? " primary" : ""}`}
          onClick={() => {
            audio.sfx("ui");
            onClose();
            a.onSelect();
          }}
        >
          {a.icon && <img src={`/icons/${a.icon}.png`} alt="" />}
          {a.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
