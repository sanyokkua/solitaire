# Design

## Context

A design document is warranted for four reasons:
- the change crosses layer boundaries (`domain` → `solver` → `features`);
- it introduces a Web Worker boundary;
- it narrows an existing constitution guard (the reserved layers);
- it pins an algorithm, "daily v1", that must never drift.

Constraints that shape the approach:
- `src/domain` is complete and frozen for this change. The relevant pieces:
  - `applyCommand` never throws, and it returns the input by reference when it refuses a command;
  - `dealFromSeed(seed, mode, { verdict?, attempts? })`;
  - `hint`, `groupAt`, `canRecycle`, `passLimit` and `cryptoSeed(source?)`.
- Card-engine D4 says only Phase 3's deal service calls `cryptoSeed`. Card-engine D18 says the
  deal pipeline is value-for-value compatible with the mockup, which is what the solver corpus
  relies on.
- `tests/unit/repo/reservedLayers.test.ts` requires `src/solver` and `src/features` to contain
  only `README.md`.
- `domainPurity.test.ts` guards `src/domain` only. No check covers `src/solver`.
- Vitest runs under jsdom, with no worker support installed.
- The tsconfig uses the `DOM` lib, not `WebWorker`. `self.onmessage = …` and `self.postMessage(m)`
  both typecheck there.
- Vite 8 bundles workers as `iife` by default (`worker.format`). `phased-design.md` §6 assumes ES
  modules.
- Nothing imports the deal service in Phase 3, so `vite build` never follows the worker URL. A test
  must follow it instead.
- User decisions:
  - Phase 3 is verified with Node unit and integration tests, keeping mocks to a minimum.
  - The 300 ms target (*KS-PERF-02*) is reported, not gated.
  - The browser round-trip and the Chromium latency check move to Phase 5.
- Reference material:
  - the mockup solver, `docs/spec/mockup/klondike-mockup.html:664-758`;
  - the mockup attempt loop, overlay and chip, `:1235-1296`;
  - `todayKey`, `:776`;
  - R§3.4, R§4.4 and R§4.5;
  - `phased-design.md` §4, rows Winnable selection, Solver and Hint.

## Goals / Non-Goals

**Goals:**
- Proof results identical to the reference solver.
- A winning line the engine accepts.
- Deterministic selection for a given seed list.
- No search on the input thread.
- One small, promise-based service API for Phase 4 to call.

**Non-Goals:**
- Faster search than the reference, or a better move set.
- A Draw 3 or Vegas solver, or a background pool of deals (Phase 11).
- Redux integration, overlay rendering or hint rendering.
- Any solver-backed dead-end check.
- A `solve` worker message.

## Decisions

### D1 — The solver is a faithful port, made iterative

`src/solver/solver.ts` ports `solveDraw1` behaviour for behaviour. The things that must match:

**State.** Each column is `{ cards, down }`: `cards` holds every card id of the column, bottom
first, and the first `down` of them are face down (mockup `:752`). A column index in the solver is
therefore the same number as the engine's `move.index`. The foundations are held as heights.

**The talon is an ordered array, keyed as a set.** The talon starts as `[...stock, ...waste]` in
the engine's array order (mockup `:753`), and cards leave it by in-place splice (`:690`, `:730`,
`:732`). Only the canonical key treats it as a set. The array order matters: `safe()` scans the
talon in that order, and the talon moves are generated in that order, so it fixes the exploration
order and therefore the corpus.

**Canonical key** (`:694`). It joins three parts with `|`:
1. the foundation heights joined with `.`;
2. each column written as `down:` followed by its card ids joined with `,`, with the column strings
   sorted and joined with `/`;
3. the talon card ids sorted numerically and joined with `,`.

**Safe moves** (`:676-692`). `safe()` runs at the start of every node, the root included. It
repeats until nothing changes. Each pass first checks the face-up top of each column from 0 to 6,
then scans the whole talon array. The rule is the domain's `isSafe` (`src/domain/assist.ts:20`,
assistance "Safe foundation moves"). The solver evaluates it on its own foundation heights instead
of calling `isSafe` on a `GameState`, because building a `GameState` per node would dominate the
search cost; the corpus pins the two as equivalent in effect.

**Move generation** (`gen()`, `:695-727`). Each move gets a priority, listed from first tried to
last. "Uncovered card" means the card just below the moved run; a partial run (one that does not
start at the column's first face-up card) is generated only when its uncovered card is
foundation-ready (`:706`).

| Priority | Move | Mockup |
| --- | --- | --- |
| 0 | a column's face-up top → foundation | `:698-700` |
| 1 | a talon card → foundation | `:701` |
| 2 | a run starting at the column's first face-up card, with face-down cards below it, onto a fitting non-empty column, or (a King) into the first empty column | `:711-712` |
| 3 | a talon card onto a fitting non-empty column, or (a King) into the first empty column | `:716-720` |
| 4 | a partial run onto a fitting non-empty column | `:712` |
| 5 | a King-headed partial run into the first empty column | `:711` |
| 6 | a run starting at the first card of a column with no face-down cards, onto a fitting non-empty column | `:712` |
| 7 | a foundation top → a fitting non-empty column | `:721-725` |

Moves are sorted by priority with a stable sort (`:726`), so moves of equal priority keep their
generation order: columns in order, each column's runs from the lowest face-up card up, each
destination column in order. Two moves are pruned:
- moving a King that is the first card of a column with no face-down cards (`:707`);
- moving into any empty column other than the first (`:697`).

**Node counting.** At each node, in this order:
1. apply `safe()`;
2. check for a win;
3. if the key is already in the visited set, go no further;
4. add the key;
5. stop with `unknown` if `++nodes > budget`.

**Changed from the mockup: the recursion.** The mockup recurses once per node, and a single branch
can be thousands of moves deep at a 20,000 budget. The port uses an explicit stack. Each frame
holds the node's state, its sorted move list, the index of the next move to try, and the abstract
moves that led to it: the branch move plus that node's `safe()` sends. Exploration order and node
counting are unchanged, and the corpus proves it (D2).

**Result.** `solve(state, budget)` returns
`{ verdict: SolveVerdict; nodes: number; line?: readonly Command[] }`, where
`type SolveVerdict = 'win' | 'loss' | 'unknown'`. The type is deliberately separate from
`GameState['verdict']`, which is `'win' | 'random'`. When the budget stops the search, `nodes` is
`budget + 1`, as in the reference.

**Positions it will not search.** A position with `draw !== 1`, or with a finite
`passLimit(mode)` (`src/domain/rules.ts:113`), returns `{ verdict: 'unknown', nodes: 0 }`. A
position for which `isWon` (`rules.ts:122`) holds returns `{ verdict: 'win', nodes: 0, line: [] }`.

**What the verdicts mean.** `loss` means only that the search ran out of moves to try. The search
also knows the face-down cards. Both facts are documented in `src/solver/README.md`.

*Alternative considered:* keep the recursion. Rejected because of the risk of exhausting the stack
inside a worker at the Daily budget.

### D2 — The corpus is pinned from the reference, seed by seed

This extends card-engine D18. `tests/fixtures/solverCorpus.ts` stores a 200-character string. The
character at position *i* is the verdict for seed *i*+1: `w`, `l` or `u`. Each seed is dealt with
`dealFromSeed(seed, 'draw1')` and searched at 5,000 nodes.

**Reference recipe.** Every task that needs reference values follows this recipe. It is a throwaway
Node script, never committed, so no production or test code copies the mockup (constitution
principle 10):
1. Copy verbatim from `docs/spec/mockup/klondike-mockup.html` into a scratch `.mjs` file:
   `suitOf`, `rankOf`, `isRed` (`:630-632`), `mulberry32` (`:634-641`), `shuffle` (`:647-654`),
   `dealFrom` (`:655-662`) and `solveDraw1` (`:667-758`). No adaptation is needed: `dealFrom`
   returns exactly the `tableau`/`stock`/`waste`/`found` shape `solveDraw1` reads.
2. Draw 1 corpus: `solveDraw1(dealFrom(shuffle(mulberry32(seed))), 5000)` for seeds 1–200.
3. Daily v1 (D7): the candidate for attempt *k* is `dealFrom(shuffle(mulberry32(dailySeed(day, k))))`,
   solved at 20,000.

**Reference values, recorded when this change was reviewed** (Node 24, the recipe above, run twice
with identical verdicts and node counts):
- Totals 142 `w` / 1 `l` / 57 `u`. The only `loss` is seed 91.
- The string:
  `wwuwwuuwwwwuwwwuwwwwuuuwuwwwwuwwwwwuwwuwwwuuwuuwwuwwwuwwwwuwwwwwuwuwwuwwuuwwwwwuwwwwwwwwwwlwwuuwuwuwwwwwwwuwwwuuwuwwuwwwwwwwuuwuwwwwwuwwwwwuwwuwwwwuwwuwuuwwwwuwwwwuwuwwuwuwuwwuwwwwuwwwwuuwwuwwwwwwuuww`
- The wins with the fewest nodes, for the budget-boundary test: seed 19 (26 nodes), seed 109 (27),
  seeds 155 and 156 (30).
- At 3,000 nodes: 136 wins, 1 loss, 63 unknown. Every 3,000 win is a 5,000 win, and every 5,000
  `unknown` stays `unknown` at 3,000.
- Timing: 20 ms mean and 93 ms max per seed at 5,000 (4 s for the corpus); 12 ms mean and 46 ms
  max at 3,000.

`tests/fixtures/solverCorpus.ts` holds the string, with a comment recording this recipe and the
totals. The implementing task regenerates it with the recipe and must get the same string; if not,
it stops and reports rather than editing the fixture.

A per-seed string catches compensating drift that matching totals would hide. The corpus test runs
every seed in one pass per seed that also checks the line (D3). Sized from the timing above, it
uses `it.each` over seed ranges of 50 with a 30 s timeout per range, which leaves room for coverage
instrumentation and slow CI runners.

### D3 — The winning line is made of player commands

While searching, the solver records abstract moves:
- `{ t: 'cf', col }` tableau to foundation;
- `{ t: 'tf', card }` talon card to foundation;
- `{ t: 'cc', from, index, to }` tableau to tableau;
- `{ t: 'tc', card, to }` talon card to tableau;
- `{ t: 'fc', suit, to }` foundation to tableau.

Talon moves name the **card id**, not a position in the talon, because splicing makes positions
unstable.

`src/solver/line.ts` `expandLine(state, moves): Command[]` replays these moves through
`applyCommand`:
- **Talon card** (`tf` and `tc`): emit `{ type: 'draw' }` until the card is the waste top. When the
  stock is empty, a draw recycles; Draw 1 passes are unlimited, so that is always allowed. Then emit
  a `move` from `{ pile: 'waste' }`.
- **Foundation plays** (`cf`, `tf`): a `move` to `{ pile: 'foundation', suit }` with the source top
  index, never `autoFoundation`. The line is what a player does, so replaying it through real input
  in later end-to-end tests maps one to one.
- **Tableau moves** (`cc`): a `move` with the same column and index numbers (D1 State). The engine
  flips cards the same way the reference's `fix()` does.
- **Foundation to tableau** (`fc`): a `move` from `{ pile: 'foundation', suit }` at that
  foundation's top index.

The draw loop is bounded by the size of the talon plus one. If a command is refused, or the loop
runs past its bound, the line is invalid; `expandLine` throws an `Error`, because that is a
programming error, not a game state. Tests assert that this never happens across the corpus, in
the same per-seed pass that checks the verdict (D2).

The line is valid only while no automatic safe moves happen between commands. Hints re-solve from
the current position every time, so this never matters for play.

*Alternative considered:* commands that address talon cards directly. Rejected because the engine
has no such command, and adding one would change the frozen domain.

### D4 — Winnable selection is pure and seed-driven

`src/solver/winnable.ts` defines
`findWinnable(seeds, budget, onAttempt?) → { seed, verdict: 'win' | 'random', attempts }`:
- it deals each seed with `dealFromSeed(seed, 'draw1')` and calls `solve`;
- it calls `onAttempt(k)` just **before** solving attempt *k* (from 1), so the number reported is
  always the attempt being tried and never one that is not then tried; the mockup likewise only
  advances its counter when another attempt follows (`:1276`);
- it returns the first win, otherwise the last seed marked `random` with `attempts = seeds.length`;
- an empty `seeds` array throws a `RangeError`: it is a programming error, and there is no seed to
  return.

It returns the seed, not a `GameState`. The main thread builds the state with
`dealFromSeed(seed, mode, { verdict, attempts })`. This keeps the messages small, puts provenance
in exactly one place, and makes the fallback path identical. Selecting in `draw1` and dealing in
`daily` gives the same layout, since the layout depends only on the seed.

Seeds come from the caller (D8), so the solver layer never touches `crypto`, and card-engine D4
holds.

*Alternative considered:* derive attempt seeds inside the worker from one base seed. Rejected
because it adds a derivation rule nobody asked for.

### D5 — The solver hint reuses the domain hint shape

`src/solver/hint.ts` defines `solverHint(state, budget): SolverHint | undefined`, where:

```ts
type SolverHint = Omit<MoveHint, 'priority'> | { kind: 'draw' } | { kind: 'recycle' };
```

Every domain `Hint` is assignable to `SolverHint`, so later UI code handles a single shape.

- The suggestion is the first command of the line from `solve(state, budget)`.
- A `move` becomes `{ kind: 'move', command, cards: groupAt(state, from, index) }`. `groupAt`
  (`src/domain/rules.ts:43`) returns `undefined` only for a move the engine would refuse, which a
  valid line never contains, so that case throws an `Error` like any other invalid line (D3).
- A `draw` becomes `{ kind: 'recycle' }` when the stock is empty, otherwise `{ kind: 'draw' }`.
- Any verdict other than `win`, or an empty line, gives `undefined`.

Only the first move is needed, but expanding the whole line is cheap. It also reuses the code path
the corpus tests already exercise.

*Alternative considered:* a numeric priority for solver hints, such as 0. Rejected because it
would mean changing the domain `HintPriority` union.

### D6 — Worker protocol and binding

`src/solver/protocol.ts` holds the types and one function:

```ts
type SolverRequest =
    | { id: number; type: 'findWinnable'; seeds: readonly number[]; budget: number }
    | { id: number; type: 'hint'; state: GameState; budget: number };

type SolverResponse =
    | { id: number; type: 'progress'; attempt: number } // posted as attempt `attempt` starts (D4)
    | { id: number; type: 'findWinnable'; seed: number; verdict: 'win' | 'random'; attempts: number }
    | { id: number; type: 'hint'; hint: SolverHint | undefined };

function handleRequest(request: SolverRequest, post: (response: SolverResponse) => void): void;
```

`src/solver/solver.worker.ts` is only the binding:

```ts
self.onmessage = (e: MessageEvent<SolverRequest>) => {
    handleRequest(e.data, (m) => {
        self.postMessage(m);
    });
};
```

It holds no state. `GameState` is plain readonly data, so structured clone carries it unchanged.
`vite.config.ts` gains `worker: { format: 'es' }`, and `phased-design.md` §6 is corrected to match.

The `solve` message in `phased-design.md` is dropped. Nothing in v1 would send it: dead-end
detection stays heuristic, and the end-to-end autoplay uses a committed line.

### D7 — Daily v1

`src/features/deal/daily.ts` exports:
- `utcDayKey(date: Date): string`, which returns `YYYY-MM-DD` built from `getUTCFullYear`,
  `getUTCMonth` and `getUTCDate`;
- `dailySeed(dayKey, attempt)`, which returns `((yyyymmdd * 131 + attempt * 7919) >>> 0)`;
- `dailySeeds(dayKey)`, the list for attempts 1 to 40;
- `DAILY_V1 = { budget: 20_000, maxAttempts: 40 }`.

The formula is the mockup's (`:1268-1275`, R§3.4), applied to the UTC date instead of the local
one, with the 20,000 budget from `phased-design.md` §4 instead of the mockup's 5,000, and always
verified, where the mockup verifies only with the setting on (`:1252`). The mockup passes the sum
to `mulberry32`, whose internal `|= 0` keeps the same 32 bits that `>>> 0` does, so the seeds are
bit-identical.

**No two candidates collide**, on any dates. Two candidates are equal only when
`131 × (D₁ − D₂) = 7919 × (k₂ − k₁)`. Since 131 and 7,919 are coprime, `k₂ − k₁` would have to be a
multiple of 131, which is impossible for attempts 1 to 40. There is no 32-bit wrap-around while
`D × 131 + 40 × 7919 < 2³²`, which holds for every date before the year 3278.

A golden test pins the chosen seed and attempt count for 10 fixed dates. The fixture is computed
through `findWinnable` itself and must equal the reference values below, produced with the D2
recipe. From then on, any change to the solver, the deal or the formula that would alter a
published Daily fails that test.

| Day | Attempts | Seed | Reference nodes |
| --- | --- | --- | --- |
| 2026-01-01 | 1 | 2654081150 | 52 |
| 2026-02-28 | 1 | 2654097787 | 48 |
| 2026-03-31 | 2 | 2654119199 | 55 |
| 2026-06-15 | 1 | 2654148484 | 60 |
| 2026-09-24 | 1 | 2654188963 | 45 |
| 2026-12-31 | 1 | 2654229180 | 123 |
| 2027-01-01 | 1 | 2655391150 | 263 |
| 2027-04-30 | 1 | 2655434249 | 40 |
| 2027-07-04 | 2 | 2655478062 | 109 |
| 2027-12-31 | 1 | 2655539180 | 895 |

The whole golden set takes about 0.35 s with the reference solver; the failed first attempts of
2026-03-31 and 2027-07-04 cost most of it.

**Fallbacks.** When all 40 attempts fail, which at 20k has probability far below 10⁻²⁰, the result
is `findWinnable`'s own: the 40th candidate, marked `random`, with 40 attempts. When the worker
fails, the service deals `dailySeed(day, 1)`, marked `random`, with 1 attempt (D9).

*Alternatives considered:*
- A cryptographic hash of `daily-v1:YYYY-MM-DD:k`. Rejected: no benefit over the documented
  formula, and more code.
- Shipping a precomputed table. Deferred: the golden test gives the same protection against drift.

### D8 — The solver client and which request wins

`src/features/deal/solverClient.ts` defines
`createSolverClient(createWorker: () => WorkerLike = defaultCreateWorker)`, where
`type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener'>`: the narrow
surface the client uses, which the test stubs implement (D11). It returns
`{ findWinnable, hint, cancel, cancelHints, dispose }`. The default factory is

```ts
new Worker(new URL('../../solver/solver.worker.ts', import.meta.url), { type: 'module' })
```

Vite detects that pattern.

**Worker lifecycle.** The worker is created lazily. Request ids increase monotonically. A reply
whose id is not pending is dropped.

**Which request wins:**
- `cancel()` settles every pending request as `{ status: 'cancelled' }`. If the worker is **busy**,
  meaning it has been posted a request whose reply has not arrived yet (a timed-out hint
  included), `cancel()` also terminates and discards it; a running search cannot read new
  messages, so terminating is the only immediate way to stop it. An idle worker is kept.
- `cancelHints()` settles only the pending hints as `cancelled` and clears their timers. It leaves
  a pending deal and the worker alone (late replies are dropped by id). The deal service calls it
  when a heuristic-only hint (Draw 3, Vegas, a won position) replaces an older solver hint.
- `findWinnable(seeds, budget, onProgress)` calls `cancel()` first, then posts to the current worker
  or a new one.
- `hint(state, budget, timeoutMs)`:
  - It settles an older pending hint as `cancelled`, and that hint's late reply is dropped by id.
  - Its timeout settles it as `{ status: 'timeout' }` **without** terminating the worker. A hint
    solve is bounded at 3,000 nodes, so restarting the worker would cost more than letting the solve
    finish.
  - While a deal is pending it resolves `{ status: 'busy' }` at once.

**Failure.** The worker's `error` and `messageerror` events, and any reply that is not a
well-formed envelope (an object with a numeric `id` and a `type` of `findWinnable`, `hint` or
`progress`), settle every pending request as
`{ status: 'failed' }` and discard the worker. The next request starts a new one. If
`createWorker` throws, the request is also settled as `failed`.

**Settling.** Results are a discriminated union,
`{ status: 'ok', … } | { status: 'cancelled' | 'timeout' | 'busy' | 'failed' }`, and the client
never rejects a promise.

**Disposal.** `dispose()` calls `cancel()`, then terminates any remaining worker. Tests use it for
cleanup; Phase 4 may call it when the store is torn down.

**Timeouts.** Deal requests have no timeout, because the attempt cap bounds them. A tight timeout
on a slow phone would quietly degrade Daily.

### D9 — The deal service

`src/features/deal/dealService.ts` defines

```ts
createDealService(options?: {
    createWorker?: () => WorkerLike;
    now?: () => Date;
    seedSource?: SeedSource;
    overlayDelayMs?: number;
    hintTimeoutMs?: number;
})
```

It returns:

```ts
{
    deal(request: { mode: Mode; winnableOnly: boolean }, onProgress?): Promise<DealOutcome>;
    hint(state: GameState): Promise<HintOutcome>;
    dispose(): void;
}
```

The outcome types:

```ts
type DealOutcome = { status: 'dealt'; state: GameState } | { status: 'cancelled' };
type HintOutcome =
    | { status: 'hint'; source: 'solver' | 'heuristic'; hint: SolverHint }
    | { status: 'none' }
    | { status: 'cancelled' };
```

**Dealing:**

| Request | Seeds | Budget | Where it runs |
| --- | --- | --- | --- |
| Draw 1 with `winnableOnly` | 40 × `cryptoSeed(seedSource)` | 5,000 | worker |
| Daily (the setting is ignored) | `dailySeeds(utcDayKey(now()))` | `DAILY_V1.budget` | worker |
| Any other request | one `cryptoSeed(seedSource)` | — | main thread: `dealFromSeed(seed, mode)` |

The worker's reply becomes `dealFromSeed(seed, mode, { verdict, attempts })`.

**Every deal cancels first.** `deal()` calls the client's `cancel()` before routing, whichever row
of the table applies. So a Draw 3 deal made on the main thread still settles a pending verified
deal and a pending solver hint as `cancelled`. A client `cancelled` result becomes
`{ status: 'cancelled' }` and delivers nothing.

**Progress.** `onProgress({ overlay, attempt })` applies only to the two worker rows:
- The current attempt starts at 1. Each worker `progress` message sets it to the number it carries
  (the attempt now starting, D4) and emits a report with the current overlay flag, so a report
  never names an attempt that is not then tried.
- One timer of `overlayDelayMs` (default 160) starts with the request. When it fires while the
  request is still pending, the service emits `overlay: true` with the current attempt.
- On settle the timer is cleared. Nothing is emitted after that.

This mirrors the mockup's single timer (`:1282`).

**Fallbacks.** There is one table for every way a verified deal can end without a win:

| Outcome | Draw 1 with `winnableOnly` | Daily |
| --- | --- | --- |
| All attempts fail | `findWinnable`'s result: the 40th seed, `random`, 40 attempts | the same: the 40th candidate, `random`, 40 attempts |
| Client `failed` (worker error, `messageerror`, or `createWorker` threw) | `seeds[0]`, the first of the 40 seeds already drawn, `random`, 1 attempt, dealt on the main thread | `dailySeed(day, 1)`, `random`, 1 attempt, dealt on the main thread |

**Hints.** `hint(state)` settles as follows, checked in order:
1. `isWon(state)` → `{ status: 'none' }`, after settling any pending solver hint (`client.cancelHints()`).
2. A Draw 3 or Vegas position (`draw !== 1`, or a finite `passLimit`) → the heuristic, without
   asking the solver, after settling any pending solver hint (`client.cancelHints()`).
3. Otherwise the service asks the client with `HINT_BUDGET` and `hintTimeoutMs` (default 150):
   - `ok` with a suggestion → `{ status: 'hint', source: 'solver', hint }`;
   - `cancelled` → `{ status: 'cancelled' }`, with no heuristic fallback;
   - `ok` without a suggestion, `timeout`, `busy` or `failed` → the heuristic.

"The heuristic" is the domain `hint(state)`: a result becomes
`{ status: 'hint', source: 'heuristic', hint }`, and `undefined` becomes `{ status: 'none' }`.

The support test in step 2 repeats the solver's own check (D1). This is intentional: the features
lint rule (D10) forbids value imports from the solver, and the check is two domain calls.

**Constants.** `WINNABLE_BUDGET = 5_000`, `MAX_ATTEMPTS = 40` and `HINT_BUDGET = 3_000` are
exported from `dealService.ts`, because the deal-service tests reproduce the service's
`findWinnable` call with them.

*Rationale for the configuration seams:* `now`, `seedSource`, the delays and `createWorker` are
injected. That lets tests run the real worker with fixed seeds and dates. Only the paths that need
a worker that is silent, scripted or failing use a stub (D11).

### D10 — Layer guards

**Shared scanner.** The comment stripping and import-specifier extraction in
`tests/unit/repo/domainPurity.test.ts` move into `tests/unit/repo/purityScanner.ts`. The domain
test keeps its behaviour and assertions.

**`tests/unit/repo/solverPurity.test.ts`** checks four rules:
- import specifiers match `^\./[A-Za-z]+(\.js)?$` or `^\.\./domain/[A-Za-z]+(\.js)?$`;
- the same banned identifiers as the domain guard apply, **plus `crypto`** (banned everywhere);
- `self` appears only in `solver.worker.ts`;
- the README inventory holds exactly the files in `src/solver`, parsed with
  `/^- \`([A-Za-z]+(?:\.worker)?\.ts)\`/gm`.

**`eslint.config.js`:**
- `src/solver/**/*.ts` gets a `no-restricted-imports` regex override with the same allowed
  patterns.
- `src/features/**/*.ts` gets `@typescript-eslint/no-restricted-imports` with a pattern that uses
  `regex: '(^|/)solver(/|$)'` (the same `regex` form as the existing domain override,
  `eslint.config.js:28-42`, rather than a glob on relative specifiers) and `allowTypeImports: true`. Type-only imports from any solver module are erased
  at build time, so they are allowed; value imports are errors. The worker URL is a `new URL(...)`
  string, not an import, so the rule never sees it.

**`reservedLayers.test.ts`** becomes `['i18n', 'pwa']`.

### D11 — How it is tested

**Worker implementation.**
- The `@vitest/web-worker@5.0.1` dev dependency (peer `vitest` 5.0.1) runs the real worker module
  in-process. It is a runtime for the real module, not a mock.
- Worker round-trip tests import it at the top of the file.
- Solver, worker and deal-service tests declare `// @vitest-environment node`. They need no DOM,
  and this avoids jsdom's interaction with the worker implementation.

**First worker task starts with a short spike.** It confirms three things:
- the default factory's `new URL(..., import.meta.url)` resolves under Vitest;
- a round-trip works;
- v8 coverage records `solver.worker.ts`.

If coverage does not record it, `solver.worker.ts` joins `coverage.exclude`. It is a three-line
binding, and `handleRequest` holds its logic and is fully covered. The spike's finding goes in
`tests/README.md`.

**Timers.**
- The in-process worker runs on the test's own thread, so while a search runs, timers cannot fire.
  Timeout and overlay-after-delay tests therefore use a **silent worker stub**, an object with
  `postMessage` and `terminate` that never replies, together with Vitest fake timers.
- Fake timers are never combined with the real worker.
- Every other deal-service and client test uses the real worker.

**Time zones.** Tests set `process.env.TZ` at run time (Node honours it) and restore it in
`afterEach`.

**Seeds.** A `seedSource` built on `mulberry32(fixed)` makes the random paths reproducible.

**Benchmark.** `tests/bench/winnable.bench.ts` runs through `vitest bench`, with `bench` in the
`package.json` scripts. It is outside `test:unit`, `validate`, the hooks and CI, and it reports
median and p95 for winnable Draw 1 selection over a fixed seed set.

**Deferred to Phase 5.** The Playwright checks run in the first phase that deals a game in a
browser:
- a winnable Draw 1 deal through the real worker in Chromium;
- a latency report against *KS-PERF-02*.

The **Phase 5 "done when"** in `phased-design.md` records them.

## Risks / Trade-offs

- **The corpus drifts because of a small porting difference** (sort stability, scan order, when
  `safe()` runs). → The per-seed pinned string (D2) points to the first seed that differs. Replaying
  every win's line (D3) checks the path independently.
- **The corpus test is slow and weighs on the commit hook.** → About 4 s for the reference (D2).
  Each seed is solved once and both its verdict and its line are checked in that pass. It uses
  `it.each` over seed ranges with a sized timeout; seeds are never sampled.
- **In-process workers hide real browser issues** (structured clone, module-worker bundling). →
  `worker.format: 'es'`, a default-factory round-trip test, and the Phase 5 Chromium check recorded
  in `phased-design.md`.
- **Winnable-only skews towards easier deals** (R§4.5). → Accepted for v1 and documented in R§4.5.
  Phase 11 (pool or larger budget) is the mitigation.
- **The Daily deal depends on the solver's exact behaviour.** → "daily v1" is pinned by golden
  dates. Any intended change becomes a new version, never an in-place edit.
- **A hint's first move can differ from the heuristic's.** → Expected. The solver line is
  preferred (*KS-AST-03*), and the answer states its source.
- **Terminating a worker mid-search costs a new worker start** (about 10–30 ms). → It happens only
  when a deal arrives while the worker is busy (D8), which is rare. An idle worker is reused, and a
  hint timeout never terminates.

## Migration Plan

No persisted data changes. The `solitaire.local-state` record arrives in Phase 4. No existing
behaviour changes: nothing calls the service until Phase 4. Rollback is a branch revert.

## Open Questions

- The exact per-test timeout for the corpus suite and the Daily golden suite is measured when those
  tasks are implemented. It does not affect the specs or the task split.
