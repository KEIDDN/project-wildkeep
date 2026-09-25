import { useEffect, useRef, useState } from "react";
import { getGame } from "../../engine/gameInstance";
import { t } from "../../i18n";

/**
 * The tug: line tension (needle over a green zone), how close the fish is
 * to landing, and which way it's running. Polled every frame straight from
 * the player (no React state per frame); only mounting/unmounting re-renders.
 */
export function FishingMeter() {
  const [active, setActive] = useState(false);
  const needle = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let shown = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const fight = getGame()?.player?.fishFight ?? null;
      if (!!fight !== shown) {
        shown = !!fight;
        setActive(shown);
      }
      if (!fight || !needle.current) return;
      const tn = Math.min(100, fight.tension);
      needle.current.style.left = `${tn}%`;
      zone.current!.style.left = `${fight.tune.lo}%`;
      zone.current!.style.width = `${fight.tune.hi - fight.tune.lo}%`;
      progress.current!.style.width = `${Math.min(100, fight.progress)}%`;
      const inZone = tn >= fight.tune.lo && tn <= fight.tune.hi;
      const run = fight.run;
      const b = box.current!;
      b.classList.toggle("in-zone", inZone);
      b.classList.toggle("danger", tn > 85);
      b.classList.toggle("slack", fight.slack > 0.3);
      b.classList.toggle("reeling", fight.reeling);
      for (const [el, dir] of [
        [left.current!, -1],
        [right.current!, 1],
      ] as const) {
        const running = !!run && run.dir === dir;
        el.classList.toggle("warn", running && run!.warn > 0);
        el.classList.toggle("run", running && run!.warn <= 0);
        // The key to press is the other way: light it when you're leaning right.
        el.classList.toggle("lean", !!run && run.dir === -dir && fight.lean === dir);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!active) return null;
  return (
    <div className="fish-meter" ref={box}>
      <div className="fish-title">{t("fish.unknown")}</div>
      <div className="fish-row">
        <span className="fish-arrow" ref={left}>
          ◀
        </span>
        <div className="fish-track" title={t("fish.tension")}>
          <div className="fish-zone" ref={zone} />
          <div className="fish-red" />
          <div className="fish-needle" ref={needle} />
        </div>
        <span className="fish-arrow" ref={right}>
          ▶
        </span>
      </div>
      <div className="fish-progress">
        <div ref={progress} />
      </div>
      <div className="fish-hint">{t("fish.hint")}</div>
    </div>
  );
}
