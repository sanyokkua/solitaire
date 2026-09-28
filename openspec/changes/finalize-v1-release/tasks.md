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

- [ ] 1.1 Remove the stale branch and phase instructions, and commit the change artifacts
    - **Implements:** D1. No requirement change.
    - **Branches:** the work happens on `feature/finalize-v1-release`, cut from the integration branch `feature/app-v1-release`, which was cut from `master`. Both already exist locally. Pushing either needs the author's explicit request.
    - **Files:**
      - `AGENTS.md`:
        - "Repository state" says Phases 1–8 are merged to `master` and live, and that `finalize-v1-release` carries Phases 9–11.
        - "Git and review" branch rules:
          - `master` is the release branch;
          - each change runs on `feature/<change-name>` cut from the active integration branch, which the change's proposal names (`feature/app-v1-release` here), or from `master` when there is none;
          - squash-merge back at archive;
          - the integration branch reaches `master` by pull request.
        - Remove the `feature/app-v1-implementation` lines.
      - `docs/development/workflow.md`: the same branch rules.
      - `openspec/config.yaml` `context`: implemented phases, and the active change.
      - Commit `openspec/changes/finalize-v1-release/**` together with these edits.
    - **Tests:** none (process and docs).
    - **Verify:**
      - `git rev-parse --abbrev-ref HEAD` prints `feature/finalize-v1-release`;
      - `rg "app-v1-implementation" AGENTS.md docs openspec/config.yaml` finds nothing;
      - `rtk npm run validate` passes.

## 2. Quality work with no behaviour change (D15)

- [ ] 2.1 Enforce the coverage thresholds in the validation gate
    - **Implements:** RF "Single aggregate validation gate".
    - **Files:**
      - `package.json`: `validate` runs the unit and component suites with `--coverage`, in place of `test:unit`, keeping the step order;
      - `vitest.config.ts`;
      - `AGENTS.md` ("Runtime and commands");
      - `docs/reference/scripts.md`, `docs/development/testing.md`.
    - **Tests:** `tests/unit/repo/configContract.test.ts` asserts that the gate's test step runs coverage and that thresholds are 80/80/80/80.
    - **Stop condition:** measure first. Where a threshold fails, add behaviour tests for the uncovered code, never lower the bar. If the gap needs more than about five new test files, stop and surface it.
    - **Verify:** `rtk npm run validate` passes with the coverage summary printed.

- [ ] 2.2 One thunk-dependency assembly
    - **Implements:** D15 (thunk extra). No requirement change.
    - **Files:**
      - `src/app/thunkExtra.ts`: new `assembleThunkExtra(overrides)` that merges the defaults and builds `lazyDealService` once;
      - `src/app/store.ts:32-40` and `src/app/lifecycle.tsx:71-80` use it;
      - the loader receives `extra.languages()`, not `navigator.languages`;
      - `src/app/README.md` if present, otherwise the app section of `docs/architecture/state-and-persistence.md`.
    - **Tests:**
      - `tests/unit/app/thunkExtra.test.ts`: factory injection replaces the `vi.mock` of `createDealService`; it asserts that one deal service is built lazily and that overrides win;
      - `tests/component/appLifecycle.wiring.test.tsx` drops the `navigator.languages` patch (`:74-76`) and injects `languages`.
    - **Verify:** `rtk npx vitest run tests/unit/app tests/component/appLifecycle.wiring.test.tsx`, `rtk npm run validate:lifecycle-storage` and the full `rtk npm run e2e` pass. A second worker now exists, so check specs that wait for a worker (`dealLatency`, `pwa`).

- [ ] 2.3 Remove production code kept alive only by tests
    - **Implements:** D15 (dead code).
    - **Files:**
      - remove `readOnlyEntered` (`src/features/persistence/persistenceSlice.ts:19`), `selectBusy` (`src/features/game/gameSlice.ts:198`) and `selectPendingHint` (`src/features/interaction/selectors.ts:43`);
      - `src/ui/sheets/StatsSheet.tsx:34` uses `selectWinRate` instead of its inline copy;
      - `src/features/README.md`.
    - **Tests:**
      - drop the assertions that only exercised the removed exports (find them with `rg "readOnlyEntered|selectBusy|selectPendingHint" tests`), keeping every behaviour assertion;
      - `tests/component/sheets/stats.test.tsx` still shows the same win rates.
    - **Verify:** `rtk npx vitest run tests/unit/features tests/component/sheets/stats.test.tsx` passes, and `rg "readOnlyEntered|selectBusy|selectPendingHint" src tests` finds nothing.

- [ ] 2.4 One source for the mode list, the Daily cap and the codec guards
    - **Implements:** D15 (single sources).
    - **Files:**
      - `src/domain/deal.ts` exports `MODES`, used by `src/domain/validate.ts:18`, `src/features/persistence/recordCodec.ts:47` and `src/ui/sheets/StatsSheet.tsx:13`;
      - `MAX_DAILY_COMPLETED` is defined only in `src/features/stats/statsSlice.ts`;
      - new `src/features/persistence/guards.ts` holds `isRecord`, `hasExactKeys` and `isDayKey` (moved from `sessionCodec.ts:76-101`);
      - `src/features/stats/dayKeys.ts` reuses `isDayKey`;
      - `recordCodec.ts:26` drops the test-only re-export;
      - `src/domain/README.md`, `src/features/README.md`.
    - **Tests:**
      - new `tests/unit/features/persistence/guards.test.ts` (exact keys, day keys including 2026-02-30 rejected, non-objects);
      - `recordCodec.test.ts`, `sessionCodec.test.ts` and `dayKeys.test.ts` keep their assertions.
    - **Verify:** `rtk npx vitest run tests/unit/features tests/unit/domain` passes.

- [ ] 2.5 Engine tuple updates without casts
    - **Implements:** D15 (engine casts).
    - **Files:** `src/domain/engine.ts:47,53`, with a typed tuple `replaceAt` helper and no `as unknown as`.
    - **Tests:** `tests/unit/domain/engine.*.test.ts` unchanged and green.
    - **Verify:** `rtk npx vitest run tests/unit/domain`, and `rg "as unknown as" src/domain` finds nothing.

- [ ] 2.6 One pile identity on the board
    - **Implements:** D15 (pile identity).
    - **Files:**
      - `src/domain/rules.ts` exports `samePile` (today private at `:77`);
      - `src/ui/board/keyboardController.ts:39-50` uses it;
      - `pileKey` moves from `src/ui/board/landing.ts:18` to `src/ui/board/names.ts` or `locate.ts`, whichever holds pile identity;
      - `useBoardActions.ts`, `useBoardKeyboard.ts` and `selectors.ts` import it from there;
      - `useBoardKeyboard.ts:58-91` builds its hits from `selectCardLocations`, the same source the pointer path uses;
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/unit/ui/board/keyboardController.test.ts`, `landing.test.ts`, `tests/component/boardKeyboard.test.tsx` and `tests/unit/repo/boardPurity.test.ts` stay green;
      - add a keyboard case where a face-down card's pile is focused and nothing is picked up.
    - **Stop condition:** if the hard-coded `movable: true` turns out to be observable behaviour, stop and surface it.
    - **Verify:** `rtk npx vitest run tests/unit/ui tests/component/boardKeyboard.test.tsx` and `rtk npx playwright test playByKeyboard --project=chromium` pass.

- [ ] 2.7 Sheet, settings and shortcut tidy-ups
    - **Implements:** D15 (sheets and shortcuts).
    - **Files:**
      - `src/ui/sheets/ModalSheet.tsx`: `returnFocusFallback` defaults to `onDismiss` (every sheet passes the same function today), and `data-testid="modal-backdrop"` (`:118`) is removed;
      - `SheetHost.tsx`: an exhaustive `Record<SheetId, …>`, and the stale comment goes;
      - `SettingsSheet.tsx`: the switch rows are built from one list;
      - `src/ui/board/useGameShortcuts.ts`: one pause guard, reusing the `pause()` thunk's refusal, and one auto-repeat check;
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/component/modalSheet.test.tsx` finds the backdrop through the dialog's parent, not a test id, and `spyOn(store.dispatch)` is replaced by an outcome assertion;
      - `tests/component/gameShortcuts.test.tsx` and every `tests/component/sheets/*.test.tsx` stay green.
    - **Verify:** `rtk npx vitest run tests/component` and the full `rtk npm run e2e` pass. `rg "data-testid" src` finds nothing.

- [ ] 2.8 Card-back swatches read the tokens
    - **Implements:** D15 (swatches). BR "Card backs" is unchanged.
    - **Files:** `src/ui/sheets/SettingsSheet.tsx:96-109` renders swatches from the card-back token custom properties (`tokens.css:62-69`) instead of hex literals.
    - **Tests:** `tests/component/sheets/settings.test.tsx` asserts that each swatch uses its `--card-back-*` token. `tests/unit/ui/tokens.test.ts` stays green.
    - **Verify:** `rtk npx vitest run tests/component/sheets tests/unit/ui/tokens.test.ts` passes.

- [ ] 2.9 `playDealCode` moves beside the other session thunks
    - **Implements:** D15 (session thunks). GS "Dealing from a deal code" is unchanged here.
    - **Files:**
      - `src/features/game/navigationThunks.ts:106-118` moves to `src/features/game/sessionThunks.ts`, and the callers are updated;
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/dealCode.test.ts` and `tests/component/sheets/dealCode.test.tsx` stay green.
    - **Verify:** `rtk npx vitest run tests/unit/features/game tests/component/sheets` passes.

- [ ] 2.10 Test hygiene
    - **Implements:** D15 (test hygiene).
    - **Files:**
      - `tests/unit/features/game/finishable.test.ts` asserts that the Finish availability value stays stable across ticks, instead of counting `finishPlan` calls;
      - `tests/unit/solver/winnable.test.ts` asserts the reported attempt order on `SOLVER_CORPUS` seeds, instead of wrapping `solve`;
      - `tests/component/board.test.tsx` asserts on the rendered positions, not on the call counts of `positions`;
      - `tests/unit/app/savePort.test.ts` is folded into `tests/unit/app/pwaThunks.test.ts`, which flushes through a real writer;
      - `tests/unit/support/testStore.test.ts` keeps only the non-trivial override merge;
      - one `tests/support/matchMedia.ts` fake, used by `tests/setup.ts:6-31` and `tests/component/appLifecycle.wiring.test.tsx:28-65`;
      - `tests/README.md` (test-double policy).
    - **Tests:** the listed suites, with the same behaviour covered. The only module mocks left are the justified ones in `hint.defensive.test.ts` and `pseudoLocale.test.tsx`.
    - **Verify:** `rtk npm run test:unit` passes, and `rg "vi.mock\(" tests` lists only the two justified files.

- [ ] 2.11 A `DealService` contract suite for the real service and the fake
    - **Implements:** D15 (contract suite).
    - **Files:**
      - new `tests/unit/features/deal/dealServiceContract.ts` (shared cases: deal per mode, cancellation by a newer deal, hint outcomes, dispose);
      - new `tests/unit/features/deal/dealService.contract.test.ts`, which runs it against the real service (stub worker from `tests/fixtures/workers.ts`) and against `fakeDealService` (`tests/fixtures/dealService.ts`);
      - remove `tests/unit/features/deal/fakeDealService.test.ts`;
      - `tests/README.md`.
    - **Tests:** the new contract suite. Every assertion from the removed file lives in it.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

- [ ] 2.12 Guard the features → app import direction
    - **Implements:** AS "The features layer depends on the app layer only through its slice, thunk type and store types".
    - **Files:**
      - `tests/unit/repo/layerBoundaries.test.ts` gains the features → app rule;
      - `eslint.config.js` gets the matching `no-restricted-imports` entry if the override structure allows it;
      - `docs/development/code-standards.md`, `docs/architecture/overview.md`.
    - **Tests:** the guard passes on today's code, and a fixture import of `app/store` or `app/lifecycle` from features is reported. Use the existing purity-scanner helper pattern.
    - **Verify:** `rtk npx vitest run tests/unit/repo` and `rtk npm run lint` pass.

## 3. Build identity and the card icon

- [ ] 3.1 Build number and UTC build time
    - **Implements:**
      - AS "Build identification" (KS-GEN-11);
      - SH "About sheet" (the build line);
      - HO "Home links, install offer and footer" (the stamp);
      - RF "Continuous integration on every push and pull request" and "Deployment to GitHub Pages from the default branch";
      - D13.
    - **Files:**
      - new `scripts/build-info.mjs` with `resolveBuildInfo(env, now)`, and its `.d.mts` stub;
      - `vite.config.ts`: `__APP_BUILD__` replaces `__APP_BUILD_TIMESTAMP__`;
      - `vitest.config.ts` (a fixed test define), `src/vite-env.d.ts`;
      - `src/ui/components/BuildStamp.tsx`, `src/ui/sheets/AboutSheet.tsx`;
      - the `build.*` keys in `src/i18n/locales/{en,uk}.ts`;
      - `.github/workflows/ci.yml` and `pages.yml` drop `BUILD_TIMESTAMP`. Before editing, check each action's latest release online and pin the exact versions, per AGENTS.md "GitHub Actions";
      - `docs/development/ci-and-deployment.md:94,141-160` (also drop its resolved TODOs);
      - `docs/development/getting-started.md:27-28`;
      - `src/ui/README.md`.
    - **Tests:**
      - new `tests/unit/repo/buildInfo.test.ts`:
        - a number plus the time gives `Build 57 · 2026-09-28 14:03 UTC`;
        - `GITHUB_RUN_NUMBER=""` or whitespace counts as absent and gives the development label;
        - the time is UTC whatever the time zone;
      - `tests/component/buildStamp.test.tsx` and `tests/component/sheets/about.test.tsx`: the stamp is never empty;
      - `tests/unit/repo/configContract.test.ts:33-41`:
        - the define exists;
        - no workflow sets `BUILD_TIMESTAMP` or uses `github.run_started_at`;
        - action versions are exact pins;
      - `tests/e2e/home.spec.ts:76`: the stamp matches `/^App build: (Build \d+|Development build) · \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/` or the catalog's equivalent.
    - **Verify:** `rtk npx vitest run tests/unit/repo tests/component/buildStamp.test.tsx tests/component/sheets/about.test.tsx` and `rtk npx playwright test home --project=chromium` pass. After `GITHUB_RUN_NUMBER=7 rtk npm run build`, the preview's Home footer shows "Build 7".

- [ ] 3.2 Card-fan pixel icon
    - **Implements:** PW "The app is installable"; D14.
    - **Files:**
      - `scripts/generate-icons.mjs` (one rectangle list, emitted to SVG and PNG) and `scripts/generate-icons.d.mts`;
      - `public/favicon.svg`;
      - `public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png`;
      - `docs/architecture/i18n-and-pwa.md`, `src/pwa/README.md`, `docs/reference/scripts.md`.
    - **Tests:** `tests/unit/repo/icons.test.ts`:
      - the committed PNGs **and** `favicon.svg` are byte-equal to a fresh render;
      - the sizes are right;
      - the maskable mark lies inside the central 80% circle on `#0b2545`;
      - the mark contains a light card-face region, not only background.

      `tests/unit/repo/manifest.test.ts` and `validateArtifact.test.ts` stay green.
    - **Verify:** `node scripts/generate-icons.mjs && rtk npx vitest run tests/unit/repo` passes. Inspect the PNGs at 180 and 512 px, and the SVG at 16 and 32 px in a browser tab, by eye; record the look in the task's commit message.

## 4. Domain edge cases

- [ ] 4.1 A game past its mode's pass limit is invalid
    - **Implements:** GE "A game state can be checked for validity" (the pass-limit clause). The grade clauses land in 8.2.
    - **Files:** `src/domain/validate.ts`, `src/domain/README.md`.
    - **Tests:**
      - `tests/unit/domain/validate.test.ts`: a Vegas game at pass 4 is invalid, pass 3 is valid, and a Draw 1 or Draw 3 game at pass 50 is valid;
      - `tests/unit/features/persistence/sessionCodec.test.ts`: a stored Vegas game at pass 4 is `invalid`.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/features/persistence` passes.

- [ ] 4.2 One talon-stepping rule and the reachable talon
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

- [ ] 4.3 The dead end follows the reachable talon
    - **Implements:** AST "Dead-end detection" and "One advice for a position" (KS-AST-06).
    - **Files:** `src/domain/deadEnd.ts` (uses `reachableTops`), `src/domain/README.md`, `docs/reference/game-rules.md`.
    - **Tests:**
      - `tests/unit/domain/deadEnd.test.ts` and `advise.test.ts`:
        - Draw 3: a playable card at an unreachable position is a dead end;
        - Vegas on its last pass;
        - Draw 1 cases unchanged.
      - The existing expectation that `vegasAtLimit({ passes: 2, waste: [H1, S9] })` is not a dead end becomes a dead end under the grouping rule. Change it with a comment that cites the AST scenario.
      - `tests/unit/features/interaction/deadEnd.test.ts` stays green.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/features/interaction` passes.

## 5. End-to-end edge cases (existing behaviour)

Any bug these specs expose goes through `superpowers:systematic-debugging`. Fix it in the same task when the fix stays inside the requirement the spec proves. Otherwise stop and surface it.

- [ ] 5.1 Corrupt storage and a failing save
    - **Implements:** RF "Edge cases are proven end to end", scenarios "A corrupt record starts with defaults" and "A failing save keeps the game playable"; PE "Unreadable data is never lost" and "A failed save keeps the game playable" (KS-PER-03, KS-PER-04).
    - **Files:**
      - new `tests/e2e/storage.spec.ts`;
      - `tests/e2e/support/seed.ts` gains `seedRaw(page, value)`, and a quota stub through `addInitScript` that makes `setItem` throw `QuotaExceededError`.
    - **Tests:**
      - a malformed record gives the defaults, the storage notice, and the backup key holding the original verbatim, and a deal plays;
      - with a failing save, the write notice appears and moves still apply.
    - **Verify:** `rtk npx playwright test storage --project=chromium --project=webkit` passes.

- [ ] 5.2 Reload during a drag and during Finish
    - **Implements:** RF "Edge cases are proven end to end" ("Reload in the middle of a drag", "Reload in the middle of Finish"); PE "Reopening restores the unfinished game exactly".
    - **Files:**
      - new `tests/e2e/resume.spec.ts`;
      - a nearly finished position in `tests/fixtures/boardPositions.ts`, or reuse of `nearlyWonState`.
    - **Tests:**
      - reload with the mouse held mid-drag: the resumed board equals the last committed position;
      - reload after starting Finish: the resumed position is valid and consistent, and Finish or a win can still complete.
    - **Verify:** `rtk npx playwright test resume --project=chromium --project=iphone-17-pro` passes.

- [ ] 5.3 Vegas pass limit and the Draw 3 recycle penalty
    - **Implements:** RF "Edge cases are proven end to end" (the Vegas and Draw 3 pass scenarios); KS-MOVE-05, KS-SCO-02. The stock is never dragged, so the cases run by tap and by keyboard.
    - **Files:**
      - new `tests/e2e/talonRules.spec.ts`;
      - Vegas and Draw 3 talon-only positions in `tests/fixtures/boardPositions.ts`.
    - **Tests:**
      - Vegas: after the third pass the stock shows the no-redeal state, and a tap or Enter on it changes nothing and raises the notice;
      - Draw 3: the score drops by 20 on the fourth pass's recycle and not before, by tap and by keyboard.
    - **Verify:** `rtk npx playwright test talonRules --project=chromium --project=firefox` passes.

- [ ] 5.4 A storm of 200+ undos and redos, and rapid double taps
    - **Implements:** RF "Edge cases are proven end to end" ("Undo storm survives a reload", "A double tap never applies two moves"); GS "Undo history has no in-memory limit"; PE stored-history limits.
    - **Files:** new `tests/e2e/history.spec.ts`, and `tests/e2e/support/play.ts` (a helper to play N commands of the recorded line).
    - **Tests:**
      - play at least 405 moves (draws and recycles count), undo 205 of them, then reload: exactly 200 undo steps and 200 redo steps are restored, and both sides still work;
      - five rapid taps on the same card apply at most one move each double-tap window.
    - **Verify:** `rtk npx playwright test history --project=chromium --project=galaxy-s25` passes.

- [ ] 5.5 Resize during the deal
    - **Implements:** RF "Edge cases are proven end to end" ("Resize during the deal"); GM and board-motion re-layout (KS-GEN-08).
    - **Files:** `tests/e2e/resize.spec.ts` (new case).
    - **Tests:** change the viewport twice mid-deal. Every card ends at its computed final position, the game state is unchanged, and no page scroll appears.
    - **Verify:** `rtk npx playwright test resize --project=chromium` passes.

- [ ] 5.6 Daily rollover at 00:00 UTC
    - **Implements:** RF "Edge cases are proven end to end" ("Daily rollover at midnight UTC", "A missed date ends the daily streak"); DS "Daily deal v1"; KS-DEAL-07, KS-STA-04.
    - **Files:** new `tests/e2e/daily.spec.ts`, which uses `page.clock` on golden dates from `tests/fixtures/dailyGolden.ts`.
    - **Tests:**
      - at 23:59:59 UTC the Daily tile and deal code are the golden date's; after 00:00 UTC they are the next date's;
      - a streak that ended on the previous date is still shown just after the rollover;
      - a seeded completed-dates record with a gap shows the streak reset.
    - **Verify:** `rtk npx playwright test daily --project=chromium --project=webkit` passes.

- [ ] 5.7 Night cards in the accessibility scan
    - **Implements:** RF "Accessibility scan" ("Night cards keep their contrast"); AP "Night cards change the cards only".
    - **Files:** `tests/e2e/a11y.spec.ts` gains a pass in the dark theme with night cards over Home, Game and every sheet.
    - **Tests:** axe finds no violations, colour contrast included.
    - **Verify:** `rtk npx playwright test a11y --project=chromium` passes.

## 6. Ordered-talon search (Draw 3 and Vegas)

- [ ] 6.1 Winning lines with explicit draw steps
    - **Implements:** D3S "Winning lines replay as player commands, draws included".
    - **Files:** `src/solver/line.ts` gains a `{ t: 'd' }` step that expands to `{ type: 'draw' }` (a recycle on an empty stock). `src/solver/README.md`.
    - **Tests:** `tests/unit/solver/line.test.ts`:
      - a hand-built Draw 3 line and a Vegas line with a recycle replay through `applyCommand` to the expected position;
      - Draw 1 cases unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/repo/solverPurity.test.ts` passes.

- [ ] 6.2 The ordered-talon search
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

- [ ] 6.3 Exhaustive cross-check on small positions
    - **Implements:** D3S "Verdicts agree with exhaustive search on small positions"; D5.
    - **Files:**
      - new `tests/support/bruteForce.ts`: exhaustive search over `applyCommand` with no pruning, deduplicating on `positionKey` plus, in Vegas, the passes left;
      - new `tests/fixtures/endgames.ts`: seeded Draw 3 and Vegas endgames with at most 14 cards off the foundations, including one where the loose safe rule would lose the win, one Vegas case that is lost only because of the pass limit, one part-way-through-a-pass talon case, and one that needs a column-emptying run;
      - new `tests/unit/solver/ordered.crossCheck.test.ts`;
      - `tests/README.md`.
    - **Tests:** for every endgame, `solveOrdered` gives `win` exactly when brute force finds a win, and `loss` exactly when it finds none. `unknown` never occurs at the test budget.
    - **Verify:** `rtk npx vitest run tests/unit/solver` passes, and the suite takes under 10 s locally.

- [ ] 6.4 One search entry for every mode
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

- [ ] 6.5 Per-mode budgets from the benchmark
    - **Implements:** DS "Deals per mode record their provenance" (the budget column); RF "Informational solver benchmark outside the validation gate".
    - **Files:**
      - new `src/features/deal/budgets.ts`: `WINNABLE_BUDGET` for Draw 1 moves there unchanged from `dealService.ts:18-22`, alongside `MAX_ATTEMPTS`, `HINT_BUDGET` and the Draw 3 and Vegas budgets;
      - `tests/bench/winnable.bench.ts` (per mode: verdict distribution, median and p95 per selection; for Draw 1 also with difficulty Hard);
      - `tests/README.md` (the recorded results with date, machine and Node version);
      - `specs/features/deal-service/spec.md` of this change, if the benchmark moves the Draw 3 or Vegas value away from 20,000;
      - `src/features/README.md`.
    - **Stop condition:** if cold Draw 3 or Vegas selection misses 1 s at the median or 3 s at p95 on the desktop benchmark at any budget that still proves most deals, stop and surface it (design Risks).
    - **Verify:** `rtk npm run bench` prints all three modes, and `rtk npx vitest run tests/unit/features/deal` passes.

## 7. Deal grading

- [ ] 7.1 Hint candidates in priority order
    - **Implements:** AST "Hint candidates in priority order"; D6.
    - **Files:** `src/domain/hint.ts` (`hintCandidates`; `findMove` becomes its first element), `src/domain/README.md`.
    - **Tests:** `tests/unit/domain/hint.test.ts`:
      - `findMove` equals `hintCandidates()[0]` over every fixture position;
      - every candidate is legal under `applyCommand`;
      - order is priority, then canonical source, then target;
      - permuting face-down tableau cards among themselves, and the stock order, leaves the candidates unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/domain` passes.

- [ ] 7.2 Seeded playouts and grading
    - **Implements:** GRD "Seeded playouts that see only face-up cards" and "Grading v1 turns playout wins into a grade" (mechanism, with the initial table); D6.
    - **Files:** new `src/solver/grading.ts` (`GRADING_V1`, `playout`, `gradeDeal`), `src/solver/README.md`.
    - **Tests:** new `tests/unit/solver/grading.test.ts`:
      - the same seed gives the same grade and win count;
      - hidden-card permutations do not steer choices before a reveal;
      - the player draws when it has nothing to play;
      - a stall ends a playout;
      - the Vegas pass limit is respected;
      - every playout ends within the step cap;
      - a `random` deal is never graded;
      - a Daily deal grades like its Draw 1 twin.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/repo/solverPurity.test.ts` passes, and `rg "Math.random" src/solver src/domain` finds nothing.

- [ ] 7.3 Calibrate and pin grading v1
    - **Implements:** GRD "Grading v1 turns playout wins into a grade" ("Every grade is common enough", "Pinned grades do not drift").
    - **Files:**
      - new `tests/bench/grading.bench.ts` (per mode: grade shares over a pinned calibration sample of verified seeds, and grading cost);
      - `src/solver/grading.ts` (the calibrated table, and N if cost requires it, down to 8);
      - new `tests/fixtures/gradingGolden.ts`;
      - `specs/solver/deal-grading/spec.md` of this change (table and N, when they change);
      - `tests/README.md` (distribution and cost).
    - **Tests:** new `tests/unit/solver/gradingGolden.test.ts` pins about 10 seeds per mode with their grade and win count. It also asserts each grade's share on the calibration sample, which is small enough to run in `test:unit`, is at least 15%.
    - **Stop condition:** if no table reaches 15% per grade in a mode after tuning the policy weights, stop and surface it.
    - **Verify:** `rtk npm run bench` shows the shares, and `rtk npx vitest run tests/unit/solver` passes.

- [ ] 7.4 Selection with a target grade
    - **Implements:** GRD "A requested grade, or the closest one found"; SEL "Winnable selection by reject sampling" (grade) and "Background-thread message interface" (the target and grade fields); D7.
    - **Files:**
      - `src/solver/winnable.ts`, `src/solver/protocol.ts`, `src/features/deal/solverClient.ts` (the target and the returned grade);
      - `tests/fixtures/dailyGolden.ts` gains a grade column, leaving seeds and attempts untouched;
      - `src/solver/README.md`.
    - **Tests:**
      - `tests/unit/solver/winnable.test.ts`:
        - `any` equals today's selection on `SOLVER_CORPUS` seeds;
        - the exact-match position;
        - the closest grade, with the earlier seed on a tie;
        - nothing proven gives `random` with no grade and attempts equal to the list length;
      - `protocol.test.ts`, `solverClient.test.ts`;
      - `tests/unit/features/deal/daily.test.ts` also checks the pinned grades.
    - **Verify:** `rtk npx vitest run tests/unit/solver tests/unit/features/deal` passes.

## 8. Deal provenance and the storage record v2

- [ ] 8.1 Record v2 with a lossless v1 upgrade, and the Difficulty setting
    - **Implements:**
      - PR "Settings and their defaults" (Difficulty);
      - PE "One versioned record holds what the device keeps", "Stored data is decoded defensively" and "An older record is upgraded without loss" (preferences part; KS-PER-06);
      - RF "Edge cases are proven end to end" ("A version 1 record is upgraded");
      - D10.
    - **Files:**
      - `src/features/preferences/preferencesSlice.ts` (`difficulty: 'any' | 'easy' | 'medium' | 'hard'`, default `any`);
      - `src/features/persistence/recordCodec.ts` (versioned key lists, dispatch on version, `upgradeV1`, `RECORD_VERSION = 2`);
      - `src/features/persistence/sessionCodec.ts` (takes the record version; the game keys are still the same in v1 and v2 until 8.2);
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

- [ ] 8.2 The grade as game provenance, in the domain and the session record together
    - **Implements:**
      - DG "A deal records its provenance";
      - GE "A game state can be checked for validity" (the grade clauses);
      - PE "An older record is upgraded without loss" (games get no grade);
      - GS "Restart replays the same deal" and "Dealing from a deal code";
      - D9.

      This must land in one task: a separate `GameState` field would break stored games.
    - **Files:**
      - `src/domain/types.ts` (`difficulty`), `src/domain/deal.ts` (`dealFromSeed` provenance), `src/domain/validate.ts`;
      - `src/features/persistence/sessionCodec.ts` (the v2 game keys gain `difficulty`; `upgradeV1` sets `null` on the current game and every step);
      - `src/features/game/sessionThunks.ts` (restart keeps the grade; `playDealCode` gives `null`);
      - `tests/fixtures/states.ts`, `tests/fixtures/deals.ts` (fixtures gain `difficulty: null`);
      - `tests/e2e/support/seed.ts`;
      - `docs/reference/storage-format.md`, `src/domain/README.md`.
    - **Tests:**
      - `tests/unit/domain/{deal,validate}.test.ts`: a grade with verdict `random` is invalid, and an unknown grade is invalid;
      - `sessionCodec.test.ts` and `recordCodec.test.ts`: a pinned v1 record **holding a game with undo and redo steps** decodes, and every game upgrades to `null` before the validity check runs (D10), so it is never rejected;
      - `tests/unit/features/game/{startRestart,dealCode}.test.ts`.
    - **Verify:** `rtk npm run test:unit` and `rtk npx playwright test board storage --project=chromium` pass.

## 9. Deal service: every mode, a target grade, instant deals

- [ ] 9.1 Verified deals in every mode with a requested grade
    - **Implements:**
      - DS "Deals per mode record their provenance", "Daily deal v1" (the grade), "The search never runs on the input thread" and "Dealing progress and overlay timing";
      - GS "Starting a game installs a fresh deal" and "Settings never change a game in progress";
      - HO "Home actions" (Deal cards honours the switch and Difficulty).
    - **Files:**
      - `src/features/deal/dealService.ts`: `DealRequest` gains `difficulty`; Draw 1, Draw 3 and Vegas go to the worker when the switch is on; fallbacks for every mode; Daily is graded;
      - `src/features/game/sessionThunks.ts` (`startGame` reads `difficulty` when the start begins);
      - `tests/fixtures/dealService.ts` (the fake honours the new request);
      - `src/features/README.md`, `docs/architecture/data-flows.md`.
    - **Tests:**
      - `tests/unit/features/deal/dealService.deal.test.ts`:
        - winnable Draw 3 and Vegas deals;
        - a requested grade that is not found;
        - the switch off deals once;
        - worker failure per mode;
      - the contract suite;
      - `tests/unit/features/game/startRestart.test.ts`: the difficulty is read at start, and changing it afterwards leaves the game alone.
    - **Verify:** `rtk npx vitest run tests/unit/features` passes.

- [ ] 9.2 Solver hints in every mode
    - **Implements:** DS "Hints use the solver with a heuristic fallback"; IN "Hints come from the solver line or the heuristic"; D12.
    - **Files:** `src/features/deal/dealService.ts:199` (remove the gate), `src/features/README.md`.
    - **Tests:**
      - `tests/unit/features/deal/dealService.hint.test.ts`: a Draw 3 hint from the solver; a slow Vegas hint falls back; "Draw 3 and Vegas use the heuristic only" now means no proof;
      - `tests/unit/features/interaction/hint.test.ts`.
    - **Verify:** `rtk npx vitest run tests/unit/features` passes.

- [ ] 9.3 The deal pool
    - **Implements:** DS "Instant deals from a pre-verified pool" (the pool's own behaviour); D8.
    - **Files:** new `src/features/deal/dealPool.ts` (a FIFO per `mode:difficulty`, at most 2, fill one at a time, pause and resume, error drops only the fill in flight, dispose), `src/features/README.md`.
    - **Tests:** new `tests/unit/features/deal/dealPool.test.ts`, with a stub worker, fake timers and an injected seed source:
      - the selected key fills first;
      - oldest first, and each deal is taken once;
      - it refills after use;
      - pause stops new fills but keeps the fill in flight;
      - a failure empties nothing already pooled, and the next fill starts a new worker;
      - no pool for Daily or with the switch off;
      - dispose.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

- [ ] 9.4 The deal service serves from the pool
    - **Implements:** DS "Instant deals from a pre-verified pool" (delivery, timing) and "A newer request wins" (the pool is never cancelled); KS-PERF-02 (warm deals).
    - **Files:**
      - `src/features/deal/dealService.ts` (a second `SolverClient` for the pool, `prefetch(choice)`, `pause()`, delivery from the pool with no progress reports);
      - `src/app/thunkExtra.ts` (the `DealService` type);
      - `tests/fixtures/dealService.ts` (the fake gains `prefetch` and `pause`);
      - `src/features/README.md`.
    - **Tests:**
      - new `tests/unit/features/deal/dealService.pool.test.ts`:
        - a matching request is served at once with no overlay report;
        - a request the pool cannot serve is searched as usual;
        - a player deal pauses filling without cancelling it;
        - a newer deal never cancels the pool;
        - a pooled deal carries its recorded verdict, attempts and grade;
        - a player's hint never waits behind a pool fill (DS "A newer request wins", scenario "A player's hint never waits behind the pool");
        - the player and pool threads answer the same selection request alike (SEL "Background-thread message interface", scenario "Two threads answer alike");
      - the contract suite.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal tests/unit/app` passes.

- [ ] 9.5 The pool follows the player's choice
    - **Implements:** DS "The pool follows the player's choice" and "Instant deals from a pre-verified pool" (a hidden page pauses); D8.
    - **Files:**
      - new `src/app/dealPoolController.ts` (subscribes to `selectedMode`, `winnableOnly`, `difficulty` and document visibility; starts after the first idle period through an injected scheduler);
      - `src/app/lifecycle.tsx` starts and stops it;
      - `docs/architecture/data-flows.md` (the pool sequence, in mermaid);
      - `docs/architecture/state-and-persistence.md`.
    - **Tests:**
      - new `tests/unit/app/dealPoolController.test.ts`:
        - changing the mode or the difficulty moves the filling;
        - returning to a kept choice finds its deals;
        - Daily or the switch off stops filling;
        - hidden pauses and visible resumes;
        - nothing starts before the idle signal;
      - `tests/component/appLifecycle.wiring.test.tsx` (injected gateway): the controller starts and is disposed.
    - **Verify:** `rtk npx vitest run tests/unit/app tests/component/appLifecycle.wiring.test.tsx` and `rtk npm run validate:lifecycle-storage` pass.

## 10. Difficulty and all-mode UI

- [ ] 10.1 The Winnable card in every mode, with the Difficulty control
    - **Implements:** HO "Winnable deals only switch" (KS-DEAL-03, KS-DEAL-11); D11.
    - **Files:**
      - `src/ui/components/Segmented.tsx` (`disabled`, the radio group semantics if they are not there yet, and a coarse-pointer target of at least 44×44 px);
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

- [ ] 10.2 The deal chip shows the grade
    - **Implements:** GM "Mode and deal chips" (KS-DEAL-06, KS-DEAL-11).
    - **Files:** `src/ui/components/DealChip.tsx`, `src/ui/styles/layout.css` (only if the fit needs it), the catalogs (`game.chip.deal.*`), `src/ui/README.md`.
    - **Tests:** `tests/component/chips.test.tsx`:
      - "Winnable · Medium";
      - the shuffle count lives in the accessible description and tooltip, not the visible text;
      - "Random deal";
      - the icon-only chip keeps the full text as its name.
    - **Verify:** `rtk npx vitest run tests/component/chips.test.tsx` and `rtk npx playwright test --project=device-fit` pass.

- [ ] 10.3 The Win sheet shows the grade
    - **Implements:** SH "Win sheet"; IN "Win summary".
    - **Files:**
      - `src/features/interaction/interactionSlice.ts:12-19` (`WinSummary.difficulty`);
      - the win-summary builder in `src/features/game/gameThunks.ts`;
      - `src/ui/sheets/WinSheet.tsx`. The title uses the pixel typeface, as the SH requirement states; today it uses the body typeface;
      - the catalogs.
    - **Tests:**
      - `tests/unit/features/interaction/winSummary.test.ts` (the grade, or none);
      - `tests/component/sheets/win.test.tsx` ("Hard deal" is shown; nothing for an ungraded game; the title is in the pixel typeface class).
    - **Verify:** `rtk npx vitest run tests/unit/features/interaction tests/component/sheets` passes.

- [ ] 10.4 How to play explains Winnable deals and the grades
    - **Implements:** SH "How to play sheet".
    - **Files:** `src/ui/sheets/HelpSheet.tsx`, the catalogs.
    - **Tests:** `tests/component/sheets/help.test.tsx` shows the passage and the three grade names, in both languages.
    - **Verify:** `rtk npx vitest run tests/component/sheets` and `rtk npx playwright test a11y --project=chromium` pass.

## 11. Proof: full-game wins, traceability and the verification sweep

- [ ] 11.1 Winning-line fixtures for Draw 3, Vegas and Daily
    - **Implements:** RF "Input is proven end to end" (fixtures); D16.
    - **Files:**
      - `tests/fixtures/deals.ts`: new `DRAW3_LINE`, `VEGAS_LINE` and `DAILY_LINE`. Each is the shortest line among the first winnable seeds that has no foundation → column move. Daily uses a golden date's seed;
      - new `tests/unit/fixtures/winningLines.test.ts`;
      - `tests/README.md` (the generation recipe).
    - **Tests:** every line, including `WINNING_LINE`, replays through `applyCommand` to a won state, with the recorded moves, score and passes, without the solver.
    - **Verify:** `rtk npx vitest run tests/unit/fixtures` passes.

- [ ] 11.2 Full-game wins in every mode through real input
    - **Implements:** RF "Input is proven end to end".
    - **Files:**
      - new `tests/e2e/playModes.spec.ts`:
        - Draw 3 by keyboard;
        - Vegas by drag;
        - Daily by tap, started from Home under `page.clock` on the golden date so that the real worker selects the seed;
      - `tests/e2e/playBy{Tap,Drag,Keyboard}.spec.ts` stop skipping Firefox, WebKit and one touch project where the input exists;
      - `tests/e2e/support/{play,seed}.ts` (the line parameter, and `d` steps as stock taps or the draw key);
      - `tests/unit/e2e-support/lineGestures.test.ts`.
    - **Tests:** the Win sheet appears with the expected moves and score in each mode. Animations are off in these specs.
    - **Verify:** `rtk npx playwright test playModes playByTap playByDrag playByKeyboard --project=chromium --project=firefox --project=webkit --project=iphone-17-pro` passes.

- [ ] 11.3 Traceability generator and guard, in report mode
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
      - running the generator twice changes nothing, and Prettier leaves its output unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/repo` passes, and `rtk npm run trace` followed by `rtk npm run format:check` reports no change.

- [ ] 11.4 Annotate the deal, move, scoring and assistance tests
    - **Implements:** RF "Requirement traceability is generated and checked" (coverage). KS-DEAL, KS-MOVE, KS-SCO, KS-AST.
    - **Files:** `// covers:` comments only, in `tests/unit/{domain,solver,features/deal,features/game,features/interaction}/**`, the matching `tests/e2e/*.spec.ts`, and the regenerated `docs/reference/traceability.md`.
    - **Tests:** no assertion changes. A comment is added only where the test really proves that id.
    - **Verify:** `rtk npm run trace` shows no uncovered KS-DEAL, KS-MOVE, KS-SCO or KS-AST id, or lists the gaps for 11.7. `rtk npx vitest run tests/unit/repo` passes.

- [ ] 11.5 Annotate the input, accessibility, general and settings tests
    - **Implements:** RF traceability (coverage). KS-INP, KS-A11Y, KS-GEN, KS-SET.
    - **Files:** `// covers:` comments in `tests/component/**`, `tests/unit/ui/**`, `tests/e2e/**` and `tests/unit/features/preferences/**`, plus the regenerated matrix.
    - **Verify:** as 11.4, for these prefixes.

- [ ] 11.6 Annotate the persistence, PWA, i18n, statistics and performance tests, and list the manual checks
    - **Implements:** RF traceability (coverage); RF "Performance and installability are checked manually and recorded" (the list).
    - **Files:**
      - `// covers:` comments in `tests/unit/{features/persistence,features/stats,pwa,i18n,app}/**` and the matching e2e specs;
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
    - **Tests:** the guard fails when a fixture matrix has an uncovered main-spec id. The new ids KS-DEAL-11, KS-DEAL-12, KS-PER-06 and KS-GEN-11 are enforced once 14.4 syncs them into the main specs.
    - **Verify:** `rtk npm run validate` passes.

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
        - for information, Draw 1 with difficulty Hard, and Draw 1 while a pre-verification is in flight;
        - the pool worker must not be mistaken for the player worker (identify workers by creation order and request type);
      - `tests/e2e/pwa.spec.ts` if its `waitForEvent('worker')` assumptions change;
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
      - `AGENTS.md`:
        - "Source of truth": code, configuration, tests and CI, then `openspec/specs`, then `docs/`;
        - the repository layout;
        - principle 10: look and feel is fixed and reviewed against the committed screenshots;
        - every `phased-design.md §n` and spec-pack reference;
        - the Speckit note;
      - `openspec/config.yaml`: `context`, and `rules` (the KS rule points at KS ids in `openspec/specs`, and the proposal rule no longer cites the phase plan);
      - `README.md:59`, `docs/README.md:49-55`, `docs/development/workflow.md:34`, `docs/development/project-structure.md:11`, `docs/architecture/overview.md:69`, `docs/reference/game-rules.md:3-4`;
      - new `tests/unit/repo/noSpecPack.test.ts`:
        - it scans tracked files;
        - it exempts `openspec/changes/**`, revision-pinned references and its own source;
        - `openspec/specs/**` stays exempt until 14.4;
        - it fails if the folder exists.
    - **Tests:** the new guard. A fixture file with an `R§` citation fails, and a revision-pinned citation passes.
    - **Before adding the guard:** run a repo-wide `rg -n "docs/spec|klondike-mockup|R§|phased-design|research\.md|specification\.md" --glob '!openspec/changes/**' --glob '!openspec/specs/**'` and fix every hit, including docs written earlier in this change.
    - **Verify:** `rtk npm run validate` passes, and `test -d docs/spec` fails.

- [ ] 13.4 Format the maintained docs
    - **Implements:** RF "Deterministic source formatting" ("Maintained docs are checked").
    - **Files:** `.prettierignore` (stop excluding `docs/`; keep `openspec/`, the lockfile and build output excluded), `docs/**/*.md` (formatted), `tests/unit/repo/configContract.test.ts` if it pins the ignore list.
    - **Verify:** `rtk npm run format:check` passes with `docs/` included.

- [ ] 13.5 Architecture docs and module READMEs match the code, and a docs-link test
    - **Implements:** RF "Maintained documentation links resolve"; constitution 9.
    - **Files:**
      - `docs/architecture/{overview,domain-and-solver,state-and-persistence,ui,i18n-and-pwa,data-flows}.md`, with cited paths and symbols checked, and mermaid diagrams for the layers, the deal pool and the storage upgrade;
      - `src/{domain,solver,features,i18n,pwa,ui}/README.md`;
      - new `tests/unit/repo/docsLinks.test.ts`: relative Markdown links, and inline-code paths starting with `src/`, `tests/`, `docs/`, `scripts/`, `public/`, `openspec/` or `.github/` (including `path#symbol`), resolve in the README, the changelog, `docs/**`, the module READMEs and `AGENTS.md`. Globs, brace lists, `<placeholders>`, generated folders (`dist/`, `coverage/`, `playwright-report/`, `test-results/`) and `https://` links are skipped.
    - **Tests:** the new docs-link test. A fixture doc with a broken link fails.
    - **Verify:** `rtk npx vitest run tests/unit/repo` passes.

- [ ] 13.6 Development and reference docs, the docs index and the tests README match the code
    - **Implements:** constitution 9 (docs are part of the change).
    - **Files:**
      - `docs/README.md` (the index and reading order, with no spec-pack section);
      - `docs/development/{getting-started,project-structure,workflow,code-standards,testing,ci-and-deployment}.md`;
      - `docs/reference/{scripts,keyboard-and-controls,game-rules,storage-format}.md`;
      - `tests/README.md`.
    - **Verify:** the docs-link test and `rtk npm run format:check` pass. Every npm script in `package.json` appears in `docs/reference/scripts.md`, checked by `configContract.test.ts` if such a check exists; otherwise add one.

- [ ] 13.7 README
    - **Implements:** RF "Committed reference screenshots are the look-and-feel reference" (the README uses them); Phase 10 README.
    - **Files:** `README.md`: what the game is, the features (modes, winnable and graded deals, instant deals, offline and install, languages, accessibility), the screenshots from `docs/assets/screenshots/`, the Pages link, the commands and the docs map.
    - **Verify:** the docs-link test passes, and the README renders with every image resolving.

- [ ] 13.8 Version 1.0.0, the changelog and the release procedure
    - **Implements:** RF "Releases are versioned and recorded"; D20.
    - **Files:**
      - `package.json` and `package-lock.json` (the root version 1.0.0);
      - new `CHANGELOG.md` (1.0.0 with date and highlights of Phases 1–11, describing the retired pack in words, not by path);
      - new `docs/development/release.md`;
      - `docs/development/ci-and-deployment.md`, `AGENTS.md` ("Git and review" points to the procedure).
    - **Tests:** `tests/component/sheets/about.test.tsx` shows version 1.0.0 through the define, and `configContract.test.ts` checks that the version is valid semver.
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
      - no test mocks our own modules beyond the two justified ones.
    - **Verify:** no open Blocking or Important findings, and every fix is committed after `rtk npm run validate`.

- [ ] 14.4 Archive readiness: sync the specs, the editorial pass, and a strict guard
    - **Implements:** RF "No references to the retired spec pack" (main specs included); D18 (the editorial pass).
    - **Steps:**
      1. Run `openspec validate finalize-v1-release --strict`, then `openspec sync` (the `openspec-sync-specs` skill).
      2. Edit `openspec/specs/**` directly, for non-normative citations only. That means `spec §n`, `R§n` and "from the mockup" footnotes. It also means the `## Purpose` lines of `ui/home-screen`, `ui/board-assist` and `features/preferences`, and the "phased-design" mention in `features/interaction`. Keep every KS id.
      3. Remove the `openspec/specs/**` exemption from `tests/unit/repo/noSpecPack.test.ts`.
      4. Regenerate the traceability matrix.
    - **Verify:**
      - `rtk npm run validate` passes;
      - `rg -n "R§|spec §|specification §|docs/spec|phased-design" openspec/specs` finds only revision-pinned references;
      - the two new capabilities (`solver/draw3-solver`, `solver/deal-grading`) and the edited Purposes are in the main specs;
      - after archive, merging to `feature/app-v1-release`, the PR to `master`, the `v1.0.0` tag and removing the stale remote branches happen only when the author asks (D1, D20).
