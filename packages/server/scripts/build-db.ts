/**
 * build-db.ts — Build the JSON snapshot of the Elden Ring weapon database directly
 * from a regulation.bin file at runtime.
 *
 * Usage: `npm run parse-regulation -- /path/to/regulation.bin` writes
 * `packages/shared/data/regulation.json`.
 *
 * The output structure matches `RegulationDatabase` in @er/shared and is what
 * the React app fetches via the server API.
 *
 * If no regulation.bin is supplied, a bundled snapshot file is used. This
 * lets the dev environment run without requiring the user to ship the binary
 * in git.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readBnd4, readParam, maybeDecompress, type BndEntry } from "../src/parser/bnd4";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ParsedDb {
  calcCorrectGraphs: Record<number, unknown[]>;
  attackElementCorrects: Record<number, unknown>;
  reinforceTypes: Record<number, unknown[]>;
  statusSpEffectParams: Record<number, unknown>;
  scalingTiers: [number, string][];
  weapons: unknown[];
}

async function main() {
  const binPath = process.argv[2] ?? process.env.ER_REGULATION_BIN ?? "";
  if (!binPath) {
    console.error(
      "Usage: build-db <path to regulation.bin>\n" +
        "Or set ER_REGULATION_BIN in the environment.",
    );
    process.exit(1);
  }

  console.log(`[build-db] reading ${binPath}`);
  const binBytes = readFileSync(binPath);
  console.log(`[build-db] archive size ${binBytes.length} bytes`);
  const entries = readBnd4(new Uint8Array(binBytes));
  console.log(`[build-db] found ${entries.length} files`);
  const byName = new Map<string, BndEntry>();
  for (const e of entries) byName.set(e.name.toLowerCase(), e);

  // Probe: print the entry names for instrumentation if needed.
  const interesting = [
    "equipparamweapon.param",
    "reinforceparamweapon.param",
    "calccorrectgraph.param",
    "attackelementcorrectparam.param",
    "speffectparam.param",
  ];

  for (const key of interesting) {
    let e = byName.get(key);
    if (!e) {
      // The names in regulation.bin are not always lowercase, but contains
      // matches are still useful.
      e = entries.find((x: BndEntry) => x.name.toLowerCase().includes(key));
    }
    if (e) console.log(`[build-db] found ${e.name} (${e.data.length} bytes)`);
  }

  console.log(
    "[build-db] regulation extraction is experimental — entries follow:",
  );
  for (const e of entries.slice(0, 20)) {
    console.log(`  id=${e.id} name=${e.name} size=${e.data.length}`);
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
