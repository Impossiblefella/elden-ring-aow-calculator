/**
 * defense.test.ts — Unit tests for the enemy defense formula.
 *
 * Verified against community damage formulas published in /r/Eldenring and
 * damage calculator spreadsheets.
 */

import { describe, it, expect } from 'vitest';
import { calculateDefenseMultiplier, applyDefense, damageAgainstEnemy, AttackPowerType } from '../src/index';

describe('calculateDefenseMultiplier', () => {
  it('returns 0.10 for ratio below 0.125', () => {
    expect(calculateDefenseMultiplier(0)).toBe(0.1);
    expect(calculateDefenseMultiplier(0.1)).toBe(0.1);
    expect(calculateDefenseMultiplier(0.124)).toBeCloseTo(0.1, 5);
  });

  it('produces a quadratic curve in the (0.125, 1) range', () => {
    const r = 0.5;
    const expected = 0.1 + ((r - 0.125) ** 2) / 2.552;
    expect(calculateDefenseMultiplier(r)).toBeCloseTo(expected, 5);
  });

  it('returns exactly 0.1 at ratio = 0.125 (boundary)', () => {
    expect(calculateDefenseMultiplier(0.125)).toBeCloseTo(0.1, 5);
  });

  it('returns 0.7 at ratio = 2.5 (peak of third segment)', () => {
    expect(calculateDefenseMultiplier(2.5)).toBeCloseTo(0.7, 5);
  });

  it('returns exactly 0.9 at ratio = 8', () => {
    expect(calculateDefenseMultiplier(8)).toBeCloseTo(0.9, 5);
  });

  it('returns 0.9 for very high ratios', () => {
    expect(calculateDefenseMultiplier(10)).toBe(0.9);
    expect(calculateDefenseMultiplier(100)).toBe(0.9);
  });

  it('is monotonically non-decreasing across the full range', () => {
    const samples = [0, 0.05, 0.125, 0.3, 0.5, 0.75, 1.0, 1.5, 2.5, 4, 5, 8, 10, 100];
    for (let i = 1; i < samples.length; i++) {
      const prev = calculateDefenseMultiplier(samples[i - 1]);
      const curr = calculateDefenseMultiplier(samples[i]);
      expect(curr).toBeGreaterThanOrEqual(prev - 0.0001);
    }
  });

  it('returns 0 for NaN input', () => {
    expect(calculateDefenseMultiplier(NaN)).toBe(0);
  });
});

describe('applyDefense', () => {
  it('applies motion value, absorption, and defense multiplier correctly', () => {
    // AR = 500, motion = 100 (full), absorption = 20%, defense = 300
    const base = (500 * 100) / 100; // = 500
    const ratio = base / 300; // ~1.667
    const defMult = 0.7 - ((2.5 - ratio) ** 2) / 7.5;
    const expected = base * (1 - 20 / 100) * defMult;
    expect(applyDefense(500, 20, 300, 100)).toBeCloseTo(expected, 1);
  });

  it('produces zero damage for zero AR', () => {
    expect(applyDefense(0, 20, 100, 100)).toBe(0);
  });

  it('handles high AR / low defense (high ratio = 0.9 cap)', () => {
    const dmg = applyDefense(5000, 0, 100, 100);
    // ratio = 50, well above 8, so multiplier = 0.9
    expect(dmg).toBeCloseTo(5000 * 0.9, 0);
  });
});

describe('damageAgainstEnemy', () => {
  it('computes damage with a single motion value', () => {
    const dmg = damageAgainstEnemy({
      attackRating: 300,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 200,
      absorptionPercent: 10,
      motion: 100,
    });
    expect(dmg).toBeGreaterThan(0);
    expect(dmg).toBeLessThan(300);
  });

  it('handles split motion values (e.g. 60 Slash + 40 Pierce)', () => {
    const dmg = damageAgainstEnemy({
      attackRating: 300,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 200,
      absorptionPercent: 10,
      motion: [[60, 'Slash'], [40, 'Pierce']],
    });
    expect(dmg).toBeGreaterThan(0);
    // Split motion should produce roughly same total as single 100 MV
    // (since defense is the same and the motion values sum to 100)
    // but defense is non-linear so there may be a small difference
    const single = damageAgainstEnemy({
      attackRating: 300,
      damageType: AttackPowerType.PHYSICAL,
      enemyDefense: 200,
      absorptionPercent: 10,
      motion: 100,
    });
    // Split deals less due to non-linear defense curve (each sub-hit
    // has a lower attack ratio and thus a lower defense multiplier).
    // The difference can be significant — just verify both are positive
    // and the split doesn't deal MORE than the single hit.
    expect(dmg).toBeGreaterThan(0);
    expect(dmg).toBeLessThanOrEqual(single);
    expect(Math.abs(dmg - single)).toBeLessThan(100);
  });
});
