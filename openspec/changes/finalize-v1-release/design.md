# Design

## Context

This change needs a design document for four reasons:
- it crosses every `src/` layer;
- it adds two solver capabilities and a second background thread;
- it changes the storage record from v1 to v2;
- it rewrites constitution principle 10 and the source-of-truth order.

The proposal (Why) gives the motivation. What follows is the current state that shapes the approach,
checked against the code.

- **The Draw 1 search is pinned.**
  - `src/solver/solver.ts` is a faithful port of the mockup's reference DFS. It treats the stock and waste
    as an unordered set, uses a canonical string key, sends safe cards first, orders moves by 8 priorities
    (priority 4 is a lossy prune) and counts nodes against a budget.
  - It refuses Draw 3 and Vegas at `:280`, answering `unknown` with 0 nodes.
  - The Daily v1 selection (`features/deal/daily.ts`, 20,000 nodes, 40 attempts) and its golden dates
    (`tests/fixtures/dailyGolden.ts`) depend on this exact search.
  - So do the corpus (`tests/fixtures/solverCorpus.ts`: seeds 1–200 give 142 / 1 / 57), the 26-node test
    for seed 19, and the midgame lines.
- **Only Draw 1 is solvable, and that is hard-coded in five places:**
  - `solver.ts:280`;
  - `winnable.ts:30`, which deals every seed as `'draw1'`;
  - `dealService.ts:122`, which sends only Draw 1 (with the switch on) and Daily to the worker;
  - `dealService.ts:199`, the hint gate;
  - `WinnableToggle.tsx:17`.

  `line.ts#surface()` draws until the card is on the waste top, which is valid only in Draw 1.
- **The worker is stateless by spec** (`solver/deal-selection`, "Background-thread message interface").
  Other client behaviour that matters here:
  - `solverClient.cancel()` terminates a busy worker, and every `deal()` calls it;
  - `hint()` answers `busy` while a deal is pending;
  - deals have no timeout.
- **Domain.**
  - The rules match Microsoft Windows Solitaire:
    - Standard scoring: +10 to a foundation, +5 waste→tableau, +5 per flip, −15 foundation→tableau,
      −100 per Draw 1 recycle, −20 per Draw 3 recycle from pass 4 on, −2 per 10 s, a bonus of 700,000 ÷ s
      after 30 s, and a floor of 0;
    - Vegas: −$52 to start, ±$5 per card, Draw 3 with 3 passes.
    - The 2-point Standard undo charge is a recorded project decision.
  - Two edge bugs:
    - `validate.ts:71` accepts `passes` above `passLimit(mode)`;
    - `deadEnd.ts:6-9` treats every stock and waste card as reachable.
  - `engine.ts#applyDraw` owns the draw and recycle stepping.
  - `hint.ts#findMove` returns only the first move of the best priority.
- **Persistence.**
  - `recordCodec.ts` has one `RECORD_VERSION = 1`, and anything above it is `future`.
  - Preferences and games are decoded with exact key sets (`PREFERENCE_KEYS`, and `GAME_KEYS` in
    `sessionCodec.ts`).
  - A readable record never touches the backup key. An occupied backup key switches saving off after a
    later unreadable record (`persistenceLoader.ts:19-25`).
- **Build identity.**
  - `github.run_started_at` is not a property of the `github` context, so both workflows pass `""`.
  - `vite.config.ts:13` (`??`) keeps that empty string, and `BuildStamp.tsx:5` renders it.
  - Nothing reads `GITHUB_RUN_NUMBER`.
- **Icons.**
  - `scripts/generate-icons.mjs` hand-encodes PNGs with `node:zlib`. It has no dependencies and no SVG
    source.
  - `tests/unit/repo/icons.test.ts` requires the committed PNGs to be byte-equal to a fresh render, and
    checks the maskable safe zone against the `#0b2545` background.
- **Tests.**
  - Only 3 of the 84 KS ids appear in test code. The openspec specs cite all 84 as `*(KS-…)*` notes.
  - End-to-end wins exist only for Draw 1 (`WINNING_LINE`, seed 49, 117 commands). The Phase 9 edge cases
    listed in the proposal have no browser coverage.
  - Coverage thresholds exist in the Vitest config, but `validate` never runs coverage.
- **Docs.**
  - `.prettierignore` excludes all of `docs/`.
  - No code, test, script or workflow reads `docs/spec`. Only prose, links, and about 50 requirement
    texts or footnotes in `openspec/specs` cite it or the mockup.

## Goals / Non-Goals

**Goals:**

- Winnable, graded deals in Draw 1, Draw 3 and Vegas.
  - Every Draw 1 verdict, every Daily deal and every pinned fixture stays byte-identical.
- A deal served from a warm pool appears at once. A player's deal or hint never waits for pool work.
- Grading and the new search are deterministic by seed (constitution 2). Every source of randomness is
  the seeded PRNG.
- Every KS id maps to a test or a recorded manual check, and a guard keeps that true.
- Once the spec pack is gone:
  - the repository is self-describing: OpenSpec is the specification, and `docs/` is the maintained
    documentation;
  - committed screenshots are the visual reference.
- Quality work changes no behaviour, lands first, and each item keeps its own test (D15).

**Non-Goals:**

- Any change to the Draw 1 search, the Daily v1 selection, the scoring rules or the deal-code format.
- A pool that survives a reload, a pool inside the worker, or a pool for Daily.
- Statistics per difficulty, a one-card Vegas mode, or cumulative Vegas.
- Pixel-diff screenshot gates, or a new screenshot or icon library.
- Refactoring `useBoardPointer`'s large effect. The previous change looked at it and left it alone, and
  nothing here touches it.

## Decisions

### D1 — One change, two branches, explicit approvals

- **Why one change.** The three phases ship together at the author's request. The config rule of one
  phase slice per proposal is waived on purpose, as `add-screens-sheets-pwa` did.
- **Group order.** Groups follow the author's order:
  1. set-up and quality;
  2. edge cases;
  3. solver, grading and pool;
  4. proof;
  5. visual review, docs and release.

  Every group depends only on earlier ones.
- **Branches.**
  - `feature/app-v1-release` is the integration branch, cut from `master`.
  - The change runs on `feature/finalize-v1-release`, cut from the integration branch.
  - At archive, the change branch is squash-merged into the integration branch. The integration branch
    then goes to `master` through a pull request.
- **What needs a separate request from the author:**
  - pushing either branch (which the CI reruns in task 11.12 need);
  - opening the pull request;
  - creating the `v1.0.0` tag;
  - deleting the stale remote branches.

### D2 — The Draw 1 search is frozen; a new search sits beside it

- **Layout.**
  - `solver.ts` stays byte-identical, including its refusal of Draw 3 and Vegas.
  - A new `src/solver/ordered.ts` holds the ordered-talon search.
  - A new `src/solver/search.ts` routes a position: Draw 1 or Daily (one card, no pass limit) goes to
    `solve`; Draw 3 and Vegas go to `solveOrdered`.
  - `winnable.ts` (which now deals in the requested mode) and `hint.ts` call the router.
- **Why.** Every pin keeps holding with no re-baselining: Daily v1, the corpus, the node-count test, the
  midgame lines and the `draw1-solver` spec.
- **Alternatives rejected.**
  - One generalised search for every mode: slower for Draw 1, and it would change every Daily deal.
  - Freezing a copy of the Draw 1 solver just for Daily: two Draw 1 searches to maintain.

### D3 — The ordered-talon model and its moves

- **State.**
  - The columns, as a face-down count plus the face-up cards.
  - The foundation heights.
  - The stock and waste as ordered lists (top last).
  - In Vegas, the passes left.
- **Key.**
  - The foundation heights, then the column strings, sorted, because columns are symmetric.
  - Then the exact stock order and the exact waste order; in Vegas, also the passes left, because a
    recycle there costs a pass.
  - Two positions share a key only when drawing alone reaches exactly the same arrangements from both.
    A tempting shortcut is rejected here: keying every Draw 3 talon by its order after the next recycle.
    A part-way arrangement (common after a waste card is played) reaches waste tops that the cycle after
    a recycle cannot. Merging the two would lose those tops whenever the cycle state is visited first,
    and `loss` would stop being a proof.
- **Talon moves are macro moves.**
  - Draw with the shared `stepTalon` (D4) until the configuration repeats (Draw 3) or the recycles run out
    (Vegas).
  - Every distinct configuration whose waste top can go to a foundation or a column gives one move: "draw
    *k* times (recycles included), then play the top".
  - Draws commute with board moves, so draws on their own never need a branch.
- **Board moves**, in order:
  1. column → foundation;
  2. talon macro → foundation;
  3. a whole run that uncovers a face-down card;
  4. talon macro → column;
  5. a King run into the first empty column;
  6. a whole run from a column with nothing face down onto another non-empty column, which empties the
     column (the Draw 1 search's priority 6);
  7. partial runs;
  8. foundation → column.
- **Safe sends** apply before branching, and only where they can never discard a win.
  - They cover the column tops and the **current** waste top only. Surfacing another reachable top costs
    draws, and in Vegas it can cost a pass.
  - They use the strict rule. A card is safe if either:
    - its rank is at most 2; or
    - both opposite-colour foundations reach rank − 1 **and** the other same-colour foundation reaches
      rank − 2.
  - The strict rule is needed because foundation-to-column moves are legal, so a same-colour card two
    ranks lower may still need a parent. The domain's looser auto-safe rule stays as it is for players
    and for the Draw 1 search.
  - The endgame set in D5 includes a position where the looser rule would lose the win.
- **Pruning** removes only moves that can never be needed:
  - a King already at the base of a column moving to an empty column;
  - every empty column but the first.

  Nothing prunes partial runs, column-emptying runs or foundation-to-column moves. So `loss` means the space was exhausted, and
  it can be checked (D5).
- **Budget and output.**
  - The node budget counts the same way as in Draw 1: a node is counted after safe sends, the win check and
    the visited check, and `budget + 1` means `unknown`.
  - The line is a list of player commands with explicit draws. A draw on an empty stock is a recycle.
- **Alternatives rejected.**
  - Reusing the lossy priority-4 prune: `loss` would stop being a proof.
  - A time bound: it is not deterministic.
  - Keeping a waste pointer inside one immutable talon array: it is equivalent, but harder to key under
    Vegas.
  - The Draw 1 search's loose safe rule and its cycle-merged talon: both are cheaper, and both can discard
    wins.

### D4 — One talon-stepping rule for the engine, the dead end and the search

- **Module.** A new `src/domain/talon.ts` holds two functions:
  - `stepTalon(stock, waste, draw)`: one draw of up to `draw` cards, or a recycle, `stock = reverse(waste)`;
  - `reachableTops(state)`: the configurations reachable by drawing alone, and the waste top of each, in
    draw order, bounded by one full cycle or by the remaining passes.
- **Users.**
  - `engine.ts#applyDraw` delegates to `stepTalon`, and the engine tests pass unchanged.
  - `deadEnd.ts` asks whether any card in `reachableTops` is playable, instead of scanning every talon
    card. In Draw 1 every card is still reachable, so its behaviour does not change.
  - `ordered.ts` builds its talon moves from the same function, so the engine, the dead end and the search
    cannot disagree about what drawing reaches.

### D5 — The search is checked from both sides

- **Soundness.** Every `win` line is replayed through `applyCommand`; `expandLine` already throws on any
  refusal. The tests replay:
  - seeds 1–50 per mode;
  - the corpus wins;
  - the pinned end-to-end lines.
- **Completeness.**
  - A test-only exhaustive search, `tests/support/bruteForce.ts`, runs over the domain engine. It tries
    every legal command and has no pruning. It deduplicates on `positionKey` plus, in Vegas, the passes
    left: `positionKey` covers the piles only, and in Vegas the same piles with more passes left can win
    where fewer cannot.
  - It runs over a pinned set of seeded endgames, `tests/fixtures/endgames.ts`, each with 14 or fewer cards
    off the foundations, in Draw 3 and in Vegas.
  - There, `solveOrdered`'s `win` / `loss` must equal the brute force's win / no-win, and `unknown` is not
    allowed.
- **Why.** Some published solvers mis-solve benchmark deals, so any solver must be validated against known
  results. The engine is the oracle, so the search cannot drift from the rules the player plays by.

### D6 — Grading v1: seeded, visible-information playouts

- **Candidates.** `src/domain/hint.ts` gains `hintCandidates(state)`: every productive move, ordered by
  hint priority, then canonical source order, then target order. `findMove(state)` is its first entry, and
  a property test pins that.
  - Candidates use only visible cards: face-up runs, the waste top and the foundation heights.
  - A test checks that permuting the hidden cards among themselves never changes the candidates.
- **Playout player** (`src/solver/grading.ts`):
  - At each step it takes the candidates and picks the first one with a fixed probability. Otherwise it
    picks a later one, weighted toward higher priority.
  - With a small probability it draws even though a move exists, as people do.
  - It draws when it has nothing to play, and recycles when the pass limit allows.
  - It stops:
    - at a win;
    - when nothing is left;
    - after a full talon cycle with no board move (a stall);
    - at a step cap.
  - Randomness is `mulberry32(mix(dealSeed, playoutIndex))` and nothing else.
- **Grade.**
  - N playouts (16 to start) give *w* wins. The per-mode table `GRADING_V1.thresholds[mode]` maps *w* to
    Easy, Medium or Hard.
  - The initial values are Easy *w* ≥ 10, Medium 3–9, Hard ≤ 2 in every mode.
  - Daily is graded with the Draw 1 table.
- **Calibration** (task 7.3).
  - `tests/bench/grading.bench.ts` grades the verified deals of seeds 1–N per mode and reports each
    grade's share and the cost.
  - The table, and N if the cost demands it (down to 8), are then set so that every grade holds at least
    about 15% of verified deals in each mode.
  - The result is pinned in `tests/fixtures/gradingGolden.ts` and in the Daily golden dates.
  - Changing N, the policy or the table creates a new grading version.
- **Where it runs.** Grading runs in the worker, only after a `win`, and costs roughly N × 200 cheap
  steps.
- **Alternatives rejected.**
  - Counting distinct winning lines: infeasible, because easy deals have millions.
  - Solver node count: it depends on move ordering, not on difficulty for a person.
  - One greedy playout: that only wins about 13% of Draw 1 seeds (`tests/fixtures/deals.ts:66-68`), too
    coarse to split into three grades.

### D7 — Selection with a target grade and an honest fallback

`findWinnable({ mode, seeds, budget, target })` works like this:

| Case | What it selects | Attempts reported |
| --- | --- | --- |
| `target = 'any'` | today's algorithm exactly: the first `win`, then graded | the position of that seed |
| An exact match | the first candidate that is `win` with the requested grade | its position |
| No exact match | the proven candidate whose grade is closest (Easy < Medium < Hard; on a tie, the earlier seed), labelled with its actual grade | the list length |
| Nothing proven | the last seed as `random`, with no grade | the list length (KS-DEAL-05) |

- **Daily** always uses `any`, with its pinned v1 plan, then grading. So a Daily deal's seed and attempts
  never change.
- **Cost.** Grading runs only on `win` candidates. The walk stops at the first exact match, so a proven
  deal of another grade costs one grading pass.

### D8 — The instant-deal pool lives on the main thread, with its own worker

- **Where it lives.** `src/features/deal/dealPool.ts` is created inside the deal service.
  - It owns a second `SolverClient`, built by the same `createSolverClient(defaultCreateWorker)`. That
    means the same bundled worker chunk, and no change to `validate-artifact`.
  - It keeps a FIFO of pre-verified outcomes, at most 2, keyed by `mode:difficulty`.
  - It fills one deal at a time with an ordinary `findWinnable` request: fresh crypto seeds, the same
    budgets and grading as a requested deal. So a pooled deal's provenance means exactly what an
    on-demand one means.
- **Control.**
  - `dealService.prefetch(choice)` sets the key to fill first and starts filling. `pause()` stops it after
    the request in flight.
  - Filling also pauses by itself while a player's deal is pending.
  - `deal()` takes from the pool first when the switch is on and the mode is not Daily. A pooled deal is
    delivered at once, with no progress and no overlay, and a refill is scheduled.
  - `deal()` cancels only the player client. The pool client is never cancelled by a deal or a hint.
  - If the pool worker fails, only the fill in flight is dropped. Deals already pooled stay available,
    no notice is shown, and the next fill starts a new worker. The player path is unaffected.
- **Controller.** `src/app/dealPoolController.ts` is started by `lifecycle.tsx` after the first idle
  period, through an injected scheduler, so it does not affect Lighthouse's first load.
  - It calls `prefetch` whenever `selectedMode`, `winnableOnly` or `difficulty` change, or the page
    becomes visible.
  - It calls `pause` when the page is hidden.
  - `ThunkExtra` keeps its shape; `DealService` gains `prefetch` and `pause`.
- **Why not in the worker, as the Phase 11 text says.** The spec requires a stateless worker. Also,
  `cancel()` terminates a busy worker, so a pool held there would be killed by every player deal, and
  hints would queue behind refills.
- **Alternative rejected.** Persisting the pool in the record: a storage change for a gain seen only on the
  first deal after a reload.

### D9 — The grade is deal provenance on `GameState`

- **The field.** `GameState.difficulty: 'easy' | 'medium' | 'hard' | null` sits beside `verdict` and
  `attempts`.
  - `dealFromSeed(seed, mode, provenance)` sets it.
  - `isValidGameState` requires a known value, and requires `null` unless the verdict is `win`. It also
    requires `passes ≤ passLimit(mode)` (the task 4.1 fix).
- **Where it is kept.**
  - Restart keeps the grade.
  - `playDealCode` gives `null`, because a code cannot carry provenance.
  - The win summary copies it.
- **The two slices land together.** `GameState` and the session codec's v2 key set land in **one task**
  (8.2). Otherwise stored games stop decoding.

### D10 — Record v2, with a lossless upgrade from v1

- **Version dispatch.**
  - A parsed record is dispatched on `version`:
    - `1`: check the exact v1 key sets (12 preferences, the v1 game keys), add the v2 fields
      (`difficulty: 'any'`, and `difficulty: null` on every game), and only then run the full validity
      checks (`isValidGameState` and the rest), which require the v2 fields. A readable v1 game is
      therefore never rejected for lacking a grade;
    - `2`: decode with the v2 key sets (13 preferences, with `difficulty` last; the game keys plus
      `difficulty`);
    - above 2: `future`;
    - anything else: `invalid`.
  - The key lists are versioned constants. There is still one field-by-field decoder, parameterised by
    version, not two copies.
- **The upgrade.** `upgradeV1` is a total function:
  - `difficulty: 'any'` in preferences;
  - `difficulty: null` on the current game and every rebuilt step.

  Nothing is salvaged: a v1 record that fails v1 validation is unreadable as a whole, with a backup, the
  defaults and a notice, exactly as today.
- **Backups.** A readable v1 is not copied to `solitaire.local-state.unreadable`. An occupied backup key
  would switch saving off after a later genuinely unreadable record.
- **Writing.** Only v2 is ever written.
- **Mixed versions** (documented in Migration Plan):
  - an old tab still running v1 code can write v1 over v2; the next load upgrades it again, and only
    Difficulty returns to Any;
  - a rollback deploy would read v2 as `future`, which takes the existing backup-and-defaults path, and
    the data is kept in the backup key.

### D11 — The Difficulty control

- **The control.**
  - `Segmented` gains `disabled`.
  - `WinnableToggle` renders it inside the Winnable card, under the caption, as a radio group named
    "Difficulty": Any, Easy, Medium, Hard.
  - It is enabled only when the switch is on and the mode is not Daily. While disabled it shows the stored
    choice and never writes it.
  - It has no animation of its own; the existing colour transition is off under `data-motion='off'`.
- **Where Difficulty is not added.** Not to Settings: Home already owns "Winnable deals only", and the two
  belong together.
- **Checked by** the device-fit and pseudo-locale matrices.

### D12 — Solver hints in every mode

- The gate at `dealService.ts:199` goes. Every position that is not won asks the router (D2) with the
  existing 3,000 nodes and 150 ms, and falls back to the heuristic exactly as today.
- Draw 3 and Vegas nodes cost more, so a timeout may send more of their hints to the heuristic. That is
  already a valid, specified outcome.

### D13 — Build identity is computed at build time

- **The script.** `scripts/build-info.mjs` exports `resolveBuildInfo(env, now)`, which returns
  `{ number: string | null, time: 'YYYY-MM-DD HH:mm UTC' }`.
  - An empty or whitespace `GITHUB_RUN_NUMBER` counts as absent.
  - `now` is injected for tests.
- **Wiring.**
  - `vite.config.ts` defines `__APP_BUILD__` from it.
  - `vitest.config.ts` defines a fixed test value.
  - `BuildStamp` and About format it with the catalog keys:
    - `build.label`: "Build {number} · {time}";
    - `build.dev`: "Development build · {time}".
- **Workflows.** Both drop `BUILD_TIMESTAMP`. GitHub Actions sets `GITHUB_RUN_NUMBER` by itself, so the
  deployed Pages build and the CI end-to-end build both carry a number. Action versions are refreshed from
  their release pages in the same task (AGENTS.md "GitHub Actions").
- **Tests** cover exactly what was missed before:
  - the `""` case;
  - the define in the config contract;
  - a stamp that is never empty in the end-to-end check.

### D14 — A card-fan pixel icon from one geometry

- **Geometry.** `scripts/generate-icons.mjs` holds a single list of rectangles on a small pixel grid:
  - the navy `#0b2545` background;
  - a card back (the brand sky/navy dither), offset up and to the left;
  - a white card face in front, with a pixel "A" and a spade in the ink colour.
- **Outputs from the same list.**
  - `public/favicon.svg`, as `<rect>`s with `shape-rendering="crispEdges"`;
  - PNGs at 192, 512 and 180 (Apple touch);
  - a 512 maskable icon whose mark is scaled into the central 80% safe zone.

  Each size uses an integer scale, centred, with navy padding.
- **Why this design.**
  - It stays dependency-free and byte-exact, so the icon test keeps its meaning and also covers the SVG.
  - It matches the retro Press Start 2P look.
  - The previous change decided against rasterising with a browser (D10 there), because the output
    differs between platforms.
- **After the change**, look at the icon at 16, 32, 180 and 512 px by eye.

### D15 — Quality work: first, with no behaviour change, and bounded

**Group 2 lands before any feature work.** Each item keeps the existing suites green and adds its own
test:

| Item | What changes |
| --- | --- |
| Coverage | `validate` runs the unit and component suites with coverage, so the 80% thresholds are enforced. If they fail, stop and surface it; never lower the bar |
| Thunk extra | One `assembleThunkExtra(overrides)` used by `store.ts` and `lifecycle.tsx`. The loader reads `extra.languages` |
| Dead code | `readOnlyEntered`, `selectBusy` and `selectPendingHint` are removed. `StatsSheet` uses `selectWinRate` |
| Single sources | `MODES` in `domain/deal.ts`; `MAX_DAILY_COMPLETED` in `statsSlice`; the codec guards in `persistence/guards.ts`, with `dayKeys` reusing `isDayKey` |
| Engine casts | `engine.ts:47,53` use a typed tuple update, with no `as unknown as` |
| Pile identity | One exported `samePile` (from `rules.ts`). `pileKey` moves out of the geometry module. Keyboard hits come from `selectCardLocations` |
| Sheets and shortcuts | `ModalSheet` gets a default focus fallback and loses `data-testid` (tests use roles); `SheetHost` has an exhaustive map; `SettingsSheet` builds its switch rows from one list; `useGameShortcuts` has one pause guard |
| Swatches | Card-back swatches read the colours from the tokens |
| Session thunks | `playDealCode` moves to `sessionThunks.ts` |
| Test hygiene | No `vi.mock` of our own modules (outcome or factory-injection tests instead); one `matchMedia` fake; the low-value `savePort` and `testStore` tests are trimmed |
| Contract suite | One `DealService` contract suite runs against the real service (stub worker) and the test fake. It replaces `fakeDealService.test.ts` and guards the fake while the service grows |
| Import guard | A guard for features → app: only the app slice's actions and selectors (including `app/selectors`), the thunk type and the store types |

**Left alone on purpose:**
- the `ThunkExtra` shape and its narrow ports;
- the pure pointer and keyboard controllers;
- `commitCommand` and `runSequence`;
- the field-by-field codecs, which give deterministic output with exact keys;
- `DAILY_V1` kept separate from `MAX_ATTEMPTS`;
- the worker, storage, ResizeObserver, WAAPI and pointer-capture test doubles, all of which stand in for
  real boundaries.

### D16 — Full-game wins in every mode, end to end

- **Fixtures.** Draw 3, Vegas and Daily winning lines are generated once with the new search and D2's
  router, then pinned in `tests/fixtures/deals.ts` beside `WINNING_LINE`.
  - For each mode, pick among the first winnable seeds the shortest line with no foundation-to-column
    moves.
  - `tests/unit/fixtures/winningLines.test.ts` replays every line through `applyCommand` without the
    solver.
  - The recipe is written in `tests/README.md`.
- **The spec.** `tests/e2e/playModes.spec.ts` covers:
  - Draw 1 by tap, drag and keyboard (the existing specs, extended to more projects);
  - Draw 3 by keyboard;
  - Vegas by drag;
  - Daily by tap: started from Home with `page.clock` fixed on a golden date, so the real worker selects
    the pinned seed.

  Each runs on Chromium, Firefox, WebKit and one touch project.
- **Speed.** Animations are off in these specs (`animations: false`), which keeps the runtime in bounds.

### D17 — Traceability is generated and guarded

- **How tests declare coverage.** A `// covers: KS-XXX-nn[, …]` comment at the top of a test file or a
  `describe`.
- **The generator.** `scripts/trace-requirements.mjs`:
  1. reads every `### Requirement:` block of the main specs `openspec/specs/**`, and the KS ids in its
     footnote. Active changes' delta specs only widen the set of known ids, so a test may cite a new id
     before sync. They never change the matrix, so a new proposal never makes it stale, and a RENAMED
     requirement never appears twice;
  2. scans `tests/**` for `covers:` comments;
  3. reads the manual-check table in `docs/reference/manual-checks.md`;
  4. writes `docs/reference/traceability.md`, sorted by KS id, listing each id's requirements, its test
     files and any manual check.
- **The guard.** `tests/unit/repo/traceability.test.ts` fails on any of:
  - the committed file differs from a fresh generation;
  - a test claims an unknown id;
  - in strict mode, any main-spec id has neither a test nor a manual check.
- **Formatting.** The generator writes Prettier-stable Markdown by formatting its output with the
  project's Prettier configuration before writing. The matrix therefore survives `format:check` and the
  pre-commit hook once `docs/` is formatted (task 13.4).
- **Regeneration.** From task 11.3 on, any task that changes a `covers:` comment, a main-spec KS citation
  or `manual-checks.md` runs `rtk npm run trace` and commits the matrix.
- **Two stages.** The guard starts in report mode (task 11.3). Annotation (11.4–11.6) and gap filling
  (11.7) follow, and then 11.8 switches it to strict.
- **Where the ids live.** Once `specification.md` is deleted, the KS ids are defined by the requirements
  that cite them. New ids in this change:
  - KS-DEAL-11: difficulty;
  - KS-DEAL-12: the pool;
  - KS-PER-06: the upgrade;
  - KS-GEN-11: build identity.

### D18 — Retiring the spec pack

- **Facts that move:**
  - rules and Microsoft parity, scoring rationale, undo and Vegas decisions → `docs/reference/game-rules.md`;
  - winnability facts and the solver literature → the new `docs/reference/winnability.md`;
  - the R§13.1 device table plus the real-device checklist → the new `docs/reference/device-matrix.md`,
    which `tests/fixtures/viewports.ts` cites;
  - the reference-solver description and the D2–D8 algorithms → `docs/architecture/domain-and-solver.md`.
- **Pins derived from the mockup's reference solver** cite it by git revision:
  `git show d72187f:docs/spec/mockup/klondike-mockup.html`. This applies to `solverCorpus.ts`,
  `dailyGolden.ts`, `prng.test.ts` and the `draw1-solver` delta.
- **Requirements.**
  - Requirements whose normative text depends on the pack or the mockup are MODIFIED in this change's
    deltas and made self-contained. For example, `ui/board-render` "Card faces follow the mockup" is
    renamed "Card faces".
  - Non-normative footnote citations (`spec §x`, `R§x`) and two `## Purpose` lines (`ui/home-screen`,
    `ui/board-assist`) get an editorial pass directly in the main specs after `openspec sync` (task 14.4).
    Carrying about 30 more full MODIFIED copies would duplicate roughly 1,500 lines and invite drift.
- **Guard.** `tests/unit/repo/noSpecPack.test.ts` scans the tracked files and forbids `docs/spec`,
  `klondike-mockup`, `R§` and the pack's file names, unless the reference is pinned to a git revision
  (`<sha>:docs/spec/…`).
  - `openspec/changes/archive/**` is exempt.
  - `openspec/specs/**` is exempt until task 14.4 includes it.
- **Formatting.** `.prettierignore` stops excluding `docs/`, and the maintained docs are formatted.
- **`AGENTS.md` and `openspec/config.yaml`:**
  - the source-of-truth order becomes: code, configuration, tests and CI; then `openspec/specs`; then
    `docs/`;
  - principle 10 becomes "look and feel is fixed; visual changes are deliberate and reviewed against the
    committed reference screenshots";
  - the `rules.specs` KS rule points at the OpenSpec specs.

### D19 — Visual review, then committed reference screenshots

- **The review.** Before any deletion, task 12.1 compares every screen with the 17 mockup screens by eye:
  light and dark, desktop and phone, Home, Game, the sheets and the win. It fixes polish only.
  - Known candidates:
    - the pixel-font minus sign in "−$52" (U+2212 may fall back from Press Start 2P);
    - Cyrillic coverage in pixel-font strings.
  - Anything larger than polish is surfaced, not absorbed.
- **The screenshots.** `tests/e2e/screenshots.spec.ts` is opt-in: it is skipped unless
  `CAPTURE_SCREENSHOTS=1`.
  - It runs in Chromium against the production build and writes about 8 JPEGs (quality around 80) to
    `docs/assets/screenshots/`: Home and Game, light and dark, desktop and phone.
  - The README embeds them, and they are the look-and-feel reference from then on.
  - `visualParity.spec.ts` keeps its CI artifact, but names its screenshots by state, not by mockup file.

### D20 — Release

- `package.json` goes to version 1.0.0, and the lockfile's root entry matches.
- A new `CHANGELOG.md` has a 1.0.0 entry summarising Phases 1–11.
- A new `docs/development/release.md` gives the procedure:
  1. validate and run the end-to-end suite;
  2. squash-merge;
  3. open a PR to `master`;
  4. Pages deploys;
  5. tag `vX.Y.Z` on `master`.
- `docs/development/ci-and-deployment.md` loses its resolved TODOs. The Pages source is already GitHub
  Actions.
- Tagging and publishing are done only on the author's request.

### Defaults recorded for minor product choices

- **Deal chip:** "Winnable · Medium". The shuffle count, when above 1, moves to the chip's accessible
  description and title ("found after 3 shuffles"). The narrow, icon-only chip keeps the full text as its
  name.
- **Win sheet:** a graded game shows "Easy deal", "Medium deal" or "Hard deal". An ungraded one shows
  nothing.
- **How to play:** one passage on "Winnable deals only" and the three grades.
- **Pool:** at most 2 deals per key; filling starts after the first idle period (about 2 s after load at
  most). Deals pooled for other keys are kept until reload.
- **Daily:** ignores Difficulty and shows its grade.
- **Statistics:** remain per mode, not per difficulty.
- **Budgets:** Draw 3 and Vegas start at 20,000 nodes and the 40-attempt cap. Task 6.5 may change those
  values, and it records the benchmark that justifies them in the `features/deal-service` delta table and
  in `tests/README.md`.
- **Real-device checks:** the author performs them. Task 11.11 ships the checklist and procedure, and the
  author records the rows or waives them before archive.

## Risks / Trade-offs

- **The ordered search is costly in a phone worker.** The ordered key and the extra branching make each
  node more expensive than in Draw 1, so a cold Draw 3 deal might take seconds. → Mitigations:
  - the pool makes warm deals instant;
  - the overlay covers cold deals;
  - the budgets come from the benchmark;
  - task 6.5 stops and surfaces the result if cold Draw 3 or Vegas deals miss 1 s at the median or 3 s at
    the 95th percentile on the desktop benchmark.

  Cold Draw 3 and Vegas numbers are informational (KS-PERF-02 is modified).
- **Grades may collapse into Hard in Draw 3 and Vegas**, where human-like play rarely wins. → Mitigations:
  per-mode tables, the policy weights, and a per-mode N. Task 7.3 stops and surfaces the result if any grade
  holds under about 15% of verified deals after tuning.
- **Grading adds cost to every verified deal, Daily included.** → It runs only on `win` candidates. The
  benchmark measures it, and N can drop to 8.
- **Traceability annotation touches many test files.** → It is split by area (11.4–11.6), each task a
  comments-only diff. The guard stays in report mode until 11.8.
- **Full-game end-to-end runs are long.** The 117-command line already takes up to 180 s. → Pick the
  shortest lines, turn animations off, and rotate the input paths across modes instead of running the full
  cross-product.
- **The main specs lag behind the deltas until archive.** → The no-spec-pack guard excludes
  `openspec/specs/**` until task 14.4 (sync plus the editorial pass) includes it.
- **The coverage gate may fail on today's code.** → Task 2.1 measures it first, and adds tests for the
  gaps rather than lowering the thresholds. If the gap is large, it stops and surfaces it.
- **A second worker adds memory and battery use.** → It is lazy, starts after idle, pauses when the page
  is hidden, stops at 2 deals per key, and fills only the selected key first.
- **Deleting the mockup removes the old visual authority.** → The visual review comes first (D19). The
  self-contained requirements (D18) and the committed screenshots then carry the look.

## Migration Plan

- **Storage (record `solitaire.local-state`).**
  - The version goes from 1 to 2. Decoding stays whole and defensive: each version has its own exact key
    sets, and nothing is salvaged.
  - A valid v1 is decoded and upgraded losslessly: Difficulty becomes Any, and every stored game gets no
    grade. No backup copy is made, and the next save writes v2.
  - An invalid v1 takes today's unreadable path: a verbatim copy to `solitaire.local-state.unreadable`,
    then defaults and a notice.
  - A v1 record written back over v2 by an old tab is upgraded again on the next load, and only Difficulty
    reverts.
  - A rollback to v1 code reads v2 as `future`. It keeps the value in the backup key, shows the notice and
    uses the defaults. Nothing is deleted silently (constitution 8).
  - `docs/reference/storage-format.md` documents both versions and the upgrade.
- **The pool** is memory only, so there is nothing to migrate.
- **Service worker and icons.** The new icons and bundle reach players through the existing prompt-mode
  update. Installed apps may keep the old home-screen icon until the operating system refreshes it.
- **Build identity.** No migration. The first Pages deploy after the merge shows a build number.
- **Docs.** `docs/spec` is deleted, and git history keeps it. The pins that depend on it cite revision
  `d72187f`.
- **Rollback.** Revert the merge. The v2 record is handled as described above.
