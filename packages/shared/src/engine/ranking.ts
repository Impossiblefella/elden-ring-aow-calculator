/**
 * ranking.ts — utility to rank every compatible weapon for an Ash of War scenario.
 *
 * Given an Ash of War definition, a player build (stats + upgrade level +
 * affinity), and an enemy database, compute damage for every compatible weapon
 * and return a sorted list. Supports: total, projectile, status buildup, DPS,
 * stance damage metrics.
 */
import { allDamageTypes, AttackPowerType, Attributes } from "../types";
import type { AshOfWarEntry, Weapon } from "../regulation-types";
import { getWeaponAttack, getTotalAttackRating } from "./ar";
import {
  calculateBulletHitDamage,
  calculateEnhancedHitDamage,
  calculateSkillHitDamage,
} from "./aow";
import { damageAgainstEnemy } from "./defense";
import { getMotionValueTable } from "./motion-values";
import { applyBuffs, getBuff } from "./buffs";
import type { Enemy } from "./enemy";
import {
  bleedProcDamage,
  frostProcDamage,
  poisonProcDps,
  scarletRotProcDps,
  procsToTrigger,
} from "./status";

export type RankingMetric =
  | "projectile"
  | "total"
  | "status"
  | "dps"
  | "stance";

export interface RankingOptions {
  ashOfWar: AshOfWarEntry;
  attributes: Attributes;
  upgradeLevel: number;
  enemy?: Enemy;
  metric?: RankingMetric;
  twoHanding?: boolean;
  buffIds?: string[];
  /** Critical hit multiplier (1.0 = normal, 1.6 = backstab, 4.0 = riposte). */
  critModifier?: number;
  /** If true, skill is charged — applies chargeMultiplier to skill damage. */
  charged?: boolean;
  /** If true, power stance — applies 1.5x to weapon AR before AoW calc. */
  powerStance?: boolean;
}

export interface RankingEntry {
  rank: number;
  weapon: Weapon;
  total: number;
  projectile: number;
  status: number;
  stance: number;
  dps: number;
  breakdown: Partial<Record<AttackPowerType, number>>;
}

// ── Motion value parsing ────────────────────────────────────────────────────
/**
 * Parse a motion value string like "82 + 82" into a total numeric value.
 * For multi-hit attacks, sums all hits.
 */
function parseMotionValue(mv: string): number {
  return mv
    .split("+")
    .map((p) => parseFloat(p.trim()))
    .reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
}

/** Get the R1 motion value total for a weapon type. */
function getR1MotionValue(weapon: Weapon): number {
  const table = getMotionValueTable(weapon.weaponType);
  const key = "2h R1 1";
  const mv = table.damage[key] ?? "100";
  return parseMotionValue(mv);
}

// ── Stance damage ──────────────────────────────────────────────────────────
/** Base stance damage values per attack type (from community data). */
const STANCE_BASE: Record<string, number> = {
  "simple": 30,    // Simple skill hit AoWs
  "enhanced": 40,  // Enhanced hit AoWs
  "projectile": 20, // Projectile AoWs
};

// ── DPS estimation ─────────────────────────────────────────────────────────
/**
 * Estimate DPS for an AoW. This uses a simplified model:
 * - Projectile AoWs: assume ~1 cast per 2 seconds (recovery frames)
 * - Enhanced hit AoWs: assume ~1 cast per 3 seconds (longer animation)
 * - Simple skill hit AoWs: assume ~1 cast per 2.5 seconds
 */
function estimateAoWDPS(totalDamage: number, ash: AshOfWarEntry): number {
  if (ash.isProjectile) return totalDamage / 2.0;
  if (ash.baseDamage > 0) return totalDamage / 3.0;
  return totalDamage / 2.5;
}

// ── Main ranking ───────────────────────────────────────────────────────────
// ── Enemy type multipliers ──────────────────────────────────────────────────
/**
 * Compute the weapon-type-specific multiplier vs an enemy's type tags.
 * Elden Ring weapons have inherent enemy-type multipliers (e.g. Holy weapons
 * deal bonus damage to Undead/Living in Death). If the weapon defines
 * `enemyDamageMultipliers`, look up the enemy's `enemyTypes` tags and multiply
 * them together. Multipliers are stored as integers (e.g. 110 = +10%).
 */
function getEnemyTypeMultiplier(
  weapon: Weapon,
  enemy: Enemy | undefined,
): number {
  if (!enemy?.enemyTypes || !weapon.enemyDamageMultipliers) return 1;
  let mult = 1;
  for (const tag of enemy.enemyTypes) {
    const m = weapon.enemyDamageMultipliers[tag];
    if (m) mult *= m / 100;
  }
  return mult;
}

// ── Status proc damage ─────────────────────────────────────────────────────
/**
 * Estimate the expected damage contribution from status procs during an AoW
 * attack sequence. Uses the enemy's HP and status resistances to compute
 * how many hits to proc, then the proc damage.
 *
 * Bleed: 15% max HP + 100 flat per proc
 * Frost: 10% max HP + 30 flat per proc
 * Poison: DPS × assumed proc duration (we use full duration = HP/avg_dps)
 * Scarlet Rot: same approach as poison
 */
function estimateStatusProcDamage(
  bleedAmt: number,
  frostAmt: number,
  poisonAmt: number,
  rotAmt: number,
  enemy: Enemy | undefined,
): number {
  if (!enemy?.hp || !enemy?.statusResistances) {
    // No enemy HP data: return raw status AR as a rough estimate
    return bleedAmt * 1.5 + frostAmt + poisonAmt + rotAmt;
  }

  const hp = enemy.hp;
  let totalProcDamage = 0;

  // Bleed proc
  if (bleedAmt > 0) {
    const resist = enemy.statusResistances[AttackPowerType.BLEED] ?? 0;
    const hits = procsToTrigger({
      buildupPerHit: bleedAmt,
      threshold: resist,
      enemyResistance: resist,
    });
    if (hits < 50) {
      // Each proc deals 15% HP + 100; assume ~1 proc per attack sequence
      totalProcDamage += bleedProcDamage(hp) / hits;
    }
  }

  // Frost proc
  if (frostAmt > 0) {
    const resist = enemy.statusResistances[AttackPowerType.FROST] ?? 0;
    const hits = procsToTrigger({
      buildupPerHit: frostAmt,
      threshold: resist,
      enemyResistance: resist,
    });
    if (hits < 50) {
      totalProcDamage += frostProcDamage(hp) / hits;
    }
  }

  // Poison proc: DPS × duration (assume ~30s effective for a fight)
  if (poisonAmt > 0) {
    const resist = enemy.statusResistances[AttackPowerType.POISON] ?? 0;
    const hits = procsToTrigger({
      buildupPerHit: poisonAmt,
      threshold: resist,
      enemyResistance: resist,
    });
    if (hits < 50) {
      totalProcDamage += (poisonProcDps("base") * 30) / hits;
    }
  }

  // Scarlet Rot proc: DPS × duration (assume ~30s effective)
  if (rotAmt > 0) {
    const resist = enemy.statusResistances[AttackPowerType.SCARLET_ROT] ?? 0;
    const hits = procsToTrigger({
      buildupPerHit: rotAmt,
      threshold: resist,
      enemyResistance: resist,
    });
    if (hits < 50) {
      totalProcDamage += (scarletRotProcDps("base") * 30) / hits;
    }
  }

  return totalProcDamage;
}

export function rankWeapons(
  weapons: Weapon[],
  options: RankingOptions,
): RankingEntry[] {
  const metric = options.metric ?? "total";
  const buffIds = options.buffIds ?? [];
  const critModifier = options.critModifier ?? 1.0;
  const isCharged = options.charged ?? false;
  const isPowerStance = options.powerStance ?? false;
  const entries: RankingEntry[] = [];

  // Compute the AoW-specific multiplier from talismans (e.g. Shard of
  // Alexander +15%, Raptor's Black Feathers +10%). These multiply the
  // final AoW damage but do NOT affect normal weapon AR.
  let aowMult = 1;
  for (const id of buffIds) {
    const buff = getBuff(id);
    if (buff?.aowMultiplier) {
      aowMult *= 1 + buff.aowMultiplier;
    }
  }

  // Charge multiplier: most AoWs with chargeable property get ~1.4x when charged.
  // If the AoW defines its own chargeMultiplier, use that; otherwise default 1.4.
  const chargeMult = isCharged ? (options.ashOfWar.chargeMultiplier ?? 1.4) : 1.0;

  for (const weapon of weapons) {
    if (!isWeaponCompatible(weapon, options.ashOfWar)) continue;

    const ar = getWeaponAttack({
      weapon,
      attributes: options.attributes,
      upgradeLevel: options.upgradeLevel,
      twoHanding: options.twoHanding ?? false,
    });

    // Power stance: applies a 1.5x multiplier to weapon AR (simplified:
    // uses the off-hand weapon's contribution as +50% of main-hand AR).
    let baseAR = ar;
    if (isPowerStance) {
      baseAR = {
        ...ar,
        attackPower: Object.fromEntries(
          Object.entries(ar.attackPower).map(([k, v]) => {
            if (!v) return [k, v];
            return [k, { ...v, total: Math.round(v.total * 1.5) }];
          }),
        ) as typeof ar.attackPower,
      };
    }

    // Apply normal buffs (aura, body, talisman, physick, greases) to AR.
    // The aowMultiplier is handled separately below.
    let buffedWeaponAttack = baseAR;
    if (buffIds.length > 0) {
      const buffResult = applyBuffs(baseAR, buffIds);
      buffedWeaponAttack = {
        ...baseAR,
        attackPower: Object.fromEntries(
          Object.entries(baseAR.attackPower).map(([k, v]) => {
            const buffed = buffResult.attackPower[Number(k) as AttackPowerType];
            return [k, v ? { ...v, total: buffed ?? v.total } : v];
          }),
        ) as typeof baseAR.attackPower,
      };
    }

    // Calculate AoW damage based on type
    let skillDamage: Partial<Record<AttackPowerType, number>>;
    let aowType: "simple" | "enhanced" | "projectile";

    if (options.ashOfWar.isProjectile) {
      skillDamage = calculateBulletHitDamage(buffedWeaponAttack, options.ashOfWar, options.attributes);
      aowType = "projectile";
    } else if (options.ashOfWar.baseDamage > 0) {
      skillDamage = calculateEnhancedHitDamage(buffedWeaponAttack, options.ashOfWar, options.attributes);
      aowType = "enhanced";
    } else {
      skillDamage = calculateSkillHitDamage(buffedWeaponAttack, options.ashOfWar);
      aowType = "simple";
    }

    // Apply AoW-specific multipliers:
    //  - aowMult: Shard of Alexander, Raptor's Black Feathers
    //  - chargeMult: charged skill bonus
    //  - critModifier: backstab/riposte multiplier (only for melee-type AoWs)
    for (const apt of allDamageTypes) {
      if (skillDamage[apt]) {
        let dmg = skillDamage[apt]! * aowMult * chargeMult;
        // Crit modifier applies to enhanced and simple hit AoWs (melee),
        // not to projectile AoWs.
        if (!options.ashOfWar.isProjectile) {
          dmg *= critModifier;
        }
        skillDamage[apt] = dmg;
      }
    }

    // Apply enemy defence + absorption if provided
    let breakdown = skillDamage;
    let skillTotal = 0;
    if (options.enemy) {
      const adjusted = applyEnemy(skillDamage, options.enemy);
      breakdown = adjusted;
      for (const apt of allDamageTypes) skillTotal += adjusted[apt] ?? 0;
    } else {
      for (const apt of allDamageTypes) skillTotal += skillDamage[apt] ?? 0;
    }

    // Apply enemy-type multipliers (e.g. holy bonus vs undead)
    const enemyTypeMult = getEnemyTypeMultiplier(weapon, options.enemy);
    if (enemyTypeMult !== 1) {
      skillTotal *= enemyTypeMult;
      for (const apt of allDamageTypes) {
        if (breakdown[apt]) breakdown[apt] = breakdown[apt]! * enemyTypeMult;
      }
    }

    // Status buildup: frost + bleed + poison + scarlet rot (use buffed AR for greases)
    const bleedAmt = buffedWeaponAttack.attackPower[AttackPowerType.BLEED]?.total ?? 0;
    const frostAmt = buffedWeaponAttack.attackPower[AttackPowerType.FROST]?.total ?? 0;
    const poisonAmt = buffedWeaponAttack.attackPower[AttackPowerType.POISON]?.total ?? 0;
    const rotAmt = buffedWeaponAttack.attackPower[AttackPowerType.SCARLET_ROT]?.total ?? 0;

    // Status proc damage: compute actual proc damage (bleed 15% HP, frost 10% HP, etc.)
    // This replaces the old raw-status-AR sum with expected proc damage contribution.
    const statusAmt = estimateStatusProcDamage(
      bleedAmt, frostAmt, poisonAmt, rotAmt, options.enemy,
    );

    // Stance damage from the AoW
    const stanceDamage = options.ashOfWar.poiseDamage ?? STANCE_BASE[aowType];

    // DPS estimation (includes status proc damage contribution)
    const dps = estimateAoWDPS(skillTotal + statusAmt, options.ashOfWar);

    entries.push({
      rank: 0,
      weapon,
      total: skillTotal + statusAmt,
      projectile: options.ashOfWar.isProjectile ? skillTotal : 0,
      status: statusAmt,
      stance: stanceDamage,
      dps,
      breakdown,
    });
  }

  // Sort by the selected metric
  const sortKey: Record<RankingMetric, (e: RankingEntry) => number> = {
    total: (e) => e.total,
    projectile: (e) => e.projectile,
    status: (e) => e.status,
    dps: (e) => e.dps,
    stance: (e) => e.stance,
  };
  entries.sort((a, b) => sortKey[metric](b) - sortKey[metric](a));
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

function applyEnemy(
  damage: Partial<Record<AttackPowerType, number>>,
  enemy: Enemy,
): Partial<Record<AttackPowerType, number>> {
  const out: Partial<Record<AttackPowerType, number>> = {};
  for (const apt of allDamageTypes) {
    const v = damage[apt];
    if (!v) continue;
    const def = enemy.defence[apt] ?? 0;
    const abs = enemy.absorption[apt] ?? 0;
    out[apt] = damageAgainstEnemy({
      attackRating: v,
      damageType: apt,
      enemyDefense: def,
      absorptionPercent: abs,
      motion: 100,
    });
  }
  return out;
}

function isWeaponCompatible(
  weapon: Weapon,
  ash: AshOfWarEntry,
): boolean {
  if (!ash.compatibleWeaponTypes.includes(weapon.weaponType)) return false;
  return (
    ash.compatibleAffinities.includes(weapon.affinityId) ||
    ash.compatibleAffinities.length === 0
  );
}
