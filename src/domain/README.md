# Domain layer

The pure Klondike game engine (Phase 2 — Card engine).

- `cards.ts` — card id `0..51`, the validity check `isCardId` (for the Phase 4 persistence decoder), suit/rank/colour helpers (`suitOf`, `rankOf`, `cardId`, `colorOf`), labels (`cardLabels`), foundation display order (`FOUNDATION_DISPLAY_ORDER`, ♥ ♣ ♦ ♠, distinct from the ♥ ♦ ♣ ♠ suit encoding)
- `prng.ts` — `mulberry32`, `cryptoSeed()` (injectable `SeedSource`; the only domain module that may reference `crypto`)
- `dealCode.ts` — `encodeDealCode` / `decodeDealCode`: seed+mode ↔ `"1-K7Q29XD"`
- `deal.ts` — `orderedDeck`, Fisher–Yates `shuffle`, `modeConfig`, `dealFromSeed()` (records the seed reduced to unsigned 32 bits)
- `rules.ts` — `canDrop`, `legalTargets`, `isMovable`, `groupAt`, `canRecycle`, `passLimit`, `isWon`, guarded pile accessors
- `engine.ts` — `applyCommand(state, cmd) → { state, events }`
- `scoring.ts` — `startingScore`, per-event and per-command deltas (`eventDelta`, `commandDelta`), the clamped `applyDelta`, `timePenalty`, `winBonus`, `undoCost`, `displayedScore`
- `assist.ts` — `hint`, `isSafe`, `nextSafeMove`, `finishPlan`, `isDeadEnd`, `bestTarget`
- `types.ts` — shared domain types

This layer imports nothing from React, Redux, the DOM or storage, and nothing from outside
`src/domain`. It is pure and deterministic, tested with seeded deals.

## Conventions

- **No barrel.** There is deliberately no index module; import from the module that owns the symbol.
- **Passes.** `GameState.passes` is the ordinal of the pass through the stock in progress; a fresh
  deal has `passes = 1`. The pass limit (`passLimit`) is 3 for `vegas` and unlimited for every other
  mode. A recycle is permitted when the stock is empty, the waste is not, and `passes` is below the
  limit; the `recycled` event carries the pass it begins. There is no one-card Vegas mode.
- **Scoring seam.** `applyCommand` stores the _move score_ in `GameState.score`, scoring only the
  events it produced. The time penalty, undo cost and win bonus are separate pure functions applied
  outside the engine, and the _displayed_ score is derived from them (`displayedScore`): the move score
  minus the time penalty (floored at 0 under Standard only), plus the win bonus once won.
- **Rejection.** A refused command returns the same state object plus one `rejected` event with a
  typed reason; `applyCommand` never throws.
