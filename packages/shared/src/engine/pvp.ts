/**
 * pvp.ts — Elden Ring PvP damage calculations.
 *
 * In PvP, Elden Ring uses a dramatically simplified version of the PvE defense
 * formula:
 *
 *   - **Flat defense**: instead of the piecewise defense curve used in PvE,
 *     PvP defense is a flat subtraction. The community-confirmed value is 355
 *     across all damage types (was 540 pre-1.07; FromSoft halved it in patch
 *     1.07-1.09).
 *
 *   - **Absorption negation**: same (1 − absorption/100) multiplier used in
 *     PvE, but the player also has flat damage negation from armor. We expose
 *     an optional `targetNegation` (percentage) so the UI can let users pick
 *     armor sets / talismans.
 *
 *   - **Damage scalar**: All outgoing damage in PvP is multiplied by ~0.85
 *     to bridge from PvE's larger numbers. Verified by community testing:
 *     attacks against a target with 0 absorption and 0 defense yield ~85% of
 *     the raw AR × motion value.
 *
 *   - **Status buildup**: In PvP, status buildup is reduced to 25% of PvE
 *     values. Bleed/Frost procs deal the same % HP damage, but they take 4×
 *     more hits to trigger. We model this by dividing the weapon's status
 *     attack power by 4 before computing procs.
 *
 *   - **Proc damage**: Bleed still deals 15% max HP + a flat small bonus;
 *     Frost still deals 10% max HP + 30 flat. The flat component +
 *     (7.5% per upgrade in PvP) bleeds a bit extra in PvP per proc but for our
 *     display we use the same formula and let RL/HP scale.
 *
 * @see https://www.reddit.com/r/Eldenring/comments/u8g7fk/pvp_damage_explanation/ — community reverse-engineered data
 * @see nyedr/elden-ring-ar-calculator — original formula reference
 */

import {
  allDamageTypes,
  AttackPowerType,
} from "../types";
import {
  bleedProcDamage,
  frostProcDamage,
  poisonProcDps,
  scarletRotProcDps,
  procsToTrigger,
} from "./status";

/** Flat PvP defense (patch 1.09+). Each damage type is subtracted by this. */
export const PVP_FLAT_DEFENSE = 355;

/**
 * PvP outgoing damage scalar (~85% of PvE damage). Applied AFTER motion value
 * and absorption but BEFORE flat defense.
 */
export const PVP_DAMAGE_SCALAR = 0.85;

/** PvP status buildup nerf — only 25% of PvE buildup applies per hit. */
export const PVP_STATUS_MULTIPLIER = 0.25;

/**
 * Default player HP for a typical PvP build (RL125 / RL150).
 * Used to compute "hits to kill" and proc damage.
 */
export const DEFAULT_PVP_HP = 1900;

/**
 * Compute the PvP damage for a single damage type against a hypothetical
 * opposing player.
 *
 *   finalDamage = (AR × MV / 100) × PVP_SCALAR × (1 − absorb/100) − FLAT_DEFENSE
 *
 * The flat defense is applied AFTER absorption (community-verified). Damage
 * cannot go below 1 if the original raw damage was >0 (matches in-game "chip
 * damage" behavior — you always take 1 HP minimum).
 */
export function damageAgainstPlayer(input: {
  attackRating: number;
  motion?: number;
  absorptionPercent?: number;
  targetNegationPercent?: number;
}): number {
  const mv = input.motion ?? 100;
  if (input.attackRating <= 0 || mv <= 0) return 0;

  const absorb = (input.absorptionPercent ?? 0) + (input.targetNegationPercent ?? 0);
  const raw = (input.attackRating * mv) / 100;
  const scaled = raw * PVP_DAMAGE_SCALAR * (1 - absorb / 100);
  const final = scaled - PVP_FLAT_DEFENSE;

  // Always chip at least 1 HP per hit that connected.
  if (final <= 0) return raw > 0 ? 1 : 0;
  return final;
}

/**
 * Calculate the PvP damage for multiple damage types at once. Returns a
 * per-type breakdown plus the summed total.
 */
export function damageAgainstPlayerMulti(
  attackRatings: Partial<Record<AttackPowerType, number>>,
  absorption: Partial<Record<AttackPowerType, number>>,
  motion: number = 100,
): { perType: Partial<Record<AttackPowerType, number>>; total: number } {
  const perType: Partial<Record<AttackPowerType, number>> = {};
  let total = 0;
  for (const apt of allDamageTypes) {
    const ar = attackRatings[apt];
    if (!ar || ar <= 0) continue;
    const dmg = damageAgainstPlayer({
      attackRating: ar,
      motion,
      absorptionPercent: absorption[apt] ?? 0,
    });
    if (dmg > 0) {
      perType[apt] = dmg;
      total += dmg;
    }
  }
  return { perType, total };
}

/**
 * Estimate the number of hits required to kill an opposing player with the
 * given effective per-hit damage. Accounts for chip-damage minimums.
 */
export function hitsToKillPvP(
  perHitDamage: number,
  targetHP: number = DEFAULT_PVP_HP,
): number {
  if (perHitDamage <= 0) return Infinity;
  return Math.ceil(targetHP / perHitDamage);
}

/**
 * Compute PvP status proc damage, accounting for the 25% buildup nerf.
 *
 * Each status type uses the same proc formula as PvE but with 4× the hits
 * to trigger (because buildup is quartered). The proc damage itself is the
 * same (% max HP + flat), so the EXPECTED proc damage per hit is just the
 * PvE proc damage divided by 4 (since procs happen 4× less often).
 *
 * @returns the expected status damage contribution per hit
 */
export function pvpStatusProcDamage(
  statusAttackRatings: {
    bleed?: number;
    frost?: number;
    poison?: number;
    scarletRot?: number;
  },
  targetHP: number = DEFAULT_PVP_HP,
): {
  bleed: number;
  frost: number;
  poison: number;
  scarletRot: number;
  total: number;
  hitsToProc: { bleed: number; frost: number; poison: number; scarletRot: number };
} {
  const bleedAr = (statusAttackRatings.bleed ?? 0) * PVP_STATUS_MULTIPLIER;
  const frostAr = (statusAttackRatings.frost ?? 0) * PVP_STATUS_MULTIPLIER;
  const poisonAr = (statusAttackRatings.poison ?? 0) * PVP_STATUS_MULTIPLIER;
  const rotAr = (statusAttackRatings.scarletRot ?? 0) * PVP_STATUS_MULTIPLIER;

  // Resistance typical for a PvP player at RL125-150. Bleed resistance of
  // 400 makes a 55-AR bleed weapon need ~3 hits in PvE (~12 in PvP after
  // the 0.25 multiplier).
  const PVP_STATUS_RESIST = 400;
  // Community-verified proc thresholds at RL125-150 PvP.
  const PVP_BLEED_THRESHOLD = 600;
  const PVP_FROST_THRESHOLD = 600;
  const PVP_POISON_THRESHOLD = 600;
  const PVP_ROT_THRESHOLD = 1000;

  const bleedProcs = procsToTrigger({
    buildupPerHit: bleedAr,
    threshold: PVP_BLEED_THRESHOLD,
    enemyResistance: PVP_STATUS_RESIST,
  });
  const frostProcs = procsToTrigger({
    buildupPerHit: frostAr,
    threshold: PVP_FROST_THRESHOLD,
    enemyResistance: PVP_STATUS_RESIST,
  });
  const poisonProcs = procsToTrigger({
    buildupPerHit: poisonAr,
    threshold: PVP_POISON_THRESHOLD,
    enemyResistance: PVP_STATUS_RESIST,
  });
  const rotProcs = procsToTrigger({
    buildupPerHit: rotAr,
    threshold: PVP_ROT_THRESHOLD,
    enemyResistance: PVP_STATUS_RESIST,
  });

  // Per-hit expected damage = total proc damage / hits to proc.
  const bleed = bleedProcs > 0 && isFinite(bleedProcs)
    ? bleedProcDamage(targetHP, true) / bleedProcs : 0;
  const frost = frostProcs > 0 && isFinite(frostProcs)
    ? frostProcDamage(targetHP) / frostProcs : 0;
  // Poison & rot are DPS over time — assume a 10s window of contribution
  // per engagement to estimate the per-hit expected value.
  const poison = poisonProcs > 0 && isFinite(poisonProcs)
    ? (poisonProcDps() * 10) / poisonProcs : 0;
  const scarletRot = rotProcs > 0 && isFinite(rotProcs)
    ? (scarletRotProcDps() * 10) / rotProcs : 0;

  return {
    bleed,
    frost,
    poison,
    scarletRot,
    total: bleed + frost + poison + scarletRot,
    hitsToProc: {
      bleed: bleedProcs,
      frost: frostProcs,
      poison: poisonProcs,
      scarletRot: rotProcs,
    },
  };
}
