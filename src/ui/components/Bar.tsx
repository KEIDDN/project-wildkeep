interface BarProps {
  value: number;
  max: number;
  kind: "hp" | "xp" | "boss";
  label?: string;
  height?: number;
}

/** Chunky pixel bar with a trailing "damage ghost" handled by CSS transition. */
export function Bar({ value, max, kind, label, height = 14 }: BarProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar bar-${kind}`} style={{ height }}>
      <div className="bar-ghost" style={{ width: `${pct}%` }} />
      <div className="bar-fill" style={{ width: `${pct}%` }} />
      {label && <span className="bar-label">{label}</span>}
    </div>
  );
}
