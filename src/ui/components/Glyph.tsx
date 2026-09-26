import { Fragment } from "react";
import type { Action } from "../../game/input/bindings";
import { GLYPH_CLOSE, GLYPH_OPEN, glyphOfAction, glyphOfCode, type Glyph as G, type GlyphDir } from "../../game/input/glyphs";
import { useInputDevice } from "../../game/input/gamepad";

const BODY = "#241d2b";
const EDGE = "#0d0a10";
const INK = "#f5ecd6";
const HOT = "#ffd54f";

/**
 * An input, drawn: a keycap for keyboard, the actual button for a controller
 * (✕○□△ in PlayStation colours, A/B/X/Y for Xbox, a d-pad with the pressed arm
 * lit…). Give it the logical `action` and it follows the device in use; give
 * it a `code` for a fixed button (menus).
 */
export function Glyph({ action, code, size = 1.4, className }: { action?: Action; code?: string; size?: number; className?: string }) {
  const dev = useInputDevice();
  const g = code ? glyphOfCode(code, dev.family) : action ? glyphOfAction(action) : ({ kind: "none" } as G);
  return <GlyphView g={g} size={size} className={className} />;
}

export function GlyphView({ g, size = 1.4, className }: { g: G; size?: number; className?: string }) {
  const cls = `glyph glyph-${g.kind}${className ? ` ${className}` : ""}`;
  const h = `${size}em`;
  switch (g.kind) {
    case "none":
      return <kbd className={cls}>—</kbd>;
    case "key":
      return <kbd className={cls}>{g.label}</kbd>;
    case "mouse":
      return (
        <svg className={cls} viewBox="0 0 14 20" style={{ height: h }} aria-label={`mouse ${g.button}`}>
          <rect x="1" y="1" width="12" height="18" rx="6" fill={BODY} stroke={EDGE} />
          <path d={g.button === 2 ? "M7 1.5 A5.5 5.5 0 0 1 12.5 7 V8.5 H7 Z" : "M7 1.5 A5.5 5.5 0 0 0 1.5 7 V8.5 H7 Z"} fill={g.button === 1 ? BODY : HOT} />
          {g.button === 1 && <rect x="6" y="3" width="2" height="4" rx="1" fill={HOT} />}
          <line x1="7" y1="1.5" x2="7" y2="8.5" stroke={EDGE} />
        </svg>
      );
    case "face":
      return (
        <svg className={cls} viewBox="0 0 20 20" style={{ height: h }} aria-label={g.shape ?? g.label}>
          <circle cx="10" cy="10" r="9" fill={BODY} stroke={EDGE} strokeWidth="1.2" />
          {g.shape === "cross" && <path d="M6.3 6.3 L13.7 13.7 M13.7 6.3 L6.3 13.7" stroke={g.color} strokeWidth="2.2" strokeLinecap="round" />}
          {g.shape === "circle" && <circle cx="10" cy="10" r="4.4" fill="none" stroke={g.color} strokeWidth="2.1" />}
          {g.shape === "square" && <rect x="5.9" y="5.9" width="8.2" height="8.2" fill="none" stroke={g.color} strokeWidth="2" />}
          {g.shape === "triangle" && <path d="M10 5.2 L14.8 13.6 H5.2 Z" fill="none" stroke={g.color} strokeWidth="2" strokeLinejoin="round" />}
          {!g.shape && (
            <text x="10" y="14.2" textAnchor="middle" fontSize="12" fontWeight="bold" fill={g.color} fontFamily="var(--font)">
              {g.label}
            </text>
          )}
        </svg>
      );
    case "bumper":
    case "trigger":
      return (
        <svg className={cls} viewBox="0 0 26 20" style={{ height: h }} aria-label={g.label}>
          <path d={g.kind === "trigger" ? "M3 19 V9 Q3 2 13 2 Q23 2 23 9 V19 Z" : "M2 17 V9 Q2 5 8 5 H18 Q24 5 24 9 V17 Z"} fill={BODY} stroke={EDGE} strokeWidth="1.2" />
          <text x="13" y={g.kind === "trigger" ? 15.5 : 15} textAnchor="middle" fontSize="10.5" fontWeight="bold" fill={INK} fontFamily="var(--font)">
            {g.label}
          </text>
        </svg>
      );
    case "dpad":
      return (
        <svg className={cls} viewBox="0 0 20 20" style={{ height: h }} aria-label={`d-pad ${g.dir ?? ""}`}>
          <path d="M7 1.5 H13 V7 H18.5 V13 H13 V18.5 H7 V13 H1.5 V7 H7 Z" fill={BODY} stroke={EDGE} strokeWidth="1.2" strokeLinejoin="round" />
          {(["up", "down", "left", "right"] as GlyphDir[]).map((d) => (
            <path key={d} d={ARM[d]} fill={g.dir === d ? HOT : "#4a4052"} />
          ))}
        </svg>
      );
    case "stick":
      return (
        <svg className={cls} viewBox="0 0 20 20" style={{ height: h }} aria-label={`${g.side} stick`}>
          <circle cx="10" cy="10" r="9" fill={BODY} stroke={EDGE} strokeWidth="1.2" />
          <circle cx="10" cy="10" r="5.6" fill="#3a3142" stroke={g.click ? HOT : "#5a4f63"} strokeWidth={g.click ? 1.4 : 1} />
          <text x="10" y="13.4" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill={INK} fontFamily="var(--font)">
            {g.click ? `${g.side}3` : g.side}
          </text>
          {g.dir && <path d={NUB[g.dir]} fill={HOT} />}
        </svg>
      );
    case "menu":
      return (
        <svg className={cls} viewBox="0 0 30 20" style={{ height: h }} aria-label={g.label}>
          <rect x="1" y="4" width="28" height="12" rx="6" fill={BODY} stroke={EDGE} strokeWidth="1.2" />
          {g.lines ? (
            <path d="M10 8 H20 M10 10 H20 M10 12 H20" stroke={INK} strokeWidth="1.2" />
          ) : (
            <text x="15" y="12.6" textAnchor="middle" fontSize="6.2" fontWeight="bold" fill={INK} fontFamily="var(--font)">
              {g.label}
            </text>
          )}
        </svg>
      );
    case "touchpad":
      return (
        <svg className={cls} viewBox="0 0 30 20" style={{ height: h }} aria-label="touchpad">
          <rect x="1.5" y="3" width="27" height="14" rx="3" fill={BODY} stroke={EDGE} strokeWidth="1.2" />
          <rect x="4" y="5.5" width="22" height="9" rx="2" fill="#3a3142" />
        </svg>
      );
  }
}

const ARM: Record<GlyphDir, string> = {
  up: "M8 3 H12 V8 H8 Z",
  down: "M8 12 H12 V17 H8 Z",
  left: "M3 8 H8 V12 H3 Z",
  right: "M12 8 H17 V12 H12 Z",
};
const NUB: Record<GlyphDir, string> = {
  up: "M10 0.4 L12.4 3 H7.6 Z",
  down: "M10 19.6 L12.4 17 H7.6 Z",
  left: "M0.4 10 L3 7.6 V12.4 Z",
  right: "M19.6 10 L17 7.6 V12.4 Z",
};

/**
 * Text with inputs in it ("Press {k:interact} to talk"), drawn with real
 * glyphs. Pair with the rich translators (`tr`, `tlr`); plain `t()` output
 * passes through unchanged.
 */
export function RichText({ text }: { text: string }) {
  useInputDevice();
  if (!text.includes(GLYPH_OPEN)) return <>{text}</>;
  const parts = text.split(new RegExp(`${GLYPH_OPEN}([^${GLYPH_CLOSE}]*)${GLYPH_CLOSE}`));
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <Glyph key={i} code={p} size={1.4} /> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
