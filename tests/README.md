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
  `persistence/` (gateway, codecs, loader, writer, resets); `deal/dealServiceContract.ts` registers one `DealService`
  contract suite (a deal per mode, cancellation by a newer deal and by `dispose()`, progress, hint outcomes), which
  `deal/dealService.contract.test.ts` runs against the real service on a stub worker and against `fakeDealService()`,
  each through a small harness that settles what the service leaves pending; the same file holds the fake-only cases
  (the index-based `resolve`/`cancel`/`resolveHint` API and its throws), so one suite guards the fake while the
  service grows
- `unit/repo/` — repository guard tests: `storageBoundary.test.ts` fails if any non-gateway source file names
  `localStorage` or `sessionStorage`; `solverPurity.test.ts` and `domainPurity.test.ts` scan layer purity;
  `featuresSolverImport.test.ts` lints virtual `src/features/deal/x.ts(x)` files with the real `eslint.config.js` to
  prove a value import of solver code fails and a type-only import passes; `lifecycleStorageGuard.test.ts` tests
  `scripts/validate-lifecycle-storage.mjs` (see "Storage in tests"); `buildInfo.test.ts` tests `resolveBuildInfo` in `scripts/build-info.mjs` (run number, blank-as-absent, UTC time); `validateArtifact.test.ts` runs the four checks of
  `scripts/validate-artifact.mjs` (part of `npm run validate`, after the build) against the mini `dist` trees in
  `tests/fixtures/dist/` (a `good` tree, and broken fixtures holding only the files that differ, laid over it); and `playwrightProjects.test.ts` checks that
  `playwright.config.ts` runs `deviceFit.spec.ts` and `pseudoLocale.spec.ts` only in the `device-fit` project and that each Chromium-only spec
  carries its `test.skip(testInfo.project.name !== 'chromium'` guard
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
- `e2e/` — Playwright end-to-end specs against the built artifact (added in Phase 1)
- `bench/` — the informational KS-PERF-02 latency benchmark for the winnable-deal search (`bench/winnable.bench.ts`); see "Benchmark" below
- `fixtures/` — shared, non-test builders used by unit tests, such as seeded deals and game-state helpers (not
  collected by Vitest). `fixtures/solverCorpus.ts` pins the reference solver's verdict for each of seeds 1 to 200, and
  holds `MIDGAME_POSITIONS` with the `replayLine` and `midgameState` helpers the solver line, hint and service tests share. `fixtures/dailyGolden.ts` pins the Daily v1 seed and attempt count for ten fixed UTC dates. `fixtures/workers.ts` holds the worker doubles the client and deal-service tests share (`StubWorker`, `stubFactory`, `stubAt`, `realFactory`) and the deterministic seed sources `scriptedSeedSource` and `mulberry32SeedSource`. `fixtures/games.ts` holds `playedGame()`, a started Draw 1 game slice with one move played and counted, for component tests that need a resumable game. `fixtures/dealService.ts` holds `fakeDealService()`, a `DealService` whose requests stay pending until the test settles them, a newer `deal()` or `dispose()` cancels the pending ones as the real service does, and settling a settled request throws (`requests`, `resolve(index, state, dayKey?)`, `cancel(index)`, `progress(index, p)`, `disposed`; `hintOutcome`, `hintRequests`, `deferHints`, `resolveHint(index, outcome?)` for hints), for thunk and store tests that inject `deps.dealService`; `unit/features/deal/dealService.contract.test.ts` keeps it in step with the real service. `fixtures/storage.ts` exports `memoryStorage(options?)` and `throwingStorage()`, the in-memory and error-throwing storage doubles persistence tests inject. `fixtures/deals.ts` holds `WINNING_LINE` (the recorded 117-command Draw 1 winning line for seed 49, design D13) and `parseLine`, which `tests/e2e/support/play.ts` plays through the board, and `nearlyWonState()`, that line played to one command before it wins, for `visualParity.spec.ts`'s cascade shot

`setup.ts` is the shared Vitest setup file (`tests/setup.ts`), loaded via `vitest.config.ts`.

## Test doubles

Real code first: a test runs the real module and asserts what an observer can see (state, rendered output, written
storage), not how often an internal function was called. `vi.fn` and `vi.spyOn` stand in for a callback or a boundary
the test hands in; they do not wrap our own functions to count calls.

Only three tests mock a module of ours, and each has a reason a real module cannot give:

- `unit/solver/hint.defensive.test.ts` mocks the solver entry itself, to force a defensive path that the real solver
  never takes;
- `component/pseudoLocale.test.tsx` and `component/sheets/settings.test.tsx` (`vi.doMock`) register an extra language in
  the static catalog registry, which nothing else can extend at run time.

`rg "vi\.(do)?[mM]ock\(" tests` must list only those three files.

The other doubles stand in for a real boundary:

- **Worker**: `fixtures/workers.ts` (`StubWorker`, `stubFactory`, `stubAt`) and `@vitest-environment node` for the real
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
`drawThreeFanState()`, `undoMovePosition()`, `aceHomePosition()`, `twoTargetsPosition()`); each must be started and playing, because the codec stores nothing else,
and `tests/unit/features/persistence/boardPositions.decode.test.ts` decodes every one of them. `tests/e2e/board.spec.ts`
smoke-tests the seeded board (52 named cards, the stock name, the panel's `isolation`, a reload).
`tests/e2e/appearance.spec.ts` seeds `drawThreeFanState()` with each appearance preference and reads computed styles: Dark
and System (live, via `page.emulateMedia`) themes, night cards, the four-colour deck and the card backs.
`tests/e2e/motion.spec.ts` seeds `undoMovePosition()` and checks that Undo glides the card back (computed transition timing, rect read mid-glide), that Redo flips the revealed card, and that `reducedMotion: 'reduce'` places it at once. It also deals from Home (no seed, default preferences): the card whose inline `--d` is `756ms` (the last of the 28 dealt) sits on the stock slot in the frame it gets that delay and ends at its `--x` / `--y` target once the delays are cleared. `tests/component/dealAnimation.test.tsx` covers the deal's trigger rules with fake timers (once per epoch, not for started games, interrupted deals restart, reduced motion claims the epoch).
`tests/e2e/resize.spec.ts` seeds `drawThreeFanState()`, rotates the viewport from 402x874 to 874x402 with `page.setViewportSize` and, from a `ResizeObserver` installed beforehand, samples the next animation frame: every card is at its target (board origin plus inline `--x` / `--y`, within 1 px), the page does not scroll, the cards moved, and the moves, the card ids, the clock and the score carry on. `tests/component/board.test.tsx` covers `data-resizing` with a stubbed frame queue (first size, size change, sub-pixel change, cancelled frame). Both e2e specs share `readGame(page)` from `tests/e2e/support/game.ts`.

`tests/e2e/support/play.ts` holds the helpers the three play-through specs below share: `seedWinningGame(page, preferences?)` seeds the recorded winning deal (`WINNING_LINE.seed` and `.mode` from `fixtures/deals.ts`) as a game in progress, Select and place with Smart move off so a line command never diverges, and `playLine(page, strategy, options?)` plays a list of commands (default: the full recorded line) through one input path (`'tap'`, `'drag'` or `'keyboard'`), asserting after each command that the HUD move count advanced by one and every animation has settled. `tests/e2e/support/lineGestures.ts` translates a `Command` into a `GesturePlan` (`planCommand`), independent of how it is performed, and gives `playLine` the tab/arrow order of the piles (`PILE_ORDER`, `horizontalKey`, `verticalKey`); it touches no page and is a pure command-to-gesture-plan translation, tested on its own under `tests/unit/e2e-support/lineGestures.test.ts`.

`tests/e2e/playByTap.spec.ts`, `playByDrag.spec.ts` and `playByKeyboard.spec.ts` each play the recorded 117-command winning line (seed 49, Draw 1) to a win, by tap, drag and keyboard respectively (`playLine`, under `test.setTimeout(180_000)`), and each also covers a few short scenarios for its own input path: `playByTap.spec.ts` covers a smart tap that moves a card to its one legal place (`oneMovePosition()`) and a double tap that sends an exposed ace home (`aceHomePosition()`); `playByKeyboard.spec.ts` covers Space drawing from the stock with nothing focused, undo/redo/hint/pick-up/Escape from a mid-game position (`oneMovePosition()`), a productive-move hint marking its card (`aceHomePosition()`), and a Smart-move Shift+Enter pick-up placed where the arrows chose rather than where Smart move prefers (`twoTargetsPosition()`). All three specs are Chromium-only (`test.skip(testInfo.project.name !== 'chromium'`), and are listed in `CHROMIUM_ONLY_SPECS` in `tests/unit/repo/playwrightProjects.test.ts`, which asserts each one carries that guard. Run them with `rtk npx playwright test playByTap playByDrag playByKeyboard --project=chromium`.

`tests/e2e/smoke.spec.ts` also loads the production page fresh and asserts it exposes no store or test hook on `window` (RF "No hook in the bundle"): it diffs `Object.keys(window)` against a pristine iframe's window, ignoring Playwright's own `__pw` keys, and expects nothing left over.

`tests/e2e/deviceFit.spec.ts` and `tests/e2e/pseudoLocale.spec.ts` are the device-fit layer, and they run once, in their own `device-fit` Chromium project (the six other projects `testIgnore` both): `rtk npx playwright test --project=device-fit`. It takes the 52 configurations (13 screens of R§13.1 x portrait and landscape x browser and installed heights) and 3 baselines from `tests/fixtures/viewports.ts`, which the unit sweep `tests/unit/ui/board/layout.sweep.test.ts` shares, and runs 55 cases, once in English and once with the record seeded `preferences: { locale: 'uk' }` (110 in all; the Ukrainian pass makes the same assertions, so longer words must not move the reserved frame). Each seeds `worstColumnState()` before the load, clicks Continue game (the tonal button of `.cta-row`, whatever the language), and asserts no page scroll, every card inside the board panel, Back, the visible HUD values and the toolbar inside the viewport, the panel's content box at least `boardSizeFor(config)` less 1 px (so a frame change that grows the chrome fails here and needs `CHROME_BUDGET` re-measured), and, for installed configurations, a face-up strip of at least 14 px in column 7; it attaches a screenshot per case to the HTML report. Safe-area insets cannot be emulated, so they are not covered here (see the Phase 9 real-device checklist).
`tests/e2e/pseudoLocale.spec.ts` runs the same 55 configurations with every visible text made 30 % longer: an init script (a `MutationObserver` that appends filler words to each text node with letters in it, idempotent, leaving cards, `<kbd>`, inputs, `<script>` and `<style>` alone). On Home it asserts no sideways page scroll, every listed box (top bar, hero, mode and toggle cards, action row, record strip, links) inside the viewport, and the Deal cards bar within the viewport; it opens How to play and Settings and asserts the sheet is at most 88 % of the viewport height, no box or wrapping row (`.setting-row`, `.help-rule`) wider than the viewport or than its own box, and, at 320x480, that the sheet scrolls; on the Game screen it asserts the chips, HUD, hint line, toolbar and footer inside the viewport and no page scroll. Shared measurements live in `tests/e2e/support/layoutChecks.ts`.

### Pseudo-locale (proof that no text bypasses the catalogs)

`tests/support/pseudoLocale.ts` builds a catalog from `en`: vowels accented, `{placeholders}` and plural categories kept, each message at least 30 % longer and wrapped in brackets (`[Úndó···]`). `tests/component/pseudoLocale.test.tsx` registers it as locale `pseudo` by mocking `src/i18n/catalog` (as `settings.test.tsx` does for a third language), renders Home, the Game screen with every notice and every sheet (a `Record<SheetId, ...>` fails to compile when a sheet is added but not covered), and fails on any text node or `aria-label`, `title`, `alt` or `placeholder` that is not bracketed and not language-neutral (digits and symbols, the product name, language names, card ranks, key names, decorative rule glyphs, the `Intl` date). Anything it finds is a string that bypassed the catalog.

`tests/e2e/visualParity.spec.ts` writes twelve screenshots to `test-results/visual-parity/`, each named like the mockup screen it matches in `docs/spec/mockup/screens/` (`03-game-light-desktop.png`, `04-`, `05-`, `06-`, `07-`, `08-select-mode-legal-targets.png`, `09-hint.png`, `12-win-cascade.png`, `14-` to `17-`) and taken at that file's CSS size (half its pixel size) at 2x, so the two open at the same scale. It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in every test). The table shots (03-07, 14-17) seed `freshDrawOneState()`, `freshDrawThreeState()` or `worstColumnState()` with explicit theme and night-card preferences. The three interaction shots use the 1180x820 desktop size: 08 seeds the recorded winning deal (`seedWinningGame`) and taps the first line move's source card, so the selection ring and the legal-target ghosts show; 09 seeds `aceHomePosition()` (an exposed ace, so the hint is a card move rather than a draw the stock cards would cover) and presses `h`, shooting as soon as the hint line has text (it clears after 2.2 s), so the hinted card's `is-hint` outline and its amber target ghost both show; 12 seeds `nearlyWonState()` (the winning line minus its last command), plays that command by tap, waits for a running cascade animation and shoots 1.2 s in, with the cards mid-flight. Every test asserts only that its file exists and is not empty: there is no pixel diff. Run it with `rtk npx playwright test tests/e2e/visualParity.spec.ts --project=chromium`, then open each PNG beside the mockup screen of the same name and compare the board region by eye; the header chips and settings button, the New deal button, the key chips and the mockup's hint-line wording are not built yet and arrive in later phases (the Hint and Finish tools, the hint line, the selection ring, ghosts and the win cascade already exist). CI uploads the folder on every run, passing or failing, as the artifact `visual-parity` (`if: always()` in `.github/workflows/ci.yml`; `tests/unit/repo/configContract.test.ts` asserts the step).

`tests/e2e/dealLatency.spec.ts` ("Latency report") reports how long a Winnable Draw 1 deal takes in a real browser (KS-DEAL-10, KS-PERF-02). It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in the test) and informational: it asserts nothing about the values, only that a solver worker started (a `worker` event whose URL contains `worker`, the built `solver.worker-<hash>.js`). It runs 10 iterations with default preferences (Draw 1, Winnable only); each one opens a fresh browser context and page, because the solver client keeps one worker per page, so every deal pays a cold worker start (the conservative case). Per iteration an init script installs a `PerformanceObserver` for `longtask`, and one `page.evaluate` clicks "Deal cards" and times the click until a `MutationObserver` sees 52 `[data-card-id]` elements. The spec records the median, nearest-rank 95th percentile and maximum of those times, the longest long task, and the worker URL as `test.info().annotations` labelled `(cold-worker)`, and prints one summary line. Read it in the list reporter's output, or in the HTML report (`rtk npx playwright show-report`) under the test's annotations. The numbers come from the development machine or CI runner, not a phone: the 300 ms median and 1.5 s p95 targets are compared against them by eye, and the mid-range-phone check is a documented manual step in Phase 9. Run it with `rtk npx playwright test tests/e2e/dealLatency.spec.ts --project=chromium`.

`tests/e2e/a11y.spec.ts` is the accessibility scan (RF "Accessibility scan", KS-A11Y-01/03). It is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in `beforeEach`; listed in `CHROMIUM_ONLY_SPECS`). For each of the light and dark themes (seeded through the `theme` preference) it runs `@axe-core/playwright` on Home, Game and each of the eight sheets (settings, help, stats, dealCode and about opened from Home, newDeal and paused from Game, win by playing the last command of the recorded line) with reduced motion emulated, and fails on any `serious` or `critical` violation, naming each rule id and the selectors it hit. Run it with `rtk npx playwright test a11y --project=chromium`.

`tests/e2e/pwa.spec.ts` is the service-worker layer (RF "End-to-end tests do not use service workers unless they opt in"). `playwright.config.ts` blocks service workers for every spec (`use.serviceWorkers: 'block'`); this spec alone opts in with `test.use({ serviceWorkers: 'allow' })`, and is Chromium-only (`test.skip(testInfo.project.name !== 'chromium'` in each test; listed in `CHROMIUM_ONLY_SPECS`). Both cases visit Home online and wait for `navigator.serviceWorker.ready` (an active worker means the precache is complete), then call `context.setOffline(true)` and open a new page, which the worker answers from the precache. Navigate with `page.goto('./')`, not `'/'`: offline there is no preview-server redirect from the origin root to `/solitaire/`. "offline cold start" checks Home and both fonts (`document.fonts`), a Winnable Draw 1 deal that starts the solver worker, one stock draw (a move) and the Settings sheet; the second case plays one move, reloads (the route is not persisted, so a cold start opens Home) and reaches the game again through Continue game. Both record every page request with `page.on('request')` and assert each URL has the origin of `baseURL`. Stock clicks use `force: true` because the stacked stock cards cover the slot, and wait for running animations first because the deal glide gates input. The third test, "update after saving", cannot use `context.route`: Playwright routes a service worker's first script fetch but not its update check. It starts `startDistServer()` from `tests/e2e/support/distServer.ts`, a Node HTTP server that serves `dist/` under `/solitaire/` on its own port; `changeWorker()` appends a new comment to `sw.js`, so the browser sees a new version. The test visits, waits for activation and reloads until `navigator.serviceWorker.controller` is set (a new worker waits only behind a controlled page), plays three draws, then changes the worker and calls `registration.update()`: the Update notice appears, Later hides it, a second change and update leaves it hidden (Later lasts for the session), a page reload offers it again, Update reloads onto Home, and Continue game restores the three moves and a time no earlier than before. That choosing Later and reaching the next cold start runs the new version is the Workbox default (`cleanupOutdatedCaches` plus the waiting worker activating when no controlled clients remain), not app behaviour, so no case exercises it. Run it with `rtk npx playwright test pwa --project=chromium`.

## Coverage

`rtk npm run test:coverage` measures every file under `src/` (`coverage.include: ['src/**/*.{ts,tsx}']`), so a source
file no test imports still appears in the report at 0% instead of being silently omitted. Only `src/main.tsx` and
`src/vite-env.d.ts` are excluded. Thresholds are a single project-wide floor of 80% for lines, functions, branches and
statements; there is no separate `src/domain` threshold. `rtk npm run validate` runs the unit and component suites
with `--coverage`, so the thresholds are enforced by the gate. The text table hides files at 100%, so use the `html` report
in `coverage/` (gitignored) to see every file.

### Visual-parity review of the Home and sheet screens (task 10.1)

Screens 01, 02, 10, 11 and 13 of `test-results/visual-parity/` were compared by eye with `docs/spec/mockup/screens/` after a clean build. No defect was found; these differences are accepted:

- All five: the mockup's build-note line ("Mockup build ...") and its "What this mockup shows" link are not built; the Home links row reads Statistics, Settings, Play a deal code, About. Dates (Daily deal) and the shot's fixture data differ from the mockup's by design.
- Light theme: `--color-primary` is `#3d7093`, darkened from the mockup's `#457b9d` in task 9.3 to reach 4.5:1 contrast (Deal cards, toggles and Got it/Deal again buttons read slightly deeper).
- 01 and 02: text renders in the real Inter font with slightly tighter letter and word spacing and a darker hero body colour; the Draw 1 tile is a little taller when its detail wraps. On the phone the Deal cards / How to play bar is a plain sticky row without the mockup's docked panel, so the Winnable card's caption runs under it at the fold.
- 10: Settings is grouped under Appearance and Play headings with Night cards, Four-colour deck and Card back first, and its shot is taken over Home (the mockup shows it over a Game screen with a flat row order and no Card back row).
- 11: the How to play shot is scrolled to the end of the sheet (controls, scoring and "Got it") while the mockup shows the top with the four rule steps; the controls table lists one key per row (H, A, N, P, Esc) where the mockup groups H/A/N.
- 13: the win sheet is shown over a Game fixture with a still (not mid-cascade) board; its "You win!" heading uses the body font rather than the pixel face, the badge sits above the summary line, and the bonus line reads "0-point time bonus" for the fixture.

## Lighthouse manual check (task 10.2)

Procedure: `npm run build && npm run preview`, then Lighthouse with the mobile preset on `http://localhost:4173/solitaire/`
in a clean profile (Incognito, no extensions). The target is a performance score of at least 90.

| Date       | Tool                                     | Performance | FCP   | LCP   | Notes                                                                         |
| ---------- | ---------------------------------------- | ----------- | ----- | ----- | ----------------------------------------------------------------------------- |
| 2026-09-28 | DevTools, Chrome 154 (Lighthouse 13.4.1) | 76          | 4.0 s | 4.2 s | Before the font change; accessibility 100, best practices 100, SEO 100        |
| 2026-09-28 | CLI, Lighthouse 13.4.1, median of 3      | 94          | 2.3 s | 2.6 s | After shipping smaller fonts (Inter subset 87 KB, Press Start 2P WOFF2 30 KB) |

Cause of the first result: the two bundled fonts (about 470 KB) start loading before the first paint, which the simulated
slow-4G first paint waits for. The fix is in `src/assets/fonts/README.md`. Installability was confirmed by hand: the
install prompt appears in Chrome and Edge and the installed app runs. Lighthouse 13 has no separate PWA category.
