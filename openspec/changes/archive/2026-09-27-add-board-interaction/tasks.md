# Tasks

> **Conventions.**
> - Run commands through `rtk` (`rtk proxy <cmd>` when the wrapper rejects a flag).
> - Vitest tests are `*.test.ts(x)` in `tests/`, mirroring `src/`; component tests live in
>   `tests/component/`. Playwright specs are `tests/e2e/*.spec.ts`.
> - Requirement names refer to this change's delta specs:
>   - **IN** `specs/features/interaction`
>   - **AS** `specs/domain/assistance`
>   - **GS** `specs/features/game-session`
>   - **BI** `specs/ui/board-input`
>   - **BK** `specs/ui/board-keyboard`
>   - **BA** `specs/ui/board-assist`
>   - **WC** `specs/ui/win-cascade`
>   - **NT** `specs/ui/notices`
>   - **BL** `specs/ui/board-layout`
>   - **BR** `specs/ui/board-render`
>   - **GM** `specs/ui/game-screen`
>   - **RF** `specs/tooling/repository-foundation`
> - `Dn` is `design.md` decision *n*. Read every decision a task names before coding.
> - Shared references:
>   - **spec:** `docs/spec/specification.md` §3.2, §4.2–4.8, §8.3 and §9.4–9.5, §9.10 (the KS ids);
>   - **research:** `docs/spec/research.md` R§6, R§8, R§9;
>   - **phased-design:** `docs/spec/phased-design.md` §3.3, §4 rows Drag, Keyboard, Finish, Hint, Dead
>     end, Smart tap and Cascade, and Phase 6 (L338–358);
>   - **mockup (visual authority):** `docs/spec/mockup/klondike-mockup.html`: selection L223; ghosts
>     L240–244 and `showGhosts` L964–974; drag L201–205 and L1325–1403; shake L225/L229/L1418; hint L228,
>     `findMoves` L1097–1135, `showHint` L1137–1161; toast L304–305 and L1482; finish L956–963 and
>     L1169; cascade L1212–1231; keyboard L1423–1442; screens `08`, `09`, `12`;
>   - **domain API:** `src/domain/README.md`; **state API:** `src/features/README.md`.
> - Build positions with `makeState`, `faceUp`, `faceDown`, `tableauOf`, `foundationsOf`,
>   `vegasAtLimit` from `tests/fixtures/states.ts`, and stores with
>   `createAppStore({ preloadedState, deps: { dealService: fakeDealService() } })`.
> - No in-process test uses real timers, a real `ResizeObserver`, real `matchMedia` or real browser
>   storage; inject or stub them (through `tests/support/` once task 2.1 lands).
> - Every module added to `src/ui` or `src/features` is described in that package's README in the
>   same task.
> - Every task ends with `rtk npm run test:unit` and `rtk npm run lint` green. Tasks that add or
>   change a Playwright spec also run the named `rtk npx playwright test …` command. Before each task
>   commit, run the full, unmodified `rtk npm run validate` and fix everything it reports.
> - Groups 1–2 change no behaviour: their tests are the existing suites plus the new ones named.
> - Type-check with `rtk npm run typecheck` (there is no separate tests tsconfig; `tsconfig.app.json`
>   includes `tests`).
> - Component and e2e tests written before task 7.1 locate cards with `[data-card-id]` or
>   `getByLabelText`, never `getByRole('img')` or `getByRole('group')`, so the role change in 7.1 does
>   not break them.
> - `tests/unit/repo/boardPurity.test.ts` treats every README bullet of the form
>   ``- `board/name.ts` `` (line-start, letters-only basename) as a pure module. Describe the hooks and
>   other non-pure files (`useBoardPointer`, `useCascade`, `constants`, …) in the README's existing
>   bold-name form, never as a line-start `` - `board/x.ts` `` bullet.
> - Mockup line numbers are references into `docs/spec/mockup/klondike-mockup.html`; verify a number
>   before relying on it (the drag rectangle is `dropTarget` L1351–1365, `landingFor` is L910–917,
>   `showHint` is L1144–1161, `handleTap` is L1381–1403).

## 1. Groundwork: domain and state layer

- [x] 1.1 Split `assist.ts` by concern and share the pile and suit constants
    - **Implements:** D13 (no requirement changes; behaviour identical).
    - **References:** `src/domain/assist.ts` (`isSafe`, `nextSafeMove`, `hint`, `isDeadEnd`,
      `bestTarget`, `finishPlan`); `TABLEAU_COLS` in `assist.ts` and `Board.tsx`; `SUITS` in
      `assist.ts` and `solver.ts` (the solver has no `TABLEAU_COLS`); both also redeclared in
      `tests/fixtures/deals.ts` L83–84; `src/domain/README.md` (`tests/unit/repo/domainPurity.test.ts`
      requires `src/domain/*.ts` to equal its bullet list exactly); `tests/unit/domain/`.
    - **Importers to update:** src — `features/deal/dealService.ts`, `features/game/gameSlice.ts`,
      `features/game/gameThunks.ts`, `solver/hint.ts` (type import); tests —
      `unit/features/deal/dealService.hint`, `unit/features/game/{autoSafe,finish}`,
      `unit/solver/hint`, `unit/domain/engine.fullGame`, `unit/domain/assist.{finish,hint,bestTarget,deadEnd,safe}`;
      docs — `docs/spec/phased-design.md` mentions of `assist.ts`.
    - **Files:**
      - New `src/domain/{safeMoves,hint,smartTap,finish,deadEnd}.ts`; delete `assist.ts`.
      - `src/domain/cards.ts`: export `TABLEAU_COLS` and `SUITS`.
      - Update imports in `src/features/**`, `src/solver/**` (constants only, keep its purity guard),
        `src/ui/board/Board.tsx`, `tests/**`.
      - `src/domain/README.md`: one line per new module (remove `assist.ts`).
    - **Tests:** existing domain suites stay green with moved imports; rename the five
      `tests/unit/domain/assist.*.test.ts` files to their new module names; add
      `tests/unit/domain/constants.test.ts`: `TABLEAU_COLS` is 0–6 and `SUITS` is 0–3. That there is one
      declaration is enforced by the single import (typecheck), not by a source scan.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/solver tests/unit/repo` passes.

- [x] 1.2 Add `advise` and `positionKey`
    - **Implements:** AS "One advice for a position", "Position identity"; *KS-AST-02*, *KS-AST-06*;
      D13.
    - **References:** R§6.1, R§6.4; `hint.ts`, `deadEnd.ts` from 1.1; `tests/fixtures/states.ts`.
    - **Files:** `src/domain/deadEnd.ts` (`advise(state): Advice | undefined`, `Advice = { kind: 'dead-end' } | Hint`;
      not `hint.ts`, which `deadEnd.ts` imports); new
      `src/domain/position.ts` (`positionKey(state): string`); `src/domain/README.md`.
    - **Tests:** new `tests/unit/domain/advise.test.ts` (dead end beats draw, productive move,
      useful draw, determinism, recycle when no dead end) and `tests/unit/domain/position.test.ts`
      (time-only difference equal, move changes, flip changes, undo count ignored).
    - **Verify:** `rtk npx vitest run tests/unit/domain/advise tests/unit/domain/position` passes.

- [x] 1.3 One `HintOutcome`, `SolverHint` derived from `Hint`
    - **Change:** the deal service keeps `HintOutcome`; the worker client's differently shaped
      `HintOutcome` is renamed `SolverHintOutcome` (a shared type is impossible: the shapes differ and
      `dealService.ts` imports `solverClient.ts`).
    - **Implements:** D13 (no requirement change).
    - **References:** `src/features/deal/dealService.ts` (L47), `solverClient.ts` (L22),
      `src/solver/hint.ts` (L7), `src/solver/protocol.ts`.
    - **Files:** `src/solver/hint.ts`, `src/features/deal/solverClient.ts` (rename and its uses),
      `src/features/README.md`; `dealService.ts` is unchanged.
    - **Tests:** existing `tests/unit/features/deal/*` and `tests/unit/solver/*` green; a
      compile-time assertion in `tests/unit/solver/hintType.test.ts` that `SolverHint` equals
      `Omit<MoveHint,'priority'> | Exclude<Hint, MoveHint>` (via a type-level helper).
    - **Verify:** `rtk npm run typecheck` and `rtk npx vitest run tests/unit/features/deal tests/unit/solver`
      pass.

- [x] 1.4 Stabilise `selectFinishable`, tidy the game slice, make `AppState` readonly
    - **Implements:** GS "Finish availability is stable across clock ticks"; *KS-AST-05*; D13.
    - **References:** `gameSlice.ts` L98–99 (identical `accrued` branches), L107, L131–138,
      L150–157; `ui/board/selectors.ts` `selectBoardPiles` (a UI selector typed on `RootState`, so the
      pattern only — `gameSlice` uses the structural `GameRoot`); `appSlice.ts`; garbled comment
      `gameThunks.ts` L210–211.
    - **Files:**
      - `src/features/game/gameSlice.ts`: `selectFinishable` is memoised (`createSelector` with `lruMemoize` and an
        `equalityCheck` over the pile arrays plus `draw`, `passes`, `mode`, `status`) and feeds `selectCanFinish`; merge the duplicate `accrued` branches; drop the
        `{...game, current}` narrowing copy.
      - `src/app/appSlice.ts`: `readonly` fields, `readonly` notice array type.
      - `src/features/game/gameThunks.ts`: fix the comment.
    - **Tests:** new `tests/unit/features/game/finishable.test.ts`: with a finishable position and
      `vi.mock` of `src/domain/finish.ts` (`importActual`, counting `finishPlan` calls), 20 `accrued`
      ticks call it once;
      after a move it is called again ("Clock ticks", "Piles change"). Existing slice tests green.
    - **Verify:** `rtk npx vitest run tests/unit/features/game tests/unit/app` passes.

- [x] 1.5 Extract the shared sequence runner
    - **Implements:** D14 (no requirement; behaviour of the existing sequences; *KS-AST-04*,
      *KS-AST-05*).
    - **References:** `gameThunks.ts` `chainSafeCards` (L98–123) and `finish` (L151–172);
      `tests/unit/features/game/` chain and finish suites.
    - **Files:** `src/features/game/gameThunks.ts` (`runSequence`; the two thunks become thin);
      `src/features/README.md`.
    - **Tests:** existing chain/finish suites unchanged and green; add the new file
      `tests/unit/features/game/sequence.test.ts`: "Game replaced mid-sequence" (new deal installed
      while waiting → stops, the new game's `busy` untouched) and "A step throws" (busy cleared,
      rejection reaches the caller) for both sequences.
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

- [x] 1.6 Report acceptance and events from `commitCommand` and `play`
    - **Implements:** GS "Player commands advance the game" (MODIFIED); *KS-A11Y-02*, *KS-MOVE-05*;
      D14.
    - **References:** `gameThunks.ts` `commitCommand` (L56–80), `play` (L132); callers in
      `tests/**`; `RejectReason` in `src/domain/types.ts`.
    - **Files:**
      - `src/features/game/gameThunks.ts`: `CommitResult = { accepted, events }`; `commitCommand` and
        `play` return it (for `play`, the player's command's result, after the chain); safe-chain
        and finish steps use it internally; a refused command's `rejected` event is reported.
      - Adjust callers to the new return type: only `gameThunks.ts` calls `commitCommand`; `play` is
        called by no `src/ui` code yet and by tests (`unit/features/persistence/resetThunks.test.ts`
        L77 and L179, `startRestart`, `autoSafe`, `play`, `persistenceWriter`, `appLifecycle`,
        `appShell`). `resetThunks.ts` itself does not call it.
    - **Tests:** extend `tests/unit/features/game/play.test.ts`: "A rejected move reports why"
      (Vegas pass-limit recycle → `rejected: pass-limit`), "An accepted move reports its events"
      (move + flip), and that a rejected command still changes nothing (existing scenario).
    - **Verify:** `rtk npx vitest run tests/unit/features/game` and `rtk npm run typecheck` pass.

## 2. Groundwork: UI and test support

- [x] 2.1 Share the test doubles
    - **Implements:** D13 (no requirement).
    - **References:** `FakeResizeObserver` in `board.test.tsx` (L22–37), `dealAnimation.test.tsx`
      (L15–30), `useBoardSize.test.tsx` (L9); `matchMedia` stubs in `board.test.tsx` (L47–52),
      `gameFrame.test.tsx` (L14–31, matchMedia only), `useMediaQuery.test.tsx` (L25),
      `appLifecycle.wiring.test.tsx` (L18–65); `tests/setup.ts` (inert `ResizeObserver`, never-matching
      `matchMedia`).
    - **Files:** new `tests/support/fakeResizeObserver.ts`, `tests/support/matchMedia.ts`; migrate the
      test files above where semantics allow (the wiring test keeps its own per-query fake if it must);
      `tests/README.md` lists `tests/support/`.
    - **Tests:** the migrated suites stay green; there is no scan test (the single import is enforced
      by typecheck).
    - **Verify:** `rtk npx vitest run tests/component` and `rtk npm run typecheck` pass.

- [x] 2.2 Shared `Icon`, typed rank words, shared constants, named selectors, constant/token test
    - **Implements:** D13 (no requirement change).
    - **References:** SVG stroke attributes in `Toolbar.tsx` (L6–19), `GameScreen.tsx` (L31–40),
      `PileSlot.tsx` `RecycleMark` (L26–38); `names.ts` `RANK_WORDS` (keyed by rank label with a
      `?? rank` fallback; `Rank` in `src/domain/cards.ts:3` is numeric, `rankOf(id)` reads it);
      `TEXT_PRESENTATION` (`CardView.tsx:8`), `BADGE_Z` (`layout.ts`), imports at `PileSlot.tsx:5`,
      `StockBadge.tsx:2`; inline reads in `Board.tsx` (L47–48), `GameScreen.tsx` (L19), `Hud.tsx`
      (L25); `animations.ts` L4–12 and `tokens.css` (`--motion-deal-step`, `--card-radius-factor`);
      `Board.tsx` L20–22.
    - **Files:**
      - New `src/ui/components/Icon.tsx`; use it in the three places.
      - `src/ui/board/names.ts`: `RANK_WORDS` typed `Record<Rank, string>` (numeric `Rank`), read with
        `rankOf(id)`, no fallback.
      - New `src/ui/board/constants.ts` for `TEXT_PRESENTATION` and `BADGE_Z`; update imports.
      - Export `DEAL_STEP_MS` from `animations.ts` (it is private) and move `CARD_RADIUS_FACTOR`
        (private in `Board.tsx` L22, not in `animations.ts`) into `constants.ts`, so the token test
        can import both.
      - `src/app/selectors.ts`: `selectDealing`, `selectBusy`, `selectEpoch`, `selectCurrentGame`;
        use them in `Board`, `GameScreen`, `Hud`.
      - `src/ui/README.md`.
    - **Tests:** new `tests/unit/ui/motionConstants.test.ts`: `DEAL_STEP_MS` equals `--motion-deal-step` and the
      card-radius factor equals `--card-radius-factor` (`FLIP_LEAD_MS` and `SETTLE_MS` have no token and
      are not compared); `names.test.ts` and the other existing UI suites stay green.
    - **Verify:** `rtk npx vitest run tests/unit/ui tests/component` passes.

- [x] 2.3 Move the resize and deal effects out of `Board`
    - **Implements:** D13 (no requirement change; motion and layout specs unchanged).
    - **References:** `Board.tsx` L65–97 (the resize-flag effect L65–75, the `dealOrderRef` effect
      L77–81 which moves with `useDealAnimation`, and the deal effect); `tests/component/board.test.tsx`,
      `dealAnimation.test.tsx`, `useBoardSize.test.tsx`; `src/ui/README.md`.
    - **Files:** new `src/ui/board/useResizeSettle.ts` (the `data-resizing` flag) and
      `src/ui/board/useDealAnimation.ts` (epoch claim, `playDeal`, give-back); `Board.tsx` composes
      them and shrinks; `src/ui/README.md`.
    - **Tests:** existing board, deal-animation and resize suites pass unchanged; add
      `tests/component/useResizeSettle.test.tsx`: the flag is set for the first size and each real
      size change and cleared one frame later.
    - **Verify:** `rtk npx vitest run tests/component` passes; `rtk npx playwright test motion resize
      --project=chromium` passes.

## 3. Interaction state

- [x] 3.1 Add the `interaction` slice: selection, its resets and the `selectCard` thunk
    - **Implements:** IN "Selection is a single pile position"; *KS-INP-02*, *KS-AST-01*; D1.
    - **References:** `gameSlice.ts` actions (`committed`, `replaced`, `undone`, `redone`,
      `installed`, `cleared`); `src/domain/rules.ts` `groupAt`, `isMovable`, `legalTargets`;
      `src/app/store.ts` (`combineReducers` over app, preferences, stats, game, persistence);
      `persistenceWriter.ts` L63–66 (the writer's explicit `Snapshot` field list).
    - **Files:**
      - New `src/features/interaction/interactionSlice.ts` (selection, `selectionSet`,
        `selectionCleared`; `extraReducers` on the game actions above — `interaction` imports
        `gameSlice`, never the reverse; selectors take structural root types like `GameRoot`) and
        `selectors.ts` (`selectSelection`, `selectSelectedGroup`, `selectLegalTargets` derived from the
        current position, `undefined` when stale).
      - New `src/features/interaction/interactionThunks.ts` with `selectCard(from, index)`: reads
        `game.current`, requires `groupAt` to return a group, then dispatches `selectionSet`, else
        clears the selection (a reducer cannot see the game). `interactionThunks` never imports
        `gameThunks`.
      - `src/app/store.ts`: register the reducer (and `RootState`).
      - `src/features/README.md`; `docs/spec/phased-design.md` §3.3 (selection and hint live in
        `interaction`, not `game`) and §3.1 file list.
    - **Tests:** new `tests/unit/features/interaction/selection.test.ts`: `selectCard` selects a
      movable run, refuses a face-down card and a non-movable card; the selection is cleared by an
      accepted move / undo / redo / restart / clear / a new selection; and the persistence writer does
      not write on selection changes.
    - **Verify:** `rtk npx vitest run tests/unit/features/interaction tests/unit/features/persistence`
      passes.

- [x] 3.2 Announcement descriptors, emitted from commits, undo and redo
    - **Implements:** IN "Announcements describe what happened"; *KS-A11Y-02*, *KS-MOVE-05*; D6, D14.
    - **References:** `GameEvent` in `src/domain/types.ts`; `commitCommand` result (1.6);
      `undo`/`redo` thunks.
    - **Files:** `interactionSlice.ts` (`announced(items)`, `announcement { seq, items: { n, item }[] }` — an append-only log trimmed to the latest 20, so a later batch never overwrites an earlier one; the
      `Announcement` union: moved, drew, recycled, undone, redone, hinted, refused, deadEnd,
      sentHome{count}, won); `gameThunks.ts` dispatches `announced` from `commitCommand` for a
      player command, and from `undo`, `redo`; steps of a safe-card chain or Finish commit without an
      announcement and `runSequence` (1.5) dispatches one `sentHome{count}` (cards sent to the
      foundations) when the sequence ends, only when the count is above zero, followed by `won` in the same call when the
      sequence's last step won the game (a Finish that wins announces `sentHome` and `won`);
      `play` dispatches a move's announcement, and a dead end raised in the same tick (3.3), in one
      `announced` call.
    - **Tests:** `tests/unit/features/interaction/announcements.test.ts`: a move, a draw, a recycle,
      a refusal (with reason), undo, redo each produce the right descriptor; a chain of 3 safe cards
      and a 20-card Finish each produce exactly one `sentHome` with the count and no per-step
      announcements; a Finish that wins produces `sentHome` then `won`; a move that leaves a dead end
      keeps both the `moved` and the `deadEnd` items; `seq` increases per batch; clock ticks produce none.
    - **Verify:** `rtk npx vitest run tests/unit/features/interaction tests/unit/features/game`
      passes.

- [x] 3.3 `requestHint` and the dead-end check; the two new notice ids
    - **Implements:** IN "Hints come from the solver line or the heuristic", "The dead end is
      reported once per position"; *KS-AST-02*, *KS-AST-03*, *KS-AST-06*, *KS-MOVE-05*; D7, D8.
    - **References:** `DealService.hint` (`dealService.ts` L89, L191); `advise`, `positionKey` (1.2);
      `ThunkExtra.delay`; `appSlice.ts` `NoticeId`; `tests/fixtures/dealService.ts`
      (`fakeDealService`).
        - **Files:**
      - `tests/fixtures/dealService.ts`: `fakeDealService.hint` always answers `none` (L64); make it
        controllable (a settable outcome and a deferred answer).
      - `interactionSlice.ts`: `hint`, `hintSet`, `hintCleared`, `pendingHint`, `deadEndSeen`, reset
        rules (setting changes also clear the hint).
      - `interactionThunks.ts` (created in 3.1): `requestHint()` (advise first; epoch and position
        guard; 2,200 ms clear by injected `delay` with a token; a request whose `{epoch, positionKey}`
        equals `pendingHint` returns without asking again) and `checkDeadEnd()`.
      - `src/app/appSlice.ts`: `NoticeId` gains `'dead-end'` and `'no-redeals'`.
      - `gameThunks.ts`: `play` and `finish` call `checkDeadEnd` after the settled position (not
        undo/redo); a `pass-limit` refusal raises `no-redeals`.
    - **Tests:** new `tests/unit/features/interaction/hint.test.ts` (a solver-sourced outcome is used;
      a heuristic-sourced outcome (the deal service's own timeout fallback) is shown; `none` and
      `cancelled` are dropped; draw hint targets the stock; stale answer dropped after a move;
      expiry clears; a newer hint is not cleared by an older timer; no game change or score change)
      and `deadEnd.test.ts` (first time; same position again not repeated; restart forgets; not after
      undo). Fake `delay` is controlled by the test.
    - **Verify:** `rtk npx vitest run tests/unit/features/interaction` passes.

- [x] 3.4 The input gate
    - **Implements:** IN "The input gate closes the board"; *KS-INP-09*; D2.
    - **References:** `appSlice.ts` (`dealing`, `sheet`, `route`); `gameSlice.ts` (`busy`, status);
      `src/app/selectors.ts` (2.2); `history.ts` `canUndo`/`canRedo` (already unavailable after a win).
    - **Files:** new `selectInputEnabled` in `src/features/interaction/selectors.ts` (structural root
      type; no cascade term — the game is won for the whole cascade); `src/features/README.md`.
    - **Tests:** `tests/unit/features/interaction/gate.test.ts`: one case per closing condition
      ("Dealing", "A sheet is open", "After a win", busy, no game, home route) and open in the plain
      case.
    - **Verify:** `rtk npx vitest run tests/unit/features/interaction` passes.

## 4. Pure input modules

- [x] 4.1 `locate.ts`: card id to pile and index
    - **Implements:** BK (supports "Cards and piles have roles and state"), BI (supports every hit
      resolution); D3.
    - **References:** `src/ui/board/selectors.ts` (`selectBoardPiles`, `BoardPiles`);
      `tests/unit/repo/boardPurity.test.ts`; `src/ui/README.md` list; `eslint.config.js` override.
    - **Files:** new `src/ui/board/locate.ts` (`cardIndex(state)` (a `GameState`, since `isMovable`/`groupAt` need it; the UI supplies it from the
      game selector): id → `{ from, index, faceUp,
      movable }`, `movable` from `isMovable`/`groupAt` in `src/domain/rules.ts`); add it to the `src/ui/README.md`
      pure list and the ESLint override.
    - **Tests:** new `tests/unit/ui/board/locate.test.ts` (the `boardPositions` fixtures plus positions built with
      `makeState`/`foundationsOf` — only one `boardPositions` position has foundation cards: stock, waste
      top only movable in Draw 3, foundation top, column runs, face-down unmovable); the purity guard lists it and passes.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/locate tests/unit/repo` passes.

- [x] 4.2 Landing areas and largest-overlap pick; export the waste anchor
    - **Implements:** BL "Landing areas"; *KS-INP-05*, *KS-INP-06*, *KS-A11Y-04*; D3.
    - **References:** `layout.ts` `anchorsOf` (L110, private) and `Layout`; `metrics.ts`; mockup
      `dropTarget` L1351–1365 (the formula: `y = tabY`, `h = (next − tabY) + 1.2 × card height`) and
      `landingFor` L910–917; `tests/fixtures/viewports.ts` (the supported sizes, research R§13.1).
    - **Files:** `src/ui/board/layout.ts` (export the waste anchor); new `src/ui/board/landing.ts`
      (`landingAreas` — column areas clipped to the board rectangle —, `pickLargestOverlap`, `pileKey`,
      and `nextLanding` (the position where the next card would land on a column; the legal-target
      ghost of 6.2 is drawn there, not over the tall rectangle)); guard list and ESLint override;
      `docs/spec/phased-design.md` §4 row Layout (landing rects now built) and §3.1;
      `src/ui/README.md` L174 (names the three existing pure modules).
    - **Tests:** new `tests/unit/ui/board/landing.test.ts` covering every BL scenario (foundation =
      slot, column reach at 1.2 card heights below the next landing position, empty column, stock and
      waste = slot / anchor, 40/60 overlap, no overlap, tie → lowest, mirror) and a sweep over every
      supported size asserting each area (column areas after clipping) lies inside the board and column areas do not overlap each
      other.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board tests/unit/repo` passes.

- [x] 4.3 The pointer state machine
    - **Implements:** BI "Drag with a threshold", "Drop on the largest overlap", "Double-tap sends a
      single card home", "Board input is ignored while the gate is closed" (machine side);
      *KS-INP-03…07*, *KS-INP-09*; D3.
    - **References:** mockup L1325–1403 (press, threshold, `handleTap` L1381–1403, double-tap
      `now − lastTap.t < 320`); research R§8; phased-design Phase 6 guardrail 1.
    - **Files:** new `src/ui/board/pointerController.ts` (types `PointerEvent`-free: `Input` union,
      `Effect` union, `step(state, input) → { state, effects }`, `initialPointerState`); guard list
      and ESLint override; `src/ui/README.md` (states and events).
    - **Tests:** new `tests/unit/ui/board/pointerController.test.ts` (no browser): mouse 4 px no drag,
      6 px drag; touch 8 px no drag, 10 px drag; pen uses touch threshold; tap when released before
      the threshold; no tap after a drag ("No tap after a drag"); stock not draggable; a tap 319 ms after
      a tap on the same card is `double`, one at exactly 320 ms or 321 ms, or on a different card, is
      not (the controller only marks `double`; the binder in 6.4 decides what it does); non-primary mouse
      button ignored; second pointer ignored; Escape, resize, cancel and gate-closed each cancel a
      drag and yield `cancel`; `dragMove` deltas accumulate from the press point; press on a
      non-movable card can only tap.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/pointerController tests/unit/repo` passes.

- [x] 4.4 The keyboard controller
    - **Implements:** BK "Focus moves between piles and cards", "Enter and Space act as a tap"
      (`pickUp`), "Shortcuts" (controller side); *KS-INP-08*; D3, D6.
    - **References:** spec §4.8; mockup L1423–1442; `FOUNDATION_DISPLAY_ORDER`; `stockRight`
      mirroring in `layout.ts`.
    - **Files:** new `src/ui/board/keyboardController.ts` (`pileOrder`, `moveFocus`, `keyToAction`);
      guard list and ESLint override; `src/ui/README.md`.
    - **Tests:** new `tests/unit/ui/board/keyboardController.test.ts`: order stock, waste,
      foundations (♥ ♣ ♦ ♠), columns 0–6, mirrored with Stock on the right; Tab and Shift+Tab step
      and return `undefined` past the ends; Left/Right between piles; Up/Down within a column
      clamped to face-up cards, never a face-down one; an empty foundation or column is a stop but an empty waste is skipped; `keyToAction`
      for Ctrl+Z, ⌘+Z, Ctrl+Y, Ctrl+Shift+Z, H, A, N, P, Space, Enter, Esc, and `pickUp` for
      Shift+Enter and Shift+Space, ignores other Ctrl
      combinations and shifted letters, and ignores events from text inputs.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/keyboardController tests/unit/repo` passes.

## 5. Drag first

- [x] 5.1 Card and slot data attributes, drag CSS and gesture suppression
    - **Implements:** BI "The page does not scroll or zoom from the board"; *KS-INP-10*; D4, D6
      (attributes).
    - **References:** `CardView.tsx` L57–67, `PileSlot.tsx` L75, `board.css`, `cards.css`;
      `tests/unit/ui/boardCss.test.ts`; `layoutCss.test.ts`; `tokens.test.ts` (no colour literals, no
      `prefers-reduced-motion`).
    - **Files:**
      - `CardView.tsx`: `data-pile`, `data-index` (from `cardIndex`); `PileSlot.tsx`: `data-pile`.
      - `board.css`: `.board { touch-action: none; user-select: none; -webkit-user-select: none;
        -webkit-touch-callout: none; }`.
      - `cards.css`: `.card.is-dragging` rule (D4) with the `!important` z-index and a comment saying
        why; `src/ui/styles/tokens.css`: the `--drag-z-base` token (created here, not in 6.1); `:root[data-motion='off']` needs no change.
      - `src/ui/README.md`.
    - **Tests:** update `tests/component/cardView.test.tsx` and `pileSlot.test.tsx` for the data
      attributes; new static CSS assertions in `tests/unit/ui/boardCss.test.ts` (touch-action none,
      no user-select, `is-dragging` disables transition) ("Touch drag" is proven in 5.3).
    - **Verify:** `rtk npx vitest run tests/unit/ui tests/component/cardView tests/component/pileSlot`
      passes.

- [x] 5.2 `useBoardPointer`: drag, drop, glide-back, cancel
    - **Implements:** BI "Drag with a threshold", "Drop on the largest overlap", "Board input is
      ignored while the gate is closed"; *KS-INP-04…07*, *KS-INP-09*; D4, D11 (drag row).
    - **References:** 4.1–4.3; `Board.tsx`; `play` thunk (returns the result, 1.6);
      `selectInputEnabled` (3.4); `selectCard` and `selectionCleared` (3.1); mockup L1338–1373.
    - **Files:**
      - New `src/ui/board/useBoardPointer.ts`: delegated listeners on the board element; resolves the
        hit from `event.target.closest('[data-card-id]')` or by `landingAreas`; pointer capture;
        feeds the controller; applies `dragStart` (class, `--k`, selection), `dragMove` (`--dx`,
        `--dy`), `drop` (largest overlap among `legalTargets` → `play(move)`, else glide back),
        `cancel`; suppresses the `click` after a drag; `contextmenu` swallowed. `tap` effects are
        ignored here (they are wired in 6.3–6.5); a drag start calls `selectCard`.
      - `Board.tsx`: wires the hook; the `[size]` effect (in `useResizeSettle` after 2.3) calls the
        controller's `resize` (D4). Ending a drag (drop or cancel) clears the selection its start made
        (`selectionCleared`), so the ghosts go.
      - New `tests/support/pointer.ts`: jsdom has no `setPointerCapture`/`releasePointerCapture`, so the
        stub (and a helper to dispatch pointer events with `clientX/Y`, `pointerType`, `pointerId`)
        lives here.
      - `src/ui/README.md`; `docs/spec/phased-design.md` §4 rows Drag and Viewport changes.
    - **Tests:** new `tests/component/boardDrag.test.tsx` (real store, jsdom pointer events with
      stubbed rects): a drag past the threshold dispatches `play(move)` to the largest-overlap legal
      column; release over nothing changes nothing and clears `--dx/--dy`; no `play` after a drag
      release (no tap); Esc, resize and a closed gate cancel; input ignored while dealing, in a sheet,
      after a win; `setPointerCapture` failure does not throw.
    - **Verify:** `rtk npx vitest run tests/component/boardDrag` passes.

- [x] 5.3 End-to-end drag on desktop and touch, without page scroll
    - **Implements:** BI "The page does not scroll or zoom from the board"; RF "Input is proven end
      to end" (touch checks); *KS-INP-04…06*, *KS-INP-10*; D12.
    - **References:** `tests/e2e/support/{seed,cards,game}.ts` (`seedRecord`, `continueToGame`,
      `cardRect`); `boardPositions.ts` fixtures; `playwright.config.ts` projects (`chromium`,
      `firefox`, `webkit`, three device projects `iphone-17-pro`, `iphone-14-pro-max` (WebKit) and
      `galaxy-s25` (Chromium), `device-fit`); `page.touchscreen` only taps and CDP touch exists only in
      Chromium (D12).
    - **Files:** new `tests/e2e/drag.spec.ts`, runs in every project (mouse drags work everywhere; the
      touch tests skip when the project has no touch): a small seeded position with one legal
      column-to-column move; mouse drag moves it and an illegal release glides back; in `galaxy-s25`,
      a touch drag through CDP `Input.dispatchTouchEvent` moves it and `window.scrollY` is unchanged;
      in the WebKit device projects, the board's computed `touch-action` is `none` and a pointer-event
      drag (`dispatchEvent`) applies the move. The claim that iOS does not scroll is 5.4, not this task.
    - **Tests/Verify:** `rtk npx playwright test drag` (all projects) passes.

- [x] 5.4 Manual real-phone drag checkpoint (recorded, flagged for the user)
    - **Implements:** phased-design Phase 6 guardrail 2; D12.
    - **Files:** none. A `docs/manual-checks/phase-6-drag.md` checklist existed during development;
      the user ran the manual checkpoint (real phone touch-drag and PC/Edge mouse and keyboard, all
      three input paths working; PC animation slightly less smooth than on the phone, noted as a
      minor, non-blocking observation) and confirmed the result directly rather than in a file, so the
      checklist was removed at close-out (11.2) instead of being kept filled in.
    - **Verify:** the manual checkpoint passed on a real phone and on desktop Edge, confirmed by the
      user. If a browser had failed, only `useBoardPointer.ts` would be swapped (D3).

## 6. Tap paths and assistance visuals

- [x] 6.1 Tokens and assistance CSS with the no-motion path
    - **Implements:** BA "Colours meet contrast", "The selection is visible", "Hint visuals" (CSS),
      "A refused move shakes" (CSS); *KS-SET-03*, *KS-SET-04*; D5.
    - **References:** mockup L223–244 and keyframes; `tokens.css` (light and dark blocks);
      `tokens.test.ts`, `contrast.test.ts`.
    - **Files:** `src/ui/styles/tokens.css` (light and dark blocks, not the night-card block:
      `--color-legal` `#1f6f96` / `#5bc0eb`, `--color-focus` `#1d5f85` / `#f2c078`, `--color-hint-line`
      `#8a5a00` / `#f2c078`; ghost z 250 below `TABLEAU_Z` 300; the drag lift shadow
      reuses `--shadow-card`, no `rgb()` literal); `board.css` and `cards.css`: `.ghost`, `.ghost.is-hot`, `.ghost.is-hint`,
      `.card.is-selected` (a 3 px primary outline drawn outside the card edge), `.card.is-hint`,
      `.slot.is-hint`, `.card.is-shake` with keyframes, all marks as outlines outside the card edge;
      `:root[data-motion='off']` overrides (steady amber outline, no shake, no pulse).
    - **Tests:** extend `tests/unit/ui/tokens.test.ts` (`LIGHT_DARK_TOKENS`; the night-card block
      still defines exactly the card roles) and `contrast.test.ts` (a new 3:1 constant next to
      `MIN_RATIO = 4.5`: every mark colour against `--color-table` in both palettes — the measured
      values are in D5) and `boardCss.test.ts` (every new animation is
      neutralised under `data-motion='off'`; no colour literal outside `tokens.css`).
    - **Verify:** `rtk npx vitest run tests/unit/ui` passes.

- [x] 6.2 `Ghosts` and the selection ring
    - **Implements:** BA "Legal targets are marked", "The selection is visible"; *KS-AST-01*,
      *KS-INP-05*; D4, D5.
        - **References:** `selectLegalTargets` (3.1); `landingAreas` and `nextLanding` (4.2); `showGhosts` L964–974;
      `preferences.highlight`.
    - **Files:** new `src/ui/board/Ghosts.tsx` (one ghost per legal target, `pointer-events: none`,
      hot class toggled by the drag hook via `classList`); `CardView.tsx` `is-selected` from the
      selection; `Board.tsx` renders `Ghosts`; `src/ui/README.md`.
    - **Tests:** new `tests/component/ghosts.test.tsx`: selected card shows a ghost per legal target;
      Highlight legal moves off shows none; ghosts leave with the selection; hot ghost follows the
      overlap winner during a drag; selected run rings every card.
    - **Verify:** `rtk npx vitest run tests/component/ghosts` passes.

- [x] 6.3 The `activate` function: smart tap with shake and refusal announcement
    - **Implements:** BI "Smart tap sends a card to its best place"; BA "A refused move shakes";
      *KS-INP-01*; D11.
    - **References:** `bestTarget` (`smartTap.ts`); `useBoardPointer.ts` (5.2, its `tap` effect is
      currently ignored); announcement `refused` (3.2); `selectReducedMotion`; the preference
      `tapMode` (`'smart' | 'select'`) in `src/features/preferences/preferencesSlice.ts`.
    - **Files:**
      - New `src/ui/board/useBoardActions.ts`: the one `activate(hit)` function that pointer and
        keyboard share (hit → command, selection or shake). This task implements the smart-mode
        tap: `bestTarget` → `play(move)`, else add `is-shake` for 340 ms and dispatch a refusal
        announcement (under reduced motion only the announcement).
      - `useBoardPointer.ts`: its `tap` effect calls `activate`; `tapMode` is read through a named
        selector.
      - `src/ui/README.md`.
    - **Tests:** new `tests/component/boardTap.test.tsx`: Ace to foundation, run to column, no target
      shakes and leaves the position unchanged, reduced motion announces without a shake class, tap
      ignored when the gate is closed.
    - **Verify:** `rtk npx vitest run tests/component/boardTap` passes.

- [x] 6.4 Select and place, double-tap and the column tap area
    - **Implements:** BI "Select and place", "Double-tap sends a single card home"; *KS-INP-02*,
      *KS-INP-03*, *KS-A11Y-04*; D11.
    - **References:** mockup `handleTap` L1381–1403; `landingAreas` (4.2); `selectCard` and
      `selectionCleared` (3.1); `activate` (6.3).
    - **Files:** `src/ui/board/useBoardActions.ts` (extend `activate`: select mode select, place (when the
      tapped card's pile is a legal target for the selection, placing wins over re-selecting), change
      selection, clear; the `double` flag from the controller: in smart mode every double is ignored (the
      first tap already sent a fitting single card home or moved it), in select mode a fitting single
      card moves to its foundation as one counted `move` and a non-fitting double is handled as two
      ordinary taps; a tap in empty space below a column resolves to the column area);
      `useBoardPointer.ts` (passes `double` and the resolved hit); select-mode waste card is not a
      drop target.
    - **Tests:** extend `tests/component/boardTap.test.tsx`: select-then-place, tapping the top card of a legal column places (not
      re-selects), change selection, tap elsewhere clears, tap below the last card places, double-tap of a fitting single card in select
      mode moves it as one counted move, in smart mode the second tap changes nothing (a foundation top moved
      to a column by the first tap is not moved back), a non-fitting double-tap in select mode behaves as taps, exactly
      320 ms is two taps.
    - **Verify:** `rtk npx vitest run tests/component/boardTap` passes.

- [x] 6.5 Stock draw, recycle and "No redeals left"
    - **Implements:** BI "Smart tap sends a card to its best place" (stock scenarios); *KS-MOVE-03…05*;
      D11, D8.
    - **References:** `play({ type: 'draw' })`; `canRecycle`; `passLimit`; `appSlice` notices
      (`no-redeals` is added by 3.3); `vegasAtLimit` fixture.
    - **Files:** `src/ui/board/useBoardActions.ts` (extend `activate`): stock press (and the stock slot
      area) → `play(draw)`; a `pass-limit` refusal (the notice is raised by `play`, added in 3.3)
      announces.
    - **Tests:** extend `tests/component/boardTap.test.tsx`: Draw 1 and Draw 3 draw counts, recycle,
      Vegas at the limit refused with the notice raised and the position unchanged.
    - **Verify:** `rtk npx vitest run tests/component/boardTap` passes.

## 7. Keyboard

- [x] 7.1 Roles, tab stops and pressed state on the elements
    - **Implements:** BK "Cards and piles have roles and state for assistive technology"; BR
      "Accessible names for cards and piles" (MODIFIED); *KS-A11Y-01*, *KS-A11Y-03*; D6.
    - **References:** `CardView.tsx` L60–67 (`role="img"` at L64); `PileSlot.tsx` (`role="group"` at
      L75); `cardIndex` (`movable`); tests that assert the old roles:
      `tests/component/cardView.test.tsx` L81–90 (`img`), `board.test.tsx` L123–171 (12 `group`s),
      `pileSlot.test.tsx` (about 8 `getByRole('group')`), `tests/e2e/board.spec.ts` L34 (`img`) and L35
      (`group`). `motion.spec.ts` has no role queries and needs no change. `src/ui/README.md` L74 and L85 document
      the `img` and `group` roles and are updated in this task.
    - **Files:** `CardView.tsx` (`role="button"`, `tabIndex`, `aria-pressed` for movable cards; `img`
      otherwise), `PileSlot.tsx` (stock and empty targets as buttons); the tab-stop prop comes from
      the keyboard hook state, defaulting to `-1`.
    - **Tests:** update `cardView.test.tsx`, `pileSlot.test.tsx`, `board.test.tsx` and `board.spec.ts`
      for the new roles; add the BK "Movable card role", "Selected card" and
      "Face-down card" scenarios.
    - **Verify:** `rtk npx vitest run tests/component` and `rtk npx playwright test board
      --project=chromium` pass.

- [x] 7.2 `useBoardKeyboard`: roving focus, Enter/Space, focus ring
    - **Implements:** BK "Focus moves between piles and cards", "Enter and Space act as a tap"
      (including pick-up); *KS-INP-08*, *KS-A11Y-03*; D3, D6.
    - **References:** `keyboardController.ts` (4.4); `useBoardActions.ts` (6.3–6.5: the one
      `activate` function shared by pointer and keyboard); `selectCard` (3.1).
    - **Files:**
      - New `src/ui/board/useBoardKeyboard.ts` (single `tabindex=0` element, Tab/Shift+Tab handled by
        `moveFocus` with pass-through at the ends, arrows, Enter/Space → the shared activate
        function; Shift+Enter/Shift+Space → `selectCard`, and while a selection exists Enter/Space follow
        the Select-and-place rules in either setting; focus follows a moved card or lands on the
        destination pile's stop; never on a face-down card).
      - `useBoardActions.ts`: `activate` learns "selection exists → Select-and-place rules whatever the
        tap setting"; a new `pickUp` (Shift+Enter, Shift+Space) selects the card, and on the already
        selected card it, not `activate`, dispatches `selectionCleared`; the hook returns
        `{ activate, pickUp }` and pointer and keyboard share `activate` (6.3).
      - `board.css`/`cards.css`: `.board .card:focus-visible::after` (a frame outside the card edge,
        because the selection ring already uses the face's outline) and `.board .slot:focus-visible`,
        both with `--color-focus`.
      - `src/ui/README.md`.
    - **Tests:** new `tests/component/boardKeyboard.test.tsx`: Tab between piles, arrows within and
      between piles, mirrored order, leaving the board at the ends, smart move by Enter, place by
      Enter after a selection, in Smart move mode Shift+Enter picks up and Enter on a chosen column
      places, Shift+Enter on the selected card clears it, focus after a move; static CSS test
      for the focus ring.
    - **Verify:** `rtk npx vitest run tests/component/boardKeyboard tests/unit/ui` passes.

- [x] 7.3 Global shortcuts
    - **Implements:** BK "Shortcuts", "Enter and Space act as a tap" (Space with nothing focused);
      *KS-INP-08*, *KS-AST-02*, *KS-AST-05*, *KS-AST-07*; D3.
    - **References:** `keyToAction` (4.4); `undo`, `redo`, `finish`, `requestHint` thunks;
      `selectInputEnabled`; mockup L1423–1442.
    - **Files:** new `src/ui/board/useGameShortcuts.ts` (a `keydown` listener on `window` (after every `document` listener, so the `defaultPrevented` skip is order-independent) while the
      Game screen is mounted; ignores text inputs; with a sheet open only Esc closes the sheet;
      `N` and `P` mapped to no-ops with a comment pointing at Phase 7); `GameScreen.tsx` mounts it;
      `docs/spec/specification.md` §4.8 note that N and P are bound in Phase 7.
    - **Tests:** new `tests/component/gameShortcuts.test.tsx`: Space with nothing focused draws (this hook owns
      the `window` listener), undo/redo (Ctrl, ⌘, Shift variants), H,
      A when available and when not, Esc cancels a selection, sheet open ignores everything but Esc,
      N and P do nothing, text input ignored.
    - **Verify:** `rtk npx vitest run tests/component/gameShortcuts` passes.

## 8. Assistance UI

- [x] 8.0 Layout-independent letter shortcuts; no auto-repeat
    - **Implements:** BK "Shortcuts" (non-Latin layout, held key scenarios); *KS-INP-08*, *KS-AST-02*.
    - **References:** `keyboardController.ts` (`keyToAction`, `LETTER_ACTIONS`, `modifiedAction`);
      `useGameShortcuts.ts`; `useBoardKeyboard.ts` `onKeyDown`; `tests/component/gameShortcuts.test.tsx`;
      `tests/component/boardKeyboard.test.tsx`.
    - **Files:** `keyboardController.ts` (`KeyEventLike.code`; a `letterOf` helper: a single ASCII letter in
      `key` wins, else `Key[A-Z]` in `code`; used by the letter shortcuts and Ctrl/⌘ Z and Y); `useGameShortcuts.ts`
      and `useBoardKeyboard.ts` (pass `code`; a mapped action with `event.repeat` is `preventDefault`ed and
      dropped, navigation keys still repeat); `src/ui/README.md` keyboard notes.
    - **Tests:** unit cases for `keyToAction` (Ukrainian `р`+`KeyH`, `ф`+`KeyA`, Ctrl+`я`+`KeyZ`; Latin key beats a
      different code; a non-letter code is ignored); component cases: `key:'р', code:'KeyH'` requests a hint,
      repeated Space, H, A and Ctrl+Z act once, the repeat is `defaultPrevented`, held Enter/Space on the board
      activates once, held ArrowRight keeps moving focus.
    - **Verify:** `rtk npx vitest run tests/component/gameShortcuts tests/component/boardKeyboard tests/unit/ui`
      passes.

- [x] 8.1 Hint and Finish tools
    - **Implements:** GM "Hint and Finish tools", "Undo and Redo toolbar" (MODIFIED); *KS-AST-02*,
      *KS-AST-05*, *KS-A11Y-03*, *KS-A11Y-04*; D9.
    - **References:** `Toolbar.tsx`; `selectCanFinish`; `selectInputEnabled`; mockup toolbar L520–524
      and `.tool.is-ready`; `toolbar.test.tsx` L32 (asserts exactly two buttons); `gameFrame.test.tsx` (no exact-count assert);
      `tests/e2e/support/cards.ts` L54 (finds Undo/Redo through `button.tool` text — check it still
      does with four tools); `layout.css` `.tool` rules.
    - **Files:** `Toolbar.tsx` (Hint, Finish with `Icon`; `is-ready`); `layout.css` (`is-ready`,
      four tools fit at 320 px, 44 px floor); `tests/README.md` (toolbar text); `README.md` line about
      later-phase tools.
    - **Tests:** update `toolbar.test.tsx` and `gameFrame.test.tsx` (four buttons, names, order);
      add the GM scenarios: Hint requests a hint, Finish enabled and highlighted only when the
      session offers it, disabled while busy or the gate is closed, keyboard activation, touch target
      size (`layoutCss.test.ts` for the 44 px rule; `frame.spec.ts` L70–106, which today checks Back, Undo and Redo at a coarse project — extend it to Hint
      and Finish).
    - **Verify:** `rtk npx vitest run tests/component tests/unit/ui` passes; `rtk npx playwright test
      frame --project=chromium --project=galaxy-s25` passes.

- [x] 8.2 Announcer and the English formatter
    - **Implements:** NT "One polite announcer"; *KS-A11Y-02*; D6.
    - **References:** `interaction.announcement` (3.2); `names.ts` (`cardName`, `pileName`);
      `GameScreen.tsx` L48 status region; `reservedLayers.test.ts`.
    - **Files:** new `src/ui/announce.ts` (`formatAnnouncement(item): string`, pure, unit-tested);
      new `src/ui/components/Announcer.tsx` (visually hidden `role="status"`; repeated identical
      text stays audible); `GameScreen.tsx` mounts it beside the "Dealing…" status. `tests/component/appShell.test.tsx`
      L283–295 asserts exactly one `role="status"` — update it to the Dealing status plus the announcer;
      `tests/component/gameFrame.test.tsx` L79–86 asserts the exact direct children of `.screen--game`
      (`sr-only, sr-only, game-topbar, game-body, game-footer`) — update it for the announcer.
    - **Tests:** `tests/unit/ui/announce.test.ts` (one case per descriptor, e.g. "Seven of Clubs moved
      to column 4", "Drew 3 cards", "You win"); `tests/component/announcer.test.tsx` ("A move", "Same
      text twice", "Unrelated render" — clock ticks leave the text unchanged).
    - **Verify:** `rtk npx vitest run tests/unit/ui/announce tests/component/announcer` passes.

- [x] 8.3 Notices host
    - **Implements:** NT "Transient notices"; *KS-AST-06*, *KS-MOVE-05*; D8.
    - **References:** `appSlice.ts` notices, `noticeDismissed`; mockup `.notices` L304–305, L1482;
      `layout.css` safe-area rules.
    - **Files:** new `src/ui/components/Notices.tsx` (English table for the five ids; transient
      auto-dismiss 3,200 ms; storage notices with a Dismiss button; polite live region);
      `GameScreen.tsx` mounts it (update the `gameFrame.test.tsx` L79–86 child list again for the notices
      host); the host has no live region for the dead-end and `no-redeals` messages (the announcer speaks
      them), each storage notice is a `role="status"`; new styles in `layout.css` (where the safe-area rules live);
      `src/ui/README.md`.
    - **Tests:** new `tests/component/notices.test.tsx` (`vi.useFakeTimers` scoped to the test: the auto-dismiss is a
      component `useEffect` timer, presentation only): dead-end text and 3.2 s disappearance, "No redeals
      left", storage notice persists until dismissed, no focus taken, the frame does not shift
      (`gameFrame` rect assertion).
    - **Verify:** `rtk npx vitest run tests/component/notices` passes.

- [x] 8.4 Hint visuals and the hint line
    - **Implements:** BA "Hint visuals"; GM "The hint line shows the hint"; *KS-AST-02*; D5, D7.
    - **References:** `interaction.hint` (3.3); `Ghosts.tsx` (6.2); `GameScreen.tsx` L63 `.game-hint`;
      `layout.css` hint-line display rules (L275–287); mockup L1137–1161.
    - **Files:** `CardView.tsx` (`is-hint` on source cards); `Ghosts.tsx` (hint ghost on the target
      area); `PileSlot.tsx` (`is-hint` for the stock/slot); `GameScreen.tsx` (the hint line renders
      the hint text through the `announce.ts` formatter from 8.2; `gameFrame.test.tsx` L68 asserts
      `.game-hint` is empty and must be updated); pointer press clears the hint (`hintCleared`).
    - **Tests:** new `tests/component/hintVisuals.test.tsx`: hint on a column move marks the source
      cards and target ghost; hint to draw marks the stock; hint line shows the text and empties on
      expiry; reduced motion shows the steady outline; the side-rails profile (hint line hidden)
      still highlights and announces.
    - **Verify:** `rtk npx vitest run tests/component/hintVisuals` passes.

## 9. Win

- [x] 9.1 Pure cascade frames
    - **Implements:** WC "The cascade plays on a win" (path side); D10.
    - **References:** mockup L1212–1231; `FOUNDATION_DISPLAY_ORDER`; purity guard.
    - **Files:** new `src/ui/board/cascadeFrames.ts` (pure: `cascadeOrder()`, `cascadeFrames(starts,
      size, cardSize, rng)`), listed in `src/ui/README.md` and the ESLint override.
    - **Tests:** new `tests/unit/ui/board/cascadeFrames.test.ts`: order (K♥ first, A♠ last, K down to
      A, suits ♥ ♣ ♦ ♠), fixed rng gives identical frames, bounce keeps `y ≤ H − ch`, stops beyond
      the sides, at most 180 frames.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board tests/unit/repo` passes.

- [x] 9.2 Cascade runner and trigger
    - **Implements:** WC "The cascade plays on a win", "Input is ignored during the cascade"; IN "The
      input gate closes the board" (after a win); *KS-MOVE-07*, *KS-INP-09*, *KS-SET-04*; D2, D10.
    - **References:** `commitCommand` win path; `selectReducedMotion`; the game `status` and the
      `installed`/`cleared` actions; Web Animations API is absent in jsdom (a stub is needed).
    - **Files:**
      - New `src/ui/board/cascade.ts` (WAAPI runner, 70 ms stagger, `fill: 'forwards'`, `cancel()`).
      - New `src/ui/board/useCascade.ts`: starts the runner when the game becomes won unless motion is
        reduced, and cancels it when a new game is installed or the game is cleared; holds the
        animations in a ref and dispatches nothing (no store state: the gate is closed by the win).
      - `Board.tsx` uses it.
      - New `tests/support/waapi.ts`: an `Element.animate` stub (jsdom lacks it).
      - A `won` announcement is already emitted by 3.2; `docs/spec/phased-design.md` §4 row Cascade;
        `src/ui/README.md`.
    - **Tests:** new `tests/component/cascade.test.tsx` with the WAAPI stub: the win starts 52
      animations in order; a board press during it does nothing; a new deal cancels it; motion off →
      no animation and "You win" announced.
    - **Verify:** `rtk npx vitest run tests/component/cascade` passes.

## 10. End-to-end proof

- [x] 10.1 The `playLine` helper and fixture seeding
    - **Implements:** RF "Input is proven end to end" (helpers); D12.
    - **References:** `tests/fixtures/deals.ts` (`WINNING_LINE` seed 49 Draw 1, 117 commands;
      `parseLine`: `draw`, `autoFoundation`, `move {from, index, to}`; `d` is draw or recycle);
      `dealFromSeed` in `src/domain/deal.ts` (returns `started: false`); `tests/fixtures/games.ts`;
      `tests/e2e/support/{seed,cards}.ts` (`seedRecord`, `continueToGame`; `cards.ts` imports
      `@playwright/test`, so the pure part must not import it); `vitest.config.ts` (collects
      `tests/**/*.test.ts`, excludes `tests/e2e/**/*.spec.ts`).
    - **Files:**
      - New `tests/e2e/support/lineGestures.ts` (pure, no Playwright import): translates each
        `parseLine` command into a gesture plan for `'tap' | 'drag' | 'keyboard'` (pile and card
        index, target pile, key sequence; the keyboard plan draws by arrowing to the stock and pressing
        Enter).
      - New `tests/e2e/support/play.ts`: `seedWinningGame(page)` (`{ ...dealFromSeed(49, 'draw1'),
        started: true }`, preferences `tapMode: 'select'` and `autoSafe: false`, through
        `seedRecord`) and `playLine(page, strategy)` executing the plans using `data-pile`/`data-index`
        and the landing centres.
    - **Tests:** new `tests/unit/e2e-support/lineGestures.test.ts` (the pure part: a move from the
      waste, a 7-card run, a foundation target, a draw and the recycle each produce the right plan);
      the browser strategies are exercised by 10.2–10.4.
    - **Verify:** `rtk npx vitest run tests/unit/e2e-support` and `rtk npm run typecheck` pass.

- [x] 10.2 Win by tap
    - **Implements:** RF "Input is proven end to end" ("Win by tap"); BI Select and place, stock;
      *KS-INP-02*, *KS-MOVE-07*.
    - **Files:** new `tests/e2e/playByTap.spec.ts` (Chromium-only guard: the skip line from
      `playwrightProjects.test.ts`, and add the spec to `CHROMIUM_ONLY_SPECS` there; `test.setTimeout`
      raised for the 117-command line): plays the full line by
      Select and place taps and stock taps and asserts the announcement "You win" and the HUD's move count of 117 (the displayed
      Standard score depends on real elapsed time and is not asserted);
      plus a short scenario: smart tap and double-tap on a small seeded position.
    - **Verify:** `rtk npx playwright test playByTap --project=chromium` passes.

- [x] 10.3 Win by drag
    - **Implements:** RF "Input is proven end to end" ("Win by drag"); *KS-INP-04…06*.
    - **Files:** new `tests/e2e/playByDrag.spec.ts` (Chromium-only guard, added to
      `CHROMIUM_ONLY_SPECS`, raised `test.setTimeout`): full line by mouse drags;
      stock by click.
    - **Verify:** `rtk npx playwright test playByDrag --project=chromium` passes.

- [x] 10.4 Win by keyboard
    - **Implements:** RF "Input is proven end to end" ("Win by keyboard", "Pick up in smart mode");
      BK; *KS-INP-08*.
    - **Files:** new `tests/e2e/playByKeyboard.spec.ts` (Chromium-only guard, added to
      `CHROMIUM_ONLY_SPECS`, raised timeout): full line by keys only (arrows to pile and card, Enter,
      arrows to target, Enter; the stock is drawn by arrowing to it and pressing Enter, because Space draws
      only with nothing focused and focus follows the moved card); also one check that Space with
      nothing focused draws; also asserts Ctrl+Z, Ctrl+Y, H and Esc once mid-game, and
      a Smart move scenario on a small seeded position: Shift+Enter picks a card up and Enter on a
      column that is not the best target places it.
    - **Verify:** `rtk npx playwright test playByKeyboard --project=chromium` passes.

- [x] 10.5 Visual parity for mockup screens 08, 09 and 12; no test hook in the bundle
    - **Implements:** BA visuals (by eye); RF "Input is proven end to end" ("No hook in the bundle").
    - **References:** `tests/e2e/visualParity.spec.ts` (writes screens 03–07 and 14–17; assertions
      are only `existsSync` and size > 0; CI uploads `test-results/visual-parity/`);
      `tests/README.md` L96 ("nine screenshots").
    - **Files:** `visualParity.spec.ts` gains a selected card with a legal ghost (08), a hint (09) and
      the cascade mid-flight (12, from a seeded nearly-won position finished through the UI);
      `tests/README.md` (twelve screenshots); an e2e assertion in `tests/e2e/smoke.spec.ts` that the loaded production page exposes no store or test hook
      on `window` (`page.evaluate` over `window`'s own keys). There is no unit test over `dist`:
      `test:unit` runs before `build` in `validate`.
    - **Verify:** `rtk npx playwright test visualParity smoke --project=chromium` passes and the
      screenshots are inspected by eye against the mockup.

## 11. Repository state and close-out

- [x] 11.1 Bring the documents up to the finished state
    - **Implements:** constitution principle 9; D1–D14.
    - **Files:**
      - `README.md`: L15 "Phases 1–5 are complete", L25 "The board takes no input yet", L26 "Phases
        6–11 … pending"; features (play by tap, drag, keyboard incl. Shift+Enter pick-up; hint;
        Finish) and the shortcuts table.
      - `AGENTS.md`: L9 "Phases 1–5 complete … no board input yet (Phase 6)", L25 and L33 (the `ui`
        layer description and "follow in Phases 6–7"), the layout and purity lists.
      - `src/ui/README.md` L102 ("no pointer handlers yet"), L135–136 ("added with dragging in Phase
        6") and L174 (the pure-module list); `tests/README.md` L96 ("nine screenshots", "later phases").
      - Main specs (after sync at archive): the stale "later phase" / "arrives in Phase 6" sentences in
        `openspec/specs/domain/assistance/spec.md` (hint request, dead-end notice, smart-tap and finish
        wording), `openspec/specs/ui/board-render/spec.md` L19, L91, L143, L147 and
        `openspec/specs/ui/game-screen/spec.md` Purpose (L5).
      - `src/domain/README.md`, `src/features/README.md`, `src/ui/README.md`, `tests/README.md`
        checked against the code (paths and symbols cited).
      - `docs/spec/phased-design.md`: legend L251, Phase 6 status L340 "Implemented — OpenSpec change
        `add-board-interaction`", §3.1, §3.3, §4 rows (Drag, Keyboard, Finish, Hint, Dead end,
        Cascade) and `N`/`P` deferral; `docs/spec/specification.md` §3.2 hint-line and §4.8 notes
        (N and P bound in Phase 7; Shift+Enter/Shift+Space pick up in either tap setting).
    - **Verify:** every path and symbol cited in the edited documents exists (`rg` each); the
      documents contain no statement of the former behaviour.

- [x] 11.2 Full verification and independent review
    - **Implements:** all of the above.
    - **Verify:** the full, unmodified `rtk npm run validate` exits 0; `rtk npm run e2e` passes in all
      projects (the Chromium-only specs skip elsewhere); the 5.4 checklist has a recorded outcome or
      the user has explicitly deferred it; a fresh-context review of the diff against the delta specs
      and AGENTS.md principles finds no Blocking or Important item left open.
