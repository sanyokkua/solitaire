# Features layer

Application services and Redux slices built on top of the domain and solver layers.
`deal/` lands in Phase 3 — Solver & deal service (change `add-solver-deal-service`); the remaining
slices land in Phase 4 — State, persistence & timer.

- `deal/daily.ts` — UTC day key and daily v1 seed list
- `deal/solverClient.ts` — lazy solver Web Worker client: request ids, cancellation (`cancel`, and `cancelHints` for hints alone) and timeout rules, malformed replies fail the client, never-rejecting results
- `deal/dealService.ts` — `createDealService`: `deal({ mode, winnableOnly }, onProgress?)`, `hint(state)` and `dispose()`.
  `deal()` deals Draw 1 (switch on, 40 fresh seeds at 5,000 nodes) and Daily (the UTC day's v1 candidates at 20,000
  nodes, whatever the switch says) through the solver worker, and every other request (Draw 3, Vegas, Draw 1 with the
  switch off) at once on the input thread from one fresh seed, `random`, 1 attempt. The state is
  `dealFromSeed(seed, mode, { verdict, attempts })`, so its deal code reproduces it without the solver.
  `onProgress({ overlay, attempt })` reports each attempt as it starts; `overlay` turns true once the request has been
  pending 160 ms (one timer per request, cleared on settle). Every `deal()` cancels pending requests first and settles
  as `{ status: 'cancelled' }` when a newer one replaces it; if the worker fails, the first seed (Draw 1) or
  `dailySeed(day, 1)` (Daily) is dealt as `random`, 1 attempt. `hint(state)` settles as `{ status: 'hint', source, hint }`,
  `{ status: 'none' }` (won, or no move at all) or `{ status: 'cancelled' }` (a newer hint, any deal or `dispose()`
  replaced it). Draw 1 positions without a pass limit ask the solver (3,000 nodes, 150 ms) and take its first line
  move; no suggestion, a timeout, a failure or a pending deal falls back to the domain heuristic, which is all Draw 3
  and Vegas use. `dispose()` cancels everything and terminates the worker. Exports `WINNABLE_BUDGET`, `MAX_ATTEMPTS`
  and `HINT_BUDGET`
- `game/gameSlice.ts` — session state, history, future, timer accrual
- `game/gameClock.ts` — injected-clock ticker
- `stats/statsSlice.ts` — per-mode and daily statistics
- `preferences/preferencesSlice.ts` — user preferences
- `persistence/{recordCodec,storageGateway,persistenceController}.ts` — versioned
  `solitaire.local-state` codec, storage gateway and hydrate/flush controller

This layer may depend on `src/domain` and Redux Toolkit. It reaches `src/solver` only through the worker
URL (a `new URL(...)` string, not an import) and typed messages, so solver code never loads on the input
thread: type-only imports from `src/solver` are allowed, value imports are lint errors
(`@typescript-eslint/no-restricted-imports` in `eslint.config.js`). It never imports from
`src/ui` — the UI dispatches typed commands into this layer, not the other way round.
