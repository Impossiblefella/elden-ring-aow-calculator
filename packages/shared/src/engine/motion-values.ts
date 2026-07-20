/**
 * motion-values.ts — Motion value tables per WeaponType / attack slot.
 *
 * Motion values are expressed as percentages of the weapon AR (100 = full AR).
 * Multi-hit attacks use " + " to separate hits (e.g. "82 + 82").
 *
 * Damage motion values come from community-tested data (Ainrun's ER motion
 * value spreadsheet & nyedr). Status motion values are separate because
 * powerstance reductions apply post-1.07 (×0.7).
 *
 * Key convention:
 *   "1h R1 1" = one-handed light attack, first hit
 *   "2h R1 1" = two-handed light attack, first hit
 *   "1h L1 1" = powerstance light attack, first pair (each hit)
 *   "2h R2 1" = two-handed heavy attack, first hit
 *   "Jump 2h" = two-handed jumping attack
 *   "Running 1h/2h" = running attack
 *   "Rolling 1h/2h" = rolling attack
 *   "Guard Counter" = guard counter attack
 */

import { WeaponType } from "../types";

export type MotionValuesByMove = Record<string, string>;
export type StatusMotionValuesByMove = Record<string, number>;

export interface MotionValueTable {
  damage: MotionValuesByMove;
  status: StatusMotionValuesByMove;
}

export const defaultDamageMotionValue = "100";
export const defaultStatusMotionValue = 100;

/** Post-1.07 powerstance status reduction multiplier. */
const PS = 0.7;

export const motionValueTables: Partial<Record<WeaponType, MotionValueTable>> = {
  // ─── Straight Sword ───────────────────────────────────────────────────────
  [WeaponType.STRAIGHT_SWORD]: {
    damage: {
      "1h R1 1": "82", "1h R1 2": "82 + 82", "1h R1 3": "82 + 82 + 108",
      "2h R1 1": "82", "2h R1 2": "82 + 82", "2h R1 3": "82 + 82 + 108",
      "2h R2 1": "120", "2h R2 2": "120",
      "2h L1 1": "70 + 70", "1h L1 1": "70 + 70",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "125",
      "Rolling 1h": "82", "Rolling 2h": "125", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "1h L1 1": 75 * PS, "2h L1 1": 75 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Greatsword ───────────────────────────────────────────────────────────
  [WeaponType.GREATSWORD]: {
    damage: {
      "1h R1 1": "110", "1h R1 2": "110", "1h R1 3": "140",
      "2h R1 1": "115", "2h R1 2": "115", "2h R1 3": "140",
      "2h R2 1": "155", "2h R2 2": "155",
      "2h L1 1": "85 + 85",
      "Jump 2h": "150", "Running 1h": "135", "Running 2h": "135",
      "Rolling 1h": "115", "Rolling 2h": "130", "Guard Counter": "140",
    },
    status: {
      "1h R1 1": 80, "2h R1 1": 80,
      "2h L1 1": 80 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Colossal Sword ───────────────────────────────────────────────────────
  [WeaponType.COLOSSAL_SWORD]: {
    damage: {
      "1h R1 1": "125", "1h R1 2": "125", "1h R1 3": "160",
      "2h R1 1": "130", "2h R1 2": "130", "2h R1 3": "170",
      "2h R2 1": "180",
      "Jump 2h": "150", "Running 1h": "140", "Running 2h": "140",
      "Rolling 1h": "125", "Rolling 2h": "130", "Guard Counter": "160",
    },
    status: {
      "1h R1 1": 90, "2h R1 1": 90,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Dagger ───────────────────────────────────────────────────────────────
  [WeaponType.DAGGER]: {
    damage: {
      "1h R1 1": "60", "1h R1 2": "60 + 60", "1h R1 3": "60 + 60 + 70",
      "2h R1 1": "60", "2h R1 2": "60 + 60", "2h R1 3": "60 + 60 + 70",
      "2h R2 1": "85",
      "1h L1 1": "45 + 45",
      "Jump 2h": "150", "Running 1h": "115", "Rolling 1h": "82",
      "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "1h L1 1": 70 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Curved Sword ─────────────────────────────────────────────────────────
  [WeaponType.CURVED_SWORD]: {
    damage: {
      "1h R1 1": "73", "1h R1 2": "73 + 73", "1h R1 3": "73 + 73 + 102",
      "2h R1 1": "73", "2h R1 2": "73 + 73", "2h R1 3": "73 + 73 + 102",
      "2h R2 1": "130",
      "2h L1 1": "60 + 60",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "130",
      "Rolling 1h": "82", "Rolling 2h": "125", "Guard Counter": "110",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "2h L1 1": 75 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 110,
    },
  },

  // ─── Katana ───────────────────────────────────────────────────────────────
  [WeaponType.KATANA]: {
    damage: {
      "1h R1 1": "82", "1h R1 2": "82 + 82", "1h R1 3": "82 + 82 + 108",
      "2h R1 1": "82", "2h R1 2": "82 + 82", "2h R1 3": "82 + 82 + 108",
      "2h R2 1": "130",
      "1h L1 1": "70 + 70",
      "Jump 2h": "150", "Running 1h": "120", "Running 2h": "130",
      "Rolling 1h": "82", "Rolling 2h": "130", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "1h L1 1": 75 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Spear ────────────────────────────────────────────────────────────────
  [WeaponType.SPEAR]: {
    damage: {
      "1h R1 1": "72", "1h R1 2": "72 + 72", "1h R1 3": "72 + 72 + 96",
      "2h R1 1": "72", "2h R1 2": "72 + 72", "2h R1 3": "72 + 72 + 96",
      "2h R2 1": "130",
      "1h L1 1": "60 + 60",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "120",
      "Rolling 1h": "72", "Rolling 2h": "125", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "1h L1 1": 70 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Great Spear ───────────────────────────────────────────────────────────
  [WeaponType.GREAT_SPEAR]: {
    damage: {
      "1h R1 1": "100", "1h R1 2": "100", "1h R1 3": "130",
      "2h R1 1": "105", "2h R1 2": "105", "2h R1 3": "135",
      "2h R2 1": "155",
      "1h L1 1": "75 + 75",
      "Jump 2h": "150", "Running 1h": "130", "Running 2h": "135",
      "Rolling 1h": "100", "Rolling 2h": "130", "Guard Counter": "140",
    },
    status: {
      "1h R1 1": 80, "2h R1 1": 80,
      "1h L1 1": 80 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Halberd ───────────────────────────────────────────────────────────────
  [WeaponType.HALBERD]: {
    damage: {
      "1h R1 1": "110", "1h R1 2": "110", "1h R1 3": "140",
      "2h R1 1": "115", "2h R1 2": "115", "2h R1 3": "145",
      "2h R2 1": "155",
      "1h L1 1": "80 + 80",
      "Jump 2h": "150", "Running 1h": "135", "Running 2h": "135",
      "Rolling 1h": "115", "Rolling 2h": "130", "Guard Counter": "140",
    },
    status: {
      "1h R1 1": 80, "2h R1 1": 80,
      "1h L1 1": 80 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Twinblade ─────────────────────────────────────────────────────────────
  [WeaponType.TWINBLADE]: {
    damage: {
      "1h R1 1": "50 + 50", "1h R1 2": "50 + 50 + 60",
      "2h R1 1": "50 + 50", "2h R1 2": "50 + 50 + 60",
      "2h R2 1": "70 + 70",
      "1h L1 1": "35 + 35 + 35 + 35",
      "Jump 2h": "75 + 75", "Running 1h": "60 + 60", "Running 2h": "60 + 60",
      "Rolling 1h": "50 + 50", "Rolling 2h": "65 + 65", "Guard Counter": "80 + 80",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "1h L1 1": 70 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Axe ───────────────────────────────────────────────────────────────────
  [WeaponType.AXE]: {
    damage: {
      "1h R1 1": "90", "1h R1 2": "90", "1h R1 3": "110",
      "2h R1 1": "95", "2h R1 2": "95", "2h R1 3": "115",
      "2h R2 1": "140",
      "1h L1 1": "70 + 70",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "115",
      "Rolling 1h": "82", "Rolling 2h": "125", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "1h L1 1": 75 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Hammer ────────────────────────────────────────────────────────────────
  [WeaponType.HAMMER]: {
    damage: {
      "1h R1 1": "95", "1h R1 2": "95", "1h R1 3": "115",
      "2h R1 1": "100", "2h R1 2": "100", "2h R1 3": "120",
      "2h R2 1": "145",
      "1h L1 1": "70 + 70",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "120",
      "Rolling 1h": "82", "Rolling 2h": "125", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "1h L1 1": 75 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Colossal Weapon ───────────────────────────────────────────────────────
  [WeaponType.COLOSSAL_WEAPON]: {
    damage: {
      "1h R1 1": "135", "1h R1 2": "135", "1h R1 3": "170",
      "2h R1 1": "135", "2h R1 2": "135", "2h R1 3": "170",
      "2h R2 1": "185",
      "Jump 2h": "150", "Running 1h": "140", "Running 2h": "140",
      "Rolling 1h": "130", "Rolling 2h": "135", "Guard Counter": "160",
    },
    status: {
      "1h R1 1": 90, "2h R1 1": 90,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Thrusting Sword ───────────────────────────────────────────────────────
  [WeaponType.THRUSTING_SWORD]: {
    damage: {
      "1h R1 1": "70", "1h R1 2": "70 + 70", "1h R1 3": "70 + 70 + 90",
      "2h R1 1": "70", "2h R1 2": "70 + 70", "2h R1 3": "70 + 70 + 90",
      "2h R2 1": "120",
      "1h L1 1": "60 + 60",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "125",
      "Rolling 1h": "82", "Rolling 2h": "130", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "1h L1 1": 70 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Curved Greatsword ─────────────────────────────────────────────────────
  [WeaponType.CURVED_GREATSWORD]: {
    damage: {
      "1h R1 1": "105", "1h R1 2": "105", "1h R1 3": "135",
      "2h R1 1": "110", "2h R1 2": "110", "2h R1 3": "140",
      "2h R2 1": "150",
      "2h L1 1": "80 + 80",
      "Jump 2h": "150", "Running 1h": "130", "Running 2h": "135",
      "Rolling 1h": "110", "Rolling 2h": "130", "Guard Counter": "140",
    },
    status: {
      "1h R1 1": 80, "2h R1 1": 80,
      "2h L1 1": 80 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Great Hammer ──────────────────────────────────────────────────────────
  [WeaponType.GREAT_HAMMER]: {
    damage: {
      "1h R1 1": "120", "1h R1 2": "120", "1h R1 3": "150",
      "2h R1 1": "125", "2h R1 2": "125", "2h R1 3": "155",
      "2h R2 1": "170",
      "Jump 2h": "150", "Running 1h": "135", "Running 2h": "140",
      "Rolling 1h": "120", "Rolling 2h": "130", "Guard Counter": "140",
    },
    status: {
      "1h R1 1": 85, "2h R1 1": 85,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Claw ──────────────────────────────────────────────────────────────────
  [WeaponType.CLAW]: {
    damage: {
      "1h R1 1": "55", "1h R1 2": "55 + 55",
      "2h R1 1": "60", "2h R1 2": "60 + 60",
      "2h R2 1": "85",
      "1h L1 1": "40 + 40 + 40 + 40",
      "Jump 2h": "150", "Running 1h": "100", "Running 2h": "110",
      "Rolling 1h": "60", "Rolling 2h": "110", "Guard Counter": "100",
    },
    status: {
      "1h R1 1": 65, "2h R1 1": 65,
      "1h L1 1": 65 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 100,
    },
  },

  // ─── Light Greatsword (DLC) ─────────────────────────────────────────────────
  [WeaponType.LIGHT_GREATSWORD]: {
    damage: {
      "1h R1 1": "90", "1h R1 2": "90 + 90", "1h R1 3": "90 + 90 + 110",
      "2h R1 1": "95", "2h R1 2": "95 + 95", "2h R1 3": "95 + 95 + 115",
      "2h R2 1": "130",
      "1h L1 1": "75 + 75 + 75",
      "Jump 2h": "150", "Running 1h": "120", "Running 2h": "125",
      "Rolling 1h": "90", "Rolling 2h": "130", "Guard Counter": "125",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "1h L1 1": 75 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Backhand Blade (DLC) ───────────────────────────────────────────────────
  [WeaponType.BACKHAND_BLADE]: {
    damage: {
      "1h R1 1": "65", "1h R1 2": "65 + 65", "1h R1 3": "65 + 65 + 85",
      "2h R1 1": "65", "2h R1 2": "65 + 65", "2h R1 3": "65 + 65 + 85",
      "2h R2 1": "100",
      "1h L1 1": "45 + 45 + 45 + 45",
      "Jump 2h": "150", "Running 1h": "100", "Running 2h": "105",
      "Rolling 1h": "65", "Rolling 2h": "110", "Guard Counter": "110",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "1h L1 1": 70 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 100,
    },
  },

  // ─── Greataxe ──────────────────────────────────────────────────────────────
  [WeaponType.GREATAXE]: {
    damage: {
      "1h R1 1": "120", "1h R1 2": "120", "1h R1 3": "155",
      "2h R1 1": "125", "2h R1 2": "125", "2h R1 3": "160",
      "2h R2 1": "170",
      "1h L1 1": "90 + 90",
      "Jump 2h": "150", "Running 1h": "135", "Running 2h": "140",
      "Rolling 1h": "120", "Rolling 2h": "130", "Guard Counter": "140",
    },
    status: {
      "1h R1 1": 85, "2h R1 1": 85,
      "1h L1 1": 85 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Flail ──────────────────────────────────────────────────────────────────
  [WeaponType.FLAIL]: {
    damage: {
      "1h R1 1": "95", "1h R1 2": "95", "1h R1 3": "120",
      "2h R1 1": "100", "2h R1 2": "100", "2h R1 3": "125",
      "2h R2 1": "140",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "120",
      "Rolling 1h": "82", "Rolling 2h": "125", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Reaper ──────────────────────────────────────────────────────────────────
  [WeaponType.REAPER]: {
    damage: {
      "1h R1 1": "100", "1h R1 2": "100", "1h R1 3": "130",
      "2h R1 1": "105", "2h R1 2": "105", "2h R1 3": "135",
      "2h R2 1": "150",
      "1h L1 1": "75 + 75",
      "Jump 2h": "150", "Running 1h": "130", "Running 2h": "135",
      "Rolling 1h": "100", "Rolling 2h": "130", "Guard Counter": "135",
    },
    status: {
      "1h R1 1": 80, "2h R1 1": 80,
      "1h L1 1": 80 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Fist ────────────────────────────────────────────────────────────────────
  [WeaponType.FIST]: {
    damage: {
      "1h R1 1": "50 + 50", "1h R1 2": "50 + 50 + 55",
      "2h R1 1": "55 + 55", "2h R1 2": "55 + 55 + 60",
      "2h R2 1": "70 + 70",
      "1h L1 1": "35 + 35 + 35 + 35",
      "Jump 2h": "75 + 75", "Running 1h": "60 + 60", "Running 2h": "60 + 60",
      "Rolling 1h": "50 + 50", "Rolling 2h": "65 + 65", "Guard Counter": "80 + 80",
    },
    status: {
      "1h R1 1": 65, "2h R1 1": 65,
      "1h L1 1": 65 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Whip ────────────────────────────────────────────────────────────────────
  [WeaponType.WHIP]: {
    damage: {
      "1h R1 1": "75", "1h R1 2": "75", "1h R1 3": "100",
      "2h R1 1": "75", "2h R1 2": "75", "2h R1 3": "100",
      "2h R2 1": "120",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "120",
      "Rolling 1h": "82", "Rolling 2h": "125", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Heavy Thrusting Sword ──────────────────────────────────────────────────
  [WeaponType.HEAVY_THRUSTING_SWORD]: {
    damage: {
      "1h R1 1": "80", "1h R1 2": "80 + 80", "1h R1 3": "80 + 80 + 100",
      "2h R1 1": "85", "2h R1 2": "85 + 85", "2h R1 3": "85 + 85 + 110",
      "2h R2 1": "135",
      "1h L1 1": "60 + 60",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "130",
      "Rolling 1h": "82", "Rolling 2h": "130", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "1h L1 1": 70 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Light Bow ───────────────────────────────────────────────────────────────
  [WeaponType.LIGHT_BOW]: {
    damage: {
      "1h R1 1": "60", "1h R1 2": "60", "1h R1 3": "60",
      "2h R1 1": "60", "2h R1 2": "60", "2h R1 3": "60",
      "Jump 2h": "150", "Running 1h": "85", "Rolling 1h": "82",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90,
    },
  },

  // ─── Bow ────────────────────────────────────────────────────────────────────
  [WeaponType.BOW]: {
    damage: {
      "1h R1 1": "70", "1h R1 2": "70", "1h R1 3": "70",
      "2h R1 1": "70", "2h R1 2": "70", "2h R1 3": "70",
      "Jump 2h": "150", "Running 1h": "85", "Rolling 1h": "82",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90,
    },
  },

  // ─── Greatbow ─────────────────────────────────────────────────────────────────
  [WeaponType.GREATBOW]: {
    damage: {
      "1h R1 1": "90", "2h R1 1": "90",
      "Jump 2h": "150", "Running 1h": "85", "Rolling 1h": "82",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90,
    },
  },

  // ─── Crossbow ────────────────────────────────────────────────────────────────
  [WeaponType.CROSSBOW]: {
    damage: {
      "1h R1 1": "80", "2h R1 1": "80",
      "Jump 2h": "150", "Rolling 1h": "82",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "Jump 2h": 110, "Rolling 1h": 90,
    },
  },

  // ─── Ballista ───────────────────────────────────────────────────────────────
  [WeaponType.BALLISTA]: {
    damage: {
      "1h R1 1": "100", "2h R1 1": "100",
      "Jump 2h": "150", "Rolling 1h": "82",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "Jump 2h": 110, "Rolling 1h": 90,
    },
  },

  // ─── Small Shield ─────────────────────────────────────────────────────────────
  [WeaponType.SMALL_SHIELD]: {
    damage: {
      "1h R1 1": "80", "1h R1 2": "80", "1h R1 3": "100",
      "2h R1 1": "80", "2h R1 2": "80", "2h R1 3": "100",
      "2h R2 1": "120",
      "Jump 2h": "150", "Running 1h": "115", "Rolling 1h": "82",
      "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Medium Shield ────────────────────────────────────────────────────────────
  [WeaponType.MEDIUM_SHIELD]: {
    damage: {
      "1h R1 1": "90", "1h R1 2": "90", "1h R1 3": "110",
      "2h R1 1": "95", "2h R1 2": "95", "2h R1 3": "115",
      "2h R2 1": "130",
      "Jump 2h": "150", "Running 1h": "115", "Rolling 1h": "82",
      "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Greatshield ──────────────────────────────────────────────────────────────
  [WeaponType.GREATSHIELD]: {
    damage: {
      "1h R1 1": "100", "1h R1 2": "100", "1h R1 3": "125",
      "2h R1 1": "105", "2h R1 2": "105", "2h R1 3": "130",
      "2h R2 1": "145",
      "Jump 2h": "150", "Running 1h": "115", "Rolling 1h": "82",
      "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 80, "2h R1 1": 80,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Glintstone Staff ────────────────────────────────────────────────────────
  [WeaponType.GLINTSTONE_STAFF]: {
    damage: {
      "1h R1 1": "55", "1h R1 2": "55 + 55", "1h R1 3": "55 + 55 + 70",
      "2h R1 1": "55", "2h R1 2": "55 + 55", "2h R1 3": "55 + 55 + 70",
      "2h R2 1": "85",
      "Jump 2h": "150", "Running 1h": "100", "Rolling 1h": "55",
      "Guard Counter": "100",
    },
    status: {
      "1h R1 1": 65, "2h R1 1": 65,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 100,
    },
  },

  // ─── Sacred Seal ─────────────────────────────────────────────────────────────
  [WeaponType.SACRED_SEAL]: {
    damage: {
      "1h R1 1": "55", "1h R1 2": "55 + 55", "1h R1 3": "55 + 55 + 70",
      "2h R1 1": "55", "2h R1 2": "55 + 55", "2h R1 3": "55 + 55 + 70",
      "2h R2 1": "85",
      "Jump 2h": "150", "Running 1h": "100", "Rolling 1h": "55",
      "Guard Counter": "100",
    },
    status: {
      "1h R1 1": 65, "2h R1 1": 65,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 100,
    },
  },

  // ─── Great Katana (DLC) ───────────────────────────────────────────────────────
  [WeaponType.GREAT_KATANA]: {
    damage: {
      "1h R1 1": "100", "1h R1 2": "100", "1h R1 3": "130",
      "2h R1 1": "105", "2h R1 2": "105", "2h R1 3": "135",
      "2h R2 1": "150",
      "1h L1 1": "75 + 75",
      "Jump 2h": "150", "Running 1h": "125", "Running 2h": "130",
      "Rolling 1h": "100", "Rolling 2h": "130", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 80, "2h R1 1": 80,
      "1h L1 1": 80 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Beast Claw (DLC) ────────────────────────────────────────────────────────
  [WeaponType.BEAST_CLAW]: {
    damage: {
      "1h R1 1": "55", "1h R1 2": "55 + 55", "1h R1 3": "55 + 55 + 75",
      "2h R1 1": "60", "2h R1 2": "60 + 60", "2h R1 3": "60 + 60 + 80",
      "2h R2 1": "85",
      "1h L1 1": "40 + 40 + 40 + 40",
      "Jump 2h": "150", "Running 1h": "100", "Running 2h": "110",
      "Rolling 1h": "60", "Rolling 2h": "110", "Guard Counter": "100",
    },
    status: {
      "1h R1 1": 65, "2h R1 1": 65,
      "1h L1 1": 65 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 100,
    },
  },

  // ─── Hand-to-Hand (DLC) ──────────────────────────────────────────────────────
  [WeaponType.HAND_TO_HAND]: {
    damage: {
      "1h R1 1": "55 + 55", "1h R1 2": "55 + 55 + 60",
      "2h R1 1": "60 + 60", "2h R1 2": "60 + 60 + 65",
      "2h R2 1": "75 + 75",
      "1h L1 1": "40 + 40 + 40 + 40",
      "Jump 2h": "75 + 75", "Running 1h": "60 + 60", "Running 2h": "60 + 60",
      "Rolling 1h": "50 + 50", "Rolling 2h": "65 + 65", "Guard Counter": "80 + 80",
    },
    status: {
      "1h R1 1": 65, "2h R1 1": 65,
      "1h L1 1": 65 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Perfume Bottle (DLC) ────────────────────────────────────────────────────
  [WeaponType.PERFUME_BOTTLE]: {
    damage: {
      "1h R1 1": "90", "1h R1 2": "90", "1h R1 3": "115",
      "2h R1 1": "95", "2h R1 2": "95", "2h R1 3": "120",
      "2h R2 1": "135",
      "1h L1 1": "65 + 65",
      "Jump 2h": "150", "Running 1h": "115", "Running 2h": "120",
      "Rolling 1h": "82", "Rolling 2h": "125", "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "1h L1 1": 75 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },

  // ─── Throwing Blade (DLC) ───────────────────────────────────────────────────
  [WeaponType.THROWING_BLADE]: {
    damage: {
      "1h R1 1": "65", "1h R1 2": "65 + 65", "1h R1 3": "65 + 65 + 85",
      "2h R1 1": "65", "2h R1 2": "65 + 65", "2h R1 3": "65 + 65 + 85",
      "2h R2 1": "100",
      "1h L1 1": "45 + 45 + 45 + 45",
      "Jump 2h": "150", "Running 1h": "100", "Running 2h": "105",
      "Rolling 1h": "65", "Rolling 2h": "110", "Guard Counter": "100",
    },
    status: {
      "1h R1 1": 70, "2h R1 1": 70,
      "1h L1 1": 70 * PS,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 100,
    },
  },

  // ─── Thrusting Shield (DLC) ──────────────────────────────────────────────────
  [WeaponType.THRUSTING_SHIELD]: {
    damage: {
      "1h R1 1": "85", "1h R1 2": "85", "1h R1 3": "105",
      "2h R1 1": "90", "2h R1 2": "90", "2h R1 3": "110",
      "2h R2 1": "125",
      "Jump 2h": "150", "Running 1h": "115", "Rolling 1h": "82",
      "Guard Counter": "120",
    },
    status: {
      "1h R1 1": 75, "2h R1 1": 75,
      "Jump 2h": 110, "Running 1h": 100, "Rolling 1h": 90, "Guard Counter": 120,
    },
  },
};

export function getMotionValueTable(
  weaponType: WeaponType,
): MotionValueTable {
  return (
    motionValueTables[weaponType] ?? {
      damage: { "1h R1 1": defaultDamageMotionValue },
      status: { "1h R1 1": defaultStatusMotionValue },
    }
  );
}
