# Design

## Context

A design document is warranted for four reasons:
- the change crosses every layer boundary it can: `domain` → `features` → `app` → `ui`;
- it creates the storage schema, `solitaire.local-state` v1;
- it changes a domain type (`GameState`) and a domain scoring rule;
- it brings in the `validate:lifecycle-storage` gate that foundation D6 deferred.

Constraints that shape the approach:
- **`src/domain`:**
  - `applyCommand` is pure and total. A rejected command returns the input by reference with one
    `rejected` event. `moves` grows for `move` and `draw`, not for `autoFoundation`. `started`
    becomes `true` on any accepted command. The engine spreads `...state`, so an added field passes
    through untouched.
  - `dealFromSeed(seed, mode, { verdict?, attempts? })` builds a fresh state (`elapsedMs: 0`,
    `started: false`, `passes: 1`).
  - `scoring.ts` exports `undoCost`, `timePenalty`, `winBonus`, `applyDelta` and
    `displayedScore(state)`.
  - `assist.ts` exports `nextSafeMove(state)` (canonical order: columns 0–6, then the waste) and
    `finishPlan(state)` → `{ state, events, commands } | undefined`.
  - `cards.ts` exports `isCardId`. `rules.ts` exports `passLimit` and `isWon`.
  - `tests/unit/repo/domainPurity.test.ts` requires the domain to hold exactly the modules its
    `README.md` lists.
- **`src/features/deal/dealService.ts`:** `createDealService({ createWorker?, now?, seedSource?,
  overlayDelayMs?, hintTimeoutMs? })` returns `deal({ mode, winnableOnly }, onProgress?)` resolving
  `{ status: 'dealt', state } | { status: 'cancelled' }`, plus `hint(state)` and `dispose()`.
  - Daily uses `dailySeeds(utcDayKey(now()))`.
  - `onProgress({ overlay, attempt })` fires only on worker paths.
  - A newer `deal()` cancels older deals and hints.
- **`src/app`:**
  - `store.ts` has `createAppStore()` with no arguments and one `app` slice, `{ route }`.
    `appSlice.ts` type-imports `RootState` from `store.ts`.
  - `tests/unit/app/store.test.ts` and `tests/component/appShell.test.tsx` call `createAppStore()`
    bare.
  - `main.tsx` is excluded from coverage.
- **Tooling:**
  - `tsconfig.app.json` sets `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and
    `verbatimModuleSyntax`.
  - ESLint runs `strictTypeChecked`. `src/features` may import solver code only as types.
  - `tests/unit/repo/reservedLayers.test.ts` keeps `src/i18n` and `src/pwa` README-only.
  - Coverage has one global 80% floor over every `src/**` file.
- User decisions (this change): D1 minimal shell wiring, D2 undo scoring after classic Windows
  Solitaire, D3 back up unreadable data and continue, D4 a Daily completes on the deal's own date.
- Reference material:
  - `phased-design.md` §3.2–3.4, the §4 rows Timer, Safe auto-move and Finish, and §7 Phase 4;
  - spec §4.3–4.4, §4.7, §5, §6 and §7;
  - R§5.1, R§5.2, R§6.2, R§6.3, R§7 and R§12.8;
  - the mockup's `save`, `undo`, `redo` and timer code (behaviour only, not structure);
  - the sibling `sanyokkua/minesweeper` `src/features/persistence/{storageGateway,persistenceController}.ts`,
    `src/features/game/gameClock.ts` and `scripts/validate-lifecycle-storage.mjs`.

## Goals / Non-Goals

**Goals:**
- A store that plays a whole game through commands, with exact undo and redo, statistics and a fair
  clock.
- One record that round-trips a resumable game exactly and never destroys data it cannot read.
- Every timing and every browser API injected, so each rule is unit-testable in jsdom without real
  timers or real storage.
- The shell exercises the store end to end: deal, continue, back and reload.

**Non-Goals:**
- Rendering the board or any input beyond the three shell controls.
- Sheet, notice and reset UI, and localisation. The state and actions exist; rendering is Phase 7.
- Per-section salvage of a partly valid record. The user chose full defaults plus a backup (D3).
- A cumulative Vegas bankroll or a per-day Daily history (spec §1.2 and §11).

## Decisions

### D1 — Minimal shell wiring (user decision)

`main.tsx` shrinks to `startApp(document.getElementById('root'))`. `src/app/lifecycle.ts` does the
wiring outside React, which avoids StrictMode double effects and keeps the logic under coverage:
1. read and decode the record (D13);
2. create the store with `preloadedState` and its dependencies (D14);
3. start the clock ticker (D12) and the persistence writer (D13);
4. subscribe to `visibilitychange`, `pagehide` and the `(prefers-reduced-motion: reduce)` media
   query;
5. render;
6. return `dispose()`, which clears the timers and removes the listeners.

The initial `documentVisible` comes from `document.visibilityState`, because a tab can load in the
background. `matchMedia` is optional, since jsdom lacks it.

UI changes are limited to three controls:
- `HomeScreen`: "Deal cards" dispatches `startGame({ mode: selectedMode })` and routes to Game at
  once, so the dealing progress is visible there.
- `HomeScreen`: a plain `<button>Continue game</button>` is rendered while `selectResumable` holds.
  It only routes to Game.
- `GameScreen`: Back only routes to Home.

The Game screen shows nothing new beyond an unstyled status line (mode, moves, displayed score).
That line exists so tests and a human can see the store is live. Phase 5 replaces it.

*Alternative considered:* a state-only phase with no wiring. Rejected by the user, because the
persistence and Continue behaviour would stay unproven in a real page until Phase 7.

### D2 — Undo charges follow classic Windows Solitaire (user decision)

Research:
- Classic Windows Solitaire (sol.exe) and its faithful clones reverse the undone move's points
  exactly: "you lose the points awarded for the undone move".
- Microsoft Solitaire Collection documents no fixed undo fee.
- This project adds −2 per undo in Standard (R§5.1) and no fee in Vegas (R§5.2).

The combined rule:
- Undo restores the earlier snapshot, which reverses that move's points, moves and passes exactly.
- `GameState` gains `readonly undos: number`. `dealFromSeed` sets it to 0, the engine never changes
  it, and undo increments it.
- Like `elapsedMs`, `undos` survives undo and redo.
- `displayedScore` becomes `max(0, score − timePenalty − undos × undoCost)` under Standard, plus the
  win bonus once won. Vegas is unchanged, because `undoCost` is 0.

Consequences:
- Redo never refunds.
- Repeated undos all cost.
- The charge can never be dodged by the 0-floor, because the stored move score is never floored by
  the charge; only the displayed total is.
- `KS-SCO-03`'s "restored score" wording is clarified in `specification.md`.

*Alternative considered:* store each history entry's applied score delta and subtract it plus 2 on
undo. Rejected for three reasons:
- it needs the delta patched after a safe-card chain;
- it interacts badly with the Standard 0-floor (one undo, a floor, then a redo is free);
- it duplicates what snapshot restore already does exactly.

*Alternative considered:* the mockup's rule, where the restored score is −2 and redo restores the
pre-undo snapshot. Rejected: N undos cost only 2, and redo refunds the charge.

### D3 — Unreadable data is backed up once, then saving continues (user decision)

Load outcome:
- `empty` (no key): defaults, no notice.
- `malformed`, `invalid` or `future`: defaults plus a backup attempt.

Backup:
- The raw string is written to `solitaire.local-state.unreadable`.
- If that key is empty or holds the identical string, the copy counts as successful. Saving then
  proceeds normally and the `storage-read` notice is raised.
- If the key holds a different string, or the write fails, the `persistence` slice enters
  `readOnly`. The writer then never writes, and the `storage-read-only` notice is raised.
- If storage cannot be read at all (`read` of the record fails), what it holds is unknown and must
  not be overwritten, so the loader also starts with defaults in `readOnly` and raises
  `storage-read-only` (user decision). The same applies when the backup key cannot be read.
- `resetAllLocalData` clears both keys and leaves `readOnly`.

"Missing" in *KS-PER-03* is read as a record that exists but lacks required parts. A first run gets
no notice, which is also Minesweeper's behaviour. `specification.md` §7 is reworded to match.

*Alternative considered:* partial recovery (keep valid preferences and stats, drop a bad session).
It was offered and not chosen. The decoder still validates section by section, so adding salvage
later is a codec-only change.

### D4 — A Daily deal completes on its own date (user decision)

- The deal service's Daily path returns `{ status: 'dealt', state, dayKey }`. `dayKey` is the key it
  derived the seeds from, including on the worker-failure fallback. Other paths omit `dayKey`, which
  uses a conditional spread because of `exactOptionalPropertyTypes`.
- The game session stores `dailyKey: string | null` beside `current`, and restart keeps it.
- On a Daily win with a `dailyKey`, statistics record that date.
- Games without a `dailyKey` count toward the Daily mode's played and won but never complete a day.
  These are Daily codes replayed through Phase 7's deal-code entry.

*Alternative considered:* infer the date by testing whether today's or yesterday's `dailySeeds`
contain the seed. This works (the two sets never collide) but is roundabout, and it would complete a
day for a code typed in by hand.

### D5 — History: unlimited in memory, 200 + 200 stored

- `history` and `future` are unbounded arrays of full `GameState` snapshots. `future` is cleared on
  every commit, so it is bounded by the number of undos.
- The codec keeps the newest 200 history entries and the nearest 200 future entries. That satisfies
  spec §4.4 ("unlimited") and *KS-PER-01* ("up to 200") without a product change.
- Stored steps use a compact position encoding: tableau, stock, waste, foundations, score, moves,
  passes, elapsedMs, undos, started.
  - The last three are stored because a history or future snapshot keeps the `elapsedMs`, `undos`
    and `started` it had when it was captured (the carry-over in D6 applies only when undo or redo
    restores it). Copying them from `current` could not round-trip a session exactly, for example a
    step-0 snapshot with `started: false` or older snapshots with fewer `undos`.
- On decode, the constant fields (seed, mode, draw, scoring, verdict, attempts) are copied from
  `current` and `status` is `playing`. This keeps a 200 + 200 record at about 300 KB (a Draw 1
  record with 200 + 200 steps measures about 311 KB) and makes "every step belongs to the same
  deal" true by construction. A step with any extra or missing key
  is invalid, and every rebuilt step must pass `isValidGameState`.
- `phased-design.md` §3.3/§3.4 ("cap 200") and R§12.8 ("capped at 400") are updated.

*Alternative considered:* a 200 cap in memory too. Rejected, because spec §4.4 promises undo back to
the start of the deal.

### D6 — What undo and redo carry over

`src/features/game/history.ts` holds pure functions over
`{ current, history, future }`:
- `commit(session, next)` pushes `current` onto `history` and clears `future`.
- `undo(session)` pops `history` into `current` and pushes the old `current` onto `future`.
- `redo(session)` does the reverse.

Carry-over on undo and redo: `elapsedMs`, `started` and `undos` come from the outgoing `current`.
`undos` is incremented on undo only. `moves`, `passes`, `score` and the piles come from the
snapshot.

Guards: undo and redo are no-ops when their stack is empty, when `current.status === 'won'`, or
while `busy`. These pure functions are the core of the slice's reducers and are tested
exhaustively on their own.

### D7 — The game slice

```ts
interface GameSliceState {
  current: GameState | null;
  history: GameState[];
  future: GameState[];
  dailyKey: string | null;
  counted: boolean;    // counted as played in the current statistics (D8)
  busy: boolean;       // a chain or finish is running; never persisted
  epoch: number;       // bumped by install, restart and reset; never persisted
  clock: { anchorMs: number | null }; // D12; never persisted
}
```

Reducers: `installed`, `committed` (a new undo step), `replaced` (updates `current` within the
same step), `undone`, `redone`, `busySet`, `accrued`, `countedSet`, `cleared`.

Selectors: `selectCanUndo`, `selectCanRedo`, `selectResumable` (started and playing),
`selectDisplayedScore`, `selectCanFinish`.

Thunks live in `gameThunks.ts`, never in the slice file, to avoid `RootState` type cycles. They are
`startGame`, `play`, `undo`, `redo`, `finish`, `restart` and `continueGame`.

Every awaited step of a chain, a finish or a start checks `getState().game.epoch` against the value
it captured, and stops if they differ.

### D8 — One commit path for player and system commands

`commitCommand(cmd, { entry: 'new' | 'same' })` runs these steps:
1. dispatch `accrued(now())` (D12);
2. `applyCommand`, and return if the command is rejected;
3. `committed` records a new history entry, or `replaced` updates `current` within the same entry
   during a chain or finish;
4. if `!counted` and `next.started`, dispatch `stats/played(mode)` and set `counted`;
5. on the transition from playing to won, dispatch `stats/won({ mode, elapsedMs, score:
   displayedScore(next) })`, and `stats/dailyCompleted(dailyKey)` when the mode is Daily and
   `dailyKey` is set.

`resetStatistics` also sets `counted = false`. That is how D8's "count again after a reset" rule is
met: the next commit, or the win, counts the game again, so won never exceeds played.

### D9 — Streak break on replacement

`startGame` awaits the deal. After the delivered deal passes the epoch check, it installs the deal
and breaks the streak in the same step:
- if the outgoing `current` is started and unwon, dispatch `stats/streakBroken(outgoing.mode)`;
- then dispatch `installed`.

Restart does the same synchronously. A cancelled deal never reaches this step. `continueGame` and
Back never break a streak.

### D10 — Restart replays provenance

`restart` builds the new game with `dealFromSeed(current.seed, current.mode, { verdict:
current.verdict, attempts: current.attempts })`. It keeps `dailyKey`, sets `counted` to false and
bumps `epoch`. It reads no preference, which satisfies *KS-SET-06* and *KS-DEAL-08*.

### D11 — Safe-card chain and finish sequencing

- `play(cmd)`:
  - Refuse while `busy`, with no game, or when the game is won.
  - `commitCommand(cmd, 'new')`. If the command is accepted and `preferences.autoSafe` is on, set
    `busy` and loop:
    - wait `delay(selectReducedMotion ? 0 : 160)`;
    - check the epoch;
    - re-read `autoSafe`;
    - `nextSafeMove(current)`, then `commitCommand(send, 'same')`, until none remains or the game
      is won.
  - Clear `busy` in `finally`.
- `finish()`:
  - Requires `selectCanFinish`.
  - Takes `finishPlan(current).commands`, sets `busy`, and applies each command with
    `commitCommand(c, first ? 'new' : 'same')`. Each step waits `delay(reduced ? 0 : 75)` and checks
    the epoch.
  - The plan is recomputed from the committed state, not taken from `plan.state`, so every step goes
    through the engine and is scored as it happens.
- Undo, redo and toggling the setting never start a chain.
- `delay` is injected (D14). With 0 ms it resolves on a microtask, so reduced-motion tests need no
  fake timers.

*Alternative considered:* commit `finishPlan(state).state` in one step. Rejected, because Phase 6
animates each step from the store and a reload mid-finish must show a consistent position.

### D12 — Clock

```ts
clockEligible = route === 'game' && sheet === null && documentVisible
                && current?.started === true && current.status === 'playing'
```

This is exactly the §4 Timer row. `busy` is deliberately not part of it.

- `accrued(atMs)`:
  - When the clock is eligible and `anchorMs` is set, add `min(floor(atMs − anchorMs), 1000)` to
    `current.elapsedMs`, so it stays an integer on the fractional `performance.now` clock (the validity check
    requires one). History snapshots are left alone.
  - Then set `anchorMs` to `anchorMs + step` when the gap was within `[0, 1000]` (the sub-millisecond remainder
    carries over), to `atMs` when it was larger or negative, and to `null` when not eligible.
  - The anchor is also cleared whenever eligibility ends (route, sheet, visibility, win), so
    resuming never counts the gap.
  - The first accepted command sets the anchor through `commitCommand`'s accrual, so pre-start time
    never counts.
- `createClockTicker(store, { now, setInterval, clearInterval })` dispatches `accrued(now())` every
  250 ms and on every eligibility change.
- `now` is `performance.now` in production. It is monotonic, so wall-clock changes do nothing.
- The deal service keeps its own `Date` clock for the Daily key.

### D13 — Record v1, loading and writing

```text
solitaire.local-state → {
  version: 1,
  preferences: { theme, nightCards, fourColor, cardBack, tapMode, highlight, autoSafe,
                 stockRight, animations, locale, winnableOnly, selectedMode },
  stats: { modes: { draw1|draw3|vegas|daily: { played, won, streak, bestStreak,
                    bestTimeMs: number|null, bestScore: number|null } },
           daily: { completed: string[] /* ≤ 400, ascending, unique */, bestStreak } },
  session?: { current: GameState, history: Step[] /* ≤ 200 */, future: Step[] /* ≤ 200 */,
              dailyKey: string|null, counted: boolean }   // only when resumable
}
```

- **Enum values:**
  - `theme` is `light|dark|system`.
  - `cardBack` is `harbour|navy|sky|coral`.
  - `tapMode` is `smart|select`.
  - `locale` is `en|uk`.
  - `selectedMode` is a `Mode`.
- **Daily streak:** the current Daily streak is derived by a selector from `completed` and today's
  UTC key, so it is never stored stale.
- **Codec (`recordCodec.ts`, pure):**
  - `encodeRecord(state) → string`.
  - `decodeRecord(raw: string | null)` returns `{ ok: true, record }` or `{ ok: false, reason:
    'empty' | 'malformed' | 'invalid' | 'future' }`, and never throws.
  - Games are validated with the domain's `isValidGameState`, and each decoded step with it too.
  - Cross-field checks are conservative: a session `dailyKey` needs a Daily game, and a mode's
    `streak` may not exceed its `bestStreak`. `won <= played` is deliberately not checked.
  - `current` and every stored tableau card must have exactly their known keys.
- **Loader (`persistenceLoader.ts`):** `loadInitialState(gateway, languages)` returns the
  `preloadedState` fragment plus the D3 backup and notice outcome. It runs before `configureStore`,
  so the first render already shows Continue.
- **Writer (`persistenceWriter.ts`):**
  - Subscribes to the store and compares the encoded record inputs.
  - A change other than `elapsedMs` is debounced to 250 ms. An `elapsedMs`-only change is written
    at most every 5 s.
  - `flush()` runs on `pagehide` and when `visibilitychange` goes hidden. `cancel()` is used by
    reset-all.
  - Skips everything while `readOnly`.
  - A failed write dispatches `persistence/writeFailed` and raises `storage-write` once, until a
    later write succeeds.
- **Gateway (`storageGateway.ts`):**
  - `read(key)`, `write(key, value)` and `remove(key)`, each returning `{ ok, value | error }`.
  - The default `Storage` factory wraps the `window.localStorage` access in `try`, because Safari
    private mode can throw.
  - It is the only module that names `localStorage`, which `tests/unit/repo/storageBoundary.test.ts`
    checks.

### D14 — Store construction and layering

- `createAppStore(options?: { preloadedState?, deps?: Partial<ThunkExtra> })`, where `ThunkExtra`
  is `{ dealService, now, delay, today, gateway }`. It is declared in `src/app/thunkExtra.ts`, which
  imports only feature types, never the store.
- Missing dependencies get defaults, so bare `createAppStore()` still works for the existing tests.
  The default deal service is created lazily on first use, so tests that never deal never start a
  worker.
- Slices: `app`, `game`, `preferences`, `stats` and `persistence`.
- `serializableCheck` and `immutableCheck` ignore `game.history` and `game.future`, which would be
  slow at hundreds of snapshots.
- **`app` slice:**
  - `route`;
  - `sheet: SheetId | null`, where `SheetId` is `settings|help|stats|newDeal|paused|win|dealCode|about`;
  - `notices: { id: NoticeId }[]`, where `NoticeId` is `storage-read|storage-read-only|storage-write`
    and deduplicated;
  - `documentVisible`, `systemReducedMotion`;
  - `dealing: { overlay: boolean; attempt: number } | null`.
- `selectReducedMotion` is `!preferences.animations || app.systemReducedMotion`. It is the single
  selector of principle 6.
- **`persistence` slice:** `{ readOnly, lastError: 'read' | 'write' | null }`.
- `resolveLocale(languages)` lives in `features/preferences`. `src/i18n` stays reserved until
  Phase 7, which may move it.

### D15 — The lifecycle-storage gate

- `scripts/validate-lifecycle-storage.mjs` is a port of the sibling's script. It reads every
  `tests/component/appLifecycle*.test.tsx` and fails on `\blocalStorage\b`,
  `\bStorage\.prototype\b` or a bare `createStorageGateway()`.
- `package.json` gains `validate:lifecycle-storage`. `validate` becomes `format:check && lint &&
  typecheck && validate:lifecycle-storage && test:unit && build`.
- `AGENTS.md`'s D6 deferral note is replaced. `validate:artifact` stays deferred to Phase 8.
- The workflows already run `validate`, so they are unchanged.

## Risks / Trade-offs

- **Adding `undos` to `GameState` touches fixtures and solver messages.**
  → The engine spreads state, and the solver ignores unknown fields. `tests/fixtures/states.ts`
  `makeState` gains `undos: 0`, and one domain task runs the full unit suite.
- **Unbounded in-memory history on a very long session.**
  → A snapshot is about 1 KB, so 10,000 moves is about 10 MB, which is acceptable. Only 200 + 200
  are stored. The dev-mode checks skip these paths.
- **A write every 5 s for the clock.**
  → The write is skipped when nothing changed. Encoding is about 300 KB at most, and the 5 s
  throttle keeps the cost negligible.
- **A read-only session loses progress silently.**
  → The `storage-read-only` notice states it. Reset all is the documented way out. Phase 7 renders
  the notice.
- **`busy` is not in clock eligibility, so chain and finish time counts.**
  → The documented §4 rule is kept. Reduced motion shortens these sequences, so the difference is
  at most a few seconds.
- **A Continue button and status line in the unstyled shell.**
  → They are explicitly throwaway markup that Phase 7 restyles. Component tests use role and name
  queries, so they survive the restyle.
- **The deal service is created at store construction.**
  → It is lazy, and `dispose()` is called from the lifecycle's `dispose`.

## Migration Plan

- **Versioned `localStorage` record:** this change creates `solitaire.local-state` at version 1.
  There is no earlier version to migrate.
  - A record from any other version is treated as `future` or `invalid`, backed up untouched
    (D3), and never interpreted.
  - A future v2 adds a `migrate(v1) → v2` step in the codec. The backup-key rule stays the safety
    net.
- **Unreadable data is never dropped silently:** it is copied to
  `solitaire.local-state.unreadable` before the first write. If that is impossible, the session
  never writes (D3).
- **Rollback:** reverting this change leaves the key behind in players' browsers. A later
  re-introduction reads it again. No deployed version reads it today.
- **Domain type change:** `undos` is additive. Existing domain tests keep passing once fixtures
  carry the field.

## Open Questions

None that change the specs, the approach or the tasks.
