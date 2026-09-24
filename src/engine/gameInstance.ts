import type { Game } from "./Game";

/** The running Game, for the few UI actions that need the engine directly
 * (respawn, dungeon exit). Most UI talks to stores instead. */
let current: Game | null = null;

export function setGameInstance(g: Game | null): void {
  current = g;
}

export function getGame(): Game | null {
  return current;
}
