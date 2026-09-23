interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
  label?: string;
  height?: number;
}

export function ProgressBar({ value, max, color, label, height = 14 }: ProgressBarProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="pbar" style={{ height }}>
      <div className="pbar-fill" style={{ width: `${pct}%`, background: color }} />
      {label && <span className="pbar-label">{label}</span>}
    </div>
  );
}
