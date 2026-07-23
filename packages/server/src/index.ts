/**
 * index.ts — Express API entry point.
 *
 * Exposes a small JSON REST surface the React app consumes:
 *  - GET /api/regulation              — the regulation DB snapshot
 *  - GET /api/weapons                 — all decoded weapons
 *  - GET /api/enemies                 — enemy database
 *  - POST /api/attack-rating          — compute AR for one weapon
 *  - POST /api/damage                 — compute damage against an enemy
 *  - POST /api/rank                   — rank compatible weapons for an AOW scenario
 */

import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import fs from "fs";

import {
  AffinityId,
  AttackPowerType,
  Attribute,
  getWeaponAttack,
  getTotalAttackRating,
  adjustAttributesForTwoHanding,
  decodeAll,
  type Weapon,
  type RegulationDatabase,
  type AttackRatingResult,
  type CharacterStats,
  enemyDatabase,
  type Enemy,
  type AshOfWarEntry,
  type RankingMetric,
  type Buff,
  type BuffCategory,
  BUFF_LIBRARY,
  applyBuffs,
  rankWeapons,
  calculateBulletHitDamage,
  calculateSkillHitDamage,
  calculateEnhancedHitDamage,
  damageAgainstEnemy,
  attackPowerTypeName,
  affinityName,
  weaponTypeName,
  type WeaponType,
  allDamageTypes,
  allStatusTypes,
} from "@er/shared";

import { getFallbackRegulation } from './data/fallback-regulation';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5MB" }));
app.use(morgan("dev"));

// ── state ────────────────────────────────────────────────────────────────────
let regulation: RegulationDatabase = getFallbackRegulation();
let decodedWeapons: Weapon[] = [];

function refreshDecoded() {
  regulation = { ...getFallbackRegulation() };
  decodedWeapons = decodeAll(regulation);
}
refreshDecoded();

// ── helpers ───────────────────────────────────────────────────────────────────
function loadBody<T>(body: unknown, field: string, required = true): unknown {
  if (typeof body !== "object" || body === null) {
    throw new ApiError(400, `Invalid request body`);
  }
  const value = (body as Record<string, unknown>)[field];
  if (required && (value === undefined || value === null)) {
    throw new ApiError(400, `Missing field '${field}'`);
  }
  return value;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

function findWeaponById(id: number): Weapon {
  const w = decodedWeapons.find((w) => w.id === id);
  if (!w) throw new ApiError(404, `Unknown weapon id=${id}`);
  return w;
}

// ── routes ───────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, weapons: decodedWeapons.length });
});

app.get("/api/regulation", (_req, res) => {
  res.json({
    generatedAt: regulation.generatedAt,
    patchId: regulation.patchId,
    weaponCount: decodedWeapons.length,
    calcCorrectGraphs: Object.keys(regulation.calcCorrectGraphs).length,
    reinforceTypes: Object.keys(regulation.reinforceTypes).length,
  });
});

app.get("/api/weapons", (_req, res) => {
  res.json(
    decodedWeapons.map((w) => ({
      id: w.id,
      name: w.name,
      weaponType: w.weaponType,
      weaponTypeName: weaponTypeName[w.weaponType as WeaponType],
      affinityId: w.affinityId,
      affinityName: affinityName[w.affinityId as AffinityId],
      requirements: w.requirements,
      paired: w.paired,
      dlc: w.dlc,
      isSpecialWeapon: w.isSpecialWeapon,
    })),
  );
});

app.get("/api/weapons/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const w = findWeaponById(id);
  const r0 = getWeaponAttack({
    weapon: w,
    attributes: makeEmptyStats(),
    upgradeLevel: 0,
  });
  res.json({
    id: w.id,
    name: w.name,
    weaponType: w.weaponType,
    weaponTypeName: weaponTypeName[w.weaponType as WeaponType],
    affinityId: w.affinityId,
    affinityName: affinityName[w.affinityId as AffinityId],
    requirements: w.requirements,
    isSpecialWeapon: w.isSpecialWeapon,
    maxUpgrade: w.attack.length - 1,
    baseAttack: w.attack[0],
    baseScaling: w.attributeScaling[0],
  });
});

app.get("/api/enemies", (_req, res) => {
  res.json(enemyDatabase);
});

app.get("/api/buffs", (_req, res) => {
  res.json(BUFF_LIBRARY.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    allDamageMultiplier: b.allDamageMultiplier,
    multipliers: b.multipliers,
    applicableTypes: b.applicableTypes,
    aowMultiplier: b.aowMultiplier,
  })));
});

interface AttackRatingRequestBody {
  weaponId: number;
  attributes: CharacterStats;
  upgradeLevel: number;
  twoHanding?: boolean;
}

app.post("/api/attack-rating", (req, res) => {
  const weaponId = parseInt(String(loadBody(req.body, "weaponId")), 10);
  const attributes = loadBody(req.body, "attributes") as CharacterStats;
  const upgradeLevel = parseInt(String(loadBody(req.body, "upgradeLevel")), 10);
  const twoHanding = Boolean(loadBody(req.body, "twoHanding", false));
  const weapon = findWeaponById(weaponId);
  const result = getWeaponAttack({
    weapon,
    attributes,
    upgradeLevel: clampUpgrade(weapon, upgradeLevel),
    twoHanding,
  });
  res.json(serializeAttackRatingResult(result));
});

// ── Compare ALL weapons — returns AR table for every weapon at the given build ─
// This is what powers the comparison table (like tarnished.dev's weapon calculator).
// ── Server-side cache for /api/compare ────────────────────────────────────────
interface CompareCacheEntry { rows: unknown[]; timestamp: number; }
const compareCache = new Map<string, CompareCacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCompareCacheKey(attrs: unknown, upgrade: number, twoH: boolean, buffs: string[], wType: number | null, aff: number | null, special: boolean): string {
  return JSON.stringify({ attrs, upgrade, twoH, buffs: [...buffs].sort(), wType, aff, special });
}

// Clean old cache entries occasionally
let lastCacheClean = 0;
function maybeCleanCache() {
  const now = Date.now();
  if (now - lastCacheClean > 60_000) {
    lastCacheClean = now;
    for (const [key, entry] of compareCache) {
      if (now - entry.timestamp > CACHE_TTL) compareCache.delete(key);
    }
  }
}

app.post("/api/compare", (req, res) => {
  const attributes = loadBody(req.body, "attributes") as CharacterStats;
  const upgradeLevel = parseInt(String(loadBody(req.body, "upgradeLevel", false) ?? "25"), 10);
  const twoHanding = Boolean(loadBody(req.body, "twoHanding", false) ?? false);
  const buffIds = (loadBody(req.body, "buffIds", false) as string[] | null) ?? [];
  const weaponTypeFilter = loadBody(req.body, "weaponType", false) as number | null;
  const affinityFilter = loadBody(req.body, "affinity", false) as number | null;
  const includeSpecial = Boolean(loadBody(req.body, "includeSpecial", false) ?? true);
  const includeDLC = Boolean(loadBody(req.body, "includeDLC", false) ?? true);

  // Check cache
  maybeCleanCache();
  const cacheKey = getCompareCacheKey(attributes, upgradeLevel, twoHanding, buffIds, weaponTypeFilter ?? null, affinityFilter ?? null, includeSpecial) + (includeDLC ? '|dlc' : '|nfdlc');
  const cached = compareCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json({ count: cached.rows.length, rows: cached.rows });
    return;
  }

  const activeBuffs = buffIds
    .map((id) => BUFF_LIBRARY.find((b) => b.id === id))
    .filter((b): b is Buff => Boolean(b));

  const rows = [];
  for (let i = 0; i < decodedWeapons.length; i++) {
    const weapon = decodedWeapons[i];
    if (!weapon) continue;
    if (weaponTypeFilter !== undefined && weaponTypeFilter !== null && weapon.weaponType !== weaponTypeFilter) continue;
    if (affinityFilter !== undefined && affinityFilter !== null && weapon.affinityId !== affinityFilter) continue;
    if (!includeSpecial && (weapon.affinityId as number) === -1) continue;
    if (!includeDLC && weapon.dlc) continue;

    let result;
    try {
      result = getWeaponAttack({
        weapon,
        attributes,
        upgradeLevel: clampUpgrade(weapon, upgradeLevel),
        twoHanding,
      });
    } catch (err) {
      console.error('AR calc failed for weapon', i, weapon.name, ':', (err as Error).message);
      continue;
    }

    // Apply buffs to attack ratings if any
    let attackPower = result.attackPower;
    if (buffIds.length > 0) {
      const buffed = applyBuffs(result, buffIds);
      // Merge buffed flat values into the attack power map for display.
      attackPower = { ...result.attackPower };
      for (const apt of allDamageTypes) {
        const buffedVal = buffed.attackPower[apt];
        if (buffedVal !== undefined && attackPower[apt]) {
          attackPower[apt] = { ...attackPower[apt]!, total: buffedVal };
        }
      }
    }

    const phys = attackPower[AttackPowerType.PHYSICAL]?.total ?? 0;
    const mag = attackPower[AttackPowerType.MAGIC]?.total ?? 0;
    const fire = attackPower[AttackPowerType.FIRE]?.total ?? 0;
    const ligh = attackPower[AttackPowerType.LIGHTNING]?.total ?? 0;
    const holy = attackPower[AttackPowerType.HOLY]?.total ?? 0;
    const total = phys + mag + fire + ligh + holy;

    // Pull the current scaling ratios from the upgrade level's row
    const scalingIdx = Math.min(upgradeLevel, weapon.attributeScaling.length - 1);
    const scalingRow = weapon.attributeScaling[scalingIdx] ?? {};

    rows.push({
      id: i,
      name: weapon.name,
      weaponType: weapon.weaponType,
      weaponTypeName: weaponTypeName[weapon.weaponType as WeaponType] ?? "Unknown",
      affinityId: weapon.affinityId,
      affinityName: affinityName[weapon.affinityId as AffinityId] ?? "Unique",
      ar: {
        phys: round(phys),
        mag: round(mag),
        fire: round(fire),
        ligh: round(ligh),
        holy: round(holy),
        total: round(total),
      },
      // Per-type base + scaled breakdown for damage tooltip
      arParts: {
        phys: { base: attackPower[AttackPowerType.PHYSICAL]?.weapon ?? 0, scaled: attackPower[AttackPowerType.PHYSICAL]?.scaled ?? 0 },
        mag: { base: attackPower[AttackPowerType.MAGIC]?.weapon ?? 0, scaled: attackPower[AttackPowerType.MAGIC]?.scaled ?? 0 },
        fire: { base: attackPower[AttackPowerType.FIRE]?.weapon ?? 0, scaled: attackPower[AttackPowerType.FIRE]?.scaled ?? 0 },
        ligh: { base: attackPower[AttackPowerType.LIGHTNING]?.weapon ?? 0, scaled: attackPower[AttackPowerType.LIGHTNING]?.scaled ?? 0 },
        holy: { base: attackPower[AttackPowerType.HOLY]?.weapon ?? 0, scaled: attackPower[AttackPowerType.HOLY]?.scaled ?? 0 },
      },
      scaling: {
        str: scalingRow[Attribute.STRENGTH] ?? 0,
        dex: scalingRow[Attribute.DEXTERITY] ?? 0,
        int: scalingRow[Attribute.INTELLIGENCE] ?? 0,
        fai: scalingRow[Attribute.FAITH] ?? 0,
        arc: scalingRow[Attribute.ARCANE] ?? 0,
      },
      requirements: weapon.requirements ?? {},
      ineffectiveAttributes: result.ineffectiveAttributes ?? [],
      isSpecialWeapon: (weapon.affinityId as number) === -1,
      dlc: Boolean(weapon.dlc),
      paired: Boolean(weapon.paired),
      // Status AR for effect filters (bleed, frost, poison, scarlet rot)
      statusAr: {
        bleed: attackPower[AttackPowerType.BLEED]?.total ?? 0,
        frost: attackPower[AttackPowerType.FROST]?.total ?? 0,
        poison: attackPower[AttackPowerType.POISON]?.total ?? 0,
        scarletRot: attackPower[AttackPowerType.SCARLET_ROT]?.total ?? 0,
      },
    });
  }

  // Sort by total AR descending by default
  rows.sort((a, b) => b.ar.total - a.ar.total);
  // Store in cache
  compareCache.set(cacheKey, { rows, timestamp: Date.now() });
  res.json({ count: rows.length, rows });
});


interface DamageRequestBody extends AttackRatingRequestBody {
  enemyId?: string;
  buffIds?: string[];
  ngCycle?: number;      // 0=NG, 1=NG+1, ..., 7=NG+7
  powerStance?: boolean;  // dual-wield: doubles AR for paired weapons
  critModifier?: number;  // 1.0 (normal), 1.6 (backstab), 4.0 (riposte)
  charged?: boolean;      // charged AoW motion values
}

app.post("/api/damage", (req, res) => {
  const weaponId = parseInt(String(loadBody(req.body, "weaponId")), 10);
  const attributes = loadBody(req.body, "attributes") as CharacterStats;
  const upgradeLevel = parseInt(String(loadBody(req.body, "upgradeLevel")), 10);
  const twoHanding = Boolean(loadBody(req.body, "twoHanding", false));
  const enemyId = String(loadBody(req.body, "enemyId", false) ?? "malenia");
  const buffIds = (loadBody(req.body, "buffIds", false) as string[]) ?? [];
  const ngCycle = Number(loadBody(req.body, "ngCycle", false) ?? 0);
  const powerStance = Boolean(loadBody(req.body, "powerStance", false) ?? false);
  const critModifier = Number(loadBody(req.body, "critModifier", false) ?? 1.0);
  const charged = Boolean(loadBody(req.body, "charged", false) ?? false);
  const enemy = enemyDatabase.find((e) => e.id === enemyId);
  if (!enemy) throw new ApiError(404, `Unknown enemy '${enemyId}'`);

  const weapon = findWeaponById(weaponId);
  let result = getWeaponAttack({
    weapon,
    attributes,
    upgradeLevel: clampUpgrade(weapon, upgradeLevel),
    twoHanding,
  });

  // Power stance: double the AR for paired weapons (same weapon type in both hands)
  if (powerStance) {
    const newAttackPower = { ...result.attackPower };
    for (const apt of allDamageTypes) {
      if (result.attackPower[apt]) {
        newAttackPower[apt] = {
          ...result.attackPower[apt]!,
          total: result.attackPower[apt]!.total * 2,
          weapon: result.attackPower[apt]!.weapon * 2,
          scaled: result.attackPower[apt]!.scaled * 2,
        };
      }
    }
    result = { ...result, attackPower: newAttackPower };
  }

  // Apply buffs
  let activeBuffs: Buff[] = [];
  if (buffIds.length > 0) {
    const buffed = applyBuffs(result, buffIds);
    activeBuffs = buffed.activeBuffs;
    const newAttackPower = { ...result.attackPower };
    for (const apt of allDamageTypes) {
      const buffedVal = buffed.attackPower[apt];
      if (buffedVal !== undefined && result.attackPower[apt]) {
        newAttackPower[apt] = {
          ...result.attackPower[apt]!,
          total: buffedVal,
          scaled: buffedVal - result.attackPower[apt]!.weapon,
        };
      }
    }
    result = { ...result, attackPower: newAttackPower };
  }

  // NG+ HP multiplier — scales enemy HP (display only, doesn't affect damage calc)
  // NG+ multipliers from game data: NG=1.0, NG+1=1.1, NG+2=1.2, ..., NG+7=1.9
  const ngHpMult = 1 + ngCycle * 0.1;
  const enemyHp = enemy.hp ? Math.round(enemy.hp * ngHpMult) : undefined;

  // NG+ defense multiplier — scales enemy defence flat values.
  // Defences scale by a small amount per NG+ cycle (≈1% per cycle → NG+7 = +7%),
  // increasing the reduction of the non-linear defense curve at higher cycles.
  // Absorption is a percentage and does NOT scale with NG+.
  const ngDefMult = 1 + ngCycle * 0.01;

  // Apply enemy defence + absorption per damage type
  const enemyDamages: Record<AttackPowerType, number> = {} as Record<AttackPowerType, number>;
  for (const apt of allDamageTypes) {
    let ar = result.attackPower[apt]?.total ?? 0;
    if (!ar) continue;
    // Apply crit modifier to damage
    ar = ar * critModifier;
    // Scale flat defence by the NG+ defence multiplier; absorption stays as-is
    const def = (enemy.defence[apt] ?? 0) * ngDefMult;
    const abs = enemy.absorption[apt] ?? 0;
    enemyDamages[apt] = round(
      damageAgainstEnemy({
        attackRating: ar,
        damageType: apt,
        enemyDefense: def,
        absorptionPercent: abs,
        motion: charged ? 120 : 100, // charged attacks have higher motion value
      }),
    );
  }

  // Status proc calculation — how many hits to proc each status
  const statusProcs: { type: number; name: string; perHit: number; threshold: number; hitsToProc: number }[] = [];
  for (const apt of allStatusTypes) {
    const statusAR = result.attackPower[apt]?.total ?? 0;
    if (statusAR <= 0) continue;
    const resistance = enemy.statusResistances?.[apt] ?? 1000;
    const hitsToProc = Math.ceil((resistance * 1.1) / statusAR); // buildup decreases per hit
    statusProcs.push({
      type: apt,
      name: attackPowerTypeName[apt],
      perHit: Math.round(statusAR),
      threshold: resistance,
      hitsToProc: hitsToProc > 0 ? hitsToProc : Infinity,
    });
  }

  res.json({
    ...serializeAttackRatingResult(result),
    enemy: { id: enemy.id, name: enemy.name, hp: enemyHp, baseHp: enemy.hp, statusResistances: enemy.statusResistances, ngCycle },
    enemyDamages,
    enemyDamageTotal: round(Object.values(enemyDamages).reduce((a, b) => a + (b ?? 0), 0)),
    activeBuffs: activeBuffs.map((b) => ({ id: b.id, name: b.name, category: b.category })),
    statusProcs,
    powerStance,
    critModifier,
    charged,
  });
});

interface RankRequestBody {
  ashOfWar: AshOfWarEntry;
  attributes: CharacterStats;
  upgradeLevel: number;
  metric?: RankingMetric;
  enemyId?: string;
  twoHanding?: boolean;
}

/**
 * Comprehensive Ash of War catalog.
 *
 * Three categories:
 *  1. Projectile AoWs  — isProjectile=true, baseBulletDamage populated. The
 *     Bullet carries its own flat damage that bypasses weapon AR scaling tied
 *     to the weapon's own damage type, so e.g. Ice Spear's projectile is pure
 *     Magic even though the thrust motion contributes split Physical/Magic.
 *  2. Enhanced hit AoWs — isProjectile=false, baseDamage>0. The skill adds flat
 *     bonus damage of a specific type (e.g. FIRE/HOLY) on top of the weapon's
 *     own motion-value damage. damageMotionValues captures the weapon swing
 *     contribution; baseDamage captures the elemental skill add.
 *  3. Simple skill hit AoWs — isProjectile=false, baseDamage=0. Pure motion-
 *     value skills with no special projectile or bonus damage add. Affinity
 *     is whatever the weapon is currently infused with, hence []
 *     compatibleAffinities for the "all affinities allowed" cases.
 *
 * WeaponType is imported as a type-only binding, so each numeric weapon id is
 * cast through `as WeaponType`. Comments beside each cast call out the enum
 * name for the curious.
 */
const ashOfWarCatalog: AshOfWarEntry[] = [
  // ── Projectile AoWs (isProjectile=true, baseBulletDamage populated) ─────────
  {
    id: 800,
    name: "Ice Spear",
    compatibleWeaponTypes: [
      25 as WeaponType, // SPEAR
      28 as WeaponType, // GREAT_SPEAR
      29 as WeaponType, // HALBERD
      14 as WeaponType, // TWINBLADE
      16 as WeaponType, // HEAVY_THRUSTING_SWORD
    ],
    compatibleAffinities: [AffinityId.COLD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 50,
      [AttackPowerType.MAGIC]: 50,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.MAGIC]: 320,
    },
    poiseDamage: 40,
    isProjectile: true,
  },
  {
    id: 802,
    name: "Loretta's Greatbow",
    compatibleWeaponTypes: [
      53 as WeaponType, // GREATBOW
      51 as WeaponType, // BOW
    ],
    compatibleAffinities: [AffinityId.MAGIC, (-1) as AffinityId],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.MAGIC]: 450,
    },
    poiseDamage: 30,
    isProjectile: true,
  },
  {
    id: 803,
    name: "Phantom Slash",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      9 as WeaponType,  // CURVED_SWORD
      13 as WeaponType, // KATANA
      15 as WeaponType, // THRUSTING_SWORD
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.PHYSICAL]: 250,
    },
    poiseDamage: 25,
    isProjectile: true,
  },
  {
    id: 804,
    name: "Ancient Bolt",
    compatibleWeaponTypes: [
      55 as WeaponType, // CROSSBOW
      56 as WeaponType, // BALLISTA
    ],
    compatibleAffinities: [AffinityId.LIGHTNING, (-1) as AffinityId],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.LIGHTNING]: 300,
    },
    poiseDamage: 30,
    isProjectile: true,
  },
  {
    id: 805,
    name: "Fire Lance",
    compatibleWeaponTypes: [
      55 as WeaponType, // CROSSBOW
    ],
    compatibleAffinities: [AffinityId.FLAME_ART, (-1) as AffinityId],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.FIRE]: 350,
    },
    poiseDamage: 35,
    isProjectile: true,
  },
  {
    id: 806,
    name: "Rosus' Fingerprint",
    compatibleWeaponTypes: [
      16 as WeaponType, // HEAVY_THRUSTING_SWORD
      25 as WeaponType, // SPEAR
    ],
    compatibleAffinities: [AffinityId.SACRED],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.HOLY]: 250,
    },
    poiseDamage: 25,
    isProjectile: true,
  },
  {
    id: 807,
    name: "Vacuum Slice",
    compatibleWeaponTypes: [
      13 as WeaponType, // KATANA
      94 as WeaponType, // GREAT_KATANA
      92 as WeaponType, // BACKHAND_BLADE
      93 as WeaponType, // LIGHT_GREATSWORD
    ],
    compatibleAffinities: [AffinityId.MAGIC],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 70,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.MAGIC]: 200,
    },
    poiseDamage: 30,
    isProjectile: true,
  },

  // ── Enhanced hit AoWs (isProjectile=false, baseDamage>0) ────────────────────
  {
    id: 810,
    name: "Storm Blade",
    compatibleWeaponTypes: [
      3 as WeaponType, // STRAIGHT_SWORD
      5 as WeaponType, // GREATSWORD
      9 as WeaponType, // CURVED_SWORD
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 90,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 811,
    name: "Flame Strike",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      9 as WeaponType,  // CURVED_SWORD
      13 as WeaponType, // KATANA
    ],
    compatibleAffinities: [AffinityId.FIRE],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 120, // applied as FIRE
    baseBulletDamage: {},
    poiseDamage: 40,
    isProjectile: false,
  },
  {
    id: 812,
    name: "Thunderbolt",
    compatibleWeaponTypes: [
      1 as WeaponType,  // DAGGER
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      9 as WeaponType,  // CURVED_SWORD
      15 as WeaponType, // THRUSTING_SWORD
    ],
    compatibleAffinities: [AffinityId.LIGHTNING],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 110, // applied as LIGHTNING
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 813,
    name: "Sacred Blade",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      15 as WeaponType, // THRUSTING_SWORD
      9 as WeaponType,  // CURVED_SWORD
    ],
    compatibleAffinities: [AffinityId.SACRED],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 90,
    },
    baseDamage: 100, // applied as HOLY
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 814,
    name: "Black Flame Tornado",
    compatibleWeaponTypes: [
      14 as WeaponType, // TWINBLADE
      29 as WeaponType, // HALBERD
      28 as WeaponType, // GREAT_SPEAR
    ],
    compatibleAffinities: [AffinityId.FLAME_ART],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 140, // applied as FIRE
    baseBulletDamage: {},
    poiseDamage: 50,
    isProjectile: false,
  },
  {
    id: 815,
    name: "Blood Blade",
    compatibleWeaponTypes: [
      13 as WeaponType, // KATANA
      9 as WeaponType,  // CURVED_SWORD
    ],
    compatibleAffinities: [AffinityId.BLOOD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 60,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 816,
    name: "Sacred Spiral",
    compatibleWeaponTypes: [
      14 as WeaponType, // TWINBLADE
      29 as WeaponType, // HALBERD
    ],
    compatibleAffinities: [AffinityId.SACRED],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 90, // applied as HOLY
    baseBulletDamage: {},
    poiseDamage: 40,
    isProjectile: false,
  },
  {
    id: 817,
    name: "Flame of the Redmanes",
    compatibleWeaponTypes: [
      37 as WeaponType, // CLAW
      35 as WeaponType, // FIST
      1 as WeaponType,  // DAGGER
    ],
    compatibleAffinities: [AffinityId.FIRE],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 150, // applied as FIRE
    baseBulletDamage: {},
    poiseDamage: 60,
    isProjectile: false,
  },
  {
    id: 818,
    name: "Scarlet AoE",
    compatibleWeaponTypes: [
      14 as WeaponType, // TWINBLADE
      28 as WeaponType, // GREAT_SPEAR
    ],
    compatibleAffinities: [AffinityId.OCCULT],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 100,
    baseBulletDamage: {},
    poiseDamage: 40,
    isProjectile: false,
  },

  // ── Simple skill hit AoWs (isProjectile=false, baseDamage=0) ──────────────
  {
    id: 801,
    name: "Spinning Slash",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      9 as WeaponType,  // CURVED_SWORD
      13 as WeaponType, // KATANA
      15 as WeaponType, // THRUSTING_SWORD
      17 as WeaponType, // AXE
      19 as WeaponType, // GREATAXE
      21 as WeaponType, // HAMMER
      25 as WeaponType, // SPEAR
      28 as WeaponType, // GREAT_SPEAR
      29 as WeaponType, // HALBERD
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 820,
    name: "Impaling Thrust",
    compatibleWeaponTypes: [
      15 as WeaponType, // THRUSTING_SWORD
      25 as WeaponType, // SPEAR
      28 as WeaponType, // GREAT_SPEAR
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 120,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 40,
    isProjectile: false,
  },
  {
    id: 821,
    name: "Piercing Fang",
    compatibleWeaponTypes: [
      15 as WeaponType, // THRUSTING_SWORD
      25 as WeaponType, // SPEAR
      28 as WeaponType, // GREAT_SPEAR
      16 as WeaponType, // HEAVY_THRUSTING_SWORD
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 110,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 35,
    isProjectile: false,
  },
  {
    id: 822,
    name: "Sword Dance",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      9 as WeaponType,  // CURVED_SWORD
      93 as WeaponType, // LIGHT_GREATSWORD
      92 as WeaponType, // BACKHAND_BLADE
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 90,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 823,
    name: "Savage Claw",
    compatibleWeaponTypes: [
      37 as WeaponType, // CLAW
      95 as WeaponType, // BEAST_CLAW
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 40,
    isProjectile: false,
  },
  {
    id: 824,
    name: "Lunging Strike",
    compatibleWeaponTypes: [
      3 as WeaponType, // STRAIGHT_SWORD
      5 as WeaponType, // GREATSWORD
      9 as WeaponType, // CURVED_SWORD
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 115,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 825,
    name: "Overhead Stance",
    compatibleWeaponTypes: [
      5 as WeaponType,  // GREATSWORD
      7 as WeaponType,  // COLOSSAL_SWORD
      28 as WeaponType, // GREAT_SPEAR
      29 as WeaponType, // HALBERD
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 120,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 50,
    isProjectile: false,
  },
  {
    id: 826,
    name: "Stamp Upward Cut",
    compatibleWeaponTypes: [
      5 as WeaponType,  // GREATSWORD
      7 as WeaponType,  // COLOSSAL_SWORD
      16 as WeaponType, // HEAVY_THRUSTING_SWORD
      41 as WeaponType, // COLOSSAL_WEAPON
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 130,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 50,
    isProjectile: false,
  },
  {
    id: 827,
    name: "Eochaid's Dancing Blade",
    compatibleWeaponTypes: [
      5 as WeaponType, // GREATSWORD
      7 as WeaponType, // COLOSSAL_SWORD
    ],
    compatibleAffinities: [AffinityId.MAGIC],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 828,
    name: "Spinning Graives",
    compatibleWeaponTypes: [
      14 as WeaponType, // TWINBLADE
      29 as WeaponType, // HALBERD
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 829,
    name: "Glintsword Arc",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      93 as WeaponType, // LIGHT_GREATSWORD
    ],
    compatibleAffinities: [AffinityId.MAGIC],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 85,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 830,
    name: "Quickstep",
    compatibleWeaponTypes: [
      1 as WeaponType,  // DAGGER
      15 as WeaponType, // THRUSTING_SWORD
      37 as WeaponType, // CLAW
      35 as WeaponType, // FIST
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 70,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 10,
    isProjectile: false,
  },
  {
    id: 831,
    name: "Bloodhound's Step",
    compatibleWeaponTypes: [
      1 as WeaponType,  // DAGGER
      37 as WeaponType, // CLAW
      3 as WeaponType,  // STRAIGHT_SWORD
      9 as WeaponType,  // CURVED_SWORD
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 60,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 10,
    isProjectile: false,
  },
  {
    id: 832,
    name: "Vow of the Indomitable",
    compatibleWeaponTypes: [
      3 as WeaponType, // STRAIGHT_SWORD
      5 as WeaponType, // GREATSWORD
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 15,
    isProjectile: false,
  },
  {
    id: 833,
    name: "Determination",
    compatibleWeaponTypes: [
      3 as WeaponType, // STRAIGHT_SWORD
      5 as WeaponType, // GREATSWORD
      9 as WeaponType, // CURVED_SWORD
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 834,
    name: "Golden Vow",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      9 as WeaponType,  // CURVED_SWORD
      29 as WeaponType, // HALBERD
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 835,
    name: "Shield Bash",
    compatibleWeaponTypes: [
      65 as WeaponType, // SMALL_SHIELD
      67 as WeaponType, // MEDIUM_SHIELD
      69 as WeaponType, // GREATSHIELD
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 40,
    isProjectile: false,
  },
  {
    id: 836,
    name: "Parry",
    compatibleWeaponTypes: [
      65 as WeaponType, // SMALL_SHIELD
      67 as WeaponType, // MEDIUM_SHIELD
      69 as WeaponType, // GREATSHIELD
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {},
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 0,
    isProjectile: false,
  },
  {
    id: 837,
    name: "Endure",
    compatibleWeaponTypes: [
      17 as WeaponType, // AXE
      21 as WeaponType, // HAMMER
      19 as WeaponType, // GREATAXE
      23 as WeaponType, // GREAT_HAMMER
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 838,
    name: "Ground Slam",
    compatibleWeaponTypes: [
      5 as WeaponType,  // GREATSWORD
      7 as WeaponType,  // COLOSSAL_SWORD
      41 as WeaponType, // COLOSSAL_WEAPON
      21 as WeaponType, // HAMMER
      23 as WeaponType, // GREAT_HAMMER
    ],
    compatibleAffinities: [],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 130,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 50,
    isProjectile: false,
  },
  {
    id: 839,
    name: "Shared Order",
    compatibleWeaponTypes: [
      3 as WeaponType, // STRAIGHT_SWORD
      5 as WeaponType, // GREATSWORD
      9 as WeaponType, // CURVED_SWORD
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 840,
    name: "Holy Form",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      15 as WeaponType, // THRUSTING_SWORD
    ],
    compatibleAffinities: [AffinityId.SACRED],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 0,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  // ── DLC AoWs (Shadow of the Erdtree) ──────────────────────────────────────────
  {
    id: 900,
    name: "Divine Beast Tackle",
    compatibleWeaponTypes: [
      92 as WeaponType, // BACKHAND_BLADE
    ],
    compatibleAffinities: [AffinityId.STANDARD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 120,
    baseBulletDamage: {},
    poiseDamage: 42,
    isProjectile: false,
  },
  {
    id: 901,
    name: "Spinning Wheel",
    compatibleWeaponTypes: [
      92 as WeaponType, // BACKHAND_BLADE
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.QUALITY],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 70,
    },
    baseDamage: 80,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 902,
    name: "Savage Lion's Claw",
    compatibleWeaponTypes: [
      5 as WeaponType,  // GREATSWORD
      7 as WeaponType,  // COLOSSAL_SWORD
      11 as WeaponType, // CURVED_GREATSWORD
      19 as WeaponType, // GREATAXE
      23 as WeaponType, // GREAT_HAMMER
      29 as WeaponType, // HALBERD
      41 as WeaponType, // COLOSSAL_WEAPON
      93 as WeaponType, // LIGHT_GREATSWORD
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.HEAVY, AffinityId.QUALITY],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 75,
    },
    baseDamage: 150,
    baseBulletDamage: {},
    poiseDamage: 45,
    isProjectile: false,
  },
  {
    id: 903,
    name: "Eochaid's Dancing Blade",
    compatibleWeaponTypes: [
      3 as WeaponType,  // STRAIGHT_SWORD
      5 as WeaponType,  // GREATSWORD
      9 as WeaponType,  // CURVED_SWORD
      13 as WeaponType, // KATANA
      15 as WeaponType, // THRUSTING_SWORD
      93 as WeaponType, // LIGHT_GREATSWORD
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.QUALITY],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 65,
    },
    baseDamage: 100,
    baseBulletDamage: {},
    poiseDamage: 25,
    isProjectile: false,
  },
  {
    id: 904,
    name: "Dryleaf Whirlwind",
    compatibleWeaponTypes: [
      88 as WeaponType, // HAND_TO_HAND
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.QUALITY],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 60,
    },
    baseDamage: 90,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 905,
    name: "Beast's Claw",
    compatibleWeaponTypes: [
      95 as WeaponType, // BEAST_CLAW
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.HEAVY, AffinityId.QUALITY],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 70,
    },
    baseDamage: 110,
    baseBulletDamage: {},
    poiseDamage: 28,
    isProjectile: false,
  },
  {
    id: 906,
    name: "Flashing Strike",
    compatibleWeaponTypes: [
      88 as WeaponType, // HAND_TO_HAND
      37 as WeaponType, // CLAW
      95 as WeaponType, // BEAST_CLAW
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.QUALITY, AffinityId.LIGHTNING],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 65,
    },
    baseDamage: 80,
    baseBulletDamage: {},
    poiseDamage: 22,
    isProjectile: false,
  },
  {
    id: 907,
    name: "Soul Stutter",
    compatibleWeaponTypes: [
      57 as WeaponType, // GLINTSTONE_STAFF
    ],
    compatibleAffinities: [AffinityId.MAGIC],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.MAGIC]: 280,
    },
    poiseDamage: 20,
    isProjectile: true,
  },
  {
    id: 908,
    name: "Rosy Sweep",
    compatibleWeaponTypes: [
      89 as WeaponType, // PERFUME_BOTTLE
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.QUALITY, AffinityId.BLOOD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 75,
    },
    baseDamage: 90,
    baseBulletDamage: {},
    poiseDamage: 24,
    isProjectile: false,
  },
  {
    id: 909,
    name: "Deflect Hardtear",
    compatibleWeaponTypes: [
      90 as WeaponType, // THRUSTING_SHIELD
    ],
    compatibleAffinities: [AffinityId.STANDARD, (-1) as AffinityId],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 85,
    },
    baseDamage: 130,
    baseBulletDamage: {},
    poiseDamage: 40,
    isProjectile: false,
  },
  {
    id: 910,
    name: "Blind Spot",
    compatibleWeaponTypes: [
      91 as WeaponType, // THROWING_BLADE
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.QUALITY, AffinityId.LIGHTNING],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.PHYSICAL]: 220,
    },
    poiseDamage: 15,
    isProjectile: true,
  },
  {
    id: 911,
    name: "Favicon Step",
    compatibleWeaponTypes: [
      91 as WeaponType, // THROWING_BLADE
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.LIGHTNING],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 60,
    baseBulletDamage: {
      [AttackPowerType.LIGHTNING]: 150,
    },
    poiseDamage: 18,
    isProjectile: true,
  },
  {
    id: 912,
    name: "Wave of Darkness",
    compatibleWeaponTypes: [
      94 as WeaponType, // GREAT_KATANA
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.MAGIC, AffinityId.QUALITY],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.MAGIC]: 300,
    },
    poiseDamage: 26,
    isProjectile: true,
  },
  {
    id: 913,
    name: "Iris of Grace",
    compatibleWeaponTypes: [
      93 as WeaponType, // LIGHT_GREATSWORD
    ],
    compatibleAffinities: [AffinityId.SACRED],
    damageMotionValues: {
      [AttackPowerType.HOLY]: 80,
    },
    baseDamage: 140,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 914,
    name: "Moonlith Light",
    compatibleWeaponTypes: [
      93 as WeaponType, // LIGHT_GREATSWORD
    ],
    compatibleAffinities: [AffinityId.MAGIC],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.MAGIC]: 400,
    },
    poiseDamage: 28,
    isProjectile: true,
  },
  {
    id: 915,
    name: "Light Form",
    compatibleWeaponTypes: [
      93 as WeaponType, // LIGHT_GREATSWORD
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.SACRED],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 80,
    },
    baseDamage: 50,
    baseBulletDamage: {},
    poiseDamage: 20,
    isProjectile: false,
  },
  {
    id: 916,
    name: "Sun Queen Lightning",
    compatibleWeaponTypes: [
      25 as WeaponType, // SPEAR
      28 as WeaponType, // GREAT_SPEAR
      29 as WeaponType, // HALBERD
    ],
    compatibleAffinities: [AffinityId.LIGHTNING],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.LIGHTNING]: 320,
    },
    poiseDamage: 25,
    isProjectile: true,
  },
  {
    id: 917,
    name: "Dai-Ryu Cloud",
    compatibleWeaponTypes: [
      94 as WeaponType, // GREAT_KATANA
      13 as WeaponType, // KATANA
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.FIRE, AffinityId.BLOOD],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 85,
      [AttackPowerType.FIRE]: 30,
    },
    baseDamage: 120,
    baseBulletDamage: {},
    poiseDamage: 30,
    isProjectile: false,
  },
  {
    id: 918,
    name: "Living Shadow",
    compatibleWeaponTypes: [
      92 as WeaponType, // BACKHAND_BLADE
    ],
    compatibleAffinities: [AffinityId.STANDARD, AffinityId.QUALITY],
    damageMotionValues: {
      [AttackPowerType.PHYSICAL]: 100,
    },
    baseDamage: 0,
    baseBulletDamage: {
      [AttackPowerType.PHYSICAL]: 280,
    },
    poiseDamage: 22,
    isProjectile: true,
  },
];

app.get("/api/ashes", (_req, res) => res.json(ashOfWarCatalog));

app.post("/api/rank", (req, res) => {
  const ashOfWarId = parseInt(String(loadBody(req.body, "ashOfWarId")), 10);
  const attributes = loadBody(req.body, "attributes") as CharacterStats;
  const upgradeLevel = parseInt(String(loadBody(req.body, "upgradeLevel")), 10);
  const metric = String(loadBody(req.body, "metric", false) ?? "total") as RankingMetric;
  const enemyId = String(loadBody(req.body, "enemyId", false) ?? "");
  const twoHanding = Boolean(loadBody(req.body, "twoHanding", false));
  const buffIds = (loadBody(req.body, "buffIds", false) as string[]) ?? [];
  const charged = Boolean(loadBody(req.body, "charged", false) ?? false);
  const includeDLC = Boolean(loadBody(req.body, "includeDLC", false) ?? true);

  const ash = ashOfWarCatalog.find((a) => a.id === ashOfWarId);
  if (!ash) throw new ApiError(404, `Unknown ashId=${ashOfWarId}`);
  const enemy = enemyId ? enemyDatabase.find((e) => e.id === enemyId) : undefined;

  // Filter weapons by DLC inclusion
  const weaponPool = includeDLC ? decodedWeapons : decodedWeapons.filter(w => !w.dlc);

  const entries = rankWeapons(weaponPool, {
    ashOfWar: ash,
    attributes,
    upgradeLevel,
    metric,
    enemy,
    twoHanding,
    buffIds,
  });

  res.json({
    ashOfWar: {
      id: ash.id,
      name: ash.name,
      isProjectile: ash.isProjectile,
    },
    metric,
    results: entries.map((e) => ({
      rank: e.rank,
      weaponId: e.weapon.id,
      weaponName: e.weapon.name,
      weaponType: weaponTypeName[e.weapon.weaponType as WeaponType],
      affinityId: e.weapon.affinityId,
      affinityName: affinityName[e.weapon.affinityId as AffinityId],
      total: round(e.total),
      projectile: round(e.projectile),
      status: round(e.status),
      stance: e.stance,
      dps: round(e.dps),
      breakdown: e.breakdown,
    })),
  });
});

// ── Optimal Build Finder ──────────────────────────────────────────────────────
// Reverse calculator: given an AoW, enemy, and target RL, finds the optimal
// stat distribution that maximizes AoW damage. Uses a greedy approach:
// start with balanced stats, then iteratively shift points toward the stat
// that most increases damage.
app.post("/api/optimal-build", (req, res) => {
  const ashOfWarIdOpt = parseInt(String(loadBody(req.body, "ashOfWarId")), 10);
  const enemyId = String(loadBody(req.body, "enemyId", false) ?? "");
  const targetRL = parseInt(String(loadBody(req.body, "targetRL")), 10);
  const upgradeLevel = parseInt(String(loadBody(req.body, "upgradeLevel", false) ?? "25"), 10);
  const weaponId = loadBody(req.body, "weaponId", false);
  const twoHanding = Boolean(loadBody(req.body, "twoHanding", false) ?? false);
  const buffIds = (loadBody(req.body, "buffIds", false) as string[]) ?? [];

  const ash = ashOfWarCatalog.find((a) => a.id === ashOfWarIdOpt);
  if (!ash) throw new ApiError(404, `Unknown ashId=${ashOfWarIdOpt}`);
  const ashEntry: AshOfWarEntry = ash;
  const enemy = enemyId ? enemyDatabase.find((e) => e.id === enemyId) : undefined;

  // Total stat points available = RL + 79 (since RL1 = 80 total starting stats)
  const totalPoints = targetRL + 79;
  // Minimum stats for each attribute
  const MIN_STAT = 8;
  const COMBAT_STATS: Attribute[] = [Attribute.STRENGTH, Attribute.DEXTERITY, Attribute.INTELLIGENCE, Attribute.FAITH, Attribute.ARCANE]; // offensive stats to optimize
  const ALL_STATS: Attribute[] = [Attribute.VIGOR, Attribute.MIND, Attribute.ENDURANCE, ...COMBAT_STATS];

  // Determine which combat stats are relevant for this AoW's compatible weapons
  // Find compatible weapons
  const compatibleWeapons = decodedWeapons.filter(w =>
    ashEntry.compatibleWeaponTypes.includes(w.weaponType)
  );
  if (compatibleWeapons.length === 0) {
    throw new ApiError(400, 'No compatible weapons for this Ash of War');
  }

  // If weaponId is specified, only use that weapon for scoring
  const scoringWeapons = weaponId
    ? compatibleWeapons.filter(w => w === findWeaponById(Number(weaponId)))
    : compatibleWeapons.slice(0, 20); // sample top 20 compatible weapons

  // Start with balanced stats: give minimum to vigor/mind/endurance, split rest across combat stats
  const perStat = Math.floor((totalPoints - 60 - 25 - 25) / 5);
  let bestStats: CharacterStats = {
    [Attribute.VIGOR]: 60,
    [Attribute.MIND]: 25,
    [Attribute.ENDURANCE]: 25,
    [Attribute.STRENGTH]: Math.max(MIN_STAT, perStat),
    [Attribute.DEXTERITY]: Math.max(MIN_STAT, perStat),
    [Attribute.INTELLIGENCE]: Math.max(MIN_STAT, perStat),
    [Attribute.FAITH]: Math.max(MIN_STAT, perStat),
    [Attribute.ARCANE]: Math.max(MIN_STAT, perStat),
  };
  const remainingPoints = totalPoints - 60 - 25 - 25 - Math.max(MIN_STAT, perStat) * 5;
  // Distribute leftover points
  let leftover = remainingPoints;
  for (const s of COMBAT_STATS) {
    if (leftover <= 0) break;
    bestStats[s] = Math.min(99, bestStats[s] + 1);
    leftover--;
  }

  // Score function: compute total AoW damage across scoring weapons
  function scoreStats(stats: CharacterStats): number {
    let totalDmg = 0;
    for (const weapon of scoringWeapons) {
      try {
        const entries = rankWeapons([weapon], {
          ashOfWar: ashEntry,
          attributes: stats,
          upgradeLevel: clampUpgrade(weapon, upgradeLevel),
          metric: 'total',
          enemy,
          twoHanding,
          buffIds,
        });
        if (entries.length > 0) totalDmg += entries[0].total;
      } catch { /* skip invalid */ }
    }
    return totalDmg;
  }

  let bestScore = scoreStats(bestStats);
  let improved = true;
  let iterations = 0;
  const MAX_ITER = 100;

  while (improved && iterations < MAX_ITER) {
    improved = false;
    iterations++;
    for (const fromStat of COMBAT_STATS) {
      if (bestStats[fromStat] <= MIN_STAT) continue;
      for (const toStat of COMBAT_STATS) {
        if (fromStat === toStat) continue;
        if (bestStats[toStat] >= 99) continue;
        // Try moving one point from fromStat to toStat
        const testStats = { ...bestStats, [fromStat]: bestStats[fromStat] - 1, [toStat]: bestStats[toStat] + 1 };
        const testScore = scoreStats(testStats);
        if (testScore > bestScore) {
          bestStats = testStats;
          bestScore = testScore;
          improved = true;
        }
      }
    }
  }

  // Get the top weapons for the optimal stats
  const allCompatible = rankWeapons(compatibleWeapons, {
    ashOfWar: ashEntry,
    attributes: bestStats,
    upgradeLevel,
    metric: 'total',
    enemy,
    twoHanding,
    buffIds,
  });

  res.json({
    ashOfWar: { id: ashEntry.id, name: ashEntry.name },
    enemy: enemy ? { id: enemy.id, name: enemy.name } : null,
    targetRL,
    optimalStats: bestStats,
    runeLevel: Object.values(bestStats).reduce((a, b) => a + b, 0) - 79,
    topWeapons: allCompatible.slice(0, 10).map((e) => ({
      rank: e.rank,
      weaponId: e.weapon.id,
      weaponName: e.weapon.name,
      weaponType: weaponTypeName[e.weapon.weaponType as WeaponType],
      affinityName: affinityName[e.weapon.affinityId as AffinityId],
      total: round(e.total),
    })),
  });
});

// ── defensive helpers (kept here to ship milestone 1 self-contained) ─────────

function serializeAttackRatingResult(r: AttackRatingResult) {
  return {
    upgradeLevel: r.upgradeLevel,
    ineffectiveAttributes: r.ineffectiveAttributes,
    ineffectiveAttackPowerTypes: r.ineffectiveAttackPowerTypes,
    attackPower: Object.fromEntries(
      Object.entries(r.attackPower).map(([k, v]) => [
        k,
        v ? { total: round(v.total), scaled: round(v.scaled), weapon: round(v.weapon) } : null,
      ]),
    ),
    totalAR: round(getTotalAttackRating(r)),
    weapon: {
      id: r.weapon.id,
      name: r.weapon.name,
      weaponType: weaponTypeName[r.weapon.weaponType as WeaponType],
      affinityName: affinityName[r.weapon.affinityId as AffinityId],
    },
  };
}

function clampUpgrade(weapon: Weapon, level: number) {
  const max = weapon.attack.length - 1;
  return Math.max(0, Math.min(level, max));
}

function makeEmptyStats(): CharacterStats {
  return {
    [Attribute.VIGOR]: 10,
    [Attribute.MIND]: 10,
    [Attribute.ENDURANCE]: 10,
    [Attribute.STRENGTH]: 10,
    [Attribute.DEXTERITY]: 10,
    [Attribute.INTELLIGENCE]: 10,
    [Attribute.FAITH]: 10,
    [Attribute.ARCANE]: 10,
  };
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── serve built React frontend (for Electron production builds) ───────────────
import { fileURLToPath } from "url";
let _dirname2: string;
try {
  _dirname2 = path.dirname(fileURLToPath(import.meta.url));
} catch {
  _dirname2 = __dirname;
}
// Try multiple paths for the built frontend
const webDistCandidates = [
  path.join(_dirname2, "..", "..", "web", "dist"),       // from packages/server/src/
  path.join(_dirname2, "..", "packages", "web", "dist"),  // from electron/ (bundled)
  path.join(_dirname2, "..", "web", "dist"),              // from packages/server/dist/src/
  // Packaged Electron: bundle at app.asar.unpacked/, web-dist is at ./web-dist/
  path.join(_dirname2, "web-dist"),
  // Packaged Electron alt: parent of app.asar.unpacked/
  path.join(_dirname2, "..", "web-dist"),
];
const webDistPath = webDistCandidates.find((p) => fs.existsSync(p)) ?? "";
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  // SPA fallback: serve index.html for any non-API route
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(webDistPath, "index.html"));
    }
  });
  console.log(`[server] serving frontend from ${webDistPath}`);
}

// ── launch ───────────────────────────────────────────────────────────────────
app.listen(Number(PORT), String(HOST), () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on ${HOST}:${PORT}`);
});

export {};
