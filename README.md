# Wildkeep

A 2D browser-based fantasy RPG / incremental adventure game. Cozy town, forest
gathering, procedurally generated dungeons, turn-based combat, loot and
progression — built with React, PixiJS and Zustand.

## Stack

- **TypeScript + React + Vite** — app shell and UI (HUD, inventory, shops, dialogs)
- **PixiJS** — the actual game world (tiles, characters, dungeons) rendered as a real 2D game, not HTML divs
- **Zustand** — global game state (player, inventory, town, dungeon, save)
- **localStorage** — save/load, behind a small persistence abstraction (`src/game/save/`) so it can be swapped for IndexedDB later
- Seedable RNG (`src/game/core/rng.ts`) — dungeon layouts are deterministic per seed

## Running it

```bash
npm install
npm run dev       # dev server
npm run build     # typecheck + production build
npm run preview   # preview the production build
```

## Architecture

```text
src/
  game/         core systems: rng, save, combat/gather/loot logic, dungeon generation
  data/         data-driven content: items, enemies, resource nodes, buildings
  store/        Zustand stores: player, inventory, town, dungeon, game/UI state
  rendering/    PixiJS layer: scenes (town/forest/dungeon), sprites, asset loading
  ui/           React panels: HUD, inventory, equipment, shops, combat
```

Content (items, enemies, gather nodes, buildings) is defined as data in `src/data/`,
so adding new content should mean adding data, not rewriting systems.

## Current scope (V0.1)

Town (tent, store, blacksmith, dungeon gate) → Forest (gather wood/stone/ore/herbs)
→ Dungeon (procedurally generated, seeded, turn-based combat, chests, boss + exit)
→ back to Town to sell, re-equip, and go again.

See the original design brief for the full roadmap (farming, town progression,
relics/builds, automation, offline progression, quests) — the architecture is
built to take these on without rewrites.

## Assets

Pixel art sourced from the `Assets/` folder (Pixel Crawler, Raven Fantasy Icons,
UI packs). Only the sprites actually used by the game are copied into `public/`
under clean paths (`public/sprites/`, `public/icons/`, `public/ui/`); the
original packs stay untouched as the source of truth.
