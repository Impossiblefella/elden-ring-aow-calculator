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
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
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
  enemyId: string;
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
  enemyId: string;
  setEnemyId: (id: string) => void;
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
  const [enemyId, setEnemyId] = useState<string>(saved.enemyId ?? 'malenia');
  const [weapons, setWeapons] = useState<WeaponListItem[]>([]);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  // Persist build state to localStorage whenever it changes.
  useEffect(() => {
    saveBuild({ stats, upgradeLevel, twoHanding, buffIds, enemyId });
  }, [stats, upgradeLevel, twoHanding, buffIds, enemyId]);

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
      enemyId, setEnemyId,
      weapons, serverStatus,
    }}>
      {children}
    </BuildContext.Provider>
  );
}

// ── Animated route wrapper (fade/slide on page change) ────────────────────────

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fade-in-up">
      <Routes location={location}>
        <Route path="/" element={<ARPage />} />
        <Route path="/ar" element={<ARPage />} />
        <Route path="/aow" element={<AoWPage />} />
      </Routes>
    </div>
  );
}

// ── Nav bar ──────────────────────────────────────────────────────────────────

function NavBar() {
  const { serverStatus, upgradeLevel, setUpgradeLevel, twoHanding, setTwoHanding } = useBuild();

  return (
    <header className="glass border-b border-er-border sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-er text-gold-grad tracking-wide">
            ⚔ Elden Ring Calculator
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded-full transition-er ${
            serverStatus === 'online' ? 'bg-green-900/40 text-green-400' :
            serverStatus === 'connecting' ? 'bg-yellow-900/40 text-yellow-400 animate-pulse' :
            'bg-red-900/40 text-red-400'
          }`}>
            {serverStatus}
          </span>
          {/* Page nav links */}
          <nav className="flex gap-1 ml-4">
            <NavLink
              to="/ar"
              className={({ isActive }) =>
                `px-3 py-1 text-sm font-medium rounded transition-er ${
                  isActive
                    ? 'btn-gold'
                    : 'text-gray-400 hover:text-er-gold hover:bg-er-border/20'
                }`
              }
            >
              Weapon AR
            </NavLink>
            <NavLink
              to="/aow"
              className={({ isActive }) =>
                `px-3 py-1 text-sm font-medium rounded transition-er ${
                  isActive
                    ? 'btn-gold'
                    : 'text-gray-400 hover:text-er-gold hover:bg-er-border/20'
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
              style={{
                background: `linear-gradient(to right, var(--er-gold) ${(upgradeLevel / 25) * 100}%, var(--er-border) ${(upgradeLevel / 25) * 100}%)`,
              }}
            />
            <span className="text-er-gold font-semibold w-8">+{upgradeLevel}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={twoHanding}
              onChange={(e) => setTwoHanding(e.target.checked)}
              className="er-checkbox"
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
  return (
    <div className="space-y-4">
      <CharacterBuilder />
      <BuffSelector />
      <AboutBox />
      <SettingsBox />
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

const THEME_KEY = 'er-aow-calc:theme';

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement;
  if (theme === 'light') root.classList.add('theme-light');
  else root.classList.remove('theme-light');
}

function SettingsBox() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
      <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">
        Settings
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Theme</span>
        <div className="flex gap-1">
          <button
            onClick={() => setTheme('dark')}
            className={`px-2 py-1 rounded text-xs transition-er ${theme === 'dark' ? 'btn-gold' : 'bg-er-bg border border-er-border text-gray-400 hover:border-er-gold'}`}
          >
            🌙 Dark
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`px-2 py-1 rounded text-xs transition-er ${theme === 'light' ? 'btn-gold' : 'bg-er-bg border border-er-border text-gray-400 hover:border-er-gold'}`}
          >
            ☀ Light
          </button>
        </div>
      </div>
    </div>
  );
}

// ── About box + updater controls ──────────────────────────────────────────────

const isElectron = typeof window !== 'undefined' && (window as any).erApp;

function AboutBox() {
  const [version, setVersion] = useState('1.0.3');
  const [patch, setPatch] = useState('1.14');
  const [checking, setChecking] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (isElectron) {
      (window as any).erApp.getVersion().then((v: string) => setVersion(v));
      (window as any).erApp.getPatch().then((p: string) => setPatch(p));
    }
  }, []);

  const handleCheckUpdate = async () => {
    if (!isElectron) {
      setUpdateMsg('Updates are only available in the desktop app.');
      return;
    }
    setChecking(true);
    setUpdateMsg(null);
    try {
      const result = await (window as any).erApp.checkForUpdates();
      if (!result.ok) {
        setUpdateMsg(`⚠ ${result.reason || 'Check failed'}`);
      } else if (result.downloaded) {
        setUpdateMsg(`✓ v${result.updateVersion} downloaded — it will install when you close the app.`);
        setUpdateAvailable(true);
      } else if (result.updateAvailable) {
        setUpdateMsg(`v${result.updateVersion} is available — downloading in background...`);
        setUpdateAvailable(true);
      } else {
        setUpdateMsg(`✓ You're up to date (v${result.currentVersion})`);
        setUpdateAvailable(false);
      }
    } catch (e: any) {
      setUpdateMsg(`⚠ ${e.message || 'Check failed'}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4 text-xs text-gray-400 card-glow">
      <p className="font-er text-gold-grad mb-2 text-sm">About</p>
      <p>
        Damage formulas derived from regulation.bin params.
        Values match community-tested results from the Elden Ring
        wiki and calculator projects.
      </p>
      <div className="mt-2 flex items-center gap-2 text-gray-500">
        <span>App v{version} · Patch: {patch}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {isElectron && (
          <button
            onClick={handleCheckUpdate}
            disabled={checking}
            className={`text-xs px-2 py-1 rounded border border-er-gold/30 text-er-gold transition-er disabled:opacity-50 ${
              updateAvailable ? 'animate-pulse-gold bg-er-gold/20' : 'bg-er-gold/10 hover:bg-er-gold/20'
            }`}
          >
            {checking ? '⟳ Checking...' : updateAvailable ? '✦ Update ready — click to install' : '⟳ Check for Updates'}
          </button>
        )}
        <button
          onClick={() => {
            if (isElectron) (window as any).erApp.openRepo();
            else window.open('https://github.com/Impossiblefella/elden-ring-aow-calculator', '_blank');
          }}
          className="text-xs px-2 py-1 rounded bg-er-border/30 border border-er-border text-gray-400 hover:text-er-gold hover:border-er-gold/30 transition-er"
        >
          🐙 GitHub
        </button>
      </div>
      {updateMsg && (
        <p className="mt-2 text-xs text-gray-400 animate-fade-in">{updateMsg}</p>
      )}
    </div>
  );
}

// ── Buff selector ────────────────────────────────────────────────────────────

const BUFF_CATEGORIES: { key: string; label: string }[] = [
  { key: 'aura', label: 'Aura' },
  { key: 'body', label: 'Body' },
  { key: 'weapon', label: 'Weapon Greases' },
  { key: 'talisman', label: 'Talisman' },
  { key: 'physick', label: 'Physick' },
];

// Buff effect descriptions for tooltips
const BUFF_TIPS: Record<string, string> = {
  'golden-vow': '+15% all damage (60s)',
  'standard-buff': '+15% all damage via commander-horn',
  'rallying-standard': '+15% all damage + defense',
  'old-lords-talisman': 'Extends buff duration +30%',
  'fire-grant-me-strength': '+35% Fire, +20% Physical (30s)',
  'flame-grant-me-strength': '+35% Fire, +20% Physical (30s)',
  'golden-braid': '+15% all damage',
  'ritual-shield-talisman': '+10% negation when full HP',
  'fire-grease': '+60 Flat Fire damage',
  'magic-grease': '+60 Flat Magic damage',
  'lightning-grease': '+60 Flat Lightning damage',
  'holy-grease': '+60 Flat Holy damage',
  'poison-grease': '+60 Flat Poison buildup',
  'blood-grease': '+60 Flat Bleed buildup',
};

function getBuffTip(id: string): string {
  return BUFF_TIPS[id] ?? '';
}

function BuffSelector() {
  const { buffIds, toggleBuff } = useBuild();
  const [buffs, setBuffs] = useState<BuffInfo[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.getBuffs().then(setBuffs).catch(() => {});
  }, []);

  const activeCount = buffIds.length;

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm font-er text-gold-grad uppercase tracking-wide mb-2"
      >
        <span>Buffs</span>
        <span className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-xs bg-er-gold/20 text-er-gold px-2 py-0.5 rounded-full animate-fade-in">
              {activeCount} active
            </span>
          )}
          <span className="text-gray-400 transition-transform duration-200" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
            ▶
          </span>
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 animate-fade-in">
          {BUFF_CATEGORIES.map((cat) => {
            const catBuffs = buffs.filter((b) => b.category === cat.key);
            if (catBuffs.length === 0) return null;
            return (
              <div key={cat.key}>
                <p className="text-xs text-gray-500 uppercase mb-1">{cat.label}</p>
                <div className="space-y-1">
                  {catBuffs.map((b) => {
                    const isActive = buffIds.includes(b.id);
                    const tip = getBuffTip(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 cursor-pointer text-xs rounded px-2 py-1 transition-er hover:bg-er-border/20 er-tooltip ${isActive ? 'animate-slide-in-left' : ''}`}
                        data-tip={tip || undefined}
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleBuff(b.id)}
                          className="er-checkbox"
                        />
                        <span className={isActive ? 'text-er-gold' : 'text-gray-400'}>
                          {b.name}
                        </span>
                      </label>
                    );
                  })}
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
        <div className="min-h-screen bg-er-bg text-gray-200 relative z-10">
          <NavBar />
          <main className="max-w-7xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <Sidebar />
              <div className="space-y-4">
                <AnimatedRoutes />
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
