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
import { useEffect, useState, useCallback, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, type WeaponListItem, type BuffInfo } from './api';
import { CharacterBuilder, defaultStats, type CharStats } from './components/CharacterBuilder';
import { ARPage } from './pages/ARPage';
import { AoWPage } from './pages/AoWPage';
import { checkForSharedBuild, getShareURL, type BuildStateForShare } from './share';

// ── localStorage persistence ─────────────────────────────────────────────────
const STORAGE_KEY = 'er-aow-calc:build-v1';

interface PersistedBuild {
  stats: CharStats;
  upgradeLevel: number;
  twoHanding: boolean;
  buffIds: string[];
  enemyId: string;
  ngCycle: number;
  powerStance: boolean;
  critModifier: number;
  charged: boolean;
  includeDLC: boolean;
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
  setBuffIds: (ids: string[]) => void;
  toggleBuff: (id: string) => void;
  enemyId: string;
  setEnemyId: (id: string) => void;
  weapons: WeaponListItem[];
  serverStatus: 'connecting' | 'online' | 'offline';
  ngCycle: number;
  setNgCycle: (n: number) => void;
  powerStance: boolean;
  setPowerStance: (b: boolean) => void;
  critModifier: number;
  setCritModifier: (n: number) => void;
  charged: boolean;
  setCharged: (b: boolean) => void;
  includeDLC: boolean;
  setIncludeDLC: (b: boolean) => void;
}

const BuildContext = createContext<BuildState | null>(null);

export function useBuild(): BuildState {
  const ctx = useContext(BuildContext);
  if (!ctx) throw new Error('useBuild must be used within BuildProvider');
  return ctx;
}

function BuildProvider({ children }: { children: React.ReactNode }) {
  // Check for a shared build in the URL hash first, then fall back to localStorage
  const sharedBuild = checkForSharedBuild();
  const saved = sharedBuild ?? loadBuild();
  const [stats, setStats] = useState<CharStats>(saved.stats ?? defaultStats);
  const [upgradeLevel, setUpgradeLevel] = useState(saved.upgradeLevel ?? 25);
  const [twoHanding, setTwoHanding] = useState(saved.twoHanding ?? false);
  const [buffIds, setBuffIds] = useState<string[]>(saved.buffIds ?? []);
  const [enemyId, setEnemyId] = useState<string>(saved.enemyId ?? 'malenia');
  const [ngCycle, setNgCycle] = useState<number>(saved.ngCycle ?? 0);
  const [powerStance, setPowerStance] = useState<boolean>(saved.powerStance ?? false);
  const [critModifier, setCritModifier] = useState<number>(saved.critModifier ?? 1.0);
  const [charged, setCharged] = useState<boolean>(saved.charged ?? false);
  const [includeDLC, setIncludeDLC] = useState<boolean>(saved.includeDLC ?? true);
  const [weapons, setWeapons] = useState<WeaponListItem[]>([]);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  // Persist build state to localStorage whenever it changes.
  useEffect(() => {
    saveBuild({ stats, upgradeLevel, twoHanding, buffIds, enemyId, ngCycle, powerStance, critModifier, charged, includeDLC });
  }, [stats, upgradeLevel, twoHanding, buffIds, enemyId, ngCycle, powerStance, critModifier, charged, includeDLC]);

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
      buffIds, setBuffIds, toggleBuff,
      enemyId, setEnemyId,
      weapons, serverStatus,
      ngCycle, setNgCycle,
      powerStance, setPowerStance,
      critModifier, setCritModifier,
      charged, setCharged,
      includeDLC, setIncludeDLC,
    }}>
      {children}
    </BuildContext.Provider>
  );
}

// ── Animated route wrapper (fade/slide on page change) ────────────────────────

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<ARPage />} />
          <Route path="/ar" element={<ARPage />} />
          <Route path="/aow" element={<AoWPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Nav bar ──────────────────────────────────────────────────────────────────

function NavBar() {
  const { serverStatus, upgradeLevel, setUpgradeLevel, twoHanding, setTwoHanding, powerStance, setPowerStance, critModifier, setCritModifier, charged, setCharged, ngCycle, setNgCycle, includeDLC, setIncludeDLC } = useBuild();

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
          <nav className="flex gap-1 ml-4 relative">
            <NavLink to="/ar" className="relative px-3 py-1 text-sm font-medium rounded transition-er text-gray-400 hover:text-er-gold hover:bg-er-border/20">
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-[#1a1a1a] relative z-10' : ''}>Weapon AR</span>
                  {isActive && (
                    <motion.div
                      layoutId="navIndicator"
                      className="absolute inset-0 rounded btn-gold"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
            <NavLink to="/aow" className="relative px-3 py-1 text-sm font-medium rounded transition-er text-gray-400 hover:text-er-gold hover:bg-er-border/20">
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-[#1a1a1a] relative z-10' : ''}>Ash of War</span>
                  {isActive && (
                    <motion.div
                      layoutId="navIndicator"
                      className="absolute inset-0 rounded btn-gold"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          </nav>
        </div>
        {/* Global controls */}
        <div className="flex items-center gap-3 flex-wrap">
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
          {/* NG+ cycle selector */}
          <select
            value={ngCycle}
            onChange={(e) => setNgCycle(parseInt(e.target.value))}
            className="bg-er-bg border border-er-border rounded px-2 py-1 text-xs text-gray-300 transition-er focus:border-er-gold focus:outline-none"
            title="NG+ cycle"
          >
            <option value={0}>NG</option>
            {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>NG+{n}</option>)}
          </select>
          {/* Crit modifier */}
          <select
            value={critModifier}
            onChange={(e) => setCritModifier(parseFloat(e.target.value))}
            className="bg-er-bg border border-er-border rounded px-2 py-1 text-xs text-gray-300 transition-er focus:border-er-gold focus:outline-none"
            title="Critical hit modifier"
          >
            <option value={1.0}>Crit: Normal</option>
            <option value={1.6}>Crit: Backstab</option>
            <option value={4.0}>Crit: Riposte</option>
          </select>
          {/* Toggles */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={twoHanding} onChange={(e) => setTwoHanding(e.target.checked)} className="er-checkbox" />
            <span className="text-gray-400">2H</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={powerStance} onChange={(e) => setPowerStance(e.target.checked)} className="er-checkbox" />
            <span className="text-gray-400">⚡ Stance</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={charged} onChange={(e) => setCharged(e.target.checked)} className="er-checkbox" />
            <span className="text-gray-400">🔥 Charged</span>
          </label>
          {/* DLC toggle — global, affects both AR table and AoW ranking */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="Toggle DLC (Shadow of the Erdtree) weapons and Ashes of War">
            <input type="checkbox" checked={includeDLC} onChange={(e) => setIncludeDLC(e.target.checked)} className="er-checkbox" />
            <span className={includeDLC ? 'text-er-gold' : 'text-gray-400'}>★ DLC</span>
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
  const { stats, upgradeLevel, twoHanding, buffIds, enemyId, ngCycle, powerStance, critModifier, charged, includeDLC, setStats, setUpgradeLevel, setTwoHanding, setBuffIds, setEnemyId, setNgCycle, setPowerStance, setCritModifier, setCharged, setIncludeDLC } = useBuild();
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [buildName, setBuildName] = useState('');
  const [savedBuilds, setSavedBuilds] = useState<{name: string; data: PersistedBuild}[]>([]);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  // Load saved builds from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('er-aow-calc:saved-builds');
      if (raw) setSavedBuilds(JSON.parse(raw));
    } catch {}
  }, []);

  const saveCurrentBuild = () => {
    if (!buildName.trim()) return;
    const data: PersistedBuild = { stats, upgradeLevel, twoHanding, buffIds, enemyId, ngCycle, powerStance, critModifier, charged, includeDLC };
    const newBuilds = [...savedBuilds.filter(b => b.name !== buildName), { name: buildName, data }];
    setSavedBuilds(newBuilds);
    try { localStorage.setItem('er-aow-calc:saved-builds', JSON.stringify(newBuilds)); } catch {}
    setBuildName('');
  };

  const loadBuild = (name: string) => {
    const build = savedBuilds.find(b => b.name === name);
    if (!build) return;
    const d = build.data;
    setStats(d.stats); setUpgradeLevel(d.upgradeLevel); setTwoHanding(d.twoHanding);
    setBuffIds(d.buffIds); setEnemyId(d.enemyId); setNgCycle(d.ngCycle ?? 0);
    setPowerStance(d.powerStance ?? false); setCritModifier(d.critModifier ?? 1.0); setCharged(d.charged ?? false);
    if (d.includeDLC !== undefined) setIncludeDLC(d.includeDLC);
  };

  const deleteBuild = (name: string) => {
    const newBuilds = savedBuilds.filter(b => b.name !== name);
    setSavedBuilds(newBuilds);
    try { localStorage.setItem('er-aow-calc:saved-builds', JSON.stringify(newBuilds)); } catch {}
  };

  const copyBuild = () => {
    const data: PersistedBuild = { stats, upgradeLevel, twoHanding, buffIds, enemyId, ngCycle, powerStance, critModifier, charged, includeDLC };
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareLink = () => {
    const buildState: BuildStateForShare = { stats, upgradeLevel, twoHanding, buffIds, enemyId, ngCycle, powerStance, critModifier, charged, includeDLC };
    const url = getShareURL(buildState);
    try {
      navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Fallback: select and prompt
      window.prompt('Copy this share link:', url);
    }
  };

  return (
    <div className="bg-er-surface rounded-lg border border-er-border p-4 card-glow">
      <p className="text-sm font-er text-gold-grad uppercase tracking-wide mb-3">
        Settings
      </p>
      {/* Theme */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">Theme</span>
        <div className="flex gap-1">
          <button onClick={() => setTheme('dark')} className={`px-2 py-1 rounded text-xs transition-er ${theme === 'dark' ? 'btn-gold' : 'bg-er-bg border border-er-border text-gray-400 hover:border-er-gold'}`}>🌙 Dark</button>
          <button onClick={() => setTheme('light')} className={`px-2 py-1 rounded text-xs transition-er ${theme === 'light' ? 'btn-gold' : 'bg-er-bg border border-er-border text-gray-400 hover:border-er-gold'}`}>☀ Light</button>
        </div>
      </div>
      {/* Save/Load builds */}
      <div className="border-t border-er-border pt-2 mt-2 space-y-2">
        <p className="text-xs text-gray-500 uppercase">Builds</p>
        <div className="flex gap-1">
          <input
            type="text"
            value={buildName}
            onChange={e => setBuildName(e.target.value)}
            placeholder="Build name..."
            className="flex-1 min-w-0 px-2 py-1 bg-er-bg border border-er-border rounded text-xs transition-er focus:border-er-gold focus:outline-none"
            onKeyDown={e => { if (e.key === 'Enter') saveCurrentBuild(); }}
          />
          <button onClick={saveCurrentBuild} className="text-xs px-2 py-1 rounded bg-er-gold/20 border border-er-gold/50 text-er-gold hover:bg-er-gold/30 transition-er whitespace-nowrap">💾</button>
        </div>
        <div className="flex gap-1">
          <button onClick={copyBuild} className="flex-1 text-xs px-2 py-1 rounded bg-er-border/30 border border-er-border text-gray-400 hover:text-er-gold hover:border-er-gold/30 transition-er">{copied ? '✓ Copied!' : '📋 Copy Build'}</button>
        </div>
        <div className="flex gap-1">
          <button onClick={shareLink} className="flex-1 text-xs px-2 py-1 rounded bg-er-gold/20 border border-er-gold/50 text-er-gold hover:bg-er-gold/30 transition-er">
            {shareCopied ? '✓ Link Copied!' : '🔗 Share Link'}
          </button>
        </div>
        {savedBuilds.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {savedBuilds.map(b => (
              <div key={b.name} className="flex items-center gap-1 animate-fade-in">
                <button onClick={() => loadBuild(b.name)} className="flex-1 min-w-0 truncate text-left text-xs px-2 py-1 rounded bg-er-bg border border-er-border hover:border-er-gold hover:text-er-gold transition-er text-gray-400">
                  {b.name}
                </button>
                <button onClick={() => deleteBuild(b.name)} className="text-xs px-1.5 py-1 rounded text-red-400 hover:bg-red-900/20 transition-er">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── About box + updater controls ──────────────────────────────────────────────

const isElectron = typeof window !== 'undefined' && (window as any).erApp;

function AboutBox() {
  const [version, setVersion] = useState('1.0.6');
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
  const { buffIds, toggleBuff, setBuffIds } = useBuild();
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
          <AnimatePresence>
            {activeCount > 0 && (
              <motion.span
                key="active-badge"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="text-xs bg-er-gold/20 text-er-gold px-2 py-0.5 rounded-full inline-flex items-center"
              >
                {activeCount} active
              </motion.span>
            )}
            {activeCount > 0 && (
              <motion.button
                key="clear-all"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: 0.04 }}
                onClick={(e) => { e.stopPropagation(); setBuffIds([]); }}
                className="text-xs bg-er-bg border border-er-border text-gray-400 hover:text-er-gold hover:border-er-gold px-2 py-0.5 rounded-full transition-er"
              >
                Clear All
              </motion.button>
            )}
          </AnimatePresence>
          <span className="text-gray-400 transition-transform duration-200" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
            ▶
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="buff-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <motion.div
              className="space-y-3 pt-1"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.04 } },
              }}
              initial="hidden"
              animate="show"
            >
              {BUFF_CATEGORIES.map((cat) => {
                const catBuffs = buffs.filter((b) => b.category === cat.key);
                if (catBuffs.length === 0) return null;
                return (
                  <motion.div
                    key={cat.key}
                    variants={{
                      hidden: { opacity: 0 },
                      show: { opacity: 1, transition: { staggerChildren: 0.03 } },
                    }}
                  >
                    <p className="text-xs text-gray-500 uppercase mb-1">{cat.label}</p>
                    <div className="space-y-1">
                      {catBuffs.map((b) => {
                        const isActive = buffIds.includes(b.id);
                        const tip = getBuffTip(b.id);
                        return (
                          <motion.label
                            key={b.id}
                            variants={{
                              hidden: { opacity: 0, x: -8 },
                              show: { opacity: 1, x: 0 },
                            }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className={`flex items-center gap-2 cursor-pointer text-xs rounded px-2 py-1 transition-er hover:bg-er-border/20 er-tooltip ${isActive ? 'text-er-gold' : ''}`}
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
                          </motion.label>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const SHORTCUTS = [
    { key: 'Tab',    desc: 'Switch between Weapon AR and Ash of War pages' },
    { key: '/',      desc: 'Focus search box' },
    { key: 'Escape', desc: 'Close modal/dialog' },
    { key: '?',      desc: 'Toggle this help' },
  ];
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-er-surface rounded-lg border border-er-border p-6 max-w-md w-full mx-4 card-glow animate-fade-in-up"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-er text-lg text-gold-grad">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-er-gold transition-er text-xl">✕</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center gap-3 text-sm">
              <kbd className="min-w-[3rem] text-center px-2 py-1 bg-er-bg border border-er-border rounded text-er-gold font-mono text-xs font-semibold">{s.key}</kbd>
              <span className="text-gray-300">{s.desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-500 text-center">Press <kbd className="px-1.5 py-0.5 bg-er-bg border border-er-border rounded text-er-gold font-mono">?</kbd> again to close · Click anywhere to dismiss</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BuildProvider>
        <AppInner />
      </BuildProvider>
    </BrowserRouter>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(false);
  helpOpenRef.current = helpOpen;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        navigate(location.pathname === '/aow' ? '/ar' : '/aow');
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      } else if (e.key === 'Escape') {
        // Close any open modal (dispatch a custom event)
        window.dispatchEvent(new CustomEvent('er-close-modal'));
        setHelpOpen(false);
      } else if (e.key === '?') {
        setHelpOpen(!helpOpenRef.current);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, location.pathname]);

  return (
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
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
