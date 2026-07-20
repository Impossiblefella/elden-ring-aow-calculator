# Changelog

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
