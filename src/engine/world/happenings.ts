import { Entity } from "../entities/Entity";
import { InteractSpot, Npc, npcVisual } from "../entities/Props";
import type { Game } from "../Game";
import type { Area } from "./Area";
import { TILE } from "../../game/core/constants";
import { getNpc } from "../../data/npcs";
import { SeededRandom } from "../../game/core/rng";
import { useTimeStore } from "../../store/timeStore";
import { useSocialStore } from "../../store/socialStore";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore, type DialogueChoice } from "../../store/uiStore";
import { adjustHonor } from "../../game/social/honor";
import { adjustRep } from "../../game/social/reputation";
import { changeFriendship } from "../../game/relationships";
import { awardSkillXp } from "../../game/actions";
import { gameEvents } from "../../game/events";
import { audio } from "../../game/audio/AudioManager";
import { npcBarks, npcName } from "../../i18n/content";
import { t } from "../../i18n";

/**
 * Happenings: small scenes that play out around town during the day, on
 * top of the daily world event. Each has a time window and a seeded chance
 * per day, plays at most once a day, and asks you to pick a side:
 *
 *   argument    two neighbours bicker at the plaza: calm them, take a side, or egg them on
 *   shell game  Nimble Nico's cups: play (he cheats), or call him out
 *   pickpocket  Slick Wim bolts from the market with a purse: catch him — then decide
 *   arm-wrestle Morg, in the tavern, at night
 *
 * Every seventh day is market day: more stalls, more chances of trouble.
 */

const day = () => useTimeStore.getState().day;
const hour = () => useTimeStore.getState().minute / 60;
const done = (key: string) => useSocialStore.getState().usedToday(`hap:${key}`, day());
const finish = (key: string) => useSocialStore.getState().useToday(`hap:${key}`, day());

export const isMarketDay = (d = day()) => d % 7 === 0;

/** Which happenings are on today (seeded, so they're stable per day). */
function rolled(key: string, chance: number): boolean {
  const boost = isMarketDay() ? 0.25 : 0;
  return SeededRandom.fromString(`hap:${key}:${day()}`).bool(Math.min(0.95, chance + boost));
}

const inWindow = (from: number, to: number) => {
  const h = hour();
  return from < to ? h >= from && h < to : h >= from || h < to;
};

function show(npc: Npc, lines: string[], choices?: DialogueChoice[]) {
  useUiStore.getState().showDialogue({ speaker: npc.displayName, lines, choices });
}

/** Which happenings are on today (whatever the hour). */
export function todaysHappenings(): string[] {
  return (
    [
      ["argument", 0.5],
      ["shell", 0.45],
      ["pickpocket", 0.35],
      ["armwrestle", 0.7],
    ] as const
  )
    .filter(([k, c]) => rolled(k, c))
    .map(([k]) => k);
}

/** Town happenings (called by the town builder). */
export function placeTownHappenings(area: Area): void {
  if (!done("argument") && inWindow(9, 17) && rolled("argument", 0.5)) placeArgument(area);
  if (!done("shell") && inWindow(10, 18) && rolled("shell", 0.45)) placeShellGame(area);
  if (!done("pickpocket") && inWindow(11, 16) && rolled("pickpocket", 0.35)) placePickpocket(area);
}

/** Tavern happenings (called by the tavern builder). */
export function placeTavernHappenings(area: Area): void {
  if (!done("armwrestle") && inWindow(19, 2) && rolled("armwrestle", 0.7)) placeArmWrestle(area);
}

// ---- the argument ------------------------------------------------------------------------

function placeArgument(area: Area) {
  const a = actor("wendel", 33 * TILE, 24 * TILE, false);
  const b = actor("pruett", 35 * TILE + 4, 24 * TILE, true);
  const scene = new Bickering(a, b);
  const talk = (g: Game, who: Npc) => {
    if (scene.over) return show(who, [t("hap.argument.after")]);
    show(who, [t("hap.argument.intro")], [
      { label: t("hap.argument.calm"), tone: "good", onChoose: () => scene.end(g, "calm") },
      { label: t("hap.argument.sideA", { name: a.displayName }), onChoose: () => scene.end(g, "a") },
      { label: t("hap.argument.sideB", { name: b.displayName }), onChoose: () => scene.end(g, "b") },
      { label: t("hap.argument.egg"), tone: "bad", onChoose: () => scene.end(g, "egg") },
    ]);
  };
  a.setTalk((g) => talk(g, a));
  b.setTalk((g) => talk(g, b));
  area.add(a);
  area.add(b);
  area.add(scene);
}

class Bickering extends Entity {
  over = false;
  private timer = 1;
  private turn = 0;
  private readonly a: Npc;
  private readonly b: Npc;

  constructor(a: Npc, b: Npc) {
    super(a.x, a.y);
    this.a = a;
    this.b = b;
  }

  update(dt: number, game: Game) {
    if (this.over) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 2.6 + Math.random() * 1.5;
    const who = this.turn++ % 2 ? this.b : this.a;
    if (Math.hypot(game.player.x - who.x, game.player.y - who.y) > 220) return;
    const lines = npcBarks(who.def!);
    who.say(game, lines[Math.floor(Math.random() * lines.length)], 2.4);
  }

  end(game: Game, how: "calm" | "a" | "b" | "egg") {
    this.over = true;
    finish("argument");
    const [a, b] = [this.a.def!.id, this.b.def!.id];
    if (how === "calm") {
      adjustHonor(2);
      adjustRep("village", 2);
      changeFriendship(a, 4);
      changeFriendship(b, 4);
    } else if (how === "a" || how === "b") {
      changeFriendship(how === "a" ? a : b, 10);
      changeFriendship(how === "a" ? b : a, -8);
    } else {
      adjustRep("underworld", 1, true);
      changeFriendship(a, -4, true);
      changeFriendship(b, -4, true);
      this.a.say(game, t("hap.argument.fight"), 2.5);
      setTimeout(() => !this.b.removed && this.b.say(game, t("hap.argument.fight2"), 2.5), 900);
    }
    audio.sfx(how === "egg" ? "deny" : "ui");
    useUiStore.getState().showDialogue({ speaker: this.a.displayName, lines: [t(`hap.argument.end.${how}`)] });
  }
}

// ---- Nimble Nico's shell game -------------------------------------------------------------

const shellLosses = new Map<number, number>();

function placeShellGame(area: Area) {
  const nico = actor("nico", 26 * TILE, 27 * TILE, false);
  let exposed = false;
  const lost = () => shellLosses.get(day()) ?? 0;
  const play = (g: Game) => {
    if (exposed) return show(nico, [t("hap.shell.gone")]);
    const gold = usePlayerStore.getState().gold;
    // Sharp eyes (a bit of Honor, some Luck, or having been fleeced already) spot the trick.
    const suspicious = useSocialStore.getState().honor >= 15 || usePlayerStore.getState().skills.luck.level >= 4 || lost() >= 20;
    const choices: DialogueChoice[] = [
      {
        label: t("hap.shell.play"),
        disabled: gold < 10,
        onChoose: () =>
          show(nico, [t("hap.shell.which")], (["left", "middle", "right"] as const).map((c) => ({ label: t(`hap.shell.cup.${c}`), onChoose: () => pick(g) }))),
      },
    ];
    if (suspicious) choices.push({ label: t("hap.shell.expose"), tone: "good", onChoose: () => expose(g) });
    choices.push({ label: t("hap.shell.leave"), onChoose: () => useUiStore.getState().closePanel() });
    show(nico, [t("hap.shell.intro"), ...(suspicious ? [t("hap.shell.hunch")] : [])], choices);
  };
  const pick = (g: Game) => {
    if (!usePlayerStore.getState().spendGold(10)) return;
    const win = Math.random() < 0.3;
    if (win) usePlayerStore.getState().earnGold(25);
    else shellLosses.set(day(), lost() + 10);
    awardSkillXp("gambling", 4);
    gameEvents.emit("gambled", { game: "shell", stake: 10, net: win ? 15 : -10 });
    audio.sfx(win ? "coin" : "deny");
    g.fx.text(g.player.x, g.player.y - 30, win ? "+15g" : "-10g", win ? 0xffd54f : 0xff8a7a, { size: 8 });
    show(nico, [t(win ? "hap.shell.win" : "hap.shell.lose")]);
  };
  const expose = (g: Game) => {
    exposed = true;
    finish("shell");
    const refund = lost();
    if (refund) usePlayerStore.getState().earnGold(refund);
    shellLosses.set(day(), 0);
    adjustHonor(2);
    adjustRep("village", 3);
    adjustRep("underworld", -2);
    nico.say(g, t("hap.shell.flee"), 2.5);
    nico.walkTo(40 * TILE, 19 * TILE, () => g.removeEntity(nico));
    show(nico, [t("hap.shell.exposed", { n: refund })]);
  };
  nico.setTalk(play);
  area.add(nico);
}

// ---- Slick Wim, pickpocket ----------------------------------------------------------------

function placePickpocket(area: Area) {
  const wim = actor("wim", 35 * TILE, 35 * TILE, true);
  let running = false;
  let caught = false;
  area.add(new Trigger(wim, 110, (g) => {
    if (running || caught) return;
    running = true;
    g.ui.pushToast(t("hap.thief.shout"), "warning", { icon: "coin_bag" });
    wim.say(g, t("hap.thief.bark"), 2);
    audio.sfx("deny");
    wim.walkTo(63 * TILE, 18 * TILE + 10, () => {
      if (caught) return;
      finish("pickpocket");
      g.ui.pushToast(t("hap.thief.escaped"), "warning");
      g.removeEntity(wim);
    });
  }));
  wim.setTalk((g) => {
    if (caught) return show(wim, [t("hap.thief.after")]);
    caught = true;
    finish("pickpocket");
    show(wim, [t("hap.thief.caught")], [
      {
        label: t("hap.thief.return"),
        tone: "good",
        onChoose: () => {
          adjustHonor(3);
          adjustRep("village", 3);
          adjustRep("watch", 2, true);
          changeFriendship("bella", 8);
          usePlayerStore.getState().earnGold(20);
          g.ui.pushToast(t("hap.thief.reward"), "gold", { icon: "coin_bag" });
          wim.walkTo(63 * TILE, 18 * TILE + 10, () => g.removeEntity(wim));
          useUiStore.getState().closePanel();
        },
      },
      {
        label: t("hap.thief.split"),
        tone: "bad",
        onChoose: () => {
          adjustHonor(-2);
          adjustRep("underworld", 3);
          usePlayerStore.getState().earnGold(30);
          g.ui.pushToast(t("hap.thief.splitToast"), "gold", { icon: "coin_bag" });
          wim.walkTo(63 * TILE, 18 * TILE + 10, () => g.removeEntity(wim));
          useUiStore.getState().closePanel();
        },
      },
      {
        label: t("hap.thief.letgo"),
        onChoose: () => {
          wim.walkTo(63 * TILE, 18 * TILE + 10, () => g.removeEntity(wim));
          useUiStore.getState().closePanel();
        },
      },
    ]);
  });
  area.add(wim);
}

/** Fires once when the player comes within range of something. */
class Trigger extends Entity {
  private fired = false;
  private readonly target: Npc;
  private readonly range: number;
  private readonly fn: (g: Game) => void;

  constructor(target: Npc, range: number, fn: (g: Game) => void) {
    super(target.x, target.y);
    this.target = target;
    this.range = range;
    this.fn = fn;
  }

  update(_dt: number, game: Game) {
    if (this.fired || this.target.removed) return;
    if (Math.hypot(game.player.x - this.target.x, game.player.y - this.target.y) < this.range) {
      this.fired = true;
      this.fn(game);
    }
  }
}

// ---- arm-wrestling with Morg ----------------------------------------------------------------

function placeArmWrestle(area: Area) {
  area.add(
    new InteractSpot(
      548,
      232,
      () => (done("armwrestle") ? null : { verb: t("hap.arm.verb"), target: npcName(getNpc("morg")) }),
      (g) => {
        const stats = g.playerStats();
        const chance = Math.max(0.15, Math.min(0.8, stats.attack / (stats.attack + 14 + day() / 3)));
        const speaker = npcName(getNpc("morg"));
        useUiStore.getState().showDialogue({
          speaker,
          lines: [t("hap.arm.intro"), t("hap.arm.odds", { pct: Math.round(chance * 100) })],
          choices: [
            {
              label: t("hap.arm.accept"),
              disabled: usePlayerStore.getState().gold < 10,
              onChoose: () => {
                if (!usePlayerStore.getState().spendGold(10)) return;
                finish("armwrestle");
                const win = Math.random() < chance;
                if (win) {
                  usePlayerStore.getState().earnGold(30);
                  adjustRep("underworld", 2, true);
                  changeFriendship("morg", 6, true);
                  awardSkillXp("strength", 20);
                }
                g.shake(win ? 2 : 3, 0.3);
                audio.sfx(win ? "levelup" : "player_hurt");
                useUiStore.getState().showDialogue({ speaker, lines: [t(win ? "hap.arm.win" : "hap.arm.lose")] });
              },
            },
            { label: t("hap.arm.decline"), onChoose: () => useUiStore.getState().closePanel() },
          ],
        });
      },
      { radius: 16, priority: 1 },
    ),
  );
}

// ---- helpers ---------------------------------------------------------------------------------

function actor(id: string, x: number, y: number, facingLeft: boolean): Npc {
  const def = getNpc(id);
  return new Npc(x, y, npcVisual(def), def.name, () => undefined, { def, facingLeft });
}
