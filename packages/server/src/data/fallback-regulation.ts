/**
 * fallback-regulation.ts — Loads the real regulation data extracted from
 * the v1.14 vanilla regulation snapshot (derived from regulation.bin).
 *
 * The JSON file next to this module is extracted by the `build-db.ts`
 * script from an actual regulation.bin. For dev convenience we ship the
 * data for ~15 showcase weapons + all associated graphs, AEC entries,
 * reinforce types, and SpEffect params needed by those weapons.
 *
 * When the user provides a real regulation.bin via `npm run parse-regulation
 * -- /path/to/regulation.bin`, all ~3000 weapons and all params will be
 * extracted, fully replacing this snapshot.
 *
 * Source: regulation-vanilla-v1.14.json from nyedr/elden-ring-ar-calculator,
 * which itself was extracted from the game's regulation.bin using SoulsFormats
 * / Smithbox. Values match the latest Elden Ring patch.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RegulationDatabase } from '@er/shared';

let _dirname: string;
try {
  _dirname = dirname(fileURLToPath(import.meta.url));
} catch {
  // CJS fallback (esbuild bundle / Electron)
  _dirname = __dirname;
}

let cached: RegulationDatabase | null = null;

export function getFallbackRegulation(): RegulationDatabase {
  if (cached) return cached;

  // Try multiple paths to find the JSON (handles dev, compiled, and bundled modes)
  const candidates = [
    join(_dirname, 'regulation-vanilla-v1.14.json'),
    // CJS bundle in electron/ — data is in ../packages/server/src/data/
    join(_dirname, '..', 'packages', 'server', 'src', 'data', 'regulation-vanilla-v1.14.json'),
    // Compiled server in dist/src/ — data is in ../data/
    join(_dirname, '..', 'data', 'regulation-vanilla-v1.14.json'),
    // Packaged Electron app: bundle is unpacked at app.asar.unpacked/, JSON is at ./data/
    join(_dirname, 'data', 'regulation-vanilla-v1.14.json'),
    // Packaged Electron app alternative: ../data
    join(_dirname, '..', '..', 'data', 'regulation-vanilla-v1.14.json'),
  ];

  const jsonPath = candidates.find((p) => existsSync(p));
  if (!jsonPath) {
    throw new Error(`regulation-vanilla-v1.14.json not found in any of: ${candidates.join(', ')}`);
  }
  const raw = readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw);

  cached = {
    generatedAt: parsed.generatedAt,
    patchId: parsed.patchId,
    calcCorrectGraphs: parsed.calcCorrectGraphs,
    attackElementCorrects: parsed.attackElementCorrects,
    reinforceTypes: parsed.reinforceTypes,
    statusSpEffectParams: parsed.statusSpEffectParams,
    scalingTiers: parsed.scalingTiers,
    weapons: parsed.weapons,
  };
  return cached;
}

export const fallbackRegulationJson = getFallbackRegulation();
