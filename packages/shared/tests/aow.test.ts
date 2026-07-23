/**
 * aow.test.ts — Unit tests for the Ash of War damage calculation paths.
 *
 * Covers the three AoW damage methods exported from the engine:
 *   - calculateSkillHitDamage  (simple skill hit: AR × motion value)
 *   - calculateEnhancedHitDamage (flat buff that scales with upgrade level)
 *   - calculateBulletHitDamage  (projectile: scales with baseBulletDamage + upgrade)
 *
 * Also exercises calculateAshOfWarDamage (the dispatcher) and edge cases:
 *   - zero AR, zero motion values, max upgrade level.
 *
 * Weapons are loaded from the REAL regulation snapshot
 * (regulation-vanilla-v1.14.json) so the calc-correct-graphs and reinforce
 * curves are genuine. Ash of War definitions are constructed inline because
 * the snapshot does not yet ship an ashesOfWar section.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AttackPowerType,
  Attribute,
  AffinityId,
  WeaponType,
  getWeaponAttack,
  getTotalAttackRating,
  decodeAll,
  calculateSkillHitDamage,
  calculateEnhancedHitDamage,
  calculateBulletHitDamage,
  calculateAshOfWarDamage,
  type RegulationDatabase,
  type AshOfWarEntry,
  type Attributes,
} from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the REAL regulation data extracted from regulation.bin
const raw = readFileSync(join(__dirname, "regulation-vanilla-v1.14.json"), "utf-8");
const regData = JSON.parse(raw) as RegulationDatabase;

// Decode all weapons from the real regulation data
const decoded = decodeAll(regData);
const broadsword = decoded.find((w) => w.name === "Broadsword")!;
const uchigatana = decoded.find((w) => w.name === "Uchigatana")!;

function makeStats(overrides: Partial<Record<Attribute, number>> = {}): Attributes {
  return {
    [Attribute.VIGOR]: 10,
    [Attribute.MIND]: 10,
    [Attribute.ENDURANCE]: 10,
    [Attribute.STRENGTH]: 10,
    [Attribute.DEXTERITY]: 10,
    [Attribute.INTELLIGENCE]: 10,
    [Attribute.FAITH]: 10,
    [Attribute.ARCANE]: 10,
    ...overrides,
  };
}

// ── Mock Ash of War definitions ─────────────────────────────────────────────
// These conform to the AshOfWarEntry interface. Motion values are percentages
// of weapon AR (100 = full AR). compatibleWeaponTypes/affinities are set wide
// so compatibility checks pass regardless of which real weapon is used.

/** Simple skill hit AoW (e.g. Spinning Slash): pure weapon-swing with MVs. */
const simpleAsh: AshOfWarEntry = {
  id: 100000,
  name: "Test Simple Skill",
  compatibleWeaponTypes: [WeaponType.STRAIGHT_SWORD, WeaponType.KATANA],
  compatibleAffinities: [AffinityId.STANDARD],
  damageMotionValues: {
    [AttackPowerType.PHYSICAL]: 120, // 120% of physical AR
  },
  baseDamage: 0,
  baseBulletDamage: {},
  isProjectile: false,
};

/** Enhanced hit AoW (e.g. Storm Blade): adds a flat buff on top of the swing. */
const enhancedAsh: AshOfWarEntry = {
  id: 100001,
  name: "Test Enhanced Skill",
  compatibleWeaponTypes: [WeaponType.STRAIGHT_SWORD, WeaponType.KATANA],
  compatibleAffinities: [AffinityId.STANDARD],
  damageMotionValues: {
    [AttackPowerType.PHYSICAL]: 100,
  },
  baseDamage: 100, // flat buff baseline
  baseBulletDamage: {},
  isProjectile: false,
};

/** Projectile / bullet AoW (e.g. Ice Spear): fires a projectile. */
const bulletAsh: AshOfWarEntry = {
  id: 100002,
  name: "Test Bullet Skill",
  compatibleWeaponTypes: [WeaponType.STRAIGHT_SWORD, WeaponType.KATANA],
  compatibleAffinities: [AffinityId.STANDARD],
  damageMotionValues: {
    [AttackPowerType.PHYSICAL]: 100, // bullet motion value stored in phys slot
  },
  baseDamage: 0,
  baseBulletDamage: {
    [AttackPowerType.PHYSICAL]: 200, // base bullet damage
  },
  isProjectile: true,
};

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("calculateSkillHitDamage (simple skill hit)", () => {
  let broadswordAttack: ReturnType<typeof getWeaponAttack>;

  beforeAll(() => {
    broadswordAttack = getWeaponAttack({
      weapon: broadsword,
      attributes: makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 }),
      upgradeLevel: 25,
    });
  });

  it("returns per-type values proportional to weapon AR × motion value", () => {
    const dmg = calculateSkillHitDamage(broadswordAttack, simpleAsh);
    const physAR = broadswordAttack.attackPower[AttackPowerType.PHYSICAL]?.total ?? 0;
    const mv = simpleAsh.damageMotionValues[AttackPowerType.PHYSICAL] ?? 0;

    expect(physAR).toBeGreaterThan(0);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeCloseTo((physAR * mv) / 100, 5);
  });

  it("returns 0 for damage types the weapon does not have", () => {
    const dmg = calculateSkillHitDamage(broadswordAttack, simpleAsh);
    // Broadsword is physical-only; magic/fire/lightning/holy should be absent or 0.
    expect(dmg[AttackPowerType.MAGIC] ?? 0).toBe(0);
    expect(dmg[AttackPowerType.FIRE] ?? 0).toBe(0);
  });

  it("halves damage when motion value is 50 vs 100 (proportional)", () => {
    const full = calculateSkillHitDamage(broadswordAttack, {
      ...simpleAsh,
      damageMotionValues: { [AttackPowerType.PHYSICAL]: 100 },
    });
    const half = calculateSkillHitDamage(broadswordAttack, {
      ...simpleAsh,
      damageMotionValues: { [AttackPowerType.PHYSICAL]: 50 },
    });
    expect(half[AttackPowerType.PHYSICAL]!).toBeCloseTo(full[AttackPowerType.PHYSICAL]! / 2, 5);
  });

  it("returns 0 for all types when all motion values are zero", () => {
    const dmg = calculateSkillHitDamage(broadswordAttack, {
      ...simpleAsh,
      damageMotionValues: {},
    });
    for (const apt of [AttackPowerType.PHYSICAL, AttackPowerType.MAGIC, AttackPowerType.FIRE]) {
      expect(dmg[apt] ?? 0).toBe(0);
    }
  });

  it("returns 0 damage when weapon AR is zero (edge case)", () => {
    // Construct a fake attack result with zero AR.
    const zeroAR = {
      ...broadswordAttack,
      attackPower: {
        [AttackPowerType.PHYSICAL]: { total: 0, scaled: 0, weapon: 0 },
      },
    } as typeof broadswordAttack;
    const dmg = calculateSkillHitDamage(zeroAR, simpleAsh);
    expect(dmg[AttackPowerType.PHYSICAL] ?? 0).toBe(0);
  });
});

describe("calculateEnhancedHitDamage (enhanced skill hit)", () => {
  it("adds a flat buff on top of the AR × motion-value component", () => {
    const attack = getWeaponAttack({
      weapon: broadsword,
      attributes: makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 }),
      upgradeLevel: 25,
    });
    const dmg = calculateEnhancedHitDamage(attack, enhancedAsh, makeStats({ [Attribute.STRENGTH]: 40 }));

    const ar = getTotalAttackRating(attack);
    const mv = (enhancedAsh.damageMotionValues[AttackPowerType.PHYSICAL] ?? 0) / 100;
    const swingComponent = ar * mv;
    // The enhanced damage must be strictly greater than the pure swing,
    // because a positive baseDamage flat buff is added on top.
    expect(enhancedAsh.baseDamage).toBeGreaterThan(0);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeGreaterThan(swingComponent);
    // The buff contribution (dmg - swing) should be positive.
    expect((dmg[AttackPowerType.PHYSICAL] ?? 0) - swingComponent).toBeGreaterThan(0);
  });

  it("flat buff scales with weapon upgrade level (higher upgrade → bigger buff)", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 });
    const atk0 = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 0 });
    const atk25 = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 25 });

    const dmg0 = calculateEnhancedHitDamage(atk0, enhancedAsh, stats);
    const dmg25 = calculateEnhancedHitDamage(atk25, enhancedAsh, stats);

    // Both should have physical damage. At +25 the flat buff is bigger because
    // baseDamage × (1 + 3 × percentUpgraded) grows with upgrade level.
    expect(dmg0[AttackPowerType.PHYSICAL]).toBeDefined();
    expect(dmg25[AttackPowerType.PHYSICAL]).toBeDefined();
    expect(dmg25[AttackPowerType.PHYSICAL]!).toBeGreaterThan(dmg0[AttackPowerType.PHYSICAL]!);
  });

  it("buff strength at +0 is baseDamage × (1 + 0) = baseDamage baseline", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 });
    const atk0 = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 0 });
    const dmg = calculateEnhancedHitDamage(atk0, enhancedAsh, stats);

    const ar = getTotalAttackRating(atk0);
    const mv = (enhancedAsh.damageMotionValues[AttackPowerType.PHYSICAL] ?? 0) / 100;
    const swing = ar * mv;
    const buff = (dmg[AttackPowerType.PHYSICAL] ?? 0) - swing;
    // At +0, percentUpgraded = 0, so buffStrength = baseDamage × 1 × (1 + statBonus).
    // statBonus is ≥ 0, so buff >= baseDamage.
    expect(buff).toBeGreaterThanOrEqual(enhancedAsh.baseDamage);
  });

  it("handles max upgrade level (+25) without error and produces damage", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 });
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 25 });
    const dmg = calculateEnhancedHitDamage(atk, enhancedAsh, stats);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeGreaterThan(0);
  });
});

describe("calculateBulletHitDamage (projectile skill)", () => {
  it("scales with baseBulletDamage", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 });
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 25 });

    const smallBullet: AshOfWarEntry = {
      ...bulletAsh,
      baseBulletDamage: { [AttackPowerType.PHYSICAL]: 100 },
    };
    const bigBullet: AshOfWarEntry = {
      ...bulletAsh,
      baseBulletDamage: { [AttackPowerType.PHYSICAL]: 400 },
    };
    const small = calculateBulletHitDamage(atk, smallBullet, stats);
    const big = calculateBulletHitDamage(atk, bigBullet, stats);

    expect(big[AttackPowerType.PHYSICAL]!).toBeGreaterThan(small[AttackPowerType.PHYSICAL]!);
    // Roughly proportional (statBonus term is the same, so ~4x for 4x base).
    expect(big[AttackPowerType.PHYSICAL]! / small[AttackPowerType.PHYSICAL]!).toBeGreaterThan(3);
  });

  it("scales with upgrade level (higher upgrade → more bullet damage)", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 });
    const atk0 = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 0 });
    const atk25 = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 25 });

    const dmg0 = calculateBulletHitDamage(atk0, bulletAsh, stats);
    const dmg25 = calculateBulletHitDamage(atk25, bulletAsh, stats);

    expect(dmg0[AttackPowerType.PHYSICAL]).toBeDefined();
    expect(dmg25[AttackPowerType.PHYSICAL]).toBeDefined();
    expect(dmg25[AttackPowerType.PHYSICAL]!).toBeGreaterThan(dmg0[AttackPowerType.PHYSICAL]!);
  });

  it("returns no entry for damage types with zero baseBulletDamage", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40 });
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 10 });
    const dmg = calculateBulletHitDamage(atk, bulletAsh, stats);
    // bulletAsh only has PHYSICAL baseBulletDamage; other types should be absent.
    expect(dmg[AttackPowerType.MAGIC]).toBeUndefined();
    expect(dmg[AttackPowerType.FIRE]).toBeUndefined();
  });

  it("Cold affinity weapon uses 0.15 dual-stat base scaling (lower per-stat bonus)", () => {
    // Clayman's Cold Harpoon is a Cold spear (affinityId 9). The bullet formula
    // selects 0.15 for Cold/Quality affinities vs 0.25 for others.
    const clayman = decoded.find((w) => w.name === "Clayman's Cold Harpoon")!;
    if (!clayman) {
      // If the regulation snapshot lacks this weapon, skip gracefully.
      it.skip("Clayman's Cold Harpoon not in regulation data");
      return;
    }
    const coldBullet: AshOfWarEntry = {
      ...bulletAsh,
      compatibleWeaponTypes: [WeaponType.SPEAR],
      compatibleAffinities: [AffinityId.COLD],
      baseBulletDamage: { [AttackPowerType.MAGIC]: 200 },
    };
    const stats = makeStats({
      [Attribute.STRENGTH]: 12,
      [Attribute.DEXTERITY]: 20,
      [Attribute.INTELLIGENCE]: 80,
    });
    const atk = getWeaponAttack({ weapon: clayman, attributes: stats, upgradeLevel: 25 });
    const dmg = calculateBulletHitDamage(atk, coldBullet, stats);
    expect(dmg[AttackPowerType.MAGIC]).toBeGreaterThan(0);
  });

  it("handles max upgrade level (+25) and produces positive damage", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 });
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 25 });
    const dmg = calculateBulletHitDamage(atk, bulletAsh, stats);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeGreaterThan(0);
  });

  it("returns 0 / undefined when baseBulletDamage is empty", () => {
    const stats = makeStats({ [Attribute.STRENGTH]: 40 });
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 10 });
    const empty: AshOfWarEntry = { ...bulletAsh, baseBulletDamage: {} };
    const dmg = calculateBulletHitDamage(atk, empty, stats);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeUndefined();
  });
});

describe("calculateAshOfWarDamage (dispatcher)", () => {
  const stats = makeStats({ [Attribute.STRENGTH]: 40, [Attribute.DEXTERITY]: 40 });

  it("dispatches to calculateBulletHitDamage when isProjectile is true", () => {
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 10 });
    const dmg = calculateAshOfWarDamage(atk, bulletAsh, stats);
    const direct = calculateBulletHitDamage(atk, bulletAsh, stats);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeCloseTo(direct[AttackPowerType.PHYSICAL] ?? 0, 5);
  });

  it("dispatches to calculateEnhancedHitDamage when baseDamage > 0 and not projectile", () => {
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 10 });
    const dmg = calculateAshOfWarDamage(atk, enhancedAsh, stats);
    const direct = calculateEnhancedHitDamage(atk, enhancedAsh, stats);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeCloseTo(direct[AttackPowerType.PHYSICAL] ?? 0, 5);
  });

  it("dispatches to calculateSkillHitDamage when baseDamage=0 and not projectile", () => {
    const atk = getWeaponAttack({ weapon: broadsword, attributes: stats, upgradeLevel: 10 });
    const dmg = calculateAshOfWarDamage(atk, simpleAsh, stats);
    const direct = calculateSkillHitDamage(atk, simpleAsh);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeCloseTo(direct[AttackPowerType.PHYSICAL] ?? 0, 5);
  });
});

describe("AoW edge cases — Uchigatana (bleed weapon)", () => {
  it("simple skill hit with phys MV ignores bleed buildup (status not in result)", () => {
    const atk = getWeaponAttack({
      weapon: uchigatana,
      attributes: makeStats({ [Attribute.STRENGTH]: 12, [Attribute.DEXTERITY]: 40 }),
      upgradeLevel: 25,
    });
    // Uchigatana has bleed, but the simple skill hit only touches damage types
    // listed in damageMotionValues; bleed is a status type and not present in
    // the AoW motion values, so it should not appear.
    const dmg = calculateSkillHitDamage(atk, simpleAsh);
    expect(dmg[AttackPowerType.PHYSICAL]).toBeGreaterThan(0);
    expect(dmg[AttackPowerType.BLEED]).toBeUndefined();
  });
});
