/** Talisman catalog data for the Loadout Planner. */

export interface Talisman {
  id: string;
  name: string;
  effect: string;
  /** Multiplier type: 'unique' = stacks with everything, 'aura' = doesn't stack with same aura, 'body' = doesn't stack with same body */
  stackType: 'unique' | 'aura' | 'body' | 'weapon';
  /** Damage multiplier (1.1 = +10%) */
  damageMult?: number;
  /** Specific damage type multiplier */
  damageTypeMult?: Record<number, number>;
  /** AoW damage multiplier */
  aowMult?: number;
  /** Flat damage bonus */
  flatBonus?: number;
  /** Flat bonus damage type */
  flatBonusType?: number;
  /** Other effect */
  otherEffect?: string;
}

export const TALISMANS: Talisman[] = [
  { id: 'claw-talisman', name: 'Claw Talisman', effect: '+15% jump attack damage', stackType: 'unique', damageMult: 1.15 },
  { id: 'ritual-sword-talisman', name: 'Ritual Sword Talisman', effect: '+10% damage at full HP', stackType: 'unique', damageMult: 1.10 },
  { id: 'ritual-talisman', name: 'Ritual Talisman', effect: '+10% damage when low HP', stackType: 'unique', damageMult: 1.10 },
  { id: 'rotten-winged-sword-insignia', name: 'Rotten Winged Sword Insignia', effect: '+6-13% damage on consecutive hits', stackType: 'unique', damageMult: 1.10 },
  { id: 'winged-sword-insignia', name: 'Winged Sword Insignia', effect: '+3-10% damage on consecutive hits', stackType: 'unique', damageMult: 1.08 },
  { id: 'shard-of-alexander', name: 'Shard of Alexander', effect: '+15% AoW damage', stackType: 'unique', aowMult: 1.15 },
  { id: 'warrior-jar-shard', name: 'Warrior Jar Shard', effect: '+10% AoW damage', stackType: 'unique', aowMult: 1.10 },
  { id: 'million-century-talisman', name: 'Millicent\'s Prosthesis', effect: '+5 DEX, +4-10% damage on consecutive hits', stackType: 'unique', damageMult: 1.08 },
  { id: 'magic-scorpion-charm', name: 'Magic Scorpion Charm', effect: '+12% Magic damage, -10% Magic negation', stackType: 'aura', damageTypeMult: { 1: 1.12 } },
  { id: 'fire-scorpion-charm', name: 'Fire Scorpion Charm', effect: '+12% Fire damage, -10% Fire negation', stackType: 'aura', damageTypeMult: { 2: 1.12 } },
  { id: 'lightning-scorpion-charm', name: 'Lightning Scorpion Charm', effect: '+12% Lightning damage, -10% Lightning negation', stackType: 'aura', damageTypeMult: { 3: 1.12 } },
  { id: 'holy-scorpion-charm', name: 'Holy Scorpion Charm', effect: '+12% Holy damage, -10% Holy negation', stackType: 'aura', damageTypeMult: { 4: 1.12 } },
  { id: 'sacred-scorpion-charm', name: 'Sacred Scorpion Charm', effect: '+10% Holy, -7% Physical negation', stackType: 'aura', damageTypeMult: { 4: 1.10 } },
  { id: 'crimson-seal', name: 'Crimson Seal', effect: '+20% healing, +10% damage taken', stackType: 'unique', otherEffect: 'healing_boost' },
  { id: 'cerulean-seal', name: 'Cerulean Seal', effect: '+20% FP recovery, +10% damage taken', stackType: 'unique', otherEffect: 'fp_recovery' },
  { id: 'dragoncrest-greatshield', name: 'Dragoncrest Greatshield Talisman', effect: '+20% Physical negation', stackType: 'aura', otherEffect: 'phys_defense' },
  { id: 'pearldrake-talisman', name: 'Pearldrake Talisman', effect: '+10% non-Physical negation', stackType: 'aura', otherEffect: 'nonphys_defense' },
  { id: 'blue-dancer-charm', name: 'Blue Dancer Charm', effect: '+5-20% damage when light equipped', stackType: 'unique', damageMult: 1.15 },
  { id: 'lord-of-bloods-exultation', name: 'Lord of Blood\'s Exultation', effect: '+20% damage when bleeding nearby', stackType: 'unique', damageMult: 1.20 },
  { id: 'kindred-of-ros-exultation', name: 'Kindred of Rot\'s Exultation', effect: '+20% damage when poison/rot nearby', stackType: 'unique', damageMult: 1.20 },
  { id: 'flock\'s-canvas', name: 'Flock\'s Canvas Talisman', effect: '+8% AoW damage', stackType: 'unique', aowMult: 1.08 },
  { id: 'spear-talisman', name: 'Spear Talisman', effect: '+15% counterattack damage', stackType: 'unique', damageMult: 1.15 },
  { id: 'curved-sword-talisman', name: 'Curved Sword Talisman', effect: '+15% counterattack damage', stackType: 'unique', damageMult: 1.15 },
  { id: 'dagger-talisman', name: 'Dagger Talisman', effect: '+17% critical damage', stackType: 'unique', damageMult: 1.17 },
  { id: 'faithful-canvas', name: 'Faithful\'s Canvas Talisman', effect: '+8% incantation damage', stackType: 'unique', otherEffect: 'incant_buff' },
];

/** Get stacking info for a set of talismans. */
export function getStackingInfo(selected: Talisman[]) {
  const groups: Record<string, Talisman[]> = {};
  for (const t of selected) {
    if (!groups[t.stackType]) groups[t.stackType] = [];
    groups[t.stackType].push(t);
  }
  const conflicts: string[] = [];
  const safe: string[] = [];
  for (const [type, items] of Object.entries(groups)) {
    if (type === 'unique') {
      items.forEach(t => safe.push(t.name));
    } else {
      // aura/body/weapon: only first one stacks, rest conflict
      safe.push(items[0].name);
      items.slice(1).forEach(t => conflicts.push(t.name));
    }
  }
  return { safe, conflicts };
}
