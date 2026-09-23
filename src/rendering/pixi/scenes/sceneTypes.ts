import type { Container } from "pixi.js";

export type InteractableKind =
  | "building"
  | "resourceNode"
  | "enemy"
  | "chest"
  | "exit";

export interface Interactable {
  id: string;
  x: number; // world px, center
  y: number;
  radius: number;
  kind: InteractableKind;
  label: string;
  data: unknown;
  disabled?: boolean;
}

export interface WorldSceneHandle {
  container: Container;
  widthPx: number;
  heightPx: number;
  isWalkable: (x: number, y: number) => boolean;
  interactables: Interactable[];
  update: (deltaSec: number) => void;
  destroy: () => void;
}
