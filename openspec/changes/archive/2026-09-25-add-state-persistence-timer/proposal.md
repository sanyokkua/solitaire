# Proposal

## Why

Phases 2 and 3 delivered the rules engine and the deal service, but nothing holds a game yet. The
shell's two screens are static, nothing is saved, there is no undo, no statistics and no clock.
*KS-AST-04/07/08*, *KS-SCO-05/06*, *KS-STA-01…05*, *KS-PER-01…05*, *KS-SET-06* and *KS-GEN-04* all
need an application state layer around the engine: a game session with history, a clock that pauses,
statistics, preferences, and a versioned record on the device. This change implements Phase 4 of
`docs/spec/phased-design.md` §7. Phases 5–7 then render and drive a store that already plays,
scores, times, remembers and restores a game.

## What Changes

How each item is built is in `design.md` (D1–D15); this section states only what changes.

- **Domain (`src/domain`, pure):**
  - `GameState` gains an undo count that, like elapsed time, never rewinds. A fresh deal has 0, and
    the engine never changes it.
  - The displayed Standard score subtracts 2 points per undo on top of the time penalty. Undo
    itself restores the earlier position's score exactly, the way classic Windows Solitaire
    reverses the undone move's points (user decision, D2). Redo never refunds the charge. Vegas
    charges nothing.
  - A pure validity check for a stored game state: 52 unique cards, legal pile structure, ascending
    single-suit foundations, face-down cards only beneath face-up ones.
- **Deal service (`src/features/deal`):** a Daily deal reports the UTC date it was dealt for, so
  statistics can record the deal's own day (user decision, D4).
- **State layer (`src/features`, `src/app`):**
  - `preferences`: every setting of spec §6 with its default. The language defaults to the first
    supported browser language.
  - `stats`: per-mode played, won, streak, best streak, best time and best score, plus the Daily
    completed days and the Daily streak.
  - `game`: the session, with the current game, undo and redo history, a busy flag and a deal epoch.
    Thunks: start, play, undo, redo, restart and finish. Safe cards chain to the foundations inside
    the move's history entry. Statistics are updated on the first accepted command, on every win
    and whenever a started, unwon game is replaced.
  - `app`: gains the open sheet, notices, document visibility, the system reduced-motion flag and
    dealing progress, with a single reduced-motion selector.
  - `persistence`: hydration status, read-only mode and the last error.
  - A clock that accrues play time only on the Game screen, with no sheet open, while the document
    is visible and the game is started and not won.
- **Persistence (`src/features/persistence`):**
  - The `solitaire.local-state` v1 record: preferences, statistics and the started, unfinished game
    with its newest 200 undo steps and nearest 200 redo steps. The record is decoded defensively
    before the store is created.
  - An unreadable or future-version record is copied once, untouched, to a backup key. The app then
    starts from defaults with a non-blocking notice and saves normally. If the backup cannot be kept
    safely, the session stops saving instead (user decision, D3).
  - Writes are debounced and flushed when the page is hidden or left. A failed write leaves the game
    playable and raises one notice.
  - Actions for Reset statistics and Reset all local data. Their confirmation UI is Phase 7.
- **Shell wiring (`src/app`, `src/ui`, user decision, D1):**
  - `main.tsx` makes one call into an application lifecycle module that loads the record, builds the
    store, and starts the clock, the writer and the page listeners.
  - Home "Deal cards" starts a game in the selected mode.
  - A plain "Continue game" control appears while a resumable game exists.
  - Back keeps the game resumable.
- **Guards and tooling:**
  - A repository guard allows browser storage only inside the storage gateway.
  - The `validate:lifecycle-storage` script deferred by the foundation change (its D6) arrives and
    joins `validate`.
- **Decisions taken in this change (flagged for review):**
  - Undo history is unlimited in memory, and the newest 200 steps are stored. This reconciles spec
    §4.4 ("unlimited") with *KS-PER-01* ("up to 200"). The redo steps are stored too, so a reload
    restores the game exactly (*KS-PER-02*).
  - Elapsed time, the start flag and the undo count survive undo and redo. Moves, passes and the
    move score rewind.
  - A game becomes resumable, and is saved, only once started. Rules for when a game counts as
    played, where a streak break applies and how restart treats provenance are in D8–D10.
- **Specification-pack alignment:**
  - `specification.md`: the wording of *KS-SCO-03*, §4.4 (history limits, undo charge) and §5
    (the undo charge in the displayed score).
  - `research.md`: §5.1 (the undo decision, as the Windows reversal plus the charge), §7 (the Daily
    completed days and streak are in v1) and §12.8 (the stored limit is 200).
  - `phased-design.md`: §3.2 (the undo count), §3.3 (the slices as built), §3.4 (the record,
    including redo steps and the backup key) and the §4 Timer row (anchor reset and tick cap).

**Not in this change:**
- The board, cards, layout and motion (Phase 5).
- Pointer, drag and keyboard input, selection, hint display, the dead-end notice and the Finish
  button (Phase 6). The thunks they will call exist here.
- The styled Home and Game chrome, all sheets (including Paused and the reset confirmations), notice
  rendering, deal-code entry and localisation (Phase 7).
- The service worker's save-before-update flow (Phase 8).
- Any cumulative Vegas bankroll (out of scope for v1, spec §1.2).

## Capabilities

### New Capabilities

- `features/game-session`: starting, playing, undoing, redoing, restarting and finishing a game;
  the safe-card chain as one history entry; history limits and carry-over rules; replacing a game;
  settings never changing a game in progress.
- `features/game-clock`: when play time accrues and pauses, how it starts, and how it is settled
  before a win is recorded.
- `features/statistics`: per-mode played, won, streaks and records; the Daily completed days and
  streak; resetting statistics.
- `features/preferences`: the settings, their defaults and the language default.
- `features/persistence`: the versioned record, what it stores, defensive loading, the backup of
  unreadable data, saving and its failure, and resetting all local data.

### Modified Capabilities

- `domain/scoring`: "Time penalty, win bonus and undo penalty": the displayed score subtracts the
  undo charge for every undo made.
- `domain/game-engine`:
  - "Move count, start flag and clock are engine-owned or engine-untouched": no command changes
    the undo count.
  - A new requirement adds the stored-game validity check.
- `domain/deal-generation`: "A mode fixes the draw count and the scoring rules": a fresh deal has
  no undos.
- `features/deal-service`: a new requirement reports the date of a Daily deal.
- `app/application-shell`:
  - "Navigation between the two screens": Home's start control deals a game in the selected mode,
    and Back keeps it.
  - New requirements add Continue game and confine browser storage to one gateway.
- `tooling/repository-foundation`: "Single aggregate validation gate" gains the lifecycle-storage
  guard.

## Impact

- **`src/domain`:** `types.ts`, `deal.ts` and `scoring.ts` change for the undo count. A new
  `validate.ts` holds the validity check. The `README.md` is updated.
- **`src/features`:**
  - `deal/dealService.ts` reports the Daily date.
  - New `preferences/`, `stats/`, `game/` (slice, history, thunks, clock) and `persistence/` (codec,
    gateway, slice, loader, writer).
  - The `README.md` is updated.
- **`src/app`:** `store.ts` takes optional dependencies and preloaded state, `appSlice.ts` grows,
  and a new `lifecycle.ts` wires the store to the page. `main.tsx` shrinks to one call.
- **`src/ui`:** `HomeScreen.tsx` and `GameScreen.tsx` gain the wiring of D1 only, with no styling
  work.
- **`src/solver`, `src/i18n`, `src/pwa`:** untouched. The locale is a plain preference value;
  catalogs stay in Phase 7.
- **`tests/`:**
  - New `unit/features/{game,stats,preferences,persistence}/` suites and `unit/domain/validate.test.ts`.
  - Updated domain scoring, deal and deal-service suites and `unit/app/store.test.ts`.
  - A new repository storage-boundary guard.
  - New component tests for the shell wiring and the reload lifecycle.
- **`scripts/`:** new `validate-lifecycle-storage.mjs`.
- **Configuration:** `package.json` gains `validate:lifecycle-storage` inside `validate`. The
  workflows are unchanged, because they run `validate`.
- **Docs:** `docs/spec/specification.md`, `docs/spec/research.md`, `docs/spec/phased-design.md`,
  `README.md`, `AGENTS.md`, `tests/README.md`, and the `src/domain` and `src/features` READMEs.
- **Constitution:**
  - Principle 1 holds. The domain gains a pure validity check and a field only. Storage, timers and
    page events live in `src/features` and `src/app`.
  - Principle 2 holds. Restart replays the stored seed without the solver, and nothing new is
    random.
  - Principle 3 is now exercised. The shell dispatches `startGame`, continue and back commands and
    never applies rules.
  - Principle 5 does not apply to the state layer: board input arrives in Phase 6. The two shell
    controls are covered by pointer and keyboard.
  - Principle 6 gains its single reduced-motion selector. It sets the chain and finish spacing to 0.
  - Principle 8 is now implemented and guarded: one versioned record, decoded defensively, with
    unreadable data backed up, never silently lost.
