# Proposal

## Why

Phase 2 delivered the complete Klondike rules in `src/domain`, but every Draw 1 deal is still an
unchecked shuffle, the Daily deal has no seed, and hints come only from the heuristic. Spec §1
principle (1), "Every Draw 1 deal can be won", together with *KS-DEAL-03…07*, *KS-DEAL-10* and
*KS-AST-03*, needs a solver that proves deals winnable and suggests moves without freezing input.
This change implements Phase 3 of `docs/spec/phased-design.md` §7: a bounded Draw 1 solver that
returns its winning line, run in a Web Worker behind a deal service. The Phase 4 state layer then
calls a finished service instead of a promise.

## What Changes

How each item is built is in `design.md` (D1–D11); this section states only what changes.

- **Solver (`src/solver`, pure):**
  - A port of the mockup's bounded Draw 1 search that returns a verdict (`win`, `loss` or
    `unknown`), a node count and, on a win, the winning line as ordinary player commands.
  - It reproduces the reference solver's verdicts on seeds 1–200 at 5,000 nodes (142 wins, 1 loss,
    57 unknown), pinned seed by seed.
- **Winnable selection and solver hints (`src/solver`, pure):**
  - Reject sampling over a supplied seed list: the first proven win, otherwise the last seed marked
    `random` (*KS-DEAL-05*). Each attempt is reported as it starts.
  - A solver hint taken from the first command of a winning line (*KS-AST-03*).
  - A worker message interface (`findWinnable`, `hint`, attempt progress) and its worker entry.
  - The `solve` worker message in `phased-design.md` §3.1 is **dropped**: nothing in v1 would call it.
- **Deal service (`src/features/deal`):**
  - Deal routing per mode:
    - Draw 1 with "Winnable deals only": up to 40 fresh seeds, 5,000 nodes each.
    - Daily: the UTC-date deal, always verified whatever the setting, 20,000 nodes, pinned as
      "daily v1".
    - Draw 3, Vegas, and Draw 1 with the switch off: one random deal, on the main thread.
  - Each dealt state records its provenance (`verdict`, `attempts`) for the deal chip.
  - Progress reports the attempt being tried and shows the overlay only after 160 ms
    (*KS-DEAL-04*).
  - A newer deal cancels every pending deal and hint, whichever route it takes; a newer hint
    replaces an older hint. Cancelled requests settle as cancelled and deliver nothing.
  - Hints use the solver for Draw 1 and Daily positions (3,000 nodes, 150 ms) and fall back to the
    domain heuristic otherwise.
  - If the worker fails, the deal is still made on the main thread: a random Draw 1 deal, or the
    first Daily v1 candidate, marked `random`.
- **Guards:** automated purity and import checks for `src/solver`; a lint rule that keeps solver
  code out of `src/features` except as types; `src/solver` and `src/features` leave the
  reserved-layer list.
- **Tooling:** in-process worker tests, an explicit ES-module worker build format, and an
  informational `npm run bench` latency benchmark kept outside `validate`.
- **Verification scope (user decision):**
  - Phase 3 is verified with Node unit and integration tests, keeping mocks to a minimum.
  - The 300 ms median of *KS-PERF-02* is a target that the benchmark reports, not a gate.
  - The real-browser worker round-trip and the Chromium latency measurement move to Phase 5, the
    first phase whose Playwright test deals a game. `phased-design.md` records this so it is not lost.
- **Specification-pack alignment:**
  - `phased-design.md`:
    - §3.1 and §4 Solver, Winnable selection and Hint rows: no `solve` message; the line is made of
      player commands; the Daily v1 formula.
    - §6: the worker format.
    - §7: Phase 3 and Phase 5 "done when", and the KS-PERF-02 note in Phase 9.
  - `research.md` §3.4: the Daily v1 formula on the UTC date.

**Not in this change:**
- The `app`, `game`, `preferences`, `stats` and `persistence` slices, and the `startGame` thunk that
  calls the deal service (Phase 4).
- The overlay, deal chip and hint display (Phases 6–7).
- Deal-code entry and Restart. They replay a seed without the solver (Phases 4 and 7).
- Draw 3 and Vegas winnable deals, and a background pool of pre-verified deals (Phase 11).
- Any solver-backed dead-end check.

## Capabilities

### New Capabilities

- `solver/draw1-solver`: bounded Draw 1 search, verdict and node count, reference-corpus
  compatibility, the winning line as player commands, and unsupported and won positions.
- `solver/deal-selection`: reject-sampling winnable selection over a seed list, the solver hint, and
  the worker message interface with attempt progress.
- `features/deal-service`: deals per mode with recorded provenance, the Daily deal v1, overlay
  timing and the attempt counter, request cancellation, search kept off the main thread with its
  fallbacks, and the hint with heuristic fallback.

### Modified Capabilities

- `app/application-shell`:
  - "Layers reserved for later phases carry no behaviour": the solver and features layers leave the
    reserved list; i18n and pwa stay.
  - New requirements isolate the solver layer and keep solver code out of the features layer.
- `tooling/repository-foundation`:
  - "Test suites separated by execution layer": in-process tests that need no DOM may opt into a
    Node environment, and worker entry modules run in-process and are measured by coverage.
  - A new requirement adds the informational benchmark outside the validation gate.

## Impact

- **`src/solver`:** new modules `solver`, `line`, `winnable`, `hint`, `protocol` and
  `solver.worker`, and a rewritten `README.md` that lists them.
- **`src/features`:** new `deal/daily.ts`, `deal/solverClient.ts` and `deal/dealService.ts`, and an
  updated `README.md`. No Redux slice yet.
- **`src/domain`, `src/app`, `src/i18n`, `src/pwa`, `src/ui`:** untouched. The deal service is not
  yet wired into the store or any screen.
- **`tests/`:**
  - New `unit/solver/` and `unit/features/deal/` suites.
  - New `fixtures/solverCorpus.ts`.
  - New `bench/winnable.bench.ts`.
  - `unit/repo/` gains a shared purity scanner and `solverPurity.test.ts`, and
    `reservedLayers.test.ts` is narrowed.
  - `setup.ts` guards its DOM-only stub, so test files that declare the Node environment can run.
- **Configuration:**
  - `package.json`: the `@vitest/web-worker` dev dependency and a `bench` script. `validate` is
    unchanged.
  - `vite.config.ts`: the worker format.
  - `eslint.config.js`: solver and features overrides.
  - The workflows are unchanged.
- **Docs:** `docs/spec/phased-design.md`, `docs/spec/research.md`, `AGENTS.md`, `tests/README.md`,
  and the `src/solver` and `src/features` READMEs.
- **Constitution:**
  - Principle 1 now has an automated guard for `src/solver`. The solver may import `src/domain`, and
    only the worker entry may touch the worker global.
  - Principle 2 holds: every deal is still `dealFromSeed(seed, mode)`. The solver only chooses among
    seeds, and the Daily seeds are a pure function of the UTC date.
  - Principle 5 does not apply: this change adds no player-facing interaction.
