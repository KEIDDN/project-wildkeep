import { Container, Graphics, Text } from "pixi.js";
import { WORLD_FONT } from "../../game/core/constants";
import type { Glyph } from "../../game/input/glyphs";

const BODY = 0x241d2b;
const EDGE = 0x0d0a10;
const INK = 0xf5ecd6;
const HOT = 0xffd54f;
const hex = (c: string) => Number.parseInt(c.slice(1), 16);

function label(text: string, size: number, fill = INK): Text {
  const t = new Text({ text, style: { fontFamily: WORLD_FONT, fontSize: size, fill, fontWeight: "700" }, resolution: 8 });
  t.anchor.set(0.5);
  return t;
}

/**
 * The input glyph in world pixels (~10px tall), for the marker that floats
 * over whatever you can interact with. Same description as the React
 * <Glyph>, so the world and the HUD always agree on the button.
 */
export function drawGlyph(g: Glyph): Container {
  const c = new Container();
  const gr = new Graphics();
  c.addChild(gr);
  switch (g.kind) {
    case "none":
    case "key": {
      const text = g.kind === "key" ? g.label : "?";
      const w = Math.max(10, text.length * 5 + 5);
      gr.roundRect(-w / 2, -6, w, 10, 2).fill(0x1a1016);
      gr.roundRect(-w / 2 + 1, -5, w - 2, 8, 1).fill(0xf1e0c0);
      const t = label(text, 7, 0x2a1a20);
      t.position.set(0, -1.5);
      c.addChild(t);
      break;
    }
    case "mouse":
      gr.roundRect(-4, -7, 8, 12, 4).fill(BODY).stroke({ width: 1, color: EDGE });
      gr.rect(g.button === 2 ? 0 : -3.5, -6.5, 3.5, 4.5).fill(HOT);
      break;
    case "face": {
      gr.circle(0, -1, 5.5).fill(BODY).stroke({ width: 1, color: EDGE });
      const col = hex(g.color);
      if (g.shape === "cross") gr.moveTo(-2.4, -3.4).lineTo(2.4, 1.4).moveTo(2.4, -3.4).lineTo(-2.4, 1.4).stroke({ width: 1.4, color: col, cap: "round" });
      else if (g.shape === "circle") gr.circle(0, -1, 2.7).stroke({ width: 1.3, color: col });
      else if (g.shape === "square") gr.rect(-2.5, -3.5, 5, 5).stroke({ width: 1.2, color: col });
      else if (g.shape === "triangle") gr.poly([0, -4, 3, 1.3, -3, 1.3]).stroke({ width: 1.2, color: col, join: "round" });
      else {
        const t = label(g.label, 7, col);
        t.position.set(0, -1.2);
        c.addChild(t);
      }
      break;
    }
    case "bumper":
    case "trigger": {
      if (g.kind === "trigger") gr.roundRect(-7, -7, 14, 11, 4).fill(BODY).stroke({ width: 1, color: EDGE });
      else gr.roundRect(-7, -5, 14, 8, 3).fill(BODY).stroke({ width: 1, color: EDGE });
      const t = label(g.label, 5.5);
      t.position.set(0, -1.2);
      c.addChild(t);
      break;
    }
    case "dpad": {
      gr.poly([-2, -7, 2, -7, 2, -3, 6, -3, 6, 1, 2, 1, 2, 5, -2, 5, -2, 1, -6, 1, -6, -3, -2, -3]).fill(BODY).stroke({ width: 1, color: EDGE });
      const arm: Record<string, [number, number, number, number]> = { up: [-1.2, -6.2, 2.4, 3], down: [-1.2, 1.2, 2.4, 3], left: [-5.2, -2.2, 3, 2.4], right: [2.2, -2.2, 3, 2.4] };
      if (g.dir) {
        const [x, y, w, h] = arm[g.dir];
        gr.rect(x, y, w, h).fill(HOT);
      }
      break;
    }
    case "stick": {
      gr.circle(0, -1, 5.5).fill(BODY).stroke({ width: 1, color: EDGE });
      gr.circle(0, -1, 3.5).fill(0x3a3142).stroke({ width: 0.8, color: g.click ? HOT : 0x5a4f63 });
      const t = label(g.click ? `${g.side}3` : g.side, 5);
      t.position.set(0, -1.2);
      c.addChild(t);
      break;
    }
    case "menu":
    case "touchpad":
      gr.roundRect(-8, -5, 16, 8, 4).fill(BODY).stroke({ width: 1, color: EDGE });
      if (g.kind === "menu") {
        const t = label(g.label.slice(0, 4), 4);
        t.position.set(0, -1.2);
        c.addChild(t);
      }
      break;
  }
  return c;
}
