# Tasks

> **Conventions**
>
> - **Commands.** Run commands through `rtk`. Use `rtk proxy <cmd>` when the wrapper rejects a flag.
> - **Where tests live.**
>   - Vitest tests are `*.test.ts(x)` under `tests/`, mirroring `src/`.
>   - Component tests live in `tests/component/`, sheet tests in `tests/component/sheets/`, and Home tests in `tests/component/home/`.
>   - Playwright specs are `tests/e2e/*.spec.ts`.
>   - Benchmarks are `tests/bench/*.bench.ts`. They are informational and never assert on timings.
> - **Requirement names** refer to this change's delta specs. Abbreviations:
>
>   | Code | Delta spec | Code | Delta spec |
>   | --- | --- | --- | --- |
>   | **D3S** | `specs/solver/draw3-solver` | **PR** | `specs/features/preferences` |
>   | **GRD** | `specs/solver/deal-grading` | **PE** | `specs/features/persistence` |
>   | **SEL** | `specs/solver/deal-selection` | **GS** | `specs/features/game-session` |
>   | **D1S** | `specs/solver/draw1-solver` | **IN** | `specs/features/interaction` |
>   | **MR** | `specs/domain/move-rules` | **AS** | `specs/app/application-shell` |
>   | **AST** | `specs/domain/assistance` | **AP** | `specs/app/appearance` |
>   | **GE** | `specs/domain/game-engine` | **HO** | `specs/ui/home-screen` |
>   | **DG** | `specs/domain/deal-generation` | **GM** | `specs/ui/game-screen` |
>   | **CM** | `specs/domain/card-model` | **SH** | `specs/ui/sheets` |
>   | **DS** | `specs/features/deal-service` | **BR** | `specs/ui/board-render` |
>   | **PW** | `specs/pwa/offline-install-update` | **BK** | `specs/ui/board-keyboard` |
>   | **RF** | `specs/tooling/repository-foundation` | **BL** | `specs/ui/board-layout` |
>
> - **Design decisions.** `Dn` is `design.md` decision *n*. Read every decision a task names before coding.
> - **Grade naming (D9).** `grade` is the deal's grade in data (`GameState.grade`, `WinSummary.grade`, the protocol reply, the stored game). `difficulty` names only the player's preference, and `target` the grade a deal or selection request asks for.
> - **Shared references.**
>   - **State API:** `src/features/README.md`.
>   - **UI map:** `src/ui/README.md`.
>   - **Solver notes:** `src/solver/README.md`.
>   - **Visual authority:** until task 13.3, the mockup at `docs/spec/mockup/klondike-mockup.html` and its `screens/`. After 13.3, the committed screenshots in `docs/assets/screenshots/`.
> - **Test set-up.**
>   - Build stores with `testStore()` and render with `renderWithStore()` from `tests/support/`.
>   - No in-process test uses real timers, real `matchMedia`, the real clipboard or real browser storage.
>   - Tasks that edit `tests/component/appLifecycle*.test.tsx` must inject the storage gateway, or `rtk npm run validate:lifecycle-storage` fails.
> - **Determinism.**
>   - No `Math.random` anywhere in `src/domain` or `src/solver`.
>   - Every new search, playout or pool test uses fixed seeds and an injected seed source.
> - **Catalog keys.** Every task that adds player-facing text lists `src/i18n/locales/{en,uk}.ts` in its Files and adds the key to both catalogs. The catalog completeness test keeps them in sync.
> - **Documentation.** Every module added to or changed in `src/<layer>` is described in that layer's README in the same task (constitution 9).
> - **Verification.**
>   - Every task ends with `rtk npm run test:unit`, `rtk npm run lint` and `rtk npm run typecheck` green.
>   - Tasks that add or change a Playwright spec also run the named `rtk npx playwright test …` command.
>   - A task that changes a screen's markup or accessible names, or the App composition, also runs the full `rtk npm run e2e`.
>   - A task that changes Home or Game layout also runs `rtk npx playwright test --project=device-fit`.
>   - Before each task commit, run the full, unmodified `rtk npm run validate` and fix everything it reports. Commit after the checkbox is ticked (AGENTS.md "Git and review").
> - **Behaviour.** Group 2 changes no behaviour. Its tests are the existing suites plus the new ones each task names.
> - **Selectors in new tests.** New component and e2e tests locate controls by role and accessible name, not by CSS class.
> - **Draw 1 is frozen (D2).**
>   - No task edits `src/solver/solver.ts`, `SOLVER_CORPUS`, `tests/fixtures/dailyGolden.ts` seeds or attempts, or the Daily v1 plan.
>   - A task that makes any of those tests fail has broken D2. Stop and surface it.
> - **Traceability.** From task 11.3 on:
>   - every new test file carries a `// covers: KS-…` comment for the KS ids it proves (D17);
>   - any task that adds or changes a `covers:` comment, a main-spec KS citation or `docs/reference/manual-checks.md` runs `rtk npm run trace` and commits the regenerated `docs/reference/traceability.md`.
> - **Repository guards** (traceability, no spec pack, docs links) scan `git ls-files -co --exclude-standard`, so new untracked files are checked before their first commit.
> - **No new spec-pack citations.** Docs written in this change (for example `device-matrix.md`, `winnability.md`, `domain-and-solver.md`) never cite `R§`, `spec §` or `docs/spec`. Where a source matters, pin it to revision `d72187f:`.
> - **Scope.** If a task needs work beyond what it states, stop and surface the added scope rather than silently narrowing, deferring or absorbing it.

## 1. Branches and stale agent instructions

- [x] 1.1 Remove the stale branch and phase instructions
    - **Implements:** D1. No requirement change.
    - **Branches:** the work happens on `feature/finalize-v1-release`, which is already on `origin` with the change artifacts committed. It was cut from the integration branch `feature/app-v1-release`, which exists locally only and equals `master`. Any further push, including the integration branch's first one, needs the author's explicit request.
    - **Files:**
      - `AGENTS.md`:
        - "Repository state" says Phases 1–8 are merged to `master` and live, and that `finalize-v1-release` carries Phases 9–11.
        - "Git and review" branch rules:
          - `master` is the release branch;
          - each change runs on `feature/<change-name>` cut from the active integration branch, which the change's proposal names (`feature/app-v1-release` here), or from `master` when there is none;
          - squash-merge back at archive;
          - the integration branch reaches `master` by pull request.
        - Remove the `feature/app-v1-implementation` lines.
      - `docs/development/workflow.md` (`:34`, `:51`): the same branch rules.
      - `openspec/config.yaml` `context`: implemented phases, and the active change.
    - **Tests:** none (process and docs).
    - **Verify:**
      - `git rev-parse --abbrev-ref HEAD` prints `feature/finalize-v1-release`;
      - `rg "app-v1-implementation" AGENTS.md docs openspec/config.yaml` finds nothing;
      - `rtk npm run validate` passes.

## 2. Quality work with no behaviour change (D15)

- [x] 2.1 Enforce the coverage thresholds in the validation gate
    - **Implements:** RF "Single aggregate validation gate".
    - **Files:**
      - `package.json`: `validate` runs the unit and component suites with `--coverage`, in place of `test:unit`, keeping the step order;
      - `vitest.config.ts`;
      - `AGENTS.md` ("Runtime and commands");
      - `docs/reference/scripts.md`, `docs/development/testing.md`.
    - **Tests:** `tests/unit/repo/configContract.test.ts` asserts that the gate's test step runs coverage and that thresholds are 80/80/80/80.
    - **Stop condition:** measure first. Where a threshold fails, add behaviour tests for the uncovered code, never lower the bar. If the gap needs more than about five new test files, stop and surface it.
    - **Verify:** `rtk npm run validate` passes with the coverage summary printed.

- [x] 2.2 One thunk-dependency assembly
    - **Implements:** D15 (thunk extra). No requirement change.
    - **Files:**
      - `src/app/thunkExtra.ts`: new `assembleThunkExtra(overrides)` that merges the defaults and builds `lazyDealService` once;
      - `src/app/store.ts:32-40` and `src/app/lifecycle.tsx:71-80` use it;
      - the loader receives `extra.languages()`, not `navigator.languages`;
      - `src/app/README.md` if present, otherwise the app section of `docs/architecture/state-and-persistence.md`.
    - **Tests:**
      - `tests/unit/app/thunkExtra.test.ts`: factory injection replaces the `vi.mock` of `createDealService`; it asserts that one deal service is built lazily and that overrides win;
      - `tests/component/appLifecycle.wiring.test.tsx` drops the `navigator.languages` patch (`:74-76`) and injects `languages`.
    - **Verify:** `rtk npx vitest run tests/unit/app tests/component/appLifecycle.wiring.test.tsx`, `rtk npm run validate:lifecycle-storage` and the full `rtk npm run e2e` pass.

- [x] 2.3 Remove production code kept alive only by tests
    - **Implements:** D15 (dead code).
    - **Files:**
      - remove `readOnlyEntered` (`src/features/persistence/persistenceSlice.ts:19`), `selectBusy` (`src/features/game/gameSlice.ts:198`) and `selectPendingHint` (`src/features/interaction/selectors.ts:43`);
      - `src/ui/sheets/StatsSheet.tsx:34` uses `selectWinRate` (`statsSlice.ts:88`, a fraction from 0 to 1) instead of its inline copy, formatting it as today's rounded percent and keeping "—" when nothing is played;
      - `src/features/README.md`.
    - **Tests:**
      - drop the assertions that only exercised the removed exports (find them with `rg "readOnlyEntered|selectBusy|selectPendingHint" tests`), keeping every behaviour assertion;
      - `tests/component/sheets/stats.test.tsx` still shows the same win rates.
    - **Verify:** `rtk npx vitest run tests/unit/features tests/component/sheets/stats.test.tsx` passes, and `rg "readOnlyEntered|selectBusy|selectPendingHint" src tests` finds nothing.

- [x] 2.4 One source for the mode list, the Daily cap and the codec guards
    - **Implements:** D15 (single sources).
    - **Files:**
      - `src/domain/deal.ts` exports `MODES`, used by `src/domain/validate.ts:18`, `src/features/persistence/recordCodec.ts:47` and `src/ui/sheets/StatsSheet.tsx:13`;
      - `MAX_DAILY_COMPLETED` is defined only in `src/features/stats/statsSlice.ts`;
      - new `src/features/persistence/guards.ts` holds `isRecord`, `hasExactKeys` and `isDayKey` (moved from `sessionCodec.ts:76-101`);
      - `recordCodec.ts:26` drops the test-only re-export;
      - `src/domain/README.md`, `src/features/README.md`.
    - **Tests:**
      - new `tests/unit/features/persistence/guards.test.ts` (exact keys, day keys including 2026-02-30 rejected, non-objects);
      - `recordCodec.test.ts` and `dayKeys.test.ts` keep their assertions; `sessionCodec.test.ts`, which only tested the moved guards, becomes `guards.test.ts`.
    - **Verify:** `rtk npx vitest run tests/unit/features tests/unit/domain` passes.

- [x] 2.5 Engine tuple updates without casts
    - **Implements:** D15 (engine casts).
    - **Files:** `src/domain/engine.ts:47,53`, with a typed tuple `replaceAt` helper and no `as unknown as`.
    - **Tests:** `tests/unit/domain/engine.*.test.ts` unchanged and green.
    - **Verify:** `rtk npx vitest run tests/unit/domain`, and `rg "as unknown as" src/domain` finds nothing.

- [x] 2.6 One pile identity on the board
    - **Implements:** D15 (pile identity).
    - **Files:**
      - `src/domain/rules.ts` exports `samePile` (today private at `:77`);
      - `src/ui/board/keyboardController.ts:39-50` uses it;
      - `pileKey` moves from `src/ui/board/landing.ts:18` to `src/ui/board/locate.ts`, beside `cardIndex` (`names.ts` holds only localised labels);
      - every consumer imports it from there: `useBoardActions.ts`, `useBoardKeyboard.ts`, `selectors.ts`, `Board.tsx`, `useBoardPointer.ts`, `PileSlot.tsx` and `Ghosts.tsx`;
      - `useBoardKeyboard.ts` `hitOf` (`:82-91`, `movable: true` hard-coded at `:87`) takes movability from `selectCardLocations` (`selectors.ts:62`), which the hook already reads at `:106`;
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/unit/ui/board/keyboardController.test.ts`, `landing.test.ts`, `tests/component/boardKeyboard.test.tsx` and `tests/unit/repo/boardPurity.test.ts` stay green;
      - add a keyboard case where a face-down card's pile is focused and nothing is picked up.
    - **Stop condition:** if the hard-coded `movable: true` turns out to be observable behaviour, stop and surface it.
    - **Verify:** `rtk npx vitest run tests/unit/ui tests/component/boardKeyboard.test.tsx` and `rtk npx playwright test playByKeyboard --project=chromium` pass.

- [x] 2.7 Sheet, settings and shortcut tidy-ups
    - **Implements:** D15 (sheets and shortcuts).
    - **Files:**
      - `src/ui/sheets/ModalSheet.tsx`: `returnFocusFallback` becomes optional and defaults to `onDismiss`. About, Help, NewDeal and Stats pass `dismiss` today and drop the prop; Settings (an inline `closeSheet`), Win, Paused and DealCode (which focus a screen heading) keep theirs. `data-testid="modal-backdrop"` (`:118`) is removed;
      - `SheetHost.tsx`: an exhaustive `Record<SheetId, …>`, and the stale comment goes;
      - `SettingsSheet.tsx`: the switch rows are built from one list;
      - `src/ui/board/useGameShortcuts.ts`: one pause guard, reusing the `pause()` thunk's refusal, and one auto-repeat check;
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/component/modalSheet.test.tsx` (`:154`, `:166`), `tests/component/sheets/win.test.tsx:269` and `tests/component/sheets/paused.test.tsx:216` find the backdrop through the dialog's parent, not a test id, and `modalSheet.test.tsx`'s `spyOn(store, 'dispatch')` (`:204`) is replaced by an outcome assertion;
      - `tests/component/gameShortcuts.test.tsx` and every `tests/component/sheets/*.test.tsx` stay green.
    - **Verify:** `rtk npx vitest run tests/component` and the full `rtk npm run e2e` pass. `rg "data-testid" src` finds nothing.

- [x] 2.8 `playDealCode` moves beside the other session thunks
    - **Implements:** D15 (session thunks). GS "Dealing from a deal code" is unchanged here.
    - **Files:**
      - `src/features/game/navigationThunks.ts:106-118` moves to `src/features/game/sessionThunks.ts`, and the callers are updated;
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/dealCode.test.ts` and `tests/component/sheets/dealCode.test.tsx` stay green.
    - **Verify:** `rtk npx vitest run tests/unit/features/game tests/component/sheets` passes.

- [x] 2.9 Test hygiene
    - **Implements:** D15 (test hygiene).
    - **Files:**
      - `tests/unit/features/game/finishable.test.ts` asserts that the Finish availability value stays stable across ticks, instead of counting `finishPlan` calls;
      - `tests/unit/solver/winnable.test.ts` asserts the reported attempt order on `SOLVER_CORPUS` seeds, instead of wrapping `solve`;
      - `tests/component/board.test.tsx` asserts on the rendered positions, not on the call counts of `positions`;
      - `tests/unit/app/savePort.test.ts` is folded into `tests/unit/app/pwaThunks.test.ts`, which flushes through a real writer;
      - `tests/unit/support/testStore.test.ts` keeps only the non-trivial override merge;
      - the existing `tests/support/matchMedia.ts` (`stubMatchMedia`, `controllableMatchMedia`; 13 files use it) becomes the only `matchMedia` fake. Fold in the copies in `tests/setup.ts:6-39` (`stubMediaQueryList`), `tests/component/appLifecycle.wiring.test.tsx:19-67` (`fakeMediaQuery`, `installMatchMedia`) and `tests/unit/app/themeController.test.ts:11-45` (plus its inline `vi.fn` at `:184`);
      - `tests/README.md` (test-double policy, naming the three justified module mocks and why).
    - **Tests:** the listed suites, with the same behaviour covered. The only module mocks left are the three justified ones: `hint.defensive.test.ts` (the solver entry), `pseudoLocale.test.tsx` and `tests/component/sheets/settings.test.tsx:190` (`vi.doMock`), which both register an extra language in the static catalog registry.
    - **Verify:** `rtk npm run test:unit` passes, and `rg "vi\.(do)?[mM]ock\(" tests` lists only the three justified files.

- [x] 2.10 A `DealService` contract suite for the real service and the fake
    - **Implements:** D15 (contract suite).
    - **Files:**
      - new `tests/unit/features/deal/dealServiceContract.ts` (shared cases: deal per mode, cancellation by a newer deal, hint outcomes, dispose);
      - new `tests/unit/features/deal/dealService.contract.test.ts`, which runs it against the real service (stub worker from `tests/fixtures/workers.ts`) and against `fakeDealService` (`tests/fixtures/dealService.ts`);
      - remove `tests/unit/features/deal/fakeDealService.test.ts`;
      - `tests/README.md`.
    - **Tests:** the new contract suite. Every assertion from the removed file lives in it.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

- [x] 2.11 Guard the features → app import direction
    - **Implements:** AS "The features layer depends on the app layer only through its slice, thunk type and store types".
    - **Files:**
      - `tests/unit/repo/layerBoundaries.test.ts` gains the features → app rule;
      - no ESLint entry: the test fails the gate on its own (D15);
      - `docs/development/code-standards.md`, `docs/architecture/overview.md`.
    - **Tests:** the guard passes on today's code (appSlice, appThunk, `app/selectors` and type-only `app/store` imports), and a fixture import of `app/store` as a value or of `app/lifecycle` from features is reported. Use the existing `tests/unit/repo/purityScanner.ts` helpers.
    - **Verify:** `rtk npx vitest run tests/unit/repo` and `rtk npm run lint` pass.

- [x] 2.12 Format the maintained docs
    - **Implements:** RF "Deterministic source formatting" ("Maintained docs are checked"); D15 (docs formatting), D18 (formatting).
    - **Files:**
      - `.prettierignore`: `docs/` becomes `docs/spec/`, so only the spec pack stays excluded until 13.3 deletes it; `openspec/`, the lockfile and build output stay excluded;
      - `docs/**/*.md` outside `docs/spec/`: formatted, with no content change;
      - `tests/unit/repo/configContract.test.ts`: asserts that `.prettierignore` excludes `docs/spec/` and `openspec/`, and not `docs/`;
      - `docs/development/code-standards.md` (what the formatter covers).
    - **Tests:** the new `configContract` assertion.
    - **Verify:** `rtk npm run format:check` passes with `docs/` included, and `git diff` shows only formatting in the docs.

## 3. Build identity and the card icon

- [x] 3.1 Build number and UTC build time
    - **Implements:**
      - AS "Build identification" (KS-GEN-11);
      - SH "About sheet" (the build line);
      - HO "Home links, install offer and footer" (the stamp);
      - RF "Continuous integration on every push and pull request" and "Deployment to GitHub Pages from the default branch";
      - D13.
    - **Files:**
      - new `scripts/build-info.mjs` with `resolveBuildInfo(env, now)`, and its `.d.mts` stub;
      - `vite.config.ts`: `__APP_BUILD__` replaces `__APP_BUILD_TIMESTAMP__`;
      - `vitest.config.ts` (a fixed test define for `__APP_BUILD__`; today `buildStamp.test.tsx` stubs the old global), `src/vite-env.d.ts`;
      - `src/ui/components/BuildStamp.tsx`, `src/ui/sheets/AboutSheet.tsx`;
      - the `build.*` keys in `src/i18n/locales/{en,uk}.ts` (D13): `build.label` stays the wrapper ("App build: {value}"), new `build.number` ("Build {number} · {time}"), and `build.dev` becomes "Development build · {time}";
      - `.github/workflows/ci.yml` and `pages.yml` drop `BUILD_TIMESTAMP`. Before editing, check each action's latest release online and pin the exact versions, per AGENTS.md "GitHub Actions";
      - `docs/development/ci-and-deployment.md` (`:94`, the build-timestamp section at `:139-151`, and the resolved Pages-source TODO at `:123`);
      - `docs/development/getting-started.md:27-28`;
      - `src/ui/README.md`.
    - **Tests:**
      - new `tests/unit/repo/buildInfo.test.ts`:
        - a number plus the time gives `Build 57 · 2026-09-28 14:03 UTC`;
        - `GITHUB_RUN_NUMBER=""` or whitespace counts as absent and gives the development label;
        - the time is UTC whatever the time zone;
      - `tests/component/buildStamp.test.tsx` and `tests/component/sheets/about.test.tsx`: the stamp is never empty; in Ukrainian only the surrounding words change, and the number and time read exactly as in English;
      - `tests/unit/repo/configContract.test.ts` (next to the `__APP_VERSION__` block at `:33-41`):
        - the `__APP_BUILD__` define exists;
        - no workflow sets `BUILD_TIMESTAMP` or uses `github.run_started_at`;
        - the existing exact-pin check (`:17`, `:207-217`) stays green after the version refresh;
      - `tests/e2e/home.spec.ts:76`: the stamp's accessible name matches `/^App build: (Build \d+|Development build) · \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/`.
    - **Verify:** `rtk npx vitest run tests/unit/repo tests/component/buildStamp.test.tsx tests/component/sheets/about.test.tsx` and `rtk npx playwright test home --project=chromium` pass. After `GITHUB_RUN_NUMBER=7 rtk npm run build`, the preview's Home footer shows "Build 7".

- [x] 3.2 Card-fan pixel icon
    - **Implements:** PW "The app is installable"; D14.
    - **Files:**
      - `scripts/generate-icons.mjs` (one rectangle list, emitted to SVG and PNG; it already emits `favicon.svg`) and the existing `scripts/generate-icons.d.mts`;
      - `public/favicon.svg`;
      - `public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png`;
      - `docs/architecture/i18n-and-pwa.md`, `src/pwa/README.md`, `docs/reference/scripts.md`.
    - **Tests:** `tests/unit/repo/icons.test.ts`:
      - every committed output, PNGs and `favicon.svg`, stays byte-equal to a fresh render (the loop at `:15-20` already covers both);
      - the sizes are right;
      - the maskable check changes from today's 10%-margin square (`:34-53`) to the W3C safe zone: every non-`#0b2545` pixel lies inside the centred circle whose diameter is 80% of the icon;
      - the mark contains a light card-face region, not only background.

      `tests/unit/repo/manifest.test.ts` and `validateArtifact.test.ts` stay green.
    - **Verify:** `node scripts/generate-icons.mjs && rtk npx vitest run tests/unit/repo` passes. Inspect the PNGs at 180 and 512 px, and the SVG at 16 and 32 px in a browser tab, by eye; record the look in the task's commit message.

## 4. Domain edge cases

- [x] 4.1 A game past its mode's pass limit is invalid
    - **Implements:** GE "A game state can be checked for validity" (the pass-limit clause). The grade clauses land in 8.2.
    - **Files:** `src/domain/validate.ts`, `src/domain/README.md`.
    - **Tests:**
      - `tests/unit/domain/validate.test.ts`: a Vegas game at pass 4 is invalid, pass 3 is valid, and a Draw 1 or Draw 3 game at pass 50 is valid;
      - `tests/unit/features/persistence/sessionCodec.test.ts`: a stored Vegas game at pass 4 is `invalid`.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/features/persistence` passes.

- [x] 4.2 One talon-stepping rule and the reachable talon
    - **Implements:** MR "Talon cards reachable by drawing"; D4.
    - **Files:**
      - new `src/domain/talon.ts` (`stepTalon`, `reachableTops`);
      - `src/domain/engine.ts#applyDraw` delegates to `stepTalon`;
      - `src/domain/README.md`, `docs/reference/game-rules.md` (draw and recycle mechanics).
    - **Tests:**
      - new `tests/unit/domain/talon.test.ts`:
        - Draw 1 reaches every talon card;
        - Draw 3 part-way through a pass reaches only the tops of its grouping, in draw order (current top first);
        - Vegas on its third pass stops at the end of the stock;
        - the input is never mutated;
        - results are deterministic;
      - `tests/unit/domain/engine.draw.test.ts` and `rules.stock.test.ts` pass unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/repo/domainPurity.test.ts` passes.

- [x] 4.3 The dead end follows the reachable talon
    - **Implements:** AST "Dead-end detection" and "One advice for a position" (KS-AST-06).
    - **Files:** `src/domain/deadEnd.ts` (uses `reachableTops`), `src/domain/README.md`, `docs/reference/game-rules.md`.
    - **Tests:**
      - `tests/unit/domain/deadEnd.test.ts` and `advise.test.ts`:
        - Draw 3: a playable card at an unreachable position is a dead end;
        - Vegas on its second and last pass;
        - Draw 1 cases unchanged.
      - The existing expectation at `tests/unit/domain/deadEnd.test.ts:50,53` (`vegasAtLimit({ passes: 2, waste })` with `waste = [H1, S9]`, draw 3) is not a dead end today. Under the grouping rule the one recycle left brings back only S9 on top, so it becomes a dead end. Change it with a comment that cites the AST scenario.
      - `tests/unit/features/interaction/deadEnd.test.ts` stays green.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/features/interaction` passes.

## 5. End-to-end edge cases (existing behaviour)

Any bug these specs expose goes through `superpowers:systematic-debugging`. Fix it in the same task when the fix stays inside the requirement the spec proves. Otherwise stop and surface it.

- [x] 5.1 Corrupt storage and a failing save
    - **Implements:** RF "Edge cases are proven end to end", scenarios "A corrupt record starts with defaults" and "A failing save keeps the game playable"; PE "Unreadable data is never lost" and "A failed save keeps the game playable" (KS-PER-03, KS-PER-04).
    - **Files:**
      - new `tests/e2e/storage.spec.ts`;
      - `tests/e2e/support/seed.ts` gains `seedRaw(page, value)`, and a quota stub through `addInitScript` that makes `setItem` throw `QuotaExceededError`.
    - **Tests:**
      - a malformed record gives the defaults, the storage notice, and the backup key holding the original verbatim, and a deal plays;
      - with a failing save, the write notice appears and moves still apply.
    - **Verify:** `rtk npx playwright test storage --project=chromium --project=webkit` passes.

- [x] 5.2 Reload during a drag and during Finish
    - **Implements:** RF "Edge cases are proven end to end" ("Reload in the middle of a drag", "Reload in the middle of Finish"); PE "Reopening restores the unfinished game exactly".
    - **Files:**
      - new `tests/e2e/resume.spec.ts`;
      - a nearly finished position in `tests/fixtures/boardPositions.ts`, or reuse of `nearlyWonState`.
    - **Tests:**
      - reload with the mouse held mid-drag: the resumed board equals the last committed position;
      - reload after starting Finish: the resumed position is valid and consistent, and Finish or a win can still complete.
    - **Verify:** `rtk npx playwright test resume --project=chromium --project=iphone-17-pro` passes.

- [x] 5.3 Vegas pass limit and the Draw 3 recycle penalty
    - **Implements:** RF "Edge cases are proven end to end" (the Vegas and Draw 3 pass scenarios); KS-MOVE-05, KS-SCO-02. The stock is never dragged, so the cases run by tap and by keyboard.
    - **Files:**
      - new `tests/e2e/talonRules.spec.ts`;
      - Vegas and Draw 3 talon-only positions in `tests/fixtures/boardPositions.ts`.
    - **Tests:**
      - Vegas: after the third pass the stock shows the no-redeal state, and a tap or Enter on it changes nothing and raises the notice;
      - Draw 3: the score drops by 20 on the fourth pass's recycle and not before, by tap and by keyboard.
    - **Verify:** `rtk npx playwright test talonRules --project=chromium --project=firefox` passes.

- [x] 5.4 A storm of 200+ undos and redos, and rapid double taps
    - **Implements:** RF "Edge cases are proven end to end" ("Undo storm survives a reload", "A double tap never applies two moves"); GS "Undo history has no in-memory limit"; PE stored-history limits.
    - **Files:** new `tests/e2e/history.spec.ts`; `tests/e2e/support/play.ts` only if needed. `playLine` already plays any command list, so a Draw 1 game can be padded with draws and recycles.
    - **Tests:**
      - apply at least 410 undoable commands (draws and recycles count), undo 205 of them so more than 200 steps sit on each side, then reload: exactly 200 undo steps (the newest) and 200 redo steps (the nearest) are restored, and both sides still work;
      - a rapid double tap on a movable card applies at most one move, and the move counter rises by at most one.
    - **Verify:** `rtk npx playwright test history --project=chromium --project=galaxy-s25` passes.

- [x] 5.5 Resize during the deal
    - **Implements:** RF "Edge cases are proven end to end" ("Resize during the deal"); GM and board-motion re-layout (KS-GEN-08).
    - **Files:** `tests/e2e/resize.spec.ts` (new case).
    - **Tests:** change the viewport twice mid-deal. Every card ends at its computed final position, the game state is unchanged, and no page scroll appears.
    - **Verify:** `rtk npx playwright test resize --project=chromium` passes.

- [x] 5.6 Daily rollover at 00:00 UTC
    - **Implements:** RF "Edge cases are proven end to end" ("Daily rollover at midnight UTC", "A missed date ends the daily streak"); DS "Daily deal v1"; KS-DEAL-07, KS-STA-04.
    - **Files:** new `tests/e2e/daily.spec.ts`, which uses `page.clock` on golden dates from `tests/fixtures/dailyGolden.ts`.
    - **Tests:**
      - at 23:59:59 UTC the Daily tile and deal code are the golden date's; after 00:00 UTC they are the next date's;
      - a streak that ended on the previous date is still shown just after the rollover;
      - a seeded completed-dates record with a gap shows the streak reset.
    - **Verify:** `rtk npx playwright test daily --project=chromium --project=webkit` passes.

- [x] 5.7 Night cards in the accessibility scan
    - **Implements:** RF "Accessibility scan" ("Night cards keep their contrast"); AP "Night cards change the cards only".
    - **Files:** `tests/e2e/a11y.spec.ts` gains a pass in the dark theme with night cards over Home, Game and every sheet.
    - **Tests:** axe finds no violations, colour contrast included.
    - **Verify:** `rtk npx playwright test a11y --project=chromium` passes.

## 6. Ordered-talon search (Draw 3 and Vegas)

- [x] 6.1 Winning lines with explicit draw steps
    - **Implements:** D3S "Winning lines replay as player commands, draws included".
    - **Files:** `src/solver/line.ts` gains a `{ t: 'd' }` step that expands to `{ type: 'draw' }` (a recycle on an empty stock). `src/solver/README.md`.
    - **Tests:** `tests/unit/solver/line.test.ts`:
      - a hand-built Draw 3 line and a Vegas line with a recycle replay through `applyCommand` to the expected position;
      - Draw 1 cases unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/repo/solverPurity.test.ts` passes.

- [x] 6.2 The ordered-talon search
    - **Implements:** D3S "Bounded ordered-talon search verdict" and "Won, invalid and Draw 1 positions"; D3.
    - **Files:**
      - new `src/solver/ordered.ts` (`solveOrdered`), using `src/domain/talon.ts` from 4.2;
      - `src/solver/README.md`;
      - `docs/architecture/domain-and-solver.md` (the model, key, moves, strict safe rule and pruning).
    - **Tests:** new `tests/unit/solver/ordered.test.ts`:
      - hand-built Draw 3 and Vegas positions with known outcomes, including a win that needs a partial run, one that needs foundation → column, and one that needs a whole run moved off a column with nothing face down to empty it;
      - node counts and lines are identical across runs;
      - a deeply frozen input is never mutated;
      - `budget + 1` means `unknown`;
      - won → `win` with an empty line;
      - invalid → `unknown` with 0 nodes;
      - Draw 1 → `unknown` with 0 nodes;
      - every `win` for seeds 1–50 in Draw 3 and in Vegas replays to a win through `applyCommand`.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/repo/solverPurity.test.ts` passes.

- [x] 6.3 Exhaustive cross-check on small positions
    - **Implements:** D3S "Verdicts agree with exhaustive search on small positions"; D5.
    - **Files:**
      - new `tests/support/bruteForce.ts`: exhaustive search over `applyCommand` with no pruning, deduplicating on `positionKey` plus, in Vegas, the passes left;
      - new `tests/fixtures/endgames.ts`: seeded Draw 3 and Vegas endgames with at most 14 cards off the foundations, including one where the loose safe rule would lose the win, one Vegas case that is lost only because of the pass limit, one part-way-through-a-pass talon case, and one that needs a column-emptying run;
      - new `tests/unit/solver/ordered.crossCheck.test.ts`;
      - `tests/README.md`.
    - **Tests:** for every endgame, `solveOrdered` gives `win` exactly when brute force finds a win, and `loss` exactly when it finds none. `unknown` never occurs at the test budget.
    - **Verify:** `rtk npx vitest run tests/unit/solver` passes, and the suite takes under 10 s locally.

- [x] 6.4 One search entry for every mode
    - **Implements:** SEL "Winnable selection by reject sampling" (mode), "Solver hint from the winning line" and "Background-thread message interface"; D2.
    - **Files:**
      - new `src/solver/search.ts` (routes Draw 1 and Daily to `solve`, Draw 3 and Vegas to `solveOrdered`);
      - `src/solver/winnable.ts` deals each seed in the request's mode;
      - `src/solver/hint.ts` and `src/solver/protocol.ts` carry `mode`;
      - `src/features/deal/solverClient.ts` passes `mode`, and its callers pass `'draw1'` or `'daily'` exactly as today;
      - `src/solver/README.md`.
    - **Tests:**
      - `tests/unit/solver/{winnable,hint,protocol,worker}.test.ts` gain Draw 3 and Vegas cases;
      - `tests/unit/features/deal/solverClient.test.ts`;
      - `tests/unit/solver/solver.test.ts` passes **unchanged**. `tests/unit/features/deal/daily.test.ts` adapts only its call signature, and its pinned seeds and attempts stay unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/features/deal` passes.

- [x] 6.5 Per-mode budgets from the benchmark
    - **Implements:** DS "Deals per mode record their provenance" (the budget column); RF "Informational solver benchmark outside the validation gate" (verdicts and selection latency per mode; the grading report is 7.5's and the target-grade row is 7.6's).
    - **Files:**
      - new `src/features/deal/budgets.ts`: `WINNABLE_BUDGET` for Draw 1 moves there unchanged from `dealService.ts:18-22`, alongside `MAX_ATTEMPTS`, `HINT_BUDGET` and the Draw 3 and Vegas budgets;
      - `tests/bench/winnable.bench.ts` (per mode: verdict distribution, median and p95 per selection);
      - `tests/README.md` (the recorded results with date, machine and Node version; the Draw 1 figures were the baseline for a latency guard that the grading revision dropped);
      - `specs/features/deal-service/spec.md` of this change, if the benchmark moves the Draw 3 or Vegas value away from 20,000;
      - `src/features/README.md`.
    - **Stop condition:** if cold Draw 3 or Vegas selection misses 1 s at the median or 3 s at p95 on the desktop benchmark at any budget that still proves most deals, stop and surface it (design Risks).
    - **Verify:** `rtk npm run bench` prints all three modes, and `rtk npx vitest run tests/unit/features/deal` passes.

## 7. Deal grading

> **Revision after task 7.2.** Calibrating the first grading (the number of winning playouts out of 16) hit its stop
> condition: about 82% of proven Draw 3 deals won none of the 16, so no setting reached 15% per grade. Grading v1 is
> therefore solver-checked survival (D6): the playouts of 7.2 are kept as the generator of plausible play, and the
> solver says how long each stays provably winnable. The player's priority is a really winnable deal, so seconds of
> dealing are accepted and the 20% latency guard, and the Draw 1 300 ms target, are dropped (D7). Tasks 7.3 to 7.7
> replace the old 7.3 and 7.4. Code for 7.1 to 7.7 is done; the pool (9.3), the verdict cache (9.4) and the service
> wiring (9.1, 9.5) follow in section 9.


- [x] 7.1 Hint candidates in priority order
    - **Implements:** AST "Hint candidates in priority order"; D6.
    - **Files:** `src/domain/hint.ts` (`hintCandidates`; `findMove` becomes its first element), `src/domain/README.md`.
    - **Tests:** `tests/unit/domain/hint.test.ts`:
      - `findMove` equals `hintCandidates()[0]` over every fixture position;
      - every candidate is legal under `applyCommand`;
      - order is priority, then canonical source, then target;
      - permuting face-down tableau cards among themselves, and the stock order, leaves the candidates unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/domain` passes.

- [x] 7.2 Seeded playouts and grading
    - **Implements:** GRD "Seeded playouts that see only face-up cards"; D6. `playout`, `playoutSeed`, `fmix32`, `Grade`, `GRADES` and `GradeTarget` stay as built here; the win-count `gradeDeal`, its parameters and its table were replaced by 7.4.
    - **Files:** new `src/solver/grading.ts` (`fmix32`, `playoutSeed`, `playout`, and the first `GRADING_V1` and `gradeDeal`), `src/solver/README.md`.
    - **Tests:** new `tests/unit/solver/grading.test.ts`:
      - `playoutSeed` matches pinned vectors for a few `(seed, index)` pairs;
      - with a scripted generator, the walk takes the first candidate below the take probability, moves on otherwise and always takes the last candidate it reaches, and an unforced draw happens only when a draw or recycle is legal;
      - the same seed gives the same grade and win count;
      - hidden-card permutations do not steer choices before a reveal;
      - the player draws when it has nothing to play;
      - a stall (the talon arrangement repeats with no board move) ends a playout;
      - the Vegas pass limit is respected;
      - every playout ends within the step cap;
      - a Daily deal grades like its Draw 1 twin.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/repo/solverPurity.test.ts` passes, and `rg "Math.random" src/solver src/domain` finds nothing.

- [x] 7.3 Deal budgets for proven wins
    - **Implements:** D2 budgets; the player's priority of really winnable deals.
    - **Files:** new `tests/bench/budgets.bench.ts` (verdicts and time per search at three budgets per mode); `tests/README.md` (the sweep).
    - **Result:** raising a budget buys a few more proven deals per hundred seeds (Draw 1 5,000 to 50,000 nodes: 70 to 78; Draw 3 20,000 to 100,000: 52 to 64; Vegas 17 to 28) while the time per proven deal doubles or worse. A selection tries up to 40 seeds, so a request finds no proven deal about once in thousands even in Vegas. The budgets in `src/features/deal/budgets.ts` stay.
    - **Verify:** `rtk npm run bench` prints the sweep.

- [x] 7.4 Solver-checked survival grading
    - **Implements:** GRD "Seeded playouts that see only face-up cards" and "Grading v1 turns playout survival into a grade"; D6.
    - **Files:** `src/solver/grading.ts` (`GRADING_V1` now holds M, the take and unforced-draw probabilities, the step cap, `checkpointEvery`, `maxCheckpoints`, `checkpointBudget` and the thresholds over the score; `playout` gains an `onStep` hook; new `survival` and the `Judge` seam; `gradeDeal` sums the survival of M playouts; `gradeOf` reads a score), `src/solver/README.md`.
    - **Tests:** `tests/unit/solver/grading.test.ts`: `survival` counts the checkpoints a scripted judge proves and stops at the first it cannot, asks at the checkpoint budget after every `checkpointEvery`-th command, stops at `maxCheckpoints`, gives a winning playout every checkpoint it had left, scores a playout that ends early 0 and plays the playout of its own index; `gradeDeal` sums and is deterministic with the real solver; a Daily deal grades like its Draw 1 twin; `gradeOf` reads each row.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/repo/solverPurity.test.ts` passes.

- [x] 7.5 Calibrate and pin grading v1
    - **Implements:** GRD "Grading v1 turns playout survival into a grade" ("Every grade is common enough", "Pinned grades do not drift").
    - **Files:** `tests/bench/grading.bench.ts` (score histograms of four parameter variants per mode, the best thresholds, the cost of a grading, and `GRADING_CALIBRATION=fixture`); `src/solver/grading.ts` (the thresholds); new `tests/fixtures/gradingGolden.ts` (60 calibration `[seed, score]` pairs and 6 golden deals per mode); `tests/fixtures/dailyGolden.ts` (a `grade` column); `tests/README.md`.
    - **Result:** M = 8, take 0.6, unforced 0.05, a checkpoint every 10 commands, at most 10 checkpoints, 3,000 nodes each. Thresholds (Easy from, Hard up to): Draw 1 62 and 43, Draw 3 30 and 12, Vegas 8 and 0. Shares of Easy, Medium and Hard on the sample: 35 / 32 / 33% in Draw 1, 32 / 32 / 37% in Draw 3 and 27 / 25 / 48% in Vegas. One grading costs 0.2 s (Draw 1), 0.35 s (Draw 3) and 0.45 s (Vegas) on average, at most 1.8 s.
    - **Tests:** `tests/unit/solver/gradingGolden.test.ts` regrades the golden deals and reads the calibration scores through the thresholds (each grade at least 15%); `tests/unit/features/deal/daily.test.ts` checks the Daily grades.
    - **Verify:** `rtk npm run bench` shows the shares, `rtk npx vitest run tests/unit/solver tests/unit/features/deal` passes.

- [x] 7.6 Selection with a target grade, and spares
    - **Implements:** GRD "A requested grade, or the closest one found"; SEL "Winnable selection by reject sampling" and "Background-thread message interface" (target, grade limit, grade and spares); D7.
    - **Files:** `src/solver/winnable.ts` (`findWinnable(seeds, budget, mode, options?)` with `selection`, the result's `grade` and `spares`), `src/solver/protocol.ts`, `src/features/deal/solverClient.ts` (`DealOptions`), `src/features/deal/dealService.ts` (options form of the call), `src/features/deal/budgets.ts` (`GRADE_LIMIT`), `tests/bench/winnable.bench.ts` (Draw 1 with target Hard), `tests/README.md`, `src/solver/README.md`.
    - **Tests:** `tests/unit/solver/winnable.selection.test.ts` (scripted grades: Any, exact match with spares, closest, tie to the earlier, grade limit, nothing proven), `winnable.test.ts`, `protocol.test.ts` (the selection is forwarded), `solverClient.test.ts`.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/features/deal` passes.

- [x] 7.7 Known verdicts and outcome reports
    - **Implements:** SEL "Winnable selection by reject sampling" (known verdicts) and "Background-thread message interface" (the outcome message); D7, D8.
    - **Files:** `src/solver/winnable.ts` (`Outcome`, `known`, `onOutcome`), `src/solver/protocol.ts` (`known` on the request, an `outcome` message), `src/features/deal/solverClient.ts` (`known`, `onOutcome`), the READMEs.
    - **Tests:** `winnable.selection.test.ts` (known wins and losses are trusted, cost nothing, change no result; each searched seed is reported once), `protocol.test.ts`, `worker.test.ts`, `solverClient.test.ts`.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/features/deal` passes.

## 8. Deal provenance and the storage record v2

- [x] 8.1 Record v2 with a lossless v1 upgrade, and the Difficulty setting
    - **Implements:**
      - PR "Settings and their defaults" (Difficulty);
      - PE "One versioned record holds what the device keeps", "Stored data is decoded defensively" and "An older record is upgraded without loss" (preferences part; KS-PER-06);
      - RF "Edge cases are proven end to end" ("A version 1 record is upgraded");
      - D10.
    - **Files:**
      - `src/features/preferences/preferencesSlice.ts` (`difficulty: 'any' | 'easy' | 'medium' | 'hard'`, default `any`);
      - `src/features/persistence/recordCodec.ts` (versioned key lists, dispatch on version, `upgradeV1`, `RECORD_VERSION = 2`);
      - `src/features/persistence/sessionCodec.ts` (takes the record version; the game keys are still the same in v1 and v2 until 8.2). Between this task and 8.2 the branch writes a v2 record whose game has no `grade` key, which 8.2 makes unreadable. That interim format never leaves the branch, so it needs no upgrade path;
      - `src/features/persistence/persistenceLoader.ts` (no backup for a readable v1);
      - `tests/fixtures/storage.ts` (a pinned v1 record string);
      - `docs/reference/storage-format.md` (both versions and the upgrade);
      - `docs/architecture/state-and-persistence.md`, `src/features/README.md`.
    - **Tests:**
      - `tests/unit/features/persistence/recordCodec.test.ts`:
        - a v1 record decodes and upgrades to `difficulty: 'any'`;
        - a v1 record with a 13th key is `invalid`;
        - a v2 record without `difficulty` is `invalid`;
        - version 3 is `future`;
        - a round trip writes v2 in the fixed key order;
      - `persistenceLoader.test.ts`: a v1 record leaves the backup key empty and the next save writes v2;
      - `preferencesSlice.test.ts`;
      - `tests/e2e/storage.spec.ts` gains "A version 1 record is upgraded": a seeded v1 record resumes its game, and the stored value becomes v2.
    - **Verify:** `rtk npx vitest run tests/unit/features` and `rtk npx playwright test storage --project=chromium` pass.

- [x] 8.2 The grade as game provenance, in the domain and the session record together
    - **Implements:**
      - DG "A deal records its provenance";
      - GE "A game state can be checked for validity" (the grade clauses);
      - PE "One versioned record holds what the device keeps" (the stored game's grade) and "An older record is upgraded without loss" (the game gets no grade);
      - GS "Restart replays the same deal" and "Dealing from a deal code";
      - D9.

      This must land in one task: a separate `GameState` field would break stored games.
    - **Files:**
      - `src/domain/types.ts` (`GameState.grade`), `src/domain/deal.ts` (`DealMeta.grade`, set by `dealFromSeed`), `src/domain/validate.ts`;
      - `src/features/persistence/sessionCodec.ts`: the v2 `GAME_KEYS` gain `grade` right after `attempts`; `STEP_KEYS` do not change, and a decoded step copies `grade` from the stored game like the other deal constants; `upgradeV1` sets `grade: null` on the stored game only (D9, D10);
      - `src/features/game/sessionThunks.ts` (restart keeps the grade; `playDealCode` gives `null`);
      - `tests/fixtures/states.ts`, `tests/fixtures/deals.ts` (fixtures gain `grade: null`);
      - `tests/e2e/support/seed.ts`;
      - `docs/reference/storage-format.md`, `src/domain/README.md`.
    - **Tests:**
      - `tests/unit/domain/{deal,validate}.test.ts`: a grade with verdict `random` is invalid; an unknown grade is invalid; a `win` fixture deal graded Medium, and every position of the fixture winning lines, are valid;
      - `sessionCodec.test.ts` and `recordCodec.test.ts`: a pinned v1 record **holding a game with undo and redo steps** decodes. Its game gets `grade: null` before the validity check runs (D10), so it is never rejected, and every restored step reads `grade: null`. A v2 step carrying a `grade` key is `invalid`;
      - `tests/unit/features/game/{startRestart,dealCode}.test.ts`.
    - **Verify:** `rtk npm run test:unit` and `rtk npx playwright test board storage --project=chromium` pass.

## 9. Deal service: every mode, a target grade, instant deals

- [x] 9.1 Verified deals in every mode with a requested grade
    - **Implements:**
      - DS "Deals per mode record their provenance", "Daily deal v1" (the grade), "The search never runs on the input thread" and "Dealing progress and overlay timing";
      - GS "Starting a game installs a fresh deal" and "Settings never change a game in progress";
      - HO "Home actions" (Deal cards honours the switch and Difficulty).
    - **Files:**
      - `src/features/deal/dealService.ts`: `DealRequest` gains `target`, sent as the search's `selection: { target, gradeLimit: GRADE_LIMIT }` (`GRADE_LIMIT` is in `budgets.ts`, task 7.6); Draw 1, Draw 3 and Vegas go to the worker when the switch is on; fallbacks for every mode; Daily is graded and always asks for `any`;
      - `src/features/game/sessionThunks.ts` (`startGame` reads the `difficulty` preference when the start begins and passes it as the request's `target`);
      - `tests/fixtures/dealService.ts` (the fake honours the new request);
      - `src/features/README.md`, `docs/architecture/data-flows.md`.
    - **Tests:**
      - `tests/unit/features/deal/dealService.deal.test.ts`:
        - winnable Draw 3 and Vegas deals;
        - a requested grade that is not found;
        - the switch off deals once;
        - worker failure per mode;
      - the contract suite;
      - `tests/unit/features/game/startRestart.test.ts`: the Difficulty is read at start, and changing it afterwards leaves the game and its grade alone.
    - **Verify:** `rtk npx vitest run tests/unit/features` passes.

- [x] 9.2 Solver hints in every mode
    - **Implements:** DS "Hints use the solver with a heuristic fallback"; IN "Hints come from the solver line or the heuristic"; D12.
    - **Files:** `src/features/deal/dealService.ts:199` (remove the gate), `src/features/README.md`.
    - **Tests:**
      - `tests/unit/features/deal/dealService.hint.test.ts`: a Draw 3 hint from the solver; a slow Vegas hint falls back; "Draw 3 and Vegas use the heuristic only" now means no proof;
      - `tests/unit/features/interaction/hint.test.ts`.
    - **Verify:** `rtk npx vitest run tests/unit/features` passes.

- [x] 9.3 The graded-spare pool
    - **Implements:** DS "Instant deals from a pre-verified pool" (the pool's own behaviour); D8.
    - **Files:** new `src/features/deal/dealPool.ts` (`createDealPool`; it takes the `SolverClient` the service builds, D8): proven, graded deals kept per mode and grade, at most `POOL_PER_GRADE` (2) each, oldest first; `take(mode, target)` gives the oldest deal of that grade, or the oldest of any grade for `any`, once; `deposit(mode, spares)` keeps the spares of a live search that fit; a filler that works on the current mode only, one request at a time, asking `findWinnable` for the grade whose bucket holds fewest deals, with fresh crypto seeds, the mode's budget and `GRADE_LIMIT`, and depositing the selected deal and its spares; a `random` result is not pooled; pause and resume; a failure drops only the fill in flight; dispose; `src/features/README.md`.
    - **Tests:** new `tests/unit/features/deal/dealPool.test.ts`, with a `SolverClient` over a stub worker, fake timers and an injected seed source:
      - only the current mode fills, the emptiest grade first, and a change of mode moves the next fill;
      - a `random` result is not pooled;
      - a bucket never holds more than its cap, and a spare that does not fit is dropped;
      - oldest first, each deal is taken once, `any` takes the oldest of any grade;
      - a grade with no pooled deal is not served from another grade;
      - it refills after use;
      - pause stops new fills but keeps the fill in flight;
      - a failure empties nothing already pooled, and the next fill starts a new worker;
      - no filling for Daily or with the switch off;
      - dispose.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

- [x] 9.4 The seed verdict cache
    - **Implements:** DS "A small in-memory verdict cache"; D8.
    - **Files:** new `src/features/deal/verdictCache.ts` (`createVerdictCache(limit = 256)`: a least-recently-used map from mode, budget and seed to the worker's `Outcome`; `known(mode, budget, seeds)` returns the entries it holds for those seeds, `record(mode, budget, outcome)` stores one; a Daily list, which is the same all day, is the case it serves best); `src/features/README.md`.
    - **Tests:** new `tests/unit/features/deal/verdictCache.test.ts`: a recorded outcome is returned for its mode, budget and seed and for nothing else; a different budget or mode misses; the least recently used entry goes first at the limit; a read counts as a use; `known` returns only the seeds asked for.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

- [x] 9.5 The deal service serves from the pool and the cache
    - **Implements:** DS "Instant deals from a pre-verified pool" (delivery, timing), "A small in-memory verdict cache" and "A newer request wins" (the pool is never cancelled); KS-PERF-02 (warm deals).
    - **Files:**
      - `src/features/deal/dealService.ts` (a second `SolverClient` for the pool, built with the same `createSolverClient(createWorker)` and passed to `createDealPool`; `prefetch(choice)`, `pause()`; delivery from the pool with no progress reports; every search request carries the cache's `known` verdicts and records each `outcome` in the cache; the spares of a live search are deposited in the pool; a delivered spare has attempts 1);
      - `src/app/thunkExtra.ts` (the `DealService` type);
      - `tests/fixtures/dealService.ts` (the fake gains `prefetch` and `pause`);
      - `src/features/README.md`.
    - **Tests:**
      - new `tests/unit/features/deal/dealService.pool.test.ts`:
        - a matching request is served at once with no overlay report;
        - a request the pool cannot serve is searched as usual, with the known verdicts, and its spares are pooled;
        - a player deal pauses filling without cancelling it;
        - a newer deal never cancels the pool;
        - a pooled deal carries its recorded verdict, attempts and grade;
        - a player's hint never waits behind a pool fill (DS "A newer request wins", scenario "A player's hint never waits behind the pool");
        - the player and pool threads answer the same selection request alike (SEL "Background-thread message interface", scenario "Two threads answer alike");
      - `dealService.deal.test.ts`: a second Daily request in a session is answered from the cache with no new search of the seeds it holds;
      - the contract suite.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal tests/unit/app` passes.

- [x] 9.6 The pool follows the player's choice
    - **Implements:** DS "The pool follows the player's choice" and "Instant deals from a pre-verified pool" (a hidden page pauses); D8.
    - **Files:**
      - new `src/app/dealPoolController.ts` (subscribes to `selectedMode`, `winnableOnly` and document visibility, not to `difficulty`: the pool fills the emptiest grade whatever the Difficulty; starts after the first idle period through an injected scheduler whose default uses `requestIdleCallback(cb, { timeout: 2000 })` where it exists and `setTimeout(cb, 2000)` otherwise, D8);
      - `src/app/lifecycle.tsx` starts and stops it;
      - `tests/e2e/dealLatency.spec.ts` (`:97`) and `tests/e2e/pwa.spec.ts` (`:85`): once the pool worker exists, identify the player's solver worker by creation order and request type instead of taking the first `worker` event;
      - `docs/architecture/data-flows.md` (the pool sequence, in mermaid);
      - `docs/architecture/state-and-persistence.md`.
    - **Tests:**
      - new `tests/unit/app/dealPoolController.test.ts`:
        - changing the mode moves the filling, and a difficulty change does not start a fill;
        - returning to a kept choice finds its deals;
        - Daily or the switch off stops filling;
        - hidden pauses and visible resumes;
        - nothing starts before the idle signal;
        - the default scheduler uses `requestIdleCallback` when present and falls back to a 2 s timer when it is absent;
      - `tests/component/appLifecycle.wiring.test.tsx` (injected gateway): the controller starts and is disposed.
    - **Verify:** `rtk npx vitest run tests/unit/app tests/component/appLifecycle.wiring.test.tsx`, `rtk npm run validate:lifecycle-storage` and the full `rtk npm run e2e` pass (the App composition changes and a second worker now starts).

## 10. Difficulty and all-mode UI

- [x] 10.1 The Winnable card in every mode, with the Difficulty control
    - **Implements:** HO "Winnable deals only switch" (KS-DEAL-03, KS-DEAL-11); D11.
    - **Files:**
      - `src/ui/components/Segmented.tsx` (gains `disabled`; it already has the `radiogroup` and `radio` roles and a roving tabindex; each option keeps a coarse-pointer target of at least 44×44 px);
      - `src/ui/screens/home/WinnableToggle.tsx`;
      - `src/ui/styles/home.css` and `controls.css`;
      - `src/i18n/locales/{en,uk}.ts` (difficulty labels; captions that replace `home.winnable.captionDraw1`, `captionSolver` and `captionDaily`);
      - `src/ui/README.md`.
    - **Tests:**
      - new `tests/component/home/winnable.test.tsx`:
        - the switch is live in Draw 1, Draw 3 and Vegas, and on and disabled in Daily;
        - Difficulty is enabled only with the switch on outside Daily;
        - it is chosen by click or tap, by arrow keys and by Space;
        - while disabled, the stored choice is untouched;
        - it has the accessible name "Difficulty" and each option exposes its checked state;
      - `tests/component/home/modes.test.tsx`;
      - `tests/e2e/home.spec.ts`: choose Hard in Draw 3 by keyboard, then deal.
    - **Verify:**
      - `rtk npx vitest run tests/component/home`;
      - `rtk npx playwright test home --project=chromium --project=iphone-17-pro`;
      - `rtk npx playwright test --project=device-fit` (it includes the pseudo-locale);
      - the full `rtk npm run e2e`.

- [x] 10.2 The deal chip shows the grade
    - **Implements:** GM "Mode and deal chips" (KS-DEAL-06, KS-DEAL-11).
    - **Files:** `src/ui/components/DealChip.tsx`, `src/ui/styles/layout.css` (only if the fit needs it), the catalogs (`game.chip.deal.*`), `src/ui/README.md`.
    - **Tests:** `tests/component/chips.test.tsx`:
      - "Winnable · Medium";
      - the shuffle count lives in the accessible description and tooltip, not the visible text;
      - "Random deal";
      - the icon-only chip keeps the full text as its name.
    - **Verify:** `rtk npx vitest run tests/component/chips.test.tsx` and `rtk npx playwright test --project=device-fit` pass.

- [x] 10.3 The Win sheet shows the grade
    - **Implements:** SH "Win sheet"; IN "Win summary".
    - **Files:**
      - `src/features/interaction/interactionSlice.ts:12-19` (`WinSummary.grade`);
      - the win-summary builder in `src/features/game/gameThunks.ts` (`commitCommand`, `:86-94`);
      - `src/ui/sheets/WinSheet.tsx`;
      - the title's typeface: the Win title is the shared `ModalSheet` `<h2>` (`ModalSheet.tsx:128`), styled by `.modal-sheet__header h2` in `src/ui/styles/sheets.css:40`, which sets no font. Add a Win-only title variant (a `ModalSheet` prop or a Win sheet class) so the title uses the pixel typeface, as SH "Win sheet" states, and no other sheet changes;
      - the catalogs.
    - **Tests:**
      - `tests/unit/features/interaction/winSummary.test.ts` (the grade, or none);
      - `tests/component/sheets/win.test.tsx` ("Hard deal" is shown; nothing for an ungraded game; a restarted graded game that is won still shows its grade; the Win title carries the pixel-typeface class and other sheets' titles do not).
    - **Verify:** `rtk npx vitest run tests/unit/features/interaction tests/component/sheets` passes.

- [x] 10.4 How to play explains Winnable deals and the grades
    - **Implements:** SH "How to play sheet".
    - **Files:** `src/ui/sheets/HelpSheet.tsx`, the catalogs.
    - **Tests:** `tests/component/sheets/help.test.tsx` shows the passage and the three grade names, in both languages.
    - **Verify:** `rtk npx vitest run tests/component/sheets` and `rtk npx playwright test a11y --project=chromium` pass.

## 11. Proof: full-game wins, traceability and the verification sweep

- [x] 11.1 Winning-line fixtures for Draw 3, Vegas and Daily
    - **Implements:** RF "Input is proven end to end" (fixtures); D16.
    - **Files:**
      - `tests/fixtures/deals.ts`: new `DRAW3_LINE`, `VEGAS_LINE` and `DAILY_LINE`. Each is the shortest line with no foundation → column move among the winnable seeds 1–50 of its mode. Daily uses a golden date's seed from `tests/fixtures/dailyGolden.ts`;
      - new `tests/unit/fixtures/winningLines.test.ts`;
      - `tests/README.md` (the generation recipe).
    - **Tests:** every line, including `WINNING_LINE`, replays through `applyCommand` to a won state, with the recorded moves, score and passes, without the solver.
    - **Verify:** `rtk npx vitest run tests/unit/fixtures` passes.

- [x] 11.2 Full-game wins in every mode through real input
    - **Implements:** RF "Input is proven end to end".
    - **Files:**
      - new `tests/e2e/playModes.spec.ts`:
        - Draw 3 by keyboard;
        - Vegas by drag;
        - Daily by tap, started from Home under `page.clock.setFixedTime` on the golden date (Date only; timers and the worker run normally) so that the real worker selects the seed;
      - `tests/e2e/playBy{Tap,Drag,Keyboard}.spec.ts` stop skipping Firefox, WebKit and `iphone-17-pro` (today they are Chromium-only);
      - `tests/unit/repo/playwrightProjects.test.ts` (`:9-17`, `:38`): the Chromium-only list and skip guards change with them;
      - `tests/e2e/support/play.ts`: `playLine` already plays any command line and turns draws into stock taps or the draw key; only `seedWinningGame` (`:36-41`), which is tied to `WINNING_LINE`, gains a line parameter;
      - `tests/unit/e2e-support/lineGestures.test.ts` only if a gesture plan changes.
    - **Tests:** the Win sheet appears with the expected moves and score in each mode. Animations are off in these specs.
    - **Verify:** `rtk npx playwright test playModes playByTap playByDrag playByKeyboard --project=chromium --project=firefox --project=webkit --project=iphone-17-pro` passes.

- [x] 11.3 Traceability generator and guard, in report mode
    - **Implements:** RF "Requirement traceability is generated and checked" (generation, stale and unknown checks); D17.
    - **Files:**
      - new `scripts/trace-requirements.mjs` (and its `.d.mts`): the matrix comes from the main specs `openspec/specs/**`; the active changes' `specs/**` only add known ids; it reads `// covers:` comments in `tests/**` and the table in `docs/reference/manual-checks.md`;
      - new `docs/reference/traceability.md` (generated, formatted with the project's Prettier configuration so that `format:check` and the pre-commit hook never change it);
      - new `docs/reference/manual-checks.md` (table skeleton plus the procedure format);
      - `package.json` (`trace` script), `docs/reference/scripts.md`, `docs/development/testing.md`, `AGENTS.md` ("Runtime and commands").
    - **Tests:** new `tests/unit/repo/traceability.test.ts`:
      - the committed matrix equals a fresh generation;
      - an unknown KS id in a test or a manual check fails;
      - uncovered ids are listed but do not fail yet (a `STRICT = false` constant);
      - a delta-only id cited by a test is accepted and leaves the matrix unchanged;
      - the informational list of delta-only ids that no test or manual check declares names such an id without failing (D17);
      - running the generator twice changes nothing, and Prettier leaves its output unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/repo` passes, and `rtk npm run trace` followed by `rtk npm run format:check` reports no change.

- [x] 11.4 Annotate the deal, move, scoring and assistance tests
    - **Implements:** RF "Requirement traceability is generated and checked" (coverage). KS-DEAL, KS-MOVE, KS-SCO, KS-AST, including this change's delta-only KS-DEAL-11 (grading, target selection, the grade in state and UI) and KS-DEAL-12 (the pool).
    - **Files:** `// covers:` comments only, in `tests/unit/{domain,solver,features/deal,features/game,features/interaction}/**`, the matching `tests/e2e/*.spec.ts` and component tests for the new ids, and the regenerated `docs/reference/traceability.md`.
    - **Tests:** no assertion changes. A comment is added only where the test really proves that id.
    - **Verify:** `rtk npm run trace` shows no uncovered KS-DEAL, KS-MOVE, KS-SCO or KS-AST id, or lists the gaps for 11.7, and KS-DEAL-11 and KS-DEAL-12 are absent from the informational delta-only list. `rtk npx vitest run tests/unit/repo` passes.

- [x] 11.5 Annotate the input, accessibility, general and settings tests
    - **Implements:** RF traceability (coverage). KS-INP, KS-A11Y, KS-GEN, KS-SET, including the delta-only KS-GEN-11 (build identity: `buildInfo`, `buildStamp`, About and the Home stamp tests).
    - **Files:** `// covers:` comments in `tests/component/**`, `tests/unit/ui/**`, `tests/e2e/**` and `tests/unit/features/preferences/**`, plus the regenerated matrix.
    - **Verify:** as 11.4, for these prefixes.

- [ ] 11.6 Annotate the persistence, PWA, i18n, statistics and performance tests, and list the manual checks
    - **Implements:** RF traceability (coverage); RF "Performance and installability are checked manually and recorded" (the list).
    - **Files:**
      - `// covers:` comments in `tests/unit/{features/persistence,features/stats,pwa,i18n,app}/**` and the matching e2e specs, including the delta-only KS-PER-06 (the v1 upgrade in `recordCodec`, `sessionCodec`, `persistenceLoader` and `storage.spec.ts`);
      - `docs/reference/manual-checks.md` rows for KS-PERF-01, KS-PERF-02, KS-PERF-03 with KS-PWA-02, the real-device fit (KS-GEN-03, KS-GEN-05, KS-GEN-10) and KS-INP-10, each with procedure, target and result columns;
      - the regenerated matrix.
    - **Verify:** as 11.4, for these prefixes.

- [ ] 11.7 Close the remaining traceability gaps
    - **Implements:** RF traceability (coverage) and whichever requirement each uncovered id names.
    - **Files:** new or extended tests at the right layer for every id `docs/reference/traceability.md` still lists as uncovered, plus the regenerated matrix.
    - **Stop condition:** if more than about six ids need new e2e specs, stop and surface the list.
    - **Verify:** `rtk npm run trace` lists no uncovered id.

- [ ] 11.8 Make the traceability guard strict
    - **Implements:** RF "Requirement traceability is generated and checked" (strict).
    - **Files:** `tests/unit/repo/traceability.test.ts` (`STRICT = true`), `docs/development/testing.md`.
    - **Tests:** the guard fails when a fixture matrix has an uncovered main-spec id. The new ids KS-DEAL-11, KS-DEAL-12, KS-PER-06 and KS-GEN-11 join the strict rule once 14.4 syncs them into the main specs, so this task makes sure they are already covered.
    - **Verify:** `rtk npm run validate` passes, and the guard's informational delta-only list is empty (each of the four new ids is declared by at least one test).

- [ ] 11.9 Informational drag-performance trace
    - **Implements:** RF "Performance and installability are checked manually and recorded" (the trace) and "Test suites separated by execution layer" (a Chromium-only spec); KS-PERF-01.
    - **Files:**
      - new `tests/e2e/dragPerf.spec.ts`: Chromium only, a phone viewport, 4× CPU throttling over CDP; it drags a run across the board and reports frame times (median, p95, frames over 16.7 ms) as an annotation, with no timing assertion;
      - `playwright.config.ts` if the project list needs it;
      - `tests/unit/repo/playwrightProjects.test.ts`;
      - `tests/README.md`.
    - **Verify:** `rtk npx playwright test dragPerf --project=chromium` passes and prints the report.

- [ ] 11.10 Deal latency for every mode, cold and from the pool
    - **Implements:** RF "In-browser deal latency is reported"; KS-PERF-02.
    - **Files:**
      - `tests/e2e/dealLatency.spec.ts`:
        - per mode, on demand with a fresh page;
        - warm pool deals against the 100 ms target. The spec knows the pool is warm by wrapping `postMessage` in the pool worker through `worker.evaluate` and counting its `findWinnable` replies, never by a fixed wait;
        - for information, Draw 1 with target Hard, and Draw 1 while a pre-verification is in flight;
        - the player's worker is identified as task 9.6 set up (creation order and request type);
      - `tests/README.md` (recorded results).
    - **Verify:** `rtk npx playwright test dealLatency pwa --project=chromium` passes and prints every path.

- [ ] 11.11 Device matrix, a device-fit rerun on the production build, and the real-device checklist
    - **Implements:** BL "Columns compress face-down cards first" (the device matrix); GM "The Game screen never scrolls and respects safe areas"; RF "Performance and installability are checked manually and recorded" (the real-device checklist).
    - **Files:**
      - new `docs/reference/device-matrix.md` (the 13 screens with viewport sizes, portrait and landscape, browser and installed, and the real-device checklist table);
      - `tests/fixtures/viewports.ts` cites it instead of the spec pack;
      - `docs/reference/manual-checks.md`.
    - **Verify:**
      - `rtk npx playwright test --project=device-fit` passes against the production build that `webServer` uses;
      - before archive, the author records the real-device rows, or a dated waiver with its reason for each device they do not have, in `manual-checks.md`. Ask the author which devices they own.

- [ ] 11.12 Flake sweep
    - **Implements:** Phase 9 "no flaky tests" (RF "Edge cases are proven end to end" and "Input is proven end to end").
    - **Files:** `tests/README.md` (the sweep results: date, command, pass count, and any quarantined or fixed flake with its cause).
    - **Checks:** run `rtk npx playwright test --repeat-each=3` over all seven projects, and `rtk npm run test:unit` three times. Every failure goes through `superpowers:systematic-debugging`: fix it, never add retries or skips.
    - **Verify:** three clean repeats are recorded. The three CI reruns need the author to approve a push. If they don't, record that CI reruns are pending.

## 12. Visual review before retiring the mockup

- [ ] 12.1 Compare every screen with the mockup, and fix polish
    - **Implements:** the stand-alone look statements of HO ("Home top bar", "Home hero", "Mode choice", "Home record strip"), GM ("Two chrome profiles", "HUD values and the Time control", "Game top bar actions"), SH ("Settings sheet", "Statistics sheet"), BR "Card faces", BK "Shortcuts", AS ("Continue game on Home", "Semantic colour tokens for the three palettes") and AP "Night cards change the cards only". The app must match what these requirements now state on their own.
    - **Files:**
      - CSS and markup polish only, in `src/ui/**` and `src/ui/styles/**`;
      - the catalogs if a glyph changes;
      - `src/assets/fonts/README.md` if the subset changes;
      - `tests/README.md` (accepted differences).
    - **Known candidates:**
      - the pixel-font minus in "−$52" (U+2212 in `home.modes.vegas.meta`; it may fall back from Press Start 2P);
      - Cyrillic coverage in every pixel-font string;
      - Settings segmented options at 44×44 px on a coarse pointer (KS-A11Y-04). Task 10.1 changes `Segmented`, so only verify it here.
    - **Tests:** add a component or CSS static test for every fix (for example, the pixel-font strings use only characters Press Start 2P covers). `tests/e2e/visualParity.spec.ts` screenshots are reviewed against `docs/spec/mockup/screens/01`–`17`.
    - **Stop condition:** anything larger than polish is surfaced, not absorbed.
    - **Verify:** the full `rtk npm run e2e` and `rtk npx playwright test --project=device-fit` pass, and the review is recorded screen by screen in `tests/README.md`.

- [ ] 12.2 Committed reference screenshots
    - **Implements:** RF "Committed reference screenshots are the look-and-feel reference", "Test suites separated by execution layer" (the opt-in, Chromium-only capture) and "Continuous integration on every push and pull request" (visual-parity naming); D19.
    - **Files:**
      - new `tests/e2e/screenshots.spec.ts` (skipped unless `CAPTURE_SCREENSHOTS=1`; Chromium; production build);
      - new `docs/assets/screenshots/*.jpg`: Home and Game, light and dark, desktop and phone, about 8 files;
      - `tests/e2e/visualParity.spec.ts` names its screenshots by screen and state instead of mockup files;
      - `package.json` (`screenshots` script), `docs/reference/scripts.md`, `tests/unit/repo/playwrightProjects.test.ts`, `tests/README.md`.
    - **Verify:** `CAPTURE_SCREENSHOTS=1 rtk npx playwright test screenshots --project=chromium` writes the files, and a plain `rtk npm run e2e` skips it.

## 13. Retire the spec pack; docs and release

- [ ] 13.1 Move the facts that still apply out of the spec pack
    - **Implements:** D18 (facts); RF "No references to the retired spec pack" (fixtures cite the git revision); D1S "Search results match the reference solver" and CM "Deterministic pseudo-random sequence" and "Unbiased shuffle" (their pinned references now cite the revision or state the vector).
    - **Files:**
      - `docs/reference/game-rules.md`: rules as implemented, Microsoft Windows Solitaire parity, the scoring rationale, the undo and Vegas decisions, the draw and recycle mechanics;
      - new `docs/reference/winnability.md`: winnability facts, solver literature, how selection, grading and the pool work for players;
      - `docs/architecture/domain-and-solver.md`: the Draw 1 reference-solver description, and D2–D8;
      - `tests/fixtures/solverCorpus.ts:8`, `tests/fixtures/dailyGolden.ts:5` and `tests/unit/domain/prng.test.ts:10` cite `git show d72187f:docs/spec/mockup/klondike-mockup.html`.
    - **Tests:** none new; the fixtures are unchanged apart from comments.
    - **Verify:** every fact the docs and tests used from the pack now has a home (checked against `rg -n "R§|research.md|phased-design|specification.md" src tests docs --glob '!docs/spec/**'`), and `rtk npm run test:unit` passes.

- [ ] 13.2 Remove spec-pack citations from code and test comments
    - **Implements:** RF "No references to the retired spec pack" (source and tests); RF "Pure input modules stay pure" (its module list no longer cites the pack).
    - **Files:** comments only, in every `src/**` and `tests/**` file that cites the pack, the mockup, `R§` or `spec §`. Among them:
      - `src/features/deal/dealService.ts`, `src/ui/board/useWinSheet.ts`, `src/features/README.md` ("specification §6");
      - never `src/solver/solver.ts`: it is frozen (D2), and its comment mentioning the mockup forbids nothing the guard checks;
      - `src/ui/screens/home/{HomeActions,HomeLinks,RecordStrip}.tsx`, `src/ui/sheets/{StatsSheet,WinSheet,HelpSheet}.tsx`;
      - `src/ui/styles/{home,layout,tokens}.css`, `src/ui/README.md`;
      - `tests/fixtures/{boardPositions,deals}.ts`, `tests/unit/domain/deal.test.ts`, `tests/unit/ui/board/pointerController.test.ts`;
      - `tests/README.md` (every spec-pack reference in it).
    - **Tests:** unchanged.
    - **Verify:** `rg -n "docs/spec|klondike-mockup|R§|spec §|specification §|phased-design|research\.md|specification\.md" src tests scripts .github --glob '!src/solver/solver.ts'` finds only revision-pinned references. `rtk npm run test:unit` passes.

- [ ] 13.3 Delete `docs/spec`, repoint the instructions, and add the guard
    - **Implements:** RF "No references to the retired spec pack" (the folder is gone; the guard); the proposal's constitution changes (principle 10, the source-of-truth order).
    - **Files:**
      - delete `docs/spec/**`;
      - `.prettierignore`: remove the `docs/spec/` line that 2.12 left;
      - `AGENTS.md`:
        - "Source of truth": code, configuration, tests and CI, then `openspec/specs`, then `docs/`;
        - the repository layout;
        - principle 10: look and feel is fixed and reviewed against the committed screenshots;
        - every `phased-design.md §n` and spec-pack reference;
        - the Speckit note;
      - `openspec/config.yaml`: `context`, and `rules` (the KS rule points at KS ids in `openspec/specs`, and the proposal rule no longer cites the phase plan);
      - `README.md:59`, `docs/README.md:49-55`, `docs/development/workflow.md:34`, `docs/development/project-structure.md:11`, `docs/architecture/overview.md:69`, `docs/reference/game-rules.md:3-4`;
      - new `tests/unit/repo/noSpecPack.test.ts`:
        - it scans tracked and new files (`git ls-files -co --exclude-standard`) for exactly the D18 patterns: `docs/spec`, `klondike-mockup`, `specification.md`, `research.md`, `phased-design`, `R§`, `spec §` and `specification §` (not the bare word "mockup");
        - it exempts `openspec/changes/**`, revision-pinned references and its own source;
        - `openspec/specs/**` stays exempt until 14.4;
        - it fails if the folder exists.
    - **Tests:** the new guard. A fixture file with an `R§` or a `spec §3.2` citation fails, and a revision-pinned citation passes.
    - **Before adding the guard:** run a repo-wide `rg -n "docs/spec|klondike-mockup|R§|spec §|specification §|phased-design|research\.md|specification\.md" --glob '!openspec/changes/**' --glob '!openspec/specs/**'` and fix every hit, including docs written earlier in this change.
    - **Verify:** `rtk npm run validate` passes, and `test -d docs/spec` fails.

- [ ] 13.4 A docs-link test, and the broken links it finds
    - **Implements:** RF "Maintained documentation links resolve".
    - **Files:**
      - new `tests/unit/repo/docsLinks.test.ts`: relative Markdown links, and inline-code paths starting with `src/`, `tests/`, `docs/`, `scripts/`, `public/`, `openspec/` or `.github/` (including `path#symbol`), resolve in `README.md`, `CHANGELOG.md` once it exists (13.9), `docs/**`, the module READMEs under `src/` and `tests/`, and `AGENTS.md`. Globs, brace lists, `<placeholders>`, generated folders (`dist/`, `coverage/`, `playwright-report/`, `test-results/`) and `https://` links are skipped;
      - only the broken links and stale paths the test reports, wherever they are; content rewrites belong to 13.5–13.7.
    - **Tests:** the new docs-link test. A fixture doc with a broken link fails, and it names the file, line and target.
    - **Verify:** `rtk npx vitest run tests/unit/repo` passes.

- [ ] 13.5 Architecture docs and module READMEs match the code
    - **Implements:** constitution 9 (docs are part of the change); RF "Maintained documentation links resolve" (kept green).
    - **Files:**
      - `docs/architecture/{overview,domain-and-solver,state-and-persistence,ui,i18n-and-pwa,data-flows}.md`, with cited paths and symbols checked, and mermaid diagrams for the layers, the deal pool and the storage upgrade;
      - `src/{domain,solver,features,i18n,pwa,ui}/README.md`.
    - **Verify:** the docs-link test and `rtk npm run format:check` pass.

- [ ] 13.6 Development docs and the docs index match the code
    - **Implements:** constitution 9 (docs are part of the change).
    - **Files:**
      - `docs/README.md` (the index and reading order, with no spec-pack section);
      - `docs/development/{getting-started,project-structure,workflow,code-standards,testing,ci-and-deployment}.md`.
    - **Verify:** the docs-link test and `rtk npm run format:check` pass.

- [ ] 13.7 Reference docs and the tests README match the code
    - **Implements:** constitution 9 (docs are part of the change).
    - **Files:**
      - `docs/reference/{scripts,keyboard-and-controls,game-rules,storage-format}.md`;
      - `tests/README.md` (including the stale "twelve" visual-parity note at `:125`);
      - `tests/unit/repo/configContract.test.ts`: a new check that every npm script in `package.json` appears in `docs/reference/scripts.md` (no such check exists today).
    - **Tests:** the new script-documentation check.
    - **Verify:** the docs-link test, `rtk npx vitest run tests/unit/repo` and `rtk npm run format:check` pass.

- [ ] 13.8 README
    - **Implements:** RF "Committed reference screenshots are the look-and-feel reference" (the README uses them); Phase 10 README.
    - **Files:** `README.md`: what the game is, the features (modes, winnable and graded deals, instant deals, offline and install, languages, accessibility), the screenshots from `docs/assets/screenshots/`, the Pages link, the commands and the docs map.
    - **Verify:** the docs-link test passes, and the README renders with every image resolving.

- [ ] 13.9 Version 1.0.0, the changelog and the release procedure
    - **Implements:** RF "Releases are versioned and recorded"; D20.
    - **Files:**
      - `package.json` and `package-lock.json` (the root version 1.0.0);
      - new `CHANGELOG.md` (1.0.0 with date and highlights of Phases 1–11, describing the retired pack in words, not by path);
      - new `docs/development/release.md`;
      - `docs/development/ci-and-deployment.md` (the procedure link, and the resolved integration-branch TODO at `:155`), `AGENTS.md` ("Git and review" points to the procedure).
    - **Tests:** `tests/unit/repo/configContract.test.ts` checks that the version is 1.0.0, valid semver, and equal to the lockfile's root entry. `tests/component/sheets/about.test.tsx` keeps asserting its Vitest fallback, because Vitest defines no `__APP_VERSION__` (D20).
    - **Verify:** `rtk npm run validate` passes.

## 14. Integration checks

- [ ] 14.1 Full verification run
    - **Implements:** the integration of every group.
    - **Checks:**
      - `rtk npm run validate`;
      - the full `rtk npm run e2e` (all seven projects);
      - `rtk npm run bench` (informational);
      - `rtk npm run trace && git diff --exit-code docs/reference/traceability.md`.
    - **Verify:** every command exits 0, and the results are recorded in `tests/README.md`.

- [ ] 14.2 Lighthouse re-check
    - **Implements:** RF "Performance and installability are checked manually and recorded" (KS-PERF-03, KS-PWA-02).
    - **Procedure:** run `rtk npm run build && rtk npm run preview`, then Lighthouse with mobile emulation on `/solitaire/`, with the pool controller active.
    - **Files:** `docs/reference/manual-checks.md`: installability and a performance score of at least 90, with the date and the browser version.
    - **Verify:** the result is recorded. If the score is below 90, stop and surface it rather than lowering the bar.

- [ ] 14.3 Independent final review
    - **Implements:** AGENTS.md "Sub-agent driven workflow"; global review rules.
    - **Checks:** a fresh-context reviewer compares the whole diff with the delta specs, `design.md` and the AGENTS.md principles:
      - the Draw 1 search, `SOLVER_CORPUS` and the Daily golden seeds and attempts are untouched;
      - there is no `Math.random` in `src/domain` or `src/solver`;
      - the workers keep no state between requests;
      - decoding never salvages, and a readable v1 is never backed up;
      - there are no spec-pack references;
      - every string comes from the catalogs;
      - every animation has a no-motion path;
      - no test mocks our own modules beyond the three justified ones (2.9);
      - the deal's grade is named `grade` in data, and `difficulty` only names the preference (D9);
      - stored undo and redo steps carry no provenance of their own (D9, D10).
    - **Verify:** no open Blocking or Important findings, and every fix is committed after `rtk npm run validate`.

- [ ] 14.4 Archive readiness: sync the specs, the editorial pass, and a strict guard
    - **Implements:** RF "No references to the retired spec pack" (main specs included); D18 (the editorial pass).
    - **Steps:**
      1. Run `openspec validate finalize-v1-release --strict`, then sync the delta specs into the main specs with the `openspec-sync-specs` skill (sync is not a CLI command).
      2. Edit `openspec/specs/**` directly, for non-normative citations only: every footnote that still cites `spec §n`, `specification §n`, `R§n`, `phased-design` or "the mockup" (in `ui/{game-screen,sheets,board-render,board-layout,board-motion,win-cascade}`, `app/appearance`, `features/{statistics,game-session,interaction}` and any other hit of the verify `rg`), and the `## Purpose` lines of `ui/home-screen`, `ui/board-assist` and `features/preferences`. Keep every KS id.
      3. Remove the `openspec/specs/**` exemption from `tests/unit/repo/noSpecPack.test.ts`.
      4. Regenerate the traceability matrix.
    - **Verify:**
      - `rtk npm run validate` passes;
      - `rg -n "R§|spec §|specification §|docs/spec|phased-design" openspec/specs` finds only revision-pinned references;
      - the two new capabilities (`solver/draw3-solver`, `solver/deal-grading`) and the edited Purposes are in the main specs;
      - after archive, merging to `feature/app-v1-release`, the PR to `master`, the `v1.0.0` tag and removing the stale remote branches happen only when the author asks (D1, D20).
