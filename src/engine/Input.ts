import { bindingOf, codeOf, type Action } from "../game/input/bindings";

/**
 * Keyboard/mouse state for the game loop. Held inputs are polled each frame;
 * one-shot presses are queued so a quick tap between frames isn't lost.
 *
 * Gameplay reads *actions* (`held("attack")`, `pressed("dodge")`), which
 * resolve through the player's bindings (game/input/bindings.ts). Mouse
 * buttons are plain codes ("mouse0", "mouse2") so they can be bound too.
 */
export class Input {
  private heldCodes = new Set<string>();
  private pressedCodes = new Set<string>();
  /** Cursor position in canvas (CSS) pixels, and whether it's over the canvas. */
  mouseX = 0;
  mouseY = 0;
  mouseInside = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    const k = codeOf(e);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "tab"].includes(k)) e.preventDefault();
    if (!this.heldCodes.has(k)) this.pressedCodes.add(k);
    this.heldCodes.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.heldCodes.delete(codeOf(e));
  };
  private onBlur = () => {
    this.heldCodes.clear();
  };
  private onMouseDown = (e: MouseEvent) => {
    this.trackMouse(e);
    const code = `mouse${e.button}`;
    this.pressedCodes.add(code);
    this.heldCodes.add(code);
  };
  private onMouseMove = (e: MouseEvent) => this.trackMouse(e);
  private onMouseLeave = () => {
    this.mouseInside = false;
  };
  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private trackMouse(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - r.left;
    this.mouseY = e.clientY - r.top;
    this.mouseInside = true;
  }
  private onMouseUp = (e: MouseEvent) => {
    this.heldCodes.delete(`mouse${e.button}`);
  };

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mouseleave", this.onMouseLeave);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  /** Is the action held right now? */
  held(action: Action): boolean {
    return bindingOf(action).some((c) => this.heldCodes.has(c));
  }

  /** True once per physical press of any of the action's inputs. */
  pressed(action: Action): boolean {
    return bindingOf(action).some((c) => this.pressedCodes.has(c));
  }

  /** Was the action triggered this frame by a mouse button (so it aims at the cursor)? */
  pressedByMouse(action: Action): boolean {
    return bindingOf(action).some((c) => c.startsWith("mouse") && this.pressedCodes.has(c));
  }

  /** Raw code checks, for the few fixed keys (Escape, the dev console). */
  codePressed(code: string): boolean {
    return this.pressedCodes.has(code);
  }

  /** Movement vector from the four move actions, normalized. */
  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.held("moveUp")) y -= 1;
    if (this.held("moveDown")) y += 1;
    if (this.held("moveLeft")) x -= 1;
    if (this.held("moveRight")) x += 1;
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  endFrame(): void {
    this.pressedCodes.clear();
  }

  clear(): void {
    this.heldCodes.clear();
    this.pressedCodes.clear();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("mouseup", this.onMouseUp);
  }
}

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}
