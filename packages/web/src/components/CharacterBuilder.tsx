/**
 * CharacterBuilder.tsx — editable player stats with preset builds.
 *
 * Uses the shared BuildContext from App.tsx so the stats are shared
 * across both the AR page and the AoW page.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useBuild } from '../App';

export interface CharStats {
  vigor: number;
  mind: number;
  endurance: number;
  str: number;
  dex: number;
  int: number;
  fai: number;
  arc: number;
}

const STAT_LABELS: Record<keyof CharStats, string> = {
  vigor: 'VIG',
  mind: 'MND',
  endurance: 'END',
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  fai: 'FAI',
  arc: 'ARC',
};

const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof CharStats)[];

export const defaultStats: CharStats = {
  vigor: 60,
  mind: 30,
  endurance: 30,
  str: 20,
  dex: 20,
  int: 80,
  fai: 20,
  arc: 20,
};

// ── Preset builds ────────────────────────────────────────────────────────────
interface PresetBuild {
  name: string;
  stats: CharStats;
}

const PRESETS: PresetBuild[] = [
  {
    name: 'RL150 Quality',
    stats: { vigor: 60, mind: 25, endurance: 35, str: 40, dex: 40, int: 11, fai: 11, arc: 9 },
  },
  {
    name: 'RL150 INT Mage',
    stats: { vigor: 50, mind: 38, endurance: 25, str: 11, dex: 12, int: 80, fai: 11, arc: 9 },
  },
  {
    name: 'RL150 Faith',
    stats: { vigor: 50, mind: 30, endurance: 30, str: 20, dex: 18, int: 11, fai: 70, arc: 9 },
  },
  {
    name: 'RL125 Bleed Arcane',
    stats: { vigor: 55, mind: 25, endurance: 30, str: 14, dex: 40, int: 9, fai: 9, arc: 60 },
  },
  {
    name: 'RL200 Omni',
    stats: { vigor: 60, mind: 40, endurance: 40, str: 50, dex: 50, int: 50, fai: 50, arc: 50 },
  },
  {
    name: 'RL60 Colossal',
    stats: { vigor: 40, mind: 12, endurance: 30, str: 50, dex: 14, int: 9, fai: 9, arc: 9 },
  },
  {
    name: 'RL125 Dex/INT',
    stats: { vigor: 50, mind: 30, endurance: 25, str: 12, dex: 50, int: 40, fai: 9, arc: 9 },
  },
  {
    name: 'RL150 STR/Faith',
    stats: { vigor: 55, mind: 30, endurance: 35, str: 50, dex: 14, int: 9, fai: 50, arc: 9 },
  },
  {
    name: 'RL125 Bleed/Dex',
    stats: { vigor: 50, mind: 25, endurance: 25, str: 14, dex: 60, int: 9, fai: 9, arc: 30 },
  },
  {
    name: 'RL150 ARC/Bleed',
    stats: { vigor: 55, mind: 25, endurance: 30, str: 14, dex: 14, int: 9, fai: 9, arc: 80 },
  },
];

export function CharacterBuilder() {
  const { stats, setStats } = useBuild();
  const [showPresets, setShowPresets] = useState(false);

  // Rune level = sum of all stats - 79 (base level) + 1
  // In Elden Ring, you start at RL1 with all stats at 80 total (10*8=80 starting).
  // Actually RL = sum(stats) - 79 where starting stats sum to 80 (RL1).
  // Each stat point above its starting value adds 1 RL.
  // The standard starting class (Wretch) starts at 80 total stats = RL1.
  // So RL = sum(stats) - 79.
  const totalStats = Object.values(stats).reduce((a, b) => a + b, 0);
  const runeLevel = totalStats - 79;
  const META_LEVELS = [125, 150, 200];
  const nearestMeta = META_LEVELS.find(m => m >= runeLevel) ?? null;
  const overMeta = META_LEVELS.filter(m => runeLevel > m);
  const isHighMeta = runeLevel > 200;

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-er text-gold-grad uppercase tracking-wide">
          Character Stats
        </h3>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="text-xs text-gray-400 hover:text-er-gold transition-er"
        >
          {showPresets ? '▶ Hide Presets' : '▶ Presets'}
        </button>
      </div>

      {/* Rune Level display with PvP meta warning */}
      <div className="mb-3 p-2 rounded bg-er-bg/60 border border-er-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Rune Level</span>
          <motion.span
            key={runeLevel}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={`text-lg font-er font-bold ${isHighMeta ? 'text-red-400' : nearestMeta === runeLevel ? 'text-gold-grad' : 'text-er-gold'}`}
          >
            RL{runeLevel}
          </motion.span>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          {overMeta.length > 0 && (
            <span className="text-yellow-500/80">
              {'⚠ Above RL' + overMeta[overMeta.length - 1]}
            </span>
          )}
          {!overMeta.length && nearestMeta && (
            <span className="text-gray-500">
              {nearestMeta - runeLevel > 0 ? `${nearestMeta - runeLevel} to RL${nearestMeta}` : `at RL${nearestMeta}`}
            </span>
          )}
          {isHighMeta && (
            <span className="text-red-400/80">High for PvP</span>
          )}
        </div>
      </div>

      {/* Preset build buttons */}
      {showPresets && (
        <div className="mb-3 grid grid-cols-1 gap-1 animate-fade-in">
          {PRESETS.map((preset, i) => (
            <button
              key={preset.name}
              onClick={() => setStats(preset.stats)}
              className="row-stagger text-left text-xs px-2 py-1.5 rounded bg-er-bg border border-er-border hover:border-er-gold hover:text-er-gold transition-er text-gray-400"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {preset.name}
              <span className="text-gray-600 ml-2">
                VIG{preset.stats.vigor}·STR{preset.stats.str}·DEX{preset.stats.dex}·INT{preset.stats.int}·FAI{preset.stats.fai}·ARC{preset.stats.arc}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {STAT_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-8 text-right font-medium">
              {STAT_LABELS[key]}
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={stats[key]}
              onChange={(e) =>
                setStats({ ...stats, [key]: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) })
              }
              className="w-16 bg-er-bg border border-er-border rounded px-2 py-1 text-sm text-gray-200 focus:border-er-gold focus:outline-none transition-er"
            />
          </div>
        ))}
      </div>
    </div>
  );
}


