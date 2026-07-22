/**
 * api.ts — minimal REST client for the backend API.
 */

const BASE = '/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface WeaponListItem {
  id: number;
  name: string;
  weaponType: number;
  weaponTypeName: string;
  affinityId: number;
  affinityName: string;
  requirements: Record<string, number>;
  paired: boolean;
  dlc: boolean;
  isSpecialWeapon: boolean;
}

export interface EnemyInfo {
  id: string;
  name: string;
  defence: Record<number, number>;
  absorption: Record<number, number>;
  statusResistances?: Record<number, number>;
  hp?: number;
  enemyTypes?: string[];
}

export interface AshOfWarInfo {
  id: number;
  name: string;
  isProjectile: boolean;
}

export interface BuffInfo {
  id: string;
  name: string;
  category: string;
  allDamageMultiplier?: number;
  multipliers?: Record<number, number>;
  applicableTypes?: number[];
}

export interface AttackPowerParts {
  total: number;
  scaled: number;
  weapon: number;
}

export interface AttackRatingResponse {
  upgradeLevel: number;
  ineffectiveAttributes: string[];
  ineffectiveAttackPowerTypes: number[];
  attackPower: Record<number, AttackPowerParts | null>;
  totalAR: number;
  totalARWithStatus: number;
  weapon: { id: number; name: string; weaponType: string; affinityName: string };
}

export interface DamageResponse extends AttackRatingResponse {
  enemy: { id: string; name: string; hp?: number; baseHp?: number; statusResistances?: Record<number, number>; ngCycle?: number };
  enemyDamages: Record<number, number>;
  enemyDamageTotal: number;
  activeBuffs?: { id: string; name: string; category: string }[];
  statusProcs?: { type: number; name: string; perHit: number; threshold: number; hitsToProc: number }[];
  powerStance?: boolean;
  critModifier?: number;
  charged?: boolean;
}

export interface RankResult {
  rank: number;
  weaponId: number;
  weaponName: string;
  weaponType: string;
  affinityId: number;
  affinityName: string;
  total: number;
  projectile: number;
  status: number;
  stance: number;
  dps: number;
  breakdown: Record<number, number>;
}

export interface RankResponse {
  ashOfWar: AshOfWarInfo;
  metric: string;
  results: RankResult[];
}

export interface CompareRow {
  id: number;
  name: string;
  weaponType: number;
  weaponTypeName: string;
  affinityId: number;
  affinityName: string;
  ar: {
    phys: number;
    mag: number;
    fire: number;
    ligh: number;
    holy: number;
    total: number;
  };
  scaling: {
    str: number;
    dex: number;
    int: number;
    fai: number;
    arc: number;
  };
  requirements: Record<string, number>;
  ineffectiveAttributes: string[];
  isSpecialWeapon: boolean;
  dlc: boolean;
  paired: boolean;
}

export interface CompareResponse {
  count: number;
  rows: CompareRow[];
}

export const api = {
  getWeapons: () => fetchJson<WeaponListItem[]>('/weapons'),
  getEnemies: () => fetchJson<EnemyInfo[]>('/enemies'),
  getAshes: () => fetchJson<AshOfWarInfo[]>('/ashes'),
  getBuffs: () => fetchJson<BuffInfo[]>('/buffs'),
  getHealth: () => fetchJson<{ ok: boolean; weapons: number }>('/health'),
  postAttackRating: (body: Record<string, unknown>) =>
    fetchJson<AttackRatingResponse>('/attack-rating', { method: 'POST', body: JSON.stringify(body) }),
  postDamage: (body: Record<string, unknown>) =>
    fetchJson<DamageResponse>('/damage', { method: 'POST', body: JSON.stringify(body) }),
  postRank: (body: Record<string, unknown>) =>
    fetchJson<RankResponse>('/rank', { method: 'POST', body: JSON.stringify(body) }),
  postCompare: (body: Record<string, unknown>) =>
    fetchJson<CompareResponse>('/compare', { method: 'POST', body: JSON.stringify(body) }),
};
