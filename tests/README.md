# Tests

Tests live in this top-level tree, mirroring `src/` — never colocated with source.

Naming convention:

- `*.test.ts(x)` — Vitest, run in-process
- `*.spec.ts` — Playwright, run in a real browser

Layers:

- `unit/` — domain, solver and store logic (e.g. `unit/domain/cards.test.ts`, `unit/app/store.test.ts`).
- `unit/app/` — the store, lifecycle helpers and the theme controller.
- `unit/ui/` — the pure board layout (`board/`), the static CSS suites (tokens, board, layout, HUD), contrast and formatting, and `pixelFont.test.ts`, which reads the `cmap` of the bundled fonts (`tests/support/fontCoverage.ts`, a dependency-free WOFF2 reader) and fails when a string drawn in Press Start 2P uses a character the font lacks.
- `unit/domain/` — the pure engine: cards, PRNG, deals, rules, scoring and assists (e.g. `validate.test.ts` for the
  stored-game validity check).
- `unit/features/` — the state layer: `deal/`, `game/` (history, clock, thunks), `stats/`, `preferences/` and
  `persistence/` (gateway, codecs, loader, writer, resets); `deal/dealServiceContract.ts` registers one `DealService`
  contract suite (a deal per mode, cancellation by a newer deal and by `dispose()`, progress, hint outcomes, `prefetch`
  and `pause` before and after `dispose()`), which
  `deal/dealService.contract.test.ts` runs against the real service on a stub worker and against `fakeDealService()`,
  each through a small harness that settles what the service leaves pending; the same file holds the fake-only cases
  (the index-based `resolve`/`cancel`/`resolveHint` API and its throws, the recorded `prefetches` and `pauses`), so one
  suite guards the fake while the service grows; `deal/dealService.pool.test.ts` covers the service over the pool and
  the verdict cache (stub workers told apart by creation order, and two real workers answering the same request)
- `unit/repo/` — repository guard tests: `storageBoundary.test.ts` fails if any non-gateway source file names
  `localStorage` or `sessionStorage`; `solverPurity.test.ts`, `domainPurity.test.ts`, `boardPurity.test.ts` and
  `layerBoundaries.test.ts` scan layer purity (the pure board layout, and the `i18n` and `pwa` layers that import
  nothing from `app`, `features` or `ui`); `eslintRules.test.ts` lints virtual files with the real `eslint.config.js`
  to prove its import restrictions; `icons.test.ts` and `manifest.test.ts` check that the committed icons equal a fresh
  render of `scripts/generate-icons.mjs` and that `public/manifest.webmanifest` matches the base path;
  `configContract.test.ts` pins the configuration facts (base path, the `validate` chain, the workflows, and that
  `docs/reference/scripts.md` documents every npm script); `traceability.test.ts`, `docsLinks.test.ts` and
  `noSpecPack.test.ts` are the documentation guards (see "Documentation and traceability guards");
  `featuresSolverImport.test.ts` lints virtual files in `src/features/deal/` (an `x.ts` or `x.tsx`) with the real `eslint.config.js` to
  prove a value import of solver code fails and a type-only import passes; `lifecycleStorageGuard.test.ts` tests
  `scripts/validate-lifecycle-storage.mjs` (see "Storage in tests"); `buildInfo.test.ts` tests `resolveBuildInfo` in `scripts/build-info.mjs` (run number, blank-as-absent, UTC time); `validateArtifact.test.ts` runs the four checks of
  `scripts/validate-artifact.mjs` (part of `npm run validate`, after the build) against the mini `dist` trees in
  `tests/fixtures/dist/` (a `good` tree, and broken fixtures holding only the files that differ, laid over it); and `playwrightProjects.test.ts` checks that
  `playwright.config.ts` runs `deviceFit.spec.ts` and `pseudoLocale.spec.ts` only in the `device-fit` project and that each Chromium-only spec
  carries its `test.skip(testInfo.project.name !== 'chromium'` guard and each whole-game spec its `skipOutsideFullGameProjects` guard
- `component/` — React Testing Library component behaviour (e.g. `component/appShell.test.tsx`,
  `component/buildStamp.test.tsx`, `component/appLifecycle.test.tsx` (reload restores the game),
  `component/appLifecycle.wiring.test.tsx` (ticker, writer and page listeners), `component/pseudoLocale.test.tsx`
  (Home, Game with every notice and every sheet under the pseudo catalog: no text or accessible name outside the
  catalogs))
- `unit/support/pseudoLocale.test.ts` — the pseudo-locale builder of `support/pseudoLocale.ts`
- `support/` — test doubles that component tests share, imported by relative path: `testStore.ts` exports
  `testStore(options?)` (`{ preloadedState?, deps? }`, mirroring `createAppStore`'s own options), a store whose
  `ThunkExtra` defaults to a `fakeDealService()`, a fixed `now` and an instant `delay` in place of the real worker and
  timers, and whose `preferences` preloads `defaultPreferences('en')` merged with any `preloadedState.preferences`
  override — every unit and component test that builds a store uses it instead of `createAppStore` directly;
  `renderWithStore.tsx` exports `renderWithStore(ui, options?)` (`TestStoreOptions` plus an optional pre-built `store`
  and a `strict` flag for `StrictMode`), which wraps `ui` in a `Provider` around a `testStore()` (or the given `store`)
  and returns `{ store, ...renderResult }`; `fakeResizeObserver.ts` exports
  `FakeResizeObserver` (records its instances and observe/disconnect calls; `trigger({ width, height })` reports a size
  inside `act`; a test empties `instances` in `beforeEach` and installs it with `vi.stubGlobal('ResizeObserver', ...)`);
  `matchMedia.ts` exports `stubMatchMedia(queries)` (exactly those queries match), `controllableMatchMedia(initial?,
options?)` (one live fake per query, matching only the queries `initial` sets to true; `set(query, matches)` fires
  its listeners inside `act`, `listenerCount(query)`; `options.withoutEventListener` gives lists with no
  `addEventListener`), `removeMatchMedia()` (an environment without `window.matchMedia`) and `restoreMatchMedia()`
  (puts back the `setup.ts` stub, for `afterEach`); all of them are built on the plain factory in `mediaQueryList.ts`
  (`createMediaQueryList`, `createMatchMedia`), which imports nothing from Testing Library, so `setup.ts` and the unit
  tests that hand a `matchMedia` function to the code under test (`unit/app/themeController.test.ts`) share it
- `support/` also holds `boardHarness.tsx` (renders the real `Board` over a `testStore()` with a fake `ResizeObserver` and a pointer-capture stub, for the board input tests), `clipboard.ts` (`stubClipboard()`, a recording `navigator.clipboard`) and `css.ts` (the regex-based stylesheet reading the static CSS suites share).
- `support/` also holds the ordered-talon search's oracle and its position builders (no Testing Library):
  `bruteForce.ts` exports `bruteForceWins(state, allow?, maxPositions?)`, an exhaustive search over `applyCommand` that
  offers every draw, recycle and move and prunes nothing, deduplicating on `positionKey` plus, in Vegas, the passes
  (it throws past `maxPositions`, so a fixture that is too big fails loudly; `allow` narrows the commands to show that a
  win needs a kind of move); `endgames.ts` exports `endgameFromSeed(seed, mode, off, passes?, maxTalon?)`, a seeded
  Draw 3 or Vegas endgame with `off` cards off the foundations, and `layout({ mode, columns, stock?, waste?, passes? })`,
  which writes one out card by card (`Qs`, `Th`, a `_` prefix for face down); `moveKinds.ts` exports the predicates
  `partialRun`, `foundationToColumn` and `emptyingRun` that recognise those moves in a command.
- `e2e/` — Playwright end-to-end specs against the built artifact (seven projects, see `playwright.config.ts`; the full list is in "Flake sweep")
- `bench/` — the informational benchmarks (`winnable.bench.ts`, the KS-PERF-02 latency of the winnable-deal search; `budgets.bench.ts`; `grading.bench.ts`), run by `rtk npm run bench` and never a gate; see "Benchmark" below
- `fixtures/` — shared, non-test builders used by unit tests, such as seeded deals and game-state helpers (not
  collected by Vitest). `fixtures/solverCorpus.ts` pins the reference solver's verdict for each of seeds 1 to 200, and
  holds `MIDGAME_POSITIONS` with the `replayLine` and `midgameState` helpers the solver line, hint and service tests share. `fixtures/endgames.ts` pins the `ENDGAMES` the ordered-talon search is cross-checked on (at most 14 cards off the foundations, each with what the exhaustive search finds and what makes it worth having: talon order, the Vegas pass limit, a part-way talon, the loose safe rule, the waste-top send, a column-emptying run, a card back off a foundation); `unit/solver/ordered.crossCheck.test.ts` runs it and takes about 2 s. `fixtures/dailyGolden.ts` pins the Daily v1 seed and attempt count for ten fixed UTC dates. `fixtures/gradingGolden.ts` pins the grading v2 calibration sample and golden deals per grade. `fixtures/viewports.ts` holds the device matrix (screens, configurations, baselines and the board size each leaves) that the unit sweep and the device-fit e2e specs share. `fixtures/states.ts` holds the `makeState` and column builders behind the small hand-made positions. `fixtures/workers.ts` holds the worker doubles the client and deal-service tests share (`StubWorker`, `stubFactory`, `stubAt`, `realFactory`, and `recordingFactory`, the real worker with each worker's posted requests and replies logged) and the deterministic seed sources `scriptedSeedSource` and `mulberry32SeedSource`. `fixtures/games.ts` holds `playedGame()`, a started Draw 1 game slice with one move played and counted, for component tests that need a resumable game. `fixtures/dealService.ts` holds `fakeDealService()`, a `DealService` whose requests stay pending until the test settles them, a newer `deal()` or `dispose()` cancels the pending ones as the real service does, and settling a settled request throws (`requests`, `resolve(index, state, dayKey?)`, `cancel(index)`, `progress(index, p)`, `disposed`; `hintOutcome`, `hintRequests`, `deferHints`, `resolveHint(index, outcome?)` for hints; `prefetches` and `pauses` record `prefetch` and `pause`), for thunk and store tests that inject `deps.dealService`; `unit/features/deal/dealService.contract.test.ts` keeps it in step with the real service. `fixtures/storage.ts` exports `memoryStorage(options?)` and `throwingStorage()`, the in-memory and error-throwing storage doubles persistence tests inject. `fixtures/deals.ts` holds `WINNING_LINE` (the recorded 117-command Draw 1 winning line for seed 49, design D13) and `parseLine`, which `tests/e2e/support/play.ts` plays through the board, and `nearlyWonState()`, that line played to one command before it wins, for `visualParity.spec.ts`'s cascade shot

`setup.ts` is the shared Vitest setup file (`tests/setup.ts`), loaded via `vitest.config.ts`.

## Test doubles

Real code first: a test runs the real module and asserts what an observer can see (state, rendered output, written
storage), not how often an internal function was called. `vi.fn` and `vi.spyOn` stand in for a callback or a boundary
the test hands in; they do not wrap our own functions to count calls.

Only four test files mock a module of ours, and each has a reason a real module cannot give:

- `unit/solver/hint.defensive.test.ts` mocks the solver entry itself, to force a defensive path that the real solver
  never takes;
- `unit/solver/winnable.selection.test.ts` replaces only `gradeDeal` of `src/solver/grading.ts` (the rest of the module
  is real), so that the grade each seed gets is scripted and selection is tested apart from grading;
- `component/pseudoLocale.test.tsx` and `component/sheets/settings.test.tsx` (`vi.doMock`) register an extra language in
  the static catalog registry, which nothing else can extend at run time.

`rg "vi\.(do)?[mM]ock\(" tests` must list only those four files.

The other doubles stand in for a real boundary:

- **Worker**: `fixtures/workers.ts` (`StubWorker`, `stubFactory`, `stubAt`, `recordingFactory`) and `@vitest-environment node` for the real
  module (see below);
- **Storage**: `fixtures/storage.ts` (`memoryStorage`, `throwingStorage`), always injected (see "Storage in tests");
- **`ResizeObserver`**: the inert stub in `setup.ts`, and `support/fakeResizeObserver.ts` when a test reports a size;
- **`matchMedia`**: one fake, `support/matchMedia.ts` (built on `support/mediaQueryList.ts`, which `setup.ts` also
  uses); no test writes its own;
- **Web Animations** (`support/waapi.ts`) and **pointer capture** (`support/pointer.ts`), which jsdom lacks.

## Node-environment and worker tests

Vitest runs in `jsdom` by default (document URL `http://localhost/solitaire/`). A test file that starts a worker (the
worker and deal-service suites) declares `// @vitest-environment node` as its first line; pure solver tests keep jsdom; `setup.ts` skips
its DOM-only `matchMedia` stub when there is no `window`, so it loads in either environment. The stub is query-aware:
it returns a fresh list per call that matches nothing by default and really registers and removes its listeners (both
`addEventListener` and the legacy `addListener`). A test that needs a query to match, or to fire `change`, installs
`controllableMatchMedia()` from `support/matchMedia.ts` (see "Test doubles").

Worker entry modules run in-process, with no browser: a test imports `@vitest/web-worker` at the top of the file and then
constructs the real module with `new Worker(new URL('../../../src/solver/solver.worker.ts', import.meta.url), { type: 'module' })`
(`unit/solver/worker.test.ts`). The package is a runtime for the real worker module, not a mock. It executes on the
test's own thread, so a running search blocks timers: tests of timeouts use a silent worker stub with fake timers, never
the real worker. Terminate every worker in `afterEach`. The polyfill's `terminate()` only detaches the message
listeners; it does not stop the worker, so it cannot abort a running search.

Coverage spike finding (D11): v8 does record `src/solver/solver.worker.ts` when it runs through `@vitest/web-worker` (it
shows at 100% in the html report; the text table hides it), so it is not in `coverage.exclude`.

## Benchmark

`rtk npm run bench` (`vitest bench --run`) runs three informational benchmarks. None asserts on a number, exits non-zero
or belongs to `test:unit`, `test`, `validate`, the git hooks or CI; they are discovered only through `benchmark.include`
in `vitest.config.ts` (the `*.bench.ts` name is outside the test `include`). Vitest 5's bench statistics have no `p95`,
so `winnable.bench.ts` computes it from the raw samples kept by `benchmark.retainSamples`. Numbers from a development
machine are not phone numbers; the browser check against the real worker is `tests/e2e/dealLatency.spec.ts` (see below)
and the mid-range-phone check is a documented manual step.

- **`bench/winnable.bench.ts`** prints, at each mode's budget from `src/features/deal/budgets.ts`, the verdict
  distribution of the search over 100 fixed seeds and the median and 95th percentile of one cold selection
  (`findWinnable` over a batch of `MAX_ATTEMPTS` = 48 seeds, the selected deal graded, the call the deal service makes for a winnable
  deal), and Draw 1 again asking for the Hard grade (up to `GRADE_LIMIT` proven candidates graded).
- **`bench/budgets.bench.ts`** sweeps the search budget per mode over seeds 1 to 100.
- **`bench/grading.bench.ts`** calibrates grading v2: for the first 60 proven seeds of each mode it prints the score
  histograms of four parameter variants, the thresholds that split the sample most evenly and the cost of one grading.
  `GRADING_CALIBRATION=fixture` prints the sample as `[seed, score]` pairs for `fixtures/gradingGolden.ts`.

Deals are dealt for as long as it takes to prove them winnable: latency is reported, not gated, and a cold deal shows the
dealing overlay. Recorded results (2026-09-30, Apple M1 Pro, Node v24.21.0; a selection tries `MAX_ATTEMPTS` = 48 seeds). Verdicts are identical on every run; timings
vary by a few percent.

| Mode         | Budget (nodes) | Verdicts over 100 seeds (win / loss / unknown) | Selection median | Selection p95 |
| ------------ | -------------- | ---------------------------------------------- | ---------------- | ------------- |
| Draw 1       | 5,000          | 68 / 1 / 31                                    | 119 ms           | 598 ms        |
| Draw 1, Hard | 5,000          | 68 / 1 / 31                                    | 428 ms           | 1.2 s         |
| Draw 3       | 20,000         | 44 / 8 / 48                                    | 745 ms           | 2.9 s         |
| Vegas        | 20,000         | 18 / 19 / 63                                   | 2.5 s            | 8.2 s         |

Search budgets (seeds 1 to 100, mean time of one search): Draw 1 at 5,000 / 20,000 / 50,000 nodes proves 70 / 74 / 78
deals in 29 / 105 / 244 ms; Draw 3 at 20,000 / 50,000 / 100,000 proves 52 / 59 / 64 in 255 / 569 / 1,074 ms; Vegas proves
17 / 23 / 28 in 370 / 874 / 1,677 ms. A raise buys a few more proven deals per hundred seeds while the time per proven
deal doubles or worse, and a selection tries up to 48 seeds, so the budgets stay as they are (a request finds no proven
deal about once in thousands of tries even in Vegas).

Grading v2 (task 7.4 and 7.5, thresholds raised by 20%), 60 proven seeds per mode: the mean cost of one grading is 0.2 s in
Draw 1, 0.33 s in Draw 3 and 0.43 s in Vegas (worst 1.8 s). With the pinned thresholds the shares of Easy, Medium and Hard
are 17 / 33 / 50% in Draw 1 (Easy from 74, Hard up to 52), 18 / 42 / 40% in Draw 3 (36 and 14) and 23 / 28 / 48% in Vegas
(10 and 0); with version 1 they were 35 / 32 / 33%, 32 / 32 / 37% and 27 / 25 / 48% (recorded 2026-09-30, Apple M1 Pro; the
scores are the same, only the thresholds moved). `GRADE_LIMIT` is 8 so that an Easy request, now rarer, still usually ends
with an Easy deal: of 12 sources of fresh seeds tried on Draw 1, 11 found every grade within the limit.

## Winning lines

`tests/fixtures/deals.ts` pins one full winning line per mode: `WINNING_LINE` (Draw 1), `DRAW3_LINE`, `VEGAS_LINE` and
`DAILY_LINE` (which also names its golden UTC `day`). `tests/unit/fixtures/winningLines.test.ts` replays each through
`applyCommand` without the solver and checks the won state, the recorded moves, score and passes, and that no line takes
a card back from a foundation. The end-to-end specs play the same lines through real input.

Recipe for a new line (a throwaway script or a temporary test, never committed):

1. For each seed 1 to 50 (Daily: each pinned golden date with `attempts: 1` in `tests/fixtures/dailyGolden.ts`), run
   `search(dealFromSeed(seed, mode), 20_000)` from `src/solver/search.ts`. It routes Draw 3 and Vegas to the ordered-talon
   search and spells every draw and recycle out as a `draw` command.
2. Keep the results whose verdict is `win` and whose line has no `move` from a foundation, so that every line plays
   through the same gestures as a hand-played game. Take the shortest (ties: the lowest seed).
3. Write the commands as tokens (`d`, or `SRC:INDEX>DST`; see `parseLine`), replay them through `applyCommand` and record
   the stored `moves`, `score` and `passes`. Every command, draws included, is a counted move.

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
`drawThreeFanState()`, `undoMovePosition()`, `aceHomePosition()`, `twoTargetsPosition()`); each must be started and playing, because the codec stores nothing else,
and `tests/unit/features/persistence/boardPositions.decode.test.ts` decodes every one of them. `tests/e2e/board.spec.ts`
smoke-tests the seeded board (52 named cards, the stock name, the panel's `isolation`, a reload).
`tests/e2e/appearance.spec.ts` seeds `drawThreeFanState()` with each appearance preference and reads computed styles: Dark
and System (live, via `page.emulateMedia`) themes, night cards, the four-colour deck and the card backs.
`tests/e2e/motion.spec.ts` seeds `undoMovePosition()` and checks that Undo glides the card back (computed transition timing, rect read mid-glide), that Redo flips the revealed card, and that `reducedMotion: 'reduce'` places it at once. It also deals from Home (no seed, default preferences): the card whose inline `--d` is `756ms` (the last of the 28 dealt) sits on the stock slot in the frame it gets that delay and ends at its `--x` / `--y` target once the delays are cleared. `tests/component/dealAnimation.test.tsx` covers the deal's trigger rules with fake timers (once per epoch, not for started games, interrupted deals restart, reduced motion claims the epoch).
`tests/e2e/resize.spec.ts` seeds `drawThreeFanState()`, rotates the viewport from 402x874 to 874x402 with `page.setViewportSize` and, from a `ResizeObserver` installed beforehand, samples the next animation frame: every card is at its target (board origin plus inline `--x` / `--y`, within 1 px), the page does not scroll, the cards moved, and the moves, the card ids, the clock and the score carry on. `tests/component/board.test.tsx` covers `data-resizing` with a stubbed frame queue (first size, size change, sub-pixel change, cancelled frame). Both e2e specs share `readGame(page)` from `tests/e2e/support/game.ts`.

`tests/e2e/support/play.ts` holds the helpers the whole-game specs below share: `seedWinningGame(page, preferences?, line?)` seeds a pinned winning deal (`WINNING_LINE` by default, from `fixtures/deals.ts`) as a game in progress, Select and place with Smart move off and animations off so a line command never diverges, `expectWon(page, line)` checks the win (announcer, HUD moves and score, and the Win sheet), and `playLine(page, strategy, options?)` plays a list of commands (default: the full recorded line) through one input path (`'tap'`, `'drag'` or `'keyboard'`), asserting after each command that the HUD move count advanced by one and every animation has settled. `tests/e2e/support/lineGestures.ts` translates a `Command` into a `GesturePlan` (`planCommand`), independent of how it is performed, and gives `playLine` the tab/arrow order of the piles (`PILE_ORDER`, `horizontalKey`, `verticalKey`); it touches no page and is a pure command-to-gesture-plan translation, tested on its own under `tests/unit/e2e-support/lineGestures.test.ts`.

`tests/e2e/playByTap.spec.ts`, `playByDrag.spec.ts` and `playByKeyboard.spec.ts` each play the recorded 117-command winning line (seed 49, Draw 1) to a win, by tap, drag and keyboard respectively (`playLine`, under `test.setTimeout(180_000)`), and each also covers a few short scenarios for its own input path: `playByTap.spec.ts` covers a smart tap that moves a card to its one legal place (`oneMovePosition()`) and a double tap that sends an exposed ace home (`aceHomePosition()`); `playByKeyboard.spec.ts` covers Space drawing from the stock with nothing focused, undo/redo/hint/pick-up/Escape from a mid-game position (`oneMovePosition()`), a productive-move hint marking its card (`aceHomePosition()`), and a Smart-move Shift+Enter pick-up placed where the arrows chose rather than where Smart move prefers (`twoTargetsPosition()`). `tests/e2e/playModes.spec.ts` plays the other modes' pinned lines (see "Winning lines"): Draw 3 by keyboard, Vegas by drag, and the Daily deal by tap, started from Home under `page.clock.setFixedTime` on the line's golden date (only `Date` moves, so the real worker selects the pinned seed). The Draw 3 and Vegas tests seed the deal with `seedWinningGame(page, preferences, line)` (Select and place, no automatic moves, animations off) and the Daily test seeds an unrelated game with `seedRecord` and deals from Home; each plays the line with `playLine` and checks the outcome with `expectWon`: the announcer, the HUD moves, and the Win sheet's moves and score (the Vegas bank as pinned; a Standard score as the stored score less the time penalty plus the win bonus for the time the sheet shows). They run in the projects listed in `FULL_GAME_PROJECTS` (`tests/e2e/support/projects.ts`: `chromium`, `firefox`, `webkit` and `iphone-17-pro`) and skip themselves elsewhere through `skipOutsideFullGameProjects(testInfo)`; the short scenarios run in every project. `tests/unit/repo/playwrightProjects.test.ts` asserts that each of the four specs carries that guard. Run them with `rtk npx playwright test playModes playByTap playByDrag playByKeyboard --project=chromium --project=firefox --project=webkit --project=iphone-17-pro`.

`tests/e2e/smoke.spec.ts` also loads the production page fresh and asserts it exposes no store or test hook on `window` (RF "No hook in the bundle"): it diffs `Object.keys(window)` against a pristine iframe's window, ignoring Playwright's own `__pw` keys, and expects nothing left over.

`tests/e2e/deviceFit.spec.ts` and `tests/e2e/pseudoLocale.spec.ts` are the device-fit layer, and they run once, in their own `device-fit` Chromium project (the six other projects `testIgnore` both): `rtk npx playwright test --project=device-fit`. It takes the 52 configurations (the 13 screens of `docs/reference/device-matrix.md` x portrait and landscape x browser and installed heights) and 3 baselines from `tests/fixtures/viewports.ts`, which the unit sweep `tests/unit/ui/board/layout.sweep.test.ts` shares, and runs 55 cases, once in English and once with the record seeded `preferences: { locale: 'uk' }` (110 in all; the Ukrainian pass makes the same assertions, so longer words must not move the reserved frame). Each seeds `worstColumnState()` before the load, clicks Continue game (the tonal button of `.cta-row`, whatever the language), and asserts no page scroll, every card inside the board panel, Back, the visible HUD values and the toolbar inside the viewport, the panel's content box at least `boardSizeFor(config)` less 1 px (so a frame change that grows the chrome fails here and needs `CHROME_BUDGET` re-measured), and, for installed configurations, a face-up strip of at least 14 px in column 7; it attaches a screenshot per case to the HTML report. Safe-area insets cannot be emulated, so they are not covered here (see the real-device checklist in `docs/reference/device-matrix.md`).
`tests/e2e/pseudoLocale.spec.ts` runs the same 55 configurations with every visible text made 30 % longer: an init script (a `MutationObserver` that appends filler words to each text node with letters in it, idempotent, leaving cards, `<kbd>`, inputs, `<script>` and `<style>` alone). On Home it asserts no sideways page scroll, every listed box (top bar, hero, mode and toggle cards, action row, record strip, links) inside the viewport, and the Deal cards bar within the viewport; it opens How to play and Settings and asserts the sheet is at most 88 % of the viewport height, no box or wrapping row (`.setting-row`, `.help-rule`) wider than the viewport or than its own box, and, at 320x480, that the sheet scrolls; on the Game screen it asserts the chips, HUD, hint line, toolbar and footer inside the viewport and no page scroll. Shared measurements live in `tests/e2e/support/layoutChecks.ts`.

### Pseudo-locale (proof that no text bypasses the catalogs)

`tests/support/pseudoLocale.ts` builds a catalog from `en`: vowels accented, `{placeholders}` and plural categories kept, each message at least 30 % longer and wrapped in brackets (`[Úndó···]`). `tests/component/pseudoLocale.test.tsx` registers it as locale `pseudo` by mocking `src/i18n/catalog.ts` (as `settings.test.tsx` does for a third language), renders Home, the Game screen with every notice and every sheet (a `Record<SheetId, ...>` fails to compile when a sheet is added but not covered), and fails on any text node or `aria-label`, `title`, `alt` or `placeholder` that is not bracketed and not language-neutral (digits and symbols, the product name, language names, card ranks, key names, decorative rule glyphs, the `Intl` date). Anything it finds is a string that bypassed the catalog.

`tests/e2e/visualParity.spec.ts` writes seventeen screenshots to `test-results/visual-parity/`, named by screen and state (`home-light-desktop.png`, `home-dark-phone.png`, `game-light-desktop.png`, `game-dark-desktop.png`, `game-dark-night-cards.png`, `game-light-phone.png`, `game-draw3-waste-fan.png`, `game-select-legal-targets.png`, `game-hint.png`, `home-settings-sheet.png`, `home-how-to-play-sheet.png`, `game-win-cascade.png`, `game-win-sheet.png`, `game-phone-landscape-wide-table.png`, `game-foldable-inner-side-rails.png`, `game-foldable-cover-portrait.png` and `game-galaxy-s25-portrait-browser.png`), each at 2x. It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in every test). The Home and sheet shots seed a record and open the screen or sheet; the table shots seed `freshDrawOneState()`, `freshDrawThreeState()` or `worstColumnState()` with explicit theme and night-card preferences. The interaction shots use a 1180x820 desktop size: `game-select-legal-targets` seeds the recorded winning deal (`seedWinningGame`) and taps the first line move's source card, so the selection ring and the legal-target ghosts show; `game-hint` seeds `aceHomePosition()` (an exposed ace, so the hint is a card move rather than a draw the stock cards would cover) and presses `h`, shooting as soon as the hint line has text (it clears after 2.2 s), so the hinted card's `is-hint` outline and its amber target ghost both show; `game-win-cascade` seeds `nearlyWonState()` (the winning line minus its last command), plays that command by tap, waits for a running cascade animation and shoots 1.2 s in, with the cards mid-flight. Every test asserts only that its file exists and is not empty: there is no pixel diff. Run it with `rtk npx playwright test tests/e2e/visualParity.spec.ts --project=chromium` and open the PNGs beside the committed reference screenshots in `docs/assets/screenshots/` (below); the review and its accepted differences are recorded under "Visual-parity review". CI does not run this spec (the lean CI profile skips it; see `docs/development/ci-and-deployment.md`), so it is a local review tool.

`tests/e2e/screenshots.spec.ts` regenerates the committed reference screenshots of the production build (`docs/assets/screenshots/*.jpg`, quality 80): Home and the Game screen, in the light and the dark theme, on a desktop (1280x900) and a phone (390x844 at 2x), eight files. The Game shots show one fixed winnable Draw 1 position (the recorded winning deal after 30 commands). The spec is opt-in and Chromium-only: it skips itself unless `CAPTURE_SCREENSHOTS=1` (so `rtk npm run e2e` and CI never rewrite the set), and its Chromium guard is listed in `CHROMIUM_ONLY_SPECS`. Regenerate the set with `rtk npm run screenshots` (needs a Unix shell for the variable) whenever a change alters colours, type or layout, review the new images by eye against the old ones, and commit them with the change. No pixel comparison gates any run.

`tests/e2e/dragPerf.spec.ts` ("Drag performance trace", KS-PERF-01) is an informational trace of dragging on a phone. It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in the test; listed in `CHROMIUM_ONLY_SPECS`), and opens its own context (402×874, touch, mobile) after that guard, because `isMobile` does not exist in Firefox. It seeds `worstColumnState()` (a 13-card king-to-ace run under six face-down cards, empty columns 1 to 6), slows the CPU 4× with `Emulation.setCPUThrottlingRate`, starts `browser.startTracing`, and drags the run through columns 1 to 6 with CDP touch events (24 moves each), waiting for each glide to settle. A `requestAnimationFrame` probe records the time between frames over the whole run. The spec attaches the Chromium trace as `drag-trace.json` (open it in DevTools' Performance panel or `chrome://tracing`), records the frame-time median, the 95th percentile and the number of frames over 16.7 ms and over 25 ms as `test.info().annotations`, and prints one summary line. It asserts only that each drag moved the king and that frames and a trace were recorded, never on a timing: the numbers come from the development machine or CI runner under a slowdown, not from a phone (the phone check is a row of `docs/reference/manual-checks.md`). Recorded (2026-09-29, Apple M1 Pro, 4× slowdown): median 16.7 ms, p95 16.8 ms, 17 of 249 frames over 16.7 ms, none over 25 ms. Run it with `rtk npx playwright test dragPerf --project=chromium`.

`tests/e2e/dealLatency.spec.ts` ("Latency report", KS-DEAL-10, KS-DEAL-12, KS-PERF-02) reports how long a Winnable deal takes in a real browser, in each of Draw 1, Draw 3 and Vegas. It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in each test) and informational: it asserts nothing about the values, only that a background solver ran. Every path runs 10 iterations, each on a fresh browser context and page (the solver client keeps one worker per page), and times the click on "Deal cards" until a `MutationObserver` sees 52 `[data-card-id]` elements; a `PerformanceObserver` for `longtask` gives the longest main-thread task. Two paths per mode:

- **On demand, cold worker.** `holdDealPool` stubs `requestIdleCallback`, so the pool never starts and the deal is searched by a newly started player worker; `playerWorker` finds it by creation order and first request (`findWinnable`, the mode, the `any` target) and its URL must contain `worker`.
- **Warm pool.** The pool is left running. Before each deal the spec polls `poolProven(page, mode)` from `support/workers.ts`, which counts the pool worker's own completed `findWinnable` replies with a `win` verdict for that mode (`tagWorkers` records each request's mode by id and counts the replies as the page receives them), so the pool is known to be warm from the worker and never by a fixed wait. The pool fills the mode chosen on Home, so a deal proven for another mode does not count; each warm-pool iteration therefore opens Home on the mode under test through a seeded stored choice (`preferences.selectedMode`), and never switches mode while a fill is in flight. The target is 100 ms in every mode; the spec records how many deals met it.

For information, it also runs Draw 1 on demand with difficulty Hard, and Draw 1 on demand while a pre-verification is in flight: `tagWorkers` calls `window.__afterPoolRequest` in the very task that posts the pool's first fill request, and the spec's hook clicks "Deal cards" there, so the fill cannot have been answered yet (a poll from outside would have to catch a window of about 100 ms). Each path records the median, nearest-rank 95th percentile and maximum, the longest long task, how many deals the pool served, and the worker URL as `test.info().annotations` labelled with the mode and path (`on-demand, cold-worker`, `warm-pool`), and prints one summary line per path. Read them in the list reporter's output, or in the HTML report (`rtk npx playwright show-report`). With 10 deals the nearest-rank 95th percentile is the maximum. The numbers come from the development machine, not a phone: the 300 ms median and 1.5 s p95 targets of Draw 1 are compared against them by eye, and the mid-range-phone check is a row of `docs/reference/manual-checks.md`. Run it with `rtk npx playwright test dealLatency --project=chromium`.

Recorded (2026-09-29, Apple M1 Pro, Desktop Chromium against the production build, 10 deals each; no long task above the observer's 50 ms threshold in any path):

| Path                              | Median    | p95 (max)  | Served from the pool |
| --------------------------------- | --------- | ---------- | -------------------- |
| Draw 1, on demand                 | 110 ms    | 422 ms     | 0 of 10              |
| Draw 3, on demand                 | 333 ms    | 870 ms     | 0 of 10              |
| Vegas, on demand                  | 2.3 s     | 5.4 s      | 0 of 10              |
| Draw 1, Hard, on demand           | 239 ms    | 626 ms     | 0 of 10              |
| Draw 1, on demand, fill in flight | 96–254 ms | 434–560 ms | 0 of 10              |
| Draw 1, warm pool (target 100 ms) | 17 ms     | 26 ms      | 10 of 10             |
| Draw 3, warm pool (target 100 ms) | 15 ms     | 27 ms      | 10 of 10             |
| Vegas, warm pool (target 100 ms)  | 18 ms     | 28 ms      | 10 of 10             |

`tests/e2e/a11y.spec.ts` is the accessibility scan (RF "Accessibility scan", KS-A11Y-01/03). It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in `beforeEach`; listed in `CHROMIUM_ONLY_SPECS`). For each of the light and dark themes (seeded through the `theme` preference) it runs `@axe-core/playwright` on Home, Game and each of the eight sheets (settings, help, stats, dealCode and about opened from Home, newDeal and paused from Game, win by playing the last command of the recorded line) with reduced motion emulated, and fails on any `serious` or `critical` violation, naming each rule id and the selectors it hit. Run it with `rtk npx playwright test a11y --project=chromium`.

`tests/e2e/pwa.spec.ts` is the service-worker layer (RF "End-to-end tests do not use service workers unless they opt in"). `playwright.config.ts` blocks service workers for every spec (`use.serviceWorkers: 'block'`); this spec alone opts in with `test.use({ serviceWorkers: 'allow' })`, and is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in each test; listed in `CHROMIUM_ONLY_SPECS`). Both cases visit Home online and wait for `navigator.serviceWorker.ready` (an active worker means the precache is complete), then call `context.setOffline(true)` and open a new page, which the worker answers from the precache. Navigate with `page.goto('./')`, not `'/'`: offline there is no preview-server redirect from the origin root to `/solitaire/`. "offline cold start" checks Home and both fonts (`document.fonts`), a Winnable Draw 1 deal that starts the solver worker, one stock draw (a move) and the Settings sheet; the second case plays one move, reloads (the route is not persisted, so a cold start opens Home) and reaches the game again through Continue game. Both record every page request with `page.on('request')` and assert each URL has the origin of `baseURL`. Stock clicks use `force: true` because the stacked stock cards cover the slot, and wait for running animations first because the deal glide gates input. The third test, "update after saving", cannot use `context.route`: Playwright routes a service worker's first script fetch but not its update check. It starts `startDistServer()` from `tests/e2e/support/distServer.ts`, a Node HTTP server that serves `dist/` under `/solitaire/` on its own port; `changeWorker()` appends a new comment to `sw.js`, so the browser sees a new version. The test visits, waits for activation and reloads until `navigator.serviceWorker.controller` is set (a new worker waits only behind a controlled page), plays three draws, then changes the worker and calls `registration.update()`: the Update notice appears, Later hides it, a second change and update leaves it hidden (Later lasts for the session), a page reload offers it again, Update reloads onto Home, and Continue game restores the three moves and a time no earlier than before. That choosing Later and reaching the next cold start runs the new version is the Workbox default (`cleanupOutdatedCaches` plus the waiting worker activating when no controlled clients remain), not app behaviour, so no case exercises it. Run it with `rtk npx playwright test pwa --project=chromium`.

## Documentation and traceability guards

Four guards in `unit/repo/` keep the documentation tied to the repository; all run in `test:unit` and `validate`.

- **Traceability.** A test declares the requirement ids it proves with a `// covers: KS-XXX-nn, ...` comment (top of a
  file or a `describe`; fixtures are not scanned). `rtk npm run trace` (`scripts/trace-requirements.mjs`) regenerates
  `docs/reference/traceability.md` from the requirements of `openspec/specs/`, those comments and the rows of
  `docs/reference/manual-checks.md`. `traceability.test.ts` fails when the committed matrix differs from a fresh
  generation, when a test or a manual check declares an id no requirement cites, and when a requirement's id is
  covered by neither a test nor a manual check. Run `rtk npm run trace` and commit the matrix whenever a `covers:`
  comment, a KS citation or a manual check changes.
- **Documentation links.** `docsLinks.test.ts` checks the maintained documents (`README.md`, `CHANGELOG.md`,
  `AGENTS.md`, `docs/**`, the READMEs under `src/` and `tests/`): every relative Markdown link, and every path cited in
  inline code that starts with `src/`, `tests/`, `docs/`, `scripts/`, `public/`, `openspec/` or `.github/` (a trailing
  `#symbol` or `:line` is ignored), must resolve to a file or folder. Globs, brace lists, placeholders, generated folders
  and external links are skipped. It checks that the file exists, not that the cited symbol still does.
- **No retired spec pack.** `noSpecPack.test.ts` fails when the former spec folder under `docs/` exists or when any
  tracked or new file cites it (its file names, or a section citation of the research notes or the specification). The OpenSpec change
  folders, a reference pinned to a git revision (`<sha>:<former path>`, as in "Visual-parity review") and the test's own
  source are exempt.
- **Scripts documentation.** `configContract.test.ts` fails when an npm script of `package.json` has no row in
  `docs/reference/scripts.md`.

## Coverage

`rtk npm run test:coverage` measures every file under `src/` (`coverage.include: ['src/**/*.{ts,tsx}']`), so a source
file no test imports still appears in the report at 0% instead of being silently omitted. Only `src/main.tsx`,
`src/pwa/registerPwa.ts` (the service-worker glue, covered by `tests/e2e/pwa.spec.ts`) and `src/vite-env.d.ts` are excluded. Thresholds are a single project-wide floor of 80% for lines, functions, branches and
statements; there is no separate `src/domain` threshold. `rtk npm run validate` runs the unit and component suites
with `--coverage`, so the thresholds are enforced by the gate. The text table hides files at 100%, so use the `html` report
in `coverage/` (gitignored) to see every file.

### Visual-parity review

All seventeen screenshots of `test-results/visual-parity/` were compared by eye with the mockup screen of the same number (the first column below is the mockup's screen number and title; the mockup is kept in git history: `git show d72187f:docs/spec/mockup/screens/<file>`) after a clean build (`rtk npm run build`, then `rtk npx playwright test visualParity --project=chromium`). The mockup is a visual reference only. The requirements now state the look on their own, so a difference is a defect only where a requirement says otherwise; none was found on the Home, Game and sheet screens. The one defect the review found was outside the pictures: the Vegas detail line drew a minus sign that the pixel font does not have (below).

The visual-parity files carry no numbers; the first column of the table below is the mockup's screen number: 01 `home-light-desktop`, 02 `home-dark-phone`, 03 `game-light-desktop`, 04 `game-dark-desktop`, 05 `game-dark-night-cards`, 06 `game-light-phone`, 07 `game-draw3-waste-fan`, 08 `game-select-legal-targets`, 09 `game-hint`, 10 `home-settings-sheet`, 11 `home-how-to-play-sheet`, 12 `game-win-cascade`, 13 `game-win-sheet`, 14 `game-phone-landscape-wide-table`, 15 `game-foldable-inner-side-rails`, 16 `game-foldable-cover-portrait`, 17 `game-galaxy-s25-portrait-browser`.

**Differences that hold on every screen (accepted):**

- Fixture data differs from the mockup's: seeded deals, dates, scores and times, the deal chip ("Random deal" against the mockup's "Winnable"), and the Daily tile's date.
- The mockup's build-note line ("Mockup build ...") and its "What this mockup shows" link are not built. The Game footer shows the deal code and the build stamp instead, and the Home links row reads Statistics, Settings, Play a deal code, About.
- Text renders in the real Inter font, with slightly tighter letter and word spacing than the mockup's fallback font.
- The Back control is a chevron; the mockup draws an arrow.
- The New deal control is an icon (a plus) with its caption beneath it, and no tile behind the icon: it fills the reserved 2.9rem slot (2.6rem narrow, 2.5rem in the rails), and its touch area grows to 44 px on a coarse pointer instead. The mockup draws a tile with a card icon and puts the caption below the slot.
- The stacked top bar is shorter than the mockup's, so the HUD and the table start a little higher.
- Hint-line key chips read "Ctrl+Z" and "Ctrl+Y", the shortcuts as bound, where the mockup writes "Ctrl Z".
- Card corners: the rank is 0.18 of the card width and the suit 0.23 (the mockup uses 0.15 and 0.19), a deliberate 20 % enlargement.
- Light theme: `--color-primary` is `#3d7093`, darkened from the mockup's `#457b9d` to reach 4.5:1 contrast (Deal cards, toggles and the Got it and Deal again buttons read slightly deeper).
- The sheet backdrop dims the screen behind it without the mockup's blur.
- Mode tile detail lines use 0.55rem pixel type in the tile's ink colour (the mockup uses 0.5rem in a muted colour), so "Standard · 1 card" wraps to two lines on the Draw 1 tile.

**Screen by screen:**

| Screen                          | Verdict                     | Notes                                                                                                                                                                                                                                               |
| ------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Home, light, desktop         | Match, accepted differences | The Winnable card also holds the Difficulty control (Any, Easy, Medium, Hard) and a two-line caption, so the record strip and links start lower; the hero body text is a darker colour; the Draw 1 detail line wraps.                               |
| 02 Home, dark, phone            | Match, accepted differences | The sticky Deal cards / How to play bar is a plain row without the mockup's docked panel, so the Winnable card runs under it at the fold; the hero pitch is the winnable-deals wording; the tile corner suit is larger.                             |
| 03 Game, light, desktop         | Match, accepted differences | Play state is the seeded fresh deal; see the general list for the top bar, New deal control and key chips.                                                                                                                                          |
| 04 Game, dark, desktop          | Match                       | Dark palette, panels, chips and LCD values as the mockup.                                                                                                                                                                                           |
| 05 Game, dark, Night cards      | Match                       | Navy card faces with light ink; only the cards change, the table, chips and panels keep the dark palette.                                                                                                                                           |
| 06 Game, light, phone           | Match, accepted differences | The deal chip shrinks to its icon, as in the mockup; the New deal control has no tile; Undo reads as disabled on the fresh deal.                                                                                                                    |
| 07 Game, Draw 3 waste fan       | Match                       | Three fanned waste cards with only the top one playable, stock count 18.                                                                                                                                                                            |
| 08 Selection and legal targets  | Match                       | The selected card ring and the dashed target ghost under the legal column; the hint line reads the tap-a-spot wording.                                                                                                                              |
| 09 Hint                         | Match, accepted difference  | The fixture is an exposed ace, so the hint is an amber ring on the card and an amber foundation ghost, and the hint line drops the key chips while its text shows (the mockup hints a column move); the Finish tool is highlighted for the fixture. |
| 10 Settings sheet               | Match, accepted differences | Settings is grouped under Appearance and Play headings with Night cards, Four-colour deck and Card back first, and its shot is taken over Home; the mockup shows a flat list over a Game screen with no Card back row. The close button is larger.  |
| 11 How to play sheet            | Match, accepted differences | The shot is scrolled to the end of the sheet (controls, scoring, Winnable deals, Got it) where the mockup shows the top with the four rule steps; the controls table lists one key per row where the mockup groups H, A and N.                      |
| 12 Win cascade                  | Match, accepted difference  | Cards in flight from the last move; Time is dimmed because it is disabled on a won game, as specified.                                                                                                                                              |
| 13 Win sheet                    | Match, accepted differences | Shown over the cascade fixture with a still board; the badge sits above the summary line, and the bonus line reads "0-point time bonus" for the fixture. The heading is in the pixel face, as the mockup.                                           |
| 14 Phone landscape, wide table  | Match                       | Side-rails profile: Back and Settings, Score, Moves, New deal and Time on the left, the toolbar on the right; New deal has no tile.                                                                                                                 |
| 15 Foldable inner, side rails   | Match                       | Same rails at the larger size; the table geometry is chosen independently of the profile.                                                                                                                                                           |
| 16 Foldable cover, portrait     | Match, accepted differences | Stacked profile with the wide table; the fixture is a fresh worst column; top bar, hint line and footer as in the general list.                                                                                                                     |
| 17 Galaxy S25 portrait, browser | Match, accepted difference  | Moves is hidden at 360 px wide, as specified; the hint line shows because the height is above 600 px.                                                                                                                                               |

**Glyphs in the pixel font (defect found and fixed).** The bundled Press Start 2P has Latin, Cyrillic (including `і ї є ґ`), arrows and `№`, but not the minus sign U+2212. `home.modes.vegas.meta` ("−$52 · 3 passes" and its Ukrainian pair) drew that minus in a fallback font on the Vegas tile, so both catalogs now use a hyphen there (as the HUD bank does, `-$52`). Body-font strings keep U+2212, which Inter has. `tests/unit/ui/pixelFont.test.ts` reads the font tables and fails when a message drawn in the pixel font (wordmark, tile corner and detail line, Deal cards, dealing overlay, build stamp, deal code, win heading, key caps and the number formatters) uses an uncovered character, and checks every catalog character against the Inter subset.

## Lighthouse manual check (task 10.2)

Procedure: `npm run build && npm run preview`, then Lighthouse with the mobile preset on `http://localhost:4173/solitaire/`
in a clean profile (Incognito, no extensions). The target is a performance score of at least 90.

| Date       | Tool                                     | Performance | FCP   | LCP   | Notes                                                                                |
| ---------- | ---------------------------------------- | ----------- | ----- | ----- | ------------------------------------------------------------------------------------ |
| 2026-09-28 | DevTools, Chrome 154 (Lighthouse 13.4.1) | 76          | 4.0 s | 4.2 s | Before the font change; accessibility 100, best practices 100, SEO 100               |
| 2026-09-28 | CLI, Lighthouse 13.4.1, median of 3      | 94          | 2.3 s | 2.6 s | After shipping smaller fonts (Inter subset 87 KB, Press Start 2P WOFF2 30 KB)        |
| 2026-09-30 | Edge 154, Lighthouse 13.4.1, mobile      | 95          |       |       | Final check, production preview; desktop 100; accessibility, best practices, SEO 100 |

Cause of the first result: the two bundled fonts (about 470 KB) start loading before the first paint, which the simulated
slow-4G first paint waits for. The fix is in `src/assets/fonts/README.md`. Installability was confirmed by hand: the
install prompt appears in Chrome and Edge and the installed app runs. Lighthouse 13 has no separate PWA category.

## Integration run (task 14.1)

Run on 2026-09-30 (Apple M1 Pro) on the release candidate, after grading v2:

| Command                                          | Result                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `rtk npm run validate`                           | exit 0; coverage 99.29% lines, 95.39% branches, 99.5% functions             |
| `rtk npm run e2e` (all seven projects)           | 585 passed, 402 skipped (guards outside their projects), 0 failed (6.5 min) |
| `rtk npm run bench`                              | exit 0, informational; 3 files, 10 benchmarks (22 min)                      |
| `rtk npm run trace`, then `git diff --exit-code` | traceability matrix unchanged                                               |

## Flake sweep

Run on 2026-09-29 (Apple M1 Pro, 10 cores, default worker count) against the production build, before the release.

| Command                                       | Result                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `rtk npm run test:unit`, three times          | 183 files, 3498 passed and 1 skipped each time; no failure                            |
| `rtk npx playwright test --repeat-each=3`, #1 | 1747 passed, 2 failed, 1032 skipped (19.8 min): the rapid double tap, see below       |
| `rtk npx playwright test --repeat-each=3`, #2 | 1736 passed, 1 failed, 1044 skipped (24.6 min): the in-flight latency test, see below |
| `rtk npx playwright test --repeat-each=3`, #3 | 1737 passed, 0 failed, 1044 skipped (22.4 min)                                        |

Every run covers all seven projects (`chromium`, `firefox`, `webkit`, `iphone-17-pro`, `iphone-14-pro-max`, `galaxy-s25`
and `device-fit`); the skipped tests are the ones that skip themselves outside their projects (the Chromium-only and
whole-game specs, and the touch-only or CDP-only cases).

Flakes found and fixed, each reproduced first and fixed at its cause; no retry was added, and one test now runs in fewer engines (below):

- **`history.spec.ts` "A rapid double tap applies at most one move"** failed on `iphone-14-pro-max` and `galaxy-s25`
  (`released` was `[card, undefined]`). The two taps were sent as two Playwright calls, and the gap between them (median 67 ms,
  up to 316 ms, against the app's 320 ms double-tap window) let the first move commit and leave nothing under the second tap at
  the spot: the board finds a card from its layout, not from where it is drawn. Under 8 workers it failed in 36 of 80 runs. Now
  the taps go through DevTools with explicit event times, which the board reads as the time of the tap: the second tap falls 50 ms
  after the first however long the machine takes, and it is aimed at the card where the move left it (animations off).
  200 of 200 runs pass under 8 workers. Only Chromium (`chromium` and `galaxy-s25`) can time input this way, so the test skips
  itself in the other engines. Firefox and WebKit (including the two iPhone projects) therefore no longer run a browser test of the rapid double tap; the double-tap window is covered by `pointerController.test.ts` and the component tests in jsdom, which use no real engine. This reduction was accepted for 1.0.0.
- **`dealLatency.spec.ts` "Draw 1 on demand while a pre-verification is in flight"** timed out once: a poll from outside the page
  has to catch a window of about 100 ms between the pool's request and its reply, and missed it. The deal is now started by a
  hook inside the very task that posts the pool's first fill request (`__afterPoolRequest` in `support/workers.ts`), so the fill
  cannot have been answered yet.

- **Not reproduced: a stalled pool fill.** One warm-pool Vegas run (with the mode tile clicked after load) waited 120 s for a
  proven deal and timed out; 200 more iterations under load did not repeat it. The pool (`src/features/deal/dealPool.ts`)
  fills again only after a fill that pooled something, so a fill that pooled nothing after the player had changed mode leaves the
  new mode unfilled until the next trigger (a deal taken from the pool, the end of a pending player deal, the page becoming visible again or a change of choice). Deals still work, only cold. The spec now opens
  Home on the mode under test, which avoids the change of mode; the product behaviour is left as the deal-service spec has it
  (accepted for 1.0.0).

CI reruns: not done. CI now runs a lean profile (`E2E_PROFILE=ci`: the three desktop engines, one machine each, without the
keyboard titles and the informational specs; see `docs/development/ci-and-deployment.md`), so the three reruns would
use that profile; the full matrix above stays the local, pre-push run.
