# Domain layer

The pure Klondike game engine (Phase 2 — Card engine).

- `cards.ts` — card id `0..51`, the validity check `isCardId` (for the Phase 4 persistence decoder), suit/rank/colour helpers (`suitOf`, `rankOf`, `cardId`, `colorOf`), labels (`cardLabels`), foundation display order (`FOUNDATION_DISPLAY_ORDER`, ♥ ♣ ♦ ♠, distinct from the ♥ ♦ ♣ ♠ suit encoding), and the shared pile and suit lists `TABLEAU_COLS` and `SUITS`
- `prng.ts` — `mulberry32`, `cryptoSeed()` (injectable `SeedSource`; the only domain module that may reference `crypto`)
- `dealCode.ts` — `encodeDealCode` / `decodeDealCode`: seed+mode ↔ `"1-K7Q29XD"`
- `deal.ts` — `orderedDeck`, Fisher–Yates `shuffle`, `MODES` (the four game modes, the one list the validator, the record codec and the statistics sheet share), `modeConfig`, `dealFromSeed()` (records the seed reduced to unsigned 32 bits)
- `rules.ts` — `canDrop`, `legalTargets`, `isMovable`, `groupAt`, `canRecycle`, `passLimit`, `isWon`, guarded pile accessors
- `engine.ts` — `applyCommand(state, cmd) → { state, events }`; a draw is one `stepTalon`
- `talon.ts` — `stepTalon(stock, waste, draw)`, the one draw-or-recycle rule (it knows no pass limit), and `reachableTops(state)`, the stock and waste cards that drawing alone can bring to the waste top, each once and in draw order, within the pass limit (Draw 3 reaches only the top card of each group of three; the dead end uses it)
- `validate.ts` — `isValidGameState(value): value is GameState`, the total, never-throwing shape and
  invariant check reused by the Phase 4 persistence decoder (design D13); rejects a pass count past the mode's
  `passLimit`; reuses `isCardId` (cards.ts), `MODES` and `modeConfig` (deal.ts), and `isWon` and `passLimit` (rules.ts)
- `scoring.ts` — `startingScore`, per-event and per-command deltas (`eventDelta`, `commandDelta`), the clamped `applyDelta`, `timePenalty`, `winBonus`, `undoCost`, `displayedScore`
- `safeMoves.ts` — `isReady`, `isSafe`, `nextSafeMove`, and the shared source-card scan (`Source`, `sourceCards`)
- `hint.ts` — the hint types (`Hint`, `MoveHint`, `MoveCommand`, `HintPriority`), `hintCandidates` (every productive move, by priority, then canonical source, then destination; reads only what a player sees), `findMove` (its first entry) and `hint`
- `deadEnd.ts` — `isDeadEnd` (no productive move, and no card in `reachableTops` could be played), and `advise` (`Advice`: the dead end when `isDeadEnd` holds, else `hint`; it lives here because `hint.ts` is imported by this module, so putting it in `hint.ts` would be a cycle)
- `position.ts` — `positionKey`, a string over the piles (tableau ids with face states, stock, waste, foundations) that ignores score, moves, time, undos, passes and mode
- `smartTap.ts` — `bestTarget`, the single destination of a smart tap
- `finish.ts` — `FinishPlan`, `finishPlan`
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
  minus the time penalty and `undos × undoCost` (floored at 0 under Standard only), plus the win bonus
  once won.
- **Undo charges.** `GameState.undos` counts undo charges taken in this game; `dealFromSeed` sets it to
  0 and the engine never touches it (a later feature layer increments it on undo). Like `elapsedMs`, it
  survives undo and redo, and it only affects the displayed score, never the stored one.
- **Rejection.** A refused command returns the same state object plus one `rejected` event with a
  typed reason; `applyCommand` never throws.
