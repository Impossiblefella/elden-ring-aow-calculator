/**
 * ARPage.tsx — Weapon comparison page with three modes:
 *  - 'table': all 3,216 weapons shown as a sortable, filterable AR table (like tarnished.dev)
 *  - 'single': single selected weapon with detailed AR + enemy damage breakdown
 *  - 'compare': two weapons side-by-side with detailed AR + enemy damage
 */
import { useState, useEffect, useMemo } from 'react';
import { useBuild } from '../App';
import {
  api,
  type WeaponListItem,
  type EnemyInfo,
  type DamageResponse,
  type CompareRow,
} from '../api';

type Mode = 'table' | 'single' | 'compare';

type SortKey =
  | 'name'
  | 'weaponTypeName'
  | 'affinityName'
  | 'ar.phys'
  | 'ar.mag'
  | 'ar.fire'
  | 'ar.ligh'
  | 'ar.holy'
  | 'ar.total'
  | 'scaling.str'
  | 'scaling.dex'
  | 'scaling.int'
  | 'scaling.fai'
  | 'scaling.arc';

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Weapon',
  weaponTypeName: 'Type',
  affinityName: 'Affinity',
  'ar.phys': 'PHYS',
  'ar.mag': 'MAG',
  'ar.fire': 'FIRE',
  'ar.ligh': 'LIGH',
  'ar.holy': 'HOLY',
  'ar.total': 'TOTAL',
  'scaling.str': 'STR',
  'scaling.dex': 'DEX',
  'scaling.int': 'INT',
  'scaling.fai': 'FAI',
  'scaling.arc': 'ARC',
};

const DMG_NAMES: Record<number, string> = {
  0: 'Physical', 1: 'Magic', 2: 'Fire', 3: 'Lightning', 4: 'Holy',
  5: 'Poison', 6: 'Scarlet Rot', 7: 'Bleed', 8: 'Frost', 9: 'Sleep', 10: 'Madness',
};

// Get nested object value by dot path
function getValue(obj: CompareRow, path: SortKey): number | string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) cur = (cur as Record<string, unknown>)[p];
  return cur as number | string;
}

// Format scaling letter (number → letter grade)
function scalingLetter(v: number): string {
  if (v === 0) return '–';
  if (v >= 1.5) return 'S';
  if (v >= 1.0) return 'A';
  if (v >= 0.75) return 'B';
  if (v >= 0.5) return 'C';
  if (v >= 0.25) return 'D';
  return 'E';
}

export function ARPage() {
  const { stats, upgradeLevel, twoHanding, buffIds } = useBuild();
  const [mode, setMode] = useState<Mode>('table');
  const [enemies, setEnemies] = useState<EnemyInfo[]>([]);
  const [enemyId, setEnemyId] = useState('malenia');

  // Table mode state
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<number | ''>('');
  const [affinityFilter, setAffinityFilter] = useState<number | ''>('');
  const [includeSpecial, setIncludeSpecial] = useState(true);
  const [includeDLC, setIncludeDLC] = useState(true);
  const [hideIneffective, setHideIneffective] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('ar.total');
  const [sortAsc, setSortAsc] = useState(false);
  const [limit, setLimit] = useState(50);

  // Single/compare mode state
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponListItem | null>(null);
  const [compareWeapon, setCompareWeapon] = useState<WeaponListItem | null>(null);
  const [resultA, setResultA] = useState<DamageResponse | null>(null);
  const [resultB, setResultB] = useState<DamageResponse | null>(null);
  const [weapons, setWeapons] = useState<WeaponListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getEnemies().then(setEnemies).catch(() => {});
    api.getWeapons().then(setWeapons).catch(() => {});
  }, []);

  // Fetch compare table when build/filters change in table mode
  useEffect(() => {
    if (mode !== 'table') return;
    setLoading(true);
    setError(null);
    const body: Record<string, unknown> = {
      attributes: stats,
      upgradeLevel,
      twoHanding,
      buffIds,
      includeSpecial,
    };
    if (weaponTypeFilter !== '') body.weaponType = weaponTypeFilter;
    if (affinityFilter !== '') body.affinity = affinityFilter;
    api.postCompare(body)
      .then(res => setCompareRows(res.rows))
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [mode, stats, upgradeLevel, twoHanding, buffIds, weaponTypeFilter, affinityFilter, includeSpecial]);

  // Calc single weapon damage
  useEffect(() => {
    if (mode === 'table' || !selectedWeapon) { setResultA(null); return; }
    api.postDamage({ weaponId: selectedWeapon.id, attributes: stats, upgradeLevel, enemyId, twoHanding, buffIds })
      .then(setResultA)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'));
  }, [mode, selectedWeapon, stats, upgradeLevel, enemyId, twoHanding, buffIds]);

  useEffect(() => {
    if (mode !== 'compare' || !compareWeapon) { setResultB(null); return; }
    api.postDamage({ weaponId: compareWeapon.id, attributes: stats, upgradeLevel, enemyId, twoHanding, buffIds })
      .then(setResultB)
      .catch(() => {});
  }, [mode, compareWeapon, stats, upgradeLevel, enemyId, twoHanding, buffIds]);

  // Client-side filtering (search term, DLC, ineffective)
  const filteredRows = useMemo(() => {
    let rows = compareRows;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }
    if (!includeDLC) rows = rows.filter(r => !r.dlc);
    if (hideIneffective) rows = rows.filter(r => r.ineffectiveAttributes.length === 0);
    return rows;
  }, [compareRows, searchTerm, includeDLC, hideIneffective]);

  // Sort
  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      let cmp: number;
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
      else cmp = (av as number) - (bv as number);
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [filteredRows, sortKey, sortAsc]);

  // Limited rows for display (perf)
  const displayRows = sortedRows.slice(0, limit);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Type', 'Affinity', 'PHYS', 'MAG', 'FIRE', 'LIGH', 'HOLY', 'TOTAL', 'STR', 'DEX', 'INT', 'FAI', 'ARC', 'DLC'];
    const lines = [headers.join(',')];
    for (const r of sortedRows) {
      lines.push([
        `"${r.name}"`, r.weaponTypeName, r.affinityName,
        r.ar.phys, r.ar.mag, r.ar.fire, r.ar.ligh, r.ar.holy, r.ar.total,
        scalingLetter(r.scaling.str), scalingLetter(r.scaling.dex),
        scalingLetter(r.scaling.int), scalingLetter(r.scaling.fai), scalingLetter(r.scaling.arc),
        r.dlc ? 'Y' : '',
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'er-weapon-ar-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const weaponTypeOptions = useMemo(() => {
    const set = new Map<number, string>();
    weapons.forEach(w => set.set(w.weaponType, w.weaponTypeName));
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [weapons]);

  const affinityOptions = useMemo(() => {
    const set = new Map<number, string>();
    compareRows.forEach(r => set.set(r.affinityId, r.affinityName));
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [compareRows]);

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2 items-center">
        <span className="text-sm text-er-muted">Mode:</span>
        {(['table', 'single', 'compare'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 rounded text-sm ${
              mode === m ? 'bg-er-accent text-black font-semibold' : 'bg-er-surface border border-er-border text-er-fg hover:border-er-accent'
            }`}
          >
            {m === 'table' ? '📋 Compare Table' : m === 'single' ? '⚔️ Single Weapon' : '🔁 Compare Two'}
          </button>
        ))}
        {error && <span className="text-red-400 text-sm ml-auto">⚠ {error}</span>}
      </div>

      {/* ── TABLE MODE ────────────────────────────────────────────────────── */}
      {mode === 'table' && (
        <div className="bg-er-surface rounded-lg border border-er-border p-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-3 items-end">
            <div>
              <label className="text-xs text-er-muted block mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Weapon name..."
                className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-48"
              />
            </div>
            <div>
              <label className="text-xs text-er-muted block mb-1">Weapon Type</label>
              <select
                value={weaponTypeFilter}
                onChange={e => setWeaponTypeFilter(e.target.value === '' ? '' : Number(e.target.value))}
                className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-40"
              >
                <option value="">All</option>
                {weaponTypeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-er-muted block mb-1">Affinity</label>
              <select
                value={affinityFilter}
                onChange={e => setAffinityFilter(e.target.value === '' ? '' : Number(e.target.value))}
                className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-40"
              >
                <option value="">All</option>
                {affinityOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <label className="text-sm flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={includeSpecial} onChange={e => setIncludeSpecial(e.target.checked)} />
              Special weapons
            </label>
            <label className="text-sm flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={includeDLC} onChange={e => setIncludeDLC(e.target.checked)} />
              DLC
            </label>
            <label className="text-sm flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={hideIneffective} onChange={e => setHideIneffective(e.target.checked)} />
              Hide ineffective
            </label>
            <button
              onClick={exportCSV}
              className="ml-auto px-3 py-1 bg-er-accent/20 border border-er-accent/50 text-er-accent rounded text-sm hover:bg-er-accent/30"
            >
              ⬇ Export CSV
            </button>
          </div>

          {/* Status */}
          <div className="text-xs text-er-muted mb-2">
            Showing <span className="text-er-fg font-semibold">{Math.min(limit, sortedRows.length)}</span> of {sortedRows.length} weapons
            {loading && <span className="ml-2 text-er-accent">⟳ loading...</span>}
            {buffIds.length > 0 && <span className="ml-2 text-yellow-400">★ {buffIds.length} buff(s) active</span>}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="border-b border-er-border text-er-muted">
                  <th className="text-left p-2">#</th>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className={`p-2 cursor-pointer hover:text-er-accent ${
                        ['ar.phys', 'ar.mag', 'ar.fire', 'ar.ligh', 'ar.holy', 'ar.total',
                          'scaling.str', 'scaling.dex', 'scaling.int', 'scaling.fai', 'scaling.arc'].includes(key)
                          ? 'text-right' : 'text-left'
                      } ${sortKey === key ? 'text-er-accent' : ''}`}
                    >
                      {SORT_LABELS[key]}
                      {sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                  <th className="text-center p-2">DLC</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-er-border/30 hover:bg-er-bg/40 ${r.ineffectiveAttributes.length > 0 ? 'opacity-60' : ''}`}
                  >
                    <td className="p-2 text-er-muted">{i + 1}</td>
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2 text-er-muted">{r.weaponTypeName}</td>
                    <td className="p-2 text-er-muted">{r.affinityName}</td>
                    <td className="p-2 text-right">{r.ar.phys || '–'}</td>
                    <td className="p-2 text-right">{r.ar.mag || '–'}</td>
                    <td className="p-2 text-right">{r.ar.fire || '–'}</td>
                    <td className="p-2 text-right">{r.ar.ligh || '–'}</td>
                    <td className="p-2 text-right">{r.ar.holy || '–'}</td>
                    <td className="p-2 text-right font-semibold text-er-accent">{r.ar.total}</td>
                    <td className="p-2 text-right">{scalingLetter(r.scaling.str)}</td>
                    <td className="p-2 text-right">{scalingLetter(r.scaling.dex)}</td>
                    <td className="p-2 text-right">{scalingLetter(r.scaling.int)}</td>
                    <td className="p-2 text-right">{scalingLetter(r.scaling.fai)}</td>
                    <td className="p-2 text-right">{scalingLetter(r.scaling.arc)}</td>
                    <td className="p-2 text-center text-xs">{r.dlc && <span className="text-er-accent">★</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {sortedRows.length > limit && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setLimit(limit + 100)}
                className="px-4 py-2 bg-er-surface border border-er-border rounded text-sm hover:border-er-accent"
              >
                Load 100 more ({sortedRows.length - limit} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SINGLE MODE ───────────────────────────────────────────────────── */}
      {mode === 'single' && (
        <div className="space-y-4">
          <WeaponPicker
            label="Weapon"
            weapons={weapons}
            selected={selectedWeapon}
            onSelect={setSelectedWeapon}
          />
          {resultA && <DamagePanel result={resultA} enemyId={enemyId} enemies={enemies} onEnemyChange={setEnemyId} />}
        </div>
      )}

      {/* ── COMPARE MODE ───────────────────────────────────────────────────── */}
      {mode === 'compare' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <WeaponPicker label="Weapon A" weapons={weapons} selected={selectedWeapon} onSelect={setSelectedWeapon} />
            {resultA && <DamagePanel result={resultA} enemyId={enemyId} enemies={enemies} onEnemyChange={setEnemyId} />}
          </div>
          <div className="space-y-2">
            <WeaponPicker label="Weapon B" weapons={weapons} selected={compareWeapon} onSelect={setCompareWeapon} />
            {resultB && <DamagePanel result={resultB} enemyId={enemyId} enemies={enemies} onEnemyChange={setEnemyId} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Weapon picker ─────────────────────────────────────────────────────────────
function WeaponPicker({ label, weapons, selected, onSelect }: {
  label: string;
  weapons: WeaponListItem[];
  selected: WeaponListItem | null;
  onSelect: (w: WeaponListItem) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return weapons.slice(0, 200);
    const q = search.toLowerCase();
    return weapons.filter(w => w.name.toLowerCase().includes(q)).slice(0, 200);
  }, [weapons, search]);

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-3">
      <label className="text-sm font-semibold block mb-2">{label}</label>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search weapons..."
        className="w-full px-3 py-2 mb-2 bg-er-bg border border-er-border rounded text-sm"
      />
      {selected && (
        <div className="text-sm mb-2 p-2 bg-er-accent/10 border border-er-accent/30 rounded">
          <span className="font-semibold text-er-accent">{selected.name}</span>
          <span className="text-er-muted"> — {selected.weaponTypeName} / {selected.affinityName || 'Unique'}</span>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto border border-er-border rounded">
        {filtered.map(w => (
          <div
            key={w.id}
            onClick={() => onSelect(w)}
            className={`p-2 cursor-pointer hover:bg-er-bg border-b border-er-border/30 text-sm ${
              selected?.id === w.id ? 'bg-er-accent/20' : ''
            }`}
          >
            <span className="font-medium">{w.name}</span>
            <span className="text-er-muted text-xs ml-2">{w.weaponTypeName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Damage panel ──────────────────────────────────────────────────────────────
function DamagePanel({ result, enemyId, enemies, onEnemyChange }: {
  result: DamageResponse;
  enemyId: string;
  enemies: EnemyInfo[];
  onEnemyChange: (id: string) => void;
}) {
  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{result.weapon.name}</h3>
        <span className="text-er-muted text-sm">{result.weapon.weaponType} / {result.weapon.affinityName}</span>
      </div>

      {/* Enemy selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-er-muted">Enemy:</label>
        <select
          value={enemyId}
          onChange={e => onEnemyChange(e.target.value)}
          className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm"
        >
          {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {result.enemy.hp && <span className="text-er-muted text-sm">HP: {result.enemy.hp.toLocaleString()}</span>}
      </div>

      {/* AR breakdown */}
      <div>
        <div className="text-xs uppercase text-er-muted mb-1">Attack Rating</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(result.attackPower).map(([k, v]) => (
            v && (
              <div key={k} className="bg-er-bg rounded p-2 text-center">
                <div className="text-xs text-er-muted">{DMG_NAMES[Number(k)] || k}</div>
                <div className="font-semibold">{v.total}</div>
              </div>
            )
          ))}
          <div className="bg-er-accent/20 rounded p-2 text-center col-span-5">
            <div className="text-xs text-er-muted">Total AR</div>
            <div className="font-semibold text-er-accent text-lg">{result.totalAR}</div>
          </div>
        </div>
      </div>

      {/* Enemy damage */}
      <div>
        <div className="text-xs uppercase text-er-muted mb-1">Damage vs {result.enemy.name}</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(result.enemyDamages).map(([k, v]) => (
            <div key={k} className="bg-er-bg rounded p-2 text-center">
              <div className="text-xs text-er-muted">{DMG_NAMES[Number(k)] || k}</div>
              <div className="font-semibold">{Math.round(v).toLocaleString()}</div>
            </div>
          ))}
          <div className="bg-red-900/30 rounded p-2 text-center col-span-5">
            <div className="text-xs text-er-muted">Total Damage</div>
            <div className="font-semibold text-red-300 text-lg">{Math.round(result.enemyDamageTotal).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Active buffs */}
      {result.activeBuffs && result.activeBuffs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-yellow-500">Active:</span>
          {result.activeBuffs.map(b => (
            <span key={b.id} className="text-xs px-2 py-0.5 bg-yellow-900/30 border border-yellow-700/40 rounded text-yellow-300">
              {b.name}
            </span>
          ))}
        </div>
      )}

      {/* Requirement warnings */}
      {result.ineffectiveAttributes.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded p-2 text-xs text-yellow-300">
          ⚠ Effective attributes too low for: {result.ineffectiveAttributes.join(', ')}
        </div>
      )}
    </div>
  );
}
