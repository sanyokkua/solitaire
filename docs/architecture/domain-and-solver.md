# Domain, solver and deal service

This page describes the three pure-logic layers: the game engine (`src/domain`), the solver (`src/solver`) and the
deal service (`src/features/deal`). Module-by-module lists live in the layer READMEs and are not repeated here:
[domain](../../src/domain/README.md), [solver](../../src/solver/README.md), [features](../../src/features/README.md).
For the rules themselves see [game-rules.md](../reference/game-rules.md).

## Domain engine

The domain layer imports nothing from React, Redux, the DOM or storage. The single exception is
`src/domain/prng.ts#cryptoSeed`, which reads an injectable entropy source (default `globalThis.crypto`) and throws when
none exists; it never falls back to `Math.random`.

### Types

All in `src/domain/types.ts`.

| Type | Meaning |
| --- | --- |
| `src/domain/types.ts#GameState` | One immutable position: `seed`, `mode`, `draw` (1 or 3), `scoring`, `verdict` (`win` or `random`), `attempts`, `tableau` (7 columns of `{ id, up }`, index 0 is the bottom), `stock`, `waste`, `foundations` (indexed by suit), `score` (stored move score), `moves`, `passes`, `elapsedMs`, `undos`, `started`, `status` (`playing` or `won`). |
| `src/domain/types.ts#Command` | `draw`, `move { from, index, to }`, or `autoFoundation { from }` (system-initiated). |
| `src/domain/types.ts#PileRef` | `stock`, `waste`, `foundation { suit }` or `tableau { col }`. |
| `src/domain/types.ts#GameEvent` | `moved`, `flipped`, `drew`, `recycled`, `won`, `rejected { reason }`. |
| `src/domain/types.ts#RejectReason` | `game-over`, `not-movable`, `illegal-target`, `pass-limit`, `nothing-to-draw`. |
| `src/domain/types.ts#Mode` | `draw1`, `draw3`, `vegas`, `daily`. |

Cards are integers `0..51` (`src/domain/cards.ts#isCardId`); suits are encoded 0 hearts, 1 diamonds, 2 clubs,
3 spades (`src/domain/cards.ts#SUIT_KEYS`).

### `applyCommand`

`src/domain/engine.ts#applyCommand` is pure and total: it never throws and never mutates its input. It returns
`{ state, events }`.

- A refused command returns the very same state object (reference equality) plus one `rejected` event with a reason.
  Callers detect a refusal with `next === before`; `src/features/game/gameThunks.ts#commitCommand` does exactly this.
- A won game refuses everything with `game-over`.
- An accepted command is finished by `accept`: it detects the win, appends `won`, adds the scoring delta to the stored
  score, increments `moves` (except for `autoFoundation`, which is never counted), sets `started` and `status`.
- `move` validates with `src/domain/rules.ts#groupAt` (`not-movable`) and `src/domain/rules.ts#canDrop`
  (`illegal-target`). Lifting a group turns up a newly exposed face-down card and emits `flipped`.
- `draw` moves `min(draw, stock)` cards to the waste (`drew`). With an empty stock it recycles the waste (`recycled`,
  `passes + 1`) if `src/domain/rules.ts#canRecycle` allows, else refuses with `pass-limit`, or `nothing-to-draw` when
  the waste is also empty.

### Deal, seed and shuffle

- `src/domain/prng.ts#mulberry32` is the seeded 32-bit generator; any number is reduced to its unsigned-32-bit residue.
- `src/domain/deal.ts#shuffle` is Fisher–Yates (Durstenfeld), `i` from 51 down to 1, `j` in `[0, i]`.
- `src/domain/deal.ts#dealFromSeed` shuffles the ordered deck with `mulberry32(seed >>> 0)` and deals row by row:
  column `c` gets `c + 1` cards, only the last face up; the remaining 24 cards form the stock. The recorded seed is
  the canonical unsigned value, so a deal code can always be encoded. `verdict` and `attempts` default to `random` and 1.
- `src/domain/deal.ts#modeConfig` maps a mode to draw count and scoring:

| Mode | Draw | Scoring |
| --- | --- | --- |
| `draw1` | 1 | standard |
| `draw3` | 3 | standard |
| `vegas` | 3 | vegas |
| `daily` | 1 | standard |

### Deal codes

`src/domain/dealCode.ts#encodeDealCode` writes `<mode letter>-<seed in upper-case base 36, padded to 7>`; letters are
`1` Draw 1, `3` Draw 3, `V` Vegas, `D` Daily. `src/domain/dealCode.ts#decodeDealCode` trims, ignores case, never
throws and returns `null` for anything else (including a seed above `0xffffffff`). A code reproduces the deal without
the solver; the `verdict` is not encoded.

### Scoring seam

`applyCommand` stores only the move score in `GameState.score`, from the events it produced
(`src/domain/scoring.ts#commandDelta`, applied with `src/domain/scoring.ts#applyDelta`). Time penalty, undo charges
and win bonus are separate pure functions applied outside the engine; `src/domain/scoring.ts#displayedScore` combines
them for display. Numbers are listed in [game-rules.md](../reference/game-rules.md#scoring).

- Standard floors the stored score at 0. Vegas starts at -52 and never floors.
- `GameState.undos` is never changed by the engine; the history layer increments it on undo.

### Hints, safe moves, dead end, finish

- `src/domain/hint.ts#findMove` picks the first productive board move in five priorities, each scanned in canonical
  order (columns 0 to 6, then waste; destinations foundations then columns 0 to 6):
  1. a tableau top or the waste top to its foundation;
  2. a whole face-up run sitting on a face-down card, to a non-empty column;
  3. the waste top to any column;
  4. a partial run to a column, exposing a card its foundation is ready for;
  5. a run sitting on a face-down card, to an empty column.
- `src/domain/hint.ts#hint` falls back to `draw` (stock not empty) or `recycle`, else `undefined`.
- `src/domain/deadEnd.ts#isDeadEnd`: not won, no productive move, and the talon either has no playable card or cannot
  be turned over. `src/domain/deadEnd.ts#advise` returns `dead-end` or the hint.
- `src/domain/safeMoves.ts#nextSafeMove` returns the first `autoFoundation` command that is safe (ace and two always;
  otherwise both opposite-colour foundations are within one rank).
- `src/domain/smartTap.ts#bestTarget` is the single destination of a smart tap: foundation, then first non-empty
  column (scanning right of a tableau source, wrapping), then first empty column for a King not already at a base.
- `src/domain/finish.ts#finishPlan` builds the command list that finishes a game whose tableau is all face up, or
  `undefined`.
- `src/domain/position.ts#positionKey` identifies a position ignoring score, moves, time, undos, passes and mode; used
  for once-per-position dead-end reports and hint de-duplication.
- `src/domain/validate.ts#isValidGameState` is the total shape and invariant check used when decoding saved games.

## Solver

`src/solver/solver.ts#solve(state, budget)` is a bounded, iterative depth-first search that returns
`{ verdict: 'win' | 'loss' | 'unknown', nodes, line? }`.

- It supports only Draw 1 with an unlimited pass limit (`draw1`, `daily`). Draw 3 and Vegas positions return
  `unknown` with 0 nodes.
- `nodes` counts distinct expanded positions; when the budget stops the search it is `budget + 1` and the verdict is
  `unknown`. A `loss` means "no win found", not "unwinnable" (see the [solver README](../../src/solver/README.md)).
- The search sees face-down cards. A `win` carries a line of player commands (draws and moves, never
  `autoFoundation`) that replays through `applyCommand`.
- `src/solver/winnable.ts#findWinnable(seeds, budget, onAttempt?)` deals each seed in Draw 1 and returns the first
  proven win with its 1-based attempt number; if none wins it returns the last seed as `random` with
  `attempts = seeds.length`. It throws `RangeError` for an empty list and uses no randomness.
- `src/solver/hint.ts#solverHint` turns the first command of the winning line into a hint (`move`, `draw` or
  `recycle`), or `undefined` when no win is proven.

### Worker protocol

`src/solver/protocol.ts` defines the messages; `src/solver/solver.worker.ts` is a three-line binding to
`src/solver/protocol.ts#handleRequest`. Every message carries the request `id`.

| Direction | Message | Fields |
| --- | --- | --- |
| request | `findWinnable` | `id`, `seeds`, `budget` |
| request | `hint` | `id`, `state`, `budget` |
| response | `progress` | `id`, `attempt` (posted as each attempt starts) |
| response | `findWinnable` | `id`, `seed`, `verdict`, `attempts` |
| response | `hint` | `id`, `hint` (key always present, may be `undefined`) |

`src/features` reaches the worker only by URL and type-only imports; value imports of solver code from
`src/features` are lint errors.

## Deal service

`src/features/deal/dealService.ts#createDealService` turns a request into a dealt game and a position into a hint.
The worker is started lazily by `src/features/deal/solverClient.ts#createSolverClient`.

### `deal({ mode, winnableOnly }, onProgress?)`

Each `deal` first cancels every pending deal and hint (a busy worker is terminated).

| Request | Where | Seeds and budget |
| --- | --- | --- |
| `draw1` with `winnableOnly` | worker | 40 fresh `cryptoSeed` values (`MAX_ATTEMPTS`), 5,000 nodes each (`WINNABLE_BUDGET`) |
| `daily` (any `winnableOnly`) | worker | the 40 v1 candidate seeds of the UTC day, 20,000 nodes each (`DAILY_V1`) |
| everything else | calling thread | one fresh seed, `random`, 1 attempt |

- Progress: `onProgress({ overlay, attempt })` for worker deals only; `overlay` turns true after 160 ms pending.
- Fallback: if the worker fails or cannot start, the first candidate seed is dealt as `random`, 1 attempt (for Daily,
  still with its `dayKey`).
- A superseded request settles `{ status: 'cancelled' }` and delivers nothing.
- `winnableOnly` has no effect on Draw 3 and Vegas: they are not verified.

### Daily seeds

`src/features/deal/daily.ts`: the day key is the UTC date `YYYY-MM-DD` (`utcDayKey`); attempt `k` (1 to 40) uses seed
`(YYYYMMDD * 131 + k * 7919) >>> 0` (`dailySeed`). The `DAILY_V1` budget (20,000) and attempt cap (40) are pinned:
changing any of them changes every past and future Daily deal, so it would be a new version.

### `hint(state)`

- Won position: `none`.
- Draw 1 with no pass limit: asks the solver (3,000 nodes, `HINT_BUDGET`); its answer is used if it arrives within
  150 ms. Otherwise (no suggestion, timeout, failure, or a deal pending) the domain heuristic
  `src/domain/hint.ts#hint` answers.
- Draw 3 and Vegas: heuristic only.
- A newer hint, any deal, or `dispose()` settles the older hint as `cancelled`; a hint never cancels a deal.

The service repeats the solver's support check itself because `src/features` may not import solver code.

## Related

- [State and persistence](state-and-persistence.md)
- [Data flows](data-flows.md)
