import { useEffect, useState } from "react";
import { useInputDevice } from "../../game/input/gamepad";
import { t } from "../../i18n";
import { navHints, useNavVersion } from "./padNav";
import { Glyph } from "../components/Glyph";

/**
 * "✕ Select · ○ Back · L1/R1 Menus" along the bottom while a window is open
 * and the controller is in hand. Nothing at all for keyboard players.
 */
export function PadHints() {
  const pad = useInputDevice();
  useNavVersion();
  // Windows change their own hints (carrying an item…) without telling us.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (pad.device !== "gamepad") return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [pad.device]);
  if (pad.device !== "gamepad") return null;
  const hints = navHints({ select: t("pad.select"), back: t("pad.back"), tabs: t("pad.tabs"), pages: t("pad.pages"), scroll: t("pad.scroll") });
  if (!hints.length) return null;
  return (
    <div className={`pad-hints fam-${pad.family}`}>
      {hints.map((h) => (
        <span key={h.codes.join() + h.label} className="pad-hint">
          {h.codes.map((c) => (
            <Glyph key={c} code={c} />
          ))}
          {h.label}
        </span>
      ))}
    </div>
  );
}
