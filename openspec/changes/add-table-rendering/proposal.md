# Proposal

## Why

Phases 1–4 delivered a store that deals, plays, scores, times, undoes and restores a game, but the
Game screen still shows a single line of text. Nobody can see the cards. This change implements
Phase 5 of `docs/spec/phased-design.md` §7: the table looks like the mockup and animates, on every
device of spec §8.5, without page scrolling. It covers:

- every card has a name that a screen reader reads out (*KS-A11Y-01*);
- suits can be told apart without colour (*KS-A11Y-05*);
- the Draw 3 waste shows up to three fanned cards (*KS-MOVE-06*);
- the light, dark and night-card palettes meet 4.5:1 text contrast (*KS-SET-03*);
- motion can be switched off, or follows the system's reduced-motion setting (*KS-SET-04*);
- Stock on the right mirrors the top row (*KS-SET-05*);
- the table fits every screen from 320×480 to 2560×1440, including the worst-case 19-card column
  (*KS-GEN-03*, *KS-GEN-05*);
- the side-rails profile and the wide table switch on where they help (*KS-GEN-06*, *KS-GEN-07*);
- rotation, folding and browser bars re-lay the table out in one frame (*KS-GEN-08*);
- notches and rounded corners never cover content (*KS-GEN-10*);
- each face-up card in a long column keeps a 14 px finger strip, and chrome controls stay 44 px on
  touch screens (*KS-A11Y-04*);
- card motion uses only compositor-friendly properties (*KS-PERF-01*).

Phase 6 then adds input to a board that already renders every position correctly.

## What Changes

How each item is built is in `design.md` (D1–D18); this section states only what changes.

- **Appearance (`src/app`, `src/ui/styles`):**
  - A theme controller applies the preferences to the page: Light, Dark or System (following the
    device live), night cards, four-colour deck, card back and motion on/off.
  - The night-card palette changes the cards only, as in the mockup (D3).
  - The token contract is rebuilt (D3): outline, hover, shadow, table, slot, per-back, radius and
    motion tokens are added; the night-card and numbered card-back tokens are replaced by card roles that the
    night block overrides.
  - **User decision (D2):** the red and four-colour inks that miss 4.5:1 on the card face are
    darkened just enough, keeping their hue. Light: red `#D1404C`, blue ♦ `#287DA2`, green ♣
    `#348170`. Dark: red `#B1303C`, blue ♦ `#206788`, green ♣ `#286B5C`. A unit test locks every
    ink × face pair and the HUD text pairs.
  - The hard-coded-colour guard covers every stylesheet except the token file.
- **Board layout (`src/ui/board`, pure):**
  - `measure()` turns the board size and pointer type into metrics. It picks the stacked or the
    wide-table geometry by the 14 px / 9 px worst-strip rule.
  - `positions()` turns the piles (`BoardPiles`) into a placement for each of the 52 cards, plus
    slot and badge anchors and the deal order. It covers column compression (face-down cards
    first), the 0.30 touch offset, the Draw 3 fan, the stock-right mirror, buried cards and stacking
    order.
  - Both are deterministic: the same piles and size give the same output. A repository guard keeps
    them free of React, the DOM and storage.
- **Board rendering (`src/ui/board`):**
  - 52 persistent card elements in a fixed order, placed by `transform`.
  - Card faces: corner index, centre pip, boxed J/Q/K, mirrored bottom corner on larger cards.
  - Four card backs, night cards and the four-colour deck.
  - Slots with faint "A + suit" and "K" placeholders; the stock shows a recycle mark and dims when
    no recycle is left; a count badge sits on the stock.
  - Accessible names for every card and pile.
- **Motion (`src/ui/board`):** glide and flip transitions driven by state changes; the staggered deal
  from the stock; one no-motion path; re-layout on resize, and on the first measurement, within one
  frame with transitions off.
- **Game screen (`src/ui/screens`, `src/ui/components`), user decision (D1):**
  - A frame with the stacked profile and the side-rails profile (landscape, height ≤ 720 px), sized
    like the mockup.
  - It uses the full dynamic viewport height and safe-area insets. Regions are reserved for the
    chips, hint line and deal-code footer of Phase 7.
  - A read-only HUD shows Score (or Bank in Vegas), Moves and Time.
  - A toolbar has Undo and Redo, wired to the existing thunks.
  - The build stamp moves into the frame's footer.
- **Tests and tooling:**
  - Layout unit tests at every §8.5 board size, and component tests for the size and pointer hooks,
    cards, slots, board, HUD, toolbar and motion.
  - End-to-end tests start from positions seeded as a real v1 record through the project's own
    codec. No test hook ships in the bundle (D13; this replaces phased-design §5's `?fixture=` hook).
  - Browser checks of the frame profiles and of the applied appearance (computed styles).
  - A 52-case device-fit matrix plus three baseline sizes, run in a dedicated Chromium project.
  - Visual-parity screenshots of mockup screens 03–07 and 14–17, uploaded by CI on every run.
  - An informational cold-worker Winnable Draw 1 latency report (*KS-DEAL-10*, *KS-PERF-02*;
    reported, not gated).
- **Splits recorded for task sizing:**
  - The layout engine is split into metrics, stacked positions, wide-table positions and a sweep
    over device sizes.
  - Rendering is split into names, card, slot, the size and pointer hooks, and board.
  - The chrome is split into HUD, toolbar and frame.
  - The appearance e2e check is its own task, after the seeding helper it needs.
  - Motion is split into glide and flip, deal, and resize.
- **Specification-pack alignment:**
  - `specification.md` §8.1: the darkened inks, the LCD label colour, the night-card scope and the
    night ♦/♣ inks, backs, rim and navy-night variant.
  - `research.md` R§10: 4 / 3 px are the small-board minimums of padding and gap.
  - `phased-design.md`:
    - §3.1: the board file list as built;
    - §4: Viewport changes (no `visualViewport` listener) and Deal animation;
    - §5: seeded records instead of a fixture URL, and the device-fit project;
    - Phase 5: ghosts and landing rects move to Phase 6.

**Not in this change:**
- Any board input and everything tied to it (Phase 6):
  - tap, select and place, double-tap, drag, and the keyboard;
  - legal-target ghosts, landing rects, selection ring, shake;
  - hint display, dead-end notice, Finish button, win cascade;
  - live announcements;
  - cancelling a drag on resize.
- Mode and deal chips, hint-line text, the deal-code footer, the dealing overlay, all sheets, the
  styled Home and localisation (Phase 7). Accessible names are English until Phase 7 moves them into
  the catalogs.
- Offline, install and update behaviour (Phase 8).

## Capabilities

### New Capabilities

- `app/appearance`: how preferences reach the page — theme (including System), night cards,
  four-colour deck, card back and the motion flag.
- `ui/board-layout`: the pure, deterministic geometry — metrics, stacked and wide-table choice,
  compression, fan, mirror, stacking order, anchors and deal order.
- `ui/board-render`: what the table shows — persistent cards, faces, backs, palettes, slots and
  placeholders, stock states, badge and accessible names.
- `ui/board-motion`: glide, flip and deal animation, the no-motion path and resize re-layout.
- `ui/game-screen`: the Game frame and its two chrome profiles, safe areas, the read-only HUD, the
  Undo/Redo toolbar and the no-scroll fit on every device.

### Modified Capabilities

- `app/application-shell`: "Semantic colour tokens for the three palettes". The night-card palette
  covers card roles only; the palettes are applied from preferences; card inks and HUD text are
  locked at 4.5:1 by a test.
- `tooling/repository-foundation`:
  - "Test suites separated by execution layer": the device-fit matrix runs in its own Chromium
    project, the other projects skip it, and Chromium-only specs skip elsewhere.
  - "Continuous integration on every push and pull request": visual-parity screenshots are uploaded
    on every run.
  - Added "In-browser deal latency is reported": a cold-worker Winnable Draw 1 latency report in
    desktop Chromium, not gated.

## Impact

- **`src/app`:** new `themeController.ts`; `lifecycle.tsx` starts and disposes it.
- **`src/App.tsx`:** provides the dealt-epoch context and no longer renders the build stamp itself.
- **`src/ui`:**
  - new `board/`: `metrics.ts`, `layout.ts`, `names.ts`, `selectors.ts`, `animations.ts`,
    `useBoardSize.ts`, `DealtEpochContext.tsx`, `CardView.tsx`, `PileSlot.tsx`, `StockBadge.tsx`,
    `Board.tsx`;
  - new `useMediaQuery.ts` and `format.ts`;
  - new `components/Hud.tsx` and `components/Toolbar.tsx`;
  - `screens/GameScreen.tsx` rebuilt as the frame;
  - new `styles/board.css`, `styles/cards.css` and `styles/layout.css`; `tokens.css` rebuilt;
    `global.css` motion switch; new `src/ui/README.md`.
- **`src/domain`, `src/solver`, `src/features`, `src/i18n`, `src/pwa`:** untouched. No storage schema
  change.
- **`tests/`:**
  - new unit suites under `tests/unit/ui/` (including the static CSS tests `boardCss.test.ts` and
    `layoutCss.test.ts`) and `tests/unit/app/themeController.test.ts`;
  - a new board purity guard and a Playwright-projects guard under `tests/unit/repo/`;
  - new component suites, including `useBoardSize.test.tsx` and `useMediaQuery.test.tsx`; updated
    `appShell.test.tsx`, `appLifecycle.test.tsx`, `appLifecycle.wiring.test.tsx` and
    `tests/setup.ts`;
  - new e2e specs `board`, `frame`, `appearance`, `motion`, `resize`, `deviceFit`, `visualParity`
    and `dealLatency`, with the seeding helper `tests/e2e/support/seed.ts`; updated
    `smoke.spec.ts`;
  - new fixtures `tests/fixtures/viewports.ts` and `tests/fixtures/boardPositions.ts`.
- **Configuration:** `playwright.config.ts` (the `device-fit` project), `eslint.config.js` (board
  purity override), `.github/workflows/ci.yml` (always upload screenshots) and
  `tests/unit/repo/configContract.test.ts`.
- **Docs:** `docs/spec/specification.md` §8.1, `docs/spec/research.md` R§10,
  `docs/spec/phased-design.md`, `README.md`, `AGENTS.md`, `tests/README.md` and the new
  `src/ui/README.md`.
- **Constitution:**
  - Principle 3 holds. The board renders snapshots, and the toolbar dispatches the existing
    `undo`/`redo` thunks.
  - Principle 5 does not yet apply to the board: board input arrives in Phase 6. The two toolbar
    controls work by pointer and keyboard; dragging a button is not an input path.
  - Principle 6 holds. Every new animation has one no-motion path, driven by the existing
    reduced-motion selector.
  - Principle 7 holds. Every card and pile is named, the card inks and HUD text meet 4.5:1, and
    touch targets are checked.
  - Principle 1 is extended in spirit, not changed: the pure board layout gets its own purity guard,
    and AGENTS.md principle 1 names it. No principle is changed.
