# Tasks

> **Conventions.**
> - Run commands through `rtk` (`rtk proxy <cmd>` when the wrapper rejects a flag).
> - Vitest tests are `*.test.ts(x)` in `tests/`, mirroring `src/`; component tests live in
>   `tests/component/`. Playwright specs are `tests/e2e/*.spec.ts`.
> - Requirement names refer to this change's delta specs:
>   - **AP** `specs/app/appearance`
>   - **AS** `specs/app/application-shell`
>   - **BL** `specs/ui/board-layout`
>   - **BR** `specs/ui/board-render`
>   - **BM** `specs/ui/board-motion`
>   - **GS** `specs/ui/game-screen`
>   - **RF** `specs/tooling/repository-foundation` (including the added latency requirement)
> - `Dn` is `design.md` decision *n*. Read every decision a task names before coding.
> - Shared references:
>   - **spec:** `docs/spec/specification.md` §3.2, §4.1, §4.7, §6, §8.1–8.5 and §9 (the KS ids);
>   - **research:** `docs/spec/research.md` R§9, R§10, R§12 and R§13.1 (viewports and browser-bar
>     heights);
>   - **phased-design:** `docs/spec/phased-design.md` §4 rows Layout, Layout profiles, Viewport
>     changes, Rendering and Deal animation; §5;
>   - **mockup (visual authority):** `docs/spec/mockup/klondike-mockup.html`:
>     - tokens L12–91, night cards L322–328;
>     - frame L107–198 (game frame L172–198), HUD L173–183 and L307–318, toolbar L191–198 and
>       markup L520–525, responsive rules L307–321 and L377–415;
>     - card CSS L200–229, slots and badge CSS L232–239;
>     - `makeCardEl` L804–815, slot markup L817–821, `measure` L828–859, anchors and `tabOffsets`
>       L860–887, `positions` L889–909, `render` L921–949, badge placement L943–945, HUD text
>       L951–953;
>     - deal L1297–1311, resize L1577;
>     - screens in `docs/spec/mockup/screens/` (03–07, 14–17).
>   - **domain API:** `src/domain/README.md` (`cardLabels`, `FOUNDATION_DISPLAY_ORDER`, `canRecycle`);
>   - **state API:** `src/features/README.md`, `src/features/game/gameSlice.ts` and `gameThunks.ts`.
> - Build positions with `makeState`, `deepFreeze`, `tableauOf`, `faceUp`, `faceDown`,
>   `foundationsOf` and `vegasAtLimit` from `tests/fixtures/states.ts`.
> - Build stores in component tests with
>   `createAppStore({ preloadedState, deps: { dealService: fakeDealService() } })`.
> - No in-process test uses real timers, real `ResizeObserver`, real `matchMedia` or real browser
>   storage; inject or stub them.
> - Every module added to `src/ui` is described in `src/ui/README.md` (created in 2.1) in the same
>   task.
> - Every task ends with `rtk npm run test:unit` and `rtk npm run lint` green. Tasks that add or
>   change a Playwright spec also run the named `rtk npx playwright test …` command. Before each task
>   commit, run the full, unmodified `rtk npm run validate` and fix everything it reports.

## 1. Appearance

- [ ] 1.1 Rebuild the token contract, scope night cards, and lock the colour contracts
    - **Implements:** AS "Semantic colour tokens for the three palettes" (MODIFIED); AP "Night cards
      change the cards only" and "Four-colour deck and card back selection" (token side);
      *KS-SET-03*, *KS-A11Y-05*; D2, D3.
    - **References:** spec §6 and §8.1–8.2; mockup tokens L12–91 and night cards L322–328; D3 token
      table.
    - **Files:**
      - `src/ui/styles/tokens.css`: the D3 table — added, applied and removed tokens, the night block
        and the navy-night rule, the D2 inks.
      - `docs/spec/specification.md` §8.1: the D2 ink values; the LCD label and outline, soft
        outline, hover, table dot, slot line, slot ink, chrome and card shadows; the back "b" tones and
        rims; night cards change cards only, with the night ♦ `#7FD3F3` / ♣ `#8FD6B8` inks, backs
        `#8DA9C4` / `#A4BCD2`, rim `#0B2545` and the navy-night variant `#0B2545` / `#13315C` with rim
        `#8DA9C4`.
    - **Tests:**
      - `tests/unit/ui/tokens.test.ts`:
        - light and dark define every token of every D3 row whose *Defined in* lists light and dark;
        - night defines exactly the tokens of the D3 rows listing night, and nothing else;
        - the removed tokens appear nowhere;
        - every stylesheet under `src/ui/styles/` except `tokens.css` has no hex, `rgb` or `hsl`
          literal.
      - New `tests/unit/ui/contrast.test.ts`: parses `tokens.css` and asserts WCAG ≥ 4.5 for red,
        black, ♦ and ♣ ink against the card face in light, dark and night (AS "Suit inks meet the
        contrast floor"), and for LCD digits and label on the LCD panel and text and muted text on
        the surface in light and dark (AS "Text meets the contrast floor").
    - **Verify:** `rtk npx vitest run tests/unit/ui` passes.

- [ ] 1.2 Apply appearance preferences to the document with a theme controller
    - **Implements:** AP "The theme follows the preference, including System", "Night cards change
      the cards only", "Four-colour deck and card back selection" and "The page exposes one motion
      flag" (attribute side); *KS-SET-02*, *KS-SET-03*, *KS-SET-04*; D9, D10.
    - **References:** `src/app/lifecycle.tsx`, `src/app/selectors.ts` (`selectReducedMotion`),
      `src/features/preferences/preferencesSlice.ts`; `tests/setup.ts`;
      `tests/component/appLifecycle.wiring.test.tsx` (`installMatchMedia`).
    - **Files:**
      - New `src/app/themeController.ts` (D9).
      - `src/app/lifecycle.tsx`: create the controller before the first render; dispose it in
        `dispose()`.
      - `src/ui/styles/global.css`: the 250 ms background-colour transition is off under
        `[data-motion='off']`.
      - `tests/setup.ts`: a query-aware `matchMedia` stub (no query matches by default) with
        add/remove listener support.
    - **Tests:**
      - New `tests/unit/app/themeController.test.ts` covers the AP scenarios on the attribute side:
        - Dark regardless of device;
        - System follows the device live;
        - night, four-colour and back attributes;
        - the motion flag from Animations and from the device ("Device requests reduced motion",
          "Animations switched on again");
        - no writes when nothing changes; missing `matchMedia`;
        - dispose removes listeners.
      - `tests/component/appLifecycle.wiring.test.tsx`: `installMatchMedia` returns a separate fake
        per query; the controller is started and disposed; each listener is asserted on its own
        query.
      - `tests/component/appLifecycle.test.tsx`: a stored Dark theme is on the root before the first
        screen renders (AP "Restored preference is applied before first use").
      - `tests/unit/ui/tokens.test.ts`: no stylesheet under `src/ui/styles/` uses
        `prefers-reduced-motion` (D10).
    - **Verify:** `rtk npx vitest run tests/unit/app tests/unit/ui/tokens tests/component/appLifecycle`
      passes.

## 2. Pure board layout

- [ ] 2.1 Build `measure()`: card size, spacing, stacked-or-wide choice and the purity guard
    - **Implements:** BL "Layout is a pure, deterministic function", "Card size and spacing follow
      the board size", "Stacked or wide table is chosen by the worst-case strip"; *KS-GEN-05*,
      *KS-GEN-07*; D6, D7.
    - **References:** R§10; mockup `measure` L828–859; phased-design §4 rows Layout and Layout
      profiles; `tests/unit/repo/solverPurity.test.ts` and `purityScanner.ts` (`readmeModules`).
    - **Files:**
      - New `src/ui/board/metrics.ts`:
        - `measure(size, { coarse })` returns `{ width, height, pad, gap, cw, ch, ox, wide, compact,
          top, tabY, bottom, coarse }`;
        - `worstStrip(...)`;
        - named constants for 104 / 30 / 1.4 / 3.1 / 2.5 / 0.11 / 0.27 / 0.30 / 0.04 / 14 / 9 / 70
          and the BL padding and gap bounds.
      - `eslint.config.js`: override restricting `src/ui/board/{metrics,layout}.ts` imports to
        `../../domain/*`.
      - New `tests/unit/repo/boardPurity.test.ts` (D6): lists the pure board modules from
        `src/ui/README.md` with `readmeModules`, and bans React, DOM globals, storage, `crypto` and
        `Math.random` in each.
      - New `src/ui/README.md`: the `src/ui` layer map, the board purity rule, and `metrics.ts` in
        the pure-module list.
      - `docs/spec/research.md` R§10: 4 px padding and 3 px gap are the small-board minimums, not
        fixed values.
    - **Tests:** new `tests/unit/ui/board/metrics.test.ts`:
      - "Desktop cap": 1180×690 fine gives 104 px, not compact, stacked ("Desktop stays stacked");
      - "Narrow phone": a 360-wide portrait board is compact and at least 30 px;
      - "Landscape phone uses the wide table": 700×280 coarse picks wide with a thicker strip;
      - "Small-board spacing": padding and gap follow the BL formulas below and above 520 px;
      - the grid is centred: the space left of the first column equals the space right of the last,
        within 0.5 px, in both geometries;
      - "Same inputs, same placements" for `measure`.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/metrics tests/unit/repo/boardPurity` passes.

- [ ] 2.2 Build `positions()` for the stacked geometry
    - **Implements:** BL "Layout is a pure, deterministic function" (`BoardPiles` input), "Columns
      compress face-down cards first", "Top row, mirror and Draw 3 fan", "Stacking order, buried
      cards and anchors" (stacked parts); *KS-MOVE-06*, *KS-SET-05*, *KS-A11Y-04* (strip); D6.
    - **References:** R§10; mockup anchors and `tabOffsets` L860–887, `positions` L889–909, badge
      L943–945.
    - **Files:**
      - New `src/ui/board/layout.ts`: `BoardPiles` and `positions(piles, metrics, { stockRight })`
        returning
        - `cards`: per card id, `{ x, y, z, faceUp, buried }`;
        - `slots`: stock, 4 foundations in `FOUNDATION_DISPLAY_ORDER`, 7 columns;
        - `badge`: `{ x, y }`;
        - `dealOrder`: row by row.
      - `src/ui/README.md`: describe `layout.ts` and add it to the pure-module list, which puts it
        under the 2.1 guard.
    - **Tests:** new `tests/unit/ui/board/layout.test.ts` covers these BL scenarios:
      - Short column is not compressed;
      - Face-down cards squeeze first;
      - Default top row;
      - Mirrored top row;
      - Draw 3 fan;
      - Draw 1 has no fan;
      - Only the top stock card is not buried;
      - Tableau above top row;
      - Deal order;
      - Same inputs, same placements (a `GameState` and its `BoardPiles` subset give equal output).
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/layout tests/unit/repo/boardPurity` passes.

- [ ] 2.3 Add the wide-table geometry to `positions()`
    - **Implements:** BL "Top row, mirror and Draw 3 fan" (wide parts) and "Stacking order, buried
      cards and anchors" (wide badge anchor); *KS-GEN-07*, *KS-SET-05*; D6, D7.
    - **References:** mockup anchors L860–887 (wide branch), `positions` L889–909, badge L943–945;
      phased-design §4 row Layout profiles; screens `14-phone-landscape-wide-table.png` and
      `16-foldable-cover-portrait.png`.
    - **Files:**
      - `src/ui/board/layout.ts`: the wide branch of the BL "Top row, mirror and Draw 3 fan"
        requirement and the D6 badge anchor.
      - `src/ui/README.md`: note the wide geometry.
    - **Tests:** `tests/unit/ui/board/layout.test.ts` gains:
      - "Wide-table mirror";
      - the vertical Draw 3 fan;
      - overlapping foundations on a short board;
      - no card outside the board in a wide worst case.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/layout` passes.

- [ ] 2.4 Sweep the layout over every §8.5 board size
    - **Implements:** BL "Columns compress face-down cards first" (scenario "Worst case fits on every
      device") and "Layout is a pure, deterministic function"; *KS-GEN-03*, *KS-GEN-05*,
      *KS-A11Y-04*; D14 (derivation rule); design "Chrome reservation used by the layout sweep"
      (seed step).
    - **References:** R§13.1; mockup frame L172–198, L307–318 and L377–415 for the budget seed.
    - **Files:**
      - New `tests/fixtures/viewports.ts`: the 13 viewports and 52 configurations derived by the D14
        rule, the three baselines, `CHROME_BUDGET` seeded from the mockup, and `boardSizeFor(config)`
        with the stacked 1024 px width cap.
        This file is also imported by the e2e matrix in 6.1, so it imports nothing from `vitest`.
      - New `tests/fixtures/boardPositions.ts`: `worstColumnState()`, 6 face-down cards plus a K→A
        alternating run in column 7, with all 52 cards valid per `isValidGameState`.
    - **Tests:** new `tests/unit/ui/board/layout.sweep.test.ts`:
      - the fixture yields 13 viewports and 52 configurations;
      - 2560×1440 fine: the board width is `1024 − stacked width budget` and the card width is 104 px;
      - for every configuration, both pointer types and both mirror settings, every card lies inside
        the board;
      - installed coarse cases keep a worst-column strip of at least 14 px;
      - `worstColumnState()` passes `isValidGameState`.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/layout.sweep` passes.

## 3. Board rendering

- [ ] 3.1 Name every card and pile
    - **Implements:** BR "Accessible names for cards and piles"; *KS-A11Y-01*; D11.
    - **References:** `src/domain/cards.ts` (`cardLabels`); spec §9.
    - **Files:**
      - New `src/ui/board/names.ts`: `cardName(id, faceUp)`, `pileName(ref, count)`, with full rank
        and suit word tables on top of `cardLabels`, and the "1 card" / "empty" rules.
      - `src/ui/README.md`.
    - **Tests:** new `tests/unit/ui/board/names.test.ts`:
      - "Face-up card name" (Queen of Spades) and "Face-down card name";
      - "Pile names": Stock, 18 cards; Column 3, empty; Column 4, 1 card; Hearts foundation, 2 cards;
      - all 52 names are unique.
    - **Verify:** `rtk npx vitest run tests/unit/ui/board/names` passes.

- [ ] 3.2 Render a card face and back with `CardView` (static)
    - **Implements:** BR "Card faces follow the mockup", "Card backs", "Shadows and layering"
      (buried), "Accessible names for cards and piles" (card part); *KS-A11Y-05*, *KS-A11Y-01*; D3,
      D4, D11.
    - **References:** mockup card CSS L200–229 and `makeCardEl` L804–815; screens 03–05 and 07.
    - **Files:**
      - New `src/ui/board/CardView.tsx`, `React.memo`:
        - the element carries `data-card-id`, `--x` / `--y` / `z-index` from props, and classes for
          face-up, buried and compact;
        - `role="img"` with `aria-label` from `cardName`;
        - the corner index uses U+FE0E suit glyphs, plus the centre pip or boxed J/Q/K and the
          bottom-right corner hidden when compact; all decorative parts are `aria-hidden`;
        - the back has a checker and a rim.
      - New `src/ui/styles/cards.css`, static only (no transitions; 5.1 adds them):
        - `transform: translate(var(--x), var(--y))`, sizes in `--cw` units;
        - 3D flip structure and backface rules including the `-webkit-` prefix;
        - buried with no shadow, others with `--shadow-card`; inks via `--ink-*`, backs via
          `--back-a` / `--back-b` / `--color-back-rim`, the checker sized in px.
      - `src/ui/README.md`.
    - **Tests:**
      - New `tests/component/cardView.test.tsx`:
        - "Number card face" (7♣ corner, pip and rotated corner);
        - "Court card face" (boxed Q, no pip);
        - "Compact card" (no bottom-right corner);
        - "Face-down card hides its identity" (no rank or suit text; name "Face-down card");
        - buried class; `data-card-id`; inline `--x` / `--y`.
      - New `tests/unit/ui/boardCss.test.ts`: in `cards.css` the buried rule sets `box-shadow: none`
        (BR "Buried stock cards") and the checker's `background-size` is in px (BR "Card backs").
    - **Verify:** `rtk npx vitest run tests/component/cardView tests/unit/ui` passes.

- [ ] 3.3 Render pile slots, placeholders, the stock states and the badge
    - **Implements:** BR "Slots, placeholders and the stock", "Accessible names for cards and piles"
      (pile part); D11, D12.
    - **References:** mockup slots and badge CSS L232–239, slot markup L817–821, badge placement
      L943–945; `src/domain/rules.ts` (`canRecycle`); screens 03 and 07.
    - **Files:**
      - New `src/ui/board/PileSlot.tsx`: stock (recycle SVG with `currentColor`, dimmed by a `spent`
        prop), foundation ("A" plus suit), column ("K"), each labelled with `pileName`.
      - New `src/ui/board/StockBadge.tsx`: count, hidden at 0, `aria-hidden`.
      - New `src/ui/styles/board.css`: slot, placeholder, spent and badge styles via tokens.
      - `src/ui/README.md`.
    - **Tests:** new `tests/component/pileSlot.test.tsx`, passing props directly:
      - "Empty foundation placeholder";
      - "Stock badge" (18);
      - "Spent Vegas stock" (`spent` derived as `!canRecycle(vegasAtLimit({ stock: [] …}))`);
      - "Recyclable stock";
      - the empty-column "K";
      - slot accessible names.
    - **Verify:** `rtk npx vitest run tests/component/pileSlot tests/unit/ui/tokens` passes.

- [ ] 3.4 Add the board size and pointer hooks
    - **Implements:** BM "Re-layout on viewport change within one frame" (scenario "Sub-pixel change
      ignored"); BL "Layout is a pure, deterministic function" (size and pointer inputs); D8, D17.
    - **References:** design D8.
    - **Files:**
      - New `src/ui/board/useBoardSize.ts`: a `ResizeObserver`-fed external store read with
        `useSyncExternalStore`, using `contentRect`, no size before the first entry or without
        `ResizeObserver`, and the < 1 px guard.
      - New `src/ui/useMediaQuery.ts`: `useSyncExternalStore` over `matchMedia`, `false` when it is
        missing.
      - `src/ui/README.md`.
    - **Tests:**
      - New `tests/component/useBoardSize.test.tsx` with a fake `ResizeObserver`: no size before the
        first entry; an injected `contentRect` is reported; "Sub-pixel change ignored"; the observer
        disconnects on unmount; no size when `ResizeObserver` is undefined.
      - New `tests/component/useMediaQuery.test.tsx`: initial value; a live `change` re-renders;
        missing `matchMedia` gives `false`; the listener is removed on unmount.
    - **Verify:** `rtk npx vitest run tests/component/useBoardSize tests/component/useMediaQuery`
      passes.

- [ ] 3.5 Assemble the `Board`: 52 persistent cards and memoised geometry
    - **Implements:** BR "One persistent element per card", "Shadows and layering" (stacking
      context); BL "Layout is a pure, deterministic function" (clock ticks do not re-lay out); BM
      "Re-layout on viewport change within one frame" (no cards before the first size); *KS-PERF-01*;
      D4, D8, D12, D17.
    - **References:** mockup board panel L188–189, `render` L921–949; design D8 and D12.
    - **Files:**
      - New `src/ui/board/selectors.ts`: `selectBoardPiles` and `selectStockSpent` (D12).
      - New `src/ui/board/Board.tsx`:
        - a board panel measured by `useBoardSize`, pointer from `useMediaQuery('(pointer: coarse)')`;
        - nothing but the empty panel before the first size (D8);
        - slots, badge, and 52 `CardView`s in card-id order, placed from memoised
          `positions(selectBoardPiles, measure(...), { stockRight })`;
        - cards rendered only while `current !== null`;
        - `data-wide`, `--cw`, `--ch` and `--cr = max(5px, cw·0.09)` on the board (mockup L855–857).
      - `src/ui/styles/board.css`: the panel (felt `--color-table`, `--color-table-dot` texture,
        radius, `isolation: isolate`) and the board inset.
      - `src/ui/README.md`.
    - **Tests:**
      - New `tests/component/board.test.tsx`, with a fake `ResizeObserver` delivering `contentRect`:
        - "Elements survive a position change": dispatch `undo`, and the same 52 nodes stay in the
          same order;
        - "Each card is identifiable";
        - no slots and no cards before the first size; slots and no cards while `current` is null;
        - a coarse `matchMedia` stub changes the face-up step;
        - an `accrued` tick does not re-run `positions` (spy) or change any card's inline style;
        - `--cw`, `--ch` and `--cr` on the board.
      - `tests/unit/ui/boardCss.test.ts`: the board-panel rule in `board.css` has
        `isolation: isolate` (BR "Table content stays inside"; the in-browser check is 4.4).
    - **Verify:** `rtk npx vitest run tests/component/board tests/unit/ui` passes.

## 4. Game screen

- [ ] 4.1 Show the read-only HUD with pure formatters
    - **Implements:** GS "Read-only HUD" (component side); *KS-SCO-02* (money display), *KS-SCO-05*
      (timer display); D1.
    - **References:** spec §3.2 and §4.7; mockup HUD L173–183 and HUD text L951–953;
      `selectDisplayedScore`.
    - **Files:**
      - New `src/ui/format.ts`: `formatScore` (3-digit pad), `formatBank` (`$47` / `-$52`),
        `formatTime` (`m:ss`, then `h:mm:ss` from one hour).
      - New `src/ui/components/Hud.tsx`: Score or Bank, Moves and Time, each with a text label and
        the D1 colour tokens; no frame CSS.
      - `src/ui/README.md`.
    - **Tests:**
      - New `tests/unit/ui/format.test.ts`: "Vegas bank" −52 gives `-$52`; `$47`; "Standard score
        padding" 5 gives `005`; "Time over an hour" 3 725 s gives `1:02:05`; 59 s gives `0:59`.
      - New `tests/component/hud.test.tsx`: Vegas shows "Bank"; values update after an `accrued`
        dispatch; labels are exposed.
    - **Verify:** `rtk npx vitest run tests/unit/ui/format tests/component/hud` passes.

- [ ] 4.2 Add the Undo/Redo toolbar component
    - **Implements:** GS "Undo and Redo toolbar" (component side); *KS-AST-07*, *KS-AST-08*
      (controls), *KS-A11Y-03*; D1.
    - **References:** `src/features/game/gameThunks.ts` (`undo`, `redo`), `selectCanUndo`,
      `selectCanRedo`, `busy`; mockup toolbar L191–198 and markup L520–525.
    - **Files:**
      - New `src/ui/components/Toolbar.tsx`: a `nav` labelled "Game actions" with Undo and Redo
        buttons, disabled via the selectors and `busy`, with a visible focus ring; no sizing CSS.
      - `src/ui/README.md`.
    - **Tests:** new `tests/component/toolbar.test.tsx`:
      - "Undo by pointer" (user-event click);
      - "Redo by keyboard" (focus and Enter; also Space);
      - "Disabled when unavailable" (fresh deal; `busy`);
      - accessible names.
    - **Verify:** `rtk npx vitest run tests/component/toolbar` passes.

- [ ] 4.3 Build the Game frame with the stacked and side-rails profiles
    - **Implements:** GS "Two chrome profiles" (including "Back touch target"), "The Game screen
      never scrolls and respects safe areas" (scenario "Safe areas"), "Read-only HUD" (scenario
      "Narrow phone hides Moves"), "Undo and Redo toolbar" (scenario "Touch target size"), "The Game
      screen keeps its name and dealing status"; *KS-GEN-06*, *KS-GEN-10*, *KS-A11Y-04* (44 px); D1, D7; design "Chrome reservation
      used by the layout sweep" (measure step).
    - **References:** mockup frame L107–198 and responsive rules L307–321 and L377–415; screens 03,
      06 and 14–17; `tests/e2e/smoke.spec.ts`, `tests/component/appShell.test.tsx`.
    - **Files:**
      - `src/ui/screens/GameScreen.tsx`, rebuilt as the frame: top bar with Back ("Back to Home") and
        the reserved chip slot, `Hud` with the reserved New-deal slot, the reserved hint-line region,
        `Board`, `Toolbar`, a footer with `BuildStamp`, a visually hidden `h1` "Klondike" and the
        always-mounted `role="status"` dealing text.
      - `src/App.tsx`: renders `BuildStamp` only outside the Game screen.
      - New `src/ui/styles/layout.css`: `100dvh` frame; the stacked profile capped at 64rem; regions
        and reserved slots at the D1 sizes; the rails media query; `env(safe-area-inset-*)` on every
        edge in both profiles; the footer hidden at ≤ 480 px wide and the hint line hidden in portrait
        with height ≤ 600 px; Moves hidden ≤ 360 px in the stacked profile; Back and the tools at
        least 44×44 px under `(pointer: coarse)` in both profiles; hover via `--color-hover`; every
        transition off under `[data-motion='off']`; `overflow: hidden` on the frame root.
      - `tests/fixtures/viewports.ts`: `CHROME_BUDGET` replaced by the maxima measured at the design
        "Chrome reservation" viewports.
      - `tests/setup.ts`: an inert, overridable `ResizeObserver` stub (D8).
      - `src/ui/README.md`.
    - **Tests:**
      - New `tests/unit/ui/layoutCss.test.ts`: both profiles pad the frame by
        `env(safe-area-inset-top/right/bottom/left)`.
      - Update `tests/component/appShell.test.tsx`: the Game heading "Klondike" is still found by
        role, the dealing status is still announced, "Back to Home" still works, and the footer holds
        the build stamp.
      - Update `tests/e2e/smoke.spec.ts`: the heading is found by role (visually-hidden tolerant), and
        there is no page scroll on Game.
      - `tests/component/appLifecycle.test.tsx` renders the Game screen through "Continue game" (L96)
        and stays green unchanged.
      - New `tests/e2e/frame.spec.ts` (after "Deal cards"):
        - "Phone on its side uses rails" (874×350: no top bar, hint line or footer);
        - "Tall landscape stays stacked" (835×752);
        - "Short desktop window uses rails" (1280×720, board `data-wide="false"`);
        - "Narrow phone hides Moves" (360×780);
        - "Touch target size" and "Back touch target": Back, Undo and Redo boxes ≥ 44×44 when
          `(pointer: coarse)` matches (touch projects), in the project's own viewport and at 874×350.
    - **Verify:** `rtk npx vitest run tests/component tests/unit/ui` (which re-runs
      `board/layout.sweep` against the measured budgets) and
      `rtk npx playwright test tests/e2e/smoke.spec.ts tests/e2e/frame.spec.ts` pass.

- [ ] 4.4 Seed end-to-end positions from a real record and smoke-test the rendered board
    - **Implements:** RF "Test suites separated by execution layer" (scenario "Known positions come
      from a stored record"); BR "One persistent element per card", "Card faces follow the mockup"
      and "Shadows and layering" (scenario "Table content stays inside", in-browser); D13.
    - **References:** `src/features/persistence/recordCodec.ts` (`encodeRecord`, `decodeRecord`,
      `RecordInput`, `STORAGE_KEY`), `src/features/preferences/preferencesSlice.ts`
      (`defaultPreferences`), `src/features/stats/statsSlice.ts` (`statsReducer`).
    - **Files:**
      - New `tests/e2e/support/seed.ts`: `seedRecord(page, { current, history?, preferences? })`
        per D13. It imports nothing from `vitest`.
      - `tests/fixtures/boardPositions.ts`: add the Draw 3 fan and the D13 one-undo-move positions,
        both started and playing.
      - `docs/spec/phased-design.md` §5: seeding replaces the `?fixture=` hook.
      - `tests/README.md`: the storage rule applies to in-process tests only; the seeding helper.
    - **Tests:**
      - New `tests/unit/features/persistence/boardPositions.decode.test.ts`: every fixture encodes
        with `encodeRecord` and decodes with `decodeRecord` into an identical session.
      - New `tests/e2e/board.spec.ts`: a seeded game shows 52 `[data-card-id]` elements, a named
        face-up card ("King of Spades") and a "Stock, n cards" slot, survives a reload unchanged, and
        its board panel's computed `isolation` is `isolate`.
    - **Verify:** `rtk npx vitest run tests/unit/features/persistence/boardPositions` and
      `rtk npx playwright test tests/e2e/board.spec.ts` pass.

- [ ] 4.5 Check the applied appearance in the browser
    - **Implements:** AP "The theme follows the preference, including System", "Night cards change
      the cards only", "Four-colour deck and card back selection" (rendering side); *KS-SET-02*,
      *KS-SET-03*, *KS-A11Y-05*; D3, D9.
    - **References:** `tests/e2e/support/seed.ts`; `tests/fixtures/boardPositions.ts`; D3 token table.
    - **Files:**
      - New `tests/e2e/appearance.spec.ts`, reading computed styles on seeded games:
        - "Dark theme regardless of the device" (`colorScheme: 'light'`, Dark preference);
        - "System follows the device live" (`page.emulateMedia`): moves and the position are equal,
          time is at least its earlier value and at most 1 s more, and the score changes by at most
          one time-penalty step (2 points);
        - "Night cards with the light theme": page and table colours unchanged, card face changed;
        - "Night cards override the pale backs" (Sky);
        - "Deep navy keeps a night variant", with its rim;
        - "Four colours";
        - "Card back choice" (Coral).
      - `tests/README.md`: the appearance spec.
    - **Tests:** the spec itself.
    - **Verify:** `rtk npx playwright test tests/e2e/appearance.spec.ts` passes.

## 5. Motion

- [ ] 5.1 Glide and flip between positions, with the no-motion path
    - **Implements:** BM "Cards glide and flip between positions"; AP "The page exposes one motion
      flag" (consumer side); *KS-PERF-01*, *KS-SET-04*; D4, D10.
    - **References:** spec §8.3; mockup card CSS L200–229.
    - **Files:**
      - `src/ui/styles/cards.css`: every card transition — `transform` over `--motion-glide` with
        `--motion-ease`; the inner flip over `--motion-flip` delayed by `--fd` (default
        `--motion-flip-delay`); both off under `[data-motion='off']`.
      - `src/ui/README.md`: the motion model.
    - **Tests:**
      - `tests/unit/ui/tokens.test.ts`: every `transition` declaration in `cards.css` and `board.css`
        names only `transform` or `opacity`.
      - New `tests/e2e/motion.spec.ts`, with a seeded one-undo-move game:
        - "Undo glides the card back": the computed `transition-duration` is non-zero and the card
          reaches its target rect;
        - "Flip on reveal";
        - "No motion": with `reducedMotion: 'reduce'` the card is at its new rect in the next frame.
    - **Verify:** `rtk npx vitest run tests/unit/ui/tokens` and
      `rtk npx playwright test tests/e2e/motion.spec.ts` pass.

- [ ] 5.2 Animate the deal from the stock once per fresh deal
    - **Implements:** BM "The deal animates from the stock"; D5, D10, D17.
    - **References:** spec §4.1 and §8.3; R§12.3; mockup deal L1297–1311; `gameSlice.ts` (`epoch`,
      `installed`); design D5.
    - **Files:**
      - New `src/ui/board/animations.ts`: `playDeal(boardEl, dealOrder)` and its cleanup (D5 steps
        4–8).
      - New `src/ui/board/DealtEpochContext.tsx`: `createDealtEpochStore()` and the context with
        default `null` (D5).
      - `src/App.tsx`: creates the store once with `useState(() => createDealtEpochStore())` and
        provides it.
      - `src/ui/board/Board.tsx`: `--stock-x` / `--stock-y` on the board; the D5 layout effect
        (trigger, claim, un-claim on unfinished cleanup).
      - `src/ui/styles/cards.css`: the `[data-dealing='park'] .card` rule, with `transition: none` on
        the card and its inner element.
      - `docs/spec/phased-design.md` §4 row Deal animation: the trigger rule.
      - `src/ui/README.md`.
    - **Tests:**
      - New `tests/component/dealAnimation.test.tsx`, with fake timers, a fake `ResizeObserver` and
        StrictMode:
        - "Fresh deal animates": delays `k·28ms` in deal order, `data-dealing` removed after the
          reflow, delays cleared after 1 384 ms, no `--x` / `--y` written by `animations.ts`;
        - "Restored game does not replay";
        - "Returning to an unstarted deal";
        - "Interrupted deal restarts cleanly": unmount mid-deal and remount replays; the StrictMode
          re-mount still animates;
        - "Deal without motion": the epoch is claimed, and switching motion on does not replay;
        - a newer deal mid-animation restarts cleanly;
        - without a provider, `Board` plays no deal.
      - `tests/e2e/motion.spec.ts` gains a case: "Deal cards" moves the last dealt card (k = 27)
        from the stock rect to its column.
    - **Verify:** `rtk npx vitest run tests/component/dealAnimation` and
      `rtk npx playwright test tests/e2e/motion.spec.ts` pass.

- [ ] 5.3 Re-lay out on viewport change, and on the first size, within one frame
    - **Implements:** BM "Re-layout on viewport change within one frame" (scenarios "Rotation keeps
      the game" and "First layout does not glide"); *KS-GEN-08* (drag cancel deferred); D8.
    - **References:** mockup resize L1577; phased-design §4 row Viewport changes.
    - **Files:**
      - `src/ui/board/Board.tsx`: on the first size and every size change, set
        `data-resizing="true"` for one frame via `requestAnimationFrame` in a layout effect declared
        before the deal effect (D8).
      - `src/ui/board/animations.ts`: the deal release also removes `data-resizing` (D8).
      - `src/ui/styles/cards.css`: the `[data-resizing]` rule.
      - `docs/spec/phased-design.md` §4 row Viewport changes: no `visualViewport` listener, with the
        reason; drag cancel is in Phase 6.
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/component/board.test.tsx` gains:
        - the first size sets `data-resizing`, cleared on the next frame (fake rAF);
        - a size change re-places cards in the same render with `data-resizing` set, then cleared on
          the next frame.
      - `tests/component/dealAnimation.test.tsx` gains: a deal due at the first size still
        animates.
      - New `tests/e2e/resize.spec.ts`, "Rotation keeps the game": a seeded game switches 402×874
        to 874×402; in the next frame every card is at its final rect and the page does not scroll;
        moves and the position are equal, time is at least its earlier value and at most 1 s more,
        and the score changes by at most one time-penalty step (2 points).
    - **Verify:** `rtk npx vitest run tests/component/board tests/component/dealAnimation` and
      `rtk npx playwright test tests/e2e/resize.spec.ts` pass.

## 6. Cross-device verification and close-out

- [ ] 6.1 Run the 52-case device-fit matrix in a dedicated Chromium project
    - **Implements:** GS "The Game screen never scrolls and respects safe areas" (scenarios
      "Device-fit matrix" and "Finger strip on installed phones"); RF "Test suites separated by
      execution layer" (scenarios "Browser layer covers desktop and touch" and "Device-fit matrix
      runs once"); *KS-GEN-03*, *KS-GEN-05*, *KS-A11Y-04*; D14; design "Chrome reservation used by
      the layout sweep" (hold step).
    - **References:** R§13.1; phased-design §5 device-fit bullet; `playwright.config.ts`.
    - **Files:**
      - New `tests/e2e/deviceFit.spec.ts`, using `tests/fixtures/viewports.ts`,
        `tests/fixtures/boardPositions.ts` and `tests/e2e/support/seed.ts`, with the per-case steps
        and assertions of D14.
      - `playwright.config.ts`: a new `device-fit` project (Desktop Chrome, `testMatch` for
        `deviceFit.spec.ts`); `testIgnore` of it in the six existing projects.
      - `docs/spec/phased-design.md` §5: the dedicated project, and the safe-area limitation.
      - `tests/README.md`: the matrix and how to run it.
    - **Tests:**
      - The matrix itself.
      - New `tests/unit/repo/playwrightProjects.test.ts`: `device-fit` matches only that spec, every
        other project ignores it, and every spec in its Chromium-only list (empty until 6.2 and 6.3)
        contains `test.skip(testInfo.project.name !== 'chromium')`.
    - **Verify:** `rtk npx playwright test --project=device-fit` passes, with 55 cases, and
      `rtk npx vitest run tests/unit/repo/playwrightProjects` passes.

- [ ] 6.2 Capture visual-parity screenshots and publish them from CI on every run
    - **Implements:** RF "Continuous integration on every push and pull request" (scenario
      "Screenshots are always published") and "Test suites separated by execution layer"
      (Chromium-only specs); D15.
    - **References:** the nine mockup screens listed in D15; `.github/workflows/ci.yml`;
      `tests/unit/repo/configContract.test.ts`.
    - **Files:**
      - New `tests/e2e/visualParity.spec.ts` (Chromium-only skip guard): a seeded state and
        preferences for each screen at its D15 viewport and touch setting, written to
        `test-results/visual-parity/` with the D15 file names.
      - `tests/unit/repo/playwrightProjects.test.ts`: add the spec to the Chromium-only list.
      - `.github/workflows/ci.yml`: an `if: always()` upload of `test-results/visual-parity/`, using
        the latest `actions/upload-artifact` version checked by web search, per AGENTS.md.
      - `tests/README.md`: where the screenshots land and how to compare them.
    - **Tests:**
      - `tests/unit/repo/configContract.test.ts`: asserts the always-upload step and its path.
      - The spec itself produces the 9 files.
    - **Verify:** `rtk npx playwright test tests/e2e/visualParity.spec.ts --project=chromium` writes
      the 9 screenshots; `rtk npx vitest run tests/unit/repo/configContract tests/unit/repo/playwrightProjects`
      passes; compare the
      screenshots by eye with the mockup screens and note any difference in the task's review.

- [ ] 6.3 Report cold-worker Winnable Draw 1 deal latency in the browser
    - **Implements:** RF "In-browser deal latency is reported" (ADDED) and "Test suites separated by
      execution layer" (Chromium-only specs); *KS-DEAL-10*, *KS-PERF-02* (reported, not gated); D16.
    - **References:** `src/features/deal/dealService.ts`, `src/features/deal/solverClient.ts`;
      phased-design Phase 5 "Done when".
    - **Files:**
      - New `tests/e2e/dealLatency.spec.ts` (Chromium-only skip guard): the D16 loop, N = 10, a fresh
        page per iteration, annotations labelled cold-worker, no assertion on the values.
      - `tests/unit/repo/playwrightProjects.test.ts`: add the spec to the Chromium-only list.
      - `tests/README.md`: the report and where to read it.
    - **Tests:** the spec itself ("Latency report").
    - **Verify:** `rtk npx playwright test tests/e2e/dealLatency.spec.ts --project=chromium` passes
      and prints its annotations; `rtk npx vitest run tests/unit/repo/playwrightProjects` passes.

- [ ] 6.4 Close out: repository status and specification-pack alignment
    - **Implements:** constitution principle 9 for the change as a whole; D6 (guard documented), D18.
    - **References:** `AGENTS.md` "Current project", "Repository layout" and "Architecture
      principles"; `README.md` "Current status" and "Repository layout"; `docs/spec/phased-design.md`
      §3.1 and §7 Phase 5.
    - **Files:**
      - `AGENTS.md`: repository state "Phases 1–5 complete"; `src/ui` described as board, layout,
        motion and the Game frame; the `ui` layout heading; principle 1 names the board purity guard
        (`tests/unit/repo/boardPurity.test.ts` and the ESLint override on
        `src/ui/board/{metrics,layout}.ts`).
      - `README.md`: current status and layout.
      - `docs/spec/phased-design.md`:
        - §3.1 board file list as built;
        - Phase 5 scope: ghosts, landing rects and the cascade move to Phase 6;
        - Phase 6 note: block board input while dealing (D5).
    - **Tests:** none new. This task changes documentation only; the integration check is the full
      gate.
    - **Verify:** `rtk npm run validate` and `rtk npm run e2e` pass on the branch; every file path
      and symbol named in the updated docs exists (`rtk grep` each one).
