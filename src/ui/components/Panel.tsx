import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
}

export function Panel({ title, onClose, children, width = 420 }: PanelProps) {
  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <span>{title}</span>
          {onClose && (
            <button className="panel-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}
