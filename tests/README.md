# Tests

Tests live in this top-level tree, mirroring `src/` — never colocated with source.

Naming convention:

- `*.test.ts(x)` — Vitest, run in-process
- `*.spec.ts` — Playwright, run in a real browser

Layers:

- `unit/` — domain, solver and store logic (e.g. `unit/domain/cards.test.ts`, `unit/app/store.test.ts`).
- `unit/app/` — the store, lifecycle helpers and the theme controller.
- `unit/ui/` — the pure board layout (`board/`), the static CSS suites (tokens, board, layout, HUD), contrast and formatting.
- `unit/domain/` — the pure engine: cards, PRNG, deals, rules, scoring and assists (e.g. `validate.test.ts` for the
  stored-game validity check).
- `unit/features/` — the state layer: `deal/`, `game/` (history, clock, thunks), `stats/`, `preferences/` and
  `persistence/` (gateway, codecs, loader, writer, resets)
- `unit/repo/` — repository guard tests: `storageBoundary.test.ts` fails if any non-gateway source file names
  `localStorage` or `sessionStorage`; `solverPurity.test.ts` and `domainPurity.test.ts` scan layer purity;
  `featuresSolverImport.test.ts` lints virtual `src/features/deal/x.ts(x)` files with the real `eslint.config.js` to
  prove a value import of solver code fails and a type-only import passes; `lifecycleStorageGuard.test.ts` tests
  `scripts/validate-lifecycle-storage.mjs` (see "Storage in tests"); and `playwrightProjects.test.ts` checks that
  `playwright.config.ts` runs `deviceFit.spec.ts` only in the `device-fit` project and that each Chromium-only spec
  carries its `test.skip(testInfo.project.name !== 'chromium'` guard
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
its DOM-only `matchMedia` stub when there is no `window`, so it loads in either environment. The stub is query-aware:
it returns a fresh list per call that matches nothing by default and really registers and removes its listeners (both
`addEventListener` and the legacy `addListener`). A test that needs a query to match, or to fire `change`, installs its own
fake (`appLifecycle.wiring.test.tsx` returns one controllable fake per query).

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
from a development machine are not phone numbers; the browser check against the real worker is `tests/e2e/dealLatency.spec.ts` (see below) and the
mid-range-phone check is a documented manual step in Phase 9.

## Storage in tests

No in-process test reads or writes ambient browser storage. A test that saves or loads injects a gateway
(`createStorageGateway(memoryStorage())`, or over `throwingStorage()`, both from `tests/fixtures/storage.ts`) through
the `gateway` thunk dependency or `startApp`'s `extra.gateway`; a store built without one gets a default gateway that the
test never uses. `tests/unit/repo/storageBoundary.test.ts` fails if any `src` file other than
`src/features/persistence/storageGateway.ts` names `localStorage` or `sessionStorage`.

`npm run validate:lifecycle-storage` (`scripts/validate-lifecycle-storage.mjs`, part of `npm run validate`) fails when a
`tests/component/appLifecycle*.test.tsx` file refers to `localStorage`, `sessionStorage` or `Storage.prototype`, builds
a bare `createStorageGateway()`, or calls `startApp` without an injected `gateway`, or when no such test exists.
`tests/unit/repo/lifecycleStorageGuard.test.ts` exercises that script against scratch repositories, one rule at a
time.

Playwright specs run against the production build in a real browser, where the app's own storage is real. They seed a
known position with `seedRecord(page, { current, history?, preferences? })` from `tests/e2e/support/seed.ts`: it
encodes a valid versioned record with `encodeRecord` and installs it with `page.addInitScript` before the first
navigation, writing it only while the key is absent, so a reload exercises the app's real resume. The spec then goes to
`/` and clicks "Continue game". The positions live in `tests/fixtures/boardPositions.ts` (`worstColumnState()`,
`drawThreeFanState()`, `undoMovePosition()`); each must be started and playing, because the codec stores nothing else,
and `tests/unit/features/persistence/boardPositions.decode.test.ts` decodes every one of them. `tests/e2e/board.spec.ts`
smoke-tests the seeded board (52 named cards, the stock name, the panel's `isolation`, a reload).
`tests/e2e/appearance.spec.ts` seeds `drawThreeFanState()` with each appearance preference and reads computed styles: Dark
and System (live, via `page.emulateMedia`) themes, night cards, the four-colour deck and the card backs.
`tests/e2e/motion.spec.ts` seeds `undoMovePosition()` and checks that Undo glides the card back (computed transition timing, rect read mid-glide), that Redo flips the revealed card, and that `reducedMotion: 'reduce'` places it at once. It also deals from Home (no seed, default preferences): the card whose inline `--d` is `756ms` (the last of the 28 dealt) sits on the stock slot in the frame it gets that delay and ends at its `--x` / `--y` target once the delays are cleared. `tests/component/dealAnimation.test.tsx` covers the deal's trigger rules with fake timers (once per epoch, not for started games, interrupted deals restart, reduced motion claims the epoch).
`tests/e2e/resize.spec.ts` seeds `drawThreeFanState()`, rotates the viewport from 402x874 to 874x402 with `page.setViewportSize` and, from a `ResizeObserver` installed beforehand, samples the next animation frame: every card is at its target (board origin plus inline `--x` / `--y`, within 1 px), the page does not scroll, the cards moved, and the moves, the card ids, the clock and the score carry on. `tests/component/board.test.tsx` covers `data-resizing` with a stubbed frame queue (first size, size change, sub-pixel change, cancelled frame). Both e2e specs share `readGame(page)` from `tests/e2e/support/game.ts`.

`tests/e2e/deviceFit.spec.ts` is the device-fit matrix, and it runs once, in its own `device-fit` Chromium project (the six other projects `testIgnore` it): `rtk npx playwright test --project=device-fit`. It takes the 52 configurations (13 screens of R§13.1 x portrait and landscape x browser and installed heights) and 3 baselines from `tests/fixtures/viewports.ts`, which the unit sweep `tests/unit/ui/board/layout.sweep.test.ts` shares, and runs 55 cases. Each seeds `worstColumnState()` before the load, clicks Continue game, and asserts no page scroll, every card inside the board panel, Back, the visible HUD values and the toolbar inside the viewport, the panel's content box at least `boardSizeFor(config)` less 1 px (so a frame change that grows the chrome fails here and needs `CHROME_BUDGET` re-measured), and, for installed configurations, a face-up strip of at least 14 px in column 7; it attaches a screenshot per case to the HTML report. Safe-area insets cannot be emulated, so they are not covered here (see the Phase 9 real-device checklist).

`tests/e2e/visualParity.spec.ts` writes nine screenshots of the table to `test-results/visual-parity/`, each named like the mockup screen it matches in `docs/spec/mockup/screens/` (`03-game-light-desktop.png`, `04-`, `05-`, `06-`, `07-`, `14-` to `17-`) and taken at that file's CSS size (half its pixel size) at 2x, so the two open at the same scale. It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in every test), seeds `freshDrawOneState()`, `freshDrawThreeState()` or `worstColumnState()` with explicit theme and night-card preferences, and asserts only that each file exists and is not empty: there is no pixel diff. Run it with `rtk npx playwright test tests/e2e/visualParity.spec.ts --project=chromium`, then open each PNG beside the mockup screen of the same name and compare the board region by eye; the chips, hint text and the toolbar's remaining tools (Hint, New deal and so on) of the mockup arrive in later phases. CI uploads the folder on every run, passing or failing, as the artifact `visual-parity` (`if: always()` in `.github/workflows/ci.yml`; `tests/unit/repo/configContract.test.ts` asserts the step).

`tests/e2e/dealLatency.spec.ts` ("Latency report") reports how long a Winnable Draw 1 deal takes in a real browser (KS-DEAL-10, KS-PERF-02). It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in the test) and informational: it asserts nothing about the values, only that a solver worker started (a `worker` event whose URL contains `worker`, the built `solver.worker-<hash>.js`). It runs 10 iterations with default preferences (Draw 1, Winnable only); each one opens a fresh browser context and page, because the solver client keeps one worker per page, so every deal pays a cold worker start (the conservative case). Per iteration an init script installs a `PerformanceObserver` for `longtask`, and one `page.evaluate` clicks "Deal cards" and times the click until a `MutationObserver` sees 52 `[data-card-id]` elements. The spec records the median, nearest-rank 95th percentile and maximum of those times, the longest long task, and the worker URL as `test.info().annotations` labelled `(cold-worker)`, and prints one summary line. Read it in the list reporter's output, or in the HTML report (`rtk npx playwright show-report`) under the test's annotations. The numbers come from the development machine or CI runner, not a phone: the 300 ms median and 1.5 s p95 targets are compared against them by eye, and the mid-range-phone check is a documented manual step in Phase 9. Run it with `rtk npx playwright test tests/e2e/dealLatency.spec.ts --project=chromium`.

## Coverage

`rtk npm run test:coverage` measures every file under `src/` (`coverage.include: ['src/**/*.{ts,tsx}']`), so a source
file no test imports still appears in the report at 0% instead of being silently omitted. Only `src/main.tsx` and
`src/vite-env.d.ts` are excluded. Thresholds are a single project-wide floor of 80% for lines, functions, branches and
statements; there is no separate `src/domain` threshold. The text table hides files at 100%, so use the `html` report
in `coverage/` (gitignored) to see every file.
