/**
 * defense.ts — Enemy defense and absorption calculations.
 *
 * Implements the Elden Ring damage-negation formula:
 *
 *   attackRatio   = (AR × motionValue) / (defense × 100)
 *   defenseMult   = piecewise(attackRatio)
 *   finalDamage   = (AR × motionValue / 100) × (1 − absorption/100) × defenseMult
 *
 * The piecewise function is the core of FromSoftware's "defense" system —
 * it creates diminishing returns for low-AR attacks against high-defense
 * targets and near-linear behaviour for high-AR attacks.
 *
 * This is abstracted from nyedr/elden-ring-ar-calculator (calculator.ts)
 * with explicit typing and no UI dependencies.
 */

import { AttackPowerType } from "../types";

/**
 * The piecewise defense multiplier. Identical across all damage types.
 *
 *  ratio < 0.125  → 0.1
 *  ratio < 1      → 0.1 + (ratio − 0.125)² / 2.552
 *  ratio < 2.5    → 0.7 − (2.5 − ratio)² / 7.5
 *  ratio < 8      → 0.9 − (8 − ratio)² / 151.25
 *  ratio ≥ 8      → 0.9
 */
export function calculateDefenseMultiplier(attackRatio: number): number {
  if (Number.isNaN(attackRatio)) return 0;
  if (attackRatio < 0.125) {
    return 0.1;
  } else if (attackRatio < 1) {
    return 0.1 + Math.pow(attackRatio - 0.125, 2) / 2.552;
  } else if (attackRatio < 2.5) {
    return 0.7 - Math.pow(2.5 - attackRatio, 2) / 7.5;
  } else if (attackRatio < 8) {
    return 0.9 - Math.pow(8 - attackRatio, 2) / 151.25;
  } else {
    return 0.9;
  }
}

/**
 * Configuration for a single enemy defense calculation.
 */
export interface DefenseCalculationInput {
  /** Total AR for the relevant damage type. */
  attackRating: number;
  /** The damage type (unused in the formula but used for type-safe dispatch). */
  damageType: AttackPowerType;
  /** Enemy flat defense value for this damage type. */
  enemyDefense: number;
  /** Enemy absorption (a.k.a. damage negation) as a percentage (e.g. 20 = -20%). */
  absorptionPercent: number;
  /** Motion value multiplier (100 = full AR). Default 100. */
  motion?: number | [number, string][];
}

/**
 * Absorption key is the same as AttackPowerType for damage types; "Standard"
 * physical attacks use the Physical absorption value.
 */
export type AbsorptionKey = AttackPowerType;

/**
 * Calculate the actual damage dealt to an enemy for one damage type, given
 * the weapon's total AR for that type and the enemy's defense + absorption.
 *
 * Supports split motion values via the `motion` field:
 *   - A single number (e.g. 100) — the traditional case.
 *   - An array of [motionValue, attackType] tuples (e.g. [[60, "Slash"], [40, "Pierce"]]).
 *     Each sub-hit is run through the defense formula independently and summed,
 *     which correctly models the non-linear defense curve for multi-hit attacks.
 */
export function damageAgainstEnemy(input: DefenseCalculationInput): number {
  const mv = input.motion ?? 100;

  // Single numeric motion value — the common case.
  if (typeof mv === "number") {
    return singleHitDamage(input.attackRating, mv, input.enemyDefense, input.absorptionPercent);
  }

  // Array of [motionValue, attackType] tuples — split damage.
  let total = 0;
  for (const [subMv] of mv) {
    total += singleHitDamage(input.attackRating, subMv, input.enemyDefense, input.absorptionPercent);
  }
  return total;
}

/** Core formula for a single sub-hit. */
function singleHitDamage(
  ar: number,
  motion: number,
  defense: number,
  absorption: number,
): number {
  if (ar <= 0 || motion <= 0) return 0;
  if (defense <= 0) {
    // No defense to ratio against — just apply absorption.
    return (ar * motion) / 100 * (1 - absorption / 100);
  }
  const baseDamage = (ar * motion) / 100;
  const attackRatio = (ar * motion) / (defense * 100);
  const defenseMult = calculateDefenseMultiplier(attackRatio);
  return baseDamage * (1 - absorption / 100) * defenseMult;
}

/**
 * Convenience wrapper that accepts positional arguments for simpler test
 * and call-site ergonomics:
 *   applyDefense(attackRating, absorptionPercent, enemyDefense, motion)
 */
export function applyDefense(
  attackRating: number,
  absorptionPercent: number,
  enemyDefense: number,
  motion: number = 100,
): number {
  return singleHitDamage(attackRating, motion, enemyDefense, absorptionPercent);
}

/**
 * Convenience: calculate damage for multiple damage types at once, given a
 * per-type AR record and an enemy defense + absorption record.
 */
export function damageAgainstEnemyMulti(
  attackRatings: Partial<Record<AttackPowerType, number>>,
  enemyDefence: Partial<Record<AttackPowerType, number>>,
  enemyAbsorption: Partial<Record<AttackPowerType, number>>,
  motion: number = 100,
): Record<AttackPowerType, number> {
  const result = {} as Record<AttackPowerType, number>;
  for (const apt of Object.keys(attackRatings) as unknown as AttackPowerType[]) {
    const ar = attackRatings[apt];
    if (!ar) continue;
    const def = enemyDefence[apt] ?? 0;
    const abs = enemyAbsorption[apt] ?? 0;
    if (def === 0) {
      result[apt] = ar;
      continue;
    }
    result[apt] = damageAgainstEnemy({
      attackRating: ar,
      damageType: apt,
      enemyDefense: def,
      absorptionPercent: abs,
      motion,
    });
  }
  return result;
}

/**
 * Round to integer for display purposes.
 */
export function round(value: number): number {
  return Math.round(value);
}
