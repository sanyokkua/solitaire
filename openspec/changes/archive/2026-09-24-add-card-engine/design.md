# Design

## Context

- The change alters constitution principle 1 (D4) and defines the contract that the solver, the store
  and the UI are built against, so a design document is warranted.
- TypeScript runs with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`;
  `@typescript-eslint/no-non-null-assertion` is an error. Pile access must be total without `!`.
- `tests/unit/repo/reservedLayers.test.ts` currently asserts `src/domain` holds only `README.md`; it
  fails as soon as the first domain file lands.
- No solver exists yet (Phase 3).

## Goals / Non-Goals

**Goals:** one validated entry point (`applyCommand`) for every game change; a `GameState` that is a
pure function of its seed and command history, so a snapshot is all undo needs; rule fidelity to
`docs/spec/research.md`.

**Non-Goals:** performance tuning; a barrel or published API; shaping anything around the Phase 3
worker boundary.

## Decisions

### D1 — Scoring seam

`applyCommand` scores the events it produced by calling `scoring.ts` and returns a state whose
`score` (the stored move score) is already updated. `scoring.ts` never imports `engine.ts`.

- Per-event delta: `(event, scoring, draw)`. Summed delta: `(events, scoring, draw)`. Clamped
  application: `(storedScore, delta, scoring)`. None of them takes a `GameState`.
- The draw count is an explicit input because the recycle charge depends on it (D3) and
  `GameState.scoring` does not carry it.
- The time penalty, undo cost and win bonus are separate pure functions applied outside the engine
  (Phase 4). The engine emits `won` but never adds the bonus.
- The scoring rules are fixed at deal from the mode and never change during a game (*KS-SET-06*).

### D2 — Time penalty is a total; displayed score is derived

- `timePenalty(elapsedMs, scoring)` returns the whole penalty for the elapsed time: Standard
  `2 × floor(s / 10)` with `s = floor(elapsedMs / 1000)`; Vegas 0. Nothing is ever deducted from
  the stored score as time passes.
- `winBonus(elapsedMs, scoring)`: Standard `floor(700000 / s)` when `s > 30`, else 0; Vegas 0.
  Pinned by tests: 30 000 ms → 0, 30 999 ms → 0, 31 000 ms → `floor(700000 / 31)`.
- Displayed score = stored move score − time penalty, floored at 0 under Standard only, + win bonus
  once won.
- The stored move score is floored at 0 under Standard once per command, after the command's events
  are summed.
- `GameState.score` is the move score; the HUD, win sheet and statistics read the displayed score.

### D3 — Passes and the stock rules

- `passes` is the ordinal of the pass in progress; a fresh deal has `passes = 1`.
- `passLimit(mode)`: 3 for `vegas`, unlimited for every other mode. Recycling is permitted when the
  stock is empty, the waste is not, and `passes < passLimit`.
- The `recycled` event carries the pass it begins (`passes + 1`).
- Standard recycle charge: draw 1 → −100 on every recycle; draw 3 → −20 when the pass begun is ≥ 4,
  otherwise 0. Four successive Draw 3 recycles therefore score 0, 0, −20, −20.
- A one-card Vegas pass limit is not implemented: the only Vegas mode draws three.

### D4 — `cryptoSeed` lives in `prng.ts` with an injected source

`cryptoSeed(source?: SeedSource)`, defaulting to `globalThis.crypto` when omitted. It throws when no source
is available and never falls back to `Math.random`. Only Phase 3's deal service calls it; nothing in the engine does. This is
the one exception to constitution principle 1, and the purity guard (D10) confines `crypto` to
`prng.ts`.

### D5 — Fixed-arity tuples and guarded accessors

The tableau is a 7-tuple and the foundations a 4-tuple, indexed by the literal unions in `PileRef`, so
column and foundation reads are total under `noUncheckedIndexedAccess`. Variable-length reads (the
top of a pile) go through accessors returning `T | undefined`. No `!` appears anywhere.

### D6 — Rejection returns the input by reference, with a typed reason

`applyCommand` never throws. A refused command returns the same state object it was given plus one
`rejected` event, so a caller detects refusal by reference equality. The reason is the closed union
of D16, never free text.

### D7 — Immutability by structural sharing

A command copies only the piles it touches; untouched tableau columns stay reference-identical. Every
`GameState` and event field is `readonly`, arrays included. Every engine test deep-freezes its input.

### D8 — Counters and fields the engine owns

`moves` increases for each accepted player `move` and each accepted `draw` (draw or recycle); an
`autoFoundation` never counts. `started` becomes true on the first accepted command. The engine never
writes `elapsedMs`, `seed`, `mode`, `draw`, `scoring`, `verdict` or `attempts`.

### D9 — Finish plan

`finishPlan(state)` returns `{ state, events, commands }` or `undefined`. It is available only when
the state is not won and every tableau card is face up, and it loops:

1. the lowest-ranked foundation-ready card among the tableau tops and the waste top (ties by the
   canonical source order, D17) is sent with `autoFoundation`;
2. otherwise `draw`;
3. otherwise `draw` (which recycles).

Every step goes through `applyCommand`, so draws and recycles are scored, counted and pass-limited,
and the sends are uncounted (D8). It returns `undefined` if a step is refused, or when the stock is
exhausted and a second recycle would be needed with no send since the first (after the first
recycle the stock holds every remaining card, so the pass up to the next exhaustion shows every
waste top any later pass could; counting turned-over cards instead stops a Draw 3 pass short when
the plan starts mid-pass). Finish availability is exactly `finishPlan(state) !== undefined`. Phase 6 animates
`commands` and commits `state` as one history entry.

### D10 — Layer isolation: static test plus lint

`tests/unit/repo/domainPurity.test.ts` reads every `src/domain/*.ts` file and asserts:

- every import specifier matches `/^\.\/[A-Za-z]+(\.js)?$/`;
- no source uses the identifiers `document`, `window`, `navigator`, `localStorage`, `sessionStorage`,
  `indexedDB`, `caches`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `Math.random`,
  matched as whole identifiers outside comments (string and template literals are never mistaken
  for comments);
- `crypto` appears in exactly one module, `prng.ts`.

An ESLint `no-restricted-imports` override on `src/domain/**` restricts every bare and
parent-directory specifier.

### D11 — `reservedLayers.test.ts` is narrowed in the first task

`RESERVED_LAYERS` becomes `['solver', 'features', 'i18n', 'pwa']` in task 1.1, so the suite stays
green after every task. The domain's contract moves to `domainPurity.test.ts`.

### D12 — Coverage covers every source file

`vitest.config.ts` gains `coverage.include: ['src/**/*.{ts,tsx}']`, keeping the existing exclusions.
The project-wide 80% thresholds are the only coverage rule; there is no domain-specific threshold.
`package.json`, `validate` and the workflows are unchanged.

### D13 — The winning line is a committed literal

`tests/unit/domain/engine.fullGame.test.ts` deals a recorded Draw 1 seed, replays a recorded literal
command sequence through `applyCommand`, and asserts it is won with the recorded move count, score
and passes. The test contains no search. A second case drives the same seed with the hint heuristic
as a greedy policy and asserts it still wins; it is updated deliberately if *R§6.1* changes. How the
line is generated is specified in task 6.5.

### D14 — Foundation display order vs suit encoding

The suit encoding (♥ ♦ ♣ ♠ = 0–3) fixes card identifiers and foundation slot indices. `cards.ts`
also exports the display order ♥ ♣ ♦ ♠, which Phase 5 uses to lay the slots out left to right.

### D15 — Module boundaries

Nine modules, no barrel; dependencies run one way:

```
types    → (nothing)                     rules   → types, cards
cards    → types                         scoring → types, cards
prng     → (nothing)                     engine  → types, cards, rules, scoring
dealCode → types                         assist  → types, cards, rules, engine
deal     → types, cards, prng, scoring
```

`engine` never imports `assist`; `assist` applies moves only through `applyCommand`.

### D16 — Type contracts

The base shapes are `docs/spec/phased-design.md` §3.2 (`Suit`, `CardId`, `Mode`, `PileRef`,
`TableauCard`, `GameState`, `Command`, `GameEvent`). The complete list of refinements, implemented in
task 1.1:

- `tableau` is a 7-tuple of columns and `foundations` a 4-tuple (D5). Every field of `GameState` and
  of every event is `readonly`, arrays included (D7).
- `passes` starts at 1 (D3).
- `RejectReason` is exactly `'game-over' | 'not-movable' | 'illegal-target' | 'pass-limit' |
  'nothing-to-draw'`:
  - `'game-over'`: any command on a won game.
  - `'not-movable'`: the named cards cannot be picked up — a face-down card, tableau cards that do
    not form a valid run, a non-top waste or foundation card, anything from the stock, an index
    outside the pile, or an `autoFoundation` from a pile other than a tableau column or the waste.
  - `'illegal-target'`: the destination does not accept the group, including foundation →
    foundation and a drop onto the source pile.
  - `'pass-limit'`: a recycle the pass limit forbids.
  - `'nothing-to-draw'`: stock and waste both empty.
- Event payloads:
  - `moved`: `cards`, `from`, `to`;
  - `flipped`: `card`;
  - `drew`: `count` actually turned;
  - `recycled`: `pass` begun;
  - `won`: no payload;
  - `rejected`: `reason`.
- The scoring function signatures are those of D1 and D2. `startingScore(scoring)` returns 0
  (Standard) or −52 (Vegas); it lives in `scoring.ts`, and `deal.ts` imports it.
- `SeedSource` is `{ getRandomValues(array: Uint32Array<ArrayBuffer>): Uint32Array<ArrayBuffer> }`; the
  `ArrayBuffer` narrowing is what makes the platform's `Crypto` object assignable under current TypeScript.
- Assist results (absence is `undefined`):
  - `hint` → a move `{ command, cards, priority }`, a `{ kind: 'draw' }` or `{ kind: 'recycle' }`
    suggestion, or `undefined`;
  - `nextSafeMove` → an `autoFoundation` command;
  - `bestTarget` → a `PileRef`;
  - `finishPlan` → as in D9;
  - `isDeadEnd` and `isSafe` → `boolean`.

### D17 — Scan order

Every scan uses move-rules "Canonical scan order". It has two exceptions:

- **Hint priority 2** skips empty columns, so a revealing whole run that fits only an empty column is
  suggested at priority 5. Priorities 3 and 4 include empty columns.
- **`bestTarget`** uses its own relative scan for non-empty columns: first the column right of the
  source, wrapping around; from column 0 when the group came from the waste or a foundation. Its
  King → empty-column step does not use that scan: it takes the first empty column from column 0,
  as the mockup reference does (*R§6.5*).

For a won state, `hint` returns `undefined` and `isDeadEnd` returns `false`.

### D18 — Output-compatible with the reference algorithms

`mulberry32`, `shuffle` and the deal must reproduce, value for value, the reference functions
`mulberry32(a)`, `shuffle(rng)` and `dealFrom(deck)` in `docs/spec/mockup/klondike-mockup.html`
(*R§3.1–3.2*). Deal codes and the Phase 3 solver corpus (seeds 1–200 → 142 / 1 / 57) depend on that
exact pipeline. The pinned vectors in tests (the first eight generator outputs, and the golden 52-card
permutation) are computed by running those reference functions, never by the new code. Only their
numeric output is reused, not their code structure.

### D19 — The dealt state records the canonical seed

`dealFromSeed` reduces its seed to an unsigned 32-bit integer (`seed >>> 0`) once, deals from it and
stores it in `GameState.seed`. The deal is unchanged, because `mulberry32` already reduces its seed,
but the stored seed always lies in `[0, 2³²−1]`, so `encodeDealCode(state.seed)` never throws, even
for a seed built with signed 32-bit arithmetic.

## Risks / Trade-offs

- **The stored move score and the displayed score differ.** A consumer that reads `state.score` into
  the HUD would ignore the time penalty and the bonus. Mitigation: D2 is stated in the scoring spec,
  in `docs/spec/specification.md` §5 and in `src/domain/README.md`.
- **The engine is not wired into the application in this change.** Phase 4's `game` slice wires it.

## Migration Plan

No persisted data changes. The `solitaire.local-state` record arrives in Phase 4, whose decoder uses
the card-identifier validity check exported here. Rollback is a branch revert.
