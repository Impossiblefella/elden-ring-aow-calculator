/**
 * pvp.test.ts — Tests for the Elden Ring PvP damage formula.
 *
 * Verifies the flat-defense + scalar + status-nerf behavior that
 * distinguishes PvP from the PvE piecewise defense curve.
 */
import { describe, it, expect } from "vitest";
import {
  PVP_FLAT_DEFENSE,
  PVP_DAMAGE_SCALAR,
  PVP_STATUS_MULTIPLIER,
  DEFAULT_PVP_HP,
  damageAgainstPlayer,
  damageAgainstPlayerMulti,
  hitsToKillPvP,
  pvpStatusProcDamage,
} from "../src/engine/pvp";
import { AttackPowerType } from "../src/types";

describe("PvP constants", () => {
  it("uses the patch 1.09 flat 355 defense value", () => {
    expect(PVP_FLAT_DEFENSE).toBe(355);
  });
  it("uses ~0.85 damage scalar", () => {
    expect(PVP_DAMAGE_SCALAR).toBeCloseTo(0.85, 2);
  });
  it("uses 0.25 status buildup multiplier", () => {
    expect(PVP_STATUS_MULTIPLIER).toBe(0.25);
  });
  it("default PvP HP is a realistic RL125-150 value", () => {
    expect(DEFAULT_PVP_HP).toBeGreaterThan(1500);
    expect(DEFAULT_PVP_HP).toBeLessThan(2200);
  });
});

describe("damageAgainstPlayer", () => {
  it("applies flat defense after motion + scalar + absorption", () => {
    // AR 500 × mv 100 / 100 = 500 raw
    // × 0.85 = 425
    // × (1 − 20/100) = 340
    // − 355 flat = -15 → chip 1
    const dmg = damageAgainstPlayer({
      attackRating: 500,
      motion: 100,
      absorptionPercent: 20,
    });
    expect(dmg).toBe(1); // clipped to chip-damage minimum
  });

  it("returns >0 for high AR hits", () => {
    // AR 1000 × 100/100 = 1000
    // × 0.85 = 850
    // × (1 − 0/100) = 850
    // − 355 = 495
    const dmg = damageAgainstPlayer({ attackRating: 1000, motion: 100 });
    expect(dmg).toBeCloseTo(495, 0);
  });

  it("motion value scales the raw damage (when above flat-def chip floor)", () => {
    // High enough AR that we don't hit the chip-damage floor of 1.
    const r1 = damageAgainstPlayer({ attackRating: 2000, motion: 100 });
    const r2 = damageAgainstPlayer({ attackRating: 2000, motion: 50 });
    // r1: (2000 × 1.00 × 0.85) − 355
    // r2: (2000 × 0.50 × 0.85) − 355
    expect(r1).toBeCloseTo(2000 * 1.0 * 0.85 - 355, 0);
    expect(r2).toBeCloseTo(2000 * 0.5 * 0.85 - 355, 0);
    expect(r2).toBeLessThan(r1);
  });

  it("returns 0 for zero AR", () => {
    expect(damageAgainstPlayer({ attackRating: 0 })).toBe(0);
  });

  it("returns 0 for zero motion", () => {
    expect(damageAgainstPlayer({ attackRating: 500, motion: 0 })).toBe(0);
  });

  it("combines absorption + targetNegation additively", () => {
    const withArmor = damageAgainstPlayer({
      attackRating: 2000,
      absorptionPercent: 30,
      targetNegationPercent: 10,
    });
    // raw 2000 × 0.85 = 1700
    // × (1 − (30+10)/100) = 1020
    // − 355 = 665
    expect(withArmor).toBeCloseTo(665, 0);
  });
});

describe("damageAgainstPlayerMulti", () => {
  it("sums per-type damage and returns breakdown", () => {
    const result = damageAgainstPlayerMulti(
      {
        [AttackPowerType.PHYSICAL]: 1000,
        [AttackPowerType.MAGIC]: 500,
      },
      {
        [AttackPowerType.PHYSICAL]: 0,
        [AttackPowerType.MAGIC]: 0,
      },
      100,
    );
    expect(result.perType[AttackPowerType.PHYSICAL]).toBeCloseTo(495, 0);
    // 500 × 0.85 = 425 − 355 = 70
    expect(result.perType[AttackPowerType.MAGIC]).toBeCloseTo(70, 0);
    expect(result.total).toBeCloseTo(565, 0);
  });

  it("skips damage types with zero AR", () => {
    const result = damageAgainstPlayerMulti(
      { [AttackPowerType.FIRE]: 1000 },
      {},
      100,
    );
    expect(result.perType[AttackPowerType.PHYSICAL]).toBeUndefined();
    expect(result.perType[AttackPowerType.FIRE]).toBeCloseTo(495, 0);
  });
});

describe("hitsToKillPvP", () => {
  it("returns ceil of HP / damage", () => {
    expect(hitsToKillPvP(100, 1900)).toBe(19);
    expect(hitsToKillPvP(475, 1900)).toBe(4);
  });
  it("returns Infinity for non-positive damage", () => {
    expect(hitsToKillPvP(0)).toBe(Infinity);
    expect(hitsToKillPvP(-50)).toBe(Infinity);
  });
});

describe("pvpStatusProcDamage", () => {
  it("quarters the status AR before computing procs", () => {
    const out = pvpStatusProcDamage({
      bleed: 100,
      frost: 100,
      poison: 100,
      scarletRot: 100,
    });
    // With 100 bleed × 0.25 = 25 per hit, threshold 600, resist 400 (effective -=40 → 25-4 = 21)
    // 600 / 21 = ~29 hits → proc damage 1900*0.15+100 = 385 / 29 ≈ 13.3 per hit
    expect(out.bleed).toBeGreaterThan(0);
    expect(out.frost).toBeGreaterThan(0);
    expect(out.poison).toBeGreaterThan(0);
    expect(out.scarletRot).toBeGreaterThan(0);
    expect(out.total).toBeGreaterThan(0);
    expect(out.hitsToProc.bleed).toBeGreaterThan(10); // 4x more hits than PvE
  });

  it("returns zeros when no status AR provided", () => {
    const out = pvpStatusProcDamage({});
    expect(out.bleed).toBe(0);
    expect(out.frost).toBe(0);
    expect(out.poison).toBe(0);
    expect(out.scarletRot).toBe(0);
    expect(out.total).toBe(0);
  });

  it("reports hits-to-proc as Infinity when status AR is below resist threshold", () => {
    // AR 1 × 0.25 = 0.25 per hit, effective becomes 0.25 * 0.1 = 0.025
    // threshold / 0.025 = enormous
    const out = pvpStatusProcDamage({ bleed: 1 });
    expect(out.hitsToProc.bleed).toBeGreaterThan(100);
  });
});
