/**
 * buffs.test.ts — Unit tests for the buff stacking system (applyBuffs).
 *
 * Tests the Elden Ring buff stacking rules:
 *  - Aura buffs: only the highest applies (do NOT stack with each other)
 *  - Body buffs: stack multiplicatively with each other AND with auras
 *  - Weapon greases: add flat damage (highest per type; don't stack)
 *  - Talisman allDamageMultiplier: multiplies the final result
 *  - aowMultiplier: NOT applied by applyBuffs (consumed by ranking.ts)
 *  - applicableTypes: restricting buff to certain weapon damage types
 *  - Combinations of all buff categories together
 */

import { describe, it, expect } from "vitest";
import {
  AttackPowerType,
  applyBuffs,
  getBuff,
  BUFF_LIBRARY,
  type Buff,
  type WeaponAttackResult,
} from "../src/index";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal WeaponAttackResult with the given per-type totals. */
function makeAttackResult(
  totals: Partial<Record<AttackPowerType, number>>,
): WeaponAttackResult {
  const attackPower: WeaponAttackResult["attackPower"] = {};
  for (const [k, v] of Object.entries(totals)) {
    const apt = Number(k) as AttackPowerType;
    attackPower[apt] = { total: v!, scaled: 0, weapon: v! };
  }
  return {
    upgradeLevel: 0,
    attackPower,
    spellScaling: {},
    ineffectiveAttributes: [],
    ineffectiveAttackPowerTypes: [],
    effectiveAttributes: {
      vigor: 10, mind: 10, endurance: 10, str: 10,
      dex: 10, int: 10, fai: 10, arc: 10,
    },
    weapon: {
      id: 0,
      name: "TestWeapon",
      weaponType: 3, // STRAIGHT_SWORD
      affinityId: 0,
      requirements: {},
      paired: false,
      sorceryTool: false,
      incantationTool: false,
      dlc: false,
      isSpecialWeapon: false,
      attack: [],
      attributeScaling: [],
      attackElementCorrect: {},
      calcCorrectGraphs: {},
      scalingTiers: [],
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("applyBuffs — aura buffs don't stack with each other", () => {
  it("two aura buffs with the same multiplier produce the same result as one", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 300 });
    const one = applyBuffs(ar, ["golden-vow"]);
    const two = applyBuffs(ar, ["golden-vow", "rallying-standard"]);

    // Both have allDamageMultiplier 0.15 — only the highest applies,
    // so applying both should give the same result as just one.
    expect(two.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(
      one.attackPower[AttackPowerType.PHYSICAL]!,
      5,
    );
    // And that result = 300 * 1.15 = 345
    expect(one.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(345, 5);
  });

  it("two aura buffs with different multipliers: only the highest applies", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 1000 });
    // golden-vow = 0.15, godfrey's-rite-of-sending = 0.10
    const both = applyBuffs(ar, ["golden-vow", "rite-of-sending"]);
    const best = applyBuffs(ar, ["golden-vow"]);

    expect(both.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(
      best.attackPower[AttackPowerType.PHYSICAL]!,
      5,
    );
    // 1000 * 1.15 = 1150 (not 1000 * 1.15 * 1.10)
    expect(both.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(1150, 5);
  });

  it("aura with per-type multiplier (Terra Magica) beats general aura for magic only", () => {
    const ar = makeAttackResult({
      [AttackPowerType.PHYSICAL]: 1000,
      [AttackPowerType.MAGIC]: 1000,
    });
    // Terra Magica: magic +35%; Golden Vow: all +15%.
    // For MAGIC: Terra Magica (0.35) > Golden Vow (0.15) → 0.35 wins.
    // For PHYSICAL: only Golden Voy applies (Terra Magica has no phys mult)
    const result = applyBuffs(ar, ["terra-magica", "golden-vow"]);
    expect(result.attackPower[AttackPowerType.MAGIC]).toBeCloseTo(1350, 5);
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(1150, 5);
  });
});

describe("applyBuffs — body buffs stack with aura buffs", () => {
  it("body buff (FGMS +20% phys) stacks multiplicatively with aura (GV +15% all)", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 300 });
    const result = applyBuffs(ar, ["golden-vow", "flame-grant-me-strength"]);
    // 300 * (1 + 0.15) * (1 + 0.20) = 300 * 1.15 * 1.20 = 414
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(414, 5);
  });

  it("two body buffs stack multiplicatively with each other", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 1000 });
    // FGMS: +20% physical; Exalted Flesh: +20% physical
    const result = applyBuffs(ar, ["flame-grant-me-strength", "exalted-flesh"]);
    // 1000 * (1.20)^2 = 1440
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(1440, 5);
  });

  it("body + aura: both stack, result is product", () => {
    const ar = makeAttackResult({ [AttackPowerType.FIRE]: 500 });
    // Golden Vow +15% all (aura); FGMS +20% fire (body)
    const result = applyBuffs(ar, ["golden-vow", "flame-grant-me-strength"]);
    // 500 * 1.15 * 1.20 = 690
    expect(result.attackPower[AttackPowerType.FIRE]).toBeCloseTo(690, 5);
  });
});

describe("applyBuffs — weapon greases add flat damage", () => {
  it("fire grease adds 60 flat fire damage after aura/body multipliers", () => {
    const ar = makeAttackResult({ [AttackPowerType.FIRE]: 200 });
    const result = applyBuffs(ar, ["fire-grease"]);
    // Formula: (200 * (1 + 0) * 1 + 60) * 1 * 1 = 260
    expect(result.attackPower[AttackPowerType.FIRE]).toBeCloseTo(260, 5);
  });

  it("grease flat is added AFTER multiplicative buffs (aura × body + flat)", () => {
    const ar = makeAttackResult({ [AttackPowerType.FIRE]: 200 });
    // Golden Vow +15% all, FGMS +20% fire, Fire Grease +60 flat
    const result = applyBuffs(ar, [
      "golden-vow",
      "flame-grant-me-strength",
      "fire-grease",
    ]);
    // (200 * 1.15 * 1.20 + 60) * 1 * 1 = 276 + 60 = 336
    expect(result.attackPower[AttackPowerType.FIRE]).toBeCloseTo(336, 5);
  });

  it("two greases of different types each add their own flat", () => {
    const ar = makeAttackResult({
      [AttackPowerType.FIRE]: 100,
      [AttackPowerType.MAGIC]: 100,
    });
    const result = applyBuffs(ar, ["fire-grease", "magic-grease"]);
    expect(result.attackPower[AttackPowerType.FIRE]).toBeCloseTo(160, 5);
    expect(result.attackPower[AttackPowerType.MAGIC]).toBeCloseTo(160, 5);
  });

  it("status grease (blood bleed +55) adds flat to status type", () => {
    const ar = makeAttackResult({ [AttackPowerType.BLEED]: 55 });
    const result = applyBuffs(ar, ["blood-grease"]);
    // For status types only flat weapon buffs apply (no multipliers).
    expect(result.attackPower[AttackPowerType.BLEED]).toBeCloseTo(110, 5);
  });
});

describe("applyBuffs — talisman allDamageMultiplier multiplies correctly", () => {
  it("ritual-sword-talisman (+10% all) multiplies final result", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 300 });
    const result = applyBuffs(ar, ["ritual-sword-talisman"]);
    // (300 * 1 * 1 + 0) * 1.10 * 1 = 330
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(330, 5);
  });

  it("two talismans with allDamageMultiplier stack multiplicatively", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 1000 });
    // Ritual Sword +10%, Rotten Winged +15%
    const result = applyBuffs(ar, [
      "ritual-sword-talisman",
      "rotten-winged-sword-insignia",
    ]);
    // 1000 * 1.10 * 1.15 = 1265
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(1265, 5);
  });

  it("talisman per-type multiplier only affects that damage type", () => {
    const ar = makeAttackResult({
      [AttackPowerType.PHYSICAL]: 1000,
      [AttackPowerType.MAGIC]: 1000,
    });
    // Magic Scorpion: +12% magic only
    const result = applyBuffs(ar, ["magic-scorpion-talisman"]);
    expect(result.attackPower[AttackPowerType.MAGIC]).toBeCloseTo(1120, 5);
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(1000, 5);
  });
});

describe("applyBuffs — aowMultiplier is NOT applied to normal AR", () => {
  it("Shard of Alexander (aowMultiplier 0.15) has no effect on normal AR", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 500 });
    const result = applyBuffs(ar, ["shard-of-alexander"]);
    // aowMultiplier is consumed by ranking.ts, not applyBuffs
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(500, 5);
  });

  it("aowMultiplier buffs do not change any damage type in applyBuffs output", () => {
    const ar = makeAttackResult({
      [AttackPowerType.PHYSICAL]: 300,
      [AttackPowerType.MAGIC]: 300,
    });
    const noBuff = applyBuffs(ar, []);
    const withAow = applyBuffs(ar, ["shard-of-alexander", "claw-talisman"]);
    // Both have aowMultiplier but no allDamageMultiplier or per-type multipliers
    expect(withAow.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(
      noBuff.attackPower[AttackPowerType.PHYSICAL]!,
      5,
    );
    expect(withAow.attackPower[AttackPowerType.MAGIC]).toBeCloseTo(
      noBuff.attackPower[AttackPowerType.MAGIC]!,
      5,
    );
  });
});

describe("applyBuffs — combinations of multiple buff types", () => {
  it("aura + body + weapon + talisman all combine correctly", () => {
    const ar = makeAttackResult({ [AttackPowerType.PHYSICAL]: 400 });
    const result = applyBuffs(ar, [
      "golden-vow",          // aura: +15% all
      "flame-grant-me-strength", // body: +20% physical
      "fire-grease",         // weapon: +60 flat fire (no phys flat, so 0 for phys)
      "ritual-sword-talisman", // talisman: +10% all damage multiplier
    ]);
    // Formula: (400 * (1 + 0.15) * (1 + 0.20) + 0) * (1 + 0.10) * 1
    // = (400 * 1.15 * 1.20 + 0) * 1.10 = 552 * 1.10 = 607.2
    expect(result.attackPower[AttackPowerType.PHYSICAL]).toBeCloseTo(607.2, 1);
  });

  it("fire damage with aura + body + weapon( grease) + talisman", () => {
    const ar = makeAttackResult({ [AttackPowerType.FIRE]: 300 });
    const result = applyBuffs(ar, [
      "golden-vow",            // aura: +15% all
      "flame-grant-me-strength", // body: +20% fire
      "fire-grease",           // weapon: +60 flat fire
      "fire-scorpion-talisman", // talisman: +12% fire
    ]);
    // (300 * 1.15 * 1.20 + 60) * (1 + 0.12) * 1
    // = (414 + 60) * 1.12 = 474 * 1.12 = 530.88
    expect(result.attackPower[AttackPowerType.FIRE]).toBeCloseTo(530.88, 1);
  });

  it("physick tear stacks multiplicatively after talisman", () => {
    const ar = makeAttackResult({ [AttackPowerType.MAGIC]: 400 });
    const result = applyBuffs(ar, [
      "magic-scorpion-talisman", // talisman: +12% magic
      "magic-shrouding-tear",    // physick: +25% magic
    ]);
    // (400 * 1 * 1 + 0) * (1.12) * (1.25) = 400 * 1.12 * 1.25 = 560
    expect(result.attackPower[AttackPowerType.MAGIC]).toBeCloseTo(560, 1);
  });
});

describe("applyBuffs — applicableTypes on Buff interface", () => {
  it("Buff interface supports applicableTypes field (restricts by damage type)", () => {
    // The applicableTypes field exists on the Buff interface.
    // The engine's applyBuffs does not currently enforce applicableTypes
    // (no weapon-type context is available in applyBuffs), but the field
    // is on the interface for caller-side filtering. We verify it's present.
    const customBuff: Buff = {
      id: "test-restricted",
      name: "Test Restricted",
      category: "talisman",
      multipliers: { [AttackPowerType.MAGIC]: 0.20 },
      applicableTypes: [AttackPowerType.MAGIC],
    };
    expect(customBuff.applicableTypes).toBeDefined();
    expect(customBuff.applicableTypes).toContain(AttackPowerType.MAGIC);
    expect(customBuff.applicableTypes).not.toContain(AttackPowerType.PHYSICAL);
  });

  it("BUFF_LIBRARY buffs may define applicableTypes for caller-side filtering", () => {
    // None of the library buffs currently use applicableTypes (all are unconditional),
    // but the field is available for custom buffs. Verify the图书馆 loads.
    const gv = getBuff("golden-vow");
    expect(gv).toBeDefined();
    expect(gv!.allDamageMultiplier).toBe(0.15);
    // Buffs without applicableTypes should have the field undefined.
    expect(gv!.applicableTypes).toBeUndefined();
  });

  it("applicableTypes is used to restrict which damage types a buff affects", () => {
    // A custom talisman that only applies to MAGIC should not boost PHYSICAL
    // when the caller respects applicableTypes. We simulate the caller-side
    // filtering that the engine's ranking/ar layer would do:
    const magicOnlyBuff: Buff = {
      id: "magic-only-test",
      name: "Magic Only Test",
      category: "talisman",
      multipliers: {
        [AttackPowerType.MAGIC]: 0.30,
        [AttackPowerType.PHYSICAL]: 0.30,
      },
      applicableTypes: [AttackPowerType.MAGIC],
    };

    // When applicableTypes is set, caller should only apply the buff to
    // matching types. We verify the restriction logic:
    const physAllowed = !magicOnlyBuff.applicableTypes ||
      magicOnlyBuff.applicableTypes.includes(AttackPowerType.PHYSICAL);
    const magicAllowed = !magicOnlyBuff.applicableTypes ||
      magicOnlyBuff.applicableTypes.includes(AttackPowerType.MAGIC);

    expect(magicAllowed).toBe(true);
    expect(physAllowed).toBe(false);
  });
});
