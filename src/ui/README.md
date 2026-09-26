# UI layer

The screens, components and styles that render application state. Components dispatch typed commands and render
snapshots; they never apply game rules.

- `components/` — small shared components (`BuildStamp.tsx`, `Hud.tsx` and `Toolbar.tsx`, described below).
- `screens/` — the Home and Game screens (`HomeScreen.tsx`, `GameScreen.tsx`) and `profiles.ts`, described below.
- `styles/` — the CSS token contract (`tokens.css`), card faces and backs (`cards.css`), the board panel, pile slots
  and the stock badge (`board.css`), the HUD stat-display colours (`hud.css`), the Game frame layout (`layout.css`) and
  global rules (`global.css`, which imports the other five sheets).
- `board/` — the table: pure layout geometry and naming, listed below, the React card, slot, badge and `Board`
  components, the board size hook and the board selectors.
- `format.ts` — the pure HUD text formatters: `formatScore` and `formatMoves` (three-digit zero pad), `formatBank`
  (`$47`, `-$52`) and `formatTime` (`m:ss`, then `h:mm:ss` from one hour). It takes plain numbers and is not a board
  module.
- `components/Hud.tsx` — `Hud`, the read-only HUD. It reads the game in play and the displayed score and returns a
  fragment (no frame): a `div.hud-group` with the Score (Bank in Vegas) and Moves stat displays, then the Time stat
  display. Each `div.stat-display` holds a `span.stat-display__label` (text "Score" / "Bank" / "Moves" / "Time", exposed
  to assistive technology) and a `span.stat-display__value`. It renders nothing without a game. Its colours come from
  `styles/hud.css` (colour-only, LCD tokens); `styles/layout.css` sizes and arranges it.
- `components/Toolbar.tsx` — `Toolbar`, the Undo and Redo controls: a `nav.toolbar` labelled "Game actions" holding two
  `button.tool` elements whose visible text ("Undo", "Redo") is the accessible name and whose decorative SVG icons are
  `aria-hidden`. Each is disabled from `selectCanUndo` / `selectCanRedo` (which already fold in the finish-sequence
  `busy` flag) and dispatches the `undo` / `redo` thunk. Native buttons give Enter and Space and the global focus ring;
  `styles/layout.css` sizes and arranges it.
- `screens/GameScreen.tsx` — `GameScreen`, the Game frame. In DOM order: a visually hidden `h1.sr-only` "Klondike"; one
  always-mounted, visually hidden `p[role=status]` that reads "Dealing…" while `state.app.dealing` is set and is empty
  otherwise; the stacked profile's `header.game-topbar` (the Back control and the reserved, empty `div.game-chips` slot,
  rendered only outside the rails); `main.game-body` holding `div.game-hud` (in the rails, Back first; then `Hud`, then
  the reserved, empty, `aria-hidden` `div.game-face` New-deal slot), the reserved, empty `p.game-hint`, `Board` and
  `Toolbar`; and `div.game-footer` holding `BuildStamp` (`App` renders `BuildStamp` itself only outside the Game
  screen). Back is a `button.game-back` named "Back to Home" that dispatches `setRoute('home')`; the DOM holds exactly
  one, placed by `useMediaQuery(RAILS_QUERY)`. CSS chooses the profile; the hook only decides where Back lives.
- `screens/profiles.ts` — `RAILS_QUERY`, `'(orientation: landscape) and (max-height: 720px)'`, the side-rails
  condition. `layout.css` repeats it literally in its rails `@media` rule and `tests/unit/ui/layoutCss.test.ts` fails if
  the two drift apart.
- `styles/layout.css` — the Game frame, tokens only (no colour literals, no `prefers-reduced-motion`). `.screen--game`
  is `100dvh`, `overflow: hidden`, padded by `env(safe-area-inset-top/right/bottom/left)` on every edge in both
  profiles. The stacked profile (`.game-body` capped at `min(100%, 64rem)`) has the region sizes of the mockup: the HUD
  ordered Score/Moves, New-deal slot, Time by CSS `order` (slot 2.9rem, 2.6rem at 460 px wide or narrower, 2.5rem in the
  rails), the hint line at one `0.7rem` line (`0.64rem` at 480 px or narrower), the chip slot at Back's height with
  `flex: 1; min-width: 0; overflow: hidden`, the 3rem tools; the footer is hidden at 480 px or narrower, the hint line
  in portrait at 600 px tall or less and Moves at 360 px or narrower. The rails (`RAILS_QUERY`) hide the top bar, hint
  line and footer and lay out a 5.4rem HUD rail, the table (`min-height: 0`) and a 4.4rem toolbar rail at full width,
  always showing Moves. Under `(pointer: coarse)` Back and the tools are at least 2.75rem (44 px) square in both
  profiles. Hover uses `--color-hover`; every transition is off under `:root[data-motion='off']`. The chrome it leaves
  around the table is what `tests/fixtures/viewports.ts` `CHROME_BUDGET` records (measured, rounded up).
- `useMediaQuery.ts` — the media-query hook (see "Board state and hooks").

## Pure board modules

Modules in `board/` that compute geometry are pure functions of their inputs (each is listed as a backticked
`board/name.ts` bullet):

- `board/metrics.ts` — `measure(size, { coarse })`, which turns a board size and pointer type into card size,
  spacing (the column gap shrinks below its formula value only when the 30 px card floor would otherwise push the
  columns past the board), the stacked-or-wide table choice and the compact flag, and `worstStrip(...)`, the
  worst-case face-up strip behind that choice.
- `board/layout.ts` — `positions(piles, metrics, { stockRight })`, which turns the five board piles of a game position
  into a placement (`x`, `y`, stacking order, face-up and buried flags) for every card, the empty-pile slots, the stock
  count badge and the deal order. The stacked table has column compression, the mirrored top row and the sideways
  Draw 3 fan. The wide table has stock and waste in one side column and the foundations in the other (swapped by
  `stockRight`), the tableau shifted one column in, a vertical Draw 3 fan and foundations that overlap on a short
  board.
- `board/names.ts` — `cardName(id, faceUp)` and `pileName(ref, count)`, the English accessible names of cards
  ("Queen of Spades", "Face-down card") and piles ("Column 3, empty", "Hearts foundation, 2 cards").

## Board rendering

Components in `board/` render the placements the pure modules compute. They are React, so they are not part of the
purity rule below.

- `board/CardView.tsx` — `CardView`, a memoised card at a fixed position. Its props are all primitives: `id`, `x`,
  `y`, `z`, `faceUp`, `buried` and `compact`. The outer `div.card` is a `role="img"` named by `cardName` and carries
  `data-card-id`, `data-suit`, the inline `--x` / `--y` / `z-index` and the `is-up`, `is-buried` and `is-compact`
  classes. Both sides are always in the DOM so a later flip can rotate them; each side is `aria-hidden`, so a
  face-down card exposes only "Face-down card". The face has a corner index (rank plus a suit glyph followed by
  U+FE0E, so it stays text), a centre pip or a boxed J/Q/K, and a rotated bottom-right corner that a compact card
  omits.
- `styles/cards.css` — the card styles: `transform: translate(var(--x), var(--y))`, sizes in `--cw` units,
  the 3D flip structure with `-webkit-backface-visibility`, `--ink-*` inks per suit, the `--back-a` / `--back-b`
  checker (a fixed 8 px) with the `--color-back-rim` rim, and `box-shadow: none` on a buried card. It also holds the
  card transitions (see "Motion model" below). It has no colour literals.
- `board/PileSlot.tsx` — `PileSlot`, a memoised slot beneath a stock, foundation or tableau pile (the waste has none).
  Props: `pile`, `count`, `x`, `y` and an optional `spent`. The `div.slot` is a `role="group"` named by
  `pileName(pile, count)` with the inline `--x` / `--y`, the `slot--stock` / `slot--found` / `slot--tab` class and
  `is-spent` when `spent`. Its children are `aria-hidden`: the recycle mark (an inline SVG in `currentColor`, always
  drawn on the stock) on the stock, "A" plus the suit glyph (followed by U+FE0E) on a foundation and "K" on a column.
  The caller derives `spent` as an empty stock that cannot be recycled (`!canRecycle(state)`).
- `board/StockBadge.tsx` — `StockBadge`, the count of cards left in the stock at its top-right corner. It renders
  nothing at 0; otherwise an `aria-hidden` `div.stock-count` with the inline `--x` / `--y` and `z-index` `BADGE_Z`.
- `board/Board.tsx` — `Board`, the table. It always renders the `div.board-panel` that `useBoardSize` measures and
  renders nothing inside it until the first size arrives. With a size it measures the table
  (`useMemo(measure(size, { coarse }))`, `coarse` from `useMediaQuery('(pointer: coarse)')`) and places it with
  `useMemo(positions(piles ?? EMPTY_PILES, metrics, { stockRight }))`, so nothing is laid out again unless the piles,
  the size, the pointer or the `stockRight` preference change. The `div.board` inside carries `data-wide` and the
  inline `--cw`, `--ch` and `--cr` (`max(5, cw * 0.09)` px), and holds, in order: the stock slot, the four
  foundation slots in display order, the seven column slots, the stock badge and, only while a game is in play, one
  `CardView` per placed card id 0 to 51 in id order (`key` is the id). The elements therefore persist across moves, undo and
  redo: only their inline position changes. Without a game the slots render as for empty piles and no card renders.
  It also carries `--stock-x` / `--stock-y` (the stock slot's position, where a deal parks the cards) and a ref to the
  `div.board`, and runs the resize-flag and deal effects described under "Motion model". It has no pointer handlers yet.
- `board/DealtEpochContext.tsx` — `createDealtEpochStore()`, a `{ get(): number | null; set(epoch) }` store that starts
  at `null` and holds the game epoch whose deal has been claimed, and `DealtEpochContext`, whose default is `null`.
  `App` creates the store once and provides it, so it survives leaving and re-entering the Game screen. It holds no
  components. Without a provider `Board` plays no deal.
- The deal's DOM half, `board/animations.ts` (DOM and timers, so not a pure board module) — `playDeal(boardEl, dealOrder)`, returning `{ finished(), cancel() }`.
  It sets `data-dealing="park"` on the board, forces a reflow, writes `--d = k·28ms` and `--fd = k·28+200ms` on the
  k-th card of `dealOrder` (the only properties it writes; never `--x` / `--y`), removes `data-dealing` (and
  `data-resizing`) and, after 28·28+600 = 1384 ms, clears the delays and marks itself finished. `cancel()` clears the
  timer, the delays and the attribute. Its constants mirror `--motion-deal-step`.
- `styles/board.css` — the static board, slot and badge styles, tokens only: the `.board-panel` felt
  (`--color-table` with a `--color-table-dot` dot texture, `--radius-lg`, `isolation: isolate` so no card's stacking
  order leaves the panel) and the `.board` inset over it; dashed slot outline in `--color-slot-line`
  (solid on the stock), `.is-spent` at 45% opacity, faint placeholder ink in `--color-slot-ink`, and the badge as an
  LCD pill (`--color-lcd-panel` / `--color-lcd-time`, `--font-pixel`). It has no transitions, no cursor rules and no
  colour literals.

### Motion model

Only `transform` is ever transitioned (the token test allows `transform`, `opacity` and `none`). `.card` glides between
`--x` / `--y` positions over `--motion-glide` with `--motion-ease`, delayed by `--d`; `.card-inner` flips over
`--motion-flip`, delayed by `--fd` (default `--motion-flip-delay`). Because the card elements persist, any position
change (undo, redo, restart, new deal) animates without knowing its cause. `--d` and `--fd` are written only by
`playDeal`; the stylesheets never set them. The single no-motion switch is `:root[data-motion='off']`, which sets both
transitions to `none`; no stylesheet uses `prefers-reduced-motion`.

**Re-layout on a size change.** `Board` has a layout effect keyed on `[size]`, declared before the deal effect. When the
board element exists it sets `data-resizing="true"` on it and removes the attribute in a `requestAnimationFrame`
callback; its cleanup cancels the frame. The first known size counts as a resize, so nothing glides from the table's
corner, and a change under 1 px never reaches the effect because `useBoardSize` ignores it. While the attribute is set,
`cards.css` turns both card transitions off, so the cards jump to their new places in the same frame. `playDeal`'s
release also removes the attribute, because its park already keeps the cards off the corner; otherwise a deal due at the
first size would release with transitions off. There is no `visualViewport` listener: browser bars showing or hiding
change the board's size, which the board's `ResizeObserver` already reports. Cancelling a drag is added with dragging in
Phase 6.

**The deal.** `Board` has one layout effect, keyed on `[epoch, started, ready, reducedMotion, store]` (`ready` is the
board and its cards rendered; the latest deal order is read from a ref written by an earlier layout effect, so a resize
never replays the deal). It triggers when a store is provided, the board is ready, the game is not started
(`state.game.current?.started === false`) and `epoch` differs from the store's last-dealt epoch. It claims the epoch
straight away, also under reduced motion, where it stops (nothing plays, and switching motion on later never replays
that deal); otherwise it calls `playDeal`. Its cleanup calls `cancel()` and, if the deal had not finished, restores the
previous epoch, so leaving mid-deal and coming back, a StrictMode re-mount or a newer deal all replay from the stock,
while a finished deal is never replayed. While `data-dealing="park"` is set, `cards.css` puts every card at
`translate(var(--stock-x), var(--stock-y))` with its inner element face-down and both transitions off; removing the
attribute after the reflow lets each card glide to its own `--x` / `--y` after its `--d`.

## Board state and hooks

The two hooks read the browser through `useSyncExternalStore`, so a new value renders in the same frame and no effect
calls `setState`. The hooks are React and DOM code and the selectors are Redux code, so none of them is part of the
purity rule below.

- **`useBoardSize`** (`board/useBoardSize.ts`) — `useBoardSize()` returns `{ ref, size }`. `ref` is a stable callback
  ref for the board panel; it observes the element with a `ResizeObserver` and disconnects when React passes `null` on
  unmount. `size` is a `BoardSize` built from the observer entry's `contentRect`, or `null` before the first entry and
  wherever `ResizeObserver` is undefined. A change under 1 px on both axes, measured from the last accepted size, is
  ignored, and the snapshot keeps its identity until a change is accepted.
- **`useMediaQuery`** (`useMediaQuery.ts`) — `useMediaQuery(query)` returns whether the query matches, follows the
  `change` event live and returns `false` when `window.matchMedia` is missing (and on the server snapshot). The board
  uses it with `(pointer: coarse)`.
- **`selectors`** (`board/selectors.ts`) — `selectBoardPiles` is a memoised selector over the tableau, stock, waste,
  foundations and draw of the game in play: a `BoardPiles`, or `null` while there is no game. It keeps its identity
  while those five references do, so an `accrued` clock tick (which replaces the position but shares its piles) gives
  the board no new layout input. `selectStockSpent` is `true` for an empty stock that `canRecycle` refuses, and dims
  the stock slot.

## Board purity rule

- A pure board module imports only its own siblings (`./name`) and domain modules (`../../domain/name`). It imports
  nothing from React, Redux, the DOM, storage or the network, and never from `src/features` or `src/app`.
- It uses no `Math.random` and no `crypto`.
- Two guards enforce this: an ESLint override on `src/ui/board/{metrics,layout,names}.ts` (`eslint.config.js`) and
  `tests/unit/repo/boardPurity.test.ts`, which scans every module listed above.
