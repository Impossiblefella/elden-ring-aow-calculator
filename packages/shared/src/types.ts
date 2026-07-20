/**
 * types.ts — strongly typed structures for the Elden Ring damage engine.
 *
 * Indices and identifiers mirror the field names used in `regulation.bin`
 * (EquipParamWeapon, ReinforceParamWeapon, CalcCorrectGraph,
 *  AttackElementCorrectParam, AtkParam, BulletParam, BehaviorParam,
 *  SpEffectParam).
 */

/** Numeric IDs exactly match the game enum AttackElementCorrectParam damage slots. */
export enum AttackPowerType {
  PHYSICAL = 0,
  MAGIC = 1,
  FIRE = 2,
  LIGHTNING = 3,
  HOLY = 4,

  POISON = 5,
  SCARLET_ROT = 6,
  BLEED = 7,
  FROST = 8,
  SLEEP = 9,
  MADNESS = 10,
  DEATH_BLIGHT = 11,
}

/** Scalar damage types affected by enemy absorption. */
export const allDamageTypes: readonly AttackPowerType[] = [
  AttackPowerType.PHYSICAL,
  AttackPowerType.MAGIC,
  AttackPowerType.FIRE,
  AttackPowerType.LIGHTNING,
  AttackPowerType.HOLY,
] as const;

/** Status effect types (buildup). */
export const allStatusTypes: readonly AttackPowerType[] = [
  AttackPowerType.POISON,
  AttackPowerType.SCARLET_ROT,
  AttackPowerType.BLEED,
  AttackPowerType.FROST,
  AttackPowerType.SLEEP,
  AttackPowerType.MADNESS,
  AttackPowerType.DEATH_BLIGHT,
] as const;

export const attackPowerTypeName: Record<AttackPowerType, string> = {
  [AttackPowerType.PHYSICAL]: "Physical",
  [AttackPowerType.MAGIC]: "Magic",
  [AttackPowerType.FIRE]: "Fire",
  [AttackPowerType.LIGHTNING]: "Lightning",
  [AttackPowerType.HOLY]: "Holy",
  [AttackPowerType.POISON]: "Poison",
  [AttackPowerType.SCARLET_ROT]: "Scarlet Rot",
  [AttackPowerType.BLEED]: "Bleed",
  [AttackPowerType.FROST]: "Frost",
  [AttackPowerType.SLEEP]: "Sleep",
  [AttackPowerType.MADNESS]: "Madness",
  [AttackPowerType.DEATH_BLIGHT]: "Death Blight",
};

export enum Attribute {
  VIGOR = "vigor",
  MIND = "mind",
  ENDURANCE = "endurance",
  STRENGTH = "str",
  DEXTERITY = "dex",
  INTELLIGENCE = "int",
  FAITH = "fai",
  ARCANE = "arc",
}

export const allAttributes: readonly Attribute[] = [
  Attribute.VIGOR,
  Attribute.MIND,
  Attribute.ENDURANCE,
  Attribute.STRENGTH,
  Attribute.DEXTERITY,
  Attribute.INTELLIGENCE,
  Attribute.FAITH,
  Attribute.ARCANE,
] as const;

export type Attributes = Record<Attribute, number>;

export enum WeaponType {
  DAGGER = 1,
  STRAIGHT_SWORD = 3,
  GREATSWORD = 5,
  COLOSSAL_SWORD = 7,
  CURVED_SWORD = 9,
  CURVED_GREATSWORD = 11,
  KATANA = 13,
  TWINBLADE = 14,
  THRUSTING_SWORD = 15,
  HEAVY_THRUSTING_SWORD = 16,
  AXE = 17,
  GREATAXE = 19,
  HAMMER = 21,
  GREAT_HAMMER = 23,
  FLAIL = 24,
  SPEAR = 25,
  GREAT_SPEAR = 28,
  HALBERD = 29,
  REAPER = 31,
  FIST = 35,
  CLAW = 37,
  WHIP = 39,
  COLOSSAL_WEAPON = 41,
  LIGHT_BOW = 50,
  BOW = 51,
  GREATBOW = 53,
  CROSSBOW = 55,
  BALLISTA = 56,
  GLINTSTONE_STAFF = 57,
  DUAL_CATALYST = 59,
  SACRED_SEAL = 61,
  SMALL_SHIELD = 65,
  MEDIUM_SHIELD = 67,
  GREATSHIELD = 69,
  TORCH = 87,
  HAND_TO_HAND = 88,
  PERFUME_BOTTLE = 89,
  THRUSTING_SHIELD = 90,
  THROWING_BLADE = 91,
  BACKHAND_BLADE = 92,
  LIGHT_GREATSWORD = 93,
  GREAT_KATANA = 94,
  BEAST_CLAW = 95,
}

export const weaponTypeName: Record<WeaponType, string> = {
  [WeaponType.DAGGER]: "Dagger",
  [WeaponType.STRAIGHT_SWORD]: "Straight Sword",
  [WeaponType.GREATSWORD]: "Greatsword",
  [WeaponType.COLOSSAL_SWORD]: "Colossal Sword",
  [WeaponType.CURVED_SWORD]: "Curved Sword",
  [WeaponType.CURVED_GREATSWORD]: "Curved Greatsword",
  [WeaponType.KATANA]: "Katana",
  [WeaponType.TWINBLADE]: "Twinblade",
  [WeaponType.THRUSTING_SWORD]: "Thrusting Sword",
  [WeaponType.HEAVY_THRUSTING_SWORD]: "Heavy Thrusting Sword",
  [WeaponType.AXE]: "Axe",
  [WeaponType.GREATAXE]: "Greataxe",
  [WeaponType.HAMMER]: "Hammer",
  [WeaponType.GREAT_HAMMER]: "Great Hammer",
  [WeaponType.FLAIL]: "Flail",
  [WeaponType.SPEAR]: "Spear",
  [WeaponType.GREAT_SPEAR]: "Great Spear",
  [WeaponType.HALBERD]: "Halberd",
  [WeaponType.REAPER]: "Reaper",
  [WeaponType.FIST]: "Fist",
  [WeaponType.CLAW]: "Claw",
  [WeaponType.WHIP]: "Whip",
  [WeaponType.COLOSSAL_WEAPON]: "Colossal Weapon",
  [WeaponType.LIGHT_BOW]: "Light Bow",
  [WeaponType.BOW]: "Bow",
  [WeaponType.GREATBOW]: "Greatbow",
  [WeaponType.CROSSBOW]: "Crossbow",
  [WeaponType.BALLISTA]: "Ballista",
  [WeaponType.GLINTSTONE_STAFF]: "Glintstone Staff",
  [WeaponType.DUAL_CATALYST]: "Dual Catalyst",
  [WeaponType.SACRED_SEAL]: "Sacred Seal",
  [WeaponType.SMALL_SHIELD]: "Small Shield",
  [WeaponType.MEDIUM_SHIELD]: "Medium Shield",
  [WeaponType.GREATSHIELD]: "Greatshield",
  [WeaponType.TORCH]: "Torch",
  [WeaponType.HAND_TO_HAND]: "Hand-to-Hand",
  [WeaponType.PERFUME_BOTTLE]: "Perfume Bottle",
  [WeaponType.THRUSTING_SHIELD]: "Thrusting Shield",
  [WeaponType.THROWING_BLADE]: "Throwing Blade",
  [WeaponType.BACKHAND_BLADE]: "Backhand Blade",
  [WeaponType.LIGHT_GREATSWORD]: "Light Greatsword",
  [WeaponType.GREAT_KATANA]: "Great Katana",
  [WeaponType.BEAST_CLAW]: "Beast Claw",
};

export enum AffinityId {
  STANDARD = 0,
  HEAVY = 1,
  KEEN = 2,
  QUALITY = 3,
  FIRE = 4,
  FLAME_ART = 5,
  LIGHTNING = 6,
  SACRED = 7,
  MAGIC = 8,
  COLD = 9,
  POISON = 10,
  BLOOD = 11,
  OCCULT = 12,
  UNIQUE = 100,
}

export const affinityName: Record<AffinityId, string> = {
  [AffinityId.STANDARD]: "Standard",
  [AffinityId.HEAVY]: "Heavy",
  [AffinityId.KEEN]: "Keen",
  [AffinityId.QUALITY]: "Quality",
  [AffinityId.FIRE]: "Fire",
  [AffinityId.FLAME_ART]: "Flame Art",
  [AffinityId.LIGHTNING]: "Lightning",
  [AffinityId.SACRED]: "Sacred",
  [AffinityId.MAGIC]: "Magic",
  [AffinityId.COLD]: "Cold",
  [AffinityId.POISON]: "Poison",
  [AffinityId.BLOOD]: "Blood",
  [AffinityId.OCCULT]: "Occult",
  [AffinityId.UNIQUE]: "Unique",
};

/** Physics attribute used for standard damage calculation. */
export const PHYSICAL_ATTACK_TYPES = new Set(
  [AttackPowerType.PHYSICAL, AttackPowerType.MAGIC, AttackPowerType.FIRE, AttackPowerType.LIGHTNING, AttackPowerType.HOLY],
) as ReadonlySet<AttackPowerType>;

/** Same enum but without const for runtime use. */
export const anyAttackPowerType: AttackPowerType[] = [
  AttackPowerType.PHYSICAL,
  AttackPowerType.MAGIC,
  AttackPowerType.FIRE,
  AttackPowerType.LIGHTNING,
  AttackPowerType.HOLY,
  AttackPowerType.POISON,
  AttackPowerType.SCARLET_ROT,
  AttackPowerType.BLEED,
  AttackPowerType.FROST,
  AttackPowerType.SLEEP,
  AttackPowerType.MADNESS,
  AttackPowerType.DEATH_BLIGHT,
];

/** Attack type tag used by the damage formula chain (Physical|Magic|Fire|Lightning|Holy|Standard|Pierce|Strike|Slash). */
export enum PhysicalAttackType {
  STANDARD = 0,
  SLASHING = 1,
  PIERCING = 2,
  STRIKING = 3,
  MAGIC = 4,
  FIRE = 5,
  LIGHTNING = 6,
  HOLY = 7,
}

export const defaultUnupgradedLevel = 0;
export const defaultMaxUpgradeLevel = 25;
