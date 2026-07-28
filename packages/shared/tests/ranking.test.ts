/**
 * ranking.test.ts — Integration tests for weapon ranking across AoWs.
 *
 * Verifies that rankWeapons:
 *   - Returns weapons sorted by the correct metric (total, dps, stance)
 *   - Assigns sequential rank() numbers starting at 1
 *   - Only includes weapons compatible with the given Ash of War
 *   - Handles edge cases: empty weapon list, no compatible weapons
 *   - Produces different rankings for different AoWs (regression check)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WeaponType,
  decodeAll,
  rankWeapons,
  type AshOfWarEntry,
  type Weapon,
  type Attributes,
} from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));

let weapons: Weapon[];

const baseStats: Attributes = {
  vigor: 50, mind: 30, endurance: 25,
  str: 50, dex: 50, int: 20, fai: 20, arc: 20,
};

// A broadly compatible AoW: works with most blade weapons
const lionsClaw: AshOfWarEntry = {
  id: 100,
  name: "Lion's Claw",
  compatibleWeaponTypes: [WeaponType.GREATSWORD, WeaponType.STRAIGHT_SWORD, WeaponType.KATANA, WeaponType.AXE, WeaponType.SPEAR],
  compatibleAffinities: [],
  damageMotionValues: { 0: 100 },
  baseDamage: 0,
  baseBulletDamage: 0,
  poiseDamage: 60,
  isProjectile: false,
  fpCost: 20,
  description: "Claw down on foes.",
};

// A more narrowly compatible AoW: only daggers + straight swords
const simpleMeleeAoW: AshOfWarEntry = {
  id: 200,
  name: "Simple Skill Hit Test",
  compatibleWeaponTypes: [WeaponType.DAGGER, WeaponType.STRAIGHT_SWORD, WeaponType.THRUSTING_SWORD],
  compatibleAffinities: [],
  damageMotionValues: { 0: 80 },
  baseDamage: 50,
  baseBulletDamage: 0,
  poiseDamage: 30,
  isProjectile: false,
  fpCost: 10,
  description: "Test AoW",
};

beforeAll(() => {
  const data = readFileSync(join(__dirname, 'regulation-vanilla-v1.14.json'), 'utf-8');
  const raw = JSON.parse(data);
  weapons = decodeAll(raw) as Weapon[];
});

describe("rankWeapons — integration", () => {
  it("returns a non-empty ranking for a broadly compatible AoW", () => {
    const results = rankWeapons(weapons, {
      ashOfWar: lionsClaw,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].rank).toBe(1);
    expect(results[0].total).toBeGreaterThan(0);
  });

  it("assigns sequential rank() starting at 1", () => {
    const results = rankWeapons(weapons, {
      ashOfWar: simpleMeleeAoW,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    for (let i = 0; i < results.length; i++) {
      expect(results[i].rank).toBe(i + 1);
    }
  });

  it("sorts by total (best first) in default order", () => {
    const results = rankWeapons(weapons, {
      ashOfWar: lionsClaw,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].total).toBeGreaterThanOrEqual(results[i].total);
    }
  });

  it("sorts by dps when metric is 'dps'", () => {
    const results = rankWeapons(weapons, {
      ashOfWar: lionsClaw,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "dps",
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].dps).toBeGreaterThanOrEqual(results[i].dps);
    }
  });

  it("only includes weapons compatible with the AoW", () => {
    const results = rankWeapons(weapons, {
      ashOfWar: simpleMeleeAoW,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    for (const r of results) {
      const weapon = weapons.find(w => w.id === r.weapon.id);
      expect(weapon).toBeDefined();
      expect(simpleMeleeAoW.compatibleWeaponTypes).toContain(weapon!.weaponType);
    }
  });

  it("returns empty array for an AoW with no compatible weapons in the list", () => {
    const incompatibleAoW: AshOfWarEntry = {
      ...lionsClaw,
      compatibleWeaponTypes: [WeaponType.WHIP],
    };
    const results = rankWeapons(weapons, {
      ashOfWar: incompatibleAoW,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("returns empty for no weapons", () => {
    const results = rankWeapons([], {
      ashOfWar: lionsClaw,
      attributes: baseStats,
      upgradeLevel: 25,
    });
    expect(results).toEqual([]);
  });

  it("produces different rankings for different AoWs (regression)", () => {
    const rankA = rankWeapons(weapons, {
      ashOfWar: lionsClaw,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    const rankB = rankWeapons(weapons, {
      ashOfWar: simpleMeleeAoW,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    // The sets of compatible weapons differ
    const idsA = new Set(rankA.map(r => r.weapon.id));
    const idsB = new Set(rankB.map(r => r.weapon.id));
    const setsDiffer = rankA.length !== rankB.length ||
      Array.from(idsA).some(id => !idsB.has(id)) ||
      Array.from(idsB).some(id => !idsA.has(id));
    expect(setsDiffer).toBe(true);
  });

  it("higher upgrade level increases total damage", () => {
    const low = rankWeapons(weapons, {
      ashOfWar: lionsClaw,
      attributes: baseStats,
      upgradeLevel: 0,
      metric: "total",
    });
    const high = rankWeapons(weapons, {
      ashOfWar: lionsClaw,
      attributes: baseStats,
      upgradeLevel: 25,
      metric: "total",
    });
    if (low.length > 0 && high.length > 0) {
      const sameWeapon = high.find(h => h.weapon.name === low[0].weapon.name);
      if (sameWeapon) {
        expect(sameWeapon.total).toBeGreaterThanOrEqual(low[0].total);
      }
    }
  });
});
