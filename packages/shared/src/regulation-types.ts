/**
 * regulation-types.ts — type definitions mirroring regulation.bin parameter schemas.
 *
 * These come directly from `EquipParamWeapon`, `ReinforceParamWeapon`,
 * `CalcCorrectGraph`, `AttackElementCorrectParam`, and `SpEffectParam`.
 * Field names closely track the names found in Smithbox / SoulsFormats.
 */

import type {
  AffinityId,
  AttackPowerType,
  Attribute,
  Attributes,
  WeaponType,
} from "./types";

/**
 * A single stage of a CalcCorrectGraph (growth curve). The array in
 * regulation.bin stores an ordered list of stages; each stage declares the
 * attribute value where it ends and the maximum scaling reached within it.
 *
 * Using the formula in nyedr/elden-ring-ar-calculator we interpolate each
 * integer attribute value between stages.
 */
export interface CalcCorrectGraphStage {
  /** Maximum attribute value for this stage (exclusive end point). */
  maxVal: number;
  /** Scaling value reached at the top of this stage. */
  maxGrowVal: number;
  /** Exponent applied to the interpolation ratio; 0 means linear. */
  adjPt: number;
}

export type CalcCorrectGraph = CalcCorrectGraphStage[];

/**
 * For a single AttackPowerType, declares which attributes scale and how. The
 * value can be `true` (use the raw scaling multiplier from the weapon) or a
 * number (multiplier applied to the attribute's normalised scaling).
 *
 * This is exactly the shape stored in `AttackElementCorrectParam`.
 */
export type AttackElementCorrectEntry =
  Partial<Record<Attribute, number | boolean>>;

export type AttackElementCorrect =
  Partial<Record<AttackPowerType, AttackElementCorrectEntry>>;

/** ReinforceParamWeapon row, per upgrade level. */
export interface ReinforceParamWeapon {
  /** Multiplier applied to the weapon's base attack per damage type. */
  attack: Partial<Record<AttackPowerType, number>>;
  /** Multiplier applied to the weapon's scaling per attribute. */
  attributeScaling: Partial<Record<Attribute, number>>;
  /** Status spEffect ids the weapon unlocks at this upgrade level. */
  statusSpEffectId1?: number;
  statusSpEffectId2?: number;
  statusSpEffectId3?: number;
}

/** Per-damage-type status data from SpEffectParam. */
export type StatusSpEffectParam = Partial<Record<AttackPowerType, number>>;

/** Scaling tier "letter" descriptor (strength of scaling). */
export interface ScalingTier {
  /** Minimum normalised scaling for the letter to apply. */
  min: number;
  /** Human readable label, e.g. "S", "A", "B". */
  label: string;
}

/** A raw weapon row from EquipParamWeapon before being decoded. */
export interface RawWeaponRow {
  /** Row id in `EquipParamWeapon`. */
  id: number;
  name: string;
  weaponType: WeaponType;
  affinityId: AffinityId;
  requirements: Partial<Record<Attribute, number>>;
  /** Base scaling multipliers (unupgraded). */
  attributeScaling: Partial<Record<Attribute, number>>;
  /** Base attack values (unupgraded). */
  attack: Partial<Record<AttackPowerType, number>>;
  /** Optional IDs into SpEffectParam for status effects the weapon inflicts. */
  statusSpEffectParamIds?: number[];
  /** Identifier into ReinforceParamWeapon. */
  reinforceTypeId: number;
  /** Identifier into AttackElementCorrectParam. */
  attackElementCorrectId: number;
  /** Identifier into CalcCorrectGraph per damage type. */
  calcCorrectGraphIds?: Partial<Record<AttackPowerType, number>>;
  /** If true, two-handing bonus does not apply (paired weapons, bows). */
  paired?: boolean;
  /** If true, weapon can be used as a sorcery catalyst. */
  sorceryTool?: boolean;
  /** If true, weapon can be used as an incantation catalyst. */
  incantationTool?: boolean;
  dlc?: boolean;
}

/** Attack power per AttackPowerType at a single upgrade level. */
export type AttackPowerByType = Partial<Record<AttackPowerType, number>>;
/** Attribute scaling per attribute at a single upgrade level. */
export type AttributeScalingByAttr = Partial<Record<Attribute, number>>;

/**
 * Denormalised weapon ready for use by the formula engine. Pre-computes the
 * effective attack power, scaling values and growth curves for each upgrade
 * level so engine code never has to hit the regulation database again.
 */
export interface Weapon {
  id: number;
  name: string;
  weaponType: WeaponType;
  affinityId: AffinityId;
  requirements: Partial<Record<Attribute, number>>;
  paired: boolean;
  sorceryTool: boolean;
  incantationTool: boolean;
  dlc: boolean;
  /** True when the weapon uses a unique +10 reinforce curve instead of +25. */
  isSpecialWeapon: boolean;

  /** Index = upgrade level, 0..max (25 for normal weapons, 10 for special). */
  attack: AttackPowerByType[];
  attributeScaling: AttributeScalingByAttr[];
  attackElementCorrect: AttackElementCorrect;
  /** Pre-computed growth curve values per attribute value (1..). */
  calcCorrectGraphs: Partial<Record<AttackPowerType, number[]>>;
  scalingTiers: ScalingTier[];
  /** Inherent enemy-type multipliers (weakA/B/C/D in EquipParamWeapon). */
  enemyDamageMultipliers?: Partial<Record<string, number>>;
}

/**
 * Compact JSON representation of the regulation database. Saved to disk so
 * the web client and the server can share an identical snapshot.
 */
export interface RegulationDatabase {
  /** Generation timestamp. */
  generatedAt: string;
  /** Patch identifier extracted from the archive; unknown if absent. */
  patchId: string | null;
  calcCorrectGraphs: Record<number, CalcCorrectGraph>;
  attackElementCorrects: Record<number, AttackElementCorrect>;
  reinforceTypes: Record<number, ReinforceParamWeapon[]>;
  statusSpEffectParams: Record<number, StatusSpEffectParam>;
  scalingTiers: ScalingTier[];
  weapons: RawWeaponRow[];
  /** Decoded weapons indexed by id for direct lookups. */
  decodedWeapons?: Weapon[];
  /** Ash of War rows (added in milestone 4+). */
  ashesOfWar?: AshOfWarEntry[];
}

/** A single Ash of War definition. */
export interface AshOfWarEntry {
  id: number;
  name: string;
  /** Compatible weapon classes. */
  compatibleWeaponTypes: WeaponType[];
  /** Compatible affinities. */
  compatibleAffinities: AffinityId[];
  damageMotionValues: Partial<Record<AttackPowerType, number>>;
  baseDamage: number;
  baseBulletDamage: Partial<Record<AttackPowerType, number>>;
  /** Stance/poise damage of the skill itself. */
  poiseDamage?: number;
  /** If true the skill is a projectile (Bullet) Ash of War. */
  isProjectile: boolean;
  /** FP cost of the Ash of War skill. */
  fpCost?: number;
  /** In-game description of the skill. */
  description?: string;
  /** Damage multiplier when charged (e.g. 1.4 = 40% more damage). Default 1.0. */
  chargeMultiplier?: number;
}

/** Editable player attributes used by the character builder. */
export type CharacterStats = Attributes;

