# Tasks

> **Conventions.**
> - Run commands through `rtk` (`rtk proxy <cmd>` when the wrapper rejects a flag).
> - Vitest tests are `*.test.ts` and live in `tests/`, mirroring `src/`.
> - Only test files that start a worker (the real one through `@vitest/web-worker`, or a stub) start
>   with `// @vitest-environment node` (D11). Pure solver tests keep the default jsdom environment.
> - Requirement names refer to this change's delta specs:
>   - **S** `specs/solver/draw1-solver`
>   - **L** `specs/solver/deal-selection`
>   - **F** `specs/features/deal-service`
>   - **P** `specs/app/application-shell`
>   - **T** `specs/tooling/repository-foundation`
> - `Dn` is `design.md` decision *n*. Read every decision a task names before coding.
> - Reference values (the corpus string, fast-win seeds, Daily golden values) and the recipe that
>   reproduces them from the mockup are in D2 and D7. Never derive a reference value from the new
>   implementation alone.
> - Shared references:
>   - **mockup solver:** `docs/spec/mockup/klondike-mockup.html:664-758` (per-rule line anchors in D1)
>   - **mockup deal pipeline:** `:630-662`
>   - **mockup attempt loop, overlay and chip:** `:1235-1296`
>   - **R§4.4–4.5, R§3.4, R§6.1–6.2:** `docs/spec/research.md`
>   - **phased-design §4:** rows Winnable selection, Solver and Hint
>   - **domain API:** `src/domain/README.md`
> - Build test positions with `makeState`, `deepFreeze`, `tableauOf`, `faceUp`, `faceDown` and
>   `foundationsOf` from `tests/fixtures/states.ts`.
> - Every module added to `src/solver` gets its bullet in `src/solver/README.md` **in the same task**,
>   so the inventory check from task 1.1 stays green.
> - Every task ends with the full `rtk npm run test:unit` and `rtk npm run lint` green.

## 1. Layer guards

- [x] 1.1 Open the solver and features layers behind automated guards
    - **Implements:**
      - P "Layers reserved for later phases carry no behaviour" (MODIFIED);
      - P "The solver layer is isolated from the rest of the application";
      - P "The features layer never loads solver code on the input thread";
      - *KS-DEAL-10*; D10.
    - **Files:**
      - `tests/unit/repo/purityScanner.ts` (new, not a test file). Move `stripComments`, `unquote`,
        `importSpecifiers`, the forbidden-identifier matcher and a `readmeModules(readme, pattern)`
        helper out of `domainPurity.test.ts`.
      - `tests/unit/repo/domainPurity.test.ts`: use the scanner. Behaviour and assertions unchanged.
      - `tests/unit/repo/solverPurity.test.ts` (new).
      - `tests/unit/repo/reservedLayers.test.ts`: `RESERVED_LAYERS = ['i18n', 'pwa']`.
      - `eslint.config.js`:
        - a `src/solver/**/*.ts` `no-restricted-imports` regex allowing only `./name` and
          `../domain/name`;
        - a `src/features/**/*.ts` `@typescript-eslint/no-restricted-imports` pattern with
          `regex: '(^|/)solver(/|$)'` and `allowTypeImports: true` (D10).
      - `src/solver/README.md`: rewrite with an **empty** module list, plus the layer rules from P and
        the notes that `loss` is not a proof and that the search sees face-down cards (D1).
      - `src/features/README.md`: state that `deal/` lands in this change.
      - `AGENTS.md`: principle 1 names the solver guard.
    - **References:** `tests/unit/repo/domainPurity.test.ts` (the helpers to move and the per-file
      `describe.each` pattern); `eslint.config.js:28-42` (the domain override to mirror);
      `tests/unit/repo/reservedLayers.test.ts`.
    - **Tests:**
      - `solverPurity.test.ts`:
        - specifier rules: `./line` and `../domain/engine` are accepted;
          `../features/x`, `react` and `../domain/sub/x` are flagged;
        - every forbidden identifier from the domain guard, **plus `crypto`**, is flagged;
        - `self` is flagged in any file except `solver.worker.ts`;
        - a `readdirSync`-driven `describe.each` over `src/solver/*.ts` asserts all three rules;
        - the README inventory, parsed with ``/^- `([A-Za-z]+(?:\.worker)?\.ts)`/gm``, equals the
          directory's `.ts` files. An empty list is valid while there are no modules.
      - `domainPurity.test.ts` passes unchanged in behaviour.
    - **Verify:**
      - `rtk npx vitest run tests/unit/repo` passes.
      - `rtk npm run lint` passes.
      - Each of these fails as stated, and is then reverted:
        - a temporary `src/solver/scratch.ts` containing `import { x } from '../app/store';`
          fails both the purity test and lint;
        - the same file with `crypto.getRandomValues` fails the purity test;
        - a temporary `src/features/deal/scratch.ts` with a value import from `../../solver/x`
          fails lint;
        - the same file with `import type` passes lint.

## 2. Solver (pure)

- [x] 2.1 Port the bounded Draw 1 search and pin the reference corpus
    - **Implements:**
      - S "Bounded Draw 1 search verdict" (verdict, nodes, dedup, safe moves, no mutation,
        determinism; the line comes in task 2.2);
      - S "Search results match the reference solver";
      - S "Unsupported and finished positions";
      - *KS-DEAL-03, KS-DEAL-01*; D1, D2.
    - **References:** mockup solver with the D1 anchors (ordered talon, priorities, pruning, node
      counting); R§4.4–4.5; `src/domain/rules.ts` `passLimit` and `isWon`; `src/domain/deal.ts`
      `dealFromSeed`; `src/domain/types.ts` (`GameState`, `TableauCard`); D2 reference values.
    - **Files:**
      - `src/solver/solver.ts`:
        - exports `solve(state, budget)`, `SolveVerdict` and `SolveResult`;
        - the search uses an explicit stack, not recursion;
        - in this task `line` is omitted, except for the won position, which gets `[]`.
      - `tests/fixtures/solverCorpus.ts`: the D2 200-character `w`/`l`/`u` string, where position
        *i* is seed *i*+1; a helper `corpusSeeds(verdict)`; and a comment recording the D2 recipe and
        totals.
      - `src/solver/README.md`: add the `solver.ts` bullet.
      - `tests/README.md`: list the new `fixtures/solverCorpus.ts`.
    - **Tests:** `tests/unit/solver/solver.test.ts`
      - **Phase gate:** each seed 1–200, dealt with `dealFromSeed(seed, 'draw1')` and solved at
        5,000, has the pinned verdict. The totals are 142/1/57, and the only `loss` is seed 91. Use
        `it.each` over seed ranges of 50 with a 30 s timeout per range (D2). Task 2.2 extends this
        same per-seed pass; do not write a second full-corpus loop.
      - Seeds with a `win` verdict report `nodes ≤ 5000`. Seeds with `unknown` report
        `nodes === 5001`.
      - Budget boundary: seed 19 wins in 26 nodes at 5,000 (D2), so it is `win` with `nodes: 26` at
        budget 26 and `unknown` with `nodes: 26` at budget 25.
      - Unsupported and finished positions:
        - a Draw 3 deal and a Vegas deal give `{ verdict: 'unknown', nodes: 0 }` with no `line`;
        - a won position (all foundations at 13) gives `{ verdict: 'win', nodes: 0, line: [] }`;
        - a Daily deal of a corpus seed gives the same verdict as its Draw 1 deal.
      - A mid-game Draw 1 position (non-empty waste, `passes` 3) is searched, not refused.
      - A deep-frozen input does not throw and is unchanged.
      - Two searches of the same position give equal results.
    - **Details:**
      - Regenerate the corpus string with the D2 recipe (a throwaway script outside the repo, never
        committed) and confirm it equals the D2 string. If it does not, stop and report it. Do not
        edit the expected values.
      - Keep the ordered talon, the move priorities, the stable sort, the `safe()` scan order and
        the node-counting order exactly as D1 describes.
    - **Verify:**
      - `rtk npx vitest run tests/unit/solver/solver.test.ts tests/unit/repo` passes.
      - A temporary swap of move priorities 3 and 4 in `gen` makes the corpus test fail at a named
        seed, and is then reverted.

- [x] 2.2 Record the winning path and expand it into player commands
    - **Implements:**
      - S "The winning line replays as player commands";
      - S "Bounded Draw 1 search verdict" (scenario "Repeated searches agree", line included);
      - *KS-AST-03, KS-MOVE-07*; D1, D2, D3.
    - **References:** mockup solver `safe`/`gen`/`apply`; `src/domain/engine.ts` (draw and recycle
      behaviour); `src/domain/rules.ts` `groupAt`, `wasteTop`, `canRecycle`.
    - **Files:**
      - `src/solver/solver.ts`: stack frames carry the abstract moves, meaning the branch move plus
        that node's `safe()` sends. Talon moves are keyed by card id. On `win`, `solve` returns
        `line = expandLine(state, path)`.
      - `src/solver/line.ts` (new): `expandLine(state, moves)` and the exported `SolverMove` type.
      - `tests/unit/solver/solver.test.ts`: the task 2.1 corpus pass also replays each `win` line.
      - `tests/fixtures/solverCorpus.ts`: add `MIDGAME_POSITIONS`, a list of `{ seed, k, budget }`
        entries: the position after the first *k* commands of that seed's line, and a budget (5,000
        or 3,000) at which a fresh solve of it is still `win`, checked when the entry is chosen.
        Pick at least three entries, at least two of them at budget 3,000 (tasks 2.3 and 4.4 use
        those), and at least one whose next command is a draw while the stock holds cards.
      - `src/solver/README.md`: add the `line.ts` bullet.
      - `docs/spec/phased-design.md` §4 Solver row: an iterative port whose line is made of player
        commands (draws and moves, no `autoFoundation`).
    - **Tests:**
      - **Phase gate**, added to the corpus pass in `tests/unit/solver/solver.test.ts`: for every
        corpus `win` seed, replaying `line` through `applyCommand` from its deal:
        - refuses nothing (no `rejected` event);
        - ends with `status: 'won'` and every foundation at 13;
        - contains no `autoFoundation` command.
      - `tests/unit/solver/line.test.ts`:
        - Hand-built Draw 1 position, recycle case:
          - the only playable card lies below the waste top and the stock is empty;
          - the line recycles (a `recycled` event during replay) and draws until that card is the
            waste top, before moving it.
        - Hand-built position, root safe move: an Ace buried in the stock is a root `safe()` send.
          The line starts with the draws that expose it, then a `move` to its foundation.
        - Mid-game: for each `MIDGAME_POSITIONS` entry, first assert the precondition (a fresh
          `solve` at its recorded budget is `win`), then that its own line replays to won. A failing
          precondition means the pin is wrong, not the solver: re-pick it.
        - `expandLine` throws an `Error` for an abstract move naming a card not in the talon, and for
          a move the engine refuses.
        - Two solves of the same position give identical lines.
    - **Verify:**
      - `rtk npx vitest run tests/unit/solver` passes.
      - Temporarily emitting `autoFoundation` for foundation plays fails the no-`autoFoundation`
        assertion, and is then reverted.

- [x] 2.3 Derive the solver hint from the winning line
    - **Implements:** L "Solver hint from the winning line" *(KS-AST-03)*; D5.
    - **Depends on:** task 2.2 (`MIDGAME_POSITIONS`).
    - **References:** `src/domain/assist.ts` `MoveHint`/`Hint`; the `specs/domain/assistance`
      "Hint priority" requirement (the fallback it hands over to); R§6.1.
    - **Files:**
      - `src/solver/hint.ts` (new): `solverHint(state, budget)` and the exported `SolverHint` type.
      - `src/solver/README.md`: add the `hint.ts` bullet.
    - **Tests:** `tests/unit/solver/hint.test.ts`, using the `MIDGAME_POSITIONS` entries pinned at
      budget 3,000 (task 2.2):
      - For such a position whose line starts with a `move`:
        - the hint is `{ kind: 'move', command }`, equal to the first command of a fresh solve's
          line at 3,000;
        - its `cards` equal `groupAt(state, from, index)`;
        - `applyCommand` accepts the hinted command (no `rejected` event).
      - The pinned position whose line starts with a draw while the stock holds cards gives
        `{ kind: 'draw' }`.
      - A hand-built position whose line starts with a draw while the stock is empty gives
        `{ kind: 'recycle' }`.
      - These all give `undefined`:
        - the corpus `loss` seed (91);
        - a corpus `unknown` seed at budget 3,000 (D2: every 5,000 `unknown` stays `unknown`);
        - a Draw 3 position;
        - a Vegas position;
        - a won position.
      - A compile-time assertion shows the domain `Hint` is assignable to `SolverHint`.
    - **Verify:** `rtk npx vitest run tests/unit/solver/hint.test.ts` passes.

- [x] 2.4 Select a winnable deal by reject sampling
    - **Implements:** L "Winnable selection by reject sampling" (every scenario, including "An
      empty seed list is refused") *(KS-DEAL-03, KS-DEAL-05)*; D4.
    - **References:** mockup attempt loop `:1268-1278`; R§4.3; card-engine D4 (why seeds are
      supplied and never generated here).
    - **Files:**
      - `src/solver/winnable.ts` (new): `findWinnable(seeds, budget, onAttempt?)`, returning
        `{ seed, verdict: 'win' | 'random', attempts }`.
      - `src/solver/README.md`: add the `winnable.ts` bullet.
    - **Tests:** `tests/unit/solver/winnable.test.ts`, with seeds taken from `solverCorpus.ts`:
      - `[winSeed]` gives `{ seed: winSeed, verdict: 'win', attempts: 1 }`, and `onAttempt` is
        called with `[1]`.
      - `[lossSeed, unknownSeed, winSeed, otherWin]` gives `winSeed` with `attempts: 3`, and
        `onAttempt` calls `[1, 2, 3]`: never 4, since attempt 4 is not tried.
      - `onAttempt(k)` fires before attempt *k* is solved: with `[winSeed]`, the callback observes
        that `findWinnable` has not returned yet (e.g. it records a flag that is set only after the
        call returns).
      - `[lossSeed, unknownSeed]` gives `{ seed: unknownSeed, verdict: 'random', attempts: 2 }`, and
        `onAttempt` calls `[1, 2]`.
      - Budget pass-through: `[winSeed]` at budget 1 gives `verdict: 'random'`.
      - Empty seeds throw a `RangeError`.
      - The same arguments give equal results.
    - **Verify:** `rtk npx vitest run tests/unit/solver/winnable.test.ts` passes.

## 3. Worker boundary

- [x] 3.1 Define the message protocol and its request handler
    - **Implements:** L "Background-thread message interface" *(KS-DEAL-04, KS-DEAL-10)*; D6.
    - **Files:**
      - `src/solver/protocol.ts` (new): the `SolverRequest` and `SolverResponse` unions, plus
        `handleRequest(request, post)`.
      - `src/solver/README.md`: add the `protocol.ts` bullet, and drop `solve` from the documented
        messages.
      - `docs/spec/phased-design.md`:
        - §3.1 layout: the solver modules, and the worker messages `findWinnable` and `hint` (no
          `solve`);
        - the §7 Phase 3 bullet listing the worker messages (currently `findWinnable`, `solve`,
          `hint`): drop `solve`.
    - **Tests:** `tests/unit/solver/protocol.test.ts`, calling `handleRequest` with a collecting
      `post`:
      - a `findWinnable` request over `[lossSeed, winSeed]`:
        - posts `progress` for attempt 1, then for attempt 2 (each as it starts, D4), then one
          `findWinnable` reply, and no progress for an attempt 3;
        - every message carries the request id;
        - the reply matches `findWinnable`.
      - a `hint` request posts exactly one `hint` reply with the request id, and the hint equals
        `solverHint`;
      - a `hint` request for a Draw 3 state replies with `hint: undefined`;
      - a request whose `state` went through `structuredClone` gives the same reply as the original;
      - the same request posted twice, with another request between them, gives replies that differ
        only in id.
    - **Verify:** `rtk npx vitest run tests/unit/solver/protocol.test.ts tests/unit/repo` passes.

- [x] 3.2 Bind the protocol to a module Web Worker and prove an in-process round-trip
    - **Implements:**
      - T "Test suites separated by execution layer" (scenario "A worker round-trips in-process");
      - L "Background-thread message interface" (scenarios "A selection request round-trips" and
        "A hint request round-trips");
      - D6, D11.
    - **Files:**
      - `src/solver/solver.worker.ts` (new): the three-line binding using `self.onmessage =` and
        `self.postMessage`.
      - `src/solver/README.md`: add the `solver.worker.ts` bullet.
      - `package.json` and `package-lock.json`: devDependency `@vitest/web-worker` pinned at
        exactly `5.0.1`.
      - `vite.config.ts`: `worker: { format: 'es' }`.
      - `vitest.config.ts`: add `src/solver/solver.worker.ts` to `coverage.exclude` **only if** the
        spike shows v8 does not record it.
      - `tests/README.md`: document the node environment for worker tests, the in-process worker,
        and the spike's coverage finding.
      - `docs/spec/phased-design.md` §6: the worker format is set explicitly to `es`, since Vite 8
        defaults to `iife`.
    - **Tests:** `tests/unit/solver/worker.test.ts` imports `@vitest/web-worker` and constructs
      `new Worker(new URL('../../../src/solver/solver.worker.ts', import.meta.url), { type: 'module' })`.
      - A `findWinnable` request with id 7 gets progress messages, then a reply with id 7 whose
        seed, verdict and attempts equal the direct `findWinnable` result.
      - A `hint` request gets a reply with the same id, equal to `solverHint`.
      - `terminate()` stops further replies.
    - **Details:**
      - Start with the spike (D11): round-trip, then `rtk npm run test:coverage`, and check that
        `solver.worker.ts` appears in the report.
      - `rtk npm run build` must still pass. Nothing imports the worker yet, so the build proves only
        that the config is valid.
    - **Verify:**
      - `rtk npx vitest run tests/unit/solver/worker.test.ts` passes.
      - `rtk npm run test:coverage` exits zero.
      - `rtk npm run typecheck` and `rtk npm run build` pass.
      - `tests/unit/repo/configContract.test.ts` still passes.

## 4. Deal service (`src/features/deal`)

- [x] 4.1 Derive the Daily v1 date key and seeds, and pin golden dates
    - **Implements:** F "Daily deal v1" (every scenario except "The setting does not affect the
      Daily deal", which is task 4.3) *(KS-DEAL-07)*; D7.
    - **References:** mockup `todayKey` `:776` and seed formula `:1271`; R§3.4; spec §2 (Daily row)
      and acceptance scenario 6.
    - **Files:**
      - `src/features/deal/daily.ts` (new): `utcDayKey`, `dailySeed`, `dailySeeds` and `DAILY_V1`.
      - `tests/fixtures/dailyGolden.ts` (new): the 10 `{ day, seed, attempts }` entries of the D7
        table, with a comment naming the D2 recipe that produced them.
      - `docs/spec/research.md` §3.4: record daily v1 (UTC `YYYY-MM-DD`, the formula, 20,000
        nodes, 40 attempts, always verified), replacing "local date" as the product behaviour.
      - `docs/spec/phased-design.md` §4 Winnable selection row: the Daily formula written out in
        place of `hash(utcDate, k)`.
      - `tests/README.md`: list the new fixture.
    - **Tests:** `tests/unit/features/deal/daily.test.ts`
      - `utcDayKey(new Date('2026-09-24T23:59:59.999Z'))` is `'2026-09-24'`.
        `utcDayKey(new Date('2026-09-25T00:00:00.000Z'))` is `'2026-09-25'`.
      - With `process.env.TZ` set to `'Pacific/Kiritimati'` and then `'Pacific/Pago_Pago'`
        (restored in `afterEach`), the key for one instant is identical. A sanity assertion shows
        the two local `getDate()` values differ for that instant.
      - Two instants of the same UTC day whose local dates differ under one of those zones give the
        same key.
      - `dailySeed('2026-09-24', 1) === (20260924 * 131 + 7919) >>> 0`.
      - `dailySeeds(day)` holds 40 distinct seeds.
      - Two consecutive days share no seed.
      - Golden, run as a phase gate:
        - for each fixture day, `findWinnable(dailySeeds(day), DAILY_V1.budget)` returns the pinned
          `{ seed, verdict: 'win', attempts }`;
        - `encodeDealCode(seed, 'daily')` round-trips.
    - **Details:**
      - Use the 10 dates and reference values of the D7 table (month ends, year ends, and two
        dates that need a second attempt).
      - Compute the golden entries with `findWinnable(dailySeeds(day), DAILY_V1.budget)`; they must
        equal the D7 table. On any mismatch, stop and report; re-run the D2 recipe (Daily step) to
        see which side differs, and never edit the table to match the new code.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal/daily.test.ts` passes.

- [x] 4.2 Build the solver client with lazy start, request ids and cancellation rules
    - **Implements:**
      - F "A newer request wins" (client-level rules);
      - F "The search never runs on the input thread" (scenario "A failed background thread still
        deals", client part: failures settle as `failed`);
      - P "The features layer never loads solver code on the input thread" (the client
        imports only types);
      - *KS-DEAL-10*; D8, D11.
    - **Files:**
      - `src/features/deal/solverClient.ts` (new): `createSolverClient(createWorker?)` with
        `findWinnable(seeds, budget, onProgress)`, `hint(state, budget, timeoutMs)` and `dispose()`.
        It settles with `{ status: 'ok' | 'cancelled' | 'timeout' | 'busy' | 'failed' }` results
        and never rejects.
      - `src/features/README.md`: add the `deal/solverClient.ts` entry.
    - **Tests:** `tests/unit/features/deal/solverClient.test.ts`
      - With the **real** worker (`@vitest/web-worker`) and the **default factory**:
        - no worker exists before the first request (spy on the factory, wrapping the default);
        - `findWinnable` resolves `ok` with the direct `findWinnable` result;
        - progress callbacks arrive in order;
        - a second `findWinnable` started before the first settles resolves the first as
          `cancelled`, and creates exactly one new worker;
        - a second `hint` before the first settles resolves the first as `cancelled`;
        - `hint` during a pending `findWinnable` resolves `busy` at once, and the deal still
          resolves `ok`;
        - `dispose()` terminates the worker, and settles anything pending as `cancelled`.
      - With a **silent stub** (`postMessage` and `terminate` that never reply) and Vitest fake
        timers:
        - `hint` resolves `timeout` after `timeoutMs`;
        - the stub is not terminated;
        - a later reply for that id is ignored.
      - With a stub that dispatches `error`, every pending request resolves `failed`, and the next
        request uses a fresh worker. A factory that throws resolves `failed`.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal/solverClient.test.ts` passes, and
      `rtk npm run lint` passes, which proves the features import rule.

- [x] 4.3 Deal per mode with provenance, overlay timing, cancellation and fallback
    - **Implements:**
      - F "Deals per mode record their provenance";
      - F "Daily deal v1" (scenario "The setting does not affect the Daily deal");
      - F "Dealing progress and overlay timing";
      - F "A newer request wins" (deal level);
      - F "The search never runs on the input thread";
      - *KS-DEAL-02…07, KS-DEAL-10*; D4, D7, D8, D9.
    - **References:** mockup attempt loop and overlay `:1252-1285` (one 160 ms timer per request);
      spec §4.1 and §6 ("Winnable deals only").
    - **Files:**
      - `src/features/deal/dealService.ts` (new): `createDealService(options)` with
        `deal(request, onProgress?)` and `dispose()`, plus the constants `WINNABLE_BUDGET`,
        `MAX_ATTEMPTS` and `HINT_BUDGET`. `hint` is added in task 4.4.
      - `src/features/README.md`: add the `deal/dealService.ts` entry.
    - **Tests:** `tests/unit/features/deal/dealService.deal.test.ts`, with the real worker unless
      stated otherwise. `seedSource` wraps `mulberry32(fixed)`, and `now` returns a fixed instant.
      - Draw 1 with `winnableOnly: true`:
        - the state equals `dealFromSeed(seed, 'draw1', { verdict: 'win', attempts })`;
        - `seed` and `attempts` match `findWinnable` over the same 40 seeds;
        - `encodeDealCode(state.seed, 'draw1')` decodes and deals to the same layout.
      - Draw 3, Vegas, and Draw 1 with `winnableOnly: false`:
        - the result is `verdict: 'random'`, `attempts: 1`, with the first seed from `seedSource`;
        - the worker factory is never called.
      - Daily with `winnableOnly: false`: the state equals the golden entry for `now`'s UTC day,
        with `verdict: 'win'`.
      - Progress with the real worker, where the first seeds are known failures and `overlayDelayMs`
        is large: attempts arrive in order and `overlay` stays false.
      - Overlay with the silent stub and fake timers:
        - no `overlay: true` before `overlayDelayMs`;
        - `overlay: true` at `overlayDelayMs`;
        - nothing after `dispose` or cancellation.
      - Two deals in a row: the first resolves `{ status: 'cancelled' }` and only the second
        resolves `dealt`.
      - Fallback with an error stub:
        - Draw 1 gives a random deal of the first fresh seed, `attempts: 1`;
        - Daily gives `dailySeed(day, 1)` with `verdict: 'random'`.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

- [x] 4.4 Answer hints with the solver and the heuristic fallback
    - **Implements:**
      - F "Hints use the solver with a heuristic fallback";
      - F "A newer request wins" (scenarios "A newer hint replaces an older one" and "A hint never
        cancels a deal");
      - *KS-AST-03, KS-AST-02*; D5, D9.
    - **References:** `specs/domain/assistance` "Hint priority"; spec §4.5; R§6.1.
    - **Files:**
      - `src/features/deal/dealService.ts`: `hint(state)`, returning
        `{ status: 'hint', source: 'solver' | 'heuristic', hint } | { status: 'none' } | { status: 'cancelled' }`
        (D9).
      - `src/features/README.md`: describe the hint entry point.
      - `docs/spec/phased-design.md` §4 Hint row: the fallback covers every non-win verdict, a
        timeout, a failure and a hint asked while a deal is pending. Draw 3 and Vegas use the
        heuristic only.
    - **Tests:** `tests/unit/features/deal/dealService.hint.test.ts`
      - Real worker, mid-line Draw 1 position: `source: 'solver'`, and the hint equals `solverHint`.
      - Draw 3 and Vegas positions: `source: 'heuristic'`, equal to the domain `hint(state)`. A
        factory spy shows no worker was created.
      - The corpus `loss` position: `source: 'heuristic'`.
      - A won position gives `{ status: 'none' }`.
      - A position with no heuristic move and no solver suggestion gives `{ status: 'none' }`.
      - Silent stub with fake timers: after `hintTimeoutMs` the answer is heuristic.
      - A hint during a pending deal is heuristic, and the deal still resolves `dealt`.
      - Two hints in a row: only the second is answered.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

## 5. Benchmark and phase gates in the docs

- [x] 5.1 Add the informational latency benchmark and move the browser checks to Phase 5
    - **Implements:** T "Informational solver benchmark outside the validation gate" *(KS-PERF-02)*;
      D11.
    - **Files:**
      - `tests/bench/winnable.bench.ts` (new): runs `findWinnable` over fixed seed batches of 40
        (derived from `mulberry32` of fixed bases) at 5,000 nodes, and reports median and p95 using
        Vitest's bench statistics.
      - `package.json`: a `"bench": "vitest bench --run"` script. `validate` is unchanged.
      - `tests/README.md`: the `bench/` layer, and the fact that it is not in `test:unit`, the hooks
        or CI.
      - `AGENTS.md`:
        - add `rtk npm run bench` to "Runtime and commands";
        - "Repository state" records the Phase 3 solver and deal service;
        - "Repository layout" notes that the solver and features layers are implemented.
      - `docs/spec/phased-design.md`:
        - §7 Phase 3 "done when": the corpus matches; the in-process worker round-trip works in
          Vitest; the Daily key matches across time zones and golden dates; the benchmark reports
          against the 300 ms target but is not a gate.
        - §7 Phase 5 "done when" gains: *"A Playwright test starts a Winnable Draw 1 deal through
          the real solver worker in Chromium (browser worker round-trip, KS-DEAL-03/10) and reports
          its latency against KS-PERF-02 (300 ms median target, reported, not gated)."*
        - §7 Phase 9 notes that KS-PERF-02 on a mid-range phone is a documented manual check.
    - **Tests:** the benchmark itself. It must exit zero whatever the timings.
    - **Verify:**
      - `rtk npm run bench` prints the statistics and exits zero.
      - `rtk npm run test:unit` does not run the benchmark.
      - `grep -n "Chromium on CI" docs/spec/phased-design.md` finds no gating statement for Phase 3.

## 6. Integration check

- [x] 6.1 Verify the whole change end to end
    - **Implements:** no new requirement. This task is the integration evidence for constitution
      principles 1, 2 and 9, and for every KS id this change claims (*KS-DEAL-03…07, KS-DEAL-10,
      KS-AST-03, KS-PERF-02*).
    - **Files:** none expected. Fix only what the checks reveal, within the owning task's scope.
    - **Checks:**
      - `rtk npm run test:coverage` exits zero, and every new `src/solver` and `src/features/deal`
        file is listed at or above the 80% floor.
      - `rtk npm run validate` passes. `rtk npm run e2e` still passes, since behaviour is unchanged.
      - `openspec validate add-solver-deal-service --strict` passes.
      - Every symbol named in `src/solver/README.md` and `src/features/README.md` is a real export.
      - No document under `docs/spec/` still describes any of these:
        - a `solve` worker message;
        - a Daily seed from the local date;
        - `hash(utcDate, k)` without its formula;
        - a Phase 3 Chromium latency gate.
      - Each claimed KS id maps to at least one named test in this change's tasks.
    - **Verify:** all checks above pass. Record the commands and their results in this task entry.
    - **Results (2026-09-24):**
      - `rtk npm run test:coverage`: exit 0, 857 tests then, 859 after the fix below (1 skipped by design);
        global 98.7% statements / 97.1% branches. Every new `src/solver` and `src/features/deal` file is at or
        above 80% on all four metrics, after one fix: `src/solver/hint.ts` was at 77.77% branches (its two
        defensive throws were untested), so `tests/unit/solver/hint.defensive.test.ts` was added (mocks
        `solve`), taking `hint.ts` to 100%.
      - `rtk npm run validate`: format:check, typecheck, test:unit and build pass. `eslint .` also lints a
        leftover local agent worktree (`.claude/worktrees/agent-*`, hidden by `.git/info/exclude`, not part of
        the repository) and fails there; with `--ignore-pattern '.claude/worktrees/**'` lint exits 0.
      - `rtk npm run e2e`: exit 0, 6 tests on all 6 projects.
      - `openspec validate add-solver-deal-service --strict`: valid.
      - README symbols: every symbol in `src/solver/README.md` and `src/features/README.md` is a real export.
      - `docs/spec/`: no `solve` worker message, no local-date Daily seed, no bare `hash(utcDate, k)`, no
        Phase 3 Chromium latency gate.
      - KS-DEAL-03…07, KS-DEAL-10, KS-AST-03 and KS-PERF-02 each map to named tests that exist.
      - **Follow-up fixes (2026-09-24, after branch review and a failing full `validate`):**
        - `eslint.config.js` ignores `.claude/worktrees`, and the leftover spike worktree was removed, so the full
          `rtk npm run validate` passes unmodified (it had failed on that worktree's files).
        - L2: `solverClient` fails on a malformed worker reply (`isSolverResponse` guard).
        - L3: a heuristic-only or won-position hint cancels a pending solver hint at once (`cancelHints`).
        - L4: `tests/unit/repo/featuresSolverImport.test.ts` guards the features-layer solver import rule; the
          domain, solver and features lint overrides now cover `.tsx`.
        - L5: the Daily time-zone test also compares the deal code.
