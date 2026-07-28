/** Versus comparison mode + survival estimator. */
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useBuild } from '../App';
import { api, type EnemyInfo, type DamageResponse } from '../api';

const DMG_NAMES: Record<number, string> = {
  0: 'Phys', 1: 'Magic', 2: 'Fire', 3: 'Ligh', 4: 'Holy',
  5: 'Poison', 6: 'Rot', 7: 'Bleed', 8: 'Frost',
};

export function VersusPage() {
  const { stats, upgradeLevel, twoHanding, buffIds, enemyId, ngCycle } = useBuild();
  const [enemies, setEnemies] = useState<EnemyInfo[]>([]);
  const [enemyA, setEnemyA] = useState('');
  const [enemyB, setEnemyB] = useState('');
  const [dmgA, setDmgA] = useState<DamageResponse | null>(null);
  const [dmgB, setDmgB] = useState<DamageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // Survival estimator
  const [incomingDmg, setIncomingDmg] = useState(500);

  useEffect(() => { api.getEnemies().then(setEnemies).catch(() => {}); }, []);

  // Player HP estimate: base 400 + vigor*20 + endurance*5
  const playerHP = useMemo(() => {
    const vig = stats?.vigor ?? 10;
    const end = stats?.endurance ?? 10;
    return Math.round(400 + vig * 20 + end * 5);
  }, [stats]);

  const hitsToDie = Math.ceil(playerHP / Math.max(incomingDmg, 1));

  const runComparison = async () => {
    if (!enemyA && !enemyB) return;
    setLoading(true);
    try {
      const body = { stats, upgradeLevel, twoHanding, buffIds, ngCycle };
      if (enemyA) {
        const res = await api.postDamage({ ...body, enemyId: enemyA }) as DamageResponse;
        setDmgA(res);
      }
      if (enemyB) {
        const res = await api.postDamage({ ...body, enemyId: enemyB }) as DamageResponse;
        setDmgB(res);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { if (enemyA || enemyB) runComparison(); }, [enemyA, enemyB, stats, upgradeLevel, twoHanding, buffIds, ngCycle]);

  const renderEnemyCard = (label: string, eid: string, dmg: DamageResponse | null) => {
    const enemy = enemies.find(e => e.id === eid);
    if (!eid) return (
      <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow flex-1">
        <p className="text-sm text-gray-500">Select {label} enemy</p>
      </div>
    );
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-er-surface rounded-lg border border-er-border p-4 card-glow flex-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500">{label}</p>
            <h3 className="font-er text-lg text-gold-grad">{enemy?.name ?? eid}</h3>
          </div>
          {enemy?.hp && <span className="text-xs text-gray-500">HP: {Math.round(enemy.hp * (1 + ngCycle * 0.1)).toLocaleString()}</span>}
        </div>
        {/* Absorption */}
        {enemy?.absorption && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 uppercase mb-1">Absorption</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(enemy.absorption).map(([k, v]) => (
                <span key={k} className={`text-xs rounded px-1.5 py-0.5 ${v < 0 ? 'bg-green-900/30 text-green-300' : v > 0 ? 'bg-red-900/30 text-red-300' : 'bg-er-bg text-gray-400'}`}>
                  {DMG_NAMES[Number(k)] ?? k}: {(v * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Damage result */}
        {dmg && (
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Your Damage</p>
            <div className="space-y-1">
              {dmg.enemyDamages && Object.entries(dmg.enemyDamages).filter(([, v]) => v > 0).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-12">{DMG_NAMES[Number(k)] ?? k}</span>
                  <div className="flex-1 h-2 bg-er-bg rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: 'var(--er-gold-grad)' }} initial={{ width: 0 }} animate={{ width: `${(v / (dmg.enemyDamageTotal || 1)) * 100}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <span className="text-xs text-gray-300 w-12 text-right">{v.toFixed(0)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-er-border">
                <span className="text-sm text-gray-400">Total per hit</span>
                <span className="text-lg font-semibold text-gold-grad">{dmg.enemyDamageTotal?.toFixed(1) ?? '—'}</span>
              </div>
              {enemy?.hp && dmg.enemyDamageTotal && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Hits to kill</span>
                  <span className="text-lg text-red-300">{Math.ceil((enemy.hp * (1 + ngCycle * 0.1)) / dmg.enemyDamageTotal)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-er text-gold-grad">Versus Comparison</h2>

      {/* Enemy selectors */}
      <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Enemy A</label>
            <select value={enemyA} onChange={e => setEnemyA(e.target.value)} className="w-full bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none">
              <option value="">Select enemy A...</option>
              {enemies.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Enemy B</label>
            <select value={enemyB} onChange={e => setEnemyB(e.target.value)} className="w-full bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none">
              <option value="">Select enemy B...</option>
              {enemies.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="flex flex-col md:flex-row gap-4">
        {renderEnemyCard('A', enemyA, dmgA)}
        {renderEnemyCard('B', enemyB, dmgB)}
      </div>

      {/* Survival Estimator */}
      <div className="bg-er-surface rounded-lg border border-er-gold/30 p-4 card-glow">
        <h3 className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Survival Estimator</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Incoming Damage per Hit</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={incomingDmg} onChange={e => setIncomingDmg(Math.max(1, parseInt(e.target.value) || 0))} className="flex-1 bg-er-bg border border-er-border rounded px-3 py-1.5 text-sm text-gray-200 transition-er focus:border-er-gold focus:outline-none" />
                <span className="text-xs text-gray-500">DMG</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Your HP (est.)</span>
              <span className="text-lg text-gray-200 font-semibold">{playerHP.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Hits to Die</span>
              <motion.span key={hitsToDie} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={`text-3xl font-bold ${hitsToDie <= 2 ? 'text-red-400' : hitsToDie <= 5 ? 'text-orange-300' : 'text-green-300'}`}>
                {hitsToDie}
              </motion.span>
            </div>
          </div>
          {/* Health bar visual */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Health Bar Simulation ({hitsToDie} hits)</p>
            <div className="space-y-1">
              {Array.from({ length: Math.min(hitsToDie, 10) }, (_, i) => {
                const remaining = Math.max(0, playerHP - i * incomingDmg);
                const pct = (remaining / playerHP) * 100;
                return (
                  <motion.div key={i} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: i * 0.05 }} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-8">H{i + 1}</span>
                    <div className="flex-1 h-4 bg-er-bg rounded overflow-hidden border border-er-border">
                      <motion.div className="h-full rounded" style={{ background: pct > 60 ? 'linear-gradient(90deg, #22aa44, #44cc66)' : pct > 30 ? 'linear-gradient(90deg, #cc8822, #ddaa44)' : 'linear-gradient(90deg, #cc3333, #dd5555)' }} animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{remaining.toFixed(0)}</span>
                  </motion.div>
                );
              })}
              {hitsToDie > 10 && <p className="text-xs text-gray-600 text-center">... and {hitsToDie - 10} more hits</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
