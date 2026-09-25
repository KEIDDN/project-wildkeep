import type { Game } from "./Game";
import { Npc } from "./entities/Props";
import { getNpc } from "../data/npcs";
import { randomBark } from "../game/npcs";
import { eventActive } from "../game/social/worldEvents";
import { tl } from "../i18n";
import { rumorLine } from "../game/social/rumors";

/**
 * Ambient chatter: every few seconds someone near you says something out
 * loud (a speech bubble). NPCs with a feud answer each other, and on a
 * brawl day the tavern shouts instead. It's what makes a room feel lived-in
 * without anyone needing to be talked to.
 */
export class BarkDirector {
  private timer = 3;
  private pending: { npc: Npc; text: string; at: number }[] = [];
  private clock = 0;

  update(dt: number, game: Game): void {
    this.clock += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (this.clock < p.at) continue;
      if (!p.npc.removed) p.npc.say(game, p.text);
      this.pending.splice(i, 1);
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    const indoors = game.area.id === "tavern" || game.area.id === "shop";
    this.timer = (indoors ? 3.5 : 6) + Math.random() * 5;

    const px = game.player.x;
    const py = game.player.y;
    const near: Npc[] = [];
    for (const e of game.area.entities) {
      if (!(e instanceof Npc) || e.removed || !e.def) continue;
      const d = Math.hypot(e.x - px, e.y - py);
      if (d < 150) near.push(e);
    }
    if (!near.length) return;
    const speaker = near[Math.floor(Math.random() * near.length)];

    // Brawl day at the tavern: chaos.
    if (game.area.id === "tavern" && eventActive("brawl") && Math.random() < 0.6) {
      const lines = tl("events.brawlBark");
      speaker.say(game, lines[Math.floor(Math.random() * lines.length)], 2.4);
      game.shake(1, 0.1);
      return;
    }

    // Now and then, what they've heard about you instead.
    if (Math.random() < 0.35) {
      const rumor = rumorLine(speaker.def!.id);
      if (rumor) {
        speaker.say(game, rumor, 3.6);
        return;
      }
    }
    const text = randomBark(speaker.def!);
    if (!text) return;
    speaker.say(game, text);
    // Feuds: the rival answers.
    const rivalId = speaker.def!.feud;
    if (rivalId) {
      const rival = near.find((n) => n.def?.id === rivalId);
      const reply = rival ? randomBark(getNpc(rivalId)) : null;
      if (rival && reply) this.pending.push({ npc: rival, text: reply, at: this.clock + 1.8 });
    }
  }
}
