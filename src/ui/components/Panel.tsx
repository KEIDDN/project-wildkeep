import { useRef, type ReactNode } from "react";
import { useUiStore } from "../../store/uiStore";
import { audio } from "../../game/audio/AudioManager";
import { MENU_PAGES, useNavLayer, type NavOptions } from "../nav/padNav";
import { MenuStrip } from "./MenuStrip";

interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
  width?: number;
  onClose?: (() => void) | null;
  className?: string;
  /** Controller extras for this window (see ui/nav/padNav). Plain buttons work without any. */
  nav?: NavOptions;
}

/** Parchment window built from the UI pack's 9-slice frame. */
export function Panel({ title, subtitle, icon, children, width = 520, onClose, className, nav }: PanelProps) {
  const close =
    onClose === null
      ? null
      : (onClose ??
        (() => {
          audio.sfx("ui");
          useUiStore.getState().closePanel();
        }));
  const ref = useRef<HTMLDivElement>(null);
  const active = useUiStore((s) => s.activePanel);
  const page = !!active && MENU_PAGES.includes(active);
  // ○ / B closes like the ✕ (or does nothing on windows that can't be closed).
  useNavLayer(ref, { onCancel: close, pages: page, ...nav });
  return (
    <div className="panel-backdrop" onMouseDown={() => close?.()}>
      <div ref={ref} className={`panel ${className ?? ""}`} style={{ width: page ? Math.max(width, 640) : width }} onMouseDown={(e) => e.stopPropagation()}>
        {page && <MenuStrip current={active} />}
        <div className="panel-title">
          {icon && <img className="panel-title-icon" src={`/icons/${icon}.png`} alt="" />}
          <div>
            <div className="panel-title-text">{title}</div>
            {subtitle && <div className="panel-subtitle">{subtitle}</div>}
          </div>
          {close && (
            <button className="panel-close" onClick={close} aria-label="Close" type="button">
              ✕
            </button>
          )}
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}
