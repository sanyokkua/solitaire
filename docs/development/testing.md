# Testing

Tests live in the top-level `tests/` tree, mirroring `src/`, never next to source. This page is the overview; the long
per-suite notes are in [`tests/README.md`](../../tests/README.md).

Naming: `*.test.ts(x)` is Vitest (in-process); `*.spec.ts` is Playwright (real browser).

## Layout of `tests/`

| Folder             | Runner                         | Holds                                                                                                                                                                                                                           |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/`      | Vitest                         | Logic without React: `domain/`, `solver/`, `features/`, `app/`, `i18n/`, `pwa/`, `ui/` (pure board, CSS suites, contrast, formatting), `repo/` (guards), `support/`, `fixtures/`, `e2e-support/`.                               |
| `tests/component/` | Vitest + React Testing Library | Components and the app lifecycle (`appLifecycle*.test.tsx`), sheets (`sheets/`), Home (`home/`).                                                                                                                                |
| `tests/e2e/`       | Playwright                     | End-to-end specs against the built app, plus `support/` helpers (`seed.ts`, `play.ts`, `distServer.ts`, `workers.ts`, ...).                                                                                                     |
| `tests/bench/`     | Vitest bench                   | The informational winnable-deal benchmarks: `winnable.bench.ts`, `budgets.bench.ts` and `grading.bench.ts` (see [Benchmark](#benchmark)).                                                                                       |
| `tests/fixtures/`  | none                           | Shared non-test builders: seeded deals, game states, board positions, solver corpus, storage doubles, worker doubles, the viewport matrix, and mini `dist/` trees.                                                              |
| `tests/support/`   | none                           | Doubles shared by component tests: `testStore.ts`, `renderWithStore.tsx`, `fakeResizeObserver.ts`, `matchMedia.ts`, `pointer.ts`, `pseudoLocale.ts`, `boardHarness.tsx`, `fontCoverage.ts` (a WOFF2 `cmap` reader), and others. |
| `tests/setup.ts`   | Vitest                         | Shared setup: jest-dom matchers, a query-aware `matchMedia` stub, an inert `ResizeObserver` (skipped when there is no `window`).                                                                                                |

Preference order (from the project's engineering rules): existing tests, real unit or component behaviour, integration
with real local files, then the real application end to end. Mocks are used only where the real boundary is impractical.

## Vitest

Configured in `vitest.config.ts`:

- Environment `jsdom`, document URL `http://localhost/solitaire/`, `globals: true`, `css: true`, `testTimeout: 30_000` (grading a deal runs the solver dozens of times).
- Includes `tests/**/*.{test,spec}.{ts,tsx}` and excludes `tests/e2e/**/*.spec.ts`.
- A test that starts a worker starts with `// @vitest-environment node`; the worker suites import `@vitest/web-worker`
  and run the real `src/solver/solver.worker.ts` in-process.
- Type-level test: `tests/unit/i18n/catalogCompleteness.test-d.ts` is checked by `typecheck`.

Commands (prefix with `rtk` in this repo):

```sh
npm run test:unit        # vitest run tests/unit tests/component (what the pre-commit hook runs)
npm run test             # vitest run (everything Vitest collects)
npm run test:coverage    # vitest run --coverage
npm run bench            # informational benchmarks (vitest bench --run); never assert, exit zero
```

Run one file, one test, or a folder:

```sh
npx vitest run tests/unit/ui/layoutCss.test.ts
npx vitest run tests/unit/domain -t "name fragment"
npx vitest run tests/component/sheets
```

### Coverage

`coverage.provider: 'v8'`, reporters `text` and `html` (`coverage/`, gitignored). It measures every file under `src/`
(`src/**/*.{ts,tsx}`), excluding only `src/main.tsx`, `src/pwa/registerPwa.ts` (a thin shim over the `virtual:pwa-register` module, which
Vitest cannot resolve; `tests/e2e/pwa.spec.ts` exercises it) and `src/vite-env.d.ts`. Thresholds: one project-wide floor of 80%
for lines, functions, branches and statements. There is no separate threshold for `src/domain`. `npm run validate`
runs the unit and component suites with `--coverage` (`vitest run tests/unit tests/component --coverage`), so a
threshold miss fails the gate even when every test passes; CI runs `validate`, so it enforces the same floor. The
pre-commit hook runs `test:unit` without coverage.

### Benchmark

`npm run bench` runs three informational benchmarks in `tests/bench/`, found through `benchmark.include` in
`vitest.config.ts`. None asserts on a timing or a count, and none is part of `test`, `test:unit`, `validate`, the git
hooks or CI:

- `winnable.bench.ts` times the winnable-deal search per mode and prints the median and p95 against the KS-PERF-02
  targets.
- `budgets.bench.ts` sweeps the search budget per mode over seeds 1 to 100 (it can run for a long time).
- `grading.bench.ts` calibrates the grading parameters; `GRADING_CALIBRATION=fixture` prints the pinned sample.

The results and how they were used are recorded in [`tests/README.md`](../../tests/README.md#benchmark).

## Repository guard tests (`tests/unit/repo/`)

These fail when architectural or configuration rules are broken.

| File                                            | Enforces                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/repo/domainPurity.test.ts`          | `src/domain` imports nothing from React, Redux, DOM or storage; `crypto` only in `prng.ts`; no `Math.random`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tests/unit/repo/solverPurity.test.ts`          | `src/solver` imports only siblings and `../domain/name`; no `crypto`; `self` only in the worker entry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `tests/unit/repo/featuresSolverImport.test.ts`  | Lints virtual `src/features/deal` files with the real ESLint config: a value import of solver code fails, a type import passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tests/unit/repo/boardPurity.test.ts`           | The pure board modules (see [UI architecture](../architecture/ui.md)) import only siblings and domain, and use no React, DOM globals, storage, `crypto` or `Math.random`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tests/unit/repo/layerBoundaries.test.ts`       | `src/i18n` and `src/pwa` import nothing from `app`, `features` or `ui`; only `useTranslate.ts` may import React or react-redux.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tests/unit/repo/storageBoundary.test.ts`       | Only `src/features/persistence/storageGateway.ts` may name `localStorage` or `sessionStorage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `tests/unit/repo/eslintRules.test.ts`           | The ESLint import restrictions are really in force (for example a pure board module importing `app/appSlice` is reported).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/unit/repo/configContract.test.ts`        | `/solitaire/` base in Vite, Vitest and Playwright configs; `__APP_VERSION__` and `__APP_BUILD__` defines; the `validate` chain order, including its coverage step, and the 80% coverage thresholds; `.prettierignore` (keeps `openspec/` out, `docs/` in); the release version (1.0.0, valid semver, equal to the lockfile root) and the changelog head; every npm script documented in `docs/reference/scripts.md`; `ci.yml` and `pages.yml` shape (permissions, the pull-request-only trigger, concurrency and cancellation, the three-browser `e2e` matrix and the `validate` job, the lean profile variable, build-once, deploy job); PWA plugin settings and pinned versions; pinned action versions; no third-party host in `index.html`. |
| `tests/unit/repo/buildInfo.test.ts`             | `resolveBuildInfo` in `scripts/build-info.mjs`: the run number, a blank number read as absent, the UTC time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/unit/repo/manifest.test.ts`              | Manifest start URL and scope, standalone display, palette colours, icons present on disk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tests/unit/repo/icons.test.ts`                 | Generated icons; the maskable mark stays inside the safe zone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `tests/unit/repo/validateArtifact.test.ts`      | The four checks of `scripts/validate-artifact.mjs`, run against the mini trees in `tests/fixtures/dist/` (a `good` tree and broken variants).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tests/unit/repo/lifecycleStorageGuard.test.ts` | `scripts/validate-lifecycle-storage.mjs`, one rule at a time, against scratch repositories.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tests/unit/repo/playwrightProjects.test.ts`    | The `device-fit` project owns `deviceFit.spec.ts` and `pseudoLocale.spec.ts`; every other project ignores them; each Chromium-only spec (`visualParity`, `dealLatency`, `pwa`, `dragPerf`, `screenshots`, `a11y`) carries its `test.skip(testInfo.project.name !== 'chromium'` guard and each whole-game spec its `skipOutsideFullGameProjects` guard; `FULL_GAME_PROJECTS` is the four named projects; service workers are blocked by default; the lean `E2E_PROFILE=ci` profile (three desktop projects, one retry, two workers, 90 s and 15 s limits, the keyboard title filter and the skipped specs, WebKit's skipped long games).                                                                                                         |
| `tests/unit/repo/traceability.test.ts`          | The committed `docs/reference/traceability.md` equals a fresh generation; no test or manual check declares an unknown KS id; the delta-only and manual-check rules, against scratch projects. Strict: an id of a main-spec requirement that no test and no manual check covers fails the test, naming the id and its requirements.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `tests/unit/repo/docsLinks.test.ts`             | Every relative link and every repository path cited in inline code in the maintained documents exists (see [Documentation checks](#documentation-checks)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/unit/repo/noSpecPack.test.ts`            | The retired specification pack is gone and no tracked file mentions it (see [Documentation checks](#documentation-checks)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`tests/unit/repo/purityScanner.ts` is the shared scanner (strips comments, finds imports and identifiers).

Other static suites worth knowing in `tests/unit/ui/`: `tokens.test.ts` (CSS tokens), `contrast.test.ts` (4.5:1),
`layoutCss.test.ts` (rails media query matches `RAILS_QUERY`), `motionConstants.test.ts` (TS constants match CSS tokens),
`boardCss.test.ts`, `hudCss.test.ts`, `sheetsCss.test.ts`, and `pixelFont.test.ts`, which reads the `cmap` of the bundled
fonts and fails when a string drawn in Press Start 2P (in any language) uses a character the font has no glyph for. In
`tests/component/`, `pseudoLocale.test.tsx` renders every screen and sheet with a lengthened, bracketed pseudo-locale and
fails on any text that bypasses the catalogs.

## Requirement traceability

Every KS id that a requirement of the main OpenSpec specs cites is listed in the generated
[traceability matrix](../reference/traceability.md), with the requirements that cite it, the tests that declare it and
the [manual checks](../reference/manual-checks.md) that cover it.

- **Declare coverage** with a comment line `// covers: KS-XXX-nn, KS-YYY-nn` at the top of a test file or of a `describe`;
  add it only where the test really proves the id. Files under `tests/fixtures/` are not scanned.
- **Regenerate** with `rtk npm run trace` whenever a `covers:` comment, a KS citation in a main spec or a manual check
  changes, and commit the matrix. The output is formatted with the project's Prettier configuration, so `format:check`
  never changes it.
- **The guard** (`tests/unit/repo/traceability.test.ts`, part of `test:unit`) fails when the committed matrix differs
  from a fresh generation, when a test or manual check declares an id that no requirement cites, or when an id cited by
  a main-spec requirement has neither a test nor a manual check (`STRICT` in the test). The delta specs of an active
  change (`openspec/changes/<name>/specs/`) only make ids known, so a test may cite a new id before the change is
  archived; they never change the matrix. The test also keeps a guard for the four ids the release change added (KS-DEAL-11, KS-DEAL-12,
  KS-PER-06, KS-GEN-11): they are declared, and the change is archived and synced.
- **Manual checks** (real devices, Lighthouse) are rows of the table in `docs/reference/manual-checks.md`, each with its
  KS ids in the second column; a row counts as coverage for those ids.

## Documentation checks

Two guards keep the documentation honest; both are part of `test:unit`.

- **`docsLinks.test.ts`** reads the maintained documents (`README.md`, `CHANGELOG.md` if present, `AGENTS.md`, every
  `docs/**/*.md` and the READMEs under `src/` and `tests/`) and fails on a relative Markdown link whose target does not
  exist, and on a repository path in inline code that starts with `src/`, `tests/`, `docs/`, `scripts/`, `public/`,
  `openspec/` or `.github/` and does not exist. A `#symbol` or `:line` suffix is ignored, so a path with a symbol
  checks the file; a path without its extension (a bare module name) counts as broken. Globs, brace lists,
  `<placeholders>`, generated folders (`dist/`, `coverage/`, `playwright-report/`, `test-results/`), external links and
  fenced code are not checked.
- **`noSpecPack.test.ts`** fails when the retired specification pack (the old spec folder under `docs/`: product
  specification, research notes, design notes and an HTML mockup) exists again, or when any tracked or new file cites
  it by folder path, file name or section citation. The OpenSpec change folders, the main specs (until their
  citations are edited), references pinned to a git revision (`<sha>:<path>`) and the test itself are exempt.

Requirements now come from `openspec/specs/`; the game-rule and solver facts of the old pack live in
[game rules](../reference/game-rules.md) and [winnability](../reference/winnability.md).

## Reference screenshots

`docs/assets/screenshots/` holds eight committed JPEGs (Home and Game, light and dark, desktop 1280x900 and phone
390x844) that the README shows and that fix the look and feel. `tests/e2e/screenshots.spec.ts` regenerates them from the
production build. It is opt-in and Chromium-only: it skips itself unless `CAPTURE_SCREENSHOTS=1`, so `npm run e2e` and CI
never rewrite the set. Run `npm run screenshots` (`CAPTURE_SCREENSHOTS=1 playwright test screenshots --project=chromium`;
it needs a Unix shell for the variable) whenever a change alters colours, type or layout, review the new images by eye
against the old ones, and commit them with the change. No pixel comparison gates any run.

## Storage in tests (the ambient storage rule)

No in-process test reads or writes ambient browser storage. A test that saves or loads injects a gateway:

- `createStorageGateway(memoryStorage())`, or one over `throwingStorage()`, both from `tests/fixtures/storage.ts`.
- Passed through the `gateway` thunk dependency, or `startApp`'s `extra.gateway`.

`rtk npm run validate:lifecycle-storage` (`scripts/validate-lifecycle-storage.mjs`, part of `validate`) fails when a
`tests/component/appLifecycle*.test.tsx` file:

- refers to `localStorage`, `sessionStorage` or `Storage.prototype`;
- builds a bare `createStorageGateway()`;
- calls `startApp(` without mentioning an injected `gateway`;
- or when no such test file exists at all, so the guard cannot pass by checking nothing.

Playwright specs use the real browser storage of the built app. They seed a position with `seedRecord(page, ...)` from
`tests/e2e/support/seed.ts` (a valid versioned record installed with `page.addInitScript` before first navigation,
written only while the key is absent, so a reload exercises real resume). `seedRaw` installs unreadable text under the
record key, `failSaves` makes every storage write throw, and `readStoredSession` reads back the session the app itself
stored. Positions live in `tests/fixtures/boardPositions.ts`.

The app runs two solver workers from one chunk: the player's and the deal pool's, which starts at the first idle
period (D8). `tests/e2e/support/workers.ts` tells them apart: `tagWorkers` (an init script) records each `Worker` in
creation order with its script URL, its first request, whether it has answered and, per mode, how many proven deals it
has delivered (`poolProven(page, mode)` counts the pool's, so a spec knows the pool is warm without a fixed wait);
`playerWorker(page, mode)` returns
the earliest one whose first request is a `findWinnable` for that mode with the `any` target, which a pool fill never
sends (it always asks for a named grade). `holdDealPool` replaces `requestIdleCallback` with one that never calls back,
so the pool never starts and a deal is always the player's own search; `dealLatency` and the offline cold start in `pwa`
use it.

## Playwright

Configured in `playwright.config.ts`:

- `testDir: ./tests/e2e`, `fullyParallel`, `forbidOnly` on CI, 2 retries on CI (1 in the lean `E2E_PROFILE=ci` profile, see [CI and deployment](ci-and-deployment.md)), `baseURL` `http://127.0.0.1:5173/solitaire/`.
- Reporters: `list` and `html` (`playwright-report/`). Trace, screenshot and video are kept on failure.
- `webServer`: `npm run build && npm run preview -- --host 127.0.0.1 --port 5173`; an existing server is reused when not
  on CI. So e2e runs against the production build, not the dev server.
- `use.serviceWorkers: 'block'` for all specs. Only `pwa.spec.ts` opts in (see [i18n and PWA](../architecture/i18n-and-pwa.md)).
- On macOS 26 and later the config redirects `CFFIXED_USER_HOME` to a temp folder so bundled Firefox can start
  (upstream microsoft/playwright#42768). No effect on Linux CI.

### Projects

| Project             | Device / browser                        | Runs                                                 |
| ------------------- | --------------------------------------- | ---------------------------------------------------- |
| `chromium`          | Desktop Chrome                          | All specs except the two device-fit specs.           |
| `firefox`           | Desktop Firefox                         | Same set.                                            |
| `webkit`            | Desktop Safari                          | Same set.                                            |
| `iphone-17-pro`     | iPhone 17 Pro, viewport 402x874         | Same set.                                            |
| `iphone-14-pro-max` | iPhone 14 Pro Max, viewport 430x932     | Same set.                                            |
| `galaxy-s25`        | Galaxy S24 descriptor, viewport 360x780 | Same set.                                            |
| `device-fit`        | Desktop Chrome                          | Only `deviceFit.spec.ts` and `pseudoLocale.spec.ts`. |

Chromium-only specs skip themselves in other projects: `visualParity`, `dealLatency`, `dragPerf`, `pwa`, `a11y` and
`screenshots` (list in `tests/unit/repo/playwrightProjects.test.ts`); `screenshots` additionally skips itself unless
`CAPTURE_SCREENSHOTS=1`. The whole-game tests of `playByTap`, `playByDrag`, `playByKeyboard` and
`playModes` run in `chromium`, `firefox`, `webkit` and `iphone-17-pro` (`FULL_GAME_PROJECTS` in
`tests/e2e/support/projects.ts`) and skip themselves in the other projects.

### Notable specs

- `device-fit`: `tests/e2e/deviceFit.spec.ts` runs the 52 board configurations (13 screens x orientation x browser or
  installed height) plus 3 baselines from `tests/fixtures/viewports.ts`, in English and Ukrainian.
  `tests/e2e/pseudoLocale.spec.ts` runs the same matrix with all visible text made 30% longer and checks for clipping
  and sideways scroll. Run: `npx playwright test --project=device-fit`.
- `a11y`: `tests/e2e/a11y.spec.ts` runs axe (`@axe-core/playwright`) on Home, Game and the eight sheets in three
  passes: light theme, dark theme, and dark theme with night cards (which adds a king-to-ace run of both suit inks). It
  fails on serious or critical violations. Color-contrast runs with `ignoreLength: true`, so a low-contrast
  one-character card rank is a violation rather than an "incomplete" result; axe still leaves text it cannot see whole
  (under another card) as "incomplete".
- Edge cases of play, each run through the real app: `storage.spec.ts` (an unreadable saved record starts from the
  defaults and keeps a backup; a failing save shows the notice and the game stays playable), `resume.spec.ts` (a reload
  with the mouse held mid-drag, and in the middle of Finish), `talonRules.spec.ts` (the Vegas pass limit and the Draw 3
  recycle penalty, by tap and keyboard), `history.spec.ts` (the 200-step undo and redo limit across a reload, and a
  rapid double tap applying one move, sent through DevTools with explicit event times in the Chromium projects only, so that the load on the test machine cannot stretch the gap between the two taps), `daily.spec.ts` (the Daily date and streak across midnight UTC) and the
  "resize during the deal" case in `resize.spec.ts`.
- `pwa`: `tests/e2e/pwa.spec.ts` covers offline cold start, offline reload and Continue, and the update flow against
  `tests/e2e/support/distServer.ts`.
- `playByTap`, `playByDrag`, `playByKeyboard`: each plays a recorded winning line to a win by one input path.
- `dragPerf`: an informational drag trace on a phone viewport with the CPU slowed 4×; it attaches the Chromium trace and reports frame times as annotations without asserting on them.
- `playModes`: Draw 3 by keyboard, Vegas by drag and the Daily deal (dealt from Home on its golden date) by tap, each to a win.
- `visualParity`: writes seventeen screenshots to `test-results/visual-parity/`; CI does not run it (lean profile); run it locally for review by eye. It asserts only that each file exists.
- `screenshots`: opt-in regeneration of the committed reference screenshots (see [Reference screenshots](#reference-screenshots)).
- `dealLatency`: informational, for Draw 1, Draw 3 and Vegas; asserts only that a background solver ran. It reports two
  paths per mode: on demand (the deal pool is held, so every measured deal is a cold search) and from a warm pool (the
  spec waits until the pool worker's own replies show a proven deal for the mode, and reports against the 100 ms target),
  plus Draw 1 with difficulty Hard and Draw 1 while a pre-verification is in flight.

The informational specs `dragPerf` and `dealLatency` assert nothing about timings. The results of the last flake sweep
(repeated full runs, what was found and how it was fixed) are in [`tests/README.md`](../../tests/README.md#flake-sweep).

### Run one spec, one test or one project

```sh
npx playwright test                                              # all projects (what the pre-push hook runs: npm run e2e)
npx playwright test tests/e2e/smoke.spec.ts --project=chromium   # one spec, one project
npx playwright test -g "offline cold start" --project=chromium   # one test by title
npx playwright test --project=device-fit                         # the device matrix
npx playwright test --headed --project=chromium                  # watch it (npm run e2e:headed runs all projects headed)
```

Prefix with `rtk` as usual. Browsers must be installed once: `npx playwright install chromium firefox webkit`
(CI adds `--with-deps`).

## What runs where

| Check                             | Locally                                                     | CI (`ci.yml`)           |
| --------------------------------- | ----------------------------------------------------------- | ----------------------- |
| Vitest unit and component         | pre-commit hook, `validate` (with coverage)                 | inside `validate`       |
| Repo guard tests                  | inside `test:unit`                                          | inside `validate`       |
| Playwright                        | pre-push hook, `npm run e2e` (all projects)                 | lean profile, 3 engines |
| Coverage                          | `validate` (unit and component suites)                      | inside `validate`       |
| Reference screenshots             | `npm run screenshots` (opt-in)                              | not run                 |
| Docs link and no-spec-pack guards | inside `test:unit`                                          | inside `validate`       |
| Traceability matrix               | `npm run trace` when stale; the guard is inside `test:unit` | guard inside `validate` |
| Bench                             | on demand                                                   | not run                 |

See [CI and deployment](ci-and-deployment.md) and [workflow](workflow.md).
