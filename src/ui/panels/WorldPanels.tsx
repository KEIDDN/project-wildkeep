import { useUiStore } from "../../store/uiStore";
import { useWorldStore } from "../../store/worldStore";
import { useMineStore } from "../../store/mineStore";
import { MINE_LIFT_EVERY, mineFloorProfile } from "../../data/mineFloors";
import { getGame } from "../../engine/gameInstance";
import { Panel } from "../components/Panel";
import { mineBandName } from "../../i18n/content";
import { t } from "../../i18n";

/** The mine lift: ride to any stop you've reached (every 5 floors). */
export function MineLiftPanel() {
  const checkpoint = useWorldStore((s) => s.progress.mineCheckpoint);
  const deepest = useWorldStore((s) => s.progress.mineDeepest);
  const stops = [1];
  for (let f = MINE_LIFT_EVERY; f <= checkpoint; f += MINE_LIFT_EVERY) stops.push(f);
  const ride = (floor: number) => {
    useUiStore.getState().closePanel();
    // A new expedition: fresh caves from the chosen stop.
    useMineStore.getState().start(floor);
    getGame()?.requestTravel("mine", "entrance");
  };
  return (
    <Panel title={t("mine.liftTitle")} subtitle={t("mine.liftSub", { n: deepest || 1, every: MINE_LIFT_EVERY })} icon="pickaxe_iron" width={460}>
      <div className="row-list">
        {stops.map((f) => (
          <div className="shop-row" key={f}>
            <div className="shop-row-name">
              <span>{t("common.floor", { n: f })}</span>
              <small>{mineBandName(mineFloorProfile(f).name)}</small>
            </div>
            <button type="button" className="btn btn-small" onClick={() => ride(f)}>
              {t("mine.ride")}
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
