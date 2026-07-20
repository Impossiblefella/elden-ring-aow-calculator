/**
 * ar.ts — Attack Rating calculation engine.
 *
 * This is the core of the damage pipeline. Given a decoded weapon (with
 * pre-computed per-upgrade-level attack, scaling, and growth curves) and a
 * set of player attributes, calculate the attack rating (AR) for each damage
 * type.
 *
 * Ported from nyedr/elden-ring-ar-calculator (calculator.ts) with
 * strong typing and isolated from any UI concerns so it can be unit-tested.
 *
 * Key formulas:
 *  1. Adjust STR for two-handing (×1.5).
 *  2. For each damage/status type that the weapon has base attack for:
 *     a. Look up the AttackElementCorrectParam entry to see which attributes
 *        scale that damage type.
 *     b. For each scaling attribute, compute: scaling = attributeScaling[upgrade]
 *        × calcCorrectGraph[attrValue]. If the AEC entry is a number (not
 *        true), divide by attributeScaling[0] first to normalize.
 *     c. totalScaling = 1 + Σ(scaling × calcCorrectGraph[attrValue])
 *     d. AR = baseAttack[upgrade] × totalScaling
 *  3. If the player doesn't meet weapon requirements and the scaling attribute
 *     is one of the unmet ones, apply a penalty (totalScaling = 1 - 0.4 = 0.6)
 *     instead of a bonus.
 */

import {
  allAttributes,
  allDamageTypes,
  allStatusTypes,
  Attribute,
  Attributes,
  AttackPowerType,
  WeaponType,
} from "../types";
import type {
  AttackElementCorrect,
  AttackElementCorrectEntry,
  Weapon,
} from "../regulation-types";

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Adjust character attributes for two-handing. Two-handing grants +50% STR
 * (floor) for the purposes of both meeting requirements and calculating
 * scaling. Paired weapons and bows have special rules:
 *  - Paired (powerstance) weapons never get the 2H bonus.
 *  - Bows / ballistae are always treated as two-handed.
 */
export function adjustAttributesForTwoHanding(input: {
  twoHanding?: boolean;
  weapon: Weapon;
  attributes: Attributes;
}): Attributes {
  let twoHandingBonus = input.twoHanding ?? false;

  // Paired weapons (twinblades, fists, etc.) don't get 2H STR bonus.
  if (input.weapon.paired) {
    twoHandingBonus = false;
  }

  // Bows and ballistae are always two-handed.
  const always2h =
    input.weapon.weaponType === WeaponType.LIGHT_BOW ||
    input.weapon.weaponType === WeaponType.BOW ||
    input.weapon.weaponType === WeaponType.GREATBOW ||
    input.weapon.weaponType === WeaponType.BALLISTA;
  if (always2h) {
    twoHandingBonus = true;
  }

  if (twoHandingBonus) {
    return { ...input.attributes, str: Math.floor(input.attributes.str * 1.5) };
  }
  return input.attributes;
}

// ─── types ──────────────────────────────────────────────────────────────────

export interface AttackPower {
  /** Total AR for this damage type (base + scaling). */
  total: number;
  /** Scaling contribution only (total - base). */
  scaled: number;
  /** Base weapon attack power (before scaling). */
  weapon: number;
}

export interface WeaponAttackResult {
  upgradeLevel: number;
  attackPower: Partial<Record<AttackPowerType, AttackPower>>;
  spellScaling: Partial<Record<AttackPowerType, number>>;
  ineffectiveAttributes: Attribute[];
  ineffectiveAttackPowerTypes: AttackPowerType[];
  /** The attribute values used after two-handing adjustment, for display/debug. */
  effectiveAttributes: Attributes;
  weapon: Weapon;
}

export interface WeaponAttackOptions {
  weapon: Weapon;
  attributes: Attributes;
  twoHanding?: boolean;
  upgradeLevel: number;
  /** If true, two-handing's STR bonus does NOT apply to attack power scaling
   *  (used for some AoW skills that disable the 2H bonus). */
  disableTwoHandingAttackPowerBonus?: boolean;
  /** Penalty fraction when weapon requirements aren't met (default 0.4 = 40%). */
  ineffectiveAttributePenalty?: number;
}

// ─── core calculation ───────────────────────────────────────────────────────

/**
 * Compute the full attack rating for a weapon at a given upgrade level and
 * player stat distribution. Returns per-damage-type AR and spell scaling (for
 * catalysts).
 */
export function getWeaponAttack({
  weapon,
  attributes,
  twoHanding,
  upgradeLevel,
  disableTwoHandingAttackPowerBonus = false,
  ineffectiveAttributePenalty = 0.4,
}: WeaponAttackOptions): WeaponAttackResult {
  const adj = adjustAttributesForTwoHanding({ twoHanding, weapon, attributes });

  // Determine which attributes are below the weapon's requirements.
  // Uses adjusted attributes (so 2H STR can meet STR requirements).
  const ineffectiveAttributes = (
    Object.entries(weapon.requirements) as [Attribute, number][]
  ).filter(
    ([attribute, requirement]) => adj[attribute] < requirement,
  ).map(([attribute]) => attribute);

  const ineffectiveAttackPowerTypes: AttackPowerType[] = [];
  const attackPower: Partial<Record<AttackPowerType, AttackPower>> = {};
  const spellScaling: Partial<Record<AttackPowerType, number>> = {};

  for (const apt of [...allDamageTypes, ...allStatusTypes]) {
    const isDamageType = (allDamageTypes as readonly AttackPowerType[]).includes(apt);

    const baseAttackPower = weapon.attack[upgradeLevel]?.[apt] ?? 0;

    if (!baseAttackPower && !weapon.sorceryTool && !weapon.incantationTool) {
      continue;
    }

    // Look up which attributes scale this damage type.
    const scalingAttributes = weapon.attackElementCorrect[apt] ?? {};

    let totalScaling = 1; // start at 1 (base); scaling adds on top

    const scalingAttrIneffective = ineffectiveAttributes.some(
      (attr) => scalingAttributes[attr],
    );

    if (scalingAttrIneffective) {
      // Requirement not met for a scaling attribute → penalty.
      totalScaling = 1 - ineffectiveAttributePenalty;
      ineffectiveAttackPowerTypes.push(apt);
    } else {
      // Normal path: sum up scaling contributions from all relevant attributes.
      const effectiveAttributes =
        !disableTwoHandingAttackPowerBonus && isDamageType ? adj : attributes;

      for (const attr of allAttributes) {
        const attributeCorrect = scalingAttributes[attr];
        if (!attributeCorrect) continue;

        let scaling: number;
        if (attributeCorrect === true) {
          // AEC entry is `true`: use the raw scaling multiplier directly.
          scaling = weapon.attributeScaling[upgradeLevel]?.[attr] ?? 0;
        } else {
          // AEC entry is a number: normalise relative to the unupgraded
          // scaling value so the AEC multiplier is applied as a ratio.
          const base = weapon.attributeScaling[0]?.[attr] ?? 0;
          if (base === 0) {
            scaling = 0;
          } else {
            scaling =
              (attributeCorrect *
                (weapon.attributeScaling[upgradeLevel]?.[attr] ?? 0)) /
              base;
          }
        }

        if (scaling) {
          const attrValue = effectiveAttributes[attr];
          const graphVal = weapon.calcCorrectGraphs[apt]?.[attrValue] ?? 0;
          totalScaling += graphVal * scaling;
        }
      }
    }

    // Compute final AR.
    if (baseAttackPower) {
      attackPower[apt] = {
        total: baseAttackPower * totalScaling,
        scaled: baseAttackPower * totalScaling - baseAttackPower,
        weapon: baseAttackPower,
      };
    }

    if (isDamageType && (weapon.sorceryTool || weapon.incantationTool)) {
      spellScaling[apt] = 100 * totalScaling;
    }
  }

  return {
    upgradeLevel,
    attackPower,
    spellScaling,
    ineffectiveAttributes,
    ineffectiveAttackPowerTypes,
    effectiveAttributes: adj,
    weapon,
  };
}

/**
 * Sum the `total` field across all damage types for an attack rating result.
 * Only sums scalar damage types (physical/magic/fire/lightning/holy), not
 * status effects.
 */
export function getTotalAttackRating(result: WeaponAttackResult): number {
  let total = 0;
  for (const apt of allDamageTypes) {
    total += result.attackPower[apt]?.total ?? 0;
  }
  return total;
}

/**
 * Round to the nearest integer, matching Elden Ring's display convention
 * (AR is shown as floor, but damage is computed with the full float).
 */
export function roundAttackRating(value: number): number {
  return Math.floor(value);
}

/**
 * Backward-compatible alias: older code (server, etc.) refers to
 * `AttackRatingResult`. Keep the alias so existing imports work.
 */
export type AttackRatingResult = WeaponAttackResult;
