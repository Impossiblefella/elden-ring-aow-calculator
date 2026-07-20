/**
 * App.tsx — main application shell with react-router.
 *
 * Two separate pages:
 *  /ar        — Weapon Attack Rating (AR) Calculator + Weapon Database
 *  /aow       — Ash of War Damage Calculator & Weapon Ranking
 *
 * Shared state (character stats, upgrade level, two-handing, buffs) is
 * persisted to localStorage so the user's build survives page refreshes
 * and app restarts.
 */
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { api, type WeaponListItem, type BuffInfo } from './api';
import { CharacterBuilder, defaultStats, type CharStats } from './components/CharacterBuilder';
import { ARPage } from './pages/ARPage';
import { AoWPage } from './pages/AoWPage';

// ── localStorage persistence ─────────────────────────────────────────────────
const STORAGE_KEY = 'er-aow-calc:build-v1';

interface PersistedBuild {
  stats: CharStats;
  upgradeLevel: number;
  twoHanding: boolean;
  buffIds: string[];
}

function loadBuild(): Partial<PersistedBuild> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedBuild>;
  } catch {
    return {};
  }
}

function saveBuild(build: PersistedBuild) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
  } catch {
    // Ignore quota or serialization errors.
  }
}

// ── Shared build context ─────────────────────────────────────────────────────

interface BuildState {
  stats: CharStats;
  setStats: (s: CharStats) => void;
  upgradeLevel: number;
  setUpgradeLevel: (n: number) => void;
  twoHanding: boolean;
  setTwoHanding: (b: boolean) => void;
  buffIds: string[];
  toggleBuff: (id: string) => void;
  weapons: WeaponListItem[];
  serverStatus: 'connecting' | 'online' | 'offline';
}

const BuildContext = createContext<BuildState | null>(null);

export function useBuild(): BuildState {
  const ctx = useContext(BuildContext);
  if (!ctx) throw new Error('useBuild must be used within BuildProvider');
  return ctx;
}

function BuildProvider({ children }: { children: React.ReactNode }) {
  const saved = loadBuild();
  const [stats, setStats] = useState<CharStats>(saved.stats ?? defaultStats);
  const [upgradeLevel, setUpgradeLevel] = useState(saved.upgradeLevel ?? 25);
  const [twoHanding, setTwoHanding] = useState(saved.twoHanding ?? false);
  const [buffIds, setBuffIds] = useState<string[]>(saved.buffIds ?? []);
  const [weapons, setWeapons] = useState<WeaponListItem[]>([]);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  // Persist build state to localStorage whenever it changes.
  useEffect(() => {
    saveBuild({ stats, upgradeLevel, twoHanding, buffIds });
  }, [stats, upgradeLevel, twoHanding, buffIds]);

  useEffect(() => {
    api.getHealth()
      .then(() => setServerStatus('online'))
      .catch(() => setServerStatus('offline'));
    api.getWeapons()
      .then(setWeapons)
      .catch(() => setServerStatus('offline'));
  }, []);

  const handleUpgrade = useCallback((v: number) => {
    setUpgradeLevel(Math.max(0, Math.min(25, v)));
  }, []);

  const toggleBuff = useCallback((id: string) => {
    setBuffIds((prev) => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  }, []);

  return (
    <BuildContext.Provider value={{
      stats, setStats,
      upgradeLevel, setUpgradeLevel: handleUpgrade,
      twoHanding, setTwoHanding,
      buffIds, toggleBuff,
      weapons, serverStatus,
    }}>
      {children}
    </BuildContext.Provider>
  );
}

// ── Nav bar ──────────────────────────────────────────────────────────────────

function NavBar() {
  const { serverStatus, upgradeLevel, setUpgradeLevel, twoHanding, setTwoHanding } = useBuild();

  return (
    <header className="border-b border-er-border bg-er-surface/50 sticky top-0 z-20 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-er-gold tracking-wide">
            ⚔ Elden Ring Calculator
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            serverStatus === 'online' ? 'bg-green-900/40 text-green-400' :
            serverStatus === 'connecting' ? 'bg-yellow-900/40 text-yellow-400' :
            'bg-red-900/40 text-red-400'
          }`}>
            {serverStatus}
          </span>
          {/* Page nav links */}
          <nav className="flex gap-1 ml-4">
            <NavLink
              to="/ar"
              className={({ isActive }) =>
                `px-3 py-1 text-sm font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-er-gold text-er-bg'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-er-border/30'
                }`
              }
            >
              Weapon AR
            </NavLink>
            <NavLink
              to="/aow"
              className={({ isActive }) =>
                `px-3 py-1 text-sm font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-er-gold text-er-bg'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-er-border/30'
                }`
              }
            >
              Ash of War
            </NavLink>
          </nav>
        </div>
        {/* Global controls */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Upgrade</span>
            <input
              type="range"
              min={0}
              max={25}
              value={upgradeLevel}
              onChange={(e) => setUpgradeLevel(parseInt(e.target.value))}
              className="accent-er-gold"
            />
            <span className="text-er-gold font-semibold w-8">+{upgradeLevel}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={twoHanding}
              onChange={(e) => setTwoHanding(e.target.checked)}
              className="accent-er-gold"
            />
            <span className="text-gray-400">2H</span>
          </label>
        </div>
      </div>
    </header>
  );
}

// ── Sidebar (shared character builder) ───────────────────────────────────────

function Sidebar() {
  const { serverStatus } = useBuild();
  return (
    <div className="space-y-4">
      <CharacterBuilder />
      <BuffSelector />
      <div className="bg-er-surface rounded-lg border border-er-border p-4 text-xs text-gray-400">
        <p className="font-semibold text-gray-300 mb-1">About</p>
        <p>
          Damage formulas derived from regulation.bin params.
          Values match community-tested results from the Elden Ring
          wiki and calculator projects.
        </p>
        <p className="mt-2 text-gray-500">
          App v1.0.1 · Patch: {serverStatus === 'online' ? '1.14' : '—'}
        </p>
      </div>
    </div>
  );
}

// ── Buff selector ────────────────────────────────────────────────────────────

const BUFF_CATEGORIES: { key: string; label: string }[] = [
  { key: 'aura', label: 'Aura' },
  { key: 'body', label: 'Body' },
  { key: 'talisman', label: 'Talisman' },
  { key: 'physick', label: 'Physick' },
];

function BuffSelector() {
  const { buffIds, toggleBuff } = useBuild();
  const [buffs, setBuffs] = useState<BuffInfo[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.getBuffs().then(setBuffs).catch(() => {});
  }, []);

  const activeCount = buffIds.length;

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm font-semibold text-er-gold uppercase tracking-wide mb-2"
      >
        <span>Buffs</span>
        <span className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-xs bg-er-gold/20 text-er-gold px-2 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
        </span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {BUFF_CATEGORIES.map((cat) => {
            const catBuffs = buffs.filter((b) => b.category === cat.key);
            if (catBuffs.length === 0) return null;
            return (
              <div key={cat.key}>
                <p className="text-xs text-gray-500 uppercase mb-1">{cat.label}</p>
                <div className="space-y-1">
                  {catBuffs.map((b) => (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 cursor-pointer text-xs hover:bg-er-border/20 rounded px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={buffIds.includes(b.id)}
                        onChange={() => toggleBuff(b.id)}
                        className="accent-er-gold"
                      />
                      <span className={buffIds.includes(b.id) ? 'text-er-gold' : 'text-gray-400'}>
                        {b.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <BuildProvider>
        <div className="min-h-screen bg-er-bg text-gray-200">
          <NavBar />
          <main className="max-w-7xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <Sidebar />
              <div className="space-y-4">
                <Routes>
                  <Route path="/" element={<ARPage />} />
                  <Route path="/ar" element={<ARPage />} />
                  <Route path="/aow" element={<AoWPage />} />
                </Routes>
              </div>
            </div>
          </main>
          <footer className="border-t border-er-border py-4 text-center text-xs text-gray-500">
            Built with data parsed from regulation.bin · Formulas verified against community resources
          </footer>
        </div>
      </BuildProvider>
    </BrowserRouter>
  );
}
