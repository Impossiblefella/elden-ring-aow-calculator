/**
 * convert-regulation.cjs — Transform nyedr regulation JSON to our
 * RegulationDatabase format.
 *
 * The nyedr source (from elden-ring-ar-calculator) stores weapons with
 * tuple-array fields (attack, attributeScaling) and uses string-number keys
 * for the top-level parameter maps.  Our TypeScript types expect objects
 * keyed by real numbers and ScalingTier[] as {min,label}[].
 *
 * Usage:
 *   node scripts/convert-regulation.cjs [source.json] [output.json]
 *
 * Defaults:
 *   source = ../../er-ref/nyedr/regulation-vanilla-v1.14.json
 *   output = ../src/data/regulation-vanilla-v1.14.json
 */

"use strict";

const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

// In a .cjs file, __dirname is already defined by Node's CommonJS module system.
const DEFAULT_SOURCE = resolve(
  __dirname,
  "..", "..", "..", "..", "er-ref", "nyedr", "regulation-vanilla-v1.14.json",
);
const DEFAULT_OUTPUT = resolve(
  __dirname,
  "..", "src", "data", "regulation-vanilla-v1.14.json",
);

const sourcePath = process.argv[2] || DEFAULT_SOURCE;
const outputPath = process.argv[3] || DEFAULT_OUTPUT;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an array of [key, value] tuples into a plain object.
 *   [["str", 0.5], ["dex", 0.3]]  ->  { str: 0.5, dex: 0.3 }
 *   [[0, 107], [1, 86]]           ->  { "0": 107, "1": 86 }
 *
 * JS object keys are always strings; the engine accesses them with bracket
 * notation which coerces numbers to strings, so the string keys in the output
 * JSON work correctly at runtime.
 */
function tuplesToObject(tuples) {
  const obj = {};
  if (Array.isArray(tuples)) {
    for (const [k, v] of tuples) {
      obj[k] = v;
    }
  }
  return obj;
}

/**
 * Convert scalingTiers from [number, string] tuples to {min, label} objects.
 *   [[1.75, "S"], [1.4, "A"]]  ->  [{min: 1.75, label: "S"}, {min: 1.4, label: "A"}]
 */
function convertScalingTiers(tiers) {
  if (!Array.isArray(tiers)) return [];
  return tiers.map(([min, label]) => ({ min, label }));
}

// ---------------------------------------------------------------------------
// Weapon conversion
// ---------------------------------------------------------------------------

/**
 * Convert a single nyedr weapon entry to our RawWeaponRow format.
 *
 * Key transformations:
 * - attack: [[apt, val], ...]  →  { apt: val, ... }
 * - attributeScaling: [[attr, val], ...]  →  { attr: val, ... }
 * - calcCorrectGraphIds: { "0": 1, ... }  →  { 0: 1, ... } (passthrough,
 *   keys coerced by JS)
 * - id: generated from array index
 * - statusSpEffectParamIds: passthrough (already number[])
 * - requirements: passthrough (already { attr: number })
 *
 * Optional boolean flags (paired, sorceryTool, incantationTool, dlc) are not
 * present in the nyedr source; we omit them (they default to false in the
 * engine via `?? false`).
 */
function convertWeapon(srcWeapon, index) {
  const row = {
    id: index,
    name: srcWeapon.name,
    weaponType: srcWeapon.weaponType,
    affinityId: srcWeapon.affinityId,
    requirements: srcWeapon.requirements ?? {},
    attributeScaling: tuplesToObject(srcWeapon.attributeScaling),
    attack: tuplesToObject(srcWeapon.attack),
    reinforceTypeId: srcWeapon.reinforceTypeId,
    attackElementCorrectId: srcWeapon.attackElementCorrectId,
  };

  // Optional fields — only include if present in source
  if (srcWeapon.statusSpEffectParamIds != null) {
    row.statusSpEffectParamIds = srcWeapon.statusSpEffectParamIds;
  }
  if (srcWeapon.calcCorrectGraphIds != null) {
    row.calcCorrectGraphIds = srcWeapon.calcCorrectGraphIds;
  }

  return row;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log(`[convert] source: ${sourcePath}`);
  console.log(`[convert] output: ${outputPath}`);

  const raw = readFileSync(sourcePath, "utf-8");
  const src = JSON.parse(raw);

  // Validate expected top-level keys
  const expectedKeys = [
    "calcCorrectGraphs",
    "attackElementCorrects",
    "reinforceTypes",
    "statusSpEffectParams",
    "scalingTiers",
    "weapons",
  ];
  for (const k of expectedKeys) {
    if (!(k in src)) {
      throw new Error(`Source missing required key: ${k}`);
    }
  }
  console.log(`[convert] source top-level keys: ${Object.keys(src).join(", ")}`);

  // --- Convert weapons ---
  const weapons = src.weapons.map(convertWeapon);

  // --- Convert scalingTiers ---
  const scalingTiers = convertScalingTiers(src.scalingTiers);

  // --- Passthrough parameter maps (keys are string-numbers; JS coerces
  //     during bracket access, so string keys work with numeric lookups) ---
  const calcCorrectGraphs = src.calcCorrectGraphs;
  const attackElementCorrects = src.attackElementCorrects;
  const reinforceTypes = src.reinforceTypes;
  const statusSpEffectParams = src.statusSpEffectParams;

  // --- Assemble output ---
  const output = {
    generatedAt: new Date().toISOString(),
    patchId: "1.14",
    calcCorrectGraphs,
    attackElementCorrects,
    reinforceTypes,
    statusSpEffectParams,
    scalingTiers,
    weapons,
  };

  // --- Write ---
  const jsonStr = JSON.stringify(output, null, 2);
  writeFileSync(outputPath, jsonStr, "utf-8");

  // --- Stats ---
  console.log("\n=== Conversion Stats ===");
  console.log(`  Weapons:            ${weapons.length}`);
  console.log(`  CalcCorrectGraphs:  ${Object.keys(calcCorrectGraphs).length}`);
  console.log(`  AEC entries:        ${Object.keys(attackElementCorrects).length}`);
  console.log(`  Reinforce types:    ${Object.keys(reinforceTypes).length}`);
  console.log(`  StatusSpEffectParams: ${Object.keys(statusSpEffectParams).length}`);
  console.log(`  Scaling tiers:      ${scalingTiers.length}`);

  // Weapon breakdown stats
  const weaponTypeCounts = {};
  const affinityCounts = {};
  let weaponsWithStatus = 0;
  let weaponsWithCalcGraphIds = 0;
  let weaponsWithMultiAttack = 0;
  for (const w of weapons) {
    weaponTypeCounts[w.weaponType] = (weaponTypeCounts[w.weaponType] || 0) + 1;
    affinityCounts[w.affinityId] = (affinityCounts[w.affinityId] || 0) + 1;
    if (w.statusSpEffectParamIds) weaponsWithStatus++;
    if (w.calcCorrectGraphIds && Object.keys(w.calcCorrectGraphIds).length > 0)
      weaponsWithCalcGraphIds++;
    if (Object.keys(w.attack).length > 1) weaponsWithMultiAttack++;
  }
  console.log(`  Weapons w/ status:  ${weaponsWithStatus}`);
  console.log(`  Weapons w/ calcGraphIds: ${weaponsWithCalcGraphIds}`);
  console.log(`  Weapons w/ multi-attack: ${weaponsWithMultiAttack}`);
  console.log(`  Distinct weaponTypes: ${Object.keys(weaponTypeCounts).length}`);
  console.log(`  Distinct affinities: ${Object.keys(affinityCounts).length}`);

  // File size
  const outBytes = Buffer.byteLength(jsonStr, "utf-8");
  console.log(`\n  Output size:        ${(outBytes / 1024).toFixed(1)} KB (${outBytes} bytes)`);
  console.log(`  Output written to:  ${outputPath}`);
  console.log("\n[convert] done.");
}

main();
