/** Loadout Planner page — weapon + AoW + talismans + physick + buffs summary. */
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBuild } from '../App';
import { api, type AshOfWarInfo, type BuffInfo } from '../api';
import { TALISMANS, getStackingInfo, type Talisman } from '../data/talismans';

const PHYSICK_TEARS = [
  { id: 'none', name: 'None' },
  { id: 'magic-shrouding', name: 'Magic-Shrouding Cracked Tear' },
  { id: 'fire-shrouding', name: 'Fire-Shrouding Cracked Tear' },
  { id: 'light-shrouding', name: 'Lightning-Shrouding Cracked Tear' },
  { id: 'holy-shrouding', name: 'Holy-Shrouding Cracked Tear' },
  { id: 'spiky', name: 'Spiky Cracked Tear' },
  { id: 'greenburst', name: 'Greenburst Cracked Tear' },
  { id: 'crimson', name: 'Crimson Cracked Tear' },
  { id: 'cobalt', name: 'Cobalt Cracked Tear' },
  { id: 'russet', name: 'Russet Cracked Tear' },
];

export function LoadoutPage() {
  const { stats, upgradeLevel } = useBuild();
  const [ashes, setAshes] = useState<AshOfWarInfo[]>([]);
  const [buffs, setBuffs] = useState<BuffInfo[]>([]);
  const [selectedAsh, setSelectedAsh] = useState<number | null>(null);
  const [talismanSlots, setTalismanSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [physick, setPhysick] = useState('none');

  useEffect(() => {
    api.getAshes().then(setAshes).catch(() => {});
    api.getBuffs().then(setBuffs).catch(() => {});
  }, []);

  const selectedTalismans = useMemo(() => {
    return talismanSlots
      .map(id => TALISMANS.find(t => t.id === id))
      .filter((t): t is Talisman => t !== undefined);
  }, [talismanSlots]);

  const stacking = useMemo(() => getStackingInfo(selectedTalismans), [selectedTalismans]);

  // Rough effective AR estimate
  const baseAR = useMemo(() => {
    if (!stats) return 0;
    const str = stats.str ?? 10, dex = stats.dex ?? 10, int = stats.int ?? 10, fai = stats.fai ?? 10, arc = stats.arc ?? 10;
    const maxStat = Math.max(str, dex, int, fai, arc);
    return Math.round(100 + maxStat * 3.5 + upgradeLevel * 4);
  }, [stats, upgradeLevel]);

  const effectiveAR = useMemo(() => {
    let mult = 1.0;
    for (const t of selectedTalismans) {
      if (t.damageMult) mult *= t.damageMult;
      if (t.damageTypeMult) for (const v of Object.values(t.damageTypeMult)) mult *= v;
    }
    if (physick === 'spiky') mult *= 1.15;
    return Math.round(baseAR * mult);
  }, [baseAR, selectedTalismans, physick]);

  const totalPoise = useMemo(() => {
    let poise = 10 + (stats?.endurance ?? 20) * 0.2;
    if (selectedTalismans.some(t => t.id === 'dragoncrest-greatshield')) poise += 3;
    return Math.round(poise * 10) / 10;
  }, [stats, selectedTalismans]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-er text-gold-grad">Loadout Planner</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Selections */}
        <div className="space-y-4">
          <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
            <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-2">Ash of War</p>
            <select
              value={selectedAsh ?? ''}
              onChange={e => setSelectedAsh(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none"
            >
              <option value="">None</option>
              {ashes.map(a => <option key={a.id} value={a.id}>{a.name} {a.isProjectile ? '🔸' : ''}</option>)}
            </select>
            {selectedAsh !== null && (() => {
              const ash = ashes.find(a => a.id === selectedAsh);
              return ash?.description ? <p className="text-xs text-gray-500 mt-1 italic">{ash.description}</p> : null;
            })()}
          </div>

          <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
            <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-2">Talisman Slots</p>
            <div className="space-y-2">
              {talismanSlots.map((slotId, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-6">{idx + 1}.</span>
                  <select
                    value={slotId ?? ''}
                    onChange={e => { const next = [...talismanSlots]; next[idx] = e.target.value || null; setTalismanSlots(next); }}
                    className="flex-1 bg-er-bg border border-er-border rounded px-2 py-1 text-xs text-gray-300 transition-er focus:border-er-gold focus:outline-none"
                  >
                    <option value="">Empty</option>
                    {TALISMANS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {slotId && <button onClick={() => { const n = [...talismanSlots]; n[idx] = null; setTalismanSlots(n); }} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
            <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-2">Wonderous Physick</p>
            <select value={physick} onChange={e => setPhysick(e.target.value)} className="w-full bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none">
              {PHYSICK_TEARS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* Right: Summary + Stacking */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-er-surface rounded-lg border border-er-gold/30 p-4 card-glow">
            <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Summary</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Effective AR</span>
                <motion.span key={effectiveAR} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-2xl font-bold text-gray-100">{effectiveAR}</motion.span>
              </div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Base AR (est.)</span><span className="text-lg text-gray-300">{baseAR}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Poise</span><span className="text-lg text-gray-300">{totalPoise}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Upgrade Level</span><span className="text-lg text-gray-300">+{upgradeLevel}</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Talismans</span><span className="text-lg text-gray-300">{selectedTalismans.length}/4</span></div>
              <div className="flex items-center justify-between"><span className="text-sm text-gray-400">Physick</span><span className="text-sm text-gray-300">{PHYSICK_TEARS.find(t => t.id === physick)?.name ?? 'None'}</span></div>
            </div>
          </motion.div>

          {selectedTalismans.length > 0 && (
            <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
              <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Stacking</p>
              <div className="space-y-2">
                {selectedTalismans.map(t => {
                  const isConflicting = stacking.conflicts.includes(t.name);
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 ${isConflicting ? 'bg-red-900/20 border border-red-900/40' : 'bg-green-900/20 border border-green-900/30'}`}>
                      <span className={isConflicting ? 'text-red-400' : 'text-green-300'}>{isConflicting ? '⚠' : '✓'}</span>
                      <span className="text-gray-300">{t.name}</span>
                      <span className="text-gray-600 ml-auto truncate">{t.effect}</span>
                    </motion.div>
                  );
                })}
                {stacking.conflicts.length > 0 && <p className="text-xs text-red-400 mt-1">⚠ {stacking.conflicts.length} talisman(s) conflict — only one of each type applies.</p>}
              </div>
            </div>
          )}

          {/* Active buffs list */}
          <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
            <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-2">Available Buffs</p>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {buffs.slice(0, 12).map(b => <span key={b.id} className="text-xs bg-er-bg border border-er-border rounded px-2 py-1 text-gray-400">{b.name}</span>)}
            </div>
            <p className="text-xs text-gray-600 mt-2">Toggle buffs in the sidebar →</p>
          </div>
        </div>
      </div>
    </div>
  );
}
