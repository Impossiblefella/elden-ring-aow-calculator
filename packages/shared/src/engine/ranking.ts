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
export function rankWeapons(
  weapons: Weapon[],
  options: RankingOptions,
): RankingEntry[] {
  const metric = options.metric ?? "total";
  const buffIds = options.buffIds ?? [];
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

  for (const weapon of weapons) {
    if (!isWeaponCompatible(weapon, options.ashOfWar)) continue;

    const ar = getWeaponAttack({
      weapon,
      attributes: options.attributes,
      upgradeLevel: options.upgradeLevel,
      twoHanding: options.twoHanding ?? false,
    });

    // Apply normal buffs (aura, body, talisman, physick, greases) to AR.
    // The aowMultiplier is handled separately below.
    let buffedWeaponAttack = ar;
    if (buffIds.length > 0) {
      const buffResult = applyBuffs(ar, buffIds);
      buffedWeaponAttack = {
        ...ar,
        attackPower: Object.fromEntries(
          Object.entries(ar.attackPower).map(([k, v]) => {
            const buffed = buffResult.attackPower[Number(k) as AttackPowerType];
            return [k, v ? { ...v, total: buffed ?? v.total } : v];
          }),
        ) as typeof ar.attackPower,
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

    // Apply AoW-specific multiplier (Shard of Alexander, Raptor's Black Feathers)
    for (const apt of allDamageTypes) {
      if (skillDamage[apt]) skillDamage[apt] = skillDamage[apt]! * aowMult;
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

    // Status buildup: frost + bleed + poison + scarlet rot (use buffed AR for greases)
    const bleedAmt = buffedWeaponAttack.attackPower[AttackPowerType.BLEED]?.total ?? 0;
    const frostAmt = buffedWeaponAttack.attackPower[AttackPowerType.FROST]?.total ?? 0;
    const poisonAmt = buffedWeaponAttack.attackPower[AttackPowerType.POISON]?.total ?? 0;
    const rotAmt = buffedWeaponAttack.attackPower[AttackPowerType.SCARLET_ROT]?.total ?? 0;
    const statusAmt = bleedAmt + frostAmt + poisonAmt + rotAmt;

    // Stance damage from the AoW
    const stanceDamage = options.ashOfWar.poiseDamage ?? STANCE_BASE[aowType];

    // DPS estimation
    const dps = estimateAoWDPS(skillTotal, options.ashOfWar);

    entries.push({
      rank: 0,
      weapon,
      total: skillTotal,
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
