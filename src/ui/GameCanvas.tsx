import { useEffect, useRef, useState } from "react";
import { Game } from "../engine/Game";
import { setGameInstance } from "../engine/gameInstance";
import { useDungeonStore } from "../store/dungeonStore";
import { usePlayerStore } from "../store/playerStore";
import { useInventoryStore } from "../store/inventoryStore";
import { useUiStore } from "../store/uiStore";
import { useWorldStore } from "../store/worldStore";
import { useTimeStore } from "../store/timeStore";
import { useTutorialStore } from "../store/tutorialStore";
import { useTownStore } from "../store/townStore";
import { audio } from "../game/audio/AudioManager";
import { useMineStore } from "../store/mineStore";
import { useSocialStore } from "../store/socialStore";
import { useQuestStore } from "../store/questStore";
import { useFarmStore } from "../store/farmStore";
import { useSettingsStore } from "../store/settingsStore";

/** Mounts the Pixi game full-window. Everything else overlays it. */
export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = new Game();
    let cancelled = false;
    game
      .init(host, (p) => !cancelled && setProgress(p))
      .then(() => {
        if (cancelled) return;
        setGameInstance(game);
        setReady(true);
        // Dev-only handle for poking at the running game from the console.
        if (import.meta.env.DEV) {
          Object.assign(window, { __game: game, __audio: audio, __stores: { useMineStore, useDungeonStore, usePlayerStore, useInventoryStore, useUiStore, useWorldStore, useTimeStore, useTutorialStore, useTownStore, useSocialStore, useSettingsStore, useQuestStore, useFarmStore } });
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(String(err?.message ?? err));
      });
    const onResize = () => game.onResize();
    const ro = new ResizeObserver(() => requestAnimationFrame(onResize));
    ro.observe(host);
    return () => {
      cancelled = true;
      ro.disconnect();
      setGameInstance(null);
      game.destroy();
    };
  }, []);

  return (
    <>
      <div ref={hostRef} className="game-host" />
      {!ready && (
        <div className="loading-screen">
          <div className="loading-title">Wildkeep</div>
          {error ? (
            <div className="loading-error">Failed to start: {error}</div>
          ) : (
            <>
              <div className="loading-bar">
                <div className="loading-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="loading-hint">…</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
