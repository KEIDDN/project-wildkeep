import { useSyncExternalStore } from "react";
import { useSettingsStore } from "../../store/settingsStore";

/**
 * Controllers, through the browser Gamepad API. Buttons become plain binding
 * codes ("pad:a", "pad:lb", "pad:lsup"…) that live next to keyboard codes in
 * game/input/bindings.ts, so gameplay keeps asking `input.pressed("dodge")`
 * and never knows which device answered.
 *
 * Codes are positional, after the W3C "standard" layout (Xbox letters):
 * pad:a is the bottom face button — ✕ on a DualSense, A on an Xbox pad.
 * Only the labels change per family (see padLabel).
 *
 * One poll per animation frame. Each new press is routed to exactly one
 * place: the menu navigator when a window is open (ui/nav/padNav), the
 * Controls screen while it waits for a button, or the game's Input otherwise.
 */

/** Tuning, in stick units (0..1). */
export const PAD_CONFIG = {
  /** Left stick below this is treated as centred (drift). */
  moveDeadzone: 0.24,
  /** Right stick must pass this before it turns you / aims. */
  aimDeadzone: 0.5,
  /** Stick as a digital direction (bindable codes, menus). */
  stickDigital: 0.5,
  /** Menus: stick push that counts as a step. */
  navThreshold: 0.6,
  /** Analog triggers count as pressed past this. */
  triggerThreshold: 0.35,
  /** A stick push this big (or any button) makes the controller the active device. */
  wakeStick: 0.65,
  /** Held direction in menus: first repeat, then every… (seconds). */
  repeatDelay: 0.34,
  repeatRate: 0.085,
  /** Right stick scroll speed in menus (px/s at full tilt). */
  scrollSpeed: 900,
};

/** Standard-mapping button index → code suffix. 16 = PS/Guide, 17 = touchpad click (DualSense/DS4 in Chromium). */
const BUTTONS = ["a", "b", "x", "y", "lb", "rb", "lt", "rt", "select", "start", "ls", "rs", "up", "down", "left", "right", "home", "touchpad"] as const;
export type PadButton = (typeof BUTTONS)[number];
const STICK_CODES = ["pad:lsup", "pad:lsdown", "pad:lsleft", "pad:lsright"];

export type PadFamily = "playstation" | "xbox" | "generic";
export type InputDevice = "keyboard" | "gamepad";

export function isPadCode(code: string): boolean {
  return code.startsWith("pad:");
}
export function isStickCode(code: string): boolean {
  return STICK_CODES.includes(code);
}

/** Best guess from the id string. Browsers differ ("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c …)"
 * in Chromium, "054c-0ce6-DualSense Wireless Controller" in Firefox, a bare name in Safari). */
export function familyOf(id: string): PadFamily {
  const s = id.toLowerCase();
  // Xbox first: "Xbox Wireless Controller" would otherwise match the DS4's
  // bare "Wireless Controller" name. Steam Input presents its virtual pad
  // with Xbox letters.
  if (/045e|xbox|xinput|28de|steam/.test(s)) return "xbox";
  if (/054c|playstation|dualsense|dualshock|ps[345]|wireless controller/.test(s)) return "playstation";
  return "generic";
}

/** Friendly name for toasts: "DualSense", "Xbox controller"… */
export function padName(id: string): string {
  const s = id.toLowerCase();
  if (/steam|28de/.test(s)) return "Steam Controller";
  if (/xbox|045e|xinput/.test(s)) return "Xbox Controller";
  if (/dualsense|0ce6|0df2/.test(s)) return "DualSense";
  if (/dualshock|05c4|09cc|wireless controller/.test(s)) return "DualShock 4";
  const clean = id.replace(/\(.*?\)/g, "").replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, "").trim();
  return clean.slice(0, 32) || "Gamepad";
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let held = new Set<string>();
/** Held when input changed hands (menu ↔ game): ignored until released, so a
 * button that closed a window doesn't also dodge / swing on the way out. */
const suppressed = new Set<string>();
let leftStickSuppressed = false;
const stick = { lx: 0, ly: 0, rx: 0, ry: 0 };
let device: InputDevice = "keyboard";
let family: PadFamily = "generic";
let activeIndex = -1;
let connectedCount = 0;
let started = false;
let lastRoute: "menu" | "game" | null = null;

type Sink = (code: string) => void;
let gameSink: Sink | null = null;
let captureSink: ((code: string | null) => void) | null = null;

/** Menu navigator hooks, installed by ui/nav/padNav (kept as callbacks so the
 * input layer doesn't import UI code). */
interface NavHooks {
  active: () => boolean;
  press: (code: string) => boolean;
  frame: (dt: number, s: { lx: number; ly: number; rx: number; ry: number }, held: ReadonlySet<string>) => void;
}
let nav: NavHooks | null = null;
export function installNav(hooks: NavHooks): void {
  nav = hooks;
}

/** Game Input registers here to receive gameplay presses. */
export function setGameSink(fn: Sink | null): void {
  gameSink = fn;
}

/** Controls screen: the next button press goes to `fn` (Options cancels → null). */
export function capturePadButton(fn: ((code: string | null) => void) | null): void {
  captureSink = fn;
}

export function padHeld(code: string): boolean {
  return held.has(code) && !suppressed.has(code);
}

/** Left stick, radial deadzone, full speed once past it (movement feels as
 * crisp as the keyboard: no creeping on a half-tilt). */
export function padMoveVector(): { x: number; y: number } | null {
  if (leftStickSuppressed) return null;
  const m = Math.hypot(stick.lx, stick.ly);
  if (m < PAD_CONFIG.moveDeadzone) return null;
  return { x: stick.lx / m, y: stick.ly / m };
}

/** Right stick direction when it's clearly pushed, else null (keep old facing). */
export function padAimVector(): { x: number; y: number } | null {
  const m = Math.hypot(stick.rx, stick.ry);
  if (m < PAD_CONFIG.aimDeadzone) return null;
  return { x: stick.rx / m, y: stick.ry / m };
}

// ---------------------------------------------------------------------------
// Device tracking (for prompts)
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let snapshot: { device: InputDevice; family: PadFamily; connected: number; name: string } = { device, family, connected: 0, name: "" };
let padLabelName = "";
function notify() {
  snapshot = { device, family, connected: connectedCount, name: padLabelName };
  listeners.forEach((f) => f());
}
function setDevice(d: InputDevice, fam = family) {
  if (d === device && fam === family) return;
  device = d;
  family = fam;
  document.body.classList.toggle("pad-mode", d === "gamepad");
  notify();
  deviceListeners.forEach((f) => f(d));
}

const deviceListeners = new Set<(d: InputDevice) => void>();
/** Plain (non-React) subscription to keyboard ↔ controller switches. */
export function onDeviceChange(fn: (d: InputDevice) => void): () => void {
  deviceListeners.add(fn);
  return () => deviceListeners.delete(fn);
}

export const currentDevice = () => device;
export const currentFamily = () => family;
export const usingGamepad = () => device === "gamepad";

/** Re-renders when the player switches keyboard ↔ controller or plugs one in. */
export function useInputDevice() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => snapshot,
  );
}

type ConnectionListener = (e: { connected: boolean; name: string; remaining: number; wasInUse: boolean }) => void;
const connectionListeners = new Set<ConnectionListener>();
/** Toasts etc. The game subscribes while a save is loaded. */
export function onPadConnection(fn: ConnectionListener): () => void {
  connectionListeners.add(fn);
  return () => connectionListeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

function pads(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  try {
    return Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p && p.connected);
  } catch {
    // Blocked by a permissions policy: no controllers, keyboard only.
    return [];
  }
}

let lastT = 0;
function poll(now: number) {
  requestAnimationFrame(poll);
  const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 0.016);
  lastT = now;
  const list = pads();
  if (!list.length) {
    if (held.size || stick.lx || stick.ly || stick.rx || stick.ry) {
      held = new Set();
      suppressed.clear();
      stick.lx = stick.ly = stick.rx = stick.ry = 0;
    }
    return;
  }

  const next = new Set<string>();
  let best = 0;
  let woke: Gamepad | null = null;
  let lx = 0, ly = 0, rx = 0, ry = 0;
  for (const p of list) {
    for (let i = 0; i < p.buttons.length && i < BUTTONS.length; i++) {
      const b = p.buttons[i];
      // Triggers are analog: a light squeeze shouldn't fire.
      const on = i === 6 || i === 7 ? b.value > PAD_CONFIG.triggerThreshold || (b.pressed && b.value === 0) : b.pressed;
      if (!on) continue;
      const code = `pad:${BUTTONS[i]}`;
      next.add(code);
      if (!held.has(code)) woke = p;
    }
    // With several pads (or Steam's virtual twin of a real one) the most pushed stick wins.
    const [ax = 0, ay = 0, bx = 0, by = 0] = p.axes;
    const m = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));
    if (m > best) {
      best = m;
      lx = ax; ly = ay; rx = bx; ry = by;
    }
    if (m > PAD_CONFIG.wakeStick && !woke) woke = p;
  }
  stick.lx = lx; stick.ly = ly; stick.rx = rx; stick.ry = ry;
  const t = PAD_CONFIG.stickDigital;
  if (ly < -t) next.add("pad:lsup");
  if (ly > t) next.add("pad:lsdown");
  if (lx < -t) next.add("pad:lsleft");
  if (lx > t) next.add("pad:lsright");

  const edges: string[] = [];
  for (const c of next) if (!held.has(c)) edges.push(c);
  for (const c of suppressed) if (!next.has(c)) suppressed.delete(c);
  if (leftStickSuppressed && Math.hypot(lx, ly) < PAD_CONFIG.moveDeadzone) leftStickSuppressed = false;
  held = next;

  if (woke) {
    activeIndex = woke.index;
    padLabelName = padName(woke.id);
    setDevice("gamepad", familyOf(woke.id));
  }

  // Who gets the presses this frame?
  if (captureSink) {
    const code = edges.find((c) => !isStickCode(c));
    if (code) {
      const fn = captureSink;
      captureSink = null;
      fn(code === "pad:start" || code === "pad:home" ? null : code);
    }
    lastRoute = "menu";
    return;
  }
  const route = nav?.active() ? "menu" : "game";
  if (lastRoute && route !== lastRoute) {
    for (const c of held) suppressed.add(c);
    // Edges of this very frame belong to the new owner; everything older is stale.
    for (const c of edges) suppressed.delete(c);
    if (route === "game" && Math.hypot(lx, ly) >= PAD_CONFIG.moveDeadzone) leftStickSuppressed = true;
  }
  lastRoute = route;
  if (route === "menu" && nav) {
    for (const c of edges) {
      // Anything the menus don't use (Select → bag, touchpad → map…) still
      // reaches the game, which toggles those windows shut.
      if (!nav.press(c)) gameSink?.(c);
    }
    nav.frame(dt, stick, held);
  } else {
    for (const c of edges) gameSink?.(c);
  }
}

// ---------------------------------------------------------------------------
// Rumble
// ---------------------------------------------------------------------------

type Actuator = {
  playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
  pulse?: (value: number, duration: number) => Promise<unknown>;
};
let rumbleUntil = 0;
let rumbleLevel = 0;

/**
 * Standard Gamepad API rumble ("dual-rumble"; Firefox's hapticActuators as a
 * fallback). Only while the controller is the device in use, only if the
 * player hasn't turned it off, and silently nothing where unsupported.
 */
export function rumble(strong: number, weak: number, ms: number): void {
  if (device !== "gamepad" || !useSettingsStore.getState().vibration) return;
  const now = performance.now();
  const level = Math.max(strong, weak);
  // Never let a tick cut a big one short.
  if (now < rumbleUntil && level < rumbleLevel) return;
  const p = pads().find((g) => g.index === activeIndex) ?? pads()[0];
  if (!p) return;
  const g = p as Gamepad & { vibrationActuator?: Actuator | null; hapticActuators?: Actuator[] };
  try {
    const act = g.vibrationActuator;
    if (act?.playEffect) {
      void act.playEffect("dual-rumble", { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    } else if (g.hapticActuators?.[0]?.pulse) {
      void g.hapticActuators[0].pulse(level, ms)?.catch?.(() => {});
    } else return;
  } catch {
    return;
  }
  rumbleUntil = now + ms;
  rumbleLevel = level;
}

/** The few moments that deserve a buzz. Kept short and light. */
export const RUMBLE = {
  heavyHit: () => rumble(0.55, 0.35, 140),
  bigHit: () => rumble(0.3, 0.25, 90),
  hurt: () => rumble(0.7, 0.5, 180),
  parry: () => rumble(0.25, 0.8, 110),
  bite: () => rumble(0.2, 0.6, 160),
  hooked: () => rumble(0.5, 0.4, 150),
  strain: () => rumble(0, 0.28, 70),
  landed: () => rumble(0.2, 0.5, 200),
  finale: () => rumble(0.6, 0.6, 260),
  soft: () => rumble(0, 0.3, 60),
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/** Starts the poll loop and device tracking. Safe to call more than once. */
export function startGamepad(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  connectedCount = pads().length;

  window.addEventListener("gamepadconnected", (e) => {
    connectedCount = pads().length;
    const name = padName(e.gamepad.id);
    padLabelName = name;
    activeIndex = e.gamepad.index;
    // A controller that says hello is the one about to be used.
    setDevice("gamepad", familyOf(e.gamepad.id));
    notify();
    connectionListeners.forEach((f) => f({ connected: true, name, remaining: connectedCount, wasInUse: false }));
  });
  window.addEventListener("gamepaddisconnected", (e) => {
    connectedCount = pads().filter((p) => p.index !== e.gamepad.index).length;
    const wasInUse = device === "gamepad";
    // Nothing stays pressed on a pad that's gone.
    held = new Set();
    suppressed.clear();
    stick.lx = stick.ly = stick.rx = stick.ry = 0;
    if (!connectedCount) setDevice("keyboard");
    else {
      const other = pads().find((p) => p.index !== e.gamepad.index);
      if (other) {
        activeIndex = other.index;
        padLabelName = padName(other.id);
        setDevice(device, familyOf(other.id));
      }
    }
    notify();
    connectionListeners.forEach((f) => f({ connected: false, name: padName(e.gamepad.id), remaining: connectedCount, wasInUse }));
  });

  // Keyboard / mouse take prompts back — but only on deliberate use, not a
  // nudged desk. (Synthetic events from our own code aren't trusted.)
  let travel = 0;
  let travelAt = 0;
  const kb = (e: Event) => {
    if (e.isTrusted) setDevice("keyboard");
  };
  window.addEventListener("keydown", kb, true);
  window.addEventListener("mousedown", kb, true);
  window.addEventListener("wheel", kb, { capture: true, passive: true });
  window.addEventListener(
    "mousemove",
    (e) => {
      if (device !== "gamepad" || !e.isTrusted) return;
      const now = performance.now();
      if (now - travelAt > 300) travel = 0;
      travelAt = now;
      travel += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (travel > 60) setDevice("keyboard");
    },
    { passive: true },
  );
  requestAnimationFrame(poll);
}
