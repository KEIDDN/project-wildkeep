import type { Game } from "./Game";
import { RUMBLE } from "../game/input/gamepad";
import { isHittable } from "./entities/Entity";
import { COMBO, type Swing } from "./entities/Player";
import { Enemy } from "./entities/Enemy";
import { getItem, weaponProfile } from "../data/items";
import { resolveAttack } from "../game/systems/combatSystem";
import { GEAR_CHANCE, floorBonusDrops, rollGear, rollLoot, rollUnique } from "../game/systems/lootSystem";
import { floorProfile } from "../data/dungeonFloors";
import { computeRelicEffects } from "../game/systems/statsSystem";
import { usePlayerStore } from "../store/playerStore";
import { useDungeonStore } from "../store/dungeonStore";
import { audio } from "../game/audio/AudioManager";
import { awardSkillXp } from "../game/actions";
import { t } from "../i18n";
import { WHIRLWIND, counterRiposteMult, rarityUpChance, executeMult, heavyDamageMult, jackpotChance, pointsFromLevel } from "../data/talents";
import { grantXp } from "../game/actions";
import { wearSlot } from "../game/systems/durability";

/**
 * Real-time combat glue: the player's sword arc, and what happens when an
 * enemy dies (XP, gold + loot pickups, level-up fanfare). Damage math lives
 * in game/systems/combatSystem so it stays testable and UI-free.
 */
export class CombatSystem {
  private game: Game;

  constructor(
    game: Game,
  ) {
    this.game = game;
  }

  /** Whirlwind: one big spin that hits everything around you. */
  playerWhirl(): void {
    const g = this.game;
    const p = g.player;
    const oy = p.y - 9;
    for (let i = 0; i < 4; i++) g.fx.slash(p.x, oy, (i / 4) * Math.PI * 2, { sweep: 1, spread: 1.6, radius: WHIRLWIND.radius - 6, thickness: 6, color: 0xfff2b0, life: 0.22 });
    g.fx.ring(p.x, oy, WHIRLWIND.radius, 0xffe08a, 0.3);
    const stats = g.playerStats();
    const weaponId = usePlayerStore.getState().equipment.weapon;
    const type = weaponProfile(weaponId).damageType;
    const bane = weaponId ? getItem(weaponId).bane : undefined;
    let hits = 0;
    for (const e of g.area.entities.slice()) {
      if (e.removed || !isHittable(e) || e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.centerY - oy);
      if (d > WHIRLWIND.radius + e.hitRadius) continue;
      const roll = resolveAttack(stats, e.stats);
      e.takeHit(g, Math.max(1, Math.round(roll.damage * WHIRLWIND.damage)), roll.isCrit, p.x, p.y, 1.8, { type, bane, poise: 2 });
      g.fx.burst(e.x, e.centerY, "spark", 6, { speed: 60, up: 24, life: 0.22 });
      hits++;
    }
    audio.sfx("swing", { pitch: 0.6 });
    if (hits) {
      g.shake(3, 0.18);
      g.hitStop(80);
      RUMBLE.bigHit();
    }
  }

  /**
   * Called on the impact frame of each swing. Hits everything hittable in a
   * cone in front of the player (so aiming matters). The weapon decides the
   * cone (spears long and narrow, mauls wide), the combo step and heavy
   * charge decide the power. Daggers backstab; ripostes always crit.
   */
  playerStrike(swing: Swing): void {
    const g = this.game;
    const p = g.player;
    const w = swing.weapon;
    const combo = COMBO[Math.max(0, Math.min(COMBO.length - 1, swing.step))];
    const f = p.facingVector();
    const angle = Math.atan2(f.y, f.x);
    const ox = p.x;
    const oy = p.y - 9;
    const heavy = swing.heavy;
    const reach = 24 * combo.reach * w.reach * (heavy ? 1.2 : 1);
    const arc = heavy ? Math.min(w.arc, 0.1) : w.arc;
    const big = swing.finisher || heavy;

    // The swing itself: alternating sweeps, a wide one on finishers, a long
    // narrow thrust for spears, a huge arc for heavies.
    g.fx.slash(ox + f.x * 4, oy + f.y * 3, angle, {
      sweep: swing.step === 1 ? -1 : 1,
      spread: heavy ? 2.3 : w.kind === "spear" ? 0.55 : w.kind === "maul" ? 1.9 : big ? 1.7 : 1.15,
      radius: heavy ? 26 * w.reach : w.kind === "spear" ? 28 : big ? 22 : w.kind === "dagger" ? 13 : 17,
      thickness: heavy ? 9 : w.kind === "maul" ? 8 : big ? 7 : 5,
      color: swing.riposte ? 0x9fe8ff : heavy ? 0xffe08a : big ? 0xfff2b0 : 0xffffff,
      life: big ? 0.22 : 0.15,
    });

    const base = g.playerStats();
    const stats = { ...base, crit: swing.riposte ? 1 : base.crit + w.crit };
    const weaponId = usePlayerStore.getState().equipment.weapon;
    const bane = weaponId ? getItem(weaponId).bane : undefined;
    const talents = usePlayerStore.getState().talents;
    const mult = combo.damage * w.damage * (heavy ? w.heavy * heavyDamageMult(talents) : 1) * (swing.winded ? 0.6 : 1) * (swing.riposte ? 1.3 * counterRiposteMult(talents) : 1);
    const knock = combo.knock * w.knock * (heavy ? 2 : 1) * (swing.winded ? 0.6 : 1);
    let hits = 0;
    let crits = 0;
    for (const e of g.area.entities.slice()) {
      if (e.removed || !isHittable(e) || e.dead) continue;
      const dx = e.x - ox;
      const dy = e.centerY - oy;
      const d = Math.hypot(dx, dy);
      if (d > reach + e.hitRadius) continue;
      // Within the weapon's arc of where you're facing (anything hugging you counts).
      if (d > 8 && (dx * f.x + dy * f.y) / d < arc) continue;
      let m = mult;
      if (e instanceof Enemy && e.hp < e.stats.maxHp * 0.3) m *= executeMult(talents);
      // Daggers in the back.
      if (w.kind === "dagger" && e instanceof Enemy && e.isBehind(p.x)) {
        m *= 1.6;
        g.fx.text(e.x, e.y - e.height - 12, t("combat.backstab"), 0xff8ad0, { size: 7, bold: true, life: 0.7 });
      }
      const roll = resolveAttack(stats, e.stats);
      const damage = Math.max(1, Math.round(roll.damage * m));
      e.takeHit(g, damage, roll.isCrit, p.x, p.y, knock, { type: w.damageType, heavy, bane, poise: w.poise * (heavy ? 3 : 1), weight: w.impact });
      g.fx.burst(e.x, e.centerY, "spark", roll.isCrit || heavy ? 9 : 4, { speed: 60, up: 24, life: 0.22 });
      g.fx.ring(e.x, e.centerY, roll.isCrit || big ? 14 : 9, swing.riposte ? 0x9fe8ff : roll.isCrit ? 0xffd54f : 0xffffff, 0.2);
      hits++;
      if (roll.isCrit) crits++;
    }
    if (hits) wearSlot("weapon", 1);
    if (swing.riposte && hits) g.fx.text(p.x, p.y - 38, t("combat.riposte"), 0x9fe8ff, { size: 9, bold: true, life: 0.9 });
    if (hits > 0) {
      // The weapon's weight decides how hard a hit lands: a dagger ticks, a
      // maul stops the world for a moment and shoves the camera.
      const im = w.impact;
      g.shake((heavy ? 4 : big || crits ? 3 : hits > 1 ? 2.2 : 1.5) * Math.min(1.3, im), heavy ? 0.22 : big ? 0.16 : 0.1);
      g.kick(f.x, f.y, (heavy ? 3 : big ? 2.2 : 1.2) * im);
      // Brief hit-stop sells the impact (longer for big hits).
      g.hitStop(Math.round((heavy ? 120 : big || crits ? 80 : 45) * im));
      // Only the blows worth feeling: heavies, finishers, crits.
      if (heavy) RUMBLE.heavyHit();
      else if (big || crits) RUMBLE.bigHit();
    }
  }

  rewardKill(enemy: Enemy): void {
    const g = this.game;
    const def = enemy.def;
    const player = usePlayerStore.getState();
    const relic = computeRelicEffects(player.equipment);
    const profile = floorProfile(enemy.floor, g.area.id === "dungeon" ? useDungeonStore.getState().seed : null);
    const rankMult = enemy.rank === "boss" ? 1 : enemy.rank === "elite" ? 2 : 1;

    // Raised minions are worth a pittance and carry nothing.
    if (enemy.summoned) {
      grantXp(Math.max(1, Math.round(def.xp * profile.xpMult * 0.2)));
      return;
    }
    const xp = grantXp(Math.round(def.xp * profile.xpMult * rankMult));
    awardSkillXp("strength", Math.round(xp * 0.8));
    g.fx.text(enemy.x, enemy.y - enemy.height - 10, `+${xp} XP`, 0x9fd8ff, { size: 7, life: 1.1 });
    // Jackpot talent: sometimes a kill just… pays.
    if (Math.random() < jackpotChance(player.talents)) {
      const purse = Math.round((30 + Math.random() * 50) * (1 + enemy.floor * 0.15));
      for (let i = 0; i < 5; i++) g.spawnPickup(enemy.x, enemy.y - 6, "gold", "gold", Math.round(purse / 5));
      g.fx.text(enemy.x, enemy.y - enemy.height - 20, t("talents.jackpotHit"), 0xffd54f, { size: 10, bold: true });
      audio.sfx("rare");
    }

    // Not every monster carries a purse; elites and bosses always do.
    const carries = enemy.rank !== "normal" || enemy.guardian || Math.random() < 0.55;
    const gold = carries ? Math.round((def.gold[0] + Math.random() * (def.gold[1] - def.gold[0])) * profile.goldMult * rankMult * (1 + relic.sellValueBonus)) : 0;
    const coins = gold <= 0 ? 0 : enemy.isBoss ? 8 : Math.min(3, Math.max(1, Math.round(gold / 6)));
    for (let i = 0; i < coins; i++) {
      const share = i === coins - 1 ? gold - Math.floor(gold / coins) * (coins - 1) : Math.floor(gold / coins);
      g.spawnPickup(enemy.x, enemy.y - 6, "gold", "gold", share);
    }
    const luck = relic.rareLootChanceBonus + g.playerStats().luck + profile.lootLuck;
    const loot = [...rollLoot(def.loot, luck), ...floorBonusDrops(enemy.floor, luck, enemy.rank)];
    // Elites roll their table twice.
    if (enemy.rank === "elite") loot.push(...rollLoot(def.loot, luck));
    // Gear: a rarity roll. Rare from the rank and file, likelier from elites
    // and bosses (whose chest holds the guaranteed prize); bosses may also
    // drop their own unique.
    const up = rarityUpChance(player.talents);
    const gearChance = enemy.rank === "boss" ? 0.6 : enemy.guardian ? GEAR_CHANCE.guardian : enemy.rank === "elite" ? GEAR_CHANCE.elite : GEAR_CHANCE.normal;
    if (Math.random() < gearChance * (enemy.rank === "boss" ? 1 : 1 + luck)) {
      const g = rollGear(enemy.floor, luck, Math.random, { minRarity: enemy.rank === "boss" ? "uncommon" : undefined, upChance: up });
      if (g) loot.push({ itemId: g, quantity: 1 });
    }
    if (enemy.rank === "boss") {
      const u = rollUnique(def.id, luck);
      if (u) loot.push({ itemId: u, quantity: 1 });
    }
    for (const l of loot) g.spawnPickup(enemy.x, enemy.y - 6, "item", l.itemId, l.quantity);

    const ds = useDungeonStore.getState();
    if (ds.dungeon) {
      ds.markEnemyDefeated(enemy.spawnId, enemy.guardian);
      ds.addRunLoot(0, xp, []);
    }
  }

  levelUp(level: number): void {
    const g = this.game;
    audio.sfx("levelup");
    const pts = pointsFromLevel(level) - pointsFromLevel(level - 1);
    g.ui.pushToast(t("toast.levelUpPoints", { n: level, p: pts }), "levelup", { icon: "skill_strength" });
    g.fx.text(g.player.x, g.player.y - 40, t("toast.levelUpFloat"), 0xffd54f, { size: 11, bold: true, life: 1.6 });
    g.fx.burst(g.player.x, g.player.y - 12, "gold", 24, { speed: 40, up: 90 });
    g.fx.ring(g.player.x, g.player.y - 8, 30, 0xffd54f, 0.6);
  }
}
