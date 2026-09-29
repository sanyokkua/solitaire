# Features layer

Application services and Redux slices built on top of the domain and solver layers.
`deal/` landed in Phase 3 (Solver & deal service); `preferences/`, `stats/`, `game/` and `persistence/` landed in
Phase 4 (State, persistence & timer). The `persistence/` layer includes the versioned codec (version 2, reading version 1), storage gateway,
loader for defensive decode and hydration, writer for debounced persistence, and reset thunks. `interaction/` (the
runtime-only interaction state: selection, hint, announcements, dead ends and the input gate) landed with the Phase 6 change `add-board-interaction`.

- `deal/daily.ts` — UTC day key and daily v1 seed list
- `deal/solverClient.ts` — lazy solver Web Worker client: request ids, cancellation (`cancel`, and `cancelHints` for hints alone) and timeout rules, malformed replies fail the client, never-rejecting results; its `hint` settles as a `SolverHintOutcome` (`ok`, `cancelled`, `timeout`, `busy` or `failed`), distinct from the deal service's `HintOutcome`
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
  and Vegas use. `dispose()` cancels everything and terminates the worker.
- `deal/budgets.ts` — the node budgets and the attempt cap: `WINNABLE_BUDGET` (Draw 1, 5,000), `DRAW3_WINNABLE_BUDGET` and
  `VEGAS_WINNABLE_BUDGET` (the ordered-talon search, 20,000 each), `MAX_ATTEMPTS` (40 candidates) and `HINT_BUDGET`
  (3,000). Daily has its own pinned pair in `daily.ts`. The Draw 3 and Vegas values come from the per-mode benchmark
  recorded in `tests/README.md`.
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
  applied), `selectCanFinish` (not busy and `finishPlan` exists, memoised on the piles plus draw, passes, mode and status, so clock ticks never recompute the plan), `selectEpoch` and `selectCurrentGame` (moved here from `src/app/selectors.ts`, since they read only `game` state). `selectGameControlsIdle` (structural `{ app, game }`) is false while `busy` or `app.dealing` is non-null, used by the HUD New deal control and Time (Phase 7). `accrued` settles play
  time at an injected-clock reading: while `eligible` and an anchor is set it adds the whole milliseconds since the
  anchor to `current.elapsedMs` (so it stays an integer on a fractional clock), capped at 1 s per step and never
  negative, then moves the anchor forward by what was added (the sub-millisecond remainder carries over; a larger or
  negative gap moves it to `atMs`), or sets it to `null` when not eligible (so the first accrual after resuming only sets the anchor and the gap is never counted); `history` and
  `future` are left untouched, and without a game it just clears the anchor
- `game/clock.ts` — `selectClockEligible({ app, game })`: true only on the Game route with no sheet open, a visible
  document, and a game that has started and is still playing; `busy` does not matter
- `game/gameThunks.ts` — the game thunks (typed with `AppThunk`, declared in `src/app/appThunk.ts` with type-only store imports so there is no runtime cycle and feature thunks share one type without importing each other). Both timed
  sequences, the safe-card chain and `finish`, run through one private runner that owns the guard, epoch capture, `busy`,
  delay, re-check and cleanup; each thunk only says what the next command is and how it joins the undo history.
  When `play` ends an accepted command (and its chain), or `finish` ends, in the same game, it calls `checkDeadEnd`; a
  `pass-limit` refusal from `play` raises the `no-redeals` notice.
  `commitCommand(cmd, { entry: 'new' | 'same' })` is the one path every command takes and returns a `CommitResult`
  (`{ accepted, events }`: the engine's events, including the `rejected` event with its reason for a refusal; with no
  game `{ accepted: false, events: [] }`): it settles the clock at one `now()` reading, applies the command (a refusal changes nothing but that
  settlement), records a new undo step (`'new'`) or updates the current one (`'same'`), settles the clock again at the
  same reading (so the first accepted command sets the anchor), counts the game as played on its first accepted
  command (`played(mode)` + `countedSet(true)`), and on the playing-to-won transition records `won` (mode, settled
  `elapsedMs`, `displayedScore`), then `winRecorded` (D4; `interaction/interactionSlice.ts`) with the mode's previous
  best time read _before_ `won` overwrites it (so `newBestTime` reflects what the record was before this win), the
  same score, `next.moves`, `winBonus(elapsedMs, scoring)` as `timeBonus` (0 under Vegas), and, for a Daily deal with a
  `dailyKey`, `dailyCompleted(dailyKey)`. `play(cmd)` is
  `commitCommand` as a new step, ignored while `busy`, with no game, or once won (it then resolves
  `{ accepted: false, events: [] }`); it returns a promise that resolves, when the safe-card chain has ended, with the
  player's own command's `CommitResult` (a refused command returns its result and starts no chain). When "Auto-move safe cards" is on and the accepted command leaves a safe card
  exposed, `play` sets `busy` and sends the safe cards to the foundations one at a time via `nextSafeMove`, each as
  `commitCommand(send, { entry: 'same' })` so the whole chain belongs to the command's undo step. Before each send it
  waits `delay(160)` (`delay(0)` under `selectReducedMotion`) and stops if the `epoch` moved (a game was installed or
  cleared), the setting was switched off, or the game is gone or won. `busy` is cleared at the end only if the epoch is
  unchanged, so a newer game's own sequence is never clobbered; with no safe card or the setting off, `play` never sets
  `busy` and never waits. What announces what (the `announced` log, see `interaction/`): `play` announces the events of its own command right after `commitCommand` returns (`moved`, `drew`, `recycled`, `won`, or `refused{reason}` for a refusal; nothing for an ignored play), before the chain starts; the private runner announces nothing per step and, when a chain or `finish` ends normally or stops early in the same game (not when it throws or the game was replaced), dispatches one batch: `sentHome{count}` (accepted steps that moved a card to a foundation) then `won` if a step won; `undo()` / `redo()` announce `undone` / `redone` once the action is dispatched. Only `play` starts a chain: undo, redo and switching the setting on never do. `undo()` and `redo()` do nothing
  unless `selectCanUndo` / `selectCanRedo` holds, otherwise they settle the clock and then dispatch `undone()` /
  `redone()`; they never count a game. `finish()` plays the remaining cards home: unless `selectCanFinish` holds it does
  nothing, otherwise it sets `busy`, takes the commands of `finishPlan` for the current position and applies them one at
  a time through `commitCommand` (the first as a new undo step, the rest inside it, so every draw and recycle is
  scored, counted and pass-limited by the engine and the win is recorded once). Before each step it waits `delay(75)`
  (`delay(0)` under `selectReducedMotion`) and stops if the `epoch` moved, the game is gone or won, or the engine refuses
  a step; `busy` is cleared at the end only if the epoch is unchanged
- `game/sessionThunks.ts` — split out of `gameThunks.ts` (D15, a pure move; behaviour unchanged): `breakStreakOf(outgoing)`
  (module-private, shared by `startGame`, `restart` and `playDealCode`) breaks the streak of a game about to be replaced
  (`streakBroken(outgoing.mode)`) when it was started and not won; an unstarted or won outgoing game costs nothing.
  `startGame({ mode })` deals and installs a new game: it reads `winnableOnly` from the preferences and forwards it in
  the `dealService.deal` request, publishes the service's progress as `app.dealing` (a report that arrives after the
  game epoch moved is dropped), and changes nothing when the result is `cancelled`, the game epoch moved while
  dealing (a restart, a reset or another install), or a newer start was requested (even if this deal had already
  resolved). Otherwise it breaks the replaced game's streak then dispatches `installed` with the deal's `dayKey`
  (Daily) or `null`. `dealingEnded()` runs at the end only if the start is still the latest for that deal service (a
  per-service start id in a `WeakMap`), so a superseded start never clears a newer start's progress; a rejection
  propagates after that cleanup. `restart()` replays the current deal on the spot with
  `dealFromSeed(seed, mode, { verdict, attempts })`, so the layout is identical and nothing played carries over; it
  reads no preference, keeps `dailyKey`, breaks the streak by the same rule, is allowed while `busy` (the install bumps
  the epoch and stops the sequence), and does nothing without a game. `continueGame()` shows the Game screen (`setRoute('game')`) only while
  `selectResumable` holds (a started game that is still playing) and does nothing otherwise; it touches nothing but the
  route, so it never replaces the game or breaks a streak. `playDealCode(code)` (D5) trims and case-folds the code through
  `domain/dealCode.ts`'s `decodeDealCode`; an invalid code changes nothing and reports `{ ok: false }`, a valid one
  breaks the replaced game's streak, installs `dealFromSeed(seed, mode, { verdict: 'random', attempts: 1 })` with
  `dailyKey: null`, ends any in-flight start's dealing progress (`dealingEnded()` — the epoch bump already makes that
  start discard its own result), shows Game and reports `{ ok: true }`
- `game/navigationThunks.ts` — the intent thunks that own every route and sheet change (D3): the UI dispatches these,
  never `setRoute`/`sheetOpened`/`sheetClosed` directly (an ESLint rule bans importing those three from `src/ui/**`,
  checked by `tests/unit/repo/eslintRules.test.ts`). `dealNewGame(mode)` closes any open sheet (including Win — this
  is one of only two ways Win closes), shows Game and calls `startGame({ mode })`. `requestNewDeal()` opens the
  `newDeal` sheet for a started, unwon game, otherwise deals the current game's mode at once, or the preferred mode
  when there is no game; it does nothing while `game.busy` or `app.dealing !== null`. `restartDeal()` closes the sheet
  and calls `restart()`. `goHome()` closes any open sheet (Win included) and shows Home. `openSheet(id)` and
  `closeSheet()` wrap `sheetOpened`/`sheetClosed` for the UI; `closeSheet()` refuses to close `win` (the other way it
  closes is `dealNewGame`'s Deal again), so Escape can never dismiss it. `pause()` opens the `paused` sheet when the exported `canPause(state)`
  holds: on the Game route, with a game that is not won, and not while `game.busy` or `app.dealing !== null` (the P
  shortcut checks the same predicate). `resume()` is
  `closeSheet()`
- `interaction/interactionSlice.ts` — the runtime-only interaction state (never persisted, and not read by the persistence
  writer, so changing it never writes): `selection: { from: PileRef, index } | null`, with `selectionSet` and
  `selectionCleared`. Its `extraReducers` clear the selection, the hint and the pending hint on the game actions
  `committed`, `replaced`, `undone`, `redone`, `installed` and `cleared`; the slice imports `game`, never the reverse. The selection is data, not a group,
  so it cannot go stale. It also holds the announcement log `announcement: { seq, items: [{ n, item }] }` (reducer `announced(items)`: an empty batch is a no-op, otherwise each item gets a running `n` that continues from the last and is never reused, only the latest 20 are kept, and `seq` grows once per batch). No game action resets it, so an install cannot drop an unspoken `won`; the `Announcement` union and the pure `announcementsOf(events)` live in `interaction/announcements.ts`, which also
  carries the `codeCopied` descriptor (5.6, D14; no `announcementsOf` case, since it is never derived from a
  `GameEvent` — `dealCodeCopied()` dispatches it directly, like `deadEnd`). The hint: `hint: HintView | null` (`{ id, kind: 'move' | 'draw' | 'recycle', cards, target: PileRef | 'stock' }`, set by `hintSet`, cleared by `hintCleared(id?)`, which given an id clears only that hint so an older timer cannot clear a newer one, and also cleared by `preferenceSet` and `preferencesReset`), `lastHintId` (ids only grow) and `pendingHint: { epoch, key } | null` (the hint request in flight, `pendingHintSet`). The dead-end memory: `deadEndSeen`, the position keys already reported in this game (`deadEndRecorded(key)`), emptied by `installed` and `cleared` only, so undo and redo keep it. The win summary (D4): `win: WinSummary | null`
  (`{ mode, score, elapsedMs, moves, timeBonus, newBestTime }`), set by `winRecorded` (dispatched from `gameThunks.ts`'s
  `commitCommand` right after `won`) and cleared, alongside `deadEndSeen`, by `installed` and `cleared` only; never
  read by the persistence writer, so it is never in the encoded record
- `interaction/selectors.ts` — structural `{ game, interaction }` selectors: `selectSelection`, `selectAnnouncement`, `selectHint`, `selectNextHintId`, `selectWinSummary`, `selectSelectedGroup`
  (`groupAt` over the position in play) and `selectLegalTargets` (`legalTargets` for that run), the last two memoised
  and `undefined` when nothing is selected, no game is in play, or the card no longer starts a movable run. `selectInputEnabled` (structural `{ app, game }`) is the one input gate every input path reads: true only on the Game route with no deal in flight, no sheet open, a game that is not won and no chain or Finish running; there is no cascade term because the game stays won for the whole win cascade
- `interaction/interactionThunks.ts` — `selectCard(from, index)`: dispatches `selectionSet` only when the position in
  play has a movable group at that card (a face-up column run, or the top of the waste or a foundation), otherwise it
  clears the selection. A reducer cannot see the game, hence a thunk. It never imports `game/gameThunks`.
  `requestHint()` shows a hint for the position in play at no cost to the game: it does nothing without a game, when the
  game is won or while a chain or finish runs; on a dead end (`advise`) it raises the `dead-end` notice and announces
  `deadEnd` (on every request) and asks for no hint; otherwise it records `pendingHint`, awaits `dealService.hint`,
  drops a `none` or `cancelled` answer or one for a game or position that changed meanwhile, sets the `HintView`
  (a move names its cards and target, a draw or recycle names `'stock'`), announces `hinted`, and clears it after
  `HINT_DURATION_MS` (2,200 ms, through the injected `delay`) unless a newer hint replaced it. A request for the same
  `{ epoch, positionKey }` as the one in flight returns without asking again. `checkDeadEnd()` reports a dead end once
  per position and game: the first time `isDeadEnd` holds for a position key, it records the key, raises `dead-end` and
  announces `deadEnd`; `play` and `finish` call it, undo and redo never do. `dealCodeCopied()` (5.6, D14) raises the
  `code-copied` notice and announces `codeCopied` together, in one dispatch; `src/ui/components/DealCode.tsx` calls it
  after `navigator.clipboard.writeText` resolves, and dispatches nothing (selecting the code text instead) when the
  Clipboard API is unavailable or the write is refused
- `shared/timers.ts` — `SubscribableStore<State>` (the structural `{ getState, subscribe, dispatch }` shape a listener
  needs, so it never imports the real store) and `globalTimers()` (`now`, `setTimeout`/`clearTimeout`,
  `setInterval`/`clearInterval`, all resolved at call time so fake timers installed after the module loads still
  apply), shared by `game/clockTicker.ts` and `persistence/persistenceWriter.ts`, each of which picks the subset of
  `GlobalTimers` it needs
- `game/clockTicker.ts` — `createClockTicker(store, timers?)` drives the play clock: it dispatches
  `accrued({ atMs: now(), eligible: selectClockEligible(state) })` once when created, every 250 ms, and whenever
  eligibility changes (so the anchor is set or cleared the moment play starts or stops; `accrued` never changes
  eligibility, so the store listener cannot loop). When play stops while the game is still `playing`, the time since
  the last tick is settled first, so a pause never drops up to a tick of play. `now`, `setInterval` and `clearInterval`
  (`shared/timers.ts`) are injectable and default to the real ones. It takes a structural store and returns
  `{ dispose }`, which clears the interval and unsubscribes (idempotent)
- `src/app/savePort.ts` (outside this layer) — `createSavePort()` returns a `SavePort` (`{ flush, cancel }`) that does
  nothing until `connect(writer)` gives it a real writer; `startApp` creates one before the store and connects it once
  the writer exists, and the store's `ThunkExtra.saver` is that same instance, so any thunk (a Settings reset, later
  the PWA update thunk `src/app/pwaThunks.ts`) can flush or cancel the pending save without reaching the writer directly (D8)
- `src/app/pwaThunks.ts` (outside this layer) — `applyUpdate()` flushes the pending save through `saver`, then calls
  `pwa.applyUpdate()` (it still applies when persistence is read-only or the flush throws); `installApp()` prompts
  through `pwa.promptInstall()`, then clears `app.installable`. `ThunkExtra.pwa` is inert by default; `main.tsx` passes
  the real gateways to `startApp(root, { pwa })`, which raises the `update-ready` notice on an update and sets
  `installable` as the browser's install offer comes and goes
- `src/app/lifecycle.tsx` (outside this layer) wires the ticker and the writer into the running app: `startApp(root, deps?)`
  loads the record, creates the store, raises the loader's notices, applies the appearance attributes to the document
  element with `themeController.ts` and sets `<html lang>`/`document.title` with `src/i18n/localeController.ts`
  (both before the first render), starts the ticker and the writer and connects the save port to the writer, attaches
  the page listeners (`visibilitychange` updates `documentVisible` and flushes the writer when hidden, `pagehide`
  flushes, the reduced-motion media query updates `systemReducedMotion`), renders, and returns `{ store, dispose }`,
  which also disposes the locale controller
- `stats/statsSlice.ts` — per-mode statistics (`played`, `won`, `streak`, `bestStreak`, `bestTimeMs`, `bestScore` for
  Draw 1, Draw 3, Vegas and Daily). `played(mode)` counts a game, `won({ mode, elapsedMs, score })` adds a win, grows
  the streak and keeps the fastest time and highest score (negative Vegas banks included), `streakBroken(mode)` zeroes
  one mode's streak and keeps its best, `statsReset()` restores fresh initial state. Selector `selectModeStats`
  takes the structural shape `{ stats }`; `winRateOf(modeStats)` is the win rate of one mode record
  (the Statistics sheet uses it directly). The `daily` block records Daily completions:
  `dailyCompleted(dayKey)` adds a UTC `YYYY-MM-DD` once (a repeat is a no-op, an earlier date lands in sorted
  position), raises `daily.bestStreak` to the consecutive run containing it, then keeps only the newest 400 dates — the
  stored best survives the trim. `selectDailyStreak(state, todayKey)` is the run of consecutive days ending today or
  else yesterday, otherwise 0 (dates after today never hide it). `dailyCompleted` leaves the `daily` mode's
  played/won counters alone. `selectOverallStats(state)` (5.4, D8) is the overall record across the four modes: summed
  played/won, a rounded whole-percent win rate (`null` before any game is played), and the largest current and best
  streaks among the modes — the Daily date-streak above stays a separate concept and is not folded in. `stats/dayKeys.ts`
  holds the pure UTC day arithmetic (`previousDayKey`, `nextDayKey`, `runLengthEndingAt`, `runContaining`)
- `stats/statsThunks.ts` (5.4, D8) — `todayKey(): AppThunk<string>` returns the UTC day key (`utcDayKey`, reused from
  `features/deal/daily.ts`) of the injected clock (`extra.today()`), for callers outside a deal request that need
  "today" shaped as a Daily day key (the Statistics sheet's current Daily streak)
- `preferences/locale.ts` — `Locale` and `SUPPORTED_LOCALES` re-exported from the `src/i18n/catalog.ts` registry (a
  new, data-only dependency from `features` to `i18n`), plus `resolveLocale(languages)`: the first browser-preferred
  language whose primary subtag is supported (`uk-UA` selects `uk`), otherwise English
- `preferences/preferencesSlice.ts` — the thirteen user preferences (the last is `difficulty`: `any`, `easy`, `medium` or `hard`, default `any`) with the specification §6 defaults
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
- `persistence/recordCodec.ts` — the version 2 device record, pure. Exports `STORAGE_KEY` (`solitaire.local-state`),
  `BACKUP_KEY` (`solitaire.local-state.unreadable`) and `RECORD_VERSION` (2).
  `encodeRecord({ preferences, stats, game })` returns one JSON string whose objects are built field by field in a
  fixed order (`version`, `preferences`, `stats`, then `session`), so equal input always gives the identical string;
  `session` is present only for a started game that is still playing. `decodeRecord(raw)` never throws and returns
  `{ ok: true, record: { preferences, stats, session } }` or `{ ok: false, reason }`: `empty` (no stored value),
  `malformed` (not JSON), `future` (a version above 2, never interpreted) or `invalid` (anything else that is not
  exactly a valid version 1 or 2 record). A version 1 record (twelve preferences, no `difficulty`) is decoded with its
  own exact key set and upgraded by `upgradeV1`, which adds `difficulty: 'any'` and changes nothing else, so the loader
  treats it as valid (no backup, no notice) and the next save writes version 2. Every object must have exactly its known keys; the enum values, non-negative integer
  counts (a mode's `streak` may not exceed its `bestStreak`), `bestTimeMs`, `bestScore` and the Daily list (at most `MAX_DAILY_COMPLETED`, 400, real, strictly ascending `YYYY-MM-DD` dates, the cap exported by `statsSlice.ts`) are
  checked, and a bad part rejects the whole record, with no salvage
- `persistence/guards.ts` — the shape checks the codecs share when decoding untrusted storage: `isRecord`, `hasExactKeys`
  (required and optional keys; unknown keys fail) and `isDayKey` (a real UTC `YYYY-MM-DD` date)
- `persistence/sessionCodec.ts` — the stored game, used by `recordCodec.ts`. Exports `MAX_STORED_STEPS` (200) and `RecordVersion` (`1 | 2`). `encodeSession` keeps the newest 200
  history steps and the nearest 200 future steps (the tail of each stack, since the next redo is last) as compact
  steps holding `tableau`, `stock`, `waste`, `foundations`, `score`, `moves`, `passes`, `elapsedMs`, `undos` and
  `started` (the last three because a snapshot keeps the values it had when captured). `decodeSession(value, version)` accepts exactly
  `current`, `history`, `future`, `dailyKey` (a real date, and only for a Daily game, or `null`) and `counted`;
  `current` must have exactly the `GameState` keys of that record version (checked on the raw record, before it is
  validated; the version 1 and version 2 lists are the same for now), pass `isValidGameState`, have `{ id, up }` cards,
  and be started and playing; each step is rebuilt into a full `GameState` (the constant fields
  copied from `current`, `status` `playing`) that must pass `isValidGameState` too, so a round trip is exact
- `persistence/persistenceSlice.ts` — what the shell needs to know about saving: `{ readOnly, lastError }`, starting at
  `{ readOnly: false, lastError: null }` (`initialPersistenceState`). Read-only comes only from the loader's `preloadedState`, and stops saving for the
  session; `writeFailed()` sets `lastError` to `'write'`, and `writeSucceeded()` clears it only if it is `'write'`, so a
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
  and the Daily record are cleared while the game and the settings stay. `resetAllLocalData()` reads `saver` and
  `languages` from the thunk extra and restores a first visit: `cleared()` (the epoch moves, so a running chain,
  finish or deal is dropped), `dealingEnded()`, `preferencesReset(resolveLocale(languages()))`, `statsReset()`, route
  `home`, `sheetClosed()`, `persistenceReset()` and the three storage notices dismissed; then `saver.cancel()` so no
  waiting or newly scheduled save survives; then both `STORAGE_KEY` and `BACKUP_KEY` are removed through the gateway.
  A failed remove does not stop the reset. Nothing is written until the player's next change

The store hands every thunk a `ThunkExtra` (`src/app/thunkExtra.ts`): `dealService` (created lazily, so a store that
never deals never starts the solver worker), `now` (`performance.now`), `delay` (`setTimeout`), `today`
(`new Date()`), `gateway` (a storage gateway over the browser's local storage), `saver` (a `SavePort`, unconnected
until `startApp` wires it to the real writer) and `languages` (`navigator.languages` by default). The store has six
slices: `app`, `preferences`, `stats`, `game`, `interaction` and `persistence`. `createAppStore({ preloadedState, deps })` starts
from the loaded state (see `persistenceLoader.ts`) and replaces any of the thunk dependencies, which is how tests
inject `fakeDealService()` or a fake clock. The store's development state checks skip `game.history` and
`game.future`, which are unbounded.

One dependency needs care (5.4, D8): the default (lazy) deal service's Daily-deal date logic reads a `now` clock
(`createDealService({ now })`), and that clock must track whichever `today` a caller ends up with. The single assembly
`assembleThunkExtra(overrides, create?)` in `src/app/thunkExtra.ts` (used by `createAppStore` and `startApp`) merges the
overrides over the defaults and, only when the caller did not inject its own `dealService`, builds the lazy default
once as `lazyDealService(() => extra.today(), create)` (`create` defaults to `createDealService`; only tests pass another): that closure reads the final, merged `extra.today` at the moment a deal
actually happens, not when the store was built, so `createAppStore({ deps: { today } })`'s injected clock is what the
default deal service's Daily deal reads. An explicitly injected `deps.dealService` is used exactly as given. `startApp`
also reads the browser languages for the loader through `extra.languages()`, so a test injects `languages` instead of
patching `navigator.languages`.

This layer may depend on `src/domain` and Redux Toolkit. It reaches `src/solver` only through the worker
URL (a `new URL(...)` string, not an import) and typed messages, so solver code never loads on the input
thread: type-only imports from `src/solver` are allowed, value imports are lint errors
(`@typescript-eslint/no-restricted-imports` in `eslint.config.js`). It never imports from
`src/ui` — the UI dispatches typed commands into this layer, not the other way round.
