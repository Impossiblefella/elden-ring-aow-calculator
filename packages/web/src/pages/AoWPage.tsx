/**
 * AoWPage.tsx — Ash of War Damage Calculator & Weapon Ranking page.
 *
 * Two modes:
 *  - 'rank': Pick an Ash of War, see ALL compatible weapons ranked by metric
 *  - 'compare': Pick an Ash of War, see a comparison table with sortable columns
 */
import { useState, useEffect, useMemo } from 'react';
import { useBuild } from '../App';
import { api, type AshOfWarInfo, type EnemyInfo, type RankResult } from '../api';

type Metric = 'total' | 'projectile' | 'status' | 'dps' | 'stance';
type Mode = 'rank' | 'compare';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'total', label: 'Total Damage' },
  { value: 'projectile', label: 'Projectile Damage' },
  { value: 'status', label: 'Status Buildup' },
  { value: 'dps', label: 'DPS' },
  { value: 'stance', label: 'Stance Damage' },
];

const DMG_NAMES: Record<number, string> = {
  0: 'Phys', 1: 'Magic', 2: 'Fire', 3: 'Ligh', 4: 'Holy',
  5: 'Poison', 6: 'Scarlet Rot', 7: 'Bleed', 8: 'Frost', 9: 'Sleep', 10: 'Madness',
};

type SortKey = 'rank' | 'weaponName' | 'weaponType' | 'affinityName' | 'total' | 'projectile' | 'status' | 'stance' | 'dps';

const SORT_LABELS: Record<SortKey, string> = {
  rank: '#',
  weaponName: 'Weapon',
  weaponType: 'Type',
  affinityName: 'Affinity',
  total: 'Total',
  projectile: 'Proj',
  status: 'Status',
  stance: 'Stance',
  dps: 'DPS',
};

function getValue(r: RankResult, key: SortKey): number | string {
  if (key === 'rank') return r.rank;
  if (key === 'weaponName') return r.weaponName;
  if (key === 'weaponType') return r.weaponType;
  if (key === 'affinityName') return r.affinityName;
  if (key === 'total') return r.total;
  if (key === 'projectile') return r.projectile;
  if (key === 'status') return r.status;
  if (key === 'stance') return r.stance;
  if (key === 'dps') return r.dps;
  return 0;
}

// ── Loading spinner (gold ring) ───────────────────────────────────────────────
function GoldSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="animate-spin-gold inline-block rounded-full border-2 border-er-border"
      style={{ width: size, height: size, borderTopColor: 'var(--er-gold)', borderRadius: '50%' }}
    />
  );
}

export function AoWPage() {
  const { stats, upgradeLevel, twoHanding, buffIds, enemyId, setEnemyId } = useBuild();
  const [ashes, setAshes] = useState<AshOfWarInfo[]>([]);
  const [enemies, setEnemies] = useState<EnemyInfo[]>([]);
  const [selectedAsh, setSelectedAsh] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>('total');
  const [results, setResults] = useState<RankResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('rank');
  const [searchTerm, setSearchTerm] = useState('');
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    api.getAshes().then(setAshes).catch(() => {});
    api.getEnemies().then(setEnemies).catch(() => {});
  }, []);

  const runRank = async () => {
    if (selectedAsh === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.postRank({
        ashOfWarId: selectedAsh,
        attributes: stats,
        upgradeLevel,
        metric,
        enemyId: enemyId || undefined,
        twoHanding,
        buffIds,
      });
      setResults(res.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rank weapons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAsh !== null) runRank();
  }, [selectedAsh, metric, enemyId, stats, upgradeLevel, twoHanding, buffIds]);

  // Client-side filters
  const filteredResults = useMemo(() => {
    let rows = results;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => r.weaponName.toLowerCase().includes(q));
    }
    if (weaponTypeFilter) {
      rows = rows.filter(r => r.weaponType === weaponTypeFilter);
    }
    return rows;
  }, [results, searchTerm, weaponTypeFilter]);

  // Sort
  const sortedResults = useMemo(() => {
    const rows = [...filteredResults];
    rows.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      let cmp: number;
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
      else cmp = (av as number) - (bv as number);
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [filteredResults, sortKey, sortAsc]);

  const displayResults = sortedResults.slice(0, limit);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const weaponTypeOptions = useMemo(() => {
    const set = new Set<string>();
    results.forEach(r => set.add(r.weaponType));
    return Array.from(set).sort();
  }, [results]);

  // Find max total for relative bar widths
  const maxTotal = useMemo(() => Math.max(...results.map(r => r.total), 1), [results]);

  const exportCSV = () => {
    const headers = ['Rank', 'Weapon', 'Type', 'Affinity', 'Total', 'Projectile', 'Status', 'Stance', 'DPS'];
    const lines = [headers.join(',')];
    for (const r of sortedResults) {
      lines.push([
        r.rank, `"${r.weaponName}"`, r.weaponType, r.affinityName,
        r.total.toFixed(1), r.projectile > 0 ? r.projectile.toFixed(1) : '',
        r.status > 0 ? r.status.toFixed(0) : '', r.stance, r.dps.toFixed(1),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `er-aow-ranking-${metric}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-er text-gold-grad">Ash of War Damage Calculator</h2>
        <span className="text-xs text-gray-500">{ashes.length} Ashes of War available</span>
      </div>

      {/* Controls */}
      <div className="bg-er-surface rounded-lg border border-er-border p-4 space-y-3 card-glow">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ash of War</label>
            <select
              value={selectedAsh ?? ''}
              onChange={(e) => setSelectedAsh(e.target.value ? parseInt(e.target.value) : null)}
              className="bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none min-w-[200px]"
            >
              <option value="">Select an Ash of War...</option>
              {ashes.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.isProjectile ? ' 🔸' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Enemy</label>
            <select
              value={enemyId}
              onChange={(e) => setEnemyId(e.target.value)}
              className="bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none min-w-[180px]"
            >
              <option value="">No enemy (raw damage)</option>
              {enemies.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rank by</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none"
            >
              {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex gap-1 ml-auto">
            {(['rank', 'compare'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded text-sm transition-er ${
                  mode === m ? 'btn-gold' : 'bg-er-bg border border-er-border text-gray-300 hover:border-er-gold card-glow'
                }`}
              >
                {m === 'rank' ? '🏆 Ranked' : '📋 Compare'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-er-surface rounded-lg border border-er-border p-8 text-center flex items-center justify-center gap-3 animate-fade-in">
          <GoldSpinner size={28} />
          <span className="text-er-muted text-sm">Ranking weapons...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-300 animate-fade-in">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!selectedAsh && !loading && (
        <div className="bg-er-surface rounded-lg border border-er-border p-8 text-center text-gray-500 animate-fade-in">
          <p className="text-4xl mb-3">⚔️</p>
          <p>Select an Ash of War above to rank every compatible weapon by damage.</p>
        </div>
      )}

      {/* Filter bar */}
      {results.length > 0 && !loading && (
        <div className="bg-er-surface rounded-lg border border-er-border p-3 flex flex-wrap gap-3 items-end card-glow animate-fade-in">
          <div>
            <label className="text-xs text-er-muted block mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Weapon name..."
              className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-48 transition-er focus:border-er-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-er-muted block mb-1">Weapon Type</label>
            <select
              value={weaponTypeFilter}
              onChange={e => setWeaponTypeFilter(e.target.value)}
              className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-40 transition-er focus:border-er-gold focus:outline-none"
            >
              <option value="">All</option>
              {weaponTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={exportCSV}
            className="ml-auto px-3 py-1 bg-er-gold/20 border border-er-gold/50 text-er-gold rounded text-sm hover:bg-er-gold/30 transition-er"
          >
            ⬇ Export CSV
          </button>
          <div className="text-xs text-er-muted">
            Showing <span className="text-er-fg font-semibold">{Math.min(limit, sortedResults.length)}</span> of {sortedResults.length}
            {searchTerm.trim() && <span className="ml-1 text-er-gold animate-fade-in">({sortedResults.length} matching "{searchTerm}")</span>}
          </div>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && !loading && (
        <div className="bg-er-surface rounded-lg border border-er-border overflow-hidden card-glow animate-fade-in-up">
          <div className="px-4 py-2 border-b border-er-border text-xs text-gray-400">
            {results.length} compatible weapons • Ranked by{' '}
            <span className="text-er-gold font-semibold font-er">
              {METRICS.find(m => m.value === metric)?.label}
            </span>
            {enemyId && <span className="ml-2">vs <span className="text-er-gold">{enemies.find(e => e.id === enemyId)?.name}</span></span>}
            {buffIds.length > 0 && <span className="ml-2 text-yellow-400">★ {buffIds.length} buff(s)</span>}
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-er-surface border-b border-er-border z-10">
                <tr className="text-xs text-gray-400 uppercase">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className={`sortable py-2 px-3 cursor-pointer ${
                        ['total', 'projectile', 'status', 'stance', 'dps', 'rank'].includes(key) ? 'text-right' : 'text-left'
                      } ${sortKey === key ? 'text-er-gold' : ''}`}
                    >
                      {SORT_LABELS[key]}{sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                  <th className="py-2 px-3 text-left">Breakdown</th>
                  <th className="py-2 px-3 text-left">Relative</th>
                </tr>
              </thead>
              <tbody>
                {displayResults.map((r, i) => (
                  <tr
                    key={r.weaponId}
                    className={`row-stagger border-b border-er-border/50 hover:bg-er-gold/5 transition-er ${
                      r.rank <= 3 ? 'bg-er-gold/5' : ''
                    }`}
                    style={{ animationDelay: `${Math.min(i * 20, 500)}ms` }}
                  >
                    <td className="py-1.5 px-3 text-right">
                      <span className={`font-bold ${r.rank <= 3 ? 'text-gold-grad' : 'text-er-gold'}`}>
                        {r.rank <= 3 ? `#${r.rank}` : r.rank}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-medium text-gray-200">{r.weaponName}</td>
                    <td className="py-1.5 px-3 text-gray-400">{r.weaponType}</td>
                    <td className="py-1.5 px-3 text-gray-400">{r.affinityName}</td>
                    <td className="py-1.5 px-3 text-right text-gray-100 font-semibold">
                      <span className={r.rank === 1 ? 'text-gold-grad' : ''}>{r.total.toFixed(1)}</span>
                    </td>
                    <td className="py-1.5 px-3 text-right text-gray-400">{r.projectile > 0 ? r.projectile.toFixed(1) : '—'}</td>
                    <td className="py-1.5 px-3 text-right text-gray-400">{r.status > 0 ? r.status.toFixed(0) : '—'}</td>
                    <td className="py-1.5 px-3 text-right text-gray-400">{r.stance > 0 ? r.stance.toFixed(0) : '—'}</td>
                    <td className="py-1.5 px-3 text-right text-gray-400">{r.dps > 0 ? r.dps.toFixed(1) : '—'}</td>
                    <td className="py-1.5 px-3 text-right text-gray-500 text-xs">
                      {Object.entries(r.breakdown)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => `${DMG_NAMES[Number(k)] ?? k}:${v.toFixed(0)}`)
                        .join('  ')}
                    </td>
                    {/* Relative damage bar */}
                    <td className="py-1.5 px-3 text-left min-w-[80px]">
                      <div className="h-1.5 bg-er-bg rounded-full overflow-hidden inline-block w-20">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${(r.total / maxTotal) * 100}%`,
                            background: r.rank === 1 ? 'var(--er-gold-grad)' : 'var(--er-accent)',
                            boxShadow: r.rank === 1 ? 'var(--er-glow)' : 'none',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedResults.length > limit && (
            <div className="p-3 text-center border-t border-er-border">
              <button
                onClick={() => setLimit(limit + 100)}
                className="px-4 py-2 bg-er-bg border border-er-border rounded text-sm hover:border-er-gold transition-er card-glow"
              >
                Load 100 more ({sortedResults.length - limit} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
