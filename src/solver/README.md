# Solver layer

The bounded-DFS Klondike solver. Lands in Phase 3 — Solver & deal service (change `add-solver-deal-service`).

Modules currently in this layer (each is listed as a backticked `name.ts` bullet, and the layer holds
exactly the modules listed here plus this README):

- `solver.ts` — the bounded, iterative Draw 1 depth-first search: `solve(state, budget)` returns a `win`, `loss` or
  `unknown` verdict and the number of nodes expanded, plus the winning line of player commands on a `win`.
- `line.ts` — the `SolverMove` type and `expandLine(state, moves)`, which turns the search's moves into draws and
  `move` commands that replay through `applyCommand` (never `autoFoundation`).
- `hint.ts` — the `SolverHint` type and `solverHint(state, budget)`, which turns the first command of the winning
  line into a move, draw or recycle hint, or `undefined` when the search does not prove a win, the position is unsupported or it is already won.
- `winnable.ts` — `findWinnable(seeds, budget, onAttempt?)`, which deals each candidate seed in Draw 1 in order and
  returns the first proven win with its attempt number, or the last seed as `random`; it reports each attempt just
  before solving it and throws a `RangeError` for an empty list.
- `protocol.ts` — the `SolverRequest` and `SolverResponse` message types (`findWinnable`, `hint`, and the `progress`
  posted as each selection attempt starts; every reply echoes its request `id`) and `handleRequest(request, post)`,
  which runs one request and posts its messages. It keeps no state between requests.
- `solver.worker.ts` — the module Web Worker entry point, a three-line binding: it hands each message it receives to
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

- A `loss` verdict is not a proof that a deal is unwinnable: the search is bounded and prunes, so it can
  only say that it found no win within its budget.
- The search sees face-down cards. It works from the full deal, not from what a player has revealed.
