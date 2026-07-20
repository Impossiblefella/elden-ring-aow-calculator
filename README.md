# Elden Ring AoW Damage Calculator

A desktop application for calculating weapon Attack Rating (AR) and Ash of War (AoW) damage in Elden Ring, with data parsed directly from `regulation.bin` (patch 1.14).

## Features

- **3,216 weapons** — every weapon in the game, including DLC weapons
- **38 Ashes of War** — projectile, enhanced hit, and simple skill hit calculations
- **16 enemies** — major bosses from base game and DLC
- **16 buffs** — aura, body, talisman, and physick categories with proper stacking rules
- **39 motion value tables** — all weapon types covered
- **Two pages**:
  - **Weapon AR** — sortable, filterable comparison table of all 3,216 weapons; single weapon detail with enemy damage breakdown; side-by-side comparison
  - **Ash of War** — rank every compatible weapon by total damage, projectile damage, status buildup, DPS, or stance damage
- **CSV export** for both AR comparison and AoW ranking
- **Preset builds** — quick-select for common PvP/PvE builds
- **Auto-update** — the app checks for new versions on GitHub and updates automatically
- **localStorage** — your build persists across restarts

## Tech Stack

- **Electron** — desktop app shell
- **React 18 + Vite + Tailwind** — frontend
- **Express** — embedded API server
- **TypeScript** — shared engine library with full type safety
- **Vitest** — unit tests (45 passing)

## Project Structure

```
er-aow-calc/
├── packages/
│   ├── shared/          # Core engine: AR, defense, AoW, buffs, status, ranking
│   ├── server/          # Express API + AoW catalog + regulation data
│   └── web/             # React frontend
├── electron/            # Electron main process + build config
├── CHANGELOG.md
└── package.json         # Monorepo root (npm workspaces)
```

## Development

```bash
# Install dependencies
npm install

# Run dev mode (server + web + electron)
npm run dev

# Run tests
npm test

# Build installer
cd electron && npm run pack

# Build and publish release (requires GH_TOKEN)
cd electron && npm run publish
```

## Contributing

Contributions are welcome! Please see [CHANGELOG.md](./CHANGELOG.md) for release history.

Areas that need help:
- Expanding the Ash of War catalog (currently 38 of 100+)
- Verifying enemy data against in-game values
- Adding weapon buff greases
- NC+ enemy stats

## License

MIT
