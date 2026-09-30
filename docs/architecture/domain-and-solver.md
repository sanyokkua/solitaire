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

| Type                               | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/domain/types.ts#GameState`    | One immutable position: `seed`, `mode`, `draw` (1 or 3), `scoring`, `verdict` (`win` or `random`), `attempts`, `grade` (`easy`, `medium`, `hard` or `null`; never set unless the verdict is `win`), `tableau` (7 columns of `{ id, up }`, index 0 is the bottom), `stock`, `waste`, `foundations` (indexed by suit), `score` (stored move score), `moves`, `passes`, `elapsedMs`, `undos`, `started`, `status` (`playing` or `won`). |
| `src/domain/types.ts#Command`      | `draw`, `move { from, index, to }`, or `autoFoundation { from }` (system-initiated).                                                                                                                                                                                                                                                                                                                                                 |
| `src/domain/types.ts#PileRef`      | `stock`, `waste`, `foundation { suit }` or `tableau { col }`.                                                                                                                                                                                                                                                                                                                                                                        |
| `src/domain/types.ts#GameEvent`    | `moved`, `flipped`, `drew`, `recycled`, `won`, `rejected { reason }`.                                                                                                                                                                                                                                                                                                                                                                |
| `src/domain/types.ts#RejectReason` | `game-over`, `not-movable`, `illegal-target`, `pass-limit`, `nothing-to-draw`.                                                                                                                                                                                                                                                                                                                                                       |
| `src/domain/types.ts#Mode`         | `draw1`, `draw3`, `vegas`, `daily`.                                                                                                                                                                                                                                                                                                                                                                                                  |

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
  the canonical unsigned value, so a deal code can always be encoded. `verdict`, `attempts` and `grade` default to `random`, 1 and `null`; none of them changes the layout.
- `src/domain/deal.ts#modeConfig` maps a mode to draw count and scoring:

| Mode    | Draw | Scoring  |
| ------- | ---- | -------- |
| `draw1` | 1    | standard |
| `draw3` | 3    | standard |
| `vegas` | 3    | vegas    |
| `daily` | 1    | standard |

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
- `src/domain/deadEnd.ts#isDeadEnd`: not won, no productive move, and none of the cards `src/domain/talon.ts#reachableTops`
  lists (the talon cards drawing can bring to the waste top, within the draw count and the pass limit) could be played. `src/domain/deadEnd.ts#advise` returns `dead-end` or the hint.
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
- `src/solver/search.ts#search(state, budget)` is the one entry for every mode: a position that draws three cards goes
  to `solveOrdered` (below), one that draws a single card to `solve`.
- `src/solver/winnable.ts#findWinnable(seeds, budget, mode, options?)` deals each seed in `mode` and searches it with
  `search` (unless `options.known` already says how the seed fares). A proven win is graded (below). With the target
  `any`, the default, it returns the first win with its 1-based attempt number. With a grade it returns the first win
  of that grade or, once `gradeLimit` wins have been graded or the seeds run out, the win whose grade is closest to the
  target (the earlier on a tie), labelled with its own grade; the other graded wins come back as `spares`. If none wins
  it returns the last seed as `random`, ungraded, with `attempts = seeds.length`. It throws `RangeError` for an empty
  list and uses no randomness.
- `src/solver/hint.ts#solverHint` turns the first command of the `search` winning line into a hint (`move`, `draw` or
  `recycle`), or `undefined` when no win is proven. The position's own mode picks the search.

### The Draw 1 reference solver

The Draw 1 search in `src/solver/solver.ts` is pinned to a reference: the solver of the original interface prototype, the
`solveDraw1` function (with `mulberry32`, `shuffle` and `dealFrom`, lines 630 to 758) of a single-file HTML mockup. The
prototype is no longer in the working tree; it lives in the repository history at git revision `d72187f`:

```sh
git show d72187f:docs/spec/mockup/klondike-mockup.html
```

`solve` is a faithful iterative port of that function: an explicit stack replaces the recursion, and it visits and counts
nodes in the same order, so it gives the same verdict and the same node count as the reference. The port never changes;
what depends on the reference depends on that, and the values below come from running the reference itself, never from
the port:

- `tests/fixtures/solverCorpus.ts` pins the reference verdict for each of the seeds 1 to 200 at 5,000 nodes: 142 wins, 1
  loss (seed 91) and 57 unknown, with seed 19 the fastest win at 26 nodes. A change to any verdict is made on purpose, by
  regenerating the string from the reference.
- `tests/fixtures/dailyGolden.ts` pins ten Daily v1 selections (seed and attempt) that the reference picks over the
  Daily candidates at 20,000 nodes. A mismatch means the solver, the deal or the seed formula changed a published Daily.
- The mulberry32 vectors in `tests/unit/domain/prng.test.ts` and the golden shuffled deck order of
  `tests/unit/domain/deal.test.ts` are the reference's `mulberry32`, `shuffle` and `dealFrom` output.

What the search does:

- **Talon as a set.** With one card per draw and unlimited passes, every stock and waste card is eventually reachable,
  so the talon is one unordered set and stock cycling disappears from the search. This is invalid for Draw 3 and for
  pass-limited Vegas, which is why `solve` refuses them.
- **Position.** Each column as a face-down count and its cards, the talon set and the four foundation heights.
- **Key.** Foundation heights, the column strings sorted (columns are symmetric) and the talon sorted.
- **Safe sends first.** Before branching, every column top and then every talon card that can go up goes to its
  foundation if its rank is at most 2 or at most the lower opposite-colour foundation plus one; this repeats until
  nothing changes. It is the domain's `isSafe` rule.
- **Move order**, best first: 0 a column top to its foundation; 1 a talon card to its foundation; 2 a whole run that
  uncovers a face-down card; 3 a talon card to a column; 4 a partial run, offered only when the card it uncovers can go to
  its foundation; 5 a King-headed run into the first empty column; 6 a whole run from a column with nothing face down;
  7 a foundation card back to a column.
- **Pruning.** A King already at the base of a column is not moved, and only the first empty column is used. Priority 4
  is a lossy prune: a partial run whose uncovered card cannot go home is never tried.
- **Budget and result.** A node is counted after safe sends, the win check and the visited check; when the count passes
  the budget the verdict is `unknown` (nodes `budget + 1`). `win` returns the line of player commands; `loss` means the
  search ran out of moves, which is not a proof of unwinnability because of the lossy prune and the talon set.

### Why there are two searches

The Draw 1 search is frozen and the ordered-talon search sits beside it (`src/solver/ordered.ts`). `src/solver/search.ts`
routes a position: one card with no pass limit (Draw 1, Daily) goes to `solve`, three cards (Draw 3, Vegas) to
`solveOrdered`. Every pin above, the Daily v1 selections, the corpus, the 26-node count of seed 19 and the midgame lines,
keeps holding with no re-baselining. Two alternatives were rejected: one generalised search for every mode would be
slower for Draw 1 and would change every Daily, and a frozen copy for Daily alone would leave two Draw 1 searches to
maintain.

### Ordered-talon search (Draw 3 and Vegas)

`src/solver/ordered.ts#solveOrdered(state, budget)` searches the modes `solve` refuses: the positions that draw three
cards, Draw 3 with unlimited passes and Vegas with its three. It returns the same `{ verdict, nodes, line? }` and is
built to make a `loss` a proof.

- **Model.** The columns (a face-down count and the face-up cards), the four foundation heights, the stock and the
  waste as ordered piles (top last), and the pass in progress. A recycle turns the waste back into the stock with
  `src/domain/talon.ts#stepTalon`, the same rule the engine and the dead-end check use, so the search cannot disagree
  with the game about what drawing reaches.
- **Key.** Foundation heights, the column strings sorted (columns are symmetric), the exact stock order and the exact
  waste order, and in Vegas the pass in progress. Merging every talon by its order after the next recycle would be
  cheaper, but a part-way arrangement reaches waste tops that a fresh cycle cannot, so `loss` would stop being a proof.
- **Talon moves are macros.** From a node, `stepTalon` is applied until an arrangement repeats (Draw 3) or the recycles
  run out (Vegas). Each arrangement whose waste top can go to a foundation or a column gives one move: draw _k_
  times, recycles included, then play that card. Draws commute with board moves, so a bare draw is never a branch.
  The line spells the draws out as `{ t: 'd' }` steps, which `src/solver/line.ts#expandLine` plays as `draw` commands.
- **Moves,** tried in this order: column to foundation; talon to foundation; a whole run that uncovers a face-down
  card; talon to column; a whole run from a column with nothing face down onto another column; partial runs;
  foundation to column, a King going to the first empty column included (it can carry a Queen).
- **Strict safe sends.** Before branching, column tops go to their foundation when the card is next and its rank is at
  most 2, or both opposite-colour foundations reach rank - 1 and the other same-colour foundation reaches rank - 2.
  The last clause is there because a foundation card can come back down onto a column; the domain's looser `isSafe`
  (used for players and by the Draw 1 search) can discard a win here. The talon is never sent without branching, the
  waste top included: taking a card out of the waste moves every card behind it up a place in the next pass, so a card
  that is safe as a parent can be the spacer that lets a needed card reach the waste top. Talon sends are moves.
- **Pruning** removes only what can never be needed: a King already at the base of a column moving to an empty column,
  and every empty column but the first. Nothing prunes partial runs, column-emptying runs or foundation-to-column
  moves.
- **Budget.** Counted like Draw 1: a node is counted after the safe sends, the win check and the visited check, and
  `budget + 1` means `unknown`. A position that fails `isValidGameState`, or draws one card, gives `unknown` with no
  nodes; a won position gives `win` with an empty line.

### One talon-stepping rule

`src/domain/talon.ts` is the one place the drawing arithmetic lives. `stepTalon(stock, waste, draw)` is one draw of up to
`draw` cards, or, with an empty stock, a recycle that sets `stock` to the waste reversed. `reachableTops(state)` lists the
waste tops that drawing alone can bring up, in draw order, bounded by one full cycle or by the passes left. Three users
share it, so they cannot disagree about what drawing reaches: `engine.ts#applyDraw` (the game), `deadEnd.ts` (it asks
whether any card in `reachableTops` could be played, instead of scanning every talon card; in Draw 1 every card is
reachable, so nothing changes there) and `ordered.ts` (it builds its talon moves from `stepTalon`).

### How the searches are checked

Some published solvers mis-solve benchmark deals, so a solver has to be validated against known results. Here it is
checked from both sides.

- **Soundness.** Every `win` line is replayed through `applyCommand`, and `expandLine` throws on any refusal. The tests
  replay seeds 1 to 50 per mode, the corpus wins and the pinned end-to-end lines.
- **Completeness.** A test-only exhaustive search, `tests/support/bruteForce.ts`, runs over the domain engine with no
  pruning. It tries every legal command and deduplicates on `positionKey` plus, in Vegas, the passes left, because
  `positionKey` covers the piles only and in Vegas the same piles with more passes left can win where fewer cannot. It runs
  over the pinned seeded endgames of `tests/fixtures/endgames.ts`, each with at most 14 cards off the foundations, in
  Draw 3 and in Vegas, and there `solveOrdered`'s `win` and `loss` must equal the brute force's win and no-win; `unknown` is
  not allowed. The set includes positions where the domain's looser `isSafe` rule, or sending the waste top without
  branching, would lose a win.
- The engine is the oracle, so a search cannot drift from the rules the player plays by.

### Grading v1

`src/solver/grading.ts#gradeDeal` says how forgiving a proven-winnable deal is (Easy, Medium or Hard). Deals that only
one narrow line wins are hard; deals that stay winnable through many plausible mistakes are easy.

- Eight seeded playouts of a simulated player that sees only face-up cards (`hintCandidates`, the hint priorities,
  with a take probability of 0.6 and a 5% chance of an unforced draw) walk the deal. The playout of index `i` is seeded
  by `playoutSeed(seed, i)`, so a deal always grades the same.
- After every 10th command the solver (`search`, 3,000 nodes) is asked whether the position is still provably
  winnable; a playout stops at the first checkpoint it cannot prove, and a playout that wins survives every checkpoint
  it had left. Up to ten checkpoints count per playout, so the score runs from 0 to 80.
- The mode's thresholds turn the score into a grade: Easy from 62, Hard up to 43 in Draw 1 (and Daily); 30 and 12 in
  Draw 3; 8 and 0 in Vegas. They were calibrated so that each grade holds at least 15% of the proven-winnable deals
  (`tests/fixtures/gradingGolden.ts`); changing any parameter, rule or threshold is a new grading version.

How the simulated player chooses (`playout`, `choose`):

- It lists `hintCandidates(state)`: every productive move, ordered by hint priority, then canonical source order, then
  target order. The candidates read only what a person sees (face-up runs, which places hold face-down cards, the waste
  top and the foundation heights); permuting the hidden cards never changes them, and a test checks that.
- With a candidate and a legal draw or recycle it first draws with probability 0.05. Otherwise it walks the candidates
  from the first and takes each with probability 0.6; the last candidate is taken when reached, with no random value.
  With no candidate it draws, and recycles when the pass limit allows.
- It stops at a win, when no move, draw or recycle is left, at a stall (the talon returns to an arrangement it had since
  the last board move, so a full cycle played nothing), at 1,000 commands, or at a checkpoint the solver cannot prove.
- Its only randomness is `mulberry32(playoutSeed(seed, i))` with `playoutSeed(s, i) = fmix32((s + imul(i + 1,
0x9e3779b9)) >>> 0)`, where `fmix32` is the MurmurHash3 32-bit finalizer. Both live in `grading.ts`, so the domain's
  `crypto` exception stays where it was. The solver is reached through a `Judge` seam so tests can script it.

Why survival rather than wins: the first design graded a deal by how many of the playouts won it. About 82% of proven
Draw 3 deals won none of 16 playouts, because the simple player rarely wins Draw 3 or Vegas, so no threshold gave every
grade 15%. The playouts stayed and the signal changed to how long they keep the deal provably winnable. Other signals
were rejected: counting distinct winning lines (infeasible, easy deals have millions), the solver's node count (it
depends on move ordering, not on difficulty for a person) and one greedy playout (it wins only about 13% of Draw 1 seeds,
too coarse).

Calibration and cost: `tests/bench/grading.bench.ts` graded the first 60 proven seeds per mode under four parameter
variants; the pinned values give Easy, Medium and Hard about 35 / 32 / 33% of Draw 1 deals, 32 / 32 / 37% of Draw 3 and
27 / 25 / 48% of Vegas. One grading costs about 0.2 s (Draw 1), 0.35 s (Draw 3) and 0.45 s (Vegas) on average on a
desktop, at most about 2 s. It runs in the worker, and only after a `win`. A Daily deal is graded with the Draw 1 row.

### Selection with a target grade

`findWinnable(seeds, budget, mode, { selection, known, onAttempt, onOutcome })` takes `selection = { target, gradeLimit }`
with `target` `any`, `easy`, `medium` or `hard`.

| Case             | What it selects                                                                                                       | Attempts reported         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `target = 'any'` | the first `win`, graded                                                                                               | the position of that seed |
| An exact match   | the first candidate that is a `win` with the requested grade                                                          | its position              |
| No exact match   | the proven candidate whose grade is closest (Easy < Medium < Hard; the earlier on a tie), labelled with its own grade | the candidates tried      |
| Nothing proven   | the last seed as `random`, no grade                                                                                   | the list length           |

- **Grade limit.** Grading is the costly step, so a request stops at the first exact match, or once it has met
  `gradeLimit` (`GRADE_LIMIT`, 4) proven candidates of another grade, and settles for the closest. The bound is a count,
  not a clock, so the same request always selects the same deal; with the 48 candidates it bounds the work of one request.
- **Spares.** The result carries every other proven candidate it graded, as `{ seed, grade }`. The deal service pools them,
  so one search for a Hard deal that meets Easy and Medium deals on the way pays for later requests.
- **Known verdicts.** A request may carry `known` outcomes (`win` with a grade, `loss`, `unknown`), valid only at the
  request's budget. Those seeds are neither searched nor graded again but still count as attempts. Search and grading are
  deterministic, so `known` never changes the result, only the work. The worker posts an `outcome` for each seed it
  really searched, so the service can remember them.
- **Daily** always uses `any` with its pinned v1 plan and is graded afterwards, so a Daily deal's seed and attempts never
  change.
- **No latency target.** Latency is reported, not gated: a cold deal shows the dealing overlay for as long as the search
  takes, because a deal that is really winnable is worth waiting several seconds for, and the pool serves a warm deal at
  once.

### Worker protocol

`src/solver/protocol.ts` defines the messages; `src/solver/solver.worker.ts` is a short binding to
`src/solver/protocol.ts#handleRequest`. Every message carries the request `id`.

| Direction | Message        | Fields                                                  |
| --------- | -------------- | ------------------------------------------------------- |
| request   | `findWinnable` | `id`, `seeds`, `budget`, `mode`, `selection?`, `known?` |
| request   | `hint`         | `id`, `state`, `budget`                                 |
| response  | `progress`     | `id`, `attempt` (posted as each attempt starts)         |
| response  | `outcome`      | `id`, `outcome` (posted for each seed really searched)  |
| response  | `findWinnable` | `id`, `seed`, `verdict`, `attempts`, `grade`, `spares`  |
| response  | `hint`         | `id`, `hint` (key always present, may be `undefined`)   |

`src/features` reaches the worker only by URL and type-only imports; value imports of solver code from
`src/features` are lint errors.

## Deal service

`src/features/deal/dealService.ts#createDealService` turns a request into a dealt game and a position into a hint.
The worker is started lazily by `src/features/deal/solverClient.ts#createSolverClient`.

### `deal({ mode, winnableOnly, target }, onProgress?)`

Each `deal` first cancels every pending deal and hint (a busy worker is terminated).

| Request                                         | Where             | Seeds and budget                                                                                                                                                                                                              |
| ----------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draw1`, `draw3` or `vegas` with `winnableOnly` | pool, else worker | from the pool at once when it holds a deal of the target grade; else 48 fresh `cryptoSeed` values (`MAX_ATTEMPTS`), `winnableBudget(mode)` nodes each (5,000 for Draw 1, 20,000 for Draw 3 and Vegas), selecting for `target` |
| `daily` (any `winnableOnly`)                    | worker            | the 40 v1 candidate seeds of the UTC day, 20,000 nodes each (`DAILY_V1`)                                                                                                                                                      |
| everything else                                 | calling thread    | one fresh seed, `random`, 1 attempt                                                                                                                                                                                           |

- `target` is the grade wanted (`any`, `easy`, `medium`, `hard`; the Difficulty preference). It is ignored when
  `winnableOnly` is off and always `any` for Daily. Selection is described under "Selection with a target grade" above.
- Progress: `onProgress({ overlay, attempt })` for worker deals only; `overlay` turns true after 160 ms pending.
- Fallback: if the worker fails or cannot start, the first candidate seed is dealt as `random`, 1 attempt (for Daily,
  still with its `dayKey`).
- A superseded request settles `{ status: 'cancelled' }` and delivers nothing.
- `winnableOnly` applies to Draw 1, Draw 3 and Vegas; Daily is always searched.

### Deal pool and verdict cache

`src/features/deal/dealPool.ts` and `verdictCache.ts` are created inside the deal service and hold nothing outside
memory. They live on the main thread, with their own worker, rather than inside the solver worker: that worker keeps no
state between requests, `cancel()` terminates a busy worker (so a pool held there would be killed by every player deal),
and hints would queue behind refills.

- **Second worker.** The service builds a second solver client from the same worker factory and hands it to
  `createDealPool`, so it is the same bundled worker chunk. A player's deal or hint never cancels it; a failed pool
  worker drops only the fill in flight and a new worker starts on the next fill.
- **The pool** holds proven, graded deals per mode (Draw 1, Draw 3, Vegas) and grade, at most 2 each, oldest first.
  A filler works on the current choice only, one request at a time: `findWinnable` with 48 fresh seeds, the mode's budget
  and the grade whose bucket holds fewest deals as the target. It pools the selected deal (never a `random` one) and the
  spares that fit; the spares of a player's live search are deposited too. A pooled deal keeps its own grade, and its
  attempts are those of the search that found it (1 for a spare).
- **Serving.** `deal()` with the switch on and a mode that is not Daily takes from the pool first: the oldest deal of the
  target grade, or the oldest of any grade for `any`. A grade the pool lacks is searched live and never served from another
  grade. A pooled deal is dealt at once with no progress report and no overlay, and a refill is scheduled.
- **Termination.** A fill that pools nothing (it ended `random`, everything it found fell in a full bucket, or the worker
  failed) ends the filling until the next `take`, `setChoice`, `resume` or `setBusy(false)`; otherwise a mode whose Hard deals
  are rare, or a worker that keeps failing, would keep the background thread busy for ever. A Daily request or a pending
  player search pauses the filler, and Daily never takes from or deposits into the pool.
- **Control.** `prefetch(choice)` sets the mode and the switch and starts filling; Daily or the switch off fills nothing.
  `pause()` stops new fills after the request in flight. `src/app/dealPoolController.ts` calls them: it starts after the
  first idle period (`requestIdleCallback` with a 2 s timeout, else `setTimeout`, which WebKit and Safari have not reliably
  shipped), calls `prefetch` whenever the selected mode or the switch changes or the page becomes visible,
  and `pause` when it is hidden.
- **Verdict cache.** A least-recently-used map of 256 entries from mode, budget and seed to the worker's outcome. Every
  search sends the entries it holds for its seeds as `known` and records each outcome the worker reports, which saves the work
  of a cancelled and restarted search and of the Daily list, which is the same all day.
- **Why not persist the pool.** Storing it in the record would be a storage change for a gain seen only on the first deal
  after a reload.

### Daily seeds

`src/features/deal/daily.ts`: the day key is the UTC date `YYYY-MM-DD` (`utcDayKey`); attempt `k` (1 to 40) uses seed
`(YYYYMMDD * 131 + k * 7919) >>> 0` (`dailySeed`). The `DAILY_V1` budget (20,000) and attempt cap (40) are pinned:
changing any of them changes every past and future Daily deal, so it would be a new version.

### `hint(state)`

- Won position: `none`.
- Any other position, in every mode (Draw 1, Draw 3, Vegas, Daily): asks the solver (3,000 nodes, `HINT_BUDGET`); its
  answer is used if it arrives within 150 ms. Otherwise (no proof, timeout, failure, or a deal pending) the domain
  heuristic `src/domain/hint.ts#hint` answers.
- A newer hint, any deal, or `dispose()` settles the older hint as `cancelled`; a hint never cancels a deal.

## Related

- [Winnability](../reference/winnability.md): the facts, and how deals are chosen, graded and served for players
- [State and persistence](state-and-persistence.md)
- [Data flows](data-flows.md)
