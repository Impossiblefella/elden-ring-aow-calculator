# Changelog

## v1.0.8 (2026-07-28)

### New Pages & Tools

- **Loadout Planner** (`/loadout`) — design full builds: pick AoW + 4 talisman slots + physick tear + buffs, see effective AR with all multipliers, talisman stacking conflict visualization (✓ stack / ⚠ conflict)
- **Equip Load / Stamina Calculator** (`/equip-load`) — weapon + armor weight sliders, equip load gauge with colored zones (light/medium/heavy/over), roll type indicator, stamina costs per action
- **Versus Mode + Survival Estimator** (`/versus`) — side-by-side enemy comparison, enemy HP scaled by NG cycle, absorption values, damage breakdown bars, hits-to-kill, incoming damage survival estimator with animated health bar drain
- **Talisman Catalog** (`data/talismans.ts`) — 25 talismans with damage multipliers and stacking types (unique/aura/body/weapon), `getStackingInfo()` conflict checker

### AoW Search & Detail

- **Searchable AoW filter bar** — replaced plain dropdown with text search + 3 filter dropdowns (weapon type, damage type, skill category: projectile/enhanced/simple) + favorites toggle
- **AoW detail modal** — click info button to see full motion values, compatible weapon types (named), compatible affinities, projectile flag, base damage, poise damage, FP cost
- **Expanded AshOfWarInfo interface** — optional fields for compatibleWeaponTypes, compatibleAffinities, damageMotionValues, baseDamage, baseBulletDamage, poiseDamage, chargeMultiplier

### Build Management

- **Recent Builds History** — auto-tracks last 5 builds to localStorage, one-click restore from SettingsBox dropdown
- **JSON Import** — paste exported build JSON to load a build, with error handling
- **Community Build Gallery** — 5 preset builds (RL150 Bleed, RL80 STR, RL125 INT, RL150 FAI, DLC Messmer Slayer) with one-click load

### Theme & UX Polish

- **Dark theme polish** — brighter gold (#f5d570), brighter muted text, subtle vignette overlay for depth
- **Weapon compare winner highlight** — #1 ranked row gets gold glow + 👑 crown marker
- **Keyboard navigation** — Arrow Up/Down/PageUp/PageDown/Home/End to navigate weapon ranking table, Enter to search focused weapon
- **NG+7 tooltip** — info tooltip next to enemy selector explaining NG+ cycle HP multiplier (NG+7 = 1.7× HP)
- **DLC badge** — "DLC v1.14" gold badge in header when DLC content is enabled
- **Contribute banner** — Star on GitHub / Contribute / Report Bug links in About box

### Tests

- **9 new ranking integration tests** (92 total, all passing) — weapon ranking sort order, sequential rank assignment, compatibility filtering, empty inputs, different AoW regression, upgrade level scaling

## v1.0.7 (2026-07-27)

### PvP Mode (Headline Feature)

- **PvP Damage Calculator** — all-new page (`/pvp`) with the flat-355-defense PvP formula (patch 1.09+): 0.85× damage scalar, 0.25× status buildup multiplier, realistic RL125-150 player HP pool
- `damageAgainstPlayer()` engine — single-hit and multi-type PvP damage with absorption + negation
- `hitsToKillPvP()` — ceil(HP / damage), color-coded by threat level (red ≤5 hits, yellow ≤10, green >10)
- `pvpStatusProcDamage()` — expected per-hit damage from bleed/frost/poison/rot procs with hits-to-proc, using community-verified PvP thresholds (600 bleed, 600 frost, 600 poison, 1000 rot) and 400 resistance
- **RL presets** — RL125 (Meta, 1900 HP), RL150 (High, 2100 HP), RL60 (Low, 1450 HP), RL200 (Max, 2200 HP) with preset absorption values
- **Target HP slider** — adjustable 1000-2500 HP for custom PvP scenarios
- **Per-damage-type breakdown** — animated bars showing each damage type's contribution
- **Status proc panel** — per-status expected damage, hits-to-proc, with the 0.25× PvP nerf explanation
- **Formula display** — shows the actual formula used: (AR × MV/100 × 0.85) × (1 − absorption%) − 355
- `/api/pvp-damage` server endpoint — mirrors `/api/damage` but uses PvP formula; supports buffs, power stance, crit, charged
- `api.postPvpDamage()` client + `PvPDamageResponse` type
- **PvP nav tab** — "⚔ PvP" in the navigation bar with animated gold-pill styling
- **Tab shortcut** — now cycles through 3 pages: AR → AoW → PvP
- 17 new unit tests (83 total, all passing)

### AoW Catalog Expansion

- **22 new Ashes of War** (57 → 79 total)
- New Enhanced Hit AoWs: War Cry, Braggart's Roar, Hoarfrost Stomp, Golden Land, Carian Greatsword, Carian Grandeur, Royal Knight's Resolve, Spinning Gravity, Black Flame Tornado, Loretta's Slash, Aspects of the Crucible: Tail, Aspects of the Crucible: Wings
- New Projectile AoWs: Moonlight Greatsword, Night-and-Flame Stance, Siluria's Woe, Enchanted Shot, Zamor Ice Storm, Cragblade
- New Simple Skill Hit AoWs: Roar, Regal Beastcloister, Pike Ponch, Impaling Strike, Bleed Siphon

### UX / Polish

- **Reset to defaults** — one-click button in Settings that clears all stats, buffs, toggles, and localStorage with confirmation prompt
- **Shortcut help updated** — Tab shortcut description now mentions all 3 pages
- PvP mode and target HP persisted to localStorage and share links

---

## v1.0.4 (2026-07-22)

### Calculation Features

- **Status proc calculator** — shows how many hits to proc Bleed/Poison/Rot/Frost on the selected enemy, with per-hit buildup and resistance threshold
- **NG+ cycle selector** — dropdown for NG/NG+1...NG+7, scales enemy HP display (NG+ multiplier: +10% per cycle)
- **Power Stance toggle** — dual-wield mode that doubles AR for paired weapons
- **Critical hit modifier** — dropdown for Normal (1.0x), Backstab (1.6x), Riposte (4.0x); applies crit multiplier to damage
- **Charge AoW toggle** — charged attacks use higher motion values (120 vs 100)

### Data Expansion

- **18 new enemies** (total 34) — Bell Bearing Hunter, Night's Cavalry, Fallingstar Beast, Magma Wyrm, Leonine Misbegotten, Crucible Knight (Ordovis), Dragonkin Soldier, Ancestor Spirit, Regal Ancestor Spirit, Valiant Gargoyle, Black Knife Assassin, Eleonora, Sanguine Noble, Necalli, Black Knife Tiche, Cleanrot Knight, Dung Puppet, Iron Chevalier, Cemetery Shade

### UX / Polish

- **Weapon detail modal** — click any weapon row in the AR table to see full breakdown (base AR, scaling, requirements, DLC status, paired status)
- **Save/load build presets** — save named builds to localStorage, load them back; build data includes all stats, upgrade, buffs, enemy, NG+, power stance, crit modifier, charged state
- **Copy build to clipboard** — one-click copy of current build as JSON
- **Keyboard shortcuts** — Tab switches between pages, `/` focuses search, Esc closes modals
- **Compact/dense table toggle** — switch between normal and dense row padding in both AR and AoW tables
- **Fixed enemy absorption card** — properly labeled with element names (PHYS/MAG/FIRE/LIGH/HOLY) instead of raw numbers
- **NG+ HP display** — shows scaled HP with NG+ cycle noted

---

## v1.0.3 (2026-07-21)

### Design Overhaul

- Gold gradient text/buttons, glassmorphism nav, card hover glow, noise texture overlay, Cinzel font for headers
- Page fade-in-up transitions, table row stagger animation, damage number count-up, gold ring loading spinner
- Buff badge slide-in, expand/collapse arrow rotation, pulse animation on update button
- Sortable header glow on hover, buff tooltips with effects, custom checkboxes with gold fill
- Damage comparison bars in compare mode, relative damage bars in AoW ranking
- CSS variable-based theming system, all gray/yellow/red remapped in light theme

---

## v1.0.2 (2026-07-20)

### Added

- **Auto-Updater** — electron-updater integration, checks GitHub Releases on startup, delta/blockmap updates
- **Check for Updates button** — manual update check from About box
- **6 Weapon Greases** — Fire, Magic, Lightning, Holy, Poison, Blood
- **Enemy selector persists across pages** — shared state in BuildContext
- **Dark/Light theme toggle** — CSS variable-based theming
- **Custom app icon** — Elden Ring themed gold ring icon
- **Updater debug log** — %APPDATA%/er-aow-calc/updater.log
- **preload.cjs IPC bridge** — safe renderer-to-main communication

---

## v1.0.1 (2026-07-20)

### Bug Fixes

- **Fixed all 6 failing tests** — `defense.test.ts` imported a non-existent `applyDefense` export. Added `applyDefense` as a positional-args wrapper around the existing `damageAgainstEnemy` function, and extended the engine to support split motion values (array of `[number, string]` tuples) for multi-hit attack calculations.
- **Fixed buff application in `/api/damage`** — the route mutated `result.attackPower` in-place, leaving `scaled` and `weapon` fields inconsistent with the buffed `total`. Now creates a new attackPower map with all fields synced. Also switched from a buggy local `piecewiseDefense` duplicate to the shared `damageAgainstEnemy` function.
- **Fixed NaN handling in `calculateDefenseMultiplier`** — NaN input now returns 0 instead of falling through to the 0.9 cap.
- **Fixed two-handing test** — added `effectiveAttributes` field to `WeaponAttackResult` so the two-handing STR bonus is visible to test assertions and the UI.
- **Removed `piecewiseDefense` duplicate** from server `index.ts` — the local copy diverged from the shared engine implementation.

### Removed

- **Deleted 3 dead component files** — `DamageView.tsx`, `RankingView.tsx`, and `WeaponTable.tsx` were imported in `App.tsx` but never rendered. ~17KB of dead code removed.

### Added

- **12 new enemies** — expanded roster from 4 to 16 bosses:
  - Base game: Radagon of the Golden Order, Elden Beast, Radahn (Festival), Dragonlord Placidusax, Morgott, Margit, Godskin Duo, Astel Naturalborn of the Void, Loretta Knight of the Haligtree, Crucible Knight, Tree Sentinel, Rennala Queen of the Full Moon
  - DLC: Bayle the Dread, Messmer the Impaler, Promised Consort Radahn
- **21 new motion value tables** — added damage and status motion value data for: Greataxe, Flail, Reaper, Fist, Whip, Heavy Thrusting Sword, Light Bow, Bow, Greatbow, Crossbow, Ballista, Small Shield, Medium Shield, Greatshield, Glintstone Staff, Sacred Seal, Great Katana (DLC), Beast Claw (DLC), Hand-to-Hand (DLC), Perfume Bottle (DLC), Throwing Blade (DLC), Thrusting Shield (DLC). The engine no longer falls back to the default 100 MV for these weapon types.
- **localStorage persistence** — character stats, upgrade level, two-handing, and buff selections now persist across page refreshes and app restarts.
- **6 preset builds** — quick-select buttons for common PvP/PvE builds: RL150 Quality, RL150 INT Mage, RL150 Faith, RL125 Bleed Arcane, RL200 Omni, RL60 Colossal. Accessible via a "Presets" toggle in the Character Stats panel.
- **Version display** — the About box now shows the app version alongside the game patch version.
- **Split motion value support** in `damageAgainstEnemy` — accepts `[number, string][]` arrays for multi-hit attacks, computing each sub-hit through the non-linear defense formula independently.

### Changed

- Version bumped from 0.1.0/1.0.0 to 1.0.1 across all 5 `package.json` files (root, shared, server, web, electron).

---

## v1.0.0 (2026-07-19)

### Initial Release

- **3,216 weapons** decoded from regulation.bin v1.14
- **38 Ashes of War** in the catalog (projectile, enhanced hit, simple skill hit)
- **4 enemies** (Malenia, Godfrey, Mohg, Fire Giant)
- **16 buffs** across aura/body/talisman/physick categories
- **18 weapon-type motion value tables** (damage + status)
- **Two pages**: Weapon AR Calculator (table/single/compare modes) and Ash of War Damage Calculator (ranked/compare modes)
- **CSV export** for both AR comparison and AoW ranking tables
- **Electron desktop app** with NSIS installer for Windows
- **Shared character builder** with live AR calculations
- **Buff system** following Elden Ring stacking rules (aura/body/weapon/talisman/physick)
- **45 unit tests** (39 passing at release)
- Shipped as `Elden Ring AoW Calculator Setup 1.0.0.exe`
