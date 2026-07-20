/**
 * aow.ts — Ash of War damage calculations.
 *
 * Three types of AoW damage:
 *
 *  1. **Simple Skill Hit** (calculateSkillHitDamage):
 *     Multiplies the weapon's total AR by the AoW's per-damage-type motion
 *     value. Used for arts that are essentially a weapon swing with modified
 *     motion values (e.g. Spinning Slash).
 *
 *  2. **Enhanced Hit** (calculateEnhancedHitDamage):
 *     For arts that add a flat damage buff on top of the weapon swing.
 *     Buff strength scales with weapon upgrade level and the player's
 *     highest scaling attribute.
 *
 *  3. **Bullet / Projectile** (calculateBulletHitDamage):
 *     For arts that fire a projectile (e.g. Ice Spear, Loretta's Greatbow).
 *     Base bullet damage comes from the AoW definition and scales with
 *     weapon upgrade level, the player's stats, and a fixed base scaling
 *     coefficient.
 *
 * Ported from nyedr/elden-ring-ar-calculator (aowCalculator.ts).
 */

import {
  allDamageTypes,
  AttackPowerType,
  Attribute,
  Attributes,
  AffinityId,
} from "../types";
import type { AshOfWarEntry, Weapon } from "../regulation-types";
import {
  getTotalAttackRating,
  type WeaponAttackResult,
} from "./ar";

/**
 * Identify the highest scaling attribute for the weapon at this upgrade level.
 * Used to determine which stat drives the AoW's bullet/enhanced damage.
 */
function getHighestScalingAttribute(
  weapon: Weapon,
  upgradeLevel: number,
): Attribute {
  const entries = Object.entries(
    weapon.attributeScaling[upgradeLevel] ?? {},
  ).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (entries.length === 0) return Attribute.STRENGTH;
  return entries[0][0] as Attribute;
}

/**
 * Get the scaling multiplier for the weapon's highest attribute at this
 * upgrade level. This is the ratio of the weapon's scaling at the current
 * upgrade level to its scaling at upgrade 0, which normalises the
 * affinity-specific growth.
 *
 * For the AoW formula, this replaces the `scalingMultiplierData` lookup
 * used by the reference calculator. The reference uses a static table keyed
 * by [upgradeLevel][affinityId][attribute]; we derive it from the actual
 * reinforce param data on the weapon.
 */
function getWeaponScalingMultiplier(
  weapon: Weapon,
  upgradeLevel: number,
  attribute: Attribute,
): number {
  // The scaling at the current upgrade level, normalised by the scaling at 0.
  // This gives us the "growth ratio" for this attribute.
  const current = weapon.attributeScaling[upgradeLevel]?.[attribute] ?? 0;
  const base = weapon.attributeScaling[0]?.[attribute] ?? 0;
  if (base === 0) return 1;
  return current / base;
}

// ─── Simple skill hit ───────────────────────────────────────────────────────

/**
 * Simple AoW damage: multiply weapon AR by the AoW's per-damage-type motion
 * values. Used by arts that are essentially buffed weapon swings.
 */
export function calculateSkillHitDamage(
  weaponAttack: WeaponAttackResult,
  ashOfWar: AshOfWarEntry,
): Partial<Record<AttackPowerType, number>> {
  const result: Partial<Record<AttackPowerType, number>> = {};
  for (const apt of allDamageTypes) {
    const ar = weaponAttack.attackPower[apt]?.total ?? 0;
    const mv = ashOfWar.damageMotionValues[apt] ?? 0;
    result[apt] = (ar * mv) / 100;
  }
  return result;
}

// ─── Enhanced hit ───────────────────────────────────────────────────────────

/**
 * Enhanced hit: adds a flat buff that scales with weapon upgrade level and
 * the player's highest scaling stat. Used by arts like Storm Blade, Flame
 * Strike, etc.
 */
export function calculateEnhancedHitDamage(
  weaponAttack: WeaponAttackResult,
  ashOfWar: AshOfWarEntry,
  playerAttributes: Attributes,
): Partial<Record<AttackPowerType, number>> {
  const { baseDamage: baseBuff, damageMotionValues } = ashOfWar;
  const attackRating = getTotalAttackRating(weaponAttack);
  const upgradeLevel = weaponAttack.upgradeLevel;
  const maxUpgradeLevel = weaponAttack.weapon.attack.length - 1;

  const highestScalingAttr = getHighestScalingAttribute(
    weaponAttack.weapon,
    upgradeLevel,
  );

  const affinityScalingMultiplier = getWeaponScalingMultiplier(
    weaponAttack.weapon,
    upgradeLevel,
    highestScalingAttr,
  );

  const percentUpgraded = maxUpgradeLevel > 0
    ? upgradeLevel / maxUpgradeLevel
    : 0;

  const result: Partial<Record<AttackPowerType, number>> = {};

  for (const apt of allDamageTypes) {
    const attrValue = playerAttributes[highestScalingAttr] ?? 1;
    const statMultiplier =
      weaponAttack.weapon.calcCorrectGraphs[apt]?.[attrValue] ?? 0;

    const statBonus = affinityScalingMultiplier * statMultiplier;
    const buffStrength = baseBuff * (1 + 3 * percentUpgraded) * (1 + statBonus);

    const motionValue = (damageMotionValues[apt] ?? 0) / 100;
    const damage = attackRating * motionValue + buffStrength;

    result[apt] = damage;
  }

  return result;
}

// ─── Bullet / projectile ────────────────────────────────────────────────────

/**
 * Bullet hit: for projectile arts like Ice Spear. The base bullet damage
 * scales with weapon upgrade level, the player's highest scaling stat, and
 * a fixed base scaling coefficient.
 *
 * Base scaling coefficients (from community data):
 *  - Single-stat bullet arts (Focus, Flame of the Redmanes): 0.25
 *  - Dual-stat bullet arts (Cold, Quality): 0.15
 *  - Unique weapon arts: use the weapon's own scaling (not implemented here)
 */
export function calculateBulletHitDamage(
  weaponAttack: WeaponAttackResult,
  ashOfWar: AshOfWarEntry,
  playerAttributes: Attributes,
): Partial<Record<AttackPowerType, number>> {
  const upgradeLevel = weaponAttack.upgradeLevel;
  const maxUpgradeLevel = weaponAttack.weapon.attack.length - 1;

  const highestScalingAttr = getHighestScalingAttribute(
    weaponAttack.weapon,
    upgradeLevel,
  );

  const affinityScalingMultiplier = getWeaponScalingMultiplier(
    weaponAttack.weapon,
    upgradeLevel,
    highestScalingAttr,
  );

  const affinityId = weaponAttack.weapon.affinityId;

  // Base scaling: 0.15 for Cold/Quality (dual-stat), 0.25 for others.
  const baseScaling =
    affinityId === AffinityId.COLD || affinityId === AffinityId.QUALITY
      ? 0.15
      : 0.25;

  // The bullet's motion value is stored in the PHYSICAL slot (convention).
  const bulletMotionValue =
    (ashOfWar.damageMotionValues[AttackPowerType.PHYSICAL] ?? 100) / 100;

  const percentUpgraded = maxUpgradeLevel > 0
    ? upgradeLevel / maxUpgradeLevel
    : 0;

  const result: Partial<Record<AttackPowerType, number>> = {};

  for (const apt of allDamageTypes) {
    const baseDamage = ashOfWar.baseBulletDamage[apt] ?? 0;
    if (baseDamage === 0) continue;

    const attrValue = playerAttributes[highestScalingAttr] ?? 1;
    const statMultiplier =
      weaponAttack.weapon.calcCorrectGraphs[apt]?.[attrValue] ?? 0;

    const statBonus = baseScaling * affinityScalingMultiplier * statMultiplier;

    const bulletDamage =
      baseDamage *
      (1 + 3 * percentUpgraded) *
      (1 + statBonus) *
      bulletMotionValue;

    result[apt] = bulletDamage;
  }

  return result;
}

/**
 * Dispatch convenience: compute AoW damage using the right method based on
 * the AshOfWarEntry's `isProjectile` flag.
 */
export function calculateAshOfWarDamage(
  weaponAttack: WeaponAttackResult,
  ashOfWar: AshOfWarEntry,
  playerAttributes: Attributes,
): Partial<Record<AttackPowerType, number>> {
  if (ashOfWar.isProjectile) {
    return calculateBulletHitDamage(weaponAttack, ashOfWar, playerAttributes);
  }
  if (ashOfWar.baseDamage > 0) {
    return calculateEnhancedHitDamage(weaponAttack, ashOfWar, playerAttributes);
  }
  return calculateSkillHitDamage(weaponAttack, ashOfWar);
}
