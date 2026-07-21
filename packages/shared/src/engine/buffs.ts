/**
 * buffs.ts — Buff system for Elden Ring damage calculations.
 *
 * Buff categories and stacking rules:
 *
 *  1. **Aura buffs** (Golden Vow, Rallying Standard): +X% to all damage,
 *     multiplicative with the base AR. These do NOT stack with each other
 *     (only the highest applies).
 *
 *  2. **Body buffs** (Flame Grant Me Strength, Exalted Flesh): +Y% to
 *     specific damage types. DO stack multiplicatively with aura buffs.
 *
 *  3. **Weapon buffs** (Terra Magica, Grease): Applied to the weapon's AR
 *     directly. Weapon buffs do NOT stack with each other.
 *
 *  4. **Talisman / equipment multipliers**: Multiplicative, after everything.
 *
 *  5. **Physick tears**: Multiplicative, independent category.
 *
 * The formula flow:
 *   finalAR = (weaponAR × (1 + auraBuff) × (1 + bodyBuff) + weaponBuffFlat)
 *             × (1 + talismanMult) × (1 + physickMult)
 */

import { AttackPowerType, allDamageTypes, allStatusTypes } from "../types";
import type { WeaponAttackResult } from "./ar";

/** Buff category — controls stacking behaviour. */
export type BuffCategory =
  | "aura"       // Golden Vow, Rallying Standard (highest only)
  | "body"       // FGMS, Exalted Flesh (stack with aura)
  | "weapon"     // Grease, Bloodflame Blade (stack with aura/body, not with each other)
  | "talisman"   // Shard of Alexander, Magic Scorpion (stack multiply)
  | "physick"    // Physick tears (stack multiply)
  | "helmet"     // Helm effects (stack additively within same type)
  | "armor";     // Armor set bonuses

export interface Buff {
  id: string;
  name: string;
  category: BuffCategory;
  /** Per-damage-type multiplier (e.g. 0.15 = +15%). */
  multipliers?: Partial<Record<AttackPowerType, number>>;
  /** Flat AR addition per damage type (for greases, weapon buffs). */
  flatAdditions?: Partial<Record<AttackPowerType, number>>;
  /** All-damage multiplier (applies to all damage types). */
  allDamageMultiplier?: number;
  /** Only applies to specific damage types. */
  applicableTypes?: AttackPowerType[];
}

// ── Predefined buffs ──────────────────────────────────────────────────────────

export const BUFF_LIBRARY: Buff[] = [
  {
    id: "golden-vow",
    name: "Golden Vow",
    category: "aura",
    allDamageMultiplier: 0.15,
  },
  {
    id: "rallying-standard",
    name: "Rallying Standard",
    category: "aura",
    allDamageMultiplier: 0.15,
  },
  {
    id: "flame-grant-me-strength",
    name: "Flame Grant Me Strength",
    category: "body",
    multipliers: {
      [AttackPowerType.PHYSICAL]: 0.2,
      [AttackPowerType.FIRE]: 0.2,
    },
  },
  {
    id: "exalted-flesh",
    name: "Exalted Flesh",
    category: "body",
    multipliers: {
      [AttackPowerType.PHYSICAL]: 0.2,
    },
  },
  {
    id: "terra-magica",
    name: "Terra Magica",
    category: "aura",
    multipliers: {
      [AttackPowerType.MAGIC]: 0.35,
    },
  },
  {
    id: "shard-of-alexander",
    name: "Shard of Alexander (AoW)",
    category: "talisman",
    allDamageMultiplier: 0.15, // +15% to Ash of War damage
  },
  {
    id: "magic-scorpion-talisman",
    name: "Magic Scorpion Charm",
    category: "talisman",
    multipliers: {
      [AttackPowerType.MAGIC]: 0.12,
    },
  },
  {
    id: "fire-scorpion-talisman",
    name: "Fire Scorpion Charm",
    category: "talisman",
    multipliers: {
      [AttackPowerType.FIRE]: 0.12,
    },
  },
  {
    id: "lightning-scorpion-talisman",
    name: "Lightning Scorpion Charm",
    category: "talisman",
    multipliers: {
      [AttackPowerType.LIGHTNING]: 0.12,
    },
  },
  {
    id: "holy-scorpion-talisman",
    name: "Sacred Scorpion Charm",
    category: "talisman",
    multipliers: {
      [AttackPowerType.HOLY]: 0.12,
    },
  },
  {
    id: "crimson-amber-medallion",
    name: "Crimson Amber Medallion",
    category: "talisman",
    // This is HP, not damage — but included for completeness
  },
  {
    id: "magic-shrouding-tear",
    name: "Magic-Shrouding Cracked Tear",
    category: "physick",
    multipliers: {
      [AttackPowerType.MAGIC]: 0.25,
    },
  },
  {
    id: "flame-shrouding-tear",
    name: "Flame-Shrouding Cracked Tear",
    category: "physick",
    multipliers: {
      [AttackPowerType.FIRE]: 0.25,
    },
  },
  {
    id: "stonebarb-tear",
    name: "Stonebarb Cracked Tear",
    category: "physick",
    // stance damage +30% — handled separately
  },
  {
    id: "rite-of-sending",
    name: "Godfrey's Rite of Sending",
    category: "aura",
    allDamageMultiplier: 0.10,
  },
  {
    id: "blue-dancer-charm",
    name: "Blue Dancer Charm",
    category: "talisman",
    // Equip-load based — simplified to a fixed 10%
    allDamageMultiplier: 0.10,
  },
  // ── Weapon Greases ──────────────────────────────────────────────────────
  // Greases add flat AR in their element. They use the "weapon" category
  // so they do NOT stack with each other (only the highest per-type flat
  // applies). Values are +60 flat for elemental greases, +55 for status
  // greases at default upgrade level.
  {
    id: "fire-grease",
    name: "Fire Grease",
    category: "weapon",
    flatAdditions: {
      [AttackPowerType.FIRE]: 60,
    },
  },
  {
    id: "magic-grease",
    name: "Magic Grease",
    category: "weapon",
    flatAdditions: {
      [AttackPowerType.MAGIC]: 60,
    },
  },
  {
    id: "lightning-grease",
    name: "Lightning Grease",
    category: "weapon",
    flatAdditions: {
      [AttackPowerType.LIGHTNING]: 60,
    },
  },
  {
    id: "holy-grease",
    name: "Holy Grease",
    category: "weapon",
    flatAdditions: {
      [AttackPowerType.HOLY]: 60,
    },
  },
  {
    id: "poison-grease",
    name: "Poison Grease",
    category: "weapon",
    flatAdditions: {
      [AttackPowerType.POISON]: 55,
    },
  },
  {
    id: "blood-grease",
    name: "Blood Grease",
    category: "weapon",
    flatAdditions: {
      [AttackPowerType.BLEED]: 55,
    },
  },
];

export function getBuff(id: string): Buff | undefined {
  return BUFF_LIBRARY.find((b) => b.id === id);
}

// ── Apply buffs ──────────────────────────────────────────────────────────────

export interface BuffApplicationResult {
  /** Buffed AR per damage type. */
  attackPower: Partial<Record<AttackPowerType, number>>;
  /** The list of buffs that were active. */
  activeBuffs: Buff[];
}

/**
 * Apply a set of buffs to an attack-rating result, following the Elden Ring
 * stacking rules.
 *
 * The formula per damage type is:
 *   buffedAR = (baseAR × (1 + bestAura) × (1 + bodyBuff1) × (1 + bodyBuff2) ... )
 *              + weaponBuffFlat
 *              × (1 + talismanMult) × (1 + physickMult) × ...
 *
 * Aura buffs: only the highest all-damage bonus applies.
 * Body buffs: all stack multiplicatively (separate categories).
 * Weapon buffs: highest flat addition per type applies.
 * Talisman/physick: all stack multiplicatively.
 */
export function applyBuffs(
  ar: WeaponAttackResult,
  buffIds: string[],
): BuffApplicationResult {
  const buffs = buffIds
    .map((id) => getBuff(id))
    .filter((b): b is Buff => b !== undefined);

  // Group buffs by category.
  const auras = buffs.filter((b) => b.category === "aura");
  const bodies = buffs.filter((b) => b.category === "body");
  const weaponBuffs = buffs.filter((b) => b.category === "weapon");
  const talismans = buffs.filter((b) => b.category === "talisman");
  const physicks = buffs.filter((b) => b.category === "physick");

  const result: Partial<Record<AttackPowerType, number>> = {};

  // Process both scalar damage types and status types (for greases like
  // Poison Grease / Blood Grease that add flat status buildup).
  const allTypes = [...allDamageTypes, ...allStatusTypes] as readonly AttackPowerType[];

  for (const apt of allTypes) {
    const baseAR = ar.attackPower[apt]?.total ?? 0;

    // For status types, only flat weapon buffs apply (no multipliers).
    const isStatus = (allStatusTypes as readonly AttackPowerType[]).includes(apt);
    if (isStatus) {
      let flatBuff = 0;
      for (const wb of weaponBuffs) {
        const flat = wb.flatAdditions?.[apt] ?? 0;
        if (flat > flatBuff) flatBuff = flat;
      }
      if (baseAR === 0 && flatBuff === 0) continue;
      result[apt] = baseAR + flatBuff;
      continue;
    }

    if (!baseAR) continue;

    // Aura: pick the highest all-damage or per-type multiplier.
    let auraMult = 0;
    for (const aura of auras) {
      const total = (aura.allDamageMultiplier ?? 0) + (aura.multipliers?.[apt] ?? 0);
      if (total > auraMult) auraMult = total;
    }

    // Body buffs: stack multiplicatively.
    let bodyMult = 1;
    for (const body of bodies) {
      const m = (body.allDamageMultiplier ?? 0) + (body.multipliers?.[apt] ?? 0);
      bodyMult *= 1 + m;
    }

    // Flat weapon buff: highest per type.
    let flatBuff = 0;
    for (const wb of weaponBuffs) {
      const flat = wb.flatAdditions?.[apt] ?? 0;
      if (flat > flatBuff) flatBuff = flat;
    }

    // Talismans: all stack multiplicatively.
    let talismanMult = 1;
    for (const t of talismans) {
      const m = (t.allDamageMultiplier ?? 0) + (t.multipliers?.[apt] ?? 0);
      talismanMult *= 1 + m;
    }

    // Physick: stack multiplicatively.
    let physickMult = 1;
    for (const p of physicks) {
      const m = (p.allDamageMultiplier ?? 0) + (p.multipliers?.[apt] ?? 0);
      physickMult *= 1 + m;
    }

    const buffed =
      (baseAR * (1 + auraMult) * bodyMult + flatBuff) *
      talismanMult *
      physickMult;

    result[apt] = buffed;
  }

  return { attackPower: result, activeBuffs: buffs };
}
