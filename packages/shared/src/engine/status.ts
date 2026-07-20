/**
 * status.ts — Status buildup calculator (bleed/frost/poison/rot/madness/sleep).
 *
 * Elden Ring applies status buildup via a derivative of the AR pipeline:
 *
 *   buildupPerHit = weapon.statusBuildup * statusMotionValue * weaponMultiplier
 *
 * The weapon's status "attack power" at a given upgrade level comes from the
 * SpEffectParam entries hooked to the weapon's reinforce params. The status
 * motion value is a per-attack modifier (R1 = 100, jump = 110, powerstance L1
 * = 70 post-1.07 for most statuses, etc.). Buildup is NOT affected by enemy
 * absorption, only by the enemy's status resistance value.
 *
 * Proc threshold rules:
 *   Bleed (Hemorrhage): instantaneous 15% max-HP damage + 100 + (7.5% per
 *     upgrade tier in PvP) in PvE.
 *   Frost: 10% max-HP + 30 flat (plus 20% extra damage taken while frostbitten).
 *   Poison: 7 / 6 / 5 per tick (base / strong / poison mist).
 *   Scarlet Rot: 18 / 12 per tick (base / rot mist / exhalation).
 *   Madness: 100 + 7.5% max FP / 50 HP.
 *   Sleep: instant sleep status.
 *
 * For now we expose `calculateStatusBuildup` to compute per-hit buildup and
 * `procsToTrigger` for the expected proc count.
 */

import {
  AttackPowerType,
} from "../types";

import type { WeaponAttackResult } from "./ar";

/**
 * Generator of status motion values per attack type.
 * Defined in a separate data file once motion-value support lands.
 */
export type StatusMotionValueProvider = (
  attackTag: string,
  isPowerstance: boolean,
  charged: boolean,
) => number;

/**
 * Multiplier applied to powerstance status buildup post patch 1.07. The
 * community-confirmed factor is 0.7 (a 30% reduction) for most statuses.
 */
export const POWERSTANCE_STATUS_MULTIPLIER_POST_1_07 = 0.7;

/**
 * Calculate the status buildup delivered by a hit.
 *
 * If a status motion provider is supplied the per-attack multiplier is
 * looked up; otherwise the caller can pass it directly via `motionValue`.
 */
export function calculateStatusBuildup(input: {
  attackRating: WeaponAttackResult;
  statusType: AttackPowerType;
  /** Direct motion value override (e.g. 100 for R1, 110 for jump). */
  motionValue?: number;
  /** If true, the powerstance status reduction is applied. */
  isPowerstance?: boolean;
  /** If true, seppuku etc. patch notes modifiers apply. */
  seppukuActive?: boolean;
}): number {
  const ar = input.attackRating.attackPower[input.statusType]?.total ?? 0;
  const mv = input.motionValue ?? 100;
  let out = (ar * mv) / 100;

  if (input.isPowerstance) {
    // Patch 1.07: powerstance status moves use ~70% of the listed motion value.
    out *= POWERSTANCE_STATUS_MULTIPLIER_POST_1_07;
  }
  if (input.seppukuActive) {
    // Seppuku adds flat bleed buildup that scales differently; not stacked here.
    // The Seppuku buff itself is applied via the buff system when implemented.
  }

  return out;
}

/**
 * Number of hits required to trigger the status proc. The enemy resistance
 * (a flat value) is subtracted from the delivered buildup per hit, and the
 * threshold must be reached without regenerating past zero. For simplicity we
 * use the steady-state approximation: ceil(threshold / buildupPerHit).
 */
export function procsToTrigger(input: {
  buildupPerHit: number;
  threshold: number;
  enemyResistance: number;
  /** Regeneration per second. */
  regenerationPerSec?: number;
  /** Approximate interval between hits, seconds. */
  hitIntervalSec?: number;
}): number {
  if (input.buildupPerHit <= 0) return Infinity;
  let effective = input.buildupPerHit - input.enemyResistance * 0.1;
  if (effective <= 0) effective = input.buildupPerHit * 0.1;

  if (input.regenerationPerSec && input.hitIntervalSec) {
    const decay = (input.regenerationPerSec * input.hitIntervalSec) / 2;
    effective = Math.max(1, effective - decay);
  }

  return Math.ceil(input.threshold / effective);
}

/** Expected damage from triggering a bleed proc on an enemy. */
export function bleedProcDamage(enemyMaxHp: number, isPvP = false): number {
  if (isPvP) return 100 + enemyMaxHp * 0.15;
  return enemyMaxHp * 0.15 + 100;
}

/** Expected damage from triggering a frost proc on an enemy. */
export function frostProcDamage(enemyMaxHp: number): number {
  return Math.floor(enemyMaxHp * 0.10) + 30;
}

/** Expected DPS from a poison proc (over its full duration). */
export function poisonProcDps(level = "base"): number {
  // Per-tick values are 7/6/5 per 1.1 sec for base/strong/mist; we expose the
  // canonical average per tick to mirror the in-game tooltip.
  if (level === "strong") return 7;
  if (level === "mist") return 18;
  return 5;
}

/** Expected DPS from a scarlet-rot proc. */
export function scarletRotProcDps(level = "base"): number {
  if (level === "strong") return 18;
  if (level === "mist") return 21;
  return 12;
}
