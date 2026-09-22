# Features layer

Application services and Redux slices built on top of the domain and solver layers.
`deal/dealService.ts` lands in Phase 3 — Solver & deal service; the remaining slices land in
Phase 4 — State, persistence & timer.

- `deal/dealService.ts` — solver worker client, attempt loop, budgets, timeouts, daily selection
- `game/gameSlice.ts` — session state, history, future, timer accrual
- `game/gameClock.ts` — injected-clock ticker
- `stats/statsSlice.ts` — per-mode and daily statistics
- `preferences/preferencesSlice.ts` — user preferences
- `persistence/{recordCodec,storageGateway,persistenceController}.ts` — versioned
  `solitaire.local-state` codec, storage gateway and hydrate/flush controller

This layer may depend on `src/domain`, `src/solver` and Redux Toolkit. It never imports from
`src/ui` — the UI dispatches typed commands into this layer, not the other way round.
