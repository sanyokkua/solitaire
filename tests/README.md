# Tests

Tests live in this top-level tree, mirroring `src/` — never colocated with source.

Naming convention:

- `*.test.ts(x)` — Vitest, run in-process
- `*.spec.ts` — Playwright, run in a real browser

Layers:

- `unit/` — domain, solver and store logic (e.g. `unit/domain/cards.test.ts`, `unit/app/store.test.ts`).
- `unit/domain/` — the pure engine: cards, PRNG, deals, rules, scoring and assists (e.g. `validate.test.ts` for the
  stored-game validity check).
- `unit/features/` — the state layer: `deal/`, `game/` (history, clock, thunks), `stats/`, `preferences/` and
  `persistence/` (gateway, codecs, loader, writer, resets)
- `unit/repo/` — repository guard tests: `storageBoundary.test.ts` fails if any non-gateway source file names
  `localStorage` or `sessionStorage`; `solverPurity.test.ts` and `domainPurity.test.ts` scan layer purity;
  `featuresSolverImport.test.ts` lints virtual `src/features/deal/x.ts(x)` files with the real `eslint.config.js` to
  prove a value import of solver code fails and a type-only import passes; and `lifecycleStorageGuard.test.ts` tests
  `scripts/validate-lifecycle-storage.mjs` (see "Storage in tests")
- `component/` — React Testing Library component behaviour (e.g. `component/appShell.test.tsx`,
  `component/buildStamp.test.tsx`, `component/appLifecycle.test.tsx` (reload restores the game),
  `component/appLifecycle.wiring.test.tsx` (ticker, writer and page listeners))
- `e2e/` — Playwright end-to-end specs against the built artifact (added in Phase 1)
- `bench/` — the informational KS-PERF-02 latency benchmark for the winnable-deal search (`bench/winnable.bench.ts`); see "Benchmark" below
- `fixtures/` — shared, non-test builders used by unit tests, such as seeded deals and game-state helpers (not
  collected by Vitest). `fixtures/solverCorpus.ts` pins the reference solver's verdict for each of seeds 1 to 200, and
  holds `MIDGAME_POSITIONS` with the `replayLine` and `midgameState` helpers the solver line, hint and service tests share. `fixtures/dailyGolden.ts` pins the Daily v1 seed and attempt count for ten fixed UTC dates. `fixtures/workers.ts` holds the worker doubles the client and deal-service tests share (`StubWorker`, `stubFactory`, `stubAt`, `realFactory`) and the deterministic seed sources `scriptedSeedSource` and `mulberry32SeedSource`. `fixtures/games.ts` holds `playedGame()`, a started Draw 1 game slice with one move played and counted, for component tests that need a resumable game. `fixtures/dealService.ts` holds `fakeDealService()`, a `DealService` whose requests stay pending until the test settles them, a newer `deal()` or `dispose()` cancels the pending ones as the real service does, and settling a settled request throws (`requests`, `resolve(index, state, dayKey?)`, `cancel(index)`, `progress(index, p)`, `disposed`), for thunk and store tests that inject `deps.dealService`. `fixtures/storage.ts` exports `memoryStorage(options?)` and `throwingStorage()`, the in-memory and error-throwing storage doubles persistence tests inject

`setup.ts` is the shared Vitest setup file (`tests/setup.ts`), loaded via `vitest.config.ts`.

## Node-environment and worker tests

Vitest runs in `jsdom` by default (document URL `http://localhost/solitaire/`). A test file that starts a worker (the
worker and deal-service suites) declares `// @vitest-environment node` as its first line; pure solver tests keep jsdom; `setup.ts` skips
its DOM-only `matchMedia` stub when there is no `window`, so it loads in either environment.

Worker entry modules run in-process, with no browser: a test imports `@vitest/web-worker` at the top of the file and then
constructs the real module with `new Worker(new URL('../../../src/solver/solver.worker.ts', import.meta.url), { type: 'module' })`
(`unit/solver/worker.test.ts`). The package is a runtime for the real worker module, not a mock. It executes on the
test's own thread, so a running search blocks timers: tests of timeouts use a silent worker stub with fake timers, never
the real worker. Terminate every worker in `afterEach`. The polyfill's `terminate()` only detaches the message
listeners; it does not stop the worker, so it cannot abort a running search.

Coverage spike finding (D11): v8 does record `src/solver/solver.worker.ts` when it runs through `@vitest/web-worker` (it
shows at 100% in the html report; the text table hides it), so it is not in `coverage.exclude`.

## Benchmark

`rtk npm run bench` (`vitest bench --run`) runs `bench/winnable.bench.ts`, which times `findWinnable` over fixed batches of
40 seeds at 5,000 nodes and prints the median and the 95th percentile against the KS-PERF-02 targets (300 ms median,
1.5 s p95 on a mid-range phone). It is informational: it never asserts on a timing and exits zero whatever the numbers
are. It is not part of `test:unit`, `test`, `validate`, the git hooks or CI, and it is discovered only through
`benchmark.include` in `vitest.config.ts` (the `*.bench.ts` name is outside the test `include`). Vitest 5's bench
statistics have no `p95`, so the benchmark computes it from the raw samples kept by `benchmark.retainSamples`. Numbers
from a development machine are not phone numbers; the browser check against the real worker is Phase 5 and the
mid-range-phone check is a documented manual step in Phase 9.

## Storage in tests

No test reads or writes ambient browser storage. A test that saves or loads injects a gateway
(`createStorageGateway(memoryStorage())`, or over `throwingStorage()`, both from `tests/fixtures/storage.ts`) through
the `gateway` thunk dependency or `startApp`'s `extra.gateway`; a store built without one gets a default gateway that the
test never uses. `tests/unit/repo/storageBoundary.test.ts` fails if any `src` file other than
`src/features/persistence/storageGateway.ts` names `localStorage` or `sessionStorage`.

`npm run validate:lifecycle-storage` (`scripts/validate-lifecycle-storage.mjs`, part of `npm run validate`) fails when a
`tests/component/appLifecycle*.test.tsx` file refers to `localStorage`, `sessionStorage` or `Storage.prototype`, builds
a bare `createStorageGateway()`, or calls `startApp` without an injected `gateway`, or when no such test exists.
`tests/unit/repo/lifecycleStorageGuard.test.ts` exercises that script against scratch repositories, one rule at a
time.

## Coverage

`rtk npm run test:coverage` measures every file under `src/` (`coverage.include: ['src/**/*.{ts,tsx}']`), so a source
file no test imports still appears in the report at 0% instead of being silently omitted. Only `src/main.tsx` and
`src/vite-env.d.ts` are excluded. Thresholds are a single project-wide floor of 80% for lines, functions, branches and
statements; there is no separate `src/domain` threshold. The text table hides files at 100%, so use the `html` report
in `coverage/` (gitignored) to see every file.
