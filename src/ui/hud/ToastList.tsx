import { useEffect, useRef } from "react";
import { useGameStore } from "../../store/gameStore";

export function ToastList() {
  const toasts = useGameStore((s) => s.toasts);
  const dismissToast = useGameStore((s) => s.dismissToast);
  const scheduled = useRef(new Set<number>());

  useEffect(() => {
    for (const t of toasts) {
      if (scheduled.current.has(t.id)) continue;
      scheduled.current.add(t.id);
      setTimeout(() => {
        scheduled.current.delete(t.id);
        dismissToast(t.id);
      }, 3200);
    }
  }, [toasts, dismissToast]);

  return (
    <div className="toast-list">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
