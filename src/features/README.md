# Features layer

Application services and Redux slices built on top of the domain and solver layers.
`deal/` landed in Phase 3 (Solver & deal service); `preferences/`, `stats/`, `game/` and `persistence/` landed in
Phase 4 (State, persistence & timer). The `persistence/` layer includes the versioned codec (v1), storage gateway,
loader for defensive decode and hydration, writer for debounced persistence, and reset thunks.

- `deal/daily.ts` — UTC day key and daily v1 seed list
- `deal/solverClient.ts` — lazy solver Web Worker client: request ids, cancellation (`cancel`, and `cancelHints` for hints alone) and timeout rules, malformed replies fail the client, never-rejecting results
- `deal/dealService.ts` — `createDealService`: `deal({ mode, winnableOnly }, onProgress?)`, `hint(state)` and `dispose()`.
  `deal()` deals Draw 1 (switch on, 40 fresh seeds at 5,000 nodes) and Daily (the UTC day's v1 candidates at 20,000
  nodes, whatever the switch says) through the solver worker, and every other request (Draw 3, Vegas, Draw 1 with the
  switch off) at once on the input thread from one fresh seed, `random`, 1 attempt. The state is
  `dealFromSeed(seed, mode, { verdict, attempts })`, so its deal code reproduces it without the solver.
  `onProgress({ overlay, attempt })` reports each attempt as it starts; `overlay` turns true once the request has been
  pending 160 ms (one timer per request, cleared on settle). Every `deal()` cancels pending requests first and settles
  as `{ status: 'cancelled' }` when a newer one replaces it; if the worker fails, the first seed (Draw 1) or
  `dailySeed(day, 1)` (Daily) is dealt as `random`, 1 attempt. A dealt Daily deal also carries `dayKey`, the UTC
  `YYYY-MM-DD` its candidate seeds were derived from (worker-verified or the worker-failure fallback alike); every other
  mode omits `dayKey`. `hint(state)` settles as `{ status: 'hint', source, hint }`,
  `{ status: 'none' }` (won, or no move at all) or `{ status: 'cancelled' }` (a newer hint, any deal or `dispose()`
  replaced it). Draw 1 positions without a pass limit ask the solver (3,000 nodes, 150 ms) and take its first line
  move; no suggestion, a timeout, a failure or a pending deal falls back to the domain heuristic, which is all Draw 3
  and Vegas use. `dispose()` cancels everything and terminates the worker. Exports `WINNABLE_BUDGET`, `MAX_ATTEMPTS`
  and `HINT_BUDGET`
- `game/history.ts` — pure undo and redo over `Session` (`{ current, history, future }`, both stacks unbounded).
  `commit(session, next)` starts an undo step (the position in play joins `history`, `future` is cleared);
  `replace(session, next)` updates the position in play inside the current step. `undo` and `redo` restore the last
  history or future snapshot and push the outgoing position onto the opposite stack; both return the same session
  when their stack is empty or the game is won, and `canUndo` / `canRedo` report exactly that. Carry-over: `elapsedMs`
  and `started` always come from the outgoing position, `undos` too, plus one on undo only (redo never refunds); the
  piles, score, moves and passes come from the snapshot
- `game/gameSlice.ts` — the game session: `current` (the position in play, or `null`), `history` and `future` (the
  undo and redo stacks), `dailyKey` (the UTC day of a Daily deal), `counted` (whether the outcome is in the stats)
  and the runtime-only `busy` (a safe-card chain or finish is running), `epoch` (bumped on every install and
  clear so a stale sequence can tell) and `clock.anchorMs`; the last three are never persisted. Reducers:
  `installed({ state, dailyKey })` (fresh history, `counted` false, no clock anchor, epoch + 1), `committed(next)` and
  `replaced(next)` (over `history.ts`'s `commit` and `replace`), `undone()` / `redone()` (ignored while `busy`),
  `accrued({ atMs, eligible })`, `busySet`, `countedSet` and `cleared()` (no game, epoch + 1). Selectors take the
  structural shape `{ game }`: `selectCanUndo`, `selectCanRedo`, `selectResumable` (started and still playing), `selectDisplayedScore` (charges
  applied) and `selectCanFinish` (not busy and `finishPlan` exists, memoised per position). `accrued` settles play
  time at an injected-clock reading: while `eligible` and an anchor is set it adds the whole milliseconds since the
  anchor to `current.elapsedMs` (so it stays an integer on a fractional clock), capped at 1 s per step and never
  negative, then moves the anchor forward by what was added (the sub-millisecond remainder carries over; a larger or
  negative gap moves it to `atMs`), or sets it to `null` when not eligible (so the first accrual after resuming only sets the anchor and the gap is never counted); `history` and
  `future` are left untouched, and without a game it just clears the anchor
- `game/clock.ts` — `selectClockEligible({ app, game })`: true only on the Game route with no sheet open, a visible
  document, and a game that has started and is still playing; `busy` does not matter
- `game/gameThunks.ts` — the game thunks (`AppThunk`, with type-only store imports so there is no runtime cycle).
  `commitCommand(cmd, { entry: 'new' | 'same' })` is the one path every command takes and returns whether it was
  accepted: it settles the clock at one `now()` reading, applies the command (a refusal changes nothing but that
  settlement), records a new undo step (`'new'`) or updates the current one (`'same'`), settles the clock again at the
  same reading (so the first accepted command sets the anchor), counts the game as played on its first accepted
  command (`played(mode)` + `countedSet(true)`), and on the playing-to-won transition records `won` (mode, settled
  `elapsedMs`, `displayedScore`) and, for a Daily deal with a `dailyKey`, `dailyCompleted(dailyKey)`. `play(cmd)` is
  `commitCommand` as a new step, ignored while `busy`, with no game, or once won; it returns a promise that settles when
  the safe-card chain has ended. When "Auto-move safe cards" is on and the accepted command leaves a safe card
  exposed, `play` sets `busy` and sends the safe cards to the foundations one at a time via `nextSafeMove`, each as
  `commitCommand(send, { entry: 'same' })` so the whole chain belongs to the command's undo step. Before each send it
  waits `delay(160)` (`delay(0)` under `selectReducedMotion`) and stops if the `epoch` moved (a game was installed or
  cleared), the setting was switched off, or the game is gone or won. `busy` is cleared at the end only if the epoch is
  unchanged, so a newer game's own sequence is never clobbered; with no safe card or the setting off, `play` never sets
  `busy` and never waits. Only `play` starts a chain: undo, redo and switching the setting on never do. `undo()` and `redo()` do nothing
  unless `selectCanUndo` / `selectCanRedo` holds, otherwise they settle the clock and then dispatch `undone()` /
  `redone()`; they never count a game. `finish()` plays the remaining cards home: unless `selectCanFinish` holds it does
  nothing, otherwise it sets `busy`, takes the commands of `finishPlan` for the current position and applies them one at
  a time through `commitCommand` (the first as a new undo step, the rest inside it, so every draw and recycle is
  scored, counted and pass-limited by the engine and the win is recorded once). Before each step it waits `delay(75)`
  (`delay(0)` under `selectReducedMotion`) and stops if the `epoch` moved, the game is gone or won, or the engine refuses
  a step; `busy` is cleared at the end only if the epoch is unchanged. `startGame({ mode })` deals and installs a new
  game: it reads `winnableOnly` from the preferences and forwards it in the `dealService.deal` request, publishes the
  service's progress as `app.dealing` (a report that arrives after the game epoch moved is dropped), and changes nothing when the result is `cancelled`, the game epoch moved while
  dealing (a restart, a reset or another install), or a newer start was requested (even if this deal had already
  resolved). Otherwise it breaks the replaced game's streak
  (`streakBroken(outgoing.mode)`) if that game was started and not won, then dispatches `installed` with the deal's
  `dayKey` (Daily) or `null`. `dealingEnded()` runs at the end only if the start is still the latest for that deal
  service (a per-service start id in a `WeakMap`), so a superseded start never clears a newer start's progress; a
  rejection propagates after that cleanup. `restart()` replays the current deal on the spot with
  `dealFromSeed(seed, mode, { verdict, attempts })`, so the layout is identical and nothing played carries over; it
  reads no preference, keeps `dailyKey`, breaks the streak by the same rule, is allowed while `busy` (the install bumps
  the epoch and stops the sequence), and does nothing without a game. `continueGame()` shows the Game screen (`setRoute('game')`) only while
  `selectResumable` holds (a started game that is still playing) and does nothing otherwise; it touches nothing but the
  route, so it never replaces the game or breaks a streak
- `game/clockTicker.ts` — `createClockTicker(store, timers?)` drives the play clock: it dispatches
  `accrued({ atMs: now(), eligible: selectClockEligible(state) })` once when created, every 250 ms, and whenever
  eligibility changes (so the anchor is set or cleared the moment play starts or stops; `accrued` never changes
  eligibility, so the store listener cannot loop). When play stops while the game is still `playing`, the time since
  the last tick is settled first, so a pause never drops up to a tick of play. `now`, `setInterval` and `clearInterval` are injectable and default,
  resolved at call time, to `performance.now` and the global timers. It takes a structural store and returns
  `{ dispose }`, which clears the interval and unsubscribes (idempotent)
- `src/app/lifecycle.tsx` (outside this layer) wires the ticker and the writer into the running app: `startApp(root, deps?)`
  loads the record, creates the store, raises the loader's notices, starts both, attaches the page listeners
  (`visibilitychange` updates `documentVisible` and flushes the writer when hidden, `pagehide` flushes, the
  reduced-motion media query updates `systemReducedMotion`), renders, and returns `{ store, dispose }`
- `stats/statsSlice.ts` — per-mode statistics (`played`, `won`, `streak`, `bestStreak`, `bestTimeMs`, `bestScore` for
  Draw 1, Draw 3, Vegas and Daily). `played(mode)` counts a game, `won({ mode, elapsedMs, score })` adds a win, grows
  the streak and keeps the fastest time and highest score (negative Vegas banks included), `streakBroken(mode)` zeroes
  one mode's streak and keeps its best, `statsReset()` restores fresh initial state. Selectors `selectModeStats` and
  `selectWinRate` take the structural shape `{ stats }`. The `daily` block records Daily completions:
  `dailyCompleted(dayKey)` adds a UTC `YYYY-MM-DD` once (a repeat is a no-op, an earlier date lands in sorted
  position), raises `daily.bestStreak` to the consecutive run containing it, then keeps only the newest 400 dates — the
  stored best survives the trim. `selectDailyStreak(state, todayKey)` is the run of consecutive days ending today or
  else yesterday, otherwise 0 (dates after today never hide it). `dailyCompleted` leaves the `daily` mode's
  played/won counters alone. `stats/dayKeys.ts` holds the pure UTC day arithmetic (`previousDayKey`, `nextDayKey`,
  `runLengthEndingAt`, `runContaining`)
- `preferences/locale.ts` — `Locale` (`'en' | 'uk'`), `SUPPORTED_LOCALES` and `resolveLocale(languages)`: the first
  browser-preferred language whose primary subtag is supported (`uk-UA` selects `uk`), otherwise English
- `preferences/preferencesSlice.ts` — the twelve user preferences with the specification §6 defaults
  (`defaultPreferences(locale)`; only the language depends on the browser). `preferenceSet({ key, value })` changes one
  preference (a key/value mismatch fails typechecking), `preferencesReset(locale)` restores the defaults. Selectors
  `selectPreferences` and `selectPreference(state, key)` take the structural shape `{ preferences }`, so this slice
  needs no store import
- `persistence/storageGateway.ts` — `createStorageGateway(storage?)`, the only module in `src` that names browser
  storage (`tests/unit/repo/storageBoundary.test.ts` fails on any other). It moves strings under caller-supplied keys:
  `read(key)` (`null` for an absent key), `write(key, value)` and `remove(key)`, each returning a `StorageResult`
  (`{ ok: true, value }` or `{ ok: false, error }`), so an unavailable, blocked or full storage is a result, never a
  throw. The default storage is `window.localStorage`, or none (every call fails) outside a browser or when reaching it
  throws, as in Safari private mode; tests inject `memoryStorage()` or `throwingStorage()` from
  `tests/fixtures/storage.ts`
- `persistence/recordCodec.ts` — the v1 device record, pure. Exports `STORAGE_KEY` (`solitaire.local-state`),
  `BACKUP_KEY` (`solitaire.local-state.unreadable`), `RECORD_VERSION` (1) and `MAX_STORED_STEPS` (200).
  `encodeRecord({ preferences, stats, game })` returns one JSON string whose objects are built field by field in a
  fixed order (`version`, `preferences`, `stats`, then `session`), so equal input always gives the identical string;
  `session` is present only for a started game that is still playing. `decodeRecord(raw)` never throws and returns
  `{ ok: true, record: { preferences, stats, session } }` or `{ ok: false, reason }`: `empty` (no stored value),
  `malformed` (not JSON), `future` (a version above 1, never interpreted) or `invalid` (anything else that is not
  exactly a valid v1 record). Every object must have exactly its known keys; the enum values, non-negative integer
  counts (a mode's `streak` may not exceed its `bestStreak`), `bestTimeMs`, `bestScore` and the Daily list (at most 400 real, strictly ascending `YYYY-MM-DD` dates) are
  checked, and a bad part rejects the whole record, with no salvage
- `persistence/sessionCodec.ts` — the stored game, used by `recordCodec.ts`. `encodeSession` keeps the newest 200
  history steps and the nearest 200 future steps (the tail of each stack, since the next redo is last) as compact
  steps holding `tableau`, `stock`, `waste`, `foundations`, `score`, `moves`, `passes`, `elapsedMs`, `undos` and
  `started` (the last three because a snapshot keeps the values it had when captured). `decodeSession` accepts exactly
  `current`, `history`, `future`, `dailyKey` (a real date, and only for a Daily game, or `null`) and `counted`;
  `current` must pass `isValidGameState`, have exactly the `GameState` keys and `{ id, up }` cards, and be started and
  playing; each step is rebuilt into a full `GameState` (the constant fields
  copied from `current`, `status` `playing`) that must pass `isValidGameState` too, so a round trip is exact. Also
  exports the shared `isRecord`, `hasExactKeys` and `isDayKey` checks
- `persistence/persistenceSlice.ts` — what the shell needs to know about saving: `{ readOnly, lastError }`, starting at
  `{ readOnly: false, lastError: null }` (`initialPersistenceState`). `readOnlyEntered()` stops saving for the session,
  `writeFailed()` sets `lastError` to `'write'`, and `writeSucceeded()` clears it only if it is `'write'`, so a
  start-up `'read'` error stays. `persistenceReset()` restores the initial state, and is how
  `resetAllLocalData` (in `resetThunks.ts`) ends a read-only session
- `persistence/persistenceLoader.ts` — `loadInitialState(gateway, languages)` reads the record before the store exists
  and returns `{ preloadedState, notices }`; it never throws and only ever writes the one backup copy. No stored record
  gives the defaults (language from `languages`) and no notice. A valid record preloads its preferences, statistics and,
  when it holds one, the game (`initialGameState` plus the stored `current`, `history`, `future`, `dailyKey` and
  `counted`, so `busy`, `epoch` and the clock anchor start at their runtime defaults); `app` is never preloaded, so the
  route stays `home`. A `malformed`, `invalid` or `future` record gives the defaults and is first copied to
  `BACKUP_KEY`: an empty backup key (which is written) or one already holding the identical string counts as backed up
  (`persistence: { readOnly: false, lastError: 'read' }`, notice `storage-read`); a different string there, or a backup
  key that cannot be read or written, makes the session read-only (`readOnly: true`, notice `storage-read-only` alone).
  Storage that cannot be read at all also gives the defaults and read-only, since what is stored is unknown and must not
  be overwritten. The notices are returned, not preloaded; the lifecycle raises them with `noticeRaised`
- `persistence/persistenceWriter.ts` — `createPersistenceWriter(store, gateway, timers?)` returns `{ flush, cancel, dispose }`
  and keeps the device record current. It listens to the store (typed structurally, so no runtime store import) and
  compares by reference what the record holds: preferences, statistics and the game's `history`, `future`, `dailyKey`,
  `counted` and `current`; `busy`, `epoch`, `clock`, `app` and `persistence` are ignored, so its own dispatches never
  loop. Any change is written 250 ms after the last one (a burst of moves is one write); a change to `current` that is
  only `elapsedMs` is written at most every 5 s and never delays or replaces a save already waiting. While
  `persistence.readOnly` is set nothing is scheduled, and the flag is checked again when a write runs. A record that
  encodes to the string already written is skipped. A successful write dispatches `writeSucceeded` and re-arms the
  notice; a failed one dispatches `writeFailed` and raises `storage-write` once until the next success (its own flag,
  so a dismissed notice does not return), and the next change retries. `flush()` writes now if a save is waiting or the
  last one failed (for `pagehide` and a hidden document); `cancel()` drops any waiting save and forgets what was last
  written (reset-all); `dispose()` is `cancel()` plus unsubscribing. `timers` (`setTimeout`, `clearTimeout`, `now`)
  default to the globals, looked up at call time
- `persistence/resetThunks.ts` — `resetStatistics()` dispatches `statsReset()` and `countedSet(false)`, so every mode
  and the Daily record are cleared while the game and the settings stay. `resetAllLocalData(writer, languages)` restores a
  first visit: `cleared()` (the epoch moves, so a running chain, finish or deal is dropped), `dealingEnded()`,
  `preferencesReset(resolveLocale(languages))`, `statsReset()`, route `home`, `sheetClosed()`, `persistenceReset()` and the three storage
  notices dismissed; then `writer.cancel()` so no waiting or newly scheduled save survives; then both `STORAGE_KEY` and
  `BACKUP_KEY` are removed through the gateway. A failed remove does not stop the reset. Nothing is written until the
  player's next change

The store hands every thunk a `ThunkExtra` (`src/app/thunkExtra.ts`): `dealService` (created lazily, so a store that
never deals never starts the solver worker), `now` (`performance.now`), `delay` (`setTimeout`), `today`
(`new Date()`) and `gateway` (a storage gateway over the browser's local storage). The store has five slices: `app`,
`preferences`, `stats`, `game` and `persistence`. `createAppStore({ preloadedState, deps })` starts from the loaded
state (see `persistenceLoader.ts`) and replaces any of the thunk dependencies, which is how tests inject
`fakeDealService()` or a fake clock. The store's development state checks skip `game.history` and `game.future`, which
are unbounded.

This layer may depend on `src/domain` and Redux Toolkit. It reaches `src/solver` only through the worker
URL (a `new URL(...)` string, not an import) and typed messages, so solver code never loads on the input
thread: type-only imports from `src/solver` are allowed, value imports are lint errors
(`@typescript-eslint/no-restricted-imports` in `eslint.config.js`). It never imports from
`src/ui` — the UI dispatches typed commands into this layer, not the other way round.
