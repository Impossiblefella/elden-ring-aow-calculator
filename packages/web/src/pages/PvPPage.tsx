/**
 * PvPPage.tsx — PvP Damage Calculator
 *
 * Uses the flat-355-defense PvP formula (patch 1.09+) to compute outgoing
 * damage against a hypothetical PvP player. Shows per-hit damage, hits-to-kill,
 * and status proc contributions.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBuild } from '../App';
import { api, type PvPDamageResponse, type WeaponListItem } from '../api';

const DMG_NAMES: Record<number, string> = {
  0: 'Physical', 1: 'Magic', 2: 'Fire', 3: 'Lightning', 4: 'Holy',
};

const STATUS_NAMES: Record<string, string> = {
  bleed: 'Bleed', frost: 'Frost', poison: 'Poison', scarletRot: 'Scarlet Rot',
};

// PvP meta RL presets
const RL_PRESETS = [
  { label: 'RL125 (Meta)', hp: 1900, absorption: { 0: 15, 1: 10, 2: 10, 3: 15, 4: 10 } },
  { label: 'RL150 (High)', hp: 2100, absorption: { 0: 20, 1: 15, 2: 15, 3: 20, 4: 15 } },
  { label: 'RL60 (Low)', hp: 1450, absorption: {} as Record<number, number> },
  { label: 'RL200 (Max)', hp: 2200, absorption: { 0: 25, 1: 20, 2: 20, 3: 25, 4: 20 } },
];

export function PvPPage() {
  const { weapons, stats, upgradeLevel, twoHanding, buffIds, powerStance, critModifier, charged, pvpTargetHp, setPvpTargetHp } = useBuild();
  const [selectedWeaponId, setSelectedWeaponId] = useState<number | null>(null);
  const [result, setResult] = useState<PvPDamageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [presetIdx, setPresetIdx] = useState(0);
  const [targetAbsorption, setTargetAbsorption] = useState<Record<number, number>>(RL_PRESETS[0].absorption);

  const filteredWeapons = useMemo(() => {
    if (!search) return weapons;
    const s = search.toLowerCase();
    return weapons.filter(w => w.name.toLowerCase().includes(s));
  }, [weapons, search]);

  useEffect(() => {
    if (!selectedWeaponId) return;
    setLoading(true);
    setError(null);
    api.postPvpDamage({
      weaponId: selectedWeaponId,
      attributes: stats,
      upgradeLevel,
      twoHanding,
      buffIds,
      powerStance,
      critModifier,
      charged,
      targetHp: pvpTargetHp,
      targetAbsorption,
    })
      .then(r => setResult(r))
      .catch(e => setError(e.message || 'Failed to compute PvP damage'))
      .finally(() => setLoading(false));
  }, [selectedWeaponId, stats, upgradeLevel, twoHanding, buffIds, powerStance, critModifier, charged, pvpTargetHp, targetAbsorption]);

  const applyPreset = (idx: number) => {
    setPresetIdx(idx);
    const p = RL_PRESETS[idx];
    setPvpTargetHp(p.hp);
    setTargetAbsorption(p.absorption);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-lg border border-er-border p-5 card-glow"
      >
        <h2 className="text-xl font-er text-gold-grad mb-1">⚔ PvP Damage Calculator</h2>
        <p className="text-xs text-gray-400">
          Uses the flat 355-defense PvP formula (patch 1.09+). Damage is reduced by ~15%,
          status buildup is quartered (0.25×). Select a weapon to see per-hit damage,
          hits-to-kill, and status proc contributions against a PvP player.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        {/* Weapon picker */}
        <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-er text-gold-grad uppercase tracking-wide">Select Weapon</p>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="px-2 py-1 bg-er-bg border border-er-border rounded text-xs text-gray-300 transition-er focus:border-er-gold focus:outline-none w-32"
            />
          </div>
          <div className="space-y-1 max-h-[500px] overflow-y-auto er-scroll">
            {filteredWeapons.slice(0, 200).map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWeaponId(w.id)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-er ${
                  selectedWeaponId === w.id
                    ? 'bg-er-gold/20 border border-er-gold/50 text-er-gold'
                    : 'hover:bg-er-border/20 text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                <span className="font-medium">{w.name}</span>
                <span className="text-gray-600 ml-2">{w.weaponTypeName}</span>
                {w.dlc && <span className="text-er-gold/60 ml-1">★</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {!selectedWeaponId && (
            <div className="bg-er-surface rounded-lg border border-er-border p-8 text-center text-gray-500 card-glow">
              ← Select a weapon to calculate PvP damage
            </div>
          )}

          {loading && (
            <div className="bg-er-surface rounded-lg border border-er-border p-8 text-center card-glow">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block text-er-gold text-2xl"
              >⟳</motion.div>
              <p className="text-xs text-gray-400 mt-2">Computing PvP damage...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-4 text-red-400 text-sm">
              ⚠ {error}
            </div>
          )}

          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Target config */}
              <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
                <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Target (PvP Player)</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {RL_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => applyPreset(i)}
                      className={`text-xs px-3 py-1 rounded transition-er ${
                        presetIdx === i
                          ? 'btn-gold text-[#1a1a1a]'
                          : 'bg-er-bg border border-er-border text-gray-400 hover:border-er-gold'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400 w-20">Target HP</span>
                  <input
                    type="range"
                    min={1000}
                    max={2500}
                    step={50}
                    value={pvpTargetHp}
                    onChange={e => setPvpTargetHp(parseInt(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, var(--er-gold) ${((pvpTargetHp - 1000) / 1500) * 100}%, var(--er-border) ${((pvpTargetHp - 1000) / 1500) * 100}%)`,
                    }}
                  />
                  <span className="text-er-gold font-semibold w-12">{pvpTargetHp}</span>
                </label>
              </div>

              {/* Main damage result */}
              <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-lg font-er text-gold-grad">{result.weapon.name}</p>
                    <p className="text-xs text-gray-500">{result.weapon.weaponType} · {result.weapon.affinityName} +{upgradeLevel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-er text-er-gold">{result.pvpDamageTotal}</p>
                    <p className="text-xs text-gray-500">per hit</p>
                  </div>
                </div>

                {/* Hits to kill */}
                <div className="bg-er-bg rounded-lg border border-er-border p-3 flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Hits to kill</span>
                  <span className={`text-2xl font-bold ${result.hitsToKill <= 5 ? 'text-red-400' : result.hitsToKill <= 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {isFinite(result.hitsToKill) ? result.hitsToKill : '∞'}
                  </span>
                </div>

                {/* Per-damage-type breakdown */}
                <p className="text-xs text-gray-500 uppercase mb-2">Damage Breakdown</p>
                <div className="space-y-1">
                  {Object.entries(result.pvpDamages).map(([type, dmg]) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-20">{DMG_NAMES[Number(type)] || `Type ${type}`}</span>
                      <div className="flex-1 h-2 bg-er-bg rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (dmg / Math.max(result.pvpDamageTotal, 1)) * 100)}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full bg-er-gold/60 rounded-full"
                        />
                      </div>
                      <span className="text-xs text-er-gold font-mono w-12 text-right">{dmg}</span>
                    </div>
                  ))}
                </div>

                {/* Modifiers shown */}
                <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
                  {result.powerStance && <span className="bg-er-border/30 px-2 py-0.5 rounded">⚡ Power Stance</span>}
                  {result.critModifier !== 1 && <span className="bg-er-border/30 px-2 py-0.5 rounded">Crit ×{result.critModifier}</span>}
                  {result.charged && <span className="bg-er-border/30 px-2 py-0.5 rounded">🔥 Charged</span>}
                  {result.activeBuffs && result.activeBuffs.length > 0 && (
                    <span className="bg-er-border/30 px-2 py-0.5 rounded">✨ {result.activeBuffs.length} buff(s)</span>
                  )}
                </div>
              </div>

              {/* Status procs */}
              {result.pvpStatus.total > 0 && (
                <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
                  <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Status Proc Contribution</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['bleed', 'frost', 'poison', 'scarletRot'] as const).map(s => {
                      const dmg = result.pvpStatus[s];
                      const hits = result.pvpStatus.hitsToProc[s];
                      if (dmg <= 0) return null;
                      return (
                        <div key={s} className="bg-er-bg rounded-lg border border-er-border p-2">
                          <p className="text-xs text-gray-400">{STATUS_NAMES[s]}</p>
                          <p className="text-lg font-bold text-er-gold">{Math.round(dmg)}</p>
                          <p className="text-xs text-gray-500">
                            {isFinite(hits) ? `${hits} hits to proc` : '∞'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Status accumulation is quartered in PvP (0.25×). Values shown are
                    expected per-hit damage from procs.
                  </p>
                </div>
              )}

              {/* PvP formula info */}
              <div className="bg-er-surface rounded-lg border border-er-border p-3 card-glow">
                <p className="text-xs text-gray-500 uppercase mb-2">Formula</p>
                <p className="text-xs text-gray-400 font-mono">
                  damage = (AR × MV/100 × {result.pvpConstants.damageScalar}) × (1 − absorption%) − {result.pvpConstants.flatDefense}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Status buildup × {result.pvpConstants.statusMultiplier} (PvP nerf)
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
