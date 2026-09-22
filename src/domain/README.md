# Domain layer

The pure Klondike game engine. Lands in Phase 2 — Card engine (pure domain).

- `cards.ts` — card id `0..51`, suit/rank/colour helpers, labels
- `prng.ts` — `mulberry32`, `cryptoSeed()`
- `dealCode.ts` — encode/decode seed+mode ↔ `"1-K7Q29XD"`
- `deal.ts` — Fisher–Yates shuffle, `dealFromSeed()`
- `rules.ts` — `canDrop`, `legalTargets`, `isMovable`, `groupAt`
- `engine.ts` — `applyCommand(state, cmd) → { state, events }`
- `scoring.ts` — score deltas per event, time penalty, bonus
- `assist.ts` — hint heuristic, `isSafe`, finish plan, dead-end detection, `bestTarget`
- `types.ts` — shared domain types

This layer imports nothing from React, Redux, the DOM or storage, and nothing from outside
`src/domain`. It is pure and deterministic, tested with seeded deals.
