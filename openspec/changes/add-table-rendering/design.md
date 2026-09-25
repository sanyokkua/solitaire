# Design

## Context

A design document is warranted: the change crosses `src/app` ↔ `src/ui`, introduces a new pure
module family inside `src/ui` with its own purity guard, changes the token contract of the
application-shell spec, and changes the browser-test contract of the repository-foundation spec. See
`proposal.md` — Why.

Current state that shapes the approach (verified in code):

- **Game state.** `src/features/game/gameSlice.ts` holds `current`, `history`, `future`, `busy` and
  `epoch`. `epoch` is bumped by `installed` (start, restart) and `cleared`. `commitCommand` drops the
  engine's events, so nothing records which cards moved.
- **Persistence.** A game restored by `persistenceLoader.ts` is preloaded with `epoch` 0 and is
  always `started`: `encodeSession` stores only started, playing games.
- **Home start race.** Home dispatches `startGame({ mode })` (async) and then `setRoute('game')`
  immediately. The Game screen can therefore mount with the previous `current`, or with `null`,
  before `installed` lands.
- **Ticker.** The clock ticker replaces `current` (via `accrued`) every 250 ms while the clock runs;
  the pile arrays keep their references.
- **Motion signal.** `selectReducedMotion` (`src/app/selectors.ts`) is the single reduced-motion
  signal. `startApp` (`src/app/lifecycle.tsx`) feeds `systemMotionChanged` from
  `matchMedia('(prefers-reduced-motion: reduce)')`, its only `matchMedia` query, and renders `<App/>`
  inside `<StrictMode>`.
- **Appearance is not applied.** Nothing puts theme, night cards, four-colour or card back onto the
  document. `tokens.css` has `:root`, `:root[data-theme='dark']` and `:root[data-night-cards='true']`
  blocks, each defining the same 30 colour roles; the night block copies the dark page values and
  sets `color-scheme: dark`. `tests/unit/ui/tokens.test.ts` asserts all 30 roles in all three blocks
  and checks `global.css` alone for colour literals.
- **Test stubs.** `tests/setup.ts` stubs `matchMedia` with `matches: query.includes('light')` and
  no-op listeners, and has no `ResizeObserver` or `requestAnimationFrame` stub.
  `tests/component/appLifecycle.wiring.test.tsx` checks listeners by identity; its `installMatchMedia`
  returns one fake for every query. `tests/component/appLifecycle.test.tsx` clicks "Continue game"
  (L96), so it renders the Game screen.
- **Screens.** `src/App.tsx` renders `HomeScreen` or `GameScreen` and then `<BuildStamp/>`.
  `GameScreen` has an `h1` "Klondike", an always-mounted `role="status"` reading "Dealing…", and a
  "Back to Home" button that `tests/e2e/smoke.spec.ts` and `tests/component/appShell.test.tsx` use.
- **Reusable domain helpers.** `cardLabels` (short labels: rank `A`…`K`, suit symbol),
  `FOUNDATION_DISPLAY_ORDER` (♥ ♣ ♦ ♠), `suitOf`, `rankOf` and `colorOf` in `src/domain/cards.ts`;
  `canRecycle` in `src/domain/rules.ts`.
- **Reusable game API.** `selectCanUndo`, `selectCanRedo` and `selectDisplayedScore` in
  `gameSlice.ts` (Vegas returns the bank, which starts at −52); `undo` and `redo` in `gameThunks.ts`.
- **Solver client.** `src/features/deal/solverClient.ts` starts one worker lazily and reuses it.
- **Seeding from Node.** `encodeRecord`, `decodeRecord` and `STORAGE_KEY` in
  `src/features/persistence/recordCodec.ts` have Node-safe runtime imports, so Playwright specs can
  use them directly. `isValidGameState` accepts a 6-down + 13-up column.
- **Playwright.** It runs against the production build (`npm run build && npm run preview`) in six
  projects: `chromium`, `firefox`, `webkit` (1280×720), `iphone-17-pro`, `iphone-14-pro-max` and
  `galaxy-s25`. CI uploads the report only on failure. E2E code imports only Node-safe modules and
  nothing from `vitest`.
- **Lint.** ESLint uses `strictTypeChecked` and `react-hooks` v7, whose `refs`, `set-state-in-effect`
  and `purity` rules apply to `src/ui`. No `no-restricted-globals` rule exists; global purity is
  enforced by tests through `tests/unit/repo/purityScanner.ts`.
- **Mockup rules.** The mockup (`docs/spec/mockup/klondike-mockup.html`) fixes the geometry and
  motion: `measure` (with `worstStrip`) L828–859, anchors and `tabOffsets` L860–887, `positions`
  L889–909, `render` L921–949, card CSS L200–229, slots and badge L232–239 and L943–945, deal
  L1297–1311, resize L1577.

## Goals / Non-Goals

**Goals:**
- One pure, unit-tested geometry module that is the only source of card positions. Phase 6
  hit-testing reuses it.
- A render path that never re-creates card elements, and that does not re-render 52 cards per clock
  tick.
- Every animation goes through CSS transitions on `transform`, with exactly one no-motion switch.
- End-to-end evidence of fit on all 52 device configurations, from the production bundle, with no
  test code shipped.

**Non-Goals:**
- Any pointer, drag or keyboard controller, and the input-ready focus model (Phase 6). The DOM is
  shaped for them (D4, D18).
- Pixel-diff visual regression. Screenshots are compared by eye.
- Real safe-area emulation. It cannot be emulated in Playwright; see Risks.

## Decisions

### D1 — Chrome scope: frame, read-only HUD, Undo/Redo (user decision)

The Game screen becomes a frame (`GameScreen.tsx` plus `layout.css`) with the regions of the
mockup (frame CSS L107–198, HUD L173–183 and L307–318, toolbar L191–198 with markup L520–525,
responsive rules L377–415):

- **Stacked profile:** top bar (Back, chip slot), HUD, hint-line region, board panel, toolbar and
  footer, in a column, at most 64rem (1024 px) wide (L172). The footer is hidden at ≤ 480 px wide
  (L384); the hint line is hidden in portrait with height ≤ 600 px (L415).
- **Side-rails profile:** at `(orientation: landscape) and (max-height: 720px)`, a left rail (Back,
  Score, Moves, Time), the board panel, and a right rail (toolbar), full width with no cap (L399–414).

Content in the frame:

- The Back control keeps the accessible name "Back to Home" in both profiles, and is at least
  44×44 px (2.75rem) under `(pointer: coarse)` in both, overriding the mockup's 2.3rem rail button
  (L405).
- The HUD (`components/Hud.tsx`) is display-only. Digits use `--color-lcd-score`, `-moves` and
  `-time`, and labels `--color-lcd-label`, all on `--color-lcd-panel`.
- The toolbar (`components/Toolbar.tsx`) has Undo and Redo, which dispatch the existing thunks.
- Regions reserved for Phase 7 stay empty at mockup size:
  - the HUD New-deal slot at `.game-face` size: 2.9rem, 2.6rem at ≤ 460 px, 2.5rem in rails (L181,
    L313, L410);
  - the hint line: one line of `.7rem` text (`.64rem` at ≤ 480 px) at line-height 1.4 (L184,
    L385);
  - the chip slot in the top bar (chips at L490–491): the height of the Back control (2.5rem,
    2.75rem coarse; L127, L379) and the remaining bar width (`flex: 1; min-width: 0; overflow:
    hidden`), so chips (L111–112) can never grow the bar;
  - the deal-code footer, which holds the build stamp, moved from `App.tsx`.
- Hover and press feedback on Back and the tools uses `--color-hover`; every `layout.css`
  transition is off under `[data-motion='off']`.

*Alternatives:*
- *Frame only* was rejected: an empty toolbar has no real height, so the fit tests would test
  nothing.
- *Full Phase 7 chrome* was rejected as scope creep.

*Consequence:* Phase 7 must fill the reserved regions without growing them, and must re-run the
device-fit matrix.

### D2 — Card inks darkened to 4.5:1 (user decision)

These inks fail 4.5:1 on the card face with the mockup values and are replaced, same hue, darkened
the least amount that passes:

| Palette | Red | Four-colour ♦ | Four-colour ♣ |
|---|---|---|---|
| Light (face `#FBFDFB`) | `#D44B56` → `#D1404C` | `#2F93BF` → `#287DA2` | `#3A8F7C` → `#348170` |
| Dark (face `#D2DDE5`) | `#CC4450` → `#B1303C` | `#2A86B0` → `#206788` | `#2F7D6B` → `#286B5C` |

Black inks and every night-card ink already pass and are unchanged. `tests/unit/ui/contrast.test.ts`
parses `tokens.css` and asserts WCAG ratios of at least 4.5 for every ink × face pair per palette,
and for the HUD text pairs (D3), so a later token edit cannot regress. Spec §8.1 is updated to the
new values.

*Alternatives:*
- Keep the mockup inks and apply the 3:1 graphics rule.
- Defer to Phase 9.

The user rejected both.

### D3 — Token contract; night cards change the cards only

This follows the mockup (tokens L12–91, night cards L322–328) and spec §6. `tokens.css` is the only
stylesheet with colour literals; every other stylesheet references tokens.

| Role | Tokens | Defined in | Switched by |
|---|---|---|---|
| Page, surface, text, primary, accent, hint | the existing page roles | light, dark | `data-theme` |
| LCD panel, digits, labels | `--color-lcd-panel`, `-lcd-score`, `-lcd-moves`, `-lcd-time`, new `--color-lcd-label` (`#8DA9C4` / `#6F8FB0`) | light, dark | `data-theme` |
| Table felt and texture | `--color-table` (the felt), new `--color-table-dot` | light, dark | `data-theme` |
| Slots | new `--color-slot-line`, `--color-slot-ink` | light, dark | `data-theme` |
| Outlines and hover | new `--color-outline-soft` (`#C8D7E3` / `#24466F`), `--color-lcd-outline` (`#06172D` / `#030D1A`), `--color-hover` (`rgb(69 123 157 / 10%)` / `rgb(91 192 235 / 12%)`) | light, dark | `data-theme` |
| Chrome shadows | new `--shadow-sm` (mockup L26 / L76) | light, dark | `data-theme` |
| LCD inset | new `--shadow-lcd-inset` (`inset 0 2px 4px rgb(0 0 0 / 50%)`, L175) | `:root` | — |
| Card face, edge | `--color-card-face`, `--color-card-edge` | light, dark, night | `data-theme`, `data-night-cards` |
| Card shadow | new `--shadow-card` (mockup L33 / L81 / L323) | light, dark, night | `data-theme`, `data-night-cards` |
| Suit inks | `--color-suit-red`, `-suit-black`, `-suit-four-diamond`, `-suit-four-club` | light, dark, night | `data-theme`, `data-night-cards` |
| Per-back tones | new `--color-back-{harbour,navy,sky,coral}-{a,b}` | light, dark, night | `data-night-cards` |
| Back rim | new `--color-back-rim` | light, dark, night | `data-night-cards`; navy-night rule |
| Applied inks | `--ink-hearts`, `--ink-spades`, `--ink-diamonds`, `--ink-clubs` | `:root` | `:root[data-four-color='true']` |
| Applied back | `--back-a`, `--back-b` | `:root` | `:root[data-back=…]` |
| Radius | `--radius-sm` 9 px, `--radius-md` 14 px, `--radius-lg` 20 px, `--card-radius-factor` | `:root` | — |
| Motion | `--motion-glide` 240 ms, `--motion-flip` 300 ms, `--motion-flip-delay` 60 ms, `--motion-deal-step` 28 ms, `--motion-ease` `cubic-bezier(.2,.8,.2,1)` | `:root` | — |

- **Shadow tokens** hold full `box-shadow` values, not colours, so they use the `--shadow-` prefix.
- **Night block** (`:root[data-night-cards='true']`) defines only the card roles: face, edge,
  `--shadow-card`, the four suit inks (night ♦ `#7FD3F3`, ♣ `#8FD6B8`), the per-back tones — Harbour, Sky
  and Coral all `#8DA9C4` / `#A4BCD2`, navy `#0B2545` / `#13315C` — and rim `#0B2545`. It sets no
  `color-scheme`.
- **Navy-night rule:** `:root[data-night-cards='true'][data-back='navy']` sets `--color-back-rim:
  #8DA9C4`.
- **Applied tokens** are derived, never stored. `--ink-hearts` and `--ink-diamonds` default to
  `--color-suit-red`, `--ink-spades` and `--ink-clubs` to `--color-suit-black`;
  `:root[data-four-color='true']` maps ♦ and ♣ to the four-colour tokens. `--back-a` / `--back-b`
  default to the Harbour pair, and `:root[data-back='navy'|'sky'|'coral']` selects the other pairs.
  All custom properties resolve on the root element, so the night overrides reach the applied
  tokens.
- **Removed:** `--color-night-card-*` (5 tokens), `--color-card-back-1..4`,
  `--color-card-back-checker`, and the night block's `color-scheme`.
- **Tests:** light and dark define every token of every row whose *Defined in* lists light and
  dark; night defines exactly the tokens of the rows listing night, and nothing else;
  `contrast.test.ts` covers every ink × face pair per palette, LCD digits and labels on
  `--color-lcd-panel`, and `--color-text` / `--color-text-muted` on `--color-surface`, in light and
  dark. The application-shell delta's role list matches this table.

*Alternative:* keep the current behaviour, where night cards also darken the page. Rejected: it
contradicts the mockup, which is the visual authority.

### D4 — Animate from state diffs, not engine events

Each card is one persistent `CardView` element in a fixed DOM order (card id 0…51), with
`data-card-id`.

- **Position.** The placement from `positions()` is written by React as the `--x` / `--y` custom
  properties, and the CSS applies `transform: translate(var(--x), var(--y))`.
- **Motion.** A CSS transition on `transform` does the glide. The face-up state toggles a class that
  rotates the inner element for the flip.
- **Why diffs work.** Because elements persist, any state change (undo, redo, restart, new deal)
  animates without knowing which command caused it.
- **Order and z-index.** The DOM order never changes, because moving a node cancels its transition.
  Stacking uses `z-index` from the layout.
- **Rendering cost.** `CardView` is `React.memo` over primitive props.

*Alternative:* store the last events in the slice and animate from them. Rejected: it changes the
features layer for no visual gain, and undo/redo have no events.

### D5 — Deal animation trigger and mechanics

**Last dealt epoch.** `src/ui/board/DealtEpochContext.tsx` exports `createDealtEpochStore()`, a
stable store `{ get(): number | null; set(e: number | null): void }` starting at `null`, and a
context whose default is `null`. `App` creates the store once with
`useState(() => createDealtEpochStore())` and provides it; `App` stays mounted across routes, so the
value survives Back followed by Deal cards. Without a provider, `Board` plays no deal animation, so
board tests need no provider and nothing leaks between tests. Restored
games are always started, so they never replay the deal. The Home race is harmless: the board first
renders the old game, or nothing; when `installed` lands, the epoch changes and the fresh game
deals.

**Mechanics.** One `useLayoutEffect` in `Board` runs the sequence; `src/ui/board/animations.ts`
(`playDeal(boardEl, dealOrder)`) does the DOM work:

1. **Trigger:** the board has its first measurement (D8), `current.started === false`, and
   `epoch !== lastDealtEpoch`.
2. **Claim:** set `lastDealtEpoch = epoch` at once, under reduced motion too.
3. **Reduced motion:** stop here.
4. **Park:** set `data-dealing="park"` on the board element. The board carries `--stock-x` /
   `--stock-y` from the layout's stock anchor as React-rendered props. The rule
   `[data-dealing='park'] .card` sets `transform: translate(var(--stock-x), var(--stock-y))` and
   `transition: none` on the card and its inner element (as mockup L1302 does), and shows the inner
   element face-down.
5. **Reflow.**
6. **Stagger:** write `--d = k·28ms` and `--fd = k·28 + 200ms` on the k-th card in deal order. These
   are the only properties `animations.ts` writes; React never writes them and `animations.ts` never
   writes `--x` / `--y`.
7. **Release:** remove `data-dealing`; each card transitions to its React-owned `--x` / `--y`.
8. **Finish:** after `28·28 + 600 = 1384 ms` a timer clears `--d` / `--fd` and marks the deal
   finished.

**Cleanup** clears the timer, the delays and the attribute. If the deal had not finished, it
restores `lastDealtEpoch` to its previous value, so the StrictMode re-mount replays the deal,
leaving mid-deal and returning replays it, and a newer deal replaces it.

While a winnable deal is being searched, the previous table stays visible, as in the mockup.
**Phase 6 must ignore board input while `app.dealing !== null`.**

*Alternative:* a slice flag such as "deal pending animation". Rejected: it puts view state into
`src/features`.

### D6 — Pure layout split into metrics and positions

- **`src/ui/board/metrics.ts`:** `measure({ width, height }, { coarse }) → Metrics`, and
  `worstStrip`. It contains the card width, padding and gap formulas of the board-layout spec, the
  stacked-or-wide choice, and the compact flag.
- **`src/ui/board/layout.ts`:** `positions(piles: BoardPiles, metrics, { stockRight }) → { cards,
  slots, badge, dealOrder }`, where `BoardPiles = Pick<GameState, 'tableau' | 'stock' | 'waste' |
  'foundations' | 'draw'>`. `GameState` satisfies it. It contains the stacked and wide geometry,
  column compression, the fan, the mirror, buried cards and z-order (bands: stock 10+i, waste 100+i,
  foundation 200 + i + slot·20, tableau 300+i; badge 400). Foundation slots map through
  `FOUNDATION_DISPLAY_ORDER`. The badge anchor is `(stock.x + cw − 20, stock.y + (wide ? 2 : −6))`.

Both import only their sibling (`./name`, for the `Metrics` type) and `../../domain/<name>`. Two guards enforce this:
- an ESLint override on `src/ui/board/{metrics,layout}.ts` restricting imports;
- `tests/unit/repo/boardPurity.test.ts`, which lists the pure modules from `src/ui/README.md` with
  `readmeModules` (as the solver guard does) and uses `purityScanner.ts` to ban React, DOM globals,
  storage, `crypto` and `Math.random`.

Constants are ported from the mockup; spec deltas state them as behaviour. Landing rects for drop
targets are not built: nothing uses them before Phase 6 (see D18).

### D7 — Chrome profile and table geometry are independent

- **Side rails** are a CSS media query on the frame.
- **Wide table** is chosen by `measure()` from the board's own size.

They combine freely: screen 14 uses rails and the wide table; screen 15 uses rails and the stacked
table; screen 16 uses stacked chrome and the wide table. Desktop 1280×720 gets rails, per KS-GEN-06.

### D8 — Board size and pointer via external stores, rendered before paint

- **Board size.** `useBoardSize` (`src/ui/board/useBoardSize.ts`): a `ResizeObserver` on the board
  panel feeds a tiny store keyed by the element and read with `useSyncExternalStore`, so the new size
  renders synchronously in the same frame. The store takes the observer entry's `contentRect`, which
  jsdom tests can inject, and ignores changes under 1 px. It reports no size until the first entry.
- **First measurement.** `Board` renders the empty panel, with no slots and no cards, until the
  first size arrives. The first size is treated like a resize (`data-resizing` for one frame), so
  nothing glides from (0, 0). The resize-flag layout effect is declared before the deal effect
  (D5), and `playDeal`'s release also removes `data-resizing`, because the park already keeps cards
  off the corner; otherwise a deal due at the first size would release with transitions off.
- **No `ResizeObserver`.** When `ResizeObserver` is undefined (jsdom), `useBoardSize` reports no
  size and `Board` shows the empty panel. `tests/setup.ts` gains an inert, overridable stub when the
  Game frame mounts `Board`.
- **Pointer.** `useMediaQuery('(pointer: coarse)')` (`src/ui/useMediaQuery.ts`) also uses
  `useSyncExternalStore`, so a hybrid device follows its primary pointer live; without `matchMedia`
  it reports `false`.
- **No `setState` in effects.** Neither hook calls `setState` inside an effect, which keeps the
  react-hooks v7 rules satisfied.
- **No `visualViewport` listener.** Browser bars that change the viewport also change the board
  size, and anything else leaves the board unchanged. This is a documented deviation from
  phased-design §4 "Viewport changes".

### D9 — Theme controller in `src/app`

`createThemeController(store, root, media)` in `src/app/themeController.ts` subscribes to the store
and to `(prefers-color-scheme: dark)`. It writes, on `document.documentElement`:

- `data-theme`: `light` or `dark`, with System resolved in JavaScript so the dark CSS is not
  duplicated under a media query;
- `data-night-cards`;
- `data-four-color`;
- `data-back`;
- `data-motion`: `on` or `off`, from `selectReducedMotion`.

It writes only when a value changes, and tolerates a missing `matchMedia`. `startApp` creates it
before the first render and disposes it in `dispose()`. `tests/setup.ts` gets a query-aware
`matchMedia` stub (no query matches by default), and `installMatchMedia` in
`appLifecycle.wiring.test.tsx` returns a separate fake per query, so each listener is asserted on its
own query.

*Alternative:* apply attributes from a React effect in `App`. Rejected: the first paint would use
the wrong palette, and the controller is testable without React.

### D10 — One no-motion switch

Reduced motion is expressed only as `:root[data-motion='off']`, which sets card and inner
transitions, the deal delays and the page's 250 ms background-colour transition to none. No
stylesheet uses `@media (prefers-reduced-motion)`: that would be a second signal and would break the
preferences requirement "One reduced-motion signal". This deliberately deviates from the mockup,
which uses the media query (L319–321). Nothing waits for `transitionend`, because zero-length
transitions do not fire it reliably. Timed clean-ups read `selectReducedMotion`.

### D11 — Accessible names (English, pending i18n)

`src/ui/board/names.ts` builds card names ("Queen of Spades", "Face-down card") and pile names
("Stock, 18 cards", "Hearts foundation, empty", "Column 3, 5 cards") on top of
`cardLabels`, adding full rank and suit words.

- Cards are `role="img"` with `aria-label`. Slots are labelled groups. The waste has no slot; its
  name arrives with Phase 6 focus.
- Corner indices, pips, the recycle mark and the badge are `aria-hidden`.
- Phase 7 moves the words into the EN/UK catalogs.
- Focus and reading order across the fixed DOM order are Phase 6's keyboard controller.

### D12 — Rendering cost

- `src/ui/board/selectors.ts` exposes `selectBoardPiles`, a `createSelector` over the five
  `BoardPiles` fields of `current` that returns the same object while the pile references are
  unchanged, so an `accrued` tick does not re-run `positions()`. It also exposes `selectStockSpent`
  (stock empty and `!canRecycle(current)`), which `Board` passes to `PileSlot` as a prop.
- `positions()` output is memoised on the piles, metrics and `stockRight`.
- `CardView` is memoised, so a move re-renders only the cards whose placement changed.
- Only `transform` and `opacity` are transitioned. The board panel carries `isolation: isolate`.

### D13 — End-to-end fixtures by seeding a real record

`tests/e2e/support/seed.ts` builds a v1 record with `encodeRecord(input: RecordInput)`, where
`RecordInput = { preferences, stats, game: { current, history, future, dailyKey, counted } }`:

- `preferences` from `defaultPreferences('en')` merged with overrides;
- `stats` from `statsReducer(undefined, { type: '@@INIT' })` (the initial-state factory is not
  exported);
- `game` from a fixture `GameState` built with `tests/fixtures/states.ts` helpers, plus optional
  history.

It installs the record with `page.addInitScript` before the first navigation. The script writes it
**only when the key is absent**, so reloads exercise real resume. The spec then clicks **Continue
game**. Fixtures live in `tests/fixtures/boardPositions.ts`:

- the worst-case column (6 down + K→A alternating in column 7, with the remaining cards valid);
- a Draw 3 waste with at least 3 cards;
- a game with one undoable move: a tableau-to-foundation move that uncovers a face-down card, stored
  with one history step. `tests/fixtures/games.ts` `playedGame()` does not qualify: its move
  (`3:3>2` of `WINNING_LINE`) goes tableau to tableau.

`decodeSession` rejects any game that is not started and playing, so every fixture is started and
playing; a unit test decodes each with `decodeRecord`. This replaces phased-design §5's
`?fixture=worst-column`, which cannot exist in a production build, and ships no test code.
`tests/README.md` is updated: "no test touches browser storage" becomes "no in-process test".

### D14 — Device-fit matrix

`tests/fixtures/viewports.ts` derives the configurations from R§13.1:

- **13 viewports:** the 12 table rows, with the Galaxy S25+ / S25 Ultra row counted twice
  (384×832 and 412×891).
- **Portrait size** is `(min(w, h), max(w, h))`, which normalises the rows listed in landscape
  (iPhone Duo inner, Galaxy Z Fold 8 main); landscape swaps the two.
- **Browser height** subtracts the bar: iOS (iPhone, iPhone Duo) 188 px portrait / 52 px landscape;
  Android (Galaxy, Z Fold) 130 px / 80 px. **Installed height** is the full height.
- 13 × 2 orientations × 2 modes = 52 configurations, all coarse/touch, plus the baselines 320×480
  coarse and 1280×720 and 2560×1440 fine.

`tests/e2e/deviceFit.spec.ts` covers the 55 cases. It runs in a new `device-fit` Playwright project
(Desktop Chrome, `testMatch` for that file only); every other project gets `testIgnore` for it. Each
case:

- sets the viewport, `hasTouch` and `isMobile` (touch for phone and foldable screens);
- seeds the worst-case column with `seedRecord` before the first `page.goto`, opens Home and clicks
  "Continue game";
- on touch cases, asserts that `matchMedia('(pointer: coarse)').matches`;
- asserts:
  - `scrollHeight ≤ innerHeight` and `scrollWidth ≤ innerWidth`;
  - every `[data-card-id]` box lies inside the board panel;
  - Back and every HUD value lie inside the viewport;
  - the board panel's content box is at least `boardSizeFor(config)`, with 1 px tolerance;
  - the toolbar lies inside the viewport;
  - on installed touch cases, the worst-column face-up strip is at least 14 px, measured from
    consecutive card boxes;
- saves a screenshot attachment.

`tests/unit/repo/playwrightProjects.test.ts` guards the project split, and that every Chromium-only
spec it lists carries the skip guard (D15, D16). The 44×44 px touch-target check lives in
`tests/e2e/frame.spec.ts` only. Safe-area insets cannot be emulated; KS-GEN-10 is
covered by a static CSS test of `env(safe-area-inset-*)` on every edge and by the Phase 9
real-device checklist.

### D15 — Visual parity screenshots

`tests/e2e/visualParity.spec.ts` runs in desktop Chromium only, skipping elsewhere with
`test.skip(testInfo.project.name !== 'chromium')`. It seeds records for the board states of the
mockup screens and writes nine screenshots to `test-results/visual-parity/`, each named exactly like
the mockup file it matches in `docs/spec/mockup/screens/`, at that file's CSS size (half its pixel
size):

- `03-game-light-desktop.png`, `04-game-dark-desktop.png`, `05-game-dark-night-cards.png` and
  `07-game-draw3-waste-fan.png` at 1180×820;
- `06-game-light-phone.png` at 390×844;
- `14-phone-landscape-wide-table.png` at 852×341 with touch;
- `15-foldable-inner-side-rails.png` at 890×574;
- `16-foldable-cover-portrait.png` at 416×527;
- `17-galaxy-s25-portrait-browser.png` at 360×650.

It is not gated: the screenshots are compared by eye against the board region.
`.github/workflows/ci.yml` gains an `if: always()` upload step for that folder, and
`tests/unit/repo/configContract.test.ts` asserts it.

### D16 — In-browser deal latency report

`tests/e2e/dealLatency.spec.ts` runs in desktop Chromium only, with the same skip guard as D15, and
default preferences (Draw 1, Winnable only). The solver client reuses one lazily started worker per page, so each of its
N = 10 iterations opens a fresh page and every deal pays a cold worker start (the conservative case).
Per iteration it:

1. installs a `PerformanceObserver` for `longtask` through an init script;
2. opens Home and clicks "Deal cards";
3. awaits `page.waitForEvent('worker')` together with 52 `[data-card-id]` elements.

It records the median, p95 and maximum of the click-to-52-cards time and the longest long task with
`test.info().annotations`, labelled cold-worker, and never asserts on the values.

KS-DEAL-03 becomes visible only with the Phase 7 deal chip; until then it is proven by the Phase 3
unit tests.

### D17 — Hooks-rule-safe structure

- DOM writes (deal park, reflow, delays, the resize flag) happen only in layout effects and event
  handlers.
- No ref is read during render.
- External sizes and media come through `useSyncExternalStore`.
- The layout and format modules are pure functions.

This keeps `rtk npm run lint` clean without rule suppressions.

### D18 — Deferrals and phased-design deviations

These move from phased-design's Phase 5 scope to Phase 6, next to the code that uses them:

- legal-target ghosts, landing rects, selection ring, shake, hint visuals;
- the win cascade;
- drag cancel on resize.

These stay in Phase 7: the dealing overlay, chips, hint-line text, deal-code footer and localised
names.

The deviations are recorded in `docs/spec/phased-design.md` by the tasks that cause them:
- the Phase 5 scope and §3.1 files (close-out);
- the §4 rows Viewport changes and Deal animation (resize and deal tasks);
- §5 seeding and the device-fit project (seeding and device-fit tasks).

### Chrome reservation used by the layout sweep

The unit sweep (`layout.sweep.test.ts`) needs board sizes without a browser.
`tests/fixtures/viewports.ts` holds `CHROME_BUDGET`, the width and height the frame takes around the
board panel, per profile and breakpoint:

- **Stacked profile:** fine or coarse pointer × width > 480 px or ≤ 480 px × hint line shown or
  hidden (hidden in portrait with height ≤ 600 px);
- **Side-rails profile:** fine or coarse pointer.

Each budget is the maximum over its partition. `boardSizeFor(config)` subtracts the matching budget
from the viewport; in the stacked profile the width is first capped at 64rem (1024 px), so the board
width is `min(viewport width, 1024) − width budget`; rails have no cap. The budget is maintained by
this rule, not by numbers fixed here:

1. **Seed** (sweep task): computed from the mockup frame CSS (L172–198, L307–318, L377–415) with
   1 rem = 16 px, counting content heights (44 px coarse icon buttons, the stat displays, the 48 px
   `.tool` minimum height) as well as paddings, borders and gaps; rails use the HUD rail 5.4 rem,
   the toolbar rail 4.4 rem, and gaps and padding 0.4 rem.
2. **Measure** (frame task): replace the seeded values with the maximum measured from the real frame
   in both pointer types at: 360×650 and 466×678 (stacked ≤ 480, hint shown); 320×480 and 466×490
   (stacked ≤ 480, hint hidden); 616×686, 835×752 and 2560×1440 (stacked > 480); 852×341 and
   1280×720 (rails). No matrix configuration is stacked, wider than 480 px and hint-hidden, so that
   partition reuses the hint-shown budget. Then re-run the sweep.
3. **Hold** (device-fit task): each e2e case asserts that the real board panel's content box is at
   least `boardSizeFor(config)`, with 1 px tolerance, so the fixture can never be more optimistic
   than the app and drift fails CI.

## Risks / Trade-offs

- **WebKit 3D flip flickers or flattens.** Use `-webkit-backface-visibility: hidden`, and no
  `overflow: hidden` on the `preserve-3d` element. The board spec runs in the webkit and iPhone
  projects. If it still misbehaves, fall back to an opacity swap in the WebKit-affected rule only.
- **jsdom has no layout, `ResizeObserver` or real transitions.** Tests inject observer entries and
  fake `requestAnimationFrame` and timers, and assert only attributes and inline custom properties.
  Media-query and computed-style behaviour is checked in e2e only (`frame.spec.ts`,
  `appearance.spec.ts`).
- **The 80 % coverage floor now includes UI hooks and components.** Each rendering task ships its
  component test with fake observer and media stubs. CSS is not measured.
- **Fit regressions when Phase 7 fills the reserved regions.** Regions are fixed at mockup size and
  the matrix re-runs in Phase 7.
- **Playwright run time on pre-push rises** by an estimated 3–5 minutes (55 fit cases plus the new
  specs across 6 projects). The fit, parity and latency specs run in Chromium only; `fullyParallel`
  is already on.
- **Touch emulation differs from real devices** (Firefox cannot emulate `isMobile`). The matrix uses
  Chromium, and every touch case asserts that the coarse pointer matches. Real-device checks are in
  Phase 9.
- **Seeding pitfalls.** A seed that rewrote the record on reload would mask resume bugs, so seeding
  writes only when the key is absent. An unstarted or won fixture writes no session, so the fixtures
  are `started` and `playing`, checked by a unit test that decodes them with `decodeRecord`.
- **Old table visible during a winnable search.** It is accepted as in the mockup; input gating is
  carried into Phase 6 (D5).

## Migration Plan

- **Storage.** No schema change. The `solitaire.local-state` v1 record, its codec and its defensive
  decoding are untouched. Stored preferences (theme, night cards, four-colour, back, animations,
  stock right) are now applied to the page, with no new keys.
- **Tokens.** The token contract is rebuilt (D3) and the red and four-colour inks change. Both are
  visual only, with no stored-data impact.
- **Rollback.** Reverting the change restores the text-only Game screen. Stored records remain valid
  in both directions.
