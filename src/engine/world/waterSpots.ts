import type { Area } from "./Area";
import { InteractSpot } from "../entities/Props";
import { canWater, hasCan, refillCan } from "../../game/farming";
import { CAN_SIZE } from "../../store/farmStore";
import { audio } from "../../game/audio/AudioManager";
import { t } from "../../i18n";

/** Somewhere to fill the watering can (only shows up if you carry one). */
export function waterSpot(area: Area, x: number, y: number, radius = 16): void {
  area.add(
    new InteractSpot(
      x,
      y,
      () => (hasCan() ? { verb: t("farm.refill"), target: `${t("farm.barrel")} (${canWater()}/${CAN_SIZE})` } : null),
      (g) => {
        if (!refillCan()) {
          g.ui.pushToast(t("farm.alreadyFull"), "info", { icon: "watering_can" });
          return;
        }
        g.fx.burst(x, y - 10, "crystal", 10, { speed: 20, up: 20, life: 0.5 });
        audio.sfx("potion", { pitch: 0.9 });
        g.ui.pushToast(t("farm.refilled"), "info", { icon: "watering_can" });
      },
      { radius, priority: 2 },
    ),
  );
}
