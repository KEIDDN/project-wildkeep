import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "../components/Panel";
import { REGIONS, REGION_BY_ID, regionOfArea, type RegionDef, type RegionId, type RegionStatus } from "../../data/world";
import { TOWN_COLS, TOWN_LANDMARKS, TOWN_ROWS, type TownLandmark } from "../../data/townMap";
import { MAP_H, MAP_W, drawWorldMap } from "../map/drawWorldMap";
import { TOWN_PX, drawTownMap } from "../map/drawTownMap";
import { allRegionStatus } from "../../game/world";
import { useWorldStore } from "../../store/worldStore";
import { useDungeonStore } from "../../store/dungeonStore";
import { useTimeStore } from "../../store/timeStore";
import { getGame } from "../../engine/gameInstance";
import { TILE } from "../../game/core/constants";
import { keyLabel } from "../../game/input/bindings";
import { t, tDyn } from "../../i18n";

/**
 * The world map (M). Two sheets: the wider world — regions, roads, fog over
 * what you haven't found, "?" for places you've only heard of — and a plan
 * of Wildkeep itself. Hover (or click) a place for what's there.
 */
export function MapPanel() {
  const area = useWorldStore((s) => s.area);
  const surface = useDungeonStore((s) => s.surface.area);
  const inTown = ["town", "house", "shop", "forge", "tavern"].includes(area);
  const [sheet, setSheet] = useState<"world" | "town">("world");
  const day = useTimeStore((s) => s.day);
  const here = regionOfArea(area, surface);
  return (
    <Panel title={t("map.title")} subtitle={t("map.subtitle", { place: tDyn(`map.region.${here}.name`), day })} icon="map_scroll" width={1060} className="map-panel">
      <div className="tabs">
        <button type="button" className={`tab${sheet === "world" ? " active" : ""}`} onClick={() => setSheet("world")}>
          {t("map.tabWorld")}
        </button>
        <button type="button" className={`tab${sheet === "town" ? " active" : ""}`} onClick={() => setSheet("town")}>
          {t("map.tabTown")}
        </button>
      </div>
      {sheet === "world" ? <WorldSheet here={here} /> : <TownSheet inTown={inTown} area={area} />}
      <div className="map-foot">
        <span className="map-legend">
          <i className="lg lg-here" /> {t("map.legend.here")}
          <i className="lg lg-visited" /> {t("map.legend.visited")}
          <i className="lg lg-open" /> {t("map.legend.open")}
          <i className="lg lg-rumoured" /> {t("map.legend.rumoured")}
        </span>
        <span className="map-close-hint">
          <kbd>{keyLabel("map")}</kbd> / <kbd>Esc</kbd> {t("map.close")}
        </span>
      </div>
    </Panel>
  );
}

function WorldSheet({ here }: { here: RegionId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const status = useMemo(() => allRegionStatus(), []);
  const [focus, setFocus] = useState<RegionId>(here);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let frame = 0;
    drawWorldMap(ctx, { status, frame });
    // Water shimmers a little; the rest is static.
    const id = setInterval(() => drawWorldMap(ctx, { status, frame: ++frame * 8 }), 400);
    return () => clearInterval(id);
  }, [status]);

  const shown = REGIONS.filter((r) => status[r.id] !== "hidden");
  const f = REGION_BY_ID[focus];
  return (
    <div className="map-body">
      <div className="map-frame" onMouseLeave={() => setFocus(here)}>
        <canvas ref={canvas} width={MAP_W} height={MAP_H} className="map-canvas" />
        {shown.map((r) => (
          <RegionMarker key={r.id} r={r} status={status[r.id]} here={r.id === here} focused={r.id === focus} onFocus={() => setFocus(r.id)} />
        ))}
        <div className="map-compass">
          <span>{t("map.north")}</span>
        </div>
      </div>
      <RegionCard r={f} status={status[f.id]} here={f.id === here} />
    </div>
  );
}

function RegionMarker({ r, status, here, focused, onFocus }: { r: RegionDef; status: RegionStatus; here: boolean; focused: boolean; onFocus: () => void }) {
  const known = status === "visited" || status === "open";
  const small = r.kind === "home" || r.kind === "dungeon" || (r.kind === "settlement" && !r.major);
  return (
    <button
      type="button"
      className={`map-marker st-${status}${r.major ? " major" : ""}${small ? " small" : ""}${here ? " here" : ""}${focused ? " focused" : ""}`}
      style={{ left: `${(r.x / MAP_W) * 100}%`, top: `${(r.y / MAP_H) * 100}%` }}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onFocus}
    >
      {here && <span className="map-here" />}
      <span className="map-medallion">
        <img src={`/icons/${known ? r.icon : "map_unknown"}.png`} alt="" />
      </span>
      {(r.major || here || focused) && <span className="map-label">{known || status === "rumoured" ? tDyn(`map.region.${r.id}.name`) : "???"}</span>}
    </button>
  );
}

function RegionCard({ r, status, here }: { r: RegionDef; status: RegionStatus; here: boolean }) {
  const known = status === "visited" || status === "open";
  return (
    <aside className={`map-card st-${status}`}>
      <div className="map-card-head">
        <img src={`/icons/${known ? r.icon : "map_unknown"}.png`} alt="" />
        <div>
          <b>{tDyn(`map.region.${r.id}.name`)}</b>
          <small className={`map-status st-${status}`}>{here ? t("map.status.here") : t(`map.status.${status === "hidden" ? "rumoured" : status}`)}</small>
        </div>
      </div>
      <p className="map-card-text">{known ? tDyn(`map.region.${r.id}.desc`) : tDyn(`map.region.${r.id}.rumour`)}</p>
      {known && r.tags && (
        <div className="map-tags">
          {r.tags.map((tag) => (
            <span key={tag} className={`map-tag tag-${tag}`}>
              {tDyn(`map.tag.${tag}`)}
            </span>
          ))}
        </div>
      )}
      {r.kind === "frontier" && <p className="map-card-note">{t("map.frontierNote")}</p>}
    </aside>
  );
}

function TownSheet({ inTown, area }: { inTown: boolean; area: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    if (canvas.current) drawTownMap(canvas.current.getContext("2d")!);
  }, []);
  // Where you stand: your exact spot outdoors, the building's door inside.
  const you = useMemo(() => {
    if (!inTown) return null;
    if (area === "town") {
      const p = getGame()?.player;
      return p ? { x: p.x / TILE, y: p.y / TILE } : null;
    }
    const lm = TOWN_LANDMARKS.find((l) => l.areas?.includes(area));
    return lm ? { x: lm.x, y: lm.y } : null;
  }, [inTown, area]);
  const focused = TOWN_LANDMARKS.find((l) => l.id === focus);
  return (
    <div className="map-body">
      <div className="map-frame town" onMouseLeave={() => setFocus(null)}>
        <canvas ref={canvas} width={TOWN_COLS * TOWN_PX} height={TOWN_ROWS * TOWN_PX} className="map-canvas" />
        {TOWN_LANDMARKS.map((l) => (
          <TownMarker key={l.id} l={l} focused={l.id === focus} onFocus={() => setFocus(l.id)} />
        ))}
        {you && <span className="map-you" style={{ left: `${(you.x / TOWN_COLS) * 100}%`, top: `${(you.y / TOWN_ROWS) * 100}%` }} />}
      </div>
      <aside className="map-card">
        {focused ? (
          <>
            <div className="map-card-head">
              <img src={`/icons/${focused.icon}.png`} alt="" />
              <div>
                <b>{tDyn(`map.town.${focused.id}.name`)}</b>
              </div>
            </div>
            <p className="map-card-text">{tDyn(`map.town.${focused.id}.desc`)}</p>
          </>
        ) : (
          <>
            <div className="map-card-head">
              <img src="/icons/map_house.png" alt="" />
              <div>
                <b>{t("map.region.wildkeep.name")}</b>
                <small className="map-status st-visited">{inTown ? t("map.status.here") : t("map.status.visited")}</small>
              </div>
            </div>
            <p className="map-card-text">{t("map.townIntro")}</p>
          </>
        )}
      </aside>
    </div>
  );
}

function TownMarker({ l, focused, onFocus }: { l: TownLandmark; focused: boolean; onFocus: () => void }) {
  return (
    <button
      type="button"
      className={`map-marker small town-marker${focused ? " focused" : ""}`}
      style={{ left: `${(l.x / TOWN_COLS) * 100}%`, top: `${(l.y / TOWN_ROWS) * 100}%` }}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onFocus}
    >
      <span className="map-medallion">
        <img src={`/icons/${l.icon}.png`} alt="" />
      </span>
      {focused && <span className="map-label">{tDyn(`map.town.${l.id}.name`)}</span>}
    </button>
  );
}
