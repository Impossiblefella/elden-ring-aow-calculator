/**
 * ARPage.tsx — Weapon comparison page with three modes:
 *  - 'table': all 3,216 weapons shown as a sortable, filterable AR table
 *  - 'single': single selected weapon with detailed AR + enemy damage breakdown
 *  - 'compare': two weapons side-by-side with detailed AR + enemy damage + bars
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

// Format scaling letter
function scalingLetter(v: number): string {
  if (v === 0) return '–';
  if (v >= 1.5) return 'S';
  if (v >= 1.0) return 'A';
  if (v >= 0.75) return 'B';
  if (v >= 0.5) return 'C';
  if (v >= 0.25) return 'D';
  return 'E';
}

// ── Count-up animation hook ─────────────────────────────────────────────────
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (target === ref.current) return;
    ref.current = target;
    startTime.current = null;
    let raf: number;

    const tick = (now: number) => {
      if (startTime.current === null) startTime.current = now;
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

// ── Count-up display component ───────────────────────────────────────────────
function CountUp({ value, className }: { value: number; className?: string }) {
  const display = useCountUp(value);
  return <span className={className}>{display.toLocaleString()}</span>;
}

// ── Loading spinner (gold ring like the app icon) ────────────────────────────
function GoldSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer gold glow pulse synced with spin */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          boxShadow: '0 0 10px 2px rgba(212, 175, 55, 0.5)',
        }}
        animate={{
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.18, 1],
        }}
        transition={{
          duration: 1.2,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      />
      {/* Spinning gold ring */}
      <motion.div
        className="inline-block rounded-full border-2 border-er-border"
        style={{
          width: size,
          height: size,
          borderTopColor: 'var(--er-gold)',
          borderRadius: '50%',
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          ease: 'linear',
          repeat: Infinity,
        }}
      />
    </div>
  );
}

// ── Collapsible weapon type group ──────────────────────────────────────────────
function GroupedWeaponSection({ typeName, rows, compact, onRowClick }: {
  typeName: string;
  rows: CompareRow[];
  compact: boolean;
  onRowClick: (r: CompareRow) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="border-b border-er-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-er-bg/40 hover:bg-er-gold/5 transition-er text-left"
      >
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} className="text-gray-400 text-xs">▶</motion.span>
        <span className="text-sm font-er text-gold-grad">{typeName}</span>
        <span className="text-xs text-gray-500">({rows.length})</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <table className="text-sm w-full">
              <tbody>
                <AnimatePresence>
                  {rows.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      layout
                      onClick={() => onRowClick(r)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.15) }}
                      className={`border-b border-er-border/30 hover:bg-er-gold/10 transition-er cursor-pointer ${compact ? 'text-xs' : ''}`}
                    >
                      <td className={compact ? 'py-0.5 px-2' : 'p-2'}></td>
                      <td className={compact ? 'py-0.5 px-2 font-medium' : 'p-2 font-medium'}>{r.name}</td>
                      <td className="p-2 text-er-muted">{r.affinityName}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.phys.base}  |  Scaling: +${r.arParts.phys.scaled}` : undefined}>{r.ar.phys || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.mag.base}  |  Scaling: +${r.arParts.mag.scaled}` : undefined}>{r.ar.mag || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.fire.base}  |  Scaling: +${r.arParts.fire.scaled}` : undefined}>{r.ar.fire || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.ligh.base}  |  Scaling: +${r.arParts.ligh.scaled}` : undefined}>{r.ar.ligh || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.holy.base}  |  Scaling: +${r.arParts.holy.scaled}` : undefined}>{r.ar.holy || '–'}</td>
                      <td className="p-2 text-right font-semibold text-gold-grad er-tooltip cursor-help" data-tip={`Base AR + scaling = ${r.ar.total}`}>{r.ar.total}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.str)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.dex)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.int)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.fai)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.arc)}</td>
                      <td className="p-2 text-center text-xs">{r.dlc && <span className="text-er-gold">★</span>}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ARPage() {
  const { stats, upgradeLevel, twoHanding, buffIds, enemyId, setEnemyId, ngCycle, powerStance, critModifier, charged, includeDLC, setIncludeDLC } = useBuild();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('table');
  const [enemies, setEnemies] = useState<EnemyInfo[]>([]);
  const [compact, setCompact] = useState(false);
  const [groupByType, setGroupByType] = useState(false);
  const [effectFilter, setEffectFilter] = useState<string>('');
  const [modalWeapon, setModalWeapon] = useState<CompareRow | null>(null);

  // Table mode state
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<number | ''>('');
  const [affinityFilter, setAffinityFilter] = useState<number | ''>('');
  const [includeSpecial, setIncludeSpecial] = useState(true);
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
    body.includeDLC = includeDLC;
    api.postCompare(body)
      .then(res => setCompareRows(res.rows))
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [mode, stats, upgradeLevel, twoHanding, buffIds, weaponTypeFilter, affinityFilter, includeSpecial, includeDLC]);

  // Calc single weapon damage
  useEffect(() => {
    if (mode === 'table' || !selectedWeapon) { setResultA(null); return; }
    api.postDamage({ weaponId: selectedWeapon.id, attributes: stats, upgradeLevel, enemyId: enemyId || 'malenia', twoHanding, buffIds, ngCycle, powerStance, critModifier, charged })
      .then(setResultA)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'));
  }, [mode, selectedWeapon, stats, upgradeLevel, enemyId, twoHanding, buffIds, ngCycle, powerStance, critModifier, charged]);

  useEffect(() => {
    if (mode !== 'compare' || !compareWeapon) { setResultB(null); return; }
    api.postDamage({ weaponId: compareWeapon.id, attributes: stats, upgradeLevel, enemyId: enemyId || 'malenia', twoHanding, buffIds, ngCycle, powerStance, critModifier, charged })
      .then(setResultB)
      .catch(() => {});
  }, [mode, compareWeapon, stats, upgradeLevel, enemyId, twoHanding, buffIds, ngCycle, powerStance, critModifier, charged]);

  // Client-side filtering
  const filteredRows = useMemo(() => {
    let rows = compareRows;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }
    // DLC filtering: includeDLC checkbox hides DLC weapons, UNLESS the effect filter is explicitly "dlc only"
    if (!includeDLC && effectFilter !== 'dlc') rows = rows.filter(r => !r.dlc);
    if (hideIneffective) rows = rows.filter(r => r.ineffectiveAttributes.length === 0);
    // Effect filters (using data already present in CompareRow)
    if (effectFilter === 'paired') rows = rows.filter(r => r.paired);
    if (effectFilter === 'dlc') rows = rows.filter(r => r.dlc);
    if (effectFilter === 'special') rows = rows.filter(r => r.isSpecialWeapon);
    // Status effect filters — weapons with innate status AR
    if (effectFilter === 'bleed') rows = rows.filter(r => (r.statusAr?.bleed ?? 0) > 0);
    if (effectFilter === 'frost') rows = rows.filter(r => (r.statusAr?.frost ?? 0) > 0);
    if (effectFilter === 'poison') rows = rows.filter(r => (r.statusAr?.poison ?? 0) > 0);
    if (effectFilter === 'rot') rows = rows.filter(r => (r.statusAr?.scarletRot ?? 0) > 0);
    return rows;
  }, [compareRows, searchTerm, includeDLC, hideIneffective, effectFilter]);

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

  const displayRows = sortedRows.slice(0, limit);

  // Group by weapon type (for collapsible grouped display)
  const groupedRows = useMemo(() => {
    if (!groupByType) return null;
    const groups = new Map<string, CompareRow[]>();
    for (const r of displayRows) {
      const typeName = r.weaponTypeName;
      if (!groups.has(typeName)) groups.set(typeName, []);
      groups.get(typeName)!.push(r);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [displayRows, groupByType]);

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
            className={`px-3 py-1 rounded text-sm transition-er ${
              mode === m ? 'btn-gold' : 'bg-er-surface border border-er-border text-er-fg hover:border-er-gold card-glow'
            }`}
          >
            {m === 'table' ? '📋 Compare Table' : m === 'single' ? '⚔️ Single Weapon' : '🔁 Compare Two'}
          </button>
        ))}
        {error && <span className="text-red-400 text-sm ml-auto animate-fade-in">⚠ {error}</span>}
      </div>

      {/* ── TABLE MODE ────────────────────────────────────────────────────── */}
      {mode === 'table' && (
        <div className="bg-er-surface rounded-lg border border-er-border p-3 card-glow">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-3 items-end">
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
                onChange={e => setWeaponTypeFilter(e.target.value === '' ? '' : Number(e.target.value))}
                className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-40 transition-er focus:border-er-gold focus:outline-none"
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
                className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-40 transition-er focus:border-er-gold focus:outline-none"
              >
                <option value="">All</option>
                {affinityOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <label className="text-sm flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={includeSpecial} onChange={e => setIncludeSpecial(e.target.checked)} className="er-checkbox" />
              Special weapons
            </label>
            <label className="text-sm flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={includeDLC} onChange={e => setIncludeDLC(e.target.checked)} className="er-checkbox" />
              DLC
            </label>
            <label className="text-sm flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={hideIneffective} onChange={e => setHideIneffective(e.target.checked)} className="er-checkbox" />
              Hide ineffective
            </label>
            <div>
              <label className="text-xs text-er-muted block mb-1">Effect</label>
              <select
                value={effectFilter}
                onChange={e => setEffectFilter(e.target.value)}
                className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm w-40 transition-er focus:border-er-gold focus:outline-none"
              >
                <option value="">All weapons</option>
                <option value="paired">⚔ Paired only</option>
                <option value="bleed">🩸 Innate Bleed</option>
                <option value="frost">❄ Innate Frost</option>
                <option value="poison">☠ Innate Poison</option>
                <option value="rot">🤢 Innate Scarlet Rot</option>
                <option value="dlc">★ DLC only</option>
                <option value="special">✦ Special only</option>
              </select>
            </div>
            <label className="text-sm flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={groupByType} onChange={e => setGroupByType(e.target.checked)} className="er-checkbox" />
              📂 Group by type
            </label>
            <button
              onClick={exportCSV}
              className="ml-auto px-3 py-1 bg-er-gold/20 border border-er-gold/50 text-er-gold rounded text-sm hover:bg-er-gold/30 transition-er"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={() => setCompact(!compact)}
              className={`px-3 py-1 rounded text-sm transition-er ${compact ? 'btn-gold' : 'bg-er-surface border border-er-border text-gray-400 hover:border-er-gold'}`}
            >
              {compact ? '▦ Dense' : '▦ Normal'}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1 rounded text-sm bg-er-surface border border-er-border text-gray-400 hover:border-er-gold transition-er"
              title="Print-friendly damage report"
            >
              🖨 Report
            </button>
          </div>

          {/* Status with live filter count */}
          <div className="text-xs text-er-muted mb-2 flex items-center gap-2">
            {loading ? (
              <span className="flex items-center gap-2 text-er-accent">
                <GoldSpinner size={14} /> loading...
              </span>
            ) : (
              <span>
                Showing <span className="text-er-fg font-semibold">{Math.min(limit, sortedRows.length)}</span> of {sortedRows.length} weapons
                {searchTerm.trim() && <span className="ml-1 text-er-gold animate-fade-in">({sortedRows.length} matching "{searchTerm}")</span>}
              </span>
            )}
            {buffIds.length > 0 && <span className="ml-2 text-yellow-400 animate-fade-in">★ {buffIds.length} buff(s) active</span>}
          </div>

          {/* Table — grouped or flat */}
          {groupByType && groupedRows ? (
            <div className="overflow-x-auto">
              {groupedRows.map(([typeName, rows]) => (
                <GroupedWeaponSection key={typeName} typeName={typeName} rows={rows} compact={compact} onRowClick={setModalWeapon} />
              ))}
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="border-b border-er-border text-er-muted">
                  <th className="text-left p-2">#</th>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className={`sortable p-2 cursor-pointer ${
                        ['ar.phys', 'ar.mag', 'ar.fire', 'ar.ligh', 'ar.holy', 'ar.total',
                          'scaling.str', 'scaling.dex', 'scaling.int', 'scaling.fai', 'scaling.arc'].includes(key)
                          ? 'text-right' : 'text-left'
                      } ${sortKey === key ? 'text-er-gold' : ''}`}
                    >
                      {SORT_LABELS[key]}
                      {sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                  <th className="text-center p-2">DLC</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {displayRows.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      layout
                      custom={i}
                      onClick={() => setModalWeapon(r)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i * 0.012, 0.3) }}
                      className={`border-b border-er-border/30 hover:bg-er-gold/10 transition-er cursor-pointer ${compact ? 'text-xs' : ''} ${r.ineffectiveAttributes.length > 0 ? 'opacity-60' : ''}`}
                    >
                      <td className={compact ? 'py-0.5 px-2' : 'p-2'}>{i + 1}</td>
                      <td className={compact ? 'py-0.5 px-2 font-medium' : 'p-2 font-medium'}>{r.name}</td>
                      <td className="p-2 text-er-muted">{r.weaponTypeName}</td>
                      <td className="p-2 text-er-muted">{r.affinityName}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.phys.base}  |  Scaling: +${r.arParts.phys.scaled}` : undefined}>{r.ar.phys || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.mag.base}  |  Scaling: +${r.arParts.mag.scaled}` : undefined}>{r.ar.mag || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.fire.base}  |  Scaling: +${r.arParts.fire.scaled}` : undefined}>{r.ar.fire || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.ligh.base}  |  Scaling: +${r.arParts.ligh.scaled}` : undefined}>{r.ar.ligh || '–'}</td>
                      <td className="p-2 text-right er-tooltip cursor-help" data-tip={r.arParts ? `Base: ${r.arParts.holy.base}  |  Scaling: +${r.arParts.holy.scaled}` : undefined}>{r.ar.holy || '–'}</td>
                      <td className="p-2 text-right font-semibold text-gold-grad er-tooltip cursor-help" data-tip={`Click row for full damage breakdown vs ${enemies.find(e => e.id === enemyId)?.name ?? 'raw (no enemy)'}`}>{r.ar.total}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.str)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.dex)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.int)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.fai)}</td>
                      <td className="p-2 text-right">{scalingLetter(r.scaling.arc)}</td>
                      <td className="p-2 text-center text-xs">{r.dlc && <span className="text-er-gold">★</span>}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          )}

          {/* Load more */}
          {sortedRows.length > limit && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setLimit(limit + 100)}
                className="px-4 py-2 bg-er-surface border border-er-border rounded text-sm hover:border-er-gold transition-er card-glow"
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
          {/* Damage comparison bars */}
          {resultA && resultB && (
            <div className="lg:col-span-2 bg-er-surface rounded-lg border border-er-border p-4 card-glow animate-fade-in-up">
              <p className="font-er text-gold-grad mb-2">Damage Comparison Bars</p>
              <DamageCompareBars resultA={resultA} resultB={resultB} nameA={selectedWeapon?.name ?? 'A'} nameB={compareWeapon?.name ?? 'B'} />
            </div>
          )}
        </div>
      )}

      {/* ── WEAPON DETAIL MODAL ────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalWeapon && (
          <motion.div
            key="weapon-modal"
            onClick={() => setModalWeapon(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-er-surface rounded-lg border border-er-border p-6 max-w-md w-full mx-4 card-glow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-er text-lg text-gold-grad">{modalWeapon.name}</h3>
                <button onClick={() => setModalWeapon(null)} className="text-gray-400 hover:text-er-gold transition-er text-xl">✕</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex gap-4">
                  <span className="text-er-muted">Type: <span className="text-er-fg">{modalWeapon.weaponTypeName}</span></span>
                  <span className="text-er-muted">Affinity: <span className="text-er-fg">{modalWeapon.affinityName}</span></span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-er-bg rounded p-2 text-center"><div className="text-xs text-er-muted">PHYS</div><div className="font-semibold">{modalWeapon.ar.phys || '–'}</div></div>
                  <div className="bg-er-bg rounded p-2 text-center"><div className="text-xs text-er-muted">MAG</div><div className="font-semibold">{modalWeapon.ar.mag || '–'}</div></div>
                  <div className="bg-er-bg rounded p-2 text-center"><div className="text-xs text-er-muted">FIRE</div><div className="font-semibold">{modalWeapon.ar.fire || '–'}</div></div>
                  <div className="bg-er-bg rounded p-2 text-center"><div className="text-xs text-er-muted">LIGH</div><div className="font-semibold">{modalWeapon.ar.ligh || '–'}</div></div>
                  <div className="bg-er-bg rounded p-2 text-center"><div className="text-xs text-er-muted">HOLY</div><div className="font-semibold">{modalWeapon.ar.holy || '–'}</div></div>
                </div>
                <div className="bg-er-gold/20 rounded p-2 text-center border border-er-gold/30"><div className="text-xs text-er-muted">Total AR</div><div className="font-semibold text-gold-grad text-lg">{modalWeapon.ar.total}</div></div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="text-center"><div className="text-xs text-er-muted">STR</div><div className="font-semibold">{scalingLetter(modalWeapon.scaling.str)}</div></div>
                  <div className="text-center"><div className="text-xs text-er-muted">DEX</div><div className="font-semibold">{scalingLetter(modalWeapon.scaling.dex)}</div></div>
                  <div className="text-center"><div className="text-xs text-er-muted">INT</div><div className="font-semibold">{scalingLetter(modalWeapon.scaling.int)}</div></div>
                  <div className="text-center"><div className="text-xs text-er-muted">FAI</div><div className="font-semibold">{scalingLetter(modalWeapon.scaling.fai)}</div></div>
                  <div className="text-center"><div className="text-xs text-er-muted">ARC</div><div className="font-semibold">{scalingLetter(modalWeapon.scaling.arc)}</div></div>
                </div>
                <div className="flex gap-4 text-xs text-er-muted">
                  {modalWeapon.dlc && <span className="text-er-gold">★ DLC</span>}
                  {modalWeapon.paired && <span>⚔ Paired Weapon</span>}
                  {modalWeapon.isSpecialWeapon && <span>✦ Special</span>}
                  {modalWeapon.ineffectiveAttributes.length > 0 && <span className="text-yellow-400">⚠ Ineffective: {modalWeapon.ineffectiveAttributes.join(', ')}</span>}
                </div>
                {/* Jump to AoW rank page */}
                <button
                  onClick={() => { setModalWeapon(null); navigate('/aow'); }}
                  className="mt-4 w-full px-3 py-2 rounded bg-er-gold/20 border border-er-gold/50 text-er-gold text-sm font-medium hover:bg-er-gold/30 transition-er"
                >
                  View in AoW Ranking →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Print-only damage report (visible only during window.print()) ──── */}
      <div className="print-report hidden print:block">
        <h1 className="font-er text-2xl mb-4">⚔ Elden Ring — Damage Report</h1>
        <section className="mb-4">
          <h2 className="font-er text-lg border-b border-er-border pb-1 mb-2">Character Build</h2>
          <p>Rune Level: <strong>{Object.values(stats).reduce((a, b) => a + b, 0) - 79}</strong></p>
          <table>
            <thead><tr><th>VIG</th><th>MND</th><th>END</th><th>STR</th><th>DEX</th><th>INT</th><th>FAI</th><th>ARC</th></tr></thead>
            <tbody><tr>
              <td>{stats.vigor}</td><td>{stats.mind}</td><td>{stats.endurance}</td>
              <td>{stats.str}</td><td>{stats.dex}</td><td>{stats.int}</td><td>{stats.fai}</td><td>{stats.arc}</td>
            </tr></tbody>
          </table>
          <p className="mt-2 text-xs">
            Upgrade +{upgradeLevel} · {twoHanding ? 'Two-Handing' : 'One-Handing'}
            {powerStance && ' · Power Stance'}{charged && ' · Charged'} · Crit: ×{critModifier} · NG+{ngCycle}
            {buffIds.length > 0 && ` · Buffs: ${buffIds.join(', ')}`}
          </p>
        </section>

        <section className="mb-4">
          <h2 className="font-er text-lg border-b border-er-border pb-1 mb-2">Enemy Target</h2>
          <p>{enemies.find(e => e.id === enemyId)?.name ?? enemyId}</p>
        </section>

        {(resultA || mode === 'table') && (
          <section className="mb-4">
            <h2 className="font-er text-lg border-b border-er-border pb-1 mb-2">
              {mode === 'table' ? 'Top 10 Weapons' : 'Weapon Damage Breakdown'}
            </h2>
            {mode === 'table' ? (
              <table>
                <thead><tr><th>#</th><th>Name</th><th>Type</th><th>Affinity</th><th>Total AR</th></tr></thead>
                <tbody>
                  {sortedRows.slice(0, 10).map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td><td>{r.name}</td><td>{r.weaponTypeName}</td>
                      <td>{r.affinityName}</td><td>{r.ar.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : resultA && (
              <div>
                <h3 className="font-er text-base mb-1">{resultA.weapon.name}</h3>
                <p>Total AR: {resultA.totalAR} · Total Damage: {Math.round(resultA.enemyDamageTotal)}</p>
                <table className="mt-2">
                  <thead><tr><th>Type</th><th>Base AR</th><th>Scaling</th><th>Total AR</th><th>Enemy Damage</th></tr></thead>
                  <tbody>
                    {Object.entries(resultA.enemyDamages).map(([k, v]) => {
                      const ap = resultA.attackPower[Number(k)];
                      return (
                        <tr key={k}>
                          <td>{DMG_NAMES[Number(k)] || k}</td>
                          <td>{ap?.weapon ?? 0}</td><td>{ap?.scaled ?? 0}</td>
                          <td>{ap?.total ?? 0}</td><td>{Math.round(v)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {mode === 'compare' && resultB && (
          <section className="mb-4">
            <h2 className="font-er text-lg border-b border-er-border pb-1 mb-2">Weapon B: {compareWeapon?.name ?? ''}</h2>
            <p>Total AR: {resultB.totalAR} · Total Damage: {Math.round(resultB.enemyDamageTotal)}</p>
          </section>
        )}

        <p className="text-xs mt-6 text-gray-500">
          Generated by Elden Ring AoW Calculator · {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── Damage comparison bars ────────────────────────────────────────────────────
function DamageCompareBars({ resultA, resultB, nameA, nameB }: {
  resultA: DamageResponse;
  resultB: DamageResponse;
  nameA: string;
  nameB: string;
}) {
  const totalA = Math.round(resultA.enemyDamageTotal);
  const totalB = Math.round(resultB.enemyDamageTotal);
  const maxTotal = Math.max(totalA, totalB, 1);
  const winner = totalA >= totalB ? 'A' : 'B';
  const diff = Math.abs(totalA - totalB);
  const pct = (Math.round((Math.min(totalA, totalB) / Math.max(totalA, totalB)) * 1000) / 10);

  return (
    <div className="space-y-4">
      {/* Total damage bars */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={winner === 'A' ? 'text-er-gold font-semibold' : 'text-gray-400'}>
            {winner === 'A' ? '👑 ' : ''}{nameA}
          </span>
          <span className={winner === 'A' ? 'text-er-gold font-bold' : 'text-gray-400'}>
            <CountUp value={totalA} />
          </span>
        </div>
        <div className="h-6 bg-er-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${(totalA / maxTotal) * 100}%`,
              background: winner === 'A' ? 'var(--er-gold-grad)' : 'var(--er-border)',
              boxShadow: winner === 'A' ? 'var(--er-glow)' : 'none',
            }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={winner === 'B' ? 'text-er-gold font-semibold' : 'text-gray-400'}>
            {winner === 'B' ? '👑 ' : ''}{nameB}
          </span>
          <span className={winner === 'B' ? 'text-er-gold font-bold' : 'text-gray-400'}>
            <CountUp value={totalB} />
          </span>
        </div>
        <div className="h-6 bg-er-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${(totalB / maxTotal) * 100}%`,
              background: winner === 'B' ? 'var(--er-gold-grad)' : 'var(--er-border)',
              boxShadow: winner === 'B' ? 'var(--er-glow)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Comparison stats */}
      <div className="flex items-center justify-between text-xs text-er-muted border-t border-er-border pt-2">
        <span>
          <span className="text-er-gold font-semibold">{winner === 'A' ? nameA : nameB}</span> wins by{' '}
          <span className="text-er-gold">{diff.toLocaleString()} HP</span>
        </span>
        <span>Loser deals <span className="text-er-fg">{pct}%</span> of winner's damage</span>
      </div>
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
    <div className="bg-er-surface rounded-lg border border-er-border p-3 card-glow">
      <label className="text-sm font-semibold block mb-2">{label}</label>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search weapons..."
        className="w-full px-3 py-2 mb-2 bg-er-bg border border-er-border rounded text-sm transition-er focus:border-er-gold focus:outline-none"
      />
      {search.trim() && (
        <p className="text-xs text-er-muted mb-1 animate-fade-in">{filtered.length} weapons matching "{search}"</p>
      )}
      {selected && (
        <div className="text-sm mb-2 p-2 bg-er-gold/10 border border-er-gold/30 rounded animate-fade-in">
          <span className="font-semibold text-er-gold">{selected.name}</span>
          <span className="text-er-muted"> — {selected.weaponTypeName} / {selected.affinityName || 'Unique'}</span>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto border border-er-border rounded">
        {filtered.map((w, i) => (
          <div
            key={w.id}
            onClick={() => onSelect(w)}
            className={`row-stagger p-2 cursor-pointer border-b border-er-border/30 text-sm transition-er hover:bg-er-gold/5 ${
              selected?.id === w.id ? 'bg-er-gold/20' : ''
            }`}
            style={{ animationDelay: `${Math.min(i * 10, 300)}ms` }}
          >
            <span className="font-medium">{w.name}</span>
            <span className="text-er-muted text-xs ml-2">{w.weaponTypeName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Damage panel with enemy stats card + count-up ──────────────────────────────
function DamagePanel({ result, enemyId, enemies, onEnemyChange }: {
  result: DamageResponse;
  enemyId: string;
  enemies: EnemyInfo[];
  onEnemyChange: (id: string) => void;
}) {
  const selectedEnemy = enemies.find(e => e.id === enemyId);

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4 space-y-3 card-glow animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h3 className="font-er text-lg text-gold-grad">{result.weapon.name}</h3>
        <span className="text-er-muted text-sm">{result.weapon.weaponType} / {result.weapon.affinityName}</span>
      </div>

      {/* Enemy selector + stats card */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-er-muted">Enemy:</label>
          <select
            value={enemyId}
            onChange={e => onEnemyChange(e.target.value)}
            className="px-2 py-1 bg-er-bg border border-er-border rounded text-sm transition-er focus:border-er-gold focus:outline-none"
          >
            {enemies.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        {/* Enemy stats compact card — properly labeled absorption */}
        {selectedEnemy && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-er-muted bg-er-bg rounded px-3 py-1.5 border border-er-border animate-fade-in">
            {result.enemy.hp && (
              <span>❤️ HP: <span className="text-er-fg font-semibold">
                {result.enemy.hp.toLocaleString()}
                {result.enemy.ngCycle ? ` (NG+${result.enemy.ngCycle})` : ''}
              </span></span>
            )}
            <span>🛡️ Def: <span className="text-er-fg">
              {[
                selectedEnemy.defence[0] != null && `PHYS ${Math.round(selectedEnemy.defence[0] * (1 + (result.enemy.ngCycle ?? 0) * 0.01))}`,
                selectedEnemy.defence[1] != null && `MAG ${Math.round(selectedEnemy.defence[1] * (1 + (result.enemy.ngCycle ?? 0) * 0.01))}`,
                selectedEnemy.defence[2] != null && `FIRE ${Math.round(selectedEnemy.defence[2] * (1 + (result.enemy.ngCycle ?? 0) * 0.01))}`,
                selectedEnemy.defence[3] != null && `LIGH ${Math.round(selectedEnemy.defence[3] * (1 + (result.enemy.ngCycle ?? 0) * 0.01))}`,
                selectedEnemy.defence[4] != null && `HOLY ${Math.round(selectedEnemy.defence[4] * (1 + (result.enemy.ngCycle ?? 0) * 0.01))}`,
              ].filter(Boolean).join(' / ')}
            </span></span>
            <span>🟫 Abs: <span className="text-er-fg">
              {[
                selectedEnemy.absorption[0] != null && `PHYS ${selectedEnemy.absorption[0]}%`,
                selectedEnemy.absorption[1] != null && `MAG ${selectedEnemy.absorption[1]}%`,
                selectedEnemy.absorption[2] != null && `FIRE ${selectedEnemy.absorption[2]}%`,
                selectedEnemy.absorption[3] != null && `LIGH ${selectedEnemy.absorption[3]}%`,
                selectedEnemy.absorption[4] != null && `HOLY ${selectedEnemy.absorption[4]}%`,
              ].filter(Boolean).join(' / ')}
            </span></span>
          </div>
        )}
      </div>

      {/* AR breakdown */}
      <div>
        <div className="text-xs uppercase text-er-muted mb-1 font-er">Attack Rating</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(result.attackPower).map(([k, v]) => (
            v && (
              <div key={k} className="bg-er-bg rounded p-2 text-center card-glow">
                <div className="text-xs text-er-muted">{DMG_NAMES[Number(k)] || k}</div>
                <div
                  className="font-semibold er-tooltip cursor-help inline-block"
                  data-tip={`Base: ${v.weapon}  |  Scaling: +${v.scaled}  |  Total: ${v.total}`}
                >
                  <CountUp value={v.total} />
                </div>
              </div>
            )
          ))}
          <div className="bg-er-gold/20 rounded p-2 text-center col-span-5 border border-er-gold/30">
            <div className="text-xs text-er-muted">Total AR</div>
            <div className="font-semibold text-gold-grad text-lg"><CountUp value={result.totalAR} /></div>
          </div>
        </div>
      </div>

      {/* Enemy damage */}
      <div>
        <div className="text-xs uppercase text-er-muted mb-1 font-er">Damage vs {result.enemy.name}</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(result.enemyDamages).map(([k, v]) => {
            const dmgKey = Number(k);
            const ap = result.attackPower[dmgKey];
            const arTotal = ap?.total ?? 0;
            const absorbed = Math.round(v);
            const tooltipParts = [
              `Base AR: ${ap?.weapon ?? 0}`,
              `Scaling: +${ap?.scaled ?? 0}`,
              `Buffed AR: ${arTotal}`,
            ];
            if (selectedEnemy) {
              const defIdx = [0, 1, 2, 3, 4].indexOf(dmgKey);
              const defVal = defIdx >= 0 ? selectedEnemy.defence[defIdx] : null;
              const absVal = defIdx >= 0 ? selectedEnemy.absorption[defIdx] : null;
              if (defVal != null) tooltipParts.push(`Def: −${Math.round(defVal * (1 + (result.enemy.ngCycle ?? 0) * 0.01))}`);
              if (absVal != null) tooltipParts.push(`Abs: ${absVal}% reduction`);
            }
            tooltipParts.push(`Final: ${absorbed}`);
            return (
              <div key={k} className="bg-er-bg rounded p-2 text-center card-glow">
                <div className="text-xs text-er-muted">{DMG_NAMES[dmgKey] || k}</div>
                <div
                  className="font-semibold er-tooltip cursor-help inline-block"
                  data-tip={tooltipParts.join('  |  ')}
                >
                  <CountUp value={absorbed} />
                </div>
              </div>
            );
          })}
          <div className="bg-red-900/30 rounded p-2 text-center col-span-5 border border-red-700/30">
            <div className="text-xs text-er-muted">Total Damage</div>
            <div
              className="font-semibold text-red-300 text-lg er-tooltip cursor-help inline-block"
              data-tip={`Sum of all per-type damage after defence & absorption`}
            >
              <CountUp value={Math.round(result.enemyDamageTotal)} />
            </div>
          </div>
        </div>
      </div>

      {/* Active buffs */}
      {result.activeBuffs && result.activeBuffs.length > 0 && (
        <div className="flex flex-wrap gap-1 animate-fade-in">
          <span className="text-xs text-yellow-500">Active:</span>
          {result.activeBuffs.map(b => (
            <span key={b.id} className="text-xs px-2 py-0.5 bg-yellow-900/30 border border-yellow-700/40 rounded text-yellow-300 animate-slide-in-left">
              {b.name}
            </span>
          ))}
        </div>
      )}

      {/* Status effect procs */}
      {result.statusProcs && result.statusProcs.length > 0 && (
        <div className="animate-fade-in">
          <div className="text-xs uppercase text-er-muted mb-1 font-er">Status Effects</div>
          <div className="space-y-1.5">
            {result.statusProcs.map(sp => {
              const colors: Record<number, string> = {
                5: 'bg-green-900/30 border-green-700/40 text-green-300',
                6: 'bg-orange-900/30 border-orange-700/40 text-orange-300',
                7: 'bg-red-900/30 border-red-700/40 text-red-300',
                8: 'bg-blue-900/30 border-blue-700/40 text-blue-300',
                9: 'bg-purple-900/30 border-purple-700/40 text-purple-300',
                10: 'bg-pink-900/30 border-pink-700/40 text-pink-300',
              };
              const barColor: Record<number, string> = {
                5: 'bg-green-500', 6: 'bg-orange-500', 7: 'bg-red-500', 8: 'bg-blue-500',
              };
              const isInf = !isFinite(sp.hitsToProc);
              const progress = isInf ? 0 : Math.min(100, (sp.perHit / sp.threshold) * 100);
              return (
                <div key={sp.type} className={`rounded border px-3 py-1.5 text-xs ${colors[sp.type] ?? 'bg-gray-900/30 border-gray-700/40 text-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{sp.name}</span>
                    <span>{sp.perHit}/hit → {isInf ? '∞' : `${sp.hitsToProc} hits to proc`} (resist: {sp.threshold})</span>
                  </div>
                  <div className="h-1 bg-er-bg rounded-full overflow-hidden mt-1">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor[sp.type] ?? 'bg-gray-500'}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Requirement warnings */}
      {result.ineffectiveAttributes.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded p-2 text-xs text-yellow-300 animate-fade-in">
          ⚠ Effective attributes too low for: {result.ineffectiveAttributes.join(', ')}
        </div>
      )}
    </div>
  );
}

// ── End of file — DamageCompare removed (was unused after compare-mode UI refactor)
