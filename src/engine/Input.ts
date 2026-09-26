import { bindingFor, bindingOf, codeOf, type Action } from "../game/input/bindings";
import { padAimVector, padHeld, padMoveVector, setGameSink, usingGamepad } from "../game/input/gamepad";

/**
 * Keyboard, mouse and controller state for the game loop. Held inputs are
 * polled each frame; one-shot presses are queued so a quick tap between
 * frames isn't lost.
 *
 * Gameplay reads *actions* (`held("attack")`, `pressed("dodge")`), which
 * resolve through the player's bindings (game/input/bindings.ts). Mouse
 * buttons ("mouse0") and controller buttons ("pad:x") are plain codes too, so
 * every device can be bound and nothing downstream cares which one it was.
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
    // Controller presses arrive from the gamepad poller (only while no window is open).
    setGameSink((code) => this.pressedCodes.add(code));
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
    return bindingOf(action).some((c) => this.heldCodes.has(c) || padHeld(c));
  }

  /** True once per physical press of any of the action's inputs. */
  pressed(action: Action): boolean {
    return bindingOf(action).some((c) => this.pressedCodes.has(c));
  }

  /** Eat this frame's press of the action (it was used for something else). */
  consume(action: Action): void {
    for (const c of bindingOf(action)) this.pressedCodes.delete(c);
  }

  /** Was the action triggered this frame by a mouse button (so it aims at the cursor)? */
  pressedByMouse(action: Action): boolean {
    return bindingOf(action).some((c) => c.startsWith("mouse") && this.pressedCodes.has(c));
  }

  /** Raw code checks, for the few fixed keys (Escape, the dev console). */
  codePressed(code: string): boolean {
    return this.pressedCodes.has(code);
  }

  /** Movement vector from the four move actions, normalized. The left stick
   * (when it's bound to movement) steers in any direction, not just eight. */
  axis(): { x: number; y: number } {
    if (bindingFor("moveUp", "gamepad").includes("pad:lsup")) {
      const stick = padMoveVector();
      if (stick) return stick;
    }
    let x = 0;
    let y = 0;
    if (this.held("moveUp")) y -= 1;
    if (this.held("moveDown")) y += 1;
    if (this.held("moveLeft")) x -= 1;
    if (this.held("moveRight")) x += 1;
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  /** Right-stick aim, if it's pushed (null: keep keyboard facing behaviour). */
  aim(): { x: number; y: number } | null {
    return padAimVector();
  }

  /** Is the mouse the thing aiming right now (not a controller left idle over the canvas)? */
  get mouseAims(): boolean {
    return this.mouseInside && !usingGamepad();
  }

  endFrame(): void {
    this.pressedCodes.clear();
  }

  clear(): void {
    this.heldCodes.clear();
    this.pressedCodes.clear();
  }

  destroy(): void {
    setGameSink(null);
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
