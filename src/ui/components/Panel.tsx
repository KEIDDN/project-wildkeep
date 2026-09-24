import type { ReactNode } from "react";
import { useUiStore } from "../../store/uiStore";
import { audio } from "../../game/audio/AudioManager";

interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
  width?: number;
  onClose?: (() => void) | null;
  className?: string;
}

/** Parchment window built from the UI pack's 9-slice frame. */
export function Panel({ title, subtitle, icon, children, width = 520, onClose, className }: PanelProps) {
  const close =
    onClose === null
      ? null
      : (onClose ??
        (() => {
          audio.sfx("ui");
          useUiStore.getState().closePanel();
        }));
  return (
    <div className="panel-backdrop" onMouseDown={() => close?.()}>
      <div className={`panel ${className ?? ""}`} style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
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
