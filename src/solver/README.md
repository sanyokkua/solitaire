# Solver layer

The Klondike solver: bounded depth-first searches (one for Draw 1, one for Draw 3 and Vegas), deal grading and the
worker protocol.

Modules currently in this layer (each is listed as a backticked `name.ts` bullet, and the layer holds
exactly the modules listed here plus this README):

- `solver.ts` — the bounded, iterative Draw 1 depth-first search: `solve(state, budget)` returns a `win`, `loss` or
  `unknown` verdict and the number of nodes expanded, plus the winning line of player commands on a `win`.
- `ordered.ts` — the bounded, iterative ordered-talon search for Draw 3 and Vegas: `solveOrdered(state, budget)` returns
  the same result as `solve`, modelling the stock and waste as ordered piles, three-card draws, recycles and the
  Vegas passes left. Its `loss` is a proof: nothing that could matter is pruned and only the strict safe rule sends a
  card without branching. A `win` line spells its draws out as `{ t: 'd' }` steps. A position that is invalid or
  draws one card gives `unknown` with no nodes. `solver.ts` stays untouched beside it; the model, key and moves are
  in `docs/architecture/domain-and-solver.md`.
- `line.ts` — the `SolverMove` type and `expandLine(state, moves)`, which turns the search's moves into draws and
  `move` commands that replay through `applyCommand` (never `autoFoundation`). A `{ t: 'd' }` step is one explicit
  draw (a recycle on an empty stock); the Draw 1 search leaves its draws implicit, and `expandLine` still brings a
  named talon card to the waste top.
- `hint.ts` — the `SolverHint` type and `solverHint(state, budget)`, which turns the first command of the `search` winning
  line into a move, draw or recycle hint, or `undefined` when the search does not prove a win, the position is unsupported or it is already won.
- `search.ts` — `search(state, budget)`, the one entry to the solver for every mode: a position that draws three cards
  (Draw 3, Vegas) goes to `solveOrdered`, one that draws a single card (Draw 1, Daily) to `solve`.
- `grading.ts` — grading v2 (`GRADING_V2`: the parameters and the per-mode thresholds), how forgiving a proven-winnable
  deal is. `gradeDeal(deal)` runs M seeded playouts of a simulated player that sees only face-up cards
  (`playout(state, rng)`, each with `mulberry32(playoutSeed(seed, i))`), and at every `checkpointEvery`-th command asks the
  solver (`search`, at `checkpointBudget` nodes) whether the position is still provably winnable. `survival` counts the
  checkpoints one playout survives (it stops at the first the solver cannot prove, `loss` and `unknown` alike, and a
  playout that wins survives every checkpoint it had left); the deal's score is that count summed over the playouts,
  and `gradeOf` reads it through the mode's row as Easy, Medium or Hard. The player chooses among `hintCandidates`
  (one random value per candidate it walks past, none for the last, which it always takes; one value first for an
  unforced draw when a draw or recycle is also legal), draws or recycles when it has nothing to play, and stops at a win,
  a dead end, a stall (the talon repeats with no board move) or the step cap. Changing the parameters, the rules or the
  thresholds is a new grading version. `GradeTarget` and the `Judge` seam (tests script the solver with it) live here; the
  `Grade` type and the `GRADES` list belong to the domain (`domain/types.ts`, `domain/deal.ts`), because a game records its grade.
- `winnable.ts` — `findWinnable(seeds, budget, mode, options?)`, which deals each candidate seed in `mode`, in order,
  searches it with `search` (unless `options.known` already says how the seed fares) and grades each proven win. With
  the target `any` (the default) it returns the first proven win; with a grade it returns the first win of that grade,
  or, once `gradeLimit` wins have been graded or the seeds run out, the win whose grade is closest (the earlier on a tie),
  labelled with its own grade. The result carries the grade and the `spares`, the other proven candidates it graded.
  With no proven win it returns the last seed as `random`, ungraded. `onAttempt` reports each attempt just before it is
  solved and `onOutcome` each seed it really searched, once its verdict and grade are settled; an empty list throws a
  `RangeError`.
- `protocol.ts` — the `SolverRequest` and `SolverResponse` message types (`findWinnable`, which carries the `mode` its
  seeds are dealt in, an optional `selection` (target grade and `gradeLimit`) and optional `known` verdicts, and `hint`;
  the `progress` posted as each selection attempt starts and the `outcome` posted for each seed it really searched;
  every reply echoes its request `id`; the `findWinnable` reply carries the grade and the spares) and
  `handleRequest(request, post)`, which runs one request and posts its messages. It keeps no state between requests.
- `solver.worker.ts` — the module Web Worker entry point, a short binding: it hands each message it receives to
  `handleRequest` and posts every message back with `self.postMessage`. It holds no logic of its own.

## Layer rules

- A solver module imports only its own siblings (`./name`) and domain modules (`../domain/name`). It
  imports nothing from React, Redux, the DOM, storage or the network, and never from `src/features`,
  `src/app` or `src/ui`.
- It uses no `Math.random` and no `crypto`. All randomness comes from seeded domain code.
- `self` (the worker global scope) appears only in `solver.worker.ts`, the Web Worker entry point.
- The solver runs inside a Web Worker, off the input thread. `src/features` reaches it through the worker
  URL and typed messages only; value imports of solver code from `src/features` are lint errors.
- Enforced by `tests/unit/repo/solverPurity.test.ts` and an ESLint `no-restricted-imports` override in
  `eslint.config.js`.

## Verdict semantics

- A `solve` (Draw 1) `loss` is not a proof that a deal is unwinnable: the search is bounded and prunes, so it can
  only say that it found no win within its budget. A `solveOrdered` (Draw 3, Vegas) `loss` is a proof: every
  reachable position was expanded.
- The search sees face-down cards. It works from the full deal, not from what a player has revealed.
