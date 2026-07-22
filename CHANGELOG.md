# Changelog

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
