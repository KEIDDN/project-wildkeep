import { useEffect, useRef, useState, type ReactNode } from "react";
import { FishingMeter } from "./FishingMeter";
import { getGame } from "../../engine/gameInstance";
import { rank, talentPoints } from "../../data/talents";
import { usePlayerStore } from "../../store/playerStore";
import { useUiStore, type PanelId } from "../../store/uiStore";
import { useWorldStore } from "../../store/worldStore";
import { useInventoryStore } from "../../store/inventoryStore";
import { useDungeonStore } from "../../store/dungeonStore";
import { useSocialStore } from "../../store/socialStore";
import { xpForLevel } from "../../game/systems/statsSystem";
import { playerEffectiveStats } from "../../game/systems/playerStats";
import { useTownStore } from "../../store/townStore";
import { useTimeStore } from "../../store/timeStore";
import { useTutorialStore } from "../../store/tutorialStore";
import { TUTORIAL_STEPS } from "../../data/tutorial";
import { WORLD_EVENTS } from "../../data/worldEvents";
import { formatClock, timeOfDay } from "../../game/time/clock";
import { getItem } from "../../data/items";
import { floorProfile } from "../../data/dungeonFloors";
import { useMineStore } from "../../store/mineStore";
import { honorRank } from "../../game/social/honor";
import { areaName, floorThemeName, itemName, npcName } from "../../i18n/content";
import { NPCS } from "../../data/npcs";
import { fmt, t, tDyn, tDynR, type TKey } from "../../i18n";
import { type Action } from "../../game/input/bindings";
import { Glyph, RichText } from "../components/Glyph";
import { skipTutorial } from "../../game/tutorial";
import { maxEnergy } from "../../game/systems/vitals";
import { maxDurability, wearState } from "../../game/systems/durability";
import { Bar } from "../components/Bar";
import { Minimap } from "./Minimap";
import { QuestTracker } from "../panels/QuestPanels";
import { drunkTier } from "../../game/tavern/drink";
import { useAvoidPlayer } from "../hooks/useAvoidPlayer";

export function HUD() {
  const hp = usePlayerStore((s) => s.hp);
  const xp = usePlayerStore((s) => s.xp);
  const level = usePlayerStore((s) => s.level);
  const gold = usePlayerStore((s) => s.gold);
  const baseStats = usePlayerStore((s) => s.baseStats);
  const equipment = usePlayerStore((s) => s.equipment);
  const skills = usePlayerStore((s) => s.skills);
  const talents = usePlayerStore((s) => s.talents);
  const bonusPoints = usePlayerStore((s) => s.bonusTalentPoints);
  const magic = useWorldStore((s) => !!s.progress.flags.magic_learned);
  const houseLevel = useTownStore((s) => s.buildingLevels.house ?? 1);
  const area = useWorldStore((s) => s.area);
  const floor = useDungeonStore((s) => s.floor);
  const runSeed = useDungeonStore((s) => s.seed);
  const stacks = useInventoryStore((s) => s.stacks);
  const bossBar = useUiStore((s) => s.bossBar);

  const stats = playerEffectiveStats({ baseStats, equipment, skills, talents }, houseLevel);
  const potions = stacks.filter((s) => getItem(s.itemId).healAmount).reduce((n, s) => n + s.quantity, 0);
  const mineFloor = useMineStore((s) => s.floor);
  const place =
    area === "dungeon"
      ? t("hud.dungeonArea", { floor, theme: floorThemeName(floorProfile(floor).theme.name) })
      : area === "mine"
        ? t("hud.mineArea", { floor: mineFloor })
        : areaName(area);
  const lowHp = hp / stats.maxHp < 0.3;
  // A red edge flash each time you lose health (remounted to replay).
  const prevHp = useRef(hp);
  const [hurt, setHurt] = useState<{ n: number; heavy: boolean }>({ n: 0, heavy: false });
  useEffect(() => {
    const lost = prevHp.current - hp;
    prevHp.current = hp;
    if (lost > 0) setHurt((h) => ({ n: h.n + 1, heavy: lost >= stats.maxHp * 0.2 }));
  }, [hp, stats.maxHp]);
  const portrait = equipment.armor ? getItem(equipment.armor).icon : "armor_cloth";

  return (
    <>
      <div className="hud-player">
        <div className="hud-portrait" onClick={() => useUiStore.getState().openPanel("character")} title={t("character.title")}>
          <img src={`/icons/${portrait}.png`} alt="" />
          <span className="hud-level" title={t("hud.level")}>
            {level}
          </span>
        </div>
        <div className="hud-bars">
          <div className="vital vital-hp" title={t("hud.health")}>
            <img className="vital-icon" src="/icons/glyph_heart.png" alt="" />
            <Bar value={hp} max={stats.maxHp} kind="hp" label={`${hp} / ${stats.maxHp}`} height={24} />
          </div>
          <div className="vital vital-st" title={t("combat.stamina")}>
            <img className="vital-icon" src="/icons/glyph_bolt.png" alt="" />
            <StaminaBar />
          </div>
          <ManaBar />
          <div className="vital vital-xp" title={`${fmt(xp)} / ${fmt(xpForLevel(level))} ${t("common.xp")}`}>
            <span className="vital-tag">{t("common.lv", { n: level })}</span>
            <Bar value={xp} max={xpForLevel(level)} kind="xp" height={8} />
          </div>
          <StatusEffects />
        </div>
      </div>

      <div className="hud-topright">
        <div className="hud-gold">
          <img src="/icons/gold_coin.png" alt="" />
          <span>{fmt(gold)}</span>
        </div>
        <Clock />
        <EnergyMeter />
        <TodayNotice />
        <div className="hud-area">{place}</div>
        <HonorBadge />
        {area === "dungeon" && <Minimap />}
        {area === "dungeon" && runSeed && <div className="hud-seed">{t("hud.seed", { seed: runSeed })}</div>}
      </div>

      {bossBar && (
        <div className="hud-boss">
          <div className="hud-boss-name">{bossBar.name}</div>
          <Bar value={bossBar.hp} max={bossBar.maxHp} kind="boss" height={12} />
        </div>
      )}

      <div className="hud-hotbar">
        <HotSlot itemId={equipment.weapon} hint={<Glyph action="attack" />} slot="weapon" />
        <HotSlot itemId={equipment.tool} hint={<Glyph action="attack" />} slot="tool" />
        <div className="hotslot" title={t("controls.action.potion")}>
          <img src="/icons/potion_health.png" alt="" style={{ opacity: potions ? 1 : 0.35 }} />
          <span className="hotslot-qty">{potions}</span>
          <span className="hotslot-key"><Glyph action="potion" /></span>
        </div>
        <AbilitySlot ability="dodge" icon="boots_leather" hint={<Glyph action="dodge" />} />
        <AbilitySlot ability="parry" icon="glyph_shield" hint={<Glyph action="parry" />} />
        {rank(talents, "whirlwind") > 0 && <AbilitySlot ability="whirl" icon="sword_epic" hint={<Glyph action="ability" />} />}
        {magic && <AbilitySlot ability="spark" icon="spellbook" hint={<Glyph action="cast" />} />}
        <span className="hotbar-gap" />
        <MenuSlot panel="inventory" icon="chest" action="inventory" />
        <MenuSlot panel="character" icon="armor_leather" action="character" />
        <MenuSlot panel="skills" icon="skill_strength" action="skills" badge={talentPoints(level, talents, bonusPoints)} />
        <MenuSlot panel="map" icon="map_scroll" action="map" />
      </div>

      <FishingMeter />
      {lowHp && hp > 0 && <div className="hud-lowhp" />}
      {hurt.n > 0 && <div key={hurt.n} className={`hud-hurt${hurt.heavy ? " heavy" : ""}`} />}
      <TutorialTracker />
      <QuestTracker />
      <InteractionPrompt />
    </>
  );
}

/** A small clickable shortcut to a menu, showing its (rebindable) key. */
function MenuSlot({ panel, icon, action, badge }: { panel: PanelId; icon: string; action: Action; badge?: number }) {
  return (
    <div className="hotslot hotslot-bag hotslot-menu" title={t(`controls.action.${action}` as TKey)} onClick={() => useUiStore.getState().openPanel(panel)}>
      <img src={`/icons/${icon}.png`} alt="" />
      <span className="hotslot-key"><Glyph action={action} /></span>
      {!!badge && <span className="hotslot-badge">{badge}</span>}
    </div>
  );
}

/** Mana, once you've learned magic (the Crooked Tower). Engine-driven like stamina. */
function ManaBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [has, setHas] = useState(false);
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const p = getGame()?.player;
      const max = p?.maxMana ?? 0;
      if (max > 0 !== has) setHas(max > 0);
      if (p && max > 0 && ref.current) {
        const key = `${Math.floor(p.mana)}|${max}`;
        if (key !== last) {
          last = key;
          ref.current.style.setProperty("--mp", `${Math.round((p.mana / max) * 100)}%`);
          const label = ref.current.querySelector(".bar-label");
          if (label) label.textContent = `${Math.floor(p.mana)} / ${max}`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [has]);
  if (!has) return null;
  return (
    <div className="vital vital-mp" title={t("hud.mana")}>
      <img className="vital-icon" src="/icons/glyph_mana.png" alt="" />
      <div ref={ref} className="bar bar-mana" style={{ height: 14 }}>
        <div className="bar-fill" />
        <span className="bar-label" />
      </div>
    </div>
  );
}

/** Today's energy, under the clock: the day's budget for hard work. */
function EnergyMeter() {
  const energy = usePlayerStore((s) => Math.ceil(s.energy));
  usePlayerStore((s) => s.level);
  const max = maxEnergy();
  const pct = Math.max(0, Math.min(100, (energy / max) * 100));
  const tier = energy <= 0 ? "out" : pct < 20 ? "low" : pct < 50 ? "mid" : "high";
  return (
    <div className={`hud-energy energy-${tier}`} title={t("energy.tooltip", { n: energy, max })}>
      <img src="/icons/glyph_sun.png" alt="" />
      <div className="energy-track">
        <div className="energy-fill" style={{ width: `${pct}%` }} />
      </div>
      <b>{energy}</b>
    </div>
  );
}

/** Little chips for whatever is affecting you right now. */
function StatusEffects() {
  const drunk = useSocialStore((s) => Math.ceil(s.drunk / 5) * 5);
  const bounty = useSocialStore((s) => s.bounty);
  const exhausted = usePlayerStore((s) => s.energy <= 0);
  const restedDay = useTimeStore((s) => s.restedDay);
  const day = useTimeStore((s) => s.day);
  const tier = drunkTier(drunk);
  const chips: { id: string; icon: string; label: string; tone: "good" | "bad" | "odd"; tip: string }[] = [];
  if (restedDay === day) chips.push({ id: "rested", icon: "sleep", label: t("status.rested"), tone: "good", tip: t("status.restedTip") });
  if (tier !== "sober") chips.push({ id: "drunk", icon: "beer", label: t(`drunk.tier.${tier}`), tone: "odd", tip: t("status.drunkTip", { n: drunk }) });
  if (exhausted) chips.push({ id: "tired", icon: "glyph_sun", label: t("status.exhausted"), tone: "bad", tip: t("status.exhaustedTip") });
  if (bounty > 0) chips.push({ id: "bounty", icon: "coin_bag", label: `${t("rep.bountyLabel")}: ${bounty}g`, tone: "bad", tip: t("status.bountyTip") });
  if (!chips.length) return null;
  return (
    <div className="hud-status">
      {chips.map((c) => (
        <span key={c.id} className={`status-chip tone-${c.tone}`} title={c.tip}>
          <img src={`/icons/${c.icon}.png`} alt="" />
          {c.label}
        </span>
      ))}
    </div>
  );
}

/**
 * An ability with a cooldown sweep. The sweep is animated straight from the
 * engine every frame through a CSS variable — no React re-render per frame.
 */
function AbilitySlot({ ability, icon, hint }: { ability: "dodge" | "whirl" | "parry" | "spark"; icon: string; hint: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const loop = () => {
      const cd = getGame()?.player?.cooldowns()[ability] ?? 0;
      const v = Math.round(cd * 100) / 100;
      if (v !== last && ref.current) {
        last = v;
        ref.current.style.setProperty("--cd", String(v));
        ref.current.classList.toggle("cooling", v > 0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ability]);
  return (
    <div ref={ref} className="hotslot ability-slot" title={t(ability === "dodge" ? "controls.action.dodge" : ability === "parry" ? "controls.action.parry" : ability === "spark" ? "controls.action.cast" : "talents.whirlwind.name")}>
      <img src={`/icons/${icon}.png`} alt="" />
      <span className="cd-sweep" />
      <span className="hotslot-key">{hint}</span>
    </div>
  );
}

/** Stamina, straight from the engine each frame (no React re-render). Blue
 * flash while a riposte is ready; grey when winded. */
function StaminaBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const p = getGame()?.player;
      if (p && ref.current) {
        const pct = Math.round((p.stamina / p.maxStamina) * 100);
        const key = `${pct}|${p.riposte > 0}|${p.stamina < 24}`;
        if (key !== last) {
          last = key;
          ref.current.style.setProperty("--st", `${pct}%`);
          ref.current.classList.toggle("riposte", p.riposte > 0);
          ref.current.classList.toggle("low", p.stamina < 24);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} className="bar bar-stamina" style={{ height: 7 }} title={t("combat.stamina")}>
      <div className="bar-fill" />
    </div>
  );
}

function HotSlot({ itemId, hint, slot }: { itemId?: string; hint: ReactNode; slot: "weapon" | "tool" }) {
  const def = itemId ? getItem(itemId) : null;
  const cur = usePlayerStore((s) => (itemId ? Math.floor(s.wear[slot] ?? 1e9) : 0));
  const max = itemId ? maxDurability(itemId) : 0;
  const shown = Math.min(cur, max);
  const ws = max ? wearState(shown, max) : "fine";
  return (
    <div className={`hotslot rarity-${def?.rarity ?? "common"}`} title={itemId ? itemName(itemId) : undefined}>
      {def && <img src={`/icons/${def.icon}.png`} alt="" />}
      <span className="hotslot-key">{hint}</span>
      {max > 0 && ws !== "fine" && (
        <span className={`wearbar wear-${ws}`} title={t(`durability.state.${ws}`)}>
          <i style={{ width: `${(shown / max) * 100}%` }} />
        </span>
      )}
    </div>
  );
}

/** "E — Talk to Mira". Moves to the top of the screen if it would cover you. */
function InteractionPrompt() {
  const prompt = useUiStore((s) => s.prompt);
  const panel = useUiStore((s) => s.activePanel);
  const ref = useRef<HTMLDivElement>(null);
  const avoid = useAvoidPlayer(ref, !!prompt && !panel);
  if (!prompt || panel) return null;
  return (
    <div ref={ref} className={`interaction-prompt${prompt.blocked ? " blocked" : ""}${avoid ? " avoid" : ""}`}>
      <Glyph action="interact" size={1.5} />
      <span>
        {prompt.verb} <b>{prompt.target}</b>
      </span>
      {prompt.blocked && <span className="prompt-blocked">{prompt.blocked}</span>}
      {prompt.alt && !prompt.blocked && (
        <span className="prompt-alt">
          <Glyph action={prompt.alt.action} /> {prompt.alt.label}
        </span>
      )}
    </div>
  );
}

/** Day counter + clock, with a little sun or moon for the time of day. */
function Clock() {
  const day = useTimeStore((s) => s.day);
  // Re-render every 10 game minutes, not every minute.
  const minute = useTimeStore((s) => Math.floor(s.minute / 10) * 10);
  const phase = timeOfDay(minute);
  return (
    <div className={`hud-clock ${phase}`}>
      <span className={`clock-orb ${phase === "night" ? "moon" : "sun"}`} />
      <span>{t("hud.day", { n: day })}</span>
      <b>{formatClock(minute)}</b>
    </div>
  );
}

/** Today's world event, if any: a small notice under the clock. */
function TodayNotice() {
  const event = useSocialStore((s) => s.event);
  const day = useTimeStore((s) => s.day);
  if (event.day !== day || !event.id) return null;
  const def = WORLD_EVENTS.find((e) => e.id === event.id);
  if (!def) return null;
  return (
    <div className="hud-event" title={tDyn(`worldEvent.${def.id}.desc`)}>
      <img src={`/icons/${def.icon}.png`} alt="" />
      <span>{tDyn(`worldEvent.${def.id}.title`)}</span>
    </div>
  );
}

function HonorBadge() {
  const honor = useSocialStore((s) => s.honor);
  const rank = honorRank(honor);
  return (
    <button type="button" className={`hud-honor honor-${rank}`} title={t("hud.honorTip", { n: honor })} onClick={() => useUiStore.getState().openPanel("character")}>
      <span className="honor-label">{t("hud.honor")}</span> {t(`honor.rank.${rank}`)}
    </button>
  );
}

/** Current tutorial objective, top-centre. Fades if it would cover you. */
function TutorialTracker() {
  const step = useTutorialStore((s) => s.step);
  const completed = useTutorialStore((s) => s.completed);
  const flash = useTutorialStore((s) => s.justCompleted);
  const panel = useUiStore((s) => s.activePanel);
  const ref = useRef<HTMLDivElement>(null);
  const def = TUTORIAL_STEPS[step];
  const visible = !completed && panel !== "dialogue" && !!def;
  const avoid = useAvoidPlayer(ref, visible);
  const [confirmSkip, setConfirmSkip] = useState(false);
  if (!visible) return null;
  const npc = def.who !== "wren" ? NPCS[def.who] : null;
  const who = npc ? npcName(npc) : t("tutorial.wren");
  const portrait = npc?.portrait ?? (def.who === "wren" ? "journal" : "clover");
  return (
    <div ref={ref} className={`tutorial${avoid ? " avoid" : ""}`} key={flash}>
      <div className="tutorial-head">
        <span className="tutorial-who">
          <img src={`/icons/${portrait}.png`} alt="" /> {who} · {step + 1}/{TUTORIAL_STEPS.length}
        </span>
        <button
          type="button"
          className="link-btn"
          onClick={() => (confirmSkip ? skipTutorial() : setConfirmSkip(true))}
          onMouseLeave={() => setConfirmSkip(false)}
        >
          {confirmSkip ? t("tutorial.skipConfirm") : t("hud.skip")}
        </button>
      </div>
      <div className="tutorial-text"><RichText text={tDynR(`tutorial.steps.${def.id}.text`)} /></div>
      <div className="tutorial-hint"><RichText text={tDynR(`tutorial.steps.${def.id}.hint`)} /></div>
    </div>
  );
}
