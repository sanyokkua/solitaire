# Proposal

## Why

Phases 1–5 built an engine, a solver, a state layer and a table that draws and animates every
position, but nobody can play: the board has no input, the toolbar has only Undo and Redo, cards are
plain images, and nothing shows a hint, a dead end or a win. This change implements Phase 6 of
`docs/spec/phased-design.md` §7 — every way of playing works (tap, select and place, double-tap,
drag, keyboard) and the assistance features are visible (legal targets, hint, Finish, dead-end
notice, live announcements, win cascade). It also includes groundwork on existing code, so the new
input code lands on clean seams rather than on a growing god component and a thunk that throws its
results away.

## What Changes

How each item is built is in `design.md` (D1–D14); this section states only what changes.

- **Groundwork — enabling and quality work on existing code (no behaviour change; its acceptance is
  that the existing suites stay green plus each item's named test, and it adds no requirement):**
  - `src/domain/assist.ts` (five concerns, 265 lines) is split by concern; the duplicated pile and
    suit constants move to one place; hint and dead end stop contradicting each other (one
    advice entry point); a position key identifies a position.
  - `src/features/game`: `selectFinishable` stops re-running the finish simulation on every clock
    tick; the safe-card chain and Finish share one sequence runner instead of two copies;
    `commitCommand` and `play` report the engine's events and whether the command was accepted (a
    chain or Finish announces once, when it ends).
  - `src/features/deal`: the worker client's `HintOutcome` is renamed `SolverHintOutcome` (the deal service keeps `HintOutcome`), so each name means one type; `SolverHint` derived from `Hint`.
  - `src/app`: `AppState` becomes readonly like every other state type; named selectors
    (`selectDealing`, `selectBusy`, `selectEpoch`).
  - `src/ui`: `Board` sheds its resize and deal effects into hooks; named selectors replace inline
    store reads; one shared `Icon`; typed rank words; shared constants instead of cross-component
    imports; a test pins the animation constants to their CSS tokens.
  - `tests/`: one `FakeResizeObserver` and one `matchMedia` stub in `tests/support/` instead of
    copies.
- **Interaction state (`src/features/interaction`, new):** selection, hint, announcements and
  once-per-position dead-end memory, all runtime-only. Thunks `selectCard`, `requestHint` and the
  dead-end check. An input gate closes the board while dealing, while a sheet is open, while a sequence
  runs, and after a win (which covers the whole win cascade).
- **Pure input modules (`src/ui/board`):** a pointer state machine (tap, double-tap, drag
  thresholds, no tap after a drag, cancel), a keyboard controller (focus moves and shortcuts), a
  card locator and landing rectangles with largest-overlap hit-testing. DOM binders wire them to
  the board with one delegated listener set.
- **Playing:**
  - Smart tap, select and place, double-tap to the foundation, stock draw and recycle ("No redeals
    left" in Vegas), drag with legal-target ghosts and glide-back, cancel on resize and on Esc.
  - Roving keyboard focus across piles and cards, Enter/Space as a tap, Shift+Enter/Shift+Space to
    pick a card up in either tap setting (so Smart move players can choose any legal target by
    keyboard), and the global shortcuts.
- **Assistance UI:** legal-target ghosts, selection ring, shake, hint pulse on source and target
  (or the stock), the hint text in the hint line, Hint and Finish toolbar controls, a small
  notices host for the dead-end and Vegas messages, and one polite live region that announces moves,
  draws, undo, redo, hints and the win.
- **Win:** the cascade plays when the last card reaches its foundation (skipped without motion).
  The Win sheet itself stays in Phase 7.
- **Tests:** unit suites for every pure module, component suites for the binders, and Playwright
  specs that play a fixture deal to a win by tap, by drag and by keyboard on desktop Chromium, plus
  a touch-drag check in the Chromium mobile project and a touch-action check in the WebKit ones; visual-parity screenshots for mockup screens 08, 09
  and 12; a manual real-phone drag checkpoint.
- **Spec-pack alignment:** `phased-design.md` §3.1, §3.3, §4 and the Phase 6 status;
  `specification.md` notes on the New deal and Pause keys, the Shift+Enter pick-up and the hint line; the `README.md`,
  `AGENTS.md` and package READMEs that say "no board input yet".

**Decisions taken where the mockup and the specification differ** (the specification wins on
behaviour, the mockup on looks):
- Finish charges, counts and pass-limits its draws and recycles (the mockup makes them free).
- A Draw 1 hint uses the solver's line when it arrives in time (the mockup is heuristic only).
- The dead-end notice appears once per position (the mockup repeats it).
- Esc cancels an active drag; arrow keys move focus (the mockup has neither).
- The second tap of a double-tap never repeats or redirects the first tap's move; a multi-card
  double-tap does nothing extra (the mockup runs `bestTarget` for it).
- State marks are drawn outside the card edge and use light-theme colours darker than the mockup's,
  so they meet 3:1 on the table.

**Not in this change:**
- The Win sheet, the mode and deal chips, the tap-mode text of the hint line, the New deal sheet
  and Pause sheet, and therefore the **N** and **P** keys (Phase 7). The controller recognises
  them; binding them lands with their sheets, and *KS-INP-08* is complete only then.
- English and Ukrainian catalogs: announcement and notice text is English through typed
  descriptors and one formatter, ready for Phase 7 to swap (Phase 7).
- Offline, install and update behaviour (Phase 8).
- A storage change: interaction state is never persisted.

## Capabilities

### New Capabilities

- `features/interaction`: selection, hint, announcements and once-per-position dead-end state, the
  hint request, the dead-end check and the input gate.
- `ui/board-input`: pointer input on the board — smart tap, select and place, double-tap, stock,
  drag, hit-testing, glide-back, cancel.
- `ui/board-keyboard`: keyboard operation of the board — focus model, roles, pick-up, shortcuts.
- `ui/board-assist`: what assistance looks like — legal-target ghosts, selection ring, shake, hint
  visuals, focus ring, and their no-motion behaviour.
- `ui/win-cascade`: the win cascade.
- `ui/notices`: the transient message host and the live announcer.

### Modified Capabilities

- `domain/assistance`: one advice entry point that agrees with dead-end detection; a position key.
- `features/game-session`: commands report acceptance and events; the finish selector is stable
  across clock ticks.
- `ui/board-layout`: landing rectangles (foundation, column, stock, waste) and the waste anchor.
- `ui/board-render`: interactive roles, focus stops and pile data on the elements.
- `ui/game-screen`: Hint and Finish tools beside Undo and Redo, the hint line shows the hint, the
  live region and the notices host.
- `tooling/repository-foundation`: purity guard covers the new pure modules; the input end-to-end
  specs and their helpers (shared test doubles are groundwork, not a requirement).

## Impact

- **`src/domain`:** `assist.ts` split into `safeMoves.ts`, `hint.ts`, `smartTap.ts`, `finish.ts`,
  `deadEnd.ts` plus `position.ts`; `cards.ts` gains the shared constants; `solver` imports them.
  Rules and scoring unchanged.
- **`src/features`:** new `interaction/` slice, `selectors.ts` and `interactionThunks.ts`; `game/gameThunks.ts`, `gameSlice.ts`
  reworked as above; `deal/` type unification; new notice ids and `readonly` in `src/app/appSlice.ts`, and named selectors in `src/app/selectors.ts`.
- **`src/ui`:** new `board/{pointerController,keyboardController,locate,landing,cascadeFrames}.ts` (pure),
  `board/{useBoardActions,useBoardPointer,useBoardKeyboard,useGameShortcuts,useCascade,cascade,useResizeSettle,useDealAnimation}.ts`,
  `board/Ghosts.tsx`, `components/{Icon,Notices,Announcer}.tsx`, `announce.ts`; `Board`, `CardView`, `PileSlot`,
  `Toolbar`, `GameScreen` changed; new CSS in `board.css`, `cards.css`, `layout.css`, `tokens.css`.
- **`src/i18n`, `src/pwa`:** untouched (reserved-layer guard keeps them empty).
- **`tests/`:** new unit, component and e2e suites; `tests/support/` doubles (resize observer,
  `matchMedia`, pointer capture, WAAPI); the Chromium-only spec list in `playwrightProjects.test.ts`; fixtures reused
  (`WINNING_LINE`, `parseLine`); updated role- and toolbar-dependent tests.
- **Configuration:** `eslint.config.js` purity override and `src/ui/README.md` list; no
  `playwright.config.ts` change.
- **Docs:** the stale "later phase" sentences in
  the main specs `domain/assistance`, `ui/board-render` and `ui/game-screen` (fixed when the change is
  archived), `README.md`, `AGENTS.md`, `src/{domain,features,ui}/README.md`, `tests/README.md`,
  `docs/spec/phased-design.md`, `docs/spec/specification.md`.
- **Constitution:** no principle changes. Principle 5 now holds for the board (every move by tap,
  drag and keyboard, each tested). Principle 6: every new animation has a no-motion path. Principle
  3: the UI dispatches typed commands and renders snapshots.
