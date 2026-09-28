# Tasks

> **Conventions.**
> - Run commands through `rtk` (`rtk proxy <cmd>` when the wrapper rejects a flag).
> - Vitest tests are `*.test.ts(x)` and live in `tests/`, mirroring `src/`.
> - Requirement names refer to this change's delta specs: **C** `specs/domain/card-model`,
>   **D** `specs/domain/deal-generation`, **R** `specs/domain/move-rules`, **S** `specs/domain/scoring`,
>   **E** `specs/domain/game-engine`, **A** `specs/domain/assistance`, **P** `specs/app/application-shell`,
>   **T** `specs/tooling/repository-foundation`. `Dn` refers to `design.md` decision *n*; read every
>   decision a task names before coding.
> - From task 3.1 onward, build test positions with `makeState` and `deepFreeze` from
>   `tests/fixtures/states.ts` (created in task 2.1).
> - Every task ends with the full `rtk npm run test:unit` green.

## 1. Card model and randomness

- [x] 1.1 Implement the shared domain types, the card identity encoding and the domain purity guard
    - **Implements:**
      - C "Card identity encoding", C "Card labels are locale-independent keys", C "Foundation display
        order is distinct from the suit encoding";
      - P "The pure domain layer is isolated from the rest of the application" (all scenarios except
        "The layer holds exactly its documented modules", which task 7.1 adds);
      - P "Layers reserved for later phases carry no behaviour";
      - *KS-DEAL-01, KS-A11Y-01*; D5, D10, D11, D14, D16.
    - **Files:**
      - `src/domain/types.ts` (type-only; implements D16 exactly);
      - `src/domain/cards.ts`;
      - `eslint.config.js` (`src/domain/**` override per D10);
      - `tests/unit/repo/reservedLayers.test.ts` (narrow per D11).
    - **Tests:**
      - `tests/unit/domain/cards.test.ts`:
        - suit/rank round-trip for all 52;
        - ids 0–25 red and 26–51 black;
        - the rank-label, suit-key and suit-symbol tables;
        - the validity check rejects `-1`, `52`, `1.5`, `NaN`, `'3'`, `null` and `undefined`;
        - the display order is a permutation of the four suits with alternating colours.
      - `tests/unit/repo/domainPurity.test.ts`: a `readdirSync`-driven `it.each` over the existing
        `src/domain/*.ts` files, asserting the D10 rules.
    - **Verify:**
      - `rtk npx vitest run tests/unit/domain/cards.test.ts tests/unit/repo` passes;
      - `rtk npm run typecheck` and `rtk npm run lint` pass;
      - a temporary `import { createAppStore } from '../app/store';` in a domain file fails both the
        purity test and lint, and is then reverted.

- [x] 1.2 Implement the seeded generator, the fresh-seed source and the unbiased shuffle
    - **Implements:** C "Deterministic pseudo-random sequence", C "Fresh seeds come from an injected
      entropy source", C "Unbiased shuffle" *(KS-DEAL-01, KS-DEAL-02)*; D4, D16, D18.
    - **Files:**
      - `src/domain/prng.ts` (`mulberry32`, `cryptoSeed`);
      - `src/domain/deal.ts` (only `orderedDeck` and a generic `shuffle<T>`).
    - **Tests:**
      - `tests/unit/domain/prng.test.ts`:
        - the first eight outputs for a fixed seed equal a pinned vector;
        - two generators from the same seed produce identical sequences;
        - 10,000 draws all lie in `[0, 1)`;
        - negative, fractional and above-2³² seeds map to the sequence of their unsigned 32-bit
          reduction;
        - `cryptoSeed(fakeSource)` returns the fake's value;
        - with `vi.stubGlobal('crypto', undefined)`, `cryptoSeed()` throws (restore with
          `vi.unstubAllGlobals()`).
      - `tests/unit/domain/shuffle.test.ts`:
        - **phase gate:** 60,000 shuffles of four elements across seeds give a chi-square over all 24
          permutations below the 0.001 critical value for 23 degrees of freedom, and every
          permutation is observed at least once;
        - the input is left unchanged and a new array is returned;
        - the same input and seed shuffle identically;
        - `orderedDeck()` is `0..51`.
    - **Details:** Obtain the pinned vector by copying the mockup's `mulberry32` into a throwaway Node
      snippet (not committed). Record the seed and the source in a comment beside the vector (D18).
    - **Verify:**
      - `rtk npx vitest run tests/unit/domain/prng.test.ts tests/unit/domain/shuffle.test.ts` passes;
      - temporarily changing the shuffle's bound to `j ∈ [0, i−1]` fails the permutation-coverage
        assertion, and is then reverted.

## 2. Deals and deal identity

- [x] 2.1 Implement the seeded deal, the starting score and the shared test fixtures
    - **Implements:**
      - D "Seeded row-by-row deal", D "A mode fixes the draw count and the scoring rules";
      - S "Standard move scoring" and S "Vegas bankroll" (starting-score scenarios only);
      - *KS-DEAL-01, KS-SET-06, KS-SCO-01, KS-SCO-02*; D3, D15, D16, D18.
    - **Files:**
      - `src/domain/deal.ts` (`modeConfig`, `dealFromSeed`);
      - `src/domain/scoring.ts` (created with `startingScore` only);
      - `tests/fixtures/deals.ts`;
      - `tests/fixtures/states.ts`;
      - `tests/README.md` (add `fixtures/` to the layer list).
    - **Tests:**
      - `tests/unit/domain/deal.test.ts`:
        - column *n* holds *n+1* cards with only the last face up;
        - the stock holds 24, with the shuffled deck's last card drawn first;
        - the waste and foundations are empty;
        - all 52 ids appear exactly once;
        - the same seed and mode give an identical deal, and different seeds differ;
        - the four modes map to their draw count and scoring rules;
        - a fresh deal has `passes` 1, no moves, `elapsedMs` 0, is not started and not won, has the
          starting score, and has the default provenance;
        - the dealt permutation for the fixture seed equals the golden permutation.
      - `tests/unit/domain/scoring.deltas.test.ts` (created here): `startingScore` is 0 for Standard
        and −52 for Vegas.
    - **Fixtures:**
      - `deals.ts`:
        - a golden 52-card permutation for one seed, computed by running the mockup's `mulberry32`,
          `shuffle` and `dealFrom` in a throwaway Node snippet (not committed), with the seed and
          method recorded in a comment (D18);
        - three or four `{ name, seed, mode }` entries.
      - `states.ts`: `makeState(partial)` and `deepFreeze`.
    - **Details:** `dealFromSeed(seed, mode, meta?)` defaults `verdict` to `'random'` and `attempts`
      to 1. The fresh deal's score comes from `startingScore`.
    - **Verify:** `rtk npx vitest run tests/unit/domain/deal.test.ts tests/unit/domain/scoring.deltas.test.ts`
      passes.

- [x] 2.2 Implement deal-code encoding and decoding
    - **Implements:** D "Deal code round-trip" *(KS-DEAL-02, KS-DEAL-09)*.
    - **Files:**
      - `src/domain/dealCode.ts`;
      - `tests/fixtures/deals.ts` (add `code` to each entry).
    - **Tests:** `tests/unit/domain/dealCode.test.ts`:
      - the mode letters are `1`, `3`, `V`, `D`, and output is upper case;
      - seed 0 encodes to `0000000`, and 2³²−1 to exactly seven characters;
      - several hundred seeds across all four modes round-trip;
      - decoding ignores case and surrounding whitespace;
      - decoding returns `null` for an unknown letter, a six- or eight-character seed, a non-base-36
        character, a missing separator, an empty string, or a seed above 2³²−1;
      - each fixture code decodes to its seed and mode, and dealing it reproduces the fixture layout.
    - **Verify:** `rtk npx vitest run tests/unit/domain/dealCode.test.ts` passes.

## 3. Move rules

- [x] 3.1 Implement pile accessors and movable groups
    - **Implements:** R "Movable groups" *(KS-MOVE-01, KS-MOVE-06)*; D5.
    - **Files:** `src/domain/rules.ts` (pile-top accessors, column accessor, `groupAt`, `isMovable`).
    - **Tests:** `tests/unit/domain/rules.groups.test.ts`:
      - a face-up card partway up a column yields it and every card above it;
      - full and partial runs are grabbable;
      - face-up cards that do not descend in alternating colours yield nothing;
      - a face-down card yields nothing;
      - only the waste top and a foundation top are grabbable;
      - the stock never is;
      - an out-of-range index yields nothing without throwing.
    - **Verify:**
      - `rtk npx vitest run tests/unit/domain/rules.groups.test.ts` passes;
      - `rtk npm run lint` passes.

- [x] 3.2 Implement legal drop targets and the canonical destination order
    - **Implements:** R "Legal tableau and foundation drops", R "Canonical scan order" *(KS-MOVE-01, KS-AST-01)*.
    - **Files:** `src/domain/rules.ts` (`canDrop`, `legalTargets`).
    - **Tests:** `tests/unit/domain/rules.drops.test.ts`:
      - onto a non-empty column: one rank below and the opposite colour is accepted; same colour and
        wrong rank are rejected;
      - only a King enters an empty column;
      - a foundation accepts only a single card of its suit at the next rank: an Ace onto empty is
        accepted, a rank skip is rejected, and a multi-card group is rejected;
      - a foundation top may return to a column;
      - foundation → foundation is rejected;
      - `legalTargets` lists accepting piles in the canonical destination order and excludes the
        source pile (R scenario "Destinations are reported foundation-first, then by column").
    - **Verify:** `rtk npx vitest run tests/unit/domain/rules.drops.test.ts` passes.

- [x] 3.3 Implement pass limits, recycle permission and win detection
    - **Implements:** R "Stock passes and recycling", R "Win detection" *(KS-MOVE-04, KS-MOVE-05, KS-MOVE-07)*; D3.
    - **Files:** `src/domain/rules.ts` (`passLimit`, `canRecycle`, `isWon`).
    - **Tests:** `tests/unit/domain/rules.stock.test.ts`:
      - the limit is unlimited for Draw 1, Draw 3 and Daily, and 3 for Vegas;
      - recycling is refused while the stock holds cards, and refused with an empty waste;
      - Standard recycles at any pass;
      - Vegas recycles on passes 1 and 2 and is refused on pass 3;
      - a position is won only when all four foundations hold 13.
    - **Verify:** `rtk npx vitest run tests/unit/domain/rules.stock.test.ts` passes.

## 4. Scoring

- [x] 4.1 Implement the event score deltas for Standard and Vegas, including the three-card recycle penalty
    - **Implements:** S "Standard move scoring", S "Recycle penalties follow the pass count", S "Vegas
      bankroll" *(KS-SCO-01, KS-SCO-02)*; D1, D2, D3.
    - **Files:** `src/domain/scoring.ts` (extend with the per-event delta, the summed delta and the
      clamped application).
    - **Tests:** extend `tests/unit/domain/scoring.deltas.test.ts`:
      - Standard deltas:
        - waste → tableau +5; waste → foundation +10; tableau → foundation +10; a flip +5;
        - foundation → tableau −15; tableau → tableau 0;
        - draw, rejection and win events 0.
      - Draw 1 Standard: −100 on every recycle.
      - **Draw 3 Standard: four recycles beginning passes 2, 3, 4, 5 score 0, 0, −20, −20.**
      - Vegas: +5 per card onto a foundation and −5 per card off one; 0 for a flip, tableau →
        tableau or a recycle.
      - Clamping: a Standard −100 against a stored score of 30 leaves 0; a Vegas bankroll stays
        negative.
      - A move plus a flip sums to 15.
    - **Verify:** `rtk npx vitest run tests/unit/domain/scoring.deltas.test.ts` passes.

- [x] 4.2 Implement the time penalty, win bonus, undo cost and displayed score
    - **Implements:** S "Time penalty, win bonus and undo penalty" *(KS-SCO-01, KS-SCO-03, KS-SCO-04)*; D1, D2.
    - **Files:** `src/domain/scoring.ts`.
    - **Tests:** `tests/unit/domain/scoring.time.test.ts`:
      - Standard time penalty: 0 at 0 ms and 9,999 ms, 2 at 10,000 ms, 20 at 100,000 ms; always 0
        under Vegas.
      - Win bonus: 0 at 30,000 ms and at 30,999 ms, `floor(700000 / 31)` at 31,000 ms; 0 under
        Vegas; 0 while not won.
      - Undo cost: 2 under Standard, 0 under Vegas.
      - Displayed score:
        - subtracts the penalty;
        - floors at 0 under Standard only;
        - adds the bonus only once won;
        - two calls return the same value and leave the stored score unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/domain/scoring.time.test.ts` passes.

## 5. Engine

- [x] 5.1 Implement `applyCommand` for `move`, `autoFoundation` and `draw`
    - **Implements:** every E requirement except "A complete game can be played through commands
      alone" *(KS-MOVE-01…05, KS-MOVE-07, KS-INP-09, KS-SCO-05, KS-STA-01)*; D1, D3, D6, D7, D8, D16.
    - **Files:** `src/domain/engine.ts`.
    - **Tests (every case deep-freezes its input and asserts nothing throws):**
      - `tests/unit/domain/engine.move.test.ts`:
        - a legal run move emits `moved` with the cards and both piles, and increments `moves`;
        - exposing a face-down card emits exactly `[moved, flipped]` and scores +5 under Standard;
        - the last card emits exactly `[moved, won]` and sets `status` to won;
        - an `autoFoundation` that exposes a card emits `[moved, flipped]`, and one that places the
          last card emits `[moved, won]`;
        - every command after the win is refused with `'game-over'`;
        - an illegal drop returns the same state reference with exactly one `rejected` event;
        - `autoFoundation` is accepted from a tableau top and from the waste; from the stock or a
          foundation it is refused with `'not-movable'` and the same reference;
        - `autoFoundation` never increments `moves`;
        - `elapsedMs`, `seed`, `mode`, `draw`, `scoring`, `verdict` and `attempts` never change;
        - `started` becomes true on the first accepted command and stays false after a refusal;
        - untouched columns are reference-identical.
      - `tests/unit/domain/engine.draw.test.ts`:
        - one-card and three-card modes turn 1 and 3, and report `count`;
        - a short stock turns what remains;
        - the last card turned is the waste top;
        - a recycle reverses the waste, reports the pass begun and increments `passes`;
        - a draw and a recycle each count one move;
        - Vegas on pass 3 is refused with `'pass-limit'` and the same reference;
        - both piles empty is refused with `'nothing-to-draw'`;
        - Draw 3 Standard recycles beginning passes 2–5 score 0, 0, −20, −20;
        - Draw 1 Standard scores −100 per recycle.
      - Across both files, a table-driven case shows that each of the five `RejectReason` values is
        produced, and no other value is.
    - **Details:** All three command branches land together because `applyCommand` is one exhaustive
      switch.
    - **Verify:** `rtk npx vitest run tests/unit/domain/engine.move.test.ts tests/unit/domain/engine.draw.test.ts`
      passes.

## 6. Assistance

- [x] 6.1 Implement the safe-move rule and the next safe move
    - **Implements:** A "Safe foundation moves" *(KS-AST-04)*; D16.
    - **Files:** `src/domain/assist.ts` (`isSafe`, `nextSafeMove`).
    - **Tests:** `tests/unit/domain/assist.safe.test.ts`:
      - a ready Ace or Two is safe;
      - a red Five is safe when both black foundations hold ≥ 4, and unsafe when either holds 3;
      - a card whose foundation is not ready is never safe;
      - `nextSafeMove` follows the canonical source order, returns `undefined` when nothing is safe,
        and never proposes a foundation card.
    - **Verify:** `rtk npx vitest run tests/unit/domain/assist.safe.test.ts` passes.

- [x] 6.2 Implement the hint heuristic and dead-end detection
    - **Implements:** A "Hint priority", A "Dead-end detection" *(KS-AST-02, KS-AST-06)*; D16, D17.
    - **Files:** `src/domain/assist.ts` (`hint`, `isDeadEnd`, and one shared internal move finder for
      priorities 1–5).
    - **Tests:**
      - `tests/unit/domain/assist.hint.test.ts`:
        - one position per priority 1–5;
        - positions offering two priorities, where the higher wins;
        - a King run that reveals nothing is not suggested;
        - a revealing whole run that fits only an empty column is suggested at priority 5, not 2;
        - a waste King with only an empty column available is suggested at priority 3;
        - draw while the stock holds cards; recycle when the stock is empty and recycling is
          permitted; `undefined` when nothing remains and for a won game;
        - ties resolve by the canonical scan order, including two freeing splits in one column
          (the one nearer the base wins).
      - `tests/unit/domain/assist.deadEnd.test.ts`:
        - a won position is not a dead end;
        - not a dead end when any priority move exists, or when a stock or waste card could be
          played;
        - with no priority move and a playable waste card, a dead end under Vegas at its pass limit
          but not under Standard;
        - an empty stock with recycling refused, a waste King and an empty column is not a dead
          end.
    - **Details:** `isDeadEnd` = `!won && noPriorityMove && (noTalonCardPlayable || (stockEmpty &&
      !canRecycle))`.
    - **Verify:** `rtk npx vitest run tests/unit/domain/assist.hint.test.ts tests/unit/domain/assist.deadEnd.test.ts`
      passes.

- [x] 6.3 Implement the smart-tap target choice
    - **Implements:** A "Smart tap target" *(KS-INP-01, KS-INP-03)*; D17.
    - **Files:** `src/domain/assist.ts` (`bestTarget`).
    - **Tests:** `tests/unit/domain/assist.bestTarget.test.ts`:
      - a single fitting card goes to its foundation, from the waste and from a column;
      - a foundation card is not sent back to a foundation;
      - a multi-card group never targets a foundation;
      - the first accepting non-empty column right of the source is chosen, wrapping around, and
        never the source;
      - from the waste or a foundation the scan starts at column 0;
      - a King not at its column base goes to the first empty column; a King at its base does not;
      - `undefined` when nothing accepts the group.
    - **Verify:** `rtk npx vitest run tests/unit/domain/assist.bestTarget.test.ts` passes.

- [x] 6.4 Implement the finish plan
    - **Implements:** A "Finish plan" *(KS-AST-05)*; D9.
    - **Files:** `src/domain/assist.ts` (`finishPlan`).
    - **Tests:** `tests/unit/domain/assist.finish.test.ts`:
      - unavailable with any face-down tableau card, and unavailable once won;
      - the settled state is won with every foundation at 13;
      - replaying `commands` from the original state is accepted at every step and reaches the same
        state;
      - the lowest-ranked ready card goes first, with ties by the canonical source order;
      - a Draw 3 Standard plan that recycles carries the ordinary recycle charge and the advanced
        `passes`;
      - a Vegas position at its pass limit needing another recycle has no plan;
      - a stock that cycles without any play has no plan and terminates;
      - a Draw 3 plan starting mid-pass with a talon that does not divide into threes recycles and wins;
      - a plan starting mid-pass whose next playable card lies below the waste top recycles and
        wins;
      - `moves` grows by the plan's draws and recycles only.
    - **Verify:** `rtk npx vitest run tests/unit/domain/assist.finish.test.ts` passes.

- [x] 6.5 Add the recorded winning line (phase gate)
    - **Implements:** E "A complete game can be played through commands alone" *(KS-MOVE-07, KS-DEAL-01)*; D13.
    - **Files:**
      - `tests/fixtures/deals.ts` (recorded Draw 1 seed, compact command line, expected moves, score
        and passes, and a small parser from the compact line to commands);
      - `tests/unit/domain/engine.fullGame.test.ts`;
      - this task entry (record the generation method and the seed range searched).
    - **Tests:** `engine.fullGame.test.ts`:
      - replaying the recorded line on its Draw 1 deal refuses nothing, ends won with every
        foundation at 13, and matches the recorded moves, score and passes;
      - a second case drives the same seed with `hint` as a greedy policy and asserts it wins.
    - **Details:**
      - Generate the line once, locally: drive Draw 1 games with `hint` as a greedy policy over
        successive seeds, with a repeated-position guard.
      - If no seed wins within about 2,000 seeds, use a throwaway depth-limited search.
      - Commit only the resulting literal, never the generator.
      - **Recorded:** the line was generated by greedy `hint` play over seeds 1–2000 with a
        repeated-position guard (265 seeds won; no depth-limited search was needed). Seed 49, the
        shortest of the first five winners (3, 18, 19, 32, 49), gives 117 commands, 117 moves, score
        585 and 2 passes.
    - **Verify:** `rtk npx vitest run tests/unit/domain/engine.fullGame.test.ts` passes.

## 7. Gates and documentation

- [x] 7.1 Measure coverage over every source file and assert the domain module inventory
    - **Implements:** T "Test suites separated by execution layer"; P "The pure domain layer is
      isolated from the rest of the application" (scenario "The layer holds exactly its documented
      modules"); D10, D12.
    - **Files:**
      - `vitest.config.ts`;
      - `tests/unit/repo/domainPurity.test.ts`;
      - `tests/README.md` (record the coverage behaviour).
    - **Tests:** `domainPurity.test.ts` gains a case that parses the module file names listed in
      `src/domain/README.md` and asserts `src/domain` contains exactly those files plus `README.md`.
    - **Details:**
      - Vitest 5 has no `coverage.all`: set `coverage.include: ['src/**/*.{ts,tsx}']` and keep the
        existing exclusions.
      - Run `rtk npm run test:coverage` before and after the edit, and compare the file lists.
      - If any threshold falls below 80%, stop and report it; writing tests for Phase 1 files is out
        of scope.
    - **Verify:**
      - `rtk npm run test:coverage` lists every `src/domain/*.ts` file and exits zero;
      - a temporary untested `src/domain/scratch.ts` appears at 0%, and is then removed;
      - `rtk npm run validate` passes.

- [x] 7.2 Align the specification pack and agent docs with the engine
    - **Implements:** constitution principle 9; D2, D3, D4, D5, D6, D9, D12, D14.
    - **Files and target statements:**
      - `docs/spec/research.md`:
        - §2.4 ♥ ♣ ♦ ♠ is the foundation display order, distinct from the ♥ ♦ ♣ ♠ suit encoding;
        - §5.1 the Draw 3 recycle costs −20 from the 3rd recycle onward (after three free passes);
        - §5.2 this product has no one-card Vegas mode;
        - §6.3 Finish is offered when a plan completes under the ordinary rules, and its draws and
          recycles are charged and pass-limited like the player's.
      - `docs/spec/specification.md`:
        - §4.3 and *KS-AST-05* Finish is available when a plan completes under the ordinary rules,
          with no pass-penalty exemption;
        - §5 the stored score is the move score, and the displayed score is derived (D2).
        - §2 and acceptance scenario 4 already match D3; leave them unchanged.
      - `docs/spec/phased-design.md`:
        - §3.2 tuples, `readonly`, `RejectReason`, `passes` from 1;
        - §4 Finish row per D9;
        - §4 Timer row: the time penalty is a total derived from elapsed time (D2);
        - §7 Phase 2 coverage gate is the project-wide 80% floor (D12).
      - `AGENTS.md`:
        - principle 1 notes the injected `crypto` exception for `prng.ts` (D4);
        - "Repository state" records the card engine.
      - `src/domain/README.md`:
        - remove "Lands in Phase 2";
        - document `passes` semantics, the scoring seam and the absence of a barrel;
        - keep the module list exact, since task 7.1's inventory test parses it.
    - **Tests:** none new.
    - **Verify:**
      - `rtk npm run validate` passes;
      - every symbol named in `src/domain/README.md` is a real export;
      - no document in `docs/spec/` describes any of: a −20 charge on the recycle that begins
        pass 3, a per-boundary time accrual, a ≥95% domain coverage gate, an untyped rejection
        reason, a penalty-free finish, or a one-card Vegas mode.

## 8. Review fixes

> Added after the whole-branch review. Each task is independent of the others; order is by layer.

- [x] 8.1 Send a smart-tapped King to the first empty column counting from column 0
    - **Implements:** A "Smart tap target" (step 3 and scenario "An empty column is chosen from
      column 0") *(KS-INP-01, KS-INP-03)*; D17.
    - **Files:**
      - `src/domain/assist.ts` (`bestTarget`: the empty-column search scans 0→6; the non-empty search
        keeps the relative scan; JSDoc updated);
      - `tests/unit/domain/assist.bestTarget.test.ts`;
      - `docs/spec/research.md` (§6.5 item 3: "the first empty column, counting from column 0").
    - **Tests:** `assist.bestTarget.test.ts`:
      - a King at column 5 (not at its base) with columns 2 and 6 empty and no accepting non-empty
        column goes to column 2 (replaces the relative-scan expectation of column 6);
      - the former "wraps around to an empty column" case asserts the lowest-numbered empty column;
      - the non-empty wrap-around, waste and foundation cases are unchanged.
    - **Verify:**
      - the updated column-2 case fails before the code change and passes after;
      - `rtk npx vitest run tests/unit/domain/assist.bestTarget.test.ts` passes.

- [x] 8.2 Record the canonical unsigned 32-bit seed in a dealt position
    - **Implements:** D "Seeded row-by-row deal" (scenario "The recorded seed is its unsigned 32-bit
      reduction") *(KS-DEAL-01, KS-DEAL-02)*; D19.
    - **Files:** `src/domain/deal.ts` (`dealFromSeed` reduces with `seed >>> 0` once, deals from it and
      stores it); `tests/unit/domain/deal.test.ts`.
    - **Tests:** `deal.test.ts`:
      - `dealFromSeed(-1, mode)` equals `dealFromSeed(4294967295, mode)` in every field, and its
        `seed` is 4294967295;
      - `encodeDealCode(dealFromSeed(-1, 'draw1').seed, 'draw1')` is `1-1Z141Z3`;
      - the golden permutation test still passes unchanged.
    - **Verify:** `rtk npx vitest run tests/unit/domain/deal.test.ts tests/unit/domain/dealCode.test.ts`
      passes.

- [x] 8.3 Close the engine test gaps
    - **Implements:** E "Rejected commands change nothing", E "Move count, start flag and clock are
      engine-owned or engine-untouched" (scenario "The engine never moves the clock"), S "Standard move
      scoring" (floor), S "Vegas bankroll"; D1, D6, D8, D16.
    - **Files:** `tests/unit/domain/engine.move.test.ts`, `tests/unit/domain/engine.draw.test.ts`,
      `tests/unit/domain/engine.fullGame.test.ts`. No source change.
    - **Tests:**
      - `engine.move.test.ts`:
        - waste → waste and foundation → the same foundation are refused with `'illegal-target'`
          and the same reference;
        - Standard foundation → tableau from a stored score of 10 leaves 0;
        - Vegas foundation → tableau lowers the bankroll by 5;
        - one `Record<RejectReason, …>` table (replacing the two partial `OWNED_REASONS` records)
          produces each of the five reasons exactly, including the Vegas pass-3 recycle and the
          empty stock and waste;
      - `engine.draw.test.ts`: its partial reason record is removed; its behaviour tests stay;
      - `engine.fullGame.test.ts`: at every replayed step, `elapsedMs`, `seed`, `mode`, `draw`,
        `scoring`, `verdict` and `attempts` equal the deal's values.
    - **Verify:** `rtk npx vitest run tests/unit/domain/engine.move.test.ts tests/unit/domain/engine.draw.test.ts tests/unit/domain/engine.fullGame.test.ts`
      passes.

- [x] 8.4 Close the card-model and deal-code test gaps
    - **Implements:** C "Card labels are locale-independent keys" (scenario "No translated text in the
      card model"), D "Deal code round-trip" (scenario "A code reproduces its deal") *(KS-A11Y-01,
      KS-DEAL-02)*.
    - **Files:** `tests/unit/domain/cards.test.ts`, `tests/unit/domain/dealCode.test.ts`,
      `tests/unit/domain/deal.test.ts`, `tests/fixtures/deals.ts` (the shared `deckOrderOf` helper
      moves here). No source change.
    - **Tests:**
      - `cards.test.ts`: every string reachable from the module's exported non-function values, and
        from `cardLabels(id)` for ids 0–51, is a rank label, a suit key or a suit symbol;
      - `dealCode.test.ts`: dealing the decoded code of the golden deal reproduces the full golden
        deck order.
    - **Verify:** `rtk npx vitest run tests/unit/domain/cards.test.ts tests/unit/domain/dealCode.test.ts tests/unit/domain/deal.test.ts`
      passes.

- [x] 8.5 Harden the domain purity guard
    - **Implements:** P "The pure domain layer is isolated from the rest of the application"
      (scenarios "A platform dependency fails the check" and "The entropy source is confined and
      injectable"); D10.
    - **Files:** `tests/unit/repo/domainPurity.test.ts`.
    - **Tests:**
      - comment stripping keeps string and template literals, so `const u = 'https://x'; fetch(u)`
        flags `fetch`, and `'// not a comment'` hides nothing;
      - `navigator`, `indexedDB`, `caches`, `XMLHttpRequest`, `WebSocket` and `EventSource` are each
        flagged;
      - the domain files that reference `crypto` are exactly `['prng.ts']` (replaces `it.skipIf`).
    - **Verify:**
      - `rtk npx vitest run tests/unit/repo` passes;
      - temporarily adding `navigator.onLine` to a domain file fails the suite, and is then reverted.

- [x] 8.6 Refresh the domain and tests READMEs
    - **Implements:** constitution principle 9.
    - **Files:** `src/domain/README.md` (name `isCardId`, `orderedDeck`, `eventDelta`, `commandDelta`
      and `applyDelta`; keep the module bullet format the inventory test parses); `tests/README.md`
      (e2e was "added in Phase 1", not "task 5.1").
    - **Tests:** none new.
    - **Verify:**
      - `rtk npx vitest run tests/unit/repo` passes (inventory test);
      - every symbol named in `src/domain/README.md` is a real export;
      - `rtk npm run validate` passes.
