# Proposal

## Why

Phases 1–8 are merged to `master`, and the game is live on GitHub Pages. Three phases of
`docs/spec/phased-design.md` §7 are left: **Phase 9 (full verification and edge cases)**, **Phase 11
(Draw 3 and Vegas winnable deals, instant deals)** and **Phase 10 (documentation and release)**. At the
author's request, this change carries all three **as one change, the final feature drop before v1.0.0**.
It deliberately waives the config rule of one phase slice per proposal, as `add-screens-sheets-pwa`
did. The groups follow the order the author asked for:
1. set-up and quality;
2. edge cases;
3. solver, grading and instant deals;
4. all-mode proof and traceability;
5. visual review, docs and release.

What is wrong or missing today:
- **The build stamp is empty on Pages.** Both workflows set `BUILD_TIMESTAMP: ${{ github.run_started_at }}`.
  That is not a property of the `github` context, so it evaluates to `""`, and `vite.config.ts`
  (`?? 'dev version'`) keeps the empty string. The live bundle renders "App build:" with nothing after
  it, and no build number exists at all.
- **Only Draw 1 deals can be proven winnable.** The solver models the stock and waste as an unordered
  set, which only holds for Draw 1 with unlimited passes. Draw 3 and Vegas are always dealt at random, and
  Home says so.
- **A winnable deal can take a noticeable moment.** Every winnable deal is searched when it is
  requested, and there is no way to ask for an easier or harder deal.
- **Phase 9's edge cases are mostly unproven in a browser.** The gaps:
  - full-game wins exist only for Draw 1;
  - reloading during a drag or a Finish;
  - the Vegas pass limit and the Draw 3 recycle penalty;
  - a storm of 200+ undos;
  - resizing during the deal;
  - night-card contrast;
  - the Daily rollover;
  - corrupt storage and a full quota.
- **Only 3 of the 84 `KS-*` requirements are referenced by any test.**
- **Two domain edge bugs.**
  - Validation accepts a Vegas game past its pass limit.
  - Dead-end detection treats every stock and waste card as reachable, which is wrong for Draw 3 and
    Vegas.
- **The quality audit found:**
  - coverage thresholds that never run;
  - duplicated thunk-dependency assembly;
  - production code kept alive only by tests;
  - duplicated constants and pile-equality helpers;
  - module mocks of our own code;
  - three `matchMedia` fakes;
  - a `.prettierignore` that skips every maintained doc.
- **The spec pack in `docs/spec` is now historical input.** The author wants OpenSpec to be the only
  specification, and `docs/spec`, including the mockup, removed once the look is confirmed.
- **The app icon has no card motif.** It is three small squares.

## What Changes

`design.md` (D1–D20) says how each item is built. This section says only what changes.

- **Stale agent instructions (tasks section 1).**
  - `AGENTS.md`, `docs/development/workflow.md` and `openspec/config.yaml` stop naming the merged
    `feature/app-v1-implementation` branch and the old phase status.
  - This change runs on `feature/finalize-v1-release`, cut from the new integration branch
    `feature/app-v1-release`, which reaches `master` by pull request.
- **Quality work with no behaviour change (tasks section 2).** Each item keeps the existing suites green
  and adds its own test:
  - coverage thresholds enforced by `validate`;
  - one thunk-dependency assembly;
  - dead selectors and actions removed;
  - one mode list, one Daily cap and one set of codec guards;
  - engine updates without casts;
  - one pile identity for the board;
  - the sheet, settings and shortcut tidy-ups, including no `data-testid` in production markup;
  - `playDealCode` moves beside the other session thunks;
  - test hygiene: no module mocks of our own code, one `matchMedia` fake;
  - a shared deal-service contract suite for the real service and the test fake;
  - an import guard for features → app;
  - the maintained docs are formatted and checked by `format:check` from the start of the change (the
    spec pack stays excluded until it is deleted).
- **Build identity.**
  - Home and About show the CI **build number** and the **UTC build date and time**, fixed when the app
    is built.
  - A local build shows a development label with its build time.
  - The workflows no longer pass the broken `BUILD_TIMESTAMP`.
- **App icon.** A pixel-art icon of staggered playing cards (a card back behind an ace of spades) on the
  navy background. It is used for the favicon, the install icons and the maskable icon.
- **Domain edge cases.**
  - A game past its mode's pass limit is invalid.
  - One talon-stepping rule is shared by the engine and the rest of the domain.
  - The dead end follows the cards that drawing can actually reach.
- **End-to-end edge cases.** New browser specs for:
  - corrupt storage and a full quota;
  - reload during a drag and during Finish;
  - the Vegas pass limit and the Draw 3 recycle penalty;
  - a storm of 200+ undos and redos;
  - rapid double taps;
  - resize during the deal;
  - the Daily UTC rollover under a mocked clock;
  - night cards in the accessibility scan.
- **Winnable deals in every mode (Phase 11).**
  - A new ordered-talon search proves Draw 3 and Vegas deals winnable. It models the ordered stock and
    waste, and the pass limit in Vegas.
  - Its winning lines replay as player commands.
  - Its verdicts are cross-checked against an exhaustive search on small positions.
  - The Draw 1 search is **unchanged**, so every published Daily deal and the pinned corpus stay the
    same.
  - "Winnable deals only" now applies to Draw 1, Draw 3 and Vegas. Solver hints work in every mode, with
    the heuristic fallback kept.
- **Difficulty (new).**
  - With "Winnable deals only" on, the player chooses **Any, Easy, Medium or Hard** on Home.
  - A proven deal is graded by how forgiving it is: a seeded, human-like player that sees only face-up cards
    walks the deal, and at checkpoints the solver says whether the position is still provably winnable.
    - a deal that stays winnable through much plausible play is Easy;
    - one that stays winnable for a while is Medium;
    - one that a few plausible moves ruin is Hard.
  - Grading is deterministic and versioned ("grading v1"), and its thresholds are calibrated per mode so
    that every grade holds at least 15% of the proven deals.
  - When the chosen grade isn't found within the attempt limit, the closest proven grade is dealt and
    labelled honestly.
  - The deal chip and the Win sheet show the grade. The Daily deal shows its grade, but it cannot be
    chosen.
  - Deals from a deal code carry no grade.
- **Instant deals (Phase 11).**
  - While the app is idle, a pool of proven, graded deals for the selected mode is filled on a separate,
    low-priority background thread. It also keeps the other proven deals that a search for a grade meets on the
    way (its spares).
  - A New deal served from the pool appears at once, with no overlay.
  - A small in-memory cache remembers the verdicts of seeds already searched, so a search that is cancelled
    and restarted, or the Daily list, is not searched twice.
  - The pool and the cache live in memory only. A player's deal or hint never waits behind the pool.
- **Storage record v2.**
  - Adds the `difficulty` preference (default Any) and the game's grade.
  - A v1 record is decoded whole and upgraded without loss. Nothing readable is dropped or copied to
    the backup key.
  - Versions above 2 are treated as a future version, as today.
- **Proof and verification (Phase 9).**
  - Full-game wins in every mode through real input, using winning lines the solver generated and a
    replay test that does not use the solver:
    - Draw 1 by tap, drag and keyboard;
    - Draw 3 by keyboard;
    - Vegas by drag;
    - Daily by tap.
  - A generated requirements-traceability matrix (`KS-*` → requirement → tests or manual check),
    checked by a guard test.
  - An informational drag-performance trace.
  - Deal latency for every mode, with and without the pool.
  - The device-fit matrix rerun on the production build, with a real-device checklist.
  - A flake sweep with every spec run three times.
- **Visual review and reference screenshots.**
  - Every screen is compared with the 17 mockup screens by eye, and the polish found is fixed. This
    includes the pixel-font minus sign in "−$52" and Cyrillic coverage.
  - Production screenshots are then committed as the look-and-feel reference, and the README uses
    them.
- **Retire the spec pack (Phase 10).**
  - **BREAKING (repository docs):** `docs/spec/**` is deleted, including the mockup.
  - Facts that still apply move to `docs/reference/` and `docs/architecture/`.
  - Requirements whose normative text depended on the mockup or the pack are rewritten to stand alone.
  - A guard test forbids references to the pack.
- **Documentation and release (Phase 10).**
  - Architecture, development and reference docs, module READMEs, the README (with screenshots) and
    `AGENTS.md` match the code.
  - A docs-link test.
  - Version 1.0.0, a `CHANGELOG.md` and a release procedure.
  - The pull request to `master`, the `v1.0.0` tag and removing the stale remote branches happen only
    when the author asks.

**Performance targets.**
- A really winnable deal matters more than a fast one. A deal searched on request shows the dealing overlay for
  as long as the search takes, in every mode, and its time is reported for information only. The earlier Draw 1
  target (300 ms median, 1.5 s at the 95th percentile) is dropped.
- A deal served from a warm pool appears within 100 ms in every mode.

**Not in this change:**
- a one-card Vegas mode;
- cumulative Vegas scoring;
- statistics per difficulty;
- a persisted deal pool or verdict cache;
- pixel-diff screenshot gates;
- any change to the Draw 1 search or the Daily v1 selection.

## Capabilities

### New Capabilities

- `solver/draw3-solver`: the bounded ordered-talon search for Draw 3 and Vegas, covering:
  - the verdict;
  - winning lines with explicit draws;
  - agreement with exhaustive search on small positions;
  - unsupported and won positions.
- `solver/deal-grading`: deterministic grading of a proven deal by how long seeded playouts that see only
  face-up cards keep it provably winnable, with the per-mode "grading v1" thresholds and choosing the requested
  or closest grade.

### Modified Capabilities

- `solver/deal-selection`: selection in every mode with a target grade and the delivered grade; solver
  hints in every mode; the stateless message interface carries the mode and the grade.
- `solver/draw1-solver`: the reference record is cited by git revision instead of the deleted mockup.
- `domain/move-rules`: the stock and waste cards that drawing can reach.
- `domain/assistance`: the dead end follows the reachable talon; the hint candidates are listed in
  priority order.
- `domain/game-engine`: validity covers the pass limit and the grade.
- `domain/deal-generation`: a deal records its provenance (verdict, attempts, grade).
- `domain/card-model`: the PRNG and shuffle requirements no longer cite the spec pack.
- `features/deal-service`:
  - verified deals in every mode with a requested grade;
  - Daily v1 unchanged but graded;
  - fallbacks in every mode;
  - hints in every mode;
  - the graded-spare pool, which a newer request never cancels;
  - the in-memory verdict cache.
- `features/preferences`: the Difficulty setting.
- `features/persistence`: record v2, version-aware decoding, and the lossless v1 upgrade.
- `features/game-session`: a start carries the difficulty; restart keeps the grade; a deal-code deal
  has no grade.
- `features/interaction`: hints in every mode; the win summary carries the grade.
- `app/application-shell`: build number and UTC build time; the features → app import boundary;
  Continue game without the mockup reference.
- `app/appearance`: night cards described without the mockup.
- `ui/home-screen`: the Winnable card in Draw 1, Draw 3 and Vegas with the Difficulty control; the
  mockup references are replaced by the stated look.
- `ui/game-screen`: the deal chip shows the grade; the chrome requirements stand alone.
- `ui/sheets`: the Win sheet shows the grade, About shows the build, How to play explains the grades,
  and Settings and Statistics stand alone.
- `ui/board-render`: "Card faces follow the mockup" is renamed "Card faces" and states the face design.
- `ui/board-keyboard`: the shortcuts stand alone.
- `ui/board-layout`: the column-compression requirement names the device matrix instead of a
  spec-pack section.
- `pwa/offline-install-update`: the card icon.
- `tooling/repository-foundation`:
  - coverage in the validation gate;
  - the build number in CI and Pages;
  - maintained docs formatted;
  - per-mode benchmark and grading report;
  - latency for every mode and the pool;
  - all-mode full-game wins;
  - night-card scan;
  - manual checks;
  - new requirements for edge cases, traceability, no spec-pack references and versioned releases.

## Impact

- **`src/domain`:**
  - new `talon.ts` (talon stepping and reachable tops);
  - `engine.ts` uses it;
  - `deadEnd.ts`, `validate.ts` and `hint.ts` (hint candidates) change;
  - `types.ts` and `deal.ts` gain the `grade` provenance field and one exported mode list.
  - The layer stays pure.
- **`src/solver`:**
  - new `ordered.ts` (ordered-talon search), `search.ts` (routes by mode) and `grading.ts` (playouts and
    "grading v1");
  - `line.ts` supports explicit draw steps;
  - `winnable.ts`, `hint.ts` and `protocol.ts` carry the mode and grade.
  - `solver.ts` (Draw 1) is unchanged.
- **`src/features`:**
  - `deal/` gains `budgets.ts`, `dealPool.ts` and `verdictCache.ts`; `dealService.ts` serves every mode, the grade and the
    pool; `solverClient.ts` is also used for a second, pool-only instance;
  - `persistence/` gains `guards.ts` and record v2 with the v1 upgrade;
  - `preferences/` gains `difficulty`;
  - `game/sessionThunks.ts` gains `playDealCode` and the difficulty;
  - `interaction/` puts the grade in the win summary;
  - dead selectors and actions are removed.
- **`src/app`:**
  - one thunk-dependency assembly in `thunkExtra.ts`, used by `store.ts` and `lifecycle.tsx`;
  - new `dealPoolController.ts`.
- **`src/i18n`:** new and changed keys in `locales/en.ts` and `uk.ts` (difficulty, grades, build,
  captions).
- **`src/pwa`:** unchanged code; only the icon assets change.
- **`src/ui`:**
  - `Segmented` gains `disabled`;
  - `WinnableToggle`, `DealChip`, `WinSheet`, `HelpSheet`, `AboutSheet`, `BuildStamp`, `SettingsSheet`,
    `ModalSheet`, `SheetHost` and `useGameShortcuts` change, as do the board keyboard modules (one pile
    identity);
  - CSS polish comes from the visual review.
- **`public/`:** new `favicon.svg` and `icons/*`. **`scripts/`:** new `build-info.mjs` and
  `trace-requirements.mjs`; `generate-icons.mjs` is rewritten.
- **Configuration:**
  - `vite.config.ts` and `vitest.config.ts` (build defines, coverage);
  - `package.json` (version 1.0.0, `validate` with coverage, trace script);
  - `.github/workflows/{ci,pages}.yml`;
  - `.prettierignore`.
- **`tests/*`:**
  - new unit suites (talon, ordered solver, brute-force cross-check, grading and its golden fixtures,
    pool, contract suite, build info, traceability, no-spec-pack guard, docs links);
  - new e2e specs (storage, resume, talon rules, history, Daily, all-mode wins, drag performance, opt-in
    screenshots);
  - `KS-*` coverage comments across the suites.
- **`docs/`:**
  - `docs/spec/**` is **deleted**;
  - new `docs/reference/{traceability,manual-checks,winnability,device-matrix}.md`,
    `docs/development/release.md` and `docs/assets/screenshots/`;
  - every other doc, the module READMEs, `README.md`, `CHANGELOG.md`, `AGENTS.md` and
    `openspec/config.yaml` are updated.
- **Storage:** record version 1 → **2**, with a lossless upgrade (design D10).
- **Constitution:**
  - **Principle 10** changes from "the mockup is visual reference only" to "the look and feel is fixed;
    visual changes are deliberate and reviewed against the committed reference screenshots".
  - The **source-of-truth order** becomes: code, configuration, tests and CI; then `openspec/specs`; then
    `docs/`. The `KS-*` ids are defined by the OpenSpec requirements that cite them.
  - **Principle 2 is extended:** the new search and grading are deterministic by seed, and grading
    randomness comes only from mulberry32.
  - **Principle 4 is unchanged**, including the pool: it is in memory and runs in the same bundled
    worker.
