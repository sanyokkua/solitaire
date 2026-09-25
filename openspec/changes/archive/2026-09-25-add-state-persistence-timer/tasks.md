# Tasks

> **Conventions.**
> - Run commands through `rtk` (`rtk proxy <cmd>` when the wrapper rejects a flag).
> - Vitest tests are `*.test.ts(x)` and live in `tests/`, mirroring `src/`. Only files that start
>   a worker declare `// @vitest-environment node`; everything else runs in the default jsdom.
> - Requirement names refer to this change's delta specs:
>   - **GS** `specs/features/game-session`
>   - **GC** `specs/features/game-clock`
>   - **ST** `specs/features/statistics`
>   - **PR** `specs/features/preferences`
>   - **PE** `specs/features/persistence`
>   - **DS** `specs/features/deal-service`
>   - **SC** `specs/domain/scoring`
>   - **GE** `specs/domain/game-engine`
>   - **DG** `specs/domain/deal-generation`
>   - **AS** `specs/app/application-shell`
>   - **RF** `specs/tooling/repository-foundation`
> - `Dn` is `design.md` decision *n*. Read every decision a task names before coding.
> - Shared references:
>   - **spec:** `docs/spec/specification.md` §4.3–4.4, §4.7, §5, §6, §7 and §9 (the KS ids);
>   - **research:** `docs/spec/research.md` R§5.1–5.2, R§6.2–6.3, R§7 and R§12.8;
>   - **phased-design:** `docs/spec/phased-design.md` §3.2–3.4 and the §4 rows Timer, Safe auto-move
>     and Finish;
>   - **domain API:** `src/domain/README.md`;
>   - **deal service API:** `src/features/README.md` and `src/features/deal/dealService.ts`.
> - Build positions with `makeState`, `deepFreeze`, `tableauOf`, `faceUp`, `faceDown` and
>   `foundationsOf` from `tests/fixtures/states.ts`. Winning play uses `WINNING_LINE` and `parseLine`
>   from `tests/fixtures/deals.ts`.
> - No test uses real timers, real `localStorage` or a real worker unless a task says so. Inject
>   `now`, `delay`, `setInterval` and the storage gateway (D12–D14).
> - Every module added to `src/domain` gets its bullet in `src/domain/README.md` in the same task, so
>   `domainPurity.test.ts` stays green. Every module added to `src/features` is described in
>   `src/features/README.md` in the same task.
> - Every task ends with `rtk npm run test:unit` and `rtk npm run lint` green. Before each task
>   commit, run the full, unmodified `rtk npm run validate` and fix everything it reports.

## 1. Domain and deal-service groundwork

- [x] 1.1 Add undo charges to the game state and the displayed score
    - **Implements:**
      - SC "Time penalty, win bonus and undo penalty" (MODIFIED);
      - GE "Move count, start flag and clock are engine-owned or engine-untouched" (MODIFIED);
      - DG "A mode fixes the draw count and the scoring rules" (MODIFIED);
      - *KS-SCO-03*; D2.
    - **References:** R§5.1–5.2; spec §4.4 and §5; `phased-design.md` §3.2.
    - **Files:**
      - `src/domain/types.ts`: `readonly undos: number` on `GameState`, with a doc comment.
      - `src/domain/deal.ts`: `dealFromSeed` sets `undos: 0`.
      - `src/domain/scoring.ts`: `displayedScore` subtracts `undos × undoCost(scoring)` before the
        Standard 0-floor.
      - `src/domain/README.md`: document the field and the rule.
      - `tests/fixtures/states.ts`: `makeState` defaults `undos: 0`.
      - `docs/spec/specification.md`:
        - reword *KS-SCO-03* as "restore the score of the restored position and charge 2 points
          that stay charged; redo does not refund";
        - §4.4 and §5: the undo charge in the displayed score.
      - `docs/spec/research.md` §5.1: the decision as the Windows reversal plus the charge, with
        the sources.
      - `docs/spec/phased-design.md` §3.2: `undos` in `GameState`.
    - **Tests:**
      - `tests/unit/domain/scoring.time.test.ts`: the SC scenarios "Undo charges lower the
        displayed Standard score" (50, 5 s, 3 undos → 44), "…never take the Standard score below
        zero" (4, 3 undos → 0) and "Vegas ignores undo charges" (−27 stays −27).
      - `tests/unit/domain/deal.test.ts`: a fresh deal in every mode has `undos === 0`.
      - `tests/unit/domain/engine.fullGame.test.ts`: `undos` is unchanged across the whole winning
        line.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/solver tests/unit/features` passes.

- [x] 1.2 Add the game-state validity check
    - **Implements:** GE "A game state can be checked for validity"; *KS-PER-03*; D13.
    - **References:** `src/domain/cards.ts` `isCardId`; `src/domain/deal.ts` `modeConfig`;
      `src/domain/rules.ts` `isWon`.
    - **Files:**
      - `src/domain/validate.ts` (new): `isValidGameState(value: unknown): value is GameState`,
        total and never throwing.
      - `src/domain/README.md`: the module bullet.
    - **Tests:** `tests/unit/domain/validate.test.ts`
      - Every `DEAL_FIXTURES` deal and every position along `WINNING_LINE` is accepted.
      - Rejected, one field at a time:
        - a duplicated card;
        - a missing card;
        - an off-suit foundation card and a foundation not starting at the ace;
        - a face-down card above a face-up card;
        - a mode/draw/scoring mismatch;
        - `passes: 0`;
        - a negative or non-integer `elapsedMs` or `undos`;
        - an unknown status;
        - status `won` with cards off the foundations.
      - `null`, `42`, `[]`, `{}` and an object missing `tableau` are each rejected without throwing.
    - **Verify:** `rtk npx vitest run tests/unit/domain tests/unit/repo/domainPurity.test.ts` passes.

- [x] 1.3 Report the Daily deal's date from the deal service
    - **Implements:** DS "A Daily deal reports its date"; *KS-STA-04*; D4.
    - **Files:**
      - `src/features/deal/dealService.ts`: `DealOutcome`'s dealt branch gains an optional
        `dayKey`, set on the Daily worker path and the Daily fallback from the key its seeds came
        from. Use a conditional spread (`exactOptionalPropertyTypes`).
      - `src/features/README.md`: document `dayKey`.
    - **Tests:** `tests/unit/features/deal/dealService.deal.test.ts`
      - Daily at an injected `now` of 2026-09-24T12:00Z → `dayKey: '2026-09-24'`, with the real
        worker.
      - Worker failure on Daily, using a stub that errors → the first candidate plus the same
        `dayKey`.
      - Draw 3, and Draw 1 with winnable on → no `dayKey` property.
    - **Verify:** `rtk npx vitest run tests/unit/features/deal` passes.

## 2. Preferences and statistics

- [x] 2.1 Build the preferences slice
    - **Implements:**
      - PR "Settings and their defaults";
      - PR "The first-run language follows the browser";
      - *KS-SET-01, KS-I18N-02*; D13 (enum values) and D14.
    - **References:** spec §6.
    - **Files:**
      - `src/features/preferences/preferencesSlice.ts` (new):
        - the `Preferences` type with the D13 enums;
        - `defaultPreferences(locale)`;
        - one `preferenceSet` reducer typed per key;
        - `preferencesReset(locale)`;
        - selectors.
      - `src/features/preferences/locale.ts` (new): `resolveLocale(languages: readonly string[]):
        'en' | 'uk'`.
      - `src/features/README.md`.
    - **Tests:**
      - `tests/unit/features/preferences/preferencesSlice.test.ts`: every default matches spec §6;
        each setter changes only its key; reset restores the defaults with the given locale.
      - `tests/unit/features/preferences/locale.test.ts`:
        - `['uk-UA','en-US']` → `uk`;
        - `['de-DE','fr-FR']` → `en`;
        - `['EN-gb']` → `en`;
        - `[]` → `en`.
    - **Verify:** `rtk npx vitest run tests/unit/features/preferences` passes.

- [x] 2.2 Build the per-mode statistics slice
    - **Implements:**
      - ST "A game counts as played at its first accepted command" (the reducer part);
      - ST "Winning updates the mode's record";
      - ST "Replacing a started, unfinished game breaks its streak" (the reducer part);
      - ST "Reset statistics clears every statistic";
      - *KS-STA-01, KS-STA-02, KS-STA-03, KS-STA-05*; D8, D9 and D13.
    - **References:** spec §5; R§7.
    - **Files:**
      - `src/features/stats/statsSlice.ts` (new):
        - `ModeStats` with `bestTimeMs` and `bestScore` as `number | null`;
        - `played(mode)`, `won({ mode, elapsedMs, score })`, `streakBroken(mode)` and
          `statsReset()`;
        - `selectModeStats` and `selectWinRate`.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/stats/statsSlice.test.ts`
      - The ST "First win of a mode" and "A slower, lower win keeps the records" scenarios.
      - A Vegas best score keeps the highest bank, including negatives.
      - `streakBroken` zeroes only the named mode and keeps its best streak.
      - Reset empties every mode.
    - **Verify:** `rtk npx vitest run tests/unit/features/stats` passes.

- [x] 2.3 Record Daily completions and derive the Daily streak
    - **Implements:** ST "Daily completions and the Daily streak"; *KS-STA-04*; D4 and D13.
    - **Files:**
      - `src/features/stats/statsSlice.ts`:
        - `dailyCompleted(dayKey)` keeps a unique ascending list, trimmed to the newest 400, and
          updates `daily.bestStreak`;
        - `selectDailyStreak(state, todayKey)` counts consecutive days ending today or yesterday.
      - `src/features/stats/dayKeys.ts` (new): pure UTC day-key arithmetic (previous day,
        consecutive runs).
    - **Tests:** `tests/unit/features/stats/daily.test.ts`
      - The ST scenarios "Consecutive days build the streak", "Winning the same day twice records
        it once" and "A missed day ends the streak".
      - Month and leap-year boundaries (2028-02-28 → 02-29 → 03-01).
      - 401 dates keep the newest 400.
    - **Verify:** `rtk npx vitest run tests/unit/features/stats` passes.

## 3. Application slice

- [x] 3.1 Extend the app slice and register every slice in the store
    - **Implements:**
      - PR "One reduced-motion signal";
      - GS "Starting a game installs a fresh deal" (the dealing-progress state);
      - *KS-SET-04, KS-GEN-02*; D14.
    - **Files:**
      - `src/app/appSlice.ts`:
        - `sheet`, `notices` (deduplicated `NoticeId`), `documentVisible`, `systemReducedMotion`
          and `dealing`;
        - the reducers `sheetOpened`, `sheetClosed`, `noticeRaised`, `noticeDismissed`,
          `visibilityChanged`, `systemMotionChanged` and `dealingProgressed`/`dealingEnded`.
      - `src/app/selectors.ts` (new): `selectReducedMotion` over app plus preferences.
      - `src/app/store.ts`: register `preferences` and `stats`, and accept
        `createAppStore(options?)` with `preloadedState` (D14). A bare call still works.
    - **Tests:**
      - `tests/unit/app/appSlice.test.ts` (new): each reducer, and that notices deduplicate.
      - `tests/unit/app/selectors.test.ts` (new): the two PR reduced-motion scenarios, plus "both
        off → not reduced".
      - `tests/unit/app/store.test.ts`: `preloadedState` is honoured, and bare stores stay
        isolated.
    - **Verify:** `rtk npx vitest run tests/unit/app tests/component` passes.

## 4. Game session

- [x] 4.1 Implement the pure undo and redo history
    - **Implements:**
      - GS "Undo restores the position before the last player move";
      - GS "Redo re-applies an undone move until a new move is made";
      - GS "Undo history has no in-memory limit";
      - *KS-AST-07, KS-AST-08, KS-SCO-03*; D2, D5 and D6.
    - **Files:**
      - `src/features/game/history.ts` (new): `Session` plus `commit`, `replace`, `undo`, `redo`,
        `canUndo` and `canRedo`, with the D6 carry-over (`elapsedMs`, `started`, `undos`) and
        `undos + 1` on undo.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/history.test.ts`
      - Commit, then undo, restores the pre-move snapshot's piles, score, moves and passes.
      - The GS "Undo does not rewind time or charges" scenario.
      - The GS "Redo restores the undone move" scenario, with the charge kept.
      - The GS "A new move clears redo" scenario.
      - `replace` keeps a single step.
      - Undo and redo are no-ops when empty or won.
      - The GS "Undo reaches the deal after 250 moves" scenario, using `WINNING_LINE`.
      - Inputs are deep-frozen and never mutated.
    - **Verify:** `rtk npx vitest run tests/unit/features/game/history.test.ts` passes.

- [x] 4.2 Build the game slice, its selectors and the thunk dependencies
    - **Implements:**
      - GS "A game is resumable once started";
      - GS "Undo restores…" and "Redo re-applies…" (the `busy` guards);
      - *KS-GEN-04, KS-PER-02*; D7 and D14.
    - **Files:**
      - `src/features/game/gameSlice.ts` (new): the D7 state and reducers wrapping `history.ts`,
        and `selectCanUndo`, `selectCanRedo`, `selectResumable`, `selectDisplayedScore` and
        `selectCanFinish`.
      - `src/app/thunkExtra.ts` (new): the `ThunkExtra` type and `defaultThunkExtra()`, with a lazy
        deal service, `performance.now`, `setTimeout`-based `delay`, `() => new Date()`, and the
        default gateway once task 5.1 lands (until then `gateway` is omitted from the type).
      - `src/app/store.ts`:
        - register `game`;
        - `thunk.extraArgument`;
        - the serializable and immutable checks ignore `game.history` and `game.future`.
      - `tests/fixtures/dealService.ts` (new): `fakeDealService()`, which records requests and
        resolves or cancels them on command.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/gameSlice.test.ts`
      - `selectResumable` is false for a fresh deal, true after a draw, and false once won (the GS
        resumable scenarios).
      - Undo and redo are ignored while `busy`.
      - `installed` resets the history, `undos`, `counted` and the clock anchor, and bumps `epoch`.
      - `selectDisplayedScore` applies the charges.
    - **Verify:** `rtk npx vitest run tests/unit/features/game tests/unit/app` passes.

- [x] 4.3 Add clock accrual and eligibility
    - **Implements:**
      - GC "Play time starts with the first accepted command";
      - GC "Play time counts only while the game can be played";
      - GC "The clock is robust to suspension and wall-clock changes";
      - *KS-SCO-05, KS-SCO-06*; D12.
    - **References:** `phased-design.md` §4 Timer row.
    - **Files:**
      - `src/features/game/clock.ts` (new): `selectClockEligible(state)`.
      - `src/features/game/gameSlice.ts`: the `accrued({ atMs, eligible })` reducer, with the
        1 s cap per step and anchor clearing when not eligible.
      - `docs/spec/phased-design.md` §4 Timer row: the anchor reset and the 1 s step cap.
    - **Tests:** `tests/unit/features/game/clock.test.ts`
      - Eligibility for each failing condition: route, sheet, visibility, unstarted, won.
      - The GC scenarios for Home, an open sheet and a hidden document.
      - The first accrual after resuming only sets the anchor.
      - A 5-minute gap adds 1,000 ms.
      - History snapshots are untouched.
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

- [x] 4.4 Implement the shared commit path and the `play`, `undo` and `redo` thunks
    - **Implements:**
      - GS "Player commands advance the game";
      - GC "The clock is settled before a command is recorded";
      - ST "A game counts as played at its first accepted command";
      - ST "Winning updates the mode's record" (triggering);
      - ST "Daily completions and the Daily streak" (triggering);
      - *KS-AST-07, KS-STA-01, KS-STA-02, KS-STA-04, KS-INP-09*; D8.
    - **Files:**
      - `src/features/game/gameThunks.ts` (new): `commitCommand`, `play(cmd)`, `undo()` and
        `redo()`.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/play.test.ts`, using a store built with
      `createAppStore({ deps })` and a controllable `now`.
      - A legal move adds one undo step; an illegal one changes nothing (GS scenarios).
      - A first draw counts as played once, and undo + redo do not count it again.
      - `WINNING_LINE` played through `play` wins:
        - the mode's won, streak and best time equal the settled `elapsedMs`, including a sub-tick
          remainder;
        - best score equals `displayedScore`.
      - A Daily win with `dailyKey` records the date; without it, none.
      - Commands after a win are ignored.
      - The ST "A reset mid-game still counts the game" scenario.
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

- [x] 4.5 Chain safe cards inside the move's step
    - **Implements:**
      - GS "Safe cards chain to the foundations inside the move's step";
      - *KS-AST-04, KS-SET-04*; D11.
    - **References:** R§6.2; `phased-design.md` §4 Safe auto-move row.
    - **Files:** `src/features/game/gameThunks.ts` (`play` gains the chain).
    - **Tests:** `tests/unit/features/game/autoSafe.test.ts`
      - The GS scenarios:
        - "Safe cards follow a move one by one": a recorded `delay(160)` per send, and one undo
          step;
        - "The setting alone does not move cards";
        - "Reduced motion removes the spacing": `delay(0)`;
        - "A new deal stops a running chain": the epoch changes mid-delay.
      - Switching the setting off mid-chain stops it.
      - Undo removes the whole chain.
      - `busy` is true during the chain and false after, including when a step throws.
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

- [x] 4.6 Finish the game step by step
    - **Implements:** GS "Finishing plays every remaining card home"; *KS-AST-05, KS-SET-04*; D11.
    - **References:** R§6.3; `phased-design.md` §4 Finish row.
    - **Files:** `src/features/game/gameThunks.ts` (`finish`).
    - **Tests:** `tests/unit/features/game/finish.test.ts`
      - From a `WINNING_LINE` position with every card face up:
        - `finish` wins;
        - the score equals `displayedScore(finishPlan(state).state)`;
        - it takes one undo step and a `delay(75)` per step;
        - with reduced motion, `delay(0)`.
      - The GS scenario "Finish is unavailable with a face-down card".
      - An epoch change mid-finish stops it.
      - The win records statistics once.
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

- [x] 4.7 Start and restart games
    - **Implements:**
      - GS "Starting a game installs a fresh deal";
      - GS "Restart replays the same deal";
      - GS "Settings never change a game in progress";
      - ST "Replacing a started, unfinished game breaks its streak";
      - *KS-DEAL-03, KS-DEAL-04, KS-DEAL-08, KS-SET-06, KS-STA-03*; D4, D9 and D10.
    - **Files:**
      - `src/features/game/gameThunks.ts`:
        - `startGame({ mode })` reads `winnableOnly`, forwards progress to `dealingProgressed`,
          checks the epoch, breaks the streak, then calls `installed` with `dailyKey` from
          `dayKey`;
        - `restart()`.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/startRestart.test.ts`, with `fakeDealService`.
      - The GS scenarios "A delivered deal becomes the current game", "A newer start wins" and
        "Dealing progress is exposed…".
      - A cancelled start changes nothing.
      - The ST scenarios "Restart breaks the streak", "The replaced game's mode loses the streak"
        and "Going Home keeps the streak".
      - An unstarted game is replaced without breaking.
      - The GS scenarios "Restart gives the identical layout" and "Restart ignores the settings".
      - The GS scenario "Changing the selected mode mid-game".
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

## 5. Persistence

- [x] 5.1 Build the storage gateway and guard the storage boundary
    - **Implements:** AS "Browser storage is reached only through the storage gateway"; D13.
    - **References:** the sibling `minesweeper/src/features/persistence/storageGateway.ts`.
    - **Files:**
      - `src/features/persistence/storageGateway.ts` (new): `createStorageGateway(storage?)` with
        `read`, `write` and `remove` per key returning result objects, and a default factory that
        catches the `window.localStorage` access.
      - `src/app/thunkExtra.ts`: the default `gateway`.
      - `tests/fixtures/storage.ts` (new):
        - `memoryStorage()`, with a `failWrites` switch and a `quota` option;
        - `throwingStorage()`.
      - `tests/unit/repo/storageBoundary.test.ts` (new): scans `src/**/*.{ts,tsx}` with
        `purityScanner.ts`'s `stripComments` for `localStorage` or `sessionStorage`, and fails
        with the file name outside `storageGateway.ts`.
      - `src/features/README.md`.
    - **Tests:**
      - `tests/unit/features/persistence/storageGateway.test.ts`:
        - read, write and remove through `memoryStorage`;
        - every call returns `ok: false` with a `null` storage or a throwing storage;
        - a quota error is reported, not thrown.
      - The guard test fails when a temporary `localStorage` reference is added to
        `src/app/store.ts`, and passes once it is reverted.
    - **Verify:** `rtk npx vitest run tests/unit/features/persistence tests/unit/repo` passes.

- [x] 5.2 Encode and decode the v1 record
    - **Implements:**
      - PE "One versioned record holds what the device keeps";
      - PE "Stored data is decoded defensively";
      - *KS-PER-01, KS-PER-03*; D5 and D13.
    - **Files:**
      - `src/features/persistence/recordCodec.ts` (new):
        - `STORAGE_KEY`, `BACKUP_KEY`;
        - `encodeRecord(input)`, which trims history to the newest 200 and future to the nearest
          200 as compact steps;
        - `decodeRecord(raw)` → `ok` or `{ ok: false, reason }`, validating every section and using
          `isValidGameState` for `current` and each rebuilt step;
        - a session is dropped as `invalid` when it is won or unstarted.
      - `docs/spec/phased-design.md` §3.3–3.4: the record as built, including the future steps, the
        backup key, `dailyKey`, `counted`, and the unlimited-in-memory history; R§12.8 in
        `research.md`: 200 stored.
      - `docs/spec/specification.md` §4.4 and §7: the stored limit, and "missing" read as an
        incomplete record.
    - **Tests:** `tests/unit/features/persistence/recordCodec.test.ts`
      - A round-trip of a mid-game session gives deep equality.
      - 250 history plus 3 future → 200 plus 3, and the rebuilt steps match the originals.
      - Won and unstarted sessions are not encoded.
      - The PE scenarios "Corrupt data…" (`malformed`), "A future version…" (`future`) and "An
        impossible game…" (`invalid`).
      - An unknown enum value, a negative stat, a bad date key and a step from another seed are
        each `invalid`.
      - `null` gives `empty`.
      - Decoding never throws on 200 random strings, using a seeded `mulberry32`.
    - **Verify:** `rtk npx vitest run tests/unit/features/persistence` passes.

- [x] 5.3 Load the record before the store and keep unreadable data
    - **Implements:**
      - PE "Reopening restores the unfinished game exactly" (loading);
      - PE "Stored data is decoded defensively" (notices);
      - PE "Unreadable data is never lost";
      - *KS-PER-02, KS-PER-03*; D3 and D13.
    - **Files:**
      - `src/features/persistence/persistenceSlice.ts` (new): `readOnly`, `lastError`, and
        `readOnlyEntered`/`writeFailed`/`writeSucceeded`.
      - `src/features/persistence/persistenceLoader.ts` (new):
        `loadInitialState(gateway, languages)` → `{ preloadedState, notices }`, running the D3
        backup protocol.
      - `src/app/store.ts`: register `persistence`.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/persistence/persistenceLoader.test.ts`
      - The PE scenario "First run is silent".
      - A valid record preloads its preferences, stats and resumable session, with the route
        still `home`.
      - For each of corrupt, future and invalid: defaults, the backup key holds the raw string, and
        a `storage-read` notice is raised.
      - The PE scenario "An occupied backup blocks saving": `readOnly` and `storage-read-only`.
      - A backup that already holds the identical string is not treated as occupied.
      - A failed backup write gives `readOnly`.
    - **Verify:** `rtk npx vitest run tests/unit/features/persistence` passes.

- [x] 5.4 Write the record on change and flush on leave
    - **Implements:**
      - PE "Saving keeps up with play and survives leaving the page";
      - PE "A failed save keeps the game playable";
      - *KS-PER-01, KS-PER-04*; D13.
    - **Files:**
      - `src/features/persistence/persistenceWriter.ts` (new):
        `createPersistenceWriter(store, gateway, timers)` → `{ flush, cancel, dispose }`, with the
        250 ms debounce, the 5 s throttle for `elapsedMs`-only changes, `readOnly` skipping, and the
        once-until-success failure notice.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/persistence/persistenceWriter.test.ts`, with fake timers and
      `memoryStorage`.
      - The PE scenarios "A burst of moves is saved once" and "Leaving the page saves immediately"
        (via `flush`).
      - Clock-only changes write at most once per 5 s.
      - Nothing is written while `readOnly`.
      - The PE scenario "Storage quota exceeded": moves still apply, one notice, and a later
        success clears the error.
      - `cancel` drops a pending write.
    - **Verify:** `rtk npx vitest run tests/unit/features/persistence` passes.

- [x] 5.5 Reset statistics and reset all local data
    - **Implements:**
      - ST "Reset statistics clears every statistic";
      - PE "Reset all local data restores defaults";
      - *KS-STA-05, KS-PER-05*; D3, D8 and D13.
    - **Files:**
      - `src/features/persistence/resetThunks.ts` (new):
        - `resetStatistics()`: `statsReset` plus `countedSet(false)`;
        - `resetAllLocalData()`: cancel the writer's pending write, remove both keys, reset the
          preferences with `resolveLocale`, reset the stats, clear the game (bumping the epoch,
          which stops any chain or deal), route Home, and leave `readOnly`.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/persistence/resetThunks.test.ts`
      - The ST scenario "Reset clears all modes and the Daily record": the game and settings are
        untouched.
      - The PE scenario "Reset all during a game", including a pending debounced write that does
        not resurrect the data.
      - Reset all from `readOnly` resumes saving.
    - **Verify:** `rtk npx vitest run tests/unit/features/persistence` passes.

## 6. Lifecycle and shell

- [x] 6.1 Drive the clock with a ticker
    - **Implements:** GC "Play time counts only while the game can be played" (live ticking);
      *KS-SCO-05, KS-SCO-06*; D12.
    - **Files:**
      - `src/features/game/clockTicker.ts` (new): `createClockTicker(store, { now, setInterval,
        clearInterval })` dispatches `accrued` every 250 ms and on eligibility changes, and returns
        `dispose`.
      - `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/clockTicker.test.ts`
      - With a fake `now` and interval, 10 s of eligible play accrues 10,000 ms.
      - A hidden interval accrues nothing.
      - Resuming does not count the gap.
      - `dispose` clears the interval.
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

- [x] 6.2 Wire the application lifecycle
    - **Implements:**
      - PE "Saving keeps up with play and survives leaving the page" (the page listeners);
      - PR "One reduced-motion signal" (the device query);
      - GC "Play time counts only while the game can be played" (document visibility);
      - D1 and D14.
    - **Files:**
      - `src/app/lifecycle.tsx` (new): `startApp(root, deps?)`, which:
        - loads the record, then creates the store;
        - starts the ticker and the writer;
        - handles `visibilitychange` (dispatch plus flush when hidden), `pagehide` (flush) and the
          reduced-motion media query, guarded when missing;
        - renders `<StrictMode><Provider><App/>`;
        - returns `{ store, dispose }`, so the reload gate (6.4) can read the store.
      - `src/main.tsx`: a single `startApp` call.
    - **Tests:** `tests/component/appLifecycle.wiring.test.tsx`, with an injected `memoryStorage` gateway.
      - The initial `documentVisible` follows `document.visibilityState`.
      - A `visibilitychange` to hidden flushes a pending write.
      - `pagehide` flushes.
      - The media-query change sets `systemReducedMotion`.
      - `dispose` removes every listener and timer.
    - **Verify:** `rtk npx vitest run tests/component` passes, and `rtk npm run build` succeeds.

- [x] 6.3 Wire Home and Game to the store
    - **Implements:**
      - AS "Navigation between the two screens" (MODIFIED);
      - AS "Continue game on Home";
      - *KS-GEN-04, KS-PER-02, KS-A11Y-03*; D1.
    - **Files:**
      - `src/ui/screens/HomeScreen.tsx`: "Deal cards" dispatches `startGame({ mode: selectedMode
        })` and routes to Game; a "Continue game" button is shown while `selectResumable`.
      - `src/ui/screens/GameScreen.tsx`: Back only routes; an unstyled status line shows the mode,
        moves and displayed score (D1).
      - `src/features/game/gameThunks.ts`: `continueGame()`, if not already added.
    - **Tests:** `tests/component/appShell.test.tsx`, using `fakeDealService` through
      `createAppStore({ deps })`.
      - The AS navigation scenarios by pointer and keyboard now start a game in the selected mode.
      - The AS scenario "Return to Home" keeps the game resumable.
      - The AS Continue scenarios: shown for a started game; pointer and keyboard resume it
        unchanged; hidden when there is no game, or the game is unstarted or won.
      - A focus indicator is present on Continue.
    - **Verify:** `rtk npx vitest run tests/component` passes, and `rtk npm run e2e` still passes the
      smoke test.

- [x] 6.4 Prove reload restores the game and gate lifecycle storage
    - **Implements:**
      - PE "Reopening restores the unfinished game exactly";
      - RF "Single aggregate validation gate" (MODIFIED);
      - AS "Browser storage is reached only through the storage gateway" (the lifecycle part);
      - *KS-PER-02*; D15.
    - **References:** the sibling `minesweeper/scripts/validate-lifecycle-storage.mjs`.
    - **Files:**
      - `tests/component/appLifecycle.test.tsx` (new): **phase gate**. Start the app on a
        `memoryStorage`, deal a fixture game, make 10 moves, undo one, flush, dispose, start a
        second app on the same storage, press Continue game, and assert `game.current`, `history`,
        `future` and `dailyKey` are deep-equal to the pre-reload values.
      - `scripts/validate-lifecycle-storage.mjs` (new): checks every `tests/component/appLifecycle*.test.tsx`.
      - `package.json`: `validate:lifecycle-storage`, inserted into `validate` after `typecheck`.
      - `tests/unit/repo/configContract.test.ts`: assert the new `validate` order.
      - `AGENTS.md`: the "Runtime and commands" list and the `validate` description; remove the
        Phase 4 half of the D6 deferral note.
      - `README.md`: the quality commands table.
    - **Tests:**
      - The phase-gate test above.
      - The script exits non-zero when a temporary `localStorage` reference is added to the
        lifecycle test, and passes once it is reverted.
    - **Verify:** `rtk npm run validate:lifecycle-storage` and `rtk npm run validate` pass.

## 7. Documentation and integration

- [x] 7.1 Update the project docs for Phase 4
    - **Implements:** constitution principle 9 for this change.
    - **Files:**
      - `README.md`: the current status (Phase 4 complete) and the layout (`src/app`,
        `src/features`).
      - `AGENTS.md`: the repository state line and the layout header (the state layer and
        persistence are implemented).
      - `src/features/README.md`: replace the "remaining slices land in Phase 4" text with a
        description of what was built.
      - `tests/README.md`: the new suites and fixtures (`dealService.ts`, `storage.ts`) and the
        no-real-storage rule.
    - **Tests:** none; this is a documentation-only task.
    - **Verify:** `rg -n "Phase 4" README.md AGENTS.md src/features/README.md tests/README.md` shows
      no stale "pending/reserved" wording, and `rtk npm run format:check` passes.

- [x] 7.2 Verify the whole change end to end
    - **Implements:** every requirement in this change's delta specs.
    - **Checks:**
      - `rtk npm run test:coverage`: the global 80% floor holds, and every new `src/` file is at
        least 80%.
      - `rtk npm run validate` passes, unmodified.
      - `rtk npm run e2e` passes on all projects.
      - `openspec validate add-state-persistence-timer --strict` passes.
      - Every KS id in the proposal maps to at least one named test above. Record the map in this
        task's results.
      - `rg -n "localStorage" src` lists only `storageGateway.ts`.
    - **Verify:** all checks above pass; results are recorded here as a `**Results (date):**` block.
    - **Results (2026-09-25):**
      - `rtk npm run test:coverage`: exit 0, 68 files, 1411 tests passed (1 skipped by design); global 98.37%
        statements / 96.36% branches / 99.74% functions / 99.34% lines. The first run found three new files under
        the 80% floor on one metric: `clockTicker.ts` functions (62.5%), `locale.ts` branches (75%) and
        `dayKeys.ts` branches (75%). Fixes: tests for the default-timer path of `clockTicker.ts`, edge cases for
        `locale.ts` and `dayKeys.ts`, and `resolveLocale` now takes the primary subtag with
        `language.split('-', 1).join('')`, dropping an unreachable `?? ''` fallback (behaviour unchanged). Every
        new `src/` file is now at or above 80% on all four metrics (`dayKeys.ts` is lowest at 85% branches; its
        remaining branches are `noUncheckedIndexedAccess` fallbacks that cannot be reached).
      - `rtk npm run validate`: exit 0, unmodified (format:check, lint, typecheck, lifecycle-storage guard,
        `test:unit`, build).
      - `rtk npm run e2e`: exit 0, 6 tests on all 6 projects (chromium, firefox, webkit, iphone-14-pro-max,
        iphone-17-pro, galaxy-s25).
      - `openspec validate add-state-persistence-timer --strict`: valid.
      - `rg -n "localStorage" src`: `src/features/persistence/storageGateway.ts:19` is the only code hit
        (`src/features/README.md` mentions it in prose). No `sessionStorage` or `indexedDB` anywhere in `src`.
      - KS map (no test title names a KS id, so the map follows each task's `Tests:` lines and every file was
        confirmed to exist):
        - KS-AST-04: `game/autoSafe.test.ts`. KS-AST-05: `game/finish.test.ts`.
        - KS-AST-07, KS-AST-08: `game/history.test.ts`, `game/play.test.ts`.
        - KS-SCO-03: `domain/scoring.time.test.ts`, `game/history.test.ts`.
        - KS-SCO-05, KS-SCO-06: `game/clock.test.ts`, `game/clockTicker.test.ts`, `game/play.test.ts`.
        - KS-STA-01, KS-STA-02: `game/play.test.ts`, `stats/statsSlice.test.ts`.
        - KS-STA-03: `game/startRestart.test.ts`. KS-STA-04: `stats/daily.test.ts`, `game/play.test.ts`,
          `deal/dealService.deal.test.ts`.
        - KS-STA-05: `persistence/resetThunks.test.ts`, `stats/statsSlice.test.ts`.
        - KS-PER-01: `persistence/recordCodec.test.ts`, `persistence/persistenceWriter.test.ts`.
        - KS-PER-02: `component/appLifecycle.test.tsx`, `persistence/persistenceLoader.test.ts`.
        - KS-PER-03: `persistence/persistenceLoader.test.ts`, `persistence/recordCodec.test.ts`,
          `domain/validate.test.ts`.
        - KS-PER-04: `persistence/persistenceWriter.test.ts`. KS-PER-05: `persistence/resetThunks.test.ts`.
        - KS-SET-01: `preferences/preferencesSlice.test.ts`. KS-SET-04: `game/autoSafe.test.ts`,
          `game/finish.test.ts`, `app/selectors.test.ts`. KS-SET-06: `game/startRestart.test.ts`.
        - KS-GEN-02: `app/appSlice.test.ts`. KS-GEN-04: `component/appShell.test.tsx`,
          `game/continueGame.test.ts`.
        - KS-DEAL-03, KS-DEAL-04, KS-DEAL-08: `game/startRestart.test.ts`, `deal/dealService.deal.test.ts`
          (KS-DEAL-04 also `component/appShell.test.tsx`).
        - KS-I18N-02: `preferences/locale.test.ts`, `persistence/persistenceLoader.test.ts`.
        - KS-INP-09 (only the won-game and busy cases; sheet and win-animation gating arrive with the sheets and
          board in Phases 5–7) and KS-A11Y-03 (only the visible focus indicator; sheet focus trap and return are
          Phase 7): `game/play.test.ts`, `component/appShell.test.tsx`.
        - Every path above is under `tests/unit/features/` unless it starts with `component/`, `domain/` or
          `app/` (under `tests/unit/` or `tests/component/`).
