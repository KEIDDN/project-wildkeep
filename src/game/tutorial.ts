import { HELP_TOPICS, TUTORIAL_STEPS, type HelpTopicId, type TutorialCtx } from "../data/tutorial";
import { useQuestStore } from "../store/questStore";
import { useInventoryStore } from "../store/inventoryStore";
import { gameEvents, type GameEventMap } from "./events";
import { currentTutorialStep, useTutorialStore } from "../store/tutorialStore";
import { useWorldStore } from "../store/worldStore";
import { useUiStore } from "../store/uiStore";
import { useTimeStore } from "../store/timeStore";
import { usePlayerStore } from "../store/playerStore";
import { audio } from "./audio/AudioManager";
import { saveGame } from "./save/gameSave";
import { t } from "../i18n";
import type { AreaId } from "./core/types";

/**
 * The TutorialManager: two light layers that never pause the game.
 *
 *  - Contextual help: `showTutorial("mining")` queues a short tip card the
 *    first time a player meets a system. A card closes itself once the
 *    player has done the thing it teaches (HELP_TOPICS[id].doneOn), or when
 *    dismissed. Seen topics are saved and never shown again (they stay
 *    readable in the Help menu).
 *  - First-day objectives: a short guided chain, each step completed by a
 *    game event, shown as one line at the top of the screen.
 */
export function showTutorial(topic: HelpTopicId): void {
  useTutorialStore.getState().show(topic);
}

/** Which help topic each place introduces. */
const AREA_TOPICS: Partial<Record<AreaId, HelpTopicId>> = {
  house: "home",
  town: "town",
  forest: "forest",
  mine: "mining",
  dungeon: "combat",
  tavern: "tavern",
};

/** Which help topic each panel introduces. */
const PANEL_TOPICS: Record<string, HelpTopicId> = {
  inventory: "inventory",
  map: "map",
  shop: "selling",
  crafting: "crafting",
  blackjack: "blackjack",
  roulette: "roulette",
  floorCleared: "dungeon_floors",
  skills: "skills",
  house: "house",
  journal: "journal",
};

/** A card stays up at least this long before it may close itself. */
const MIN_CARD_MS = 3500;

export function startTutorial(): () => void {
  const unsubs: (() => void)[] = [];

  // --- guided objectives -----------------------------------------------------------
  const events = [...new Set(TUTORIAL_STEPS.map((s) => s.on))];
  for (const type of events) unsubs.push(gameEvents.on(type, (payload) => onEvent(type, payload)));
  // Panels are UI state, so watch the store rather than every open call.
  unsubs.push(
    useUiStore.subscribe((s, prev) => {
      if (s.activePanel === prev.activePanel) return;
      if (prev.activePanel) gameEvents.emit("panelClosed", { panel: prev.activePanel });
      if (!s.activePanel) return;
      gameEvents.emit("panelOpened", { panel: s.activePanel });
      const topic = PANEL_TOPICS[s.activePanel];
      if (topic) showTutorial(topic);
    }),
  );

  // --- contextual help --------------------------------------------------------------
  unsubs.push(
    gameEvents.on("areaEntered", ({ area }) => {
      if (area === "house") showTutorial("movement");
      const topic = AREA_TOPICS[area];
      if (topic) showTutorial(topic);
    }),
    gameEvents.on("resourceGathered", () => showTutorial("gathering")),
    gameEvents.on("crafted", () => {
      // First real piece of gear: explain the slots.
      const eq = usePlayerStore.getState().equipment;
      if (eq.head || eq.boots || (eq.armor && eq.armor !== "cloth_tunic")) showTutorial("equipment");
    }),
    // Evening falls for the first time.
    useTimeStore.subscribe((s, prev) => {
      if (s.minute >= 18 * 60 && prev.minute < 18 * 60) showTutorial("time");
    }),
    // Gear going on (not coming off).
    usePlayerStore.subscribe((s, prev) => {
      for (const slot of Object.keys(s.equipment) as (keyof typeof s.equipment)[]) {
        const id = s.equipment[slot];
        if (id && id !== prev.equipment[slot]) gameEvents.emit("equipped", { slot, itemId: id });
      }
    }),
    // First skill level-up.
    usePlayerStore.subscribe((s, prev) => {
      if (Object.keys(s.skills).some((k) => s.skills[k as keyof typeof s.skills].level > prev.skills[k as keyof typeof s.skills].level)) showTutorial("skills");
    }),
  );

  // --- "understood": cards close themselves -----------------------------------------
  const progress = new Map<string, number>();
  let shownAt = 0;
  let shownTopic: string | undefined;
  unsubs.push(
    useTutorialStore.subscribe((s) => {
      if (s.queue[0] !== shownTopic) {
        shownTopic = s.queue[0];
        shownAt = performance.now();
        progress.clear();
      }
    }),
  );
  const doneEvents = [...new Set(Object.values(HELP_TOPICS).flatMap((h) => (h.doneOn ? [h.doneOn.event] : [])))];
  for (const ev of doneEvents) {
    unsubs.push(
      gameEvents.on(ev, () => {
        const topic = useTutorialStore.getState().queue[0];
        const rule = topic ? HELP_TOPICS[topic].doneOn : undefined;
        if (!topic || rule?.event !== ev) return;
        const n = (progress.get(topic) ?? 0) + 1;
        progress.set(topic, n);
        if (n < (rule.count ?? 1)) return;
        const wait = Math.max(0, MIN_CARD_MS - (performance.now() - shownAt));
        setTimeout(() => {
          if (useTutorialStore.getState().queue[0] === topic) useTutorialStore.getState().dismissTip();
        }, wait);
      }),
    );
  }

  // Things can happen out of order (a crate found before Bram asked): re-check.
  unsubs.push(useQuestStore.subscribe(() => skipSatisfiedSteps()), useInventoryStore.subscribe(() => skipSatisfiedSteps()));
  skipSatisfiedSteps();
  return () => unsubs.forEach((u) => u());
}

function onEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]) {
  const step = currentTutorialStep();
  if (!step || step.on !== type) return;
  if (step.test && !(step.test as (p: GameEventMap[K]) => boolean)(payload)) return;
  completeStep();
}

function completeStep() {
  useTutorialStore.getState().advance();
  audio.sfx("ui");
  skipSatisfiedSteps();
  if (useTutorialStore.getState().completed) {
    audio.sfx("levelup");
    useUiStore.getState().pushToast(t("toast.firstDayDone"), "levelup");
    showTutorial("journal");
    saveGame();
  }
}

function context(): TutorialCtx {
  const q = useQuestStore.getState();
  const world = useWorldStore.getState();
  return {
    area: world.area,
    quests: { active: q.active, done: q.done },
    has: (id) => useInventoryStore.getState().hasItem(id),
    discovered: (id) => world.progress.discoveries.includes(id),
  };
}

function skipSatisfiedSteps() {
  for (;;) {
    const step = currentTutorialStep();
    if (!step?.alreadyDone || !step.alreadyDone(context())) return;
    useTutorialStore.getState().advance();
  }
}
