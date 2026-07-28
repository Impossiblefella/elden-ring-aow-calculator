/** Equip Load & Stamina Calculator page. */
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useBuild } from '../App';

export function EquipLoadPage() {
  const { stats } = useBuild();
  const [weaponWeight, setWeaponWeight] = useState(8);
  const [headWeight, setHeadWeight] = useState(3);
  const [chestWeight, setChestWeight] = useState(10);
  const [armsWeight, setArmsWeight] = useState(3);
  const [legsWeight, setLegsWeight] = useState(6);

  const endurance = stats?.endurance ?? 20;
  // Equip load = 6.5 + endurance * 0.8 (roughly)
  const maxEquipLoad = useMemo(() => 6.5 + endurance * 0.8, [endurance]);
  const totalWeight = weaponWeight + headWeight + chestWeight + armsWeight + legsWeight;
  const equipLoadPercent = (totalWeight / maxEquipLoad) * 100;

  const rollType = equipLoadPercent < 30 ? 'Light Roll' : equipLoadPercent <= 70 ? 'Medium Roll' : equipLoadPercent <= 100 ? 'Heavy Roll' : 'Over Encumbered';
  const rollColor = equipLoadPercent < 30 ? 'text-blue-300' : equipLoadPercent <= 70 ? 'text-green-300' : equipLoadPercent <= 100 ? 'text-orange-300' : 'text-red-400';

  // Stamina per action (rough estimates based on weapon weight)
  const staminaLight = Math.ceil(25 + weaponWeight * 0.2);
  const staminaHeavy = Math.ceil(35 + weaponWeight * 0.4);
  const staminaDodge = equipLoadPercent < 30 ? 12 : equipLoadPercent <= 70 ? 18 : 22;
  const staminaSprint = Math.ceil(20 + equipLoadPercent * 0.1);
  const maxStamina = 80 + endurance * 5;
  const actionsBeforeExhaustion = Math.floor(maxStamina / staminaHeavy);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-er text-gold-grad">Equip Load & Stamina Calculator</h2>
        <span className="text-xs text-gray-500">END {endurance} → Max Load {maxEquipLoad.toFixed(1)}</span>
      </div>

      {/* Weight inputs */}
      <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
        <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Equipment Weight</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Weapon', value: weaponWeight, set: setWeaponWeight, v: 15 },
            { label: 'Head Armor', value: headWeight, set: setHeadWeight, v: 8 },
            { label: 'Chest Armor', value: chestWeight, set: setChestWeight, v: 20 },
            { label: 'Arms Armor', value: armsWeight, set: setArmsWeight, v: 8 },
            { label: 'Leg Armor', value: legsWeight, set: setLegsWeight, v: 15 },
          ].map(item => (
            <div key={item.label}>
              <label className="text-xs text-gray-400">{item.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={item.v}
                  step={0.5}
                  value={item.value}
                  onChange={e => item.set(parseFloat(e.target.value))}
                  className="flex-1 accent-er-gold"
                />
                <span className="text-sm text-gray-300 w-12 text-right">{item.value.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Equip load gauge */}
      <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
        <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Equip Load</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Total Weight</span>
            <span className="text-lg text-gray-200 font-semibold">{totalWeight.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Max Equip Load</span>
            <span className="text-lg text-gray-200 font-semibold">{maxEquipLoad.toFixed(1)}</span>
          </div>
          {/* Gauge */}
          <div className="relative h-8 bg-er-bg rounded-full border border-er-border overflow-hidden">
            <motion.div
              className="absolute h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(equipLoadPercent, 100)}%`,
                background: equipLoadPercent < 30
                  ? 'linear-gradient(90deg, #4488cc, #66aadd)'
                  : equipLoadPercent <= 70
                  ? 'linear-gradient(90deg, #44aa44, #66cc66)'
                  : equipLoadPercent <= 100
                  ? 'linear-gradient(90deg, #cc8822, #ddaa44)'
                  : 'linear-gradient(90deg, #cc4444, #dd6666)',
              }}
            />
            {/* Zone markers */}
            <div className="absolute top-0 h-full w-px bg-er-bg/50" style={{ left: '30%' }} />
            <div className="absolute top-0 h-full w-px bg-er-bg/50" style={{ left: '70%' }} />
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white drop-shadow">
              {equipLoadPercent.toFixed(0)}%
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-300">Light ({'<'}30%)</span>
            <span className="text-green-300">Medium (30-70%)</span>
            <span className="text-orange-300">Heavy (70-100%)</span>
            <span className="text-red-400">Over ({'>'}100%)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Dodge Roll Type</span>
            <span className={`text-lg font-semibold ${rollColor}`}>{rollType}</span>
          </div>
        </div>
      </div>

      {/* Stamina costs */}
      <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
        <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">Stamina Costs</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Light Attack', value: staminaLight, color: 'text-green-300' },
            { label: 'Heavy Attack', value: staminaHeavy, color: 'text-orange-300' },
            { label: 'Dodge Roll', value: staminaDodge, color: 'text-blue-300' },
            { label: 'Sprint (per sec)', value: staminaSprint, color: 'text-purple-300' },
          ].map(s => (
            <div key={s.label} className="bg-er-bg/60 border border-er-border rounded p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-400">
          <span>Max Stamina: {maxStamina}</span>
          <span>Heavy attacks before exhaustion: ~{actionsBeforeExhaustion}</span>
        </div>
      </div>
    </div>
  );
}
