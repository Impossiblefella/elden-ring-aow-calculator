/**
 * enemy.ts — enemy data definitions for the damage simulator.
 *
 * Enemy stats come from `NpcParam` and `CalcCorrectGraph` for enemy bodies.
 * For the in-game "red glowing" enemies the ` defence / absorption` fields map
 * to the in-game damage negation tab. Bosses additionally expose NG cycle
 * multipliers.
 */

import { AttackPowerType } from "../types";
import type { AbsorptionKey } from "./defense";

export interface Enemy {
  id: string;
  name: string;
  /** Per-damage-type flat defence (the attack-ratio input). */
  defence: Partial<Record<AttackPowerType, number>>;
  /** Absorption percentages for each label shown in the UI. */
  absorption: Partial<Record<AttackPowerType, number>>;
  /** Status effect resistances: threshold to proc. */
  statusResistances?: Partial<Record<AttackPowerType, number>>;
  /** Enemy HP at NG base. */
  hp?: number;
  /** Boss multiplier by NG cycle (0=NG,0.5=NG+1,...). */
  ngHpMultiplier?: Record<number, number>;
  /** Tags: "Void" | "LivingInDeath" | "AncientDraconic" | "Draconic". */
  enemyTypes?: string[];
}

export const enemyDatabase: Enemy[] = [
  {
    id: "malenia",
    name: "Malenia, Blade of Miquella",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 865,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 1087,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 25,
      [AttackPowerType.LIGHTNING]: 25,
      [AttackPowerType.HOLY]: 40,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 720,
      [AttackPowerType.FROST]: 300,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 33251,
    enemyTypes: ["Void"],
  },
  {
    id: "godfrey-hoarah-lou",
    name: "Godfrey, First Elden Lord",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 1087,
      [AttackPowerType.FIRE]: 865,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 807,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 10,
      [AttackPowerType.MAGIC]: 30,
      [AttackPowerType.FIRE]: 30,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 600,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 37395,
  },
  {
    id: "mohg-lord-of-blood",
    name: "Mohg, Lord of Blood",
    defence: {
      [AttackPowerType.PHYSICAL]: 1181,
      [AttackPowerType.MAGIC]: 1082,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 1087,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 30,
      [AttackPowerType.MAGIC]: 30,
      [AttackPowerType.FIRE]: 20,
      [AttackPowerType.LIGHTNING]: 20,
      [AttackPowerType.HOLY]: 0,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 9999,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 41824,
  },
  {
    id: "fire-giant",
    name: "Fire Giant",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 924,
      [AttackPowerType.FIRE]: 1087,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 1087,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 80,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 600,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 41804,
    enemyTypes: ["AncientDraconic"],
  },

  // ─── Final boss duo (Radagon + Elden Beast) ───────────────────────────────
  {
    id: "radagon",
    name: "Radagon of the Golden Order",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 1087,
      [AttackPowerType.FIRE]: 865,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 807,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 30,
      [AttackPowerType.FIRE]: 30,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 40,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 600,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 26000,
    enemyTypes: ["Void", "Demigod"],
  },
  {
    id: "elden-beast",
    name: "Elden Beast",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 1087,
      [AttackPowerType.FIRE]: 865,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 807,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 30,
      [AttackPowerType.FIRE]: 30,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 40,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 9999,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 2000,
      [AttackPowerType.SCARLET_ROT]: 2000,
    },
    hp: 28000,
    enemyTypes: ["Void", "OuterGod"],
  },

  // ─── Shadow of the Erdtree DLC bosses ────────────────────────────────────
  {
    id: "bayle-the-dread",
    name: "Bayle the Dread",
    defence: {
      [AttackPowerType.PHYSICAL]: 1273,
      [AttackPowerType.MAGIC]: 1088,
      [AttackPowerType.FIRE]: 1168,
      [AttackPowerType.LIGHTNING]: 904,
      [AttackPowerType.HOLY]: 1088,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 40,
      [AttackPowerType.LIGHTNING]: 10,
      [AttackPowerType.HOLY]: 20,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 760,
      [AttackPowerType.FROST]: 570,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 60000,
    enemyTypes: ["Draconic"],
  },
  {
    id: "messmer-the-impaler",
    name: "Messmer the Impaler",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 920,
      [AttackPowerType.FIRE]: 1087,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 865,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 10,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 40,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 20,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 700,
      [AttackPowerType.FROST]: 480,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 42500,
    enemyTypes: ["Demigod"],
  },
  {
    id: "consort-radahn",
    name: "Promised Consort Radahn",
    defence: {
      [AttackPowerType.PHYSICAL]: 1366,
      [AttackPowerType.MAGIC]: 1087,
      [AttackPowerType.FIRE]: 1004,
      [AttackPowerType.LIGHTNING]: 865,
      [AttackPowerType.HOLY]: 1004,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 20,
      [AttackPowerType.LIGHTNING]: 20,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 900,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 2000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 58000,
    enemyTypes: ["Demigod", "Void"],
  },

  // ─── Base game major bosses ──────────────────────────────────────────────
  {
    id: "radahn-festival",
    name: "Radahn, Scourge of the Stars",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 1087,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 865,
      [AttackPowerType.HOLY]: 924,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 40,
      [AttackPowerType.LIGHTNING]: 10,
      [AttackPowerType.HOLY]: 20,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 600,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 36000,
    enemyTypes: ["Demigod"],
  },
  {
    id: "placidusax",
    name: "Dragonlord Placidusax",
    defence: {
      [AttackPowerType.PHYSICAL]: 1273,
      [AttackPowerType.MAGIC]: 1168,
      [AttackPowerType.FIRE]: 1273,
      [AttackPowerType.LIGHTNING]: 1004,
      [AttackPowerType.HOLY]: 1088,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 40,
      [AttackPowerType.LIGHTNING]: 10,
      [AttackPowerType.HOLY]: 20,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 760,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 42000,
    enemyTypes: ["AncientDraconic"],
  },
  {
    id: "morgott",
    name: "Morgott, the Omen King",
    defence: {
      [AttackPowerType.PHYSICAL]: 1200,
      [AttackPowerType.MAGIC]: 1004,
      [AttackPowerType.FIRE]: 865,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 924,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 10,
      [AttackPowerType.MAGIC]: 30,
      [AttackPowerType.FIRE]: 30,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 1000,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 12100,
    enemyTypes: ["Demigod"],
  },
  {
    id: "margit",
    name: "Margit, the Fell Omen",
    defence: {
      [AttackPowerType.PHYSICAL]: 1100,
      [AttackPowerType.MAGIC]: 924,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 865,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 10,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 30,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 540,
      [AttackPowerType.FROST]: 480,
      [AttackPowerType.POISON]: 900,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 4100,
    enemyTypes: ["Demigod"],
  },
  {
    id: "godskin-duo",
    name: "Godskin Duo",
    defence: {
      [AttackPowerType.PHYSICAL]: 1130,
      [AttackPowerType.MAGIC]: 924,
      [AttackPowerType.FIRE]: 865,
      [AttackPowerType.LIGHTNING]: 865,
      [AttackPowerType.HOLY]: 865,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 40,
      [AttackPowerType.LIGHTNING]: 20,
      [AttackPowerType.HOLY]: 20,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 420,
      [AttackPowerType.FROST]: 300,
      [AttackPowerType.POISON]: 900,
      [AttackPowerType.SCARLET_ROT]: 1200,
    },
    hp: 22771,
    enemyTypes: ["Demigod"],
  },
  {
    id: "astel-naturalborn",
    name: "Astel, Naturalborn of the Void",
    defence: {
      [AttackPowerType.PHYSICAL]: 1170,
      [AttackPowerType.MAGIC]: 1087,
      [AttackPowerType.FIRE]: 924,
      [AttackPowerType.LIGHTNING]: 865,
      [AttackPowerType.HOLY]: 1087,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 20,
      [AttackPowerType.LIGHTNING]: 20,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 600,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 19800,
    enemyTypes: ["Void", "Alien"],
  },
  {
    id: "loretta-haligtree",
    name: "Loretta, Knight of the Haligtree",
    defence: {
      [AttackPowerType.PHYSICAL]: 1100,
      [AttackPowerType.MAGIC]: 1087,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 924,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 10,
      [AttackPowerType.MAGIC]: 30,
      [AttackPowerType.FIRE]: 20,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 600,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 12100,
    enemyTypes: ["Knight"],
  },
  {
    id: "crucible-knight",
    name: "Crucible Knight",
    defence: {
      [AttackPowerType.PHYSICAL]: 1100,
      [AttackPowerType.MAGIC]: 865,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 865,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 30,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 20,
      [AttackPowerType.LIGHTNING]: 20,
      [AttackPowerType.HOLY]: 20,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 300,
      [AttackPowerType.FROST]: 300,
      [AttackPowerType.POISON]: 900,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 4500,
    enemyTypes: ["Knight"],
  },
  {
    id: "tree-sentinel",
    name: "Tree Sentinel",
    defence: {
      [AttackPowerType.PHYSICAL]: 1100,
      [AttackPowerType.MAGIC]: 865,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 807,
      [AttackPowerType.HOLY]: 807,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 20,
      [AttackPowerType.MAGIC]: 20,
      [AttackPowerType.FIRE]: 20,
      [AttackPowerType.LIGHTNING]: 0,
      [AttackPowerType.HOLY]: 20,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 480,
      [AttackPowerType.FROST]: 600,
      [AttackPowerType.POISON]: 1000,
      [AttackPowerType.SCARLET_ROT]: 1500,
    },
    hp: 4700,
    enemyTypes: ["Knight"],
  },
  {
    id: "rennala",
    name: "Rennala, Queen of the Full Moon",
    defence: {
      [AttackPowerType.PHYSICAL]: 1000,
      [AttackPowerType.MAGIC]: 1200,
      [AttackPowerType.FIRE]: 807,
      [AttackPowerType.LIGHTNING]: 765,
      [AttackPowerType.HOLY]: 865,
    },
    absorption: {
      [AttackPowerType.PHYSICAL]: 10,
      [AttackPowerType.MAGIC]: 30,
      [AttackPowerType.FIRE]: 30,
      [AttackPowerType.LIGHTNING]: 30,
      [AttackPowerType.HOLY]: 30,
    },
    statusResistances: {
      [AttackPowerType.BLEED]: 300,
      [AttackPowerType.FROST]: 300,
      [AttackPowerType.POISON]: 900,
      [AttackPowerType.SCARLET_ROT]: 1200,
    },
    hp: 8400,
    enemyTypes: ["Demigod"],
  },
];
