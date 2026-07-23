/**
 * regulation.ts — pre-compute a readable weapon database from raw regulation.bin
 * params.
 *
 * Mirrors the layout in `nyedr/elden-ring-ar-calculator` but with explicit
 * types available to the rest of the engine. The input is the JSON snapshot
 * produced by the parser in `packages/server/scripts`; that snapshot is light,
 * minimal and easy to regenerate whenever FromSoftware ships a new patch.
 */

import {
  allDamageTypes,
  allStatusTypes,
  AttackPowerType,
  Attribute,
} from "../types";
import type {
  AttackElementCorrect,
  CalcCorrectGraph,
  RawWeaponRow,
  RegulationDatabase,
  Weapon as WeaponInstance,
} from "../regulation-types";

export const defaultDamageCalcCorrectGraphId = 0;
export const defaultStatusCalcCorrectGraphId = 6;

/** Status effects that always scale with arcane regardless of AEC entry. */
const forcedArcaneStatus: Record<AttackPowerType, boolean> = {
  [AttackPowerType.POISON]: true,
  [AttackPowerType.BLEED]: true,
  [AttackPowerType.MADNESS]: true,
  [AttackPowerType.SLEEP]: true,
  [AttackPowerType.SCARLET_ROT]: false,
  [AttackPowerType.FROST]: false,
  [AttackPowerType.DEATH_BLIGHT]: false,
  [AttackPowerType.PHYSICAL]: false,
  [AttackPowerType.MAGIC]: false,
  [AttackPowerType.FIRE]: false,
  [AttackPowerType.LIGHTNING]: false,
  [AttackPowerType.HOLY]: false,
} as Record<AttackPowerType, boolean>;

/**
 * Evaluate a CalcCorrectGraph into a lookup table giving the growth value at
 * each integer attribute value (1..148). Mirrors `evaluateCalcCorrectGraph`
 * in the reference calculator; the curve stages are linear with an optional
 * exponent (positive raises the ratio, negative inverts it).
 */
export function evaluateCalcCorrectGraph(graph: CalcCorrectGraph): number[] {
  const out: number[] = [];
  for (let i = 1; i < graph.length; i++) {
    const prev = graph[i - 1];
    const stage = graph[i];
    const minAttr = i === 1 ? 1 : prev.maxVal + 1;
    const maxAttr = i === graph.length - 1 ? 148 : stage.maxVal;

    for (let attr = minAttr; attr <= maxAttr; attr++) {
      if (out[attr] !== undefined) continue;
      let ratio =
        (attr - prev.maxVal) /
        (stage.maxVal - prev.maxVal);

      if (prev.adjPt > 0) {
        ratio = ratio ** prev.adjPt;
      } else if (prev.adjPt < 0) {
        ratio = 1 - (1 - ratio) ** -prev.adjPt;
      }
      out[attr] =
        prev.maxGrowVal + (stage.maxGrowVal - prev.maxGrowVal) * ratio;
    }
  }
  return out;
}

/** Pre-compute attack power and attribute scaling for every upgrade level. */
export function decodeWeapon(
  raw: RawWeaponRow,
  db: Pick<
    RegulationDatabase,
    | "attackElementCorrects"
    | "reinforceTypes"
    | "statusSpEffectParams"
    | "calcCorrectGraphs"
    | "scalingTiers"
  >,
): WeaponInstance {
  const aec = db.attackElementCorrects[raw.attackElementCorrectId];
  if (!aec) {
    throw new Error(
      `decodeWeapon(${raw.name}): missing AttackElementCorrectParam id=${raw.attackElementCorrectId}`,
    );
  }

  // Extend the AEC map with arcane scaling entries that the game hardcodes.
  const inheritedAec: AttackElementCorrect = { ...aec };
  for (const [k, v] of Object.entries(forcedArcaneStatus)) {
    if (!v) continue;
    const apt = Number(k) as AttackPowerType;
    if (!inheritedAec[apt]) {
      inheritedAec[apt] = { arc: true };
    }
  }

  const reinforce = db.reinforceTypes[raw.reinforceTypeId];
  if (!reinforce) {
    throw new Error(
      `decodeWeapon(${raw.name}): missing ReinforceParamWeapon id=${raw.reinforceTypeId}`,
    );
  }

  // Build the calc-correct-graph lookup per damage type.
  const calcGraphLookup = new Map<number, number[]>();
  function getGraph(id: number): number[] {
    let g = calcGraphLookup.get(id);
    if (!g) {
      const src = db.calcCorrectGraphs[id];
      if (!src) {
        throw new Error(`Missing CalcCorrectGraph id=${id}`);
      }
      g = evaluateCalcCorrectGraph(src);
      calcGraphLookup.set(id, g);
    }
    return g;
  }

  const calcCorrectGraphs: WeaponInstance["calcCorrectGraphs"] = {};
  for (const apt of allDamageTypes) {
    const id = raw.calcCorrectGraphIds?.[apt] ?? defaultDamageCalcCorrectGraphId;
    calcCorrectGraphs[apt] = getGraph(id);
  }
  for (const apt of allStatusTypes) {
    const id = raw.calcCorrectGraphIds?.[apt] ?? defaultStatusCalcCorrectGraphId;
    calcCorrectGraphs[apt] = getGraph(id);
  }

  // Pre-compute attack power + scaling per upgrade level.
  const attack = reinforce.map((rp) => {
    const chunk: Partial<Record<AttackPowerType, number>> = {};
    for (const [key, value] of Object.entries(raw.attack)) {
      const apt = Number(key) as AttackPowerType;
      chunk[apt] = (value ?? 0) * (rp.attack[apt] ?? 0);
    }
    // Add status spEffect values (surface as attack power entries for status types).
    const statusIds = raw.statusSpEffectParamIds ?? [];
    const offsets = [rp.statusSpEffectId1, rp.statusSpEffectId2, rp.statusSpEffectId3];
    statusIds.forEach((statusId, i) => {
      if (!statusId) return;
      const resolved = db.statusSpEffectParams[statusId + (offsets[i] ?? 0)];
      if (resolved) Object.assign(chunk, resolved);
    });
    return chunk;
  });

  const attributeScaling = reinforce.map((rp) => {
    const chunk: Partial<Record<Attribute, number>> = {};
    for (const [key, value] of Object.entries(raw.attributeScaling)) {
      const attr = key as Attribute;
      chunk[attr] = (value ?? 0) * (rp.attributeScaling[attr] ?? 0);
    }
    return chunk;
  });

  return {
    id: raw.id,
    name: raw.name,
    weaponType: raw.weaponType,
    affinityId: raw.affinityId,
    requirements: raw.requirements,
    paired: raw.paired ?? false,
    sorceryTool: raw.sorceryTool ?? false,
    incantationTool: raw.incantationTool ?? false,
    dlc: raw.dlc ?? (raw.id >= 3000),
    isSpecialWeapon: reinforce.length - 1 < 11,
    attack,
    attributeScaling,
    attackElementCorrect: inheritedAec,
    calcCorrectGraphs,
    scalingTiers: db.scalingTiers,
  };
}

/** Convenience: decode every weapon in a regulation database. */
export function decodeAll(db: RegulationDatabase): WeaponInstance[] {
  return db.weapons.map((rw) => decodeWeapon(rw, db));
}

