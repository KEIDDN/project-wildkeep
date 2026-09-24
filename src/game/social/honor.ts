import { useSocialStore } from "../../store/socialStore";
import { useUiStore } from "../../store/uiStore";
import { t } from "../../i18n";
import { showTutorial } from "../tutorial";

/**
 * Honor: what Wildkeep thinks of you, from −100 (menace) to +100 (local
 * hero). It changes prices, dialogue and a few opportunities — never whether
 * you're allowed to play. Both ends are fun.
 */
export type HonorRank = "villain" | "shady" | "neutral" | "liked" | "hero";

export function honorRank(honor: number): HonorRank {
  if (honor <= -50) return "villain";
  if (honor <= -15) return "shady";
  if (honor < 15) return "neutral";
  if (honor < 50) return "liked";
  return "hero";
}

/** Multiplier on shop buy prices (heroes get a discount, menaces a markup). */
export function buyPriceFactor(honor: number): number {
  if (honor >= 50) return 0.9;
  if (honor >= 15) return 0.95;
  if (honor <= -50) return 1.3;
  if (honor <= -15) return 1.12;
  return 1;
}

/** Multiplier on what honest merchants pay you. */
export function sellPriceFactor(honor: number): number {
  if (honor >= 50) return 1.08;
  if (honor <= -50) return 0.85;
  return 1;
}

/** Changes Honor with a small floating notice. Returns the applied delta. */
export function adjustHonor(delta: number): number {
  const applied = useSocialStore.getState().changeHonor(delta);
  if (applied !== 0) {
    useUiStore.getState().pushToast(applied > 0 ? t("honor.up", { n: applied }) : t("honor.down", { n: -applied }), applied > 0 ? "levelup" : "warning", { icon: "clover" });
    showTutorial("honor");
  }
  return applied;
}

export function currentHonor(): number {
  return useSocialStore.getState().honor;
}
