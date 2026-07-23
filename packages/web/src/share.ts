/**
 * share.ts — Build share link encoding/decoding.
 *
 * Encodes the entire build state (stats, upgrade level, two-handing, buffs,
 * enemy, NG+ cycle, toggles) into a compact URL hash string that can be
 * copy-pasted to share builds.
 *
 * Format: base64url(JSON.stringify(BuildState)) prefixed with 'b='
 * Using base64url keeps it URL-safe without percent-encoding.
 */

export interface ShareableBuild {
  s: [number, number, number, number, number, number, number, number]; // stats: vig, mnd, end, str, dex, int, fai, arc
  u: number;  // upgradeLevel
  t: number;  // twoHanding (0|1)
  b: string[]; // buffIds
  e: string;  // enemyId
  n: number;  // ngCycle
  p: number;  // powerStance (0|1)
  c: number;  // critModifier
  ch: number; // charged (0|1)
  d: number; // includeDLC (0|1)
}

const STAT_KEYS = ['vigor', 'mind', 'endurance', 'str', 'dex', 'int', 'fai', 'arc'] as const;

export interface BuildStateForShare {
  stats: { vigor: number; mind: number; endurance: number; str: number; dex: number; int: number; fai: number; arc: number };
  upgradeLevel: number;
  twoHanding: boolean;
  buffIds: string[];
  enemyId: string;
  ngCycle: number;
  powerStance: boolean;
  critModifier: number;
  charged: boolean;
  includeDLC: boolean;
}

/** Encode a build state into a compact URL hash string. */
export function encodeBuild(build: BuildStateForShare): string {
  const compact: ShareableBuild = {
    s: [build.stats.vigor, build.stats.mind, build.stats.endurance, build.stats.str, build.stats.dex, build.stats.int, build.stats.fai, build.stats.arc],
    u: build.upgradeLevel,
    t: build.twoHanding ? 1 : 0,
    b: build.buffIds,
    e: build.enemyId,
    n: build.ngCycle,
    p: build.powerStance ? 1 : 0,
    c: build.critModifier,
    ch: build.charged ? 1 : 0,
    d: build.includeDLC ? 1 : 0,
  };
  const json = JSON.stringify(compact);
  // base64url encode
  const b64 = btoa(encodeURIComponent(json));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a URL hash string back into a build state. Returns null on failure. */
export function decodeBuild(hash: string): BuildStateForShare | null {
  try {
    // Remove 'b=' prefix if present
    let h = hash.startsWith('b=') ? hash.slice(2) : hash;
    // Convert base64url back to base64
    h = h.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding
    while (h.length % 4) h += '=';
    const json = decodeURIComponent(atob(h));
    const compact = JSON.parse(json) as ShareableBuild;
    const stats = {
      vigor: compact.s[0] ?? 1,
      mind: compact.s[1] ?? 1,
      endurance: compact.s[2] ?? 1,
      str: compact.s[3] ?? 1,
      dex: compact.s[4] ?? 1,
      int: compact.s[5] ?? 1,
      fai: compact.s[6] ?? 1,
      arc: compact.s[7] ?? 1,
    };
    return {
      stats,
      upgradeLevel: compact.u ?? 25,
      twoHanding: compact.t === 1,
      buffIds: Array.isArray(compact.b) ? compact.b : [],
      enemyId: compact.e ?? 'malenia',
      ngCycle: compact.n ?? 0,
      powerStance: compact.p === 1,
      critModifier: compact.c ?? 1.0,
      charged: compact.ch === 1,
      includeDLC: compact.d === 1,
    };
  } catch {
    return null;
  }
}

/** Get the current share URL from a build state. */
export function getShareURL(build: BuildStateForShare): string {
  const encoded = encodeBuild(build);
  const base = window.location.origin + window.location.pathname;
  return `${base}#b=${encoded}`;
}

/** Check if the current URL has a shared build hash. Returns decoded build or null. */
export function checkForSharedBuild(): BuildStateForShare | null {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#b=')) return null;
  return decodeBuild(hash.slice(1));
}
