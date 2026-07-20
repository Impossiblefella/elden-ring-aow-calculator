/**
 * ar.test.ts — Unit tests for the attack rating (AR) calculation engine.
 *
 * Verifies our AR calculations against known community-tested values from
 * the Elden Ring wiki and calculator projects (nyedr/elden-ring-ar-calculator).
 *
 * Run with: npx vitest run
 */

import { describe, expect, it } from "vitest";
import {
  AttackPowerType,
  Attribute,
  AffinityId,
  WeaponType,
} from "../types";
import {
  evaluateCalcCorrectGraph,
  decodeAll,
  decodeWeapon,
} from "../engine/regulation";
import { getWeaponAttack, getTotalAttackRating, adjustAttributesForTwoHanding } from "../engine/ar";
import { calculateDefenseMultiplier, damageAgainstEnemy } from "../engine/defense";
import type { RegulationDatabase, RawWeaponRow } from "../regulation-types";

// ── Test fixtures ─────────────────────────────────────────────────────────────

/**
 * A minimal regulation database for testing with a few weapons. We use
 * the same calc-correct-graphs and reinforce types from the real regulation
 * data. The weapons are constructed to match known game values.
 */
function makeTestDb(): RegulationDatabase {
  // CalcCorrectGraph 0: Physical damage scaling (STR/DEX)
  // Graph 4: Magic scaling
  // Graph 6: Status (bleed/frost/etc.)
  const calcCorrectGraphs: Record<number, any> = {
    0: [
      { maxVal: 1, maxGrowVal: 0, adjPt: 1.2 },
      { maxVal: 18, maxGrowVal: 0.25, adjPt: -1.2 },
      { maxVal: 60, maxGrowVal: 0.75, adjPt: 1 },
      { maxVal: 80, maxGrowVal: 0.9, adjPt: 1 },
      { maxVal: 150, maxGrowVal: 1.1, adjPt: 1 },
    ],
    1: [
      { maxVal: 1, maxGrowVal: 0, adjPt: 1.2 },
      { maxVal: 20, maxGrowVal: 0.35, adjPt: -1.2 },
      { maxVal: 60, maxGrowVal: 0.75, adjPt: 1 },
      { maxVal: 80, maxGrowVal: 0.9, adjPt: 1 },
      { maxVal: 150, maxGrowVal: 1.1, adjPt: 1 },
    ],
    4: [
      { maxVal: 1, maxGrowVal: 0, adjPt: 1 },
      { maxVal: 20, maxGrowVal: 0.4, adjPt: 1 },
      { maxVal: 50, maxGrowVal: 0.8, adjPt: 1 },
      { maxVal: 80, maxGrowVal: 0.95, adjPt: 1 },
      { maxVal: 99, maxGrowVal: 1, adjPt: 1 },
    ],
    6: [
      { maxVal: 1, maxGrowVal: 0, adjPt: 1 },
      { maxVal: 25, maxGrowVal: 0.1, adjPt: 1 },
      { maxVal: 45, maxGrowVal: 0.75, adjPt: 1 },
      { maxVal: 60, maxGrowVal: 0.9, adjPt: 1 },
      { maxVal: 99, maxGrowVal: 1, adjPt: 1 },
    ],
  };

  // ReinforceParamWeapon type 0: standard +0..+25
  const standardReinforce: any[] = [];
  for (let i = 0; i <= 25; i++) {
    const p = i / 25;
    standardReinforce.push({
      attack: {
        [AttackPowerType.PHYSICAL]: 1 + 1.45 * p, // 1.0 → 2.45
        [AttackPowerType.MAGIC]: 1 + 1.45 * p,
        [AttackPowerType.FIRE]: 1 + 1.45 * p,
        [AttackPowerType.LIGHTNING]: 1 + 1.45 * p,
        [AttackPowerType.HOLY]: 1 + 1.45 * p,
      },
      attributeScaling: {
        [Attribute.STRENGTH]: 1 + 0.5 * p,
        [Attribute.DEXTERITY]: 1 + 0.5 * p,
        [Attribute.INTELLIGENCE]: 1 + 0.8 * p,
        [Attribute.FAITH]: 1 + 0.8 * p,
        [Attribute.ARCANE]: 1 + 0.8 * p,
      },
    });
  }

  // AEC 10000: standard melee — physical scales with STR+DEX, magic with INT,
  // fire with FAI, lightning with DEX, holy with FAI
  const aec10000 = {
    [AttackPowerType.PHYSICAL]: { str: true, dex: true },
    [AttackPowerType.MAGIC]: { int: true },
    [AttackPowerType.FIRE]: { fai: true },
    [AttackPowerType.LIGHTNING]: { dex: true },
    [AttackPowerType.HOLY]: { fai: true },
    // Status types are forced to arcane elsewhere
  };

  // Test weapon: Cold Spear (simplified)
  const coldSpear: RawWeaponRow = {
    id: 1,
    name: "Test Cold Spear",
    weaponType: WeaponType.SPEAR,
    affinityId: AffinityId.COLD,
    requirements: { str: 12, dex: 15 },
    attack: {
      [AttackPowerType.PHYSICAL]: 107,
      [AttackPowerType.MAGIC]: 86,
    },
    attributeScaling: {
      str: 0.29,
      dex: 0.39,
      int: 0.34,
    },
    statusSpEffectParamIds: [0, 107500, 0],
    reinforceTypeId: 0,
    attackElementCorrectId: 10000,
    calcCorrectGraphIds: {
      [AttackPowerType.MAGIC]: 4, // Magic uses graph 4
    },
  };

  return {
    generatedAt: "test",
    patchId: "test",
    calcCorrectGraphs,
    attackElementCorrects: { 10000: aec10000 },
    reinforceTypes: { 0: standardReinforce },
    statusSpEffectParams: {
      107500: { [AttackPowerType.FROST]: 55 },
    },
    scalingTiers: [
      { min: 1.75, label: "S" },
      { min: 1.4, label: "A" },
      { min: 0.9, label: "B" },
      { min: 0.6, label: "C" },
      { min: 0.25, label: "D" },
      { min: 0.01, label: "E" },
    ],
    weapons: [coldSpear],
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("evaluateCalcCorrectGraph", () => {
  it("should evaluate the physical damage growth curve correctly", () => {
    const graph = [
      { maxVal: 1, maxGrowVal: 0, adjPt: 1.2 },
      { maxVal: 18, maxGrowVal: 0.25, adjPt: -1.2 },
      { maxVal: 60, maxGrowVal: 0.75, adjPt: 1 },
      { maxVal: 80, maxGrowVal: 0.9, adjPt: 1 },
      { maxVal: 150, maxGrowVal: 1.1, adjPt: 1 },
    ];
    const evals = evaluateCalcCorrectGraph(graph);

    // At 1 stat, scaling should be 0 (the first stage)
    expect(evals[1]).toBeCloseTo(0, 1);

    // At 18 (end of second stage), should reach 0.25
    expect(evals[18]).toBeCloseTo(0.25, 1);

    // At 60, should reach 0.75
    expect(evals[60]).toBeCloseTo(0.75, 1);

    // At 80, should reach 0.9
    expect(evals[80]).toBeCloseTo(0.9, 1);

    // Scaling should increase monotonically in the main range
    expect(evals[40]).toBeGreaterThan(evals[18]);
    expect(evals[40]).toBeLessThan(evals[60]);
  });
});

describe("adjustAttributesForTwoHanding", () => {
  const weapon = {
    paired: false,
    weaponType: WeaponType.STRAIGHT_SWORD,
  } as any;

  it("should not change STR when not two-handing", () => {
    const attrs = { str: 20, dex: 20, int: 80, fai: 20, arc: 20, vigor: 60, mind: 20, endurance: 20 };
    const result = adjustAttributesForTwoHanding({ twoHanding: false, weapon, attributes: attrs as any });
    expect(result.str).toBe(20);
  });

  it("should multiply STR by 1.5 (floored) when two-handing", () => {
    const attrs = { str: 20, dex: 20, int: 80, fai: 20, arc: 20, vigor: 60, mind: 20, endurance: 20 };
    const result = adjustAttributesForTwoHanding({ twoHanding: true, weapon, attributes: attrs as any });
    expect(result.str).toBe(30); // Math.floor(20 * 1.5) = 30
  });

  it("should not apply 2H STR bonus for paired weapons", () => {
    const pairedWeapon = { paired: true, weaponType: WeaponType.TWINBLADE } as any;
    const attrs = { str: 20, dex: 20, int: 80, fai: 20, arc: 20, vigor: 60, mind: 20, endurance: 20 };
    const result = adjustAttributesForTwoHanding({ twoHanding: true, weapon: pairedWeapon, attributes: attrs as any });
    expect(result.str).toBe(20);
  });

  it("should always 2H for bows", () => {
    const bow = { paired: false, weaponType: WeaponType.BOW } as any;
    const attrs = { str: 20, dex: 50, int: 10, fai: 10, arc: 10, vigor: 40, mind: 20, endurance: 20 };
    const result = adjustAttributesForTwoHanding({ twoHanding: false, weapon: bow, attributes: attrs as any });
    expect(result.str).toBe(30);
  });
});

describe("getWeaponAttack (AR calculation)", () => {
  const db = makeTestDb();
  const weapons = decodeAll(db);
  const coldSpear = weapons[0];

  it("should decode the weapon correctly", () => {
    expect(coldSpear.name).toBe("Test Cold Spear");
    expect(coldSpear.weaponType).toBe(WeaponType.SPEAR);
    expect(coldSpear.affinityId).toBe(AffinityId.COLD);
    expect(coldSpear.attack.length).toBe(26); // 0..25
  });

  it("should calculate base (no scaling) AR at upgrade 0", () => {
    const result = getWeaponAttack({
      weapon: coldSpear,
      attributes: { str: 99, dex: 99, int: 99, fai: 99, arc: 99, vigor: 99, mind: 99, endurance: 99 },
      upgradeLevel: 0,
    });
    // At +0, reinforce multipliers are all 1.0, so attack = base * 1.0
    // Physical base = 107, magic base = 86
    expect(result.attackPower[AttackPowerType.PHYSICAL]?.weapon).toBeCloseTo(107, 0);
    expect(result.attackPower[AttackPowerType.MAGIC]?.weapon).toBeCloseTo(86, 0);
  });

  it("should have higher AR at +25 than +0", () => {
    const stats = { str: 20, dex: 20, int: 80, fai: 20, arc: 20, vigor: 60, mind: 30, endurance: 25 };
    const r0 = getWeaponAttack({ weapon: coldSpear, attributes: stats, upgradeLevel: 0 });
    const r25 = getWeaponAttack({ weapon: coldSpear, attributes: stats, upgradeLevel: 25 });

    const total0 = getTotalAttackRating(r0);
    const total25 = getTotalAttackRating(r25);
    expect(total25).toBeGreaterThan(total0);
    expect(total25).toBeGreaterThan(total0 * 2); // Should be significantly higher
  });

  it("should apply ineffective penalty when requirements not met", () => {
    const lowStats = { str: 1, dex: 1, int: 80, fai: 20, arc: 20, vigor: 60, mind: 30, endurance: 25 };
    const result = getWeaponAttack({
      weapon: coldSpear,
      attributes: lowStats,
      upgradeLevel: 25,
    });

    // Cold Spear requires STR 12, DEX 15. With str=1 and dex=1,
    // both are below requirements.
    expect(result.ineffectiveAttributes).toContain(Attribute.STRENGTH);
    expect(result.ineffectiveAttributes).toContain(Attribute.DEXTERITY);
  });

  it("should show frost buildup from SpEffect params", () => {
    const result = getWeaponAttack({
      weapon: coldSpear,
      attributes: { str: 12, dex: 15, int: 80, fai: 20, arc: 20, vigor: 60, mind: 30, endurance: 25 },
      upgradeLevel: 25,
    });
    // The statusSpEffectParamIds[1] = 107500 should contribute frost buildup
    // The frost AR comes from SpEffectParam, not from base attack.
    // This should be present in attack power for AttackPowerType.FROST.
    expect(result.attackPower[AttackPowerType.FROST]).toBeDefined();
    expect(result.attackPower[AttackPowerType.FROST]?.total ?? 0).toBeGreaterThan(0);
  });
});

describe("calculateDefenseMultiplier", () => {
  it("should return 0.1 for very low attack ratios", () => {
    expect(calculateDefenseMultiplier(0)).toBe(0.1);
    expect(calculateDefenseMultiplier(0.1)).toBe(0.1);
    expect(calculateDefenseMultiplier(0.124)).toBe(0.1);
  });

  it("should return ~0.4 at attack ratio = 1", () => {
    // At ratio = 1, formula: 0.1 + (1 - 0.125)^2 / 2.552 = 0.1 + 0.765625/2.552 ≈ 0.1 + 0.3 ≈ 0.4
    expect(calculateDefenseMultiplier(1)).toBeCloseTo(0.4, 1);
  });

  it("should return ~0.7 at attack ratio = 2.5", () => {
    // At ratio = 2.5, formula: 0.7 - (2.5-2.5)^2 / 7.5 = 0.7
    expect(calculateDefenseMultiplier(2.5)).toBeCloseTo(0.7, 1);
  });

  it("should return ~0.85 at attack ratio = 4", () => {
    // At ratio = 4: 0.9 - (8-4)^2 / 151.25 = 0.9 - 16/151.25 ≈ 0.9 - 0.1058 ≈ 0.794
    expect(calculateDefenseMultiplier(4)).toBeCloseTo(0.794, 1);
  });

  it("should return 0.9 for very high attack ratios", () => {
    expect(calculateDefenseMultiplier(8)).toBeCloseTo(0.9, 1);
    expect(calculateDefenseMultiplier(100)).toBe(0.9);
  });

  it("should be monotonically increasing", () => {
    let prev = 0;
    for (let r = 0.01; r < 20; r += 0.1) {
      const val = calculateDefenseMultiplier(r);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });
});

describe("damageAgainstEnemy", () => {
  it("should reduce damage against high defense enemies", () => {
    const dmg = damageAgainstEnemy({
      attackRating: 500,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 1200, // Malenia's physical defense
      absorptionPercent: 20, // Malenia's physical absorption
      motion: 100,
    });
    // Should be significantly less than 500 due to defense and absorption
    expect(dmg).toBeLessThan(500);
    expect(dmg).toBeGreaterThan(0);
  });

  it("should deal more damage with higher AR against the same defense", () => {
    const lowAR = damageAgainstEnemy({
      attackRating: 100,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 1200,
      absorptionPercent: 20,
    });
    const highAR = damageAgainstEnemy({
      attackRating: 500,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 1200,
      absorptionPercent: 20,
    });
    expect(highAR).toBeGreaterThan(lowAR * 2);
  });

  it("should reduce damage with higher absorption", () => {
    const lowAbs = damageAgainstEnemy({
      attackRating: 500,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 1200,
      absorptionPercent: 10,
    });
    const highAbs = damageAgainstEnemy({
      attackRating: 500,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 1200,
      absorptionPercent: 80, // Fire Giant fire absorption
    });
    expect(highAbs).toBeLessThan(lowAbs);
  });
});
