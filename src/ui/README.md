# UI layer

The screens, components and styles that render application state. Components dispatch typed commands and render
snapshots; they never apply game rules.

- `announce.ts` — `formatAnnouncement(item)` and `hintText(hint)`, the English wording of the announcement log
  (KS-A11Y-02); Phase 7 replaces only this formatter. Descriptors carry no text; the words reuse `cardName` and
  `pileLabel` from `board/names.ts` ("Seven of Clubs moved to column 4", "Moved 3 cards to the foundations",
  "No redeals left" for a `pass-limit` refusal, "Hint: move the Four of Hearts onto column 6").
- `components/` — small shared components (`Announcer.tsx`, `BuildStamp.tsx`, `Hud.tsx`, `Icon.tsx`, `Notices.tsx` and `Toolbar.tsx`, described below).
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
- `components/Icon.tsx` — `Icon({ path })`, the one decorative stroke icon: a 24-unit `svg` (`aria-hidden`,
  `focusable="false"`) drawing `path` with `fill="none"`, `stroke="currentColor"`, stroke width 2.2 and round caps and
  joins. `Toolbar` (Undo, Redo, Hint, Finish), `GameScreen` (the Back chevron) and `PileSlot` (the recycle mark) all use it; the visible
  label or the control's own name is the accessible name.
- `components/Toolbar.tsx` — `Toolbar`, the game controls: a `nav.toolbar` labelled "Game actions" holding four
  `button.tool` elements, in order Undo, Redo, Hint and Finish, whose visible text is the accessible name and whose
  decorative SVG icons are `aria-hidden` (drawn by `Icon`). Undo and Redo are disabled from `selectCanUndo` /
  `selectCanRedo` (which already fold in the finish-sequence `busy` flag) and dispatch the `undo` / `redo` thunk. Hint
  is disabled while the input gate is closed (`selectInputEnabled`) and dispatches `requestHint`. Finish is enabled only
  when `selectCanFinish` and the gate agree, carries `is-ready` (a primary-colour wash) while enabled, and dispatches
  `finish`. Native buttons give Enter and Space and the global focus ring; `styles/layout.css` sizes and arranges it
  (each tool keeps a 44 px floor under a coarse pointer, and four fit at 320 px wide and in the side-rails column).
- `components/Announcer.tsx` — `Announcer`, the one polite live region: a visually hidden `div.sr-only[role=status][aria-live=polite]`.
  On each change of the announcement log's `seq` it speaks the items whose `n` it has not spoken yet, joined with a
  space, through `formatAnnouncement`; when a batch's words equal the previous batch's it alternates a trailing
  zero-width character so an identical message is read again. The text derives from the log alone (clock ticks and
  other renders leave it), and a remount starts after the log's last `n`, so returning to the game does not replay
  old items.
- `components/Notices.tsx` — `Notices`, the transient notices host: `div.notices` holding one `div.notice` per raised notice
  (`selectNotices`), from an English table for the five ids. `dead-end` ("No moves left. Undo a few steps or deal
  again.") and `no-redeals` ("No redeals left") have no live region (the announcer speaks them) and go by themselves after
  `NOTICE_MS` = 3,200 ms, a `useEffect` timer in the notice's own component (mounting starts it, unmounting clears it, so
  a message raised again after it went shows for the full time). The storage ids (`storage-read`, `storage-read-only`,
  `storage-write`) are each a `role="status"` with a `button.notice-dismiss` named "Dismiss" that dispatches
  `noticeDismissed`, and stay until dismissed. Notices never take focus and never block the board.
- `screens/GameScreen.tsx` — `GameScreen`, the Game frame. In DOM order: a visually hidden `h1.sr-only` "Klondike"; one
  always-mounted, visually hidden `p[role=status]` that reads "Dealing…" while `selectDealing` is set and is empty
  otherwise; the `Announcer` (another `div.sr-only` status region); the `Notices` host (`div.notices`, fixed, so it never moves the layout); the stacked profile's `header.game-topbar` (the Back control and the reserved, empty `div.game-chips` slot,
  rendered only outside the rails); `main.game-body` holding `div.game-hud` (in the rails, Back first; then `Hud`, then
  the reserved, empty, `aria-hidden` `div.game-face` New-deal slot), the `aria-hidden` `p.game-hint` (empty until a hint shows, then `hintText(hint)` from `selectHint`; the announcer speaks the same text), `Board` and
  `Toolbar`; and `div.game-footer` holding `BuildStamp` (`App` renders `BuildStamp` itself only outside the Game
  screen). Back is a `button.game-back` named "Back to Home" that dispatches `setRoute('home')`; the DOM holds exactly
  one, placed by `useMediaQuery(RAILS_QUERY)`. CSS chooses the profile; the hook only decides where Back lives. It also
  mounts `useGameShortcuts`, the screen's global keys.
- `styles/layout.css` also holds the notices: `.notices` is `position: fixed` at the bottom right, offset by
  `env(safe-area-inset-right/bottom)` (at 480 px wide or narrower it spans the width and centres its notices, offset
  by the left inset too), `z-index: 400` and `pointer-events: none` (only `.notice-dismiss` takes the pointer). A
  `.notice` slides in with the `sheet-in` keyframes (180 ms); `:root[data-motion='off'] .notice` sets `animation: none`.
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
  count badge and the deal order; `slots.waste` is the waste anchor (the waste has no drawn slot; the point is where its
  top card sits). It also exports `columnSteps`, the tableau step of a column. The stacked table has column compression, the mirrored top row and the sideways
  Draw 3 fan. The wide table has stock and waste in one side column and the foundations in the other (swapped by
  `stockRight`), the tableau shifted one column in, a vertical Draw 3 fan and foundations that overlap on a short
  board.
- `board/names.ts` — `cardName(id, faceUp)`, `pileLabel(ref)` (the bare pile name, no count) and `pileName(ref, count)`, the English accessible names of cards
  ("Queen of Spades", "Face-down card") and piles ("Column 3, empty", "Hearts foundation, 2 cards"). The rank words
  are a `Record<Rank, string>` keyed by the numeric rank and read with `rankOf(id)`.
- `board/locate.ts` — `cardIndex(state)`, which maps every card id in a game position to `{ from, index, faceUp, movable }`: its pile, its index in that pile, whether it shows its face, and whether it can
  be picked up. The stock is face down and never movable; waste, foundation and tableau cards defer to `isMovable` in `src/domain/rules.ts`.
- `board/landing.ts` — the landing rectangles for drag and hint visuals: `landingAreas(layout, metrics, piles)` returns a
  map, keyed by `pileKey(ref)` (`stock`, `waste`, `foundation:<suit>`, `tableau:<col>`), of a `Rect` per pile. A
  foundation, the stock and the waste use their slot (the waste its anchor); a column has the card width and runs from
  the tableau top to 1.2 card heights below its next landing position, clipped to the board's bottom edge.
  `nextLanding(layout, metrics, piles, col)` is that position (an empty column: its slot), and
  `pickLargestOverlap(dragged, areas, targets)` picks the target with the largest overlap area, the earlier target in
  `targets` winning a tie (callers pass the legal targets lowest-numbered first), or `undefined` when nothing overlaps.
  `pileAt(areas, point)` is the reverse lookup for a board-space point: the pile whose area holds it (left and top edges
  in, right and bottom edges out), or `undefined`; a press outside any card uses it to find the stock, an empty column
  or a slot.
- `board/pointerController.ts` — the pointer state machine, `step(state, input) → { state, effects }` from
  `initialPointerState`, with the phases idle → pressed → dragging. Inputs are plain data: `down` (pointer id, kind
  `mouse | touch | pen`, button, position, timestamp `t`, and the `Hit` under it: `card`, `slot`, `stock`, `column` or
  `none`), `move`, `up`, and the pointer-less `cancel`, `escape`, `resize` and `gateClosed`. Effects are `tap { hit,
double }`, `dragStart { card }`, `dragMove { dx, dy }` (the offset from the press point), `drop { dx, dy }` and
  `cancel`. Only a primary-button `down` in idle starts a press, and the press ignores every other pointer id. Only a
  movable card outside the stock can become a drag, once the pointer is strictly more than 5 px (mouse) or 9 px (touch,
  pen) from the press point; any other press only taps. A release before that is a tap on the pressed target, `double`
  when the previous tap was on the same card less than 320 ms earlier (a tap on a non-card target forgets it). A
  release after a drag is a `drop` with no tap and sets `suppressClick` until the next `down`. `cancel`, `escape`,
  `resize` and `gateClosed` end a drag with one `cancel` effect (also setting `suppressClick`), end a plain press
  silently, and do nothing when idle. It reads no clock: every timestamp comes from the inputs.
- `board/keyboardController.ts` — keyboard vocabulary. `pileOrder(stockRight)` is the 13-pile Tab order (stock, waste,
  foundations ♥ ♣ ♦ ♠, columns 0–6; with the stock on the right the foundations, waste and stock, then the columns).
  `moveFocus(current, key, shift, piles, stockRight)` returns the next `{ from, index }` for Tab, Shift+Tab, Left and
  Right (pile to pile, an empty waste skipped, an empty foundation or column a stop with `index: null`, `undefined` past
  either end) and for Up and Down (face-up cards of a column, clamped, never a face-down card); the target of another
  pile is that pile's default stop (top card), which `defaultStop(pile, piles)` also exports (`undefined` for an empty waste). `keyToAction(event, { focus })` maps a key event to `undo`, `redo`,
  `hint`, `finish`, `draw`, `escape`, `newDeal`, `pause`, `activate` or `pickUp`, treating Ctrl and ⌘ alike and ignoring
  Alt combinations, other modified keys, shifted letters and text fields. The letters (H, A, N, P and Ctrl or ⌘ with Z
  and Y) are layout-independent through the private `letterOf(event)`: a Latin `key` is taken as typed (so AZERTY and
  Dvorak follow their labels), otherwise a `code` of `Key[A-Z]` names the letter (Ukrainian `р` on `KeyH` is H), and
  anything else is ignored; `KeyEventLike.code` is optional. Enter, Space, Escape, the arrows and Tab still go by `key`.
- `board/cascadeFrames.ts` — the win cascade's paths. `cascadeOrder()` is the 52 cards in flying order: kings first, down to
  aces, each rank in the foundation order (hearts, clubs, diamonds, spades). `cascadeFrames(starts, size, card, rng)`
  returns a `CascadePath` (`{ id, frames }`, the card's top left position on each frame) per card in that order; a card
  with no entry in `starts` is left out. Each card launches sideways (`vx = (rng() × 3 + 2.5) × ±1`) and up
  (`vy = −(rng() × 5 + 1)`), gains 0.5 of downward speed per frame, bounces off the bottom edge with a 0.72 factor and
  ends once it is past a side or after 180 frames. The paths depend only on the starts, the board size, the card
  size and the draws from `rng`, so a fixed `rng` gives fixed paths.

**`board/constants.ts`** holds the constants that more than one board component needs and that have no other home:
`TEXT_PRESENTATION` (the U+FE0E suffix that keeps a suit glyph text, used by `CardView` and `PileSlot`), `BADGE_Z` (the
stock badge's stacking order, above every card) and `CARD_RADIUS_FACTOR` (`0.09`, the card corner radius as a fraction
of the card width, which `Board` applies as `--cr`). It has no imports and is a plain constants file, not a geometry
module. `CARD_RADIUS_FACTOR` and `animations.ts`'s exported `DEAL_STEP_MS` mirror `--card-radius-factor` and
`--motion-deal-step`; `tests/unit/ui/motionConstants.test.ts` fails if either drifts from `styles/tokens.css`.

## Board rendering

Components in `board/` render the placements the pure modules compute. They are React, so they are not part of the
purity rule below.

- `board/CardView.tsx` — `CardView`, a memoised card at a fixed position. Its props are all primitives: `id`, `x`,
  `y`, `z`, `pile` (the `pileKey` string of its pile), `index` (its position in that pile), `faceUp`, `buried` and
  `compact`, plus `movable` and an optional `tabIndex`. The outer `div.card` is named by `cardName`: a movable card (`Board` passes `location.movable`) is a
  `role="button"` with `aria-pressed` set to `selected` and the given `tabIndex`; every other card, face down or face up, is a `role="img"` with no `tabindex`. It carries
  `data-card-id`, `data-suit`, `data-pile`, `data-index` (which the pointer reads back to find the card; from `selectCardLocations`), the inline `--x` / `--y` / `z-index` and the `is-up`, `is-buried`, `is-compact` and (when the optional `selected` prop is set, default false) `is-selected` and (when the optional `hinted` prop is set, default false, for a card of the run a hint moves) `is-hint`
  classes. `Board` sets `selected` on every card of `selectSelectedGroup`, so a selected or dragged run is ringed and, the component being memoised, only cards whose prop flips re-render. Both sides are always in the DOM so a later flip can rotate them; each side is `aria-hidden`, so a
  face-down card exposes only "Face-down card". The face has a corner index (rank plus a suit glyph followed by
  U+FE0E, so it stays text), a centre pip or a boxed J/Q/K, and a rotated bottom-right corner that a compact card
  omits.
- `styles/cards.css` — the card styles: `transform: translate(var(--x), var(--y))`, sizes in `--cw` units,
  the 3D flip structure with `-webkit-backface-visibility`, `--ink-*` inks per suit, the `--back-a` / `--back-b`
  checker (a fixed 8 px) with the `--color-back-rim` rim, and `box-shadow: none` on a buried card. It also holds the
  card transitions (see "Motion model" below) and `.card.is-dragging`: no transition, `z-index` of
  `calc(var(--drag-z-base) + var(--k, 0))` (with `!important`, because React owns the inline `z-index` and rewrites it
  on every render; `--k` is the card's place in the dragged run), a `transform` that adds `--dx` / `--dy` to `--x` /
  `--y`. Dropping removes the
  class, so the offset glides back (instantly under `data-motion='off'`). `--drag-z-base` (1600) is a `:root` token in
  `tokens.css`. It has no colour literals.
- `board/PileSlot.tsx` — `PileSlot`, a memoised slot beneath a stock, foundation or tableau pile (the waste has none).
  Props: `pile`, `count`, `x`, `y`, an optional `spent`, an optional `hinted` (the stock while the hint is to draw or recycle; adds `is-hint`) and an optional `tabIndex`. The `div.slot` is named by
  `pileName(pile, count)` and is a `role="button"` (carrying `tabIndex`) when it is the stock or an empty pile, and a `role="group"` (no `tabindex`) otherwise. `Board` passes `tabIndex` 0 to the one element `useBoardKeyboard` names as its target and -1 to every other button and movable card, so exactly one element on the board is a tab stop. It has `data-pile` (its `pileKey`) and the inline `--x` / `--y`, the `slot--stock` / `slot--found` / `slot--tab` class and
  `is-spent` when `spent`. Its children are `aria-hidden`: the recycle mark (an `Icon` in `currentColor`, always
  drawn on the stock) on the stock, "A" plus the suit glyph (followed by U+FE0E) on a foundation and "K" on a column.
  The caller derives `spent` as an empty stock that cannot be recycled (`!canRecycle(state)`).
- `board/StockBadge.tsx` — `StockBadge`, the count of cards left in the stock at its top-right corner. It renders
  nothing at 0; otherwise an `aria-hidden` `div.stock-count` with the inline `--x` / `--y` and `z-index` `BADGE_Z` (from `board/constants.ts`).
- `board/Board.tsx` — `Board`, the table. It always renders the `div.board-panel` that `useBoardSize` measures and
  renders nothing inside it until the first size arrives. With a size it measures the table
  (`useMemo(measure(size, { coarse }))`, `coarse` from `useMediaQuery('(pointer: coarse)')`) and places it with
  `useMemo(positions(piles ?? EMPTY_PILES, metrics, { stockRight }))`, so nothing is laid out again unless the piles,
  the size, the pointer or the `stockRight` preference change. The `div.board` inside carries `data-wide` and the
  inline `--cw`, `--ch` and `--cr` (`max(5, cw * CARD_RADIUS_FACTOR)` px, factor 0.09), and holds, in order: the stock slot, the four
  foundation slots in display order, the seven column slots, the stock badge and, only while a game is in play, one
  `CardView` per placed card id 0 to 51 in id order (`key` is the id). The elements therefore persist across moves, undo and
  redo: only their inline position changes. Without a game the slots render as for empty piles and no card renders.
  It also carries `--stock-x` / `--stock-y` (the stock slot's position, where a deal parks the cards) and a ref to the
  `div.board`, and composes `useResizeSettle`, `useCascade`, `useDealAnimation`, `useBoardActions`, `useBoardPointer` and `useBoardKeyboard` (see "Board state and hooks", "Motion model"). It reads `selectCardLocations` and passes each `CardView` its `pile` and `index`, and `selectSelectedGroup` for each card's `selected` flag. While a game is in play it renders `Ghosts` after the cards. It has no input handlers of its own: the drag and the tap are recognised in `useBoardPointer` and acted on in `useBoardActions`; `useBoardKeyboard` returns the `onKeyDown` and `onFocus` handlers it spreads on `div.board`, and the `target` it turns into each element's `tabIndex` (`tabIndexOf`).
- **`Ghosts`** (`board/Ghosts.tsx`) — `Ghosts({ layout, metrics, piles })`, the legal-target and hint markers. It reads
  `selectLegalTargets` and the `highlight` preference and renders no legal ghosts without targets or with Highlight legal moves
  off; otherwise one `div.ghost` per target with `data-ghost` (its `pileKey`), `aria-hidden` and the inline `--x` / `--y`:
  a column's `nextLanding` (its slot when empty), a foundation's rectangle in `landingAreas` (memoised). A ghost takes
  no pointer input (CSS `pointer-events: none`). While `selectHint` is a `move`, one more `div.ghost.is-hint` marks its
  target pile at the same position (with `data-hint-ghost` holding the `pileKey` and no `data-ghost`), whatever the
  Highlight preference says. `Board` passes `hinted` to the cards of a move hint and to the stock for a draw or recycle
  hint. `useBoardPointer` clears the hint on any accepted pointer press (`hintCleared`). `useBoardPointer` marks the drop target's ghost `is-hot` (see "Board state and hooks").
- `board/DealtEpochContext.tsx` — `createDealtEpochStore()`, a `{ get(): number | null; set(epoch) }` store that starts
  at `null` and holds the game epoch whose deal has been claimed, and `DealtEpochContext`, whose default is `null`.
  `App` creates the store once and provides it, so it survives leaving and re-entering the Game screen. It holds no
  components. Without a provider `Board` plays no deal.
- The deal's DOM half, `board/animations.ts` (DOM and timers, so not a pure board module) — `playDeal(boardEl, dealOrder)`, returning `{ finished(), cancel() }`.
  It sets `data-dealing="park"` on the board, forces a reflow, writes `--d = k·28ms` and `--fd = k·28+200ms` on the
  k-th card of `dealOrder` (the only properties it writes; never `--x` / `--y`), removes `data-dealing` (and
  `data-resizing`) and, after 28·28+600 = 1384 ms, clears the delays and marks itself finished. `cancel()` clears the
  timer, the delays and the attribute. `DEAL_STEP_MS` is exported and mirrors `--motion-deal-step`.
- `styles/board.css` — the static board, slot and badge styles, tokens only: the `.board-panel` felt
  (`--color-table` with a `--color-table-dot` dot texture, `--radius-lg`, `isolation: isolate` so no card's stacking
  order leaves the panel) and the `.board` inset over it; dashed slot outline in `--color-slot-line`
  (solid on the stock), `.is-spent` at 45% opacity, faint placeholder ink in `--color-slot-ink`, and the badge as an
  LCD pill (`--color-lcd-panel` / `--color-lcd-time`, `--font-pixel`). The `.board` also sets `touch-action: none`,
  `user-select: none`, `-webkit-user-select: none` and `-webkit-touch-callout: none`, so a touch on the table never
  scrolls, zooms, selects text or opens the callout. It has no transitions, no cursor rules and no
  colour literals.

### Motion model

Only `transform` is ever transitioned (the token test allows `transform`, `opacity` and `none`). `.card` glides between
`--x` / `--y` positions over `--motion-glide` with `--motion-ease`, delayed by `--d`; `.card-inner` flips over
`--motion-flip`, delayed by `--fd` (default `--motion-flip-delay`). Because the card elements persist, any position
change (undo, redo, restart, new deal) animates without knowing its cause. `--d` and `--fd` are written only by
`playDeal`; the stylesheets never set them. The single no-motion switch is `:root[data-motion='off']`, which sets both
transitions to `none`; no stylesheet uses `prefers-reduced-motion`.

**Re-layout on a size change.** `useResizeSettle` has a layout effect keyed on `[size]`, called before `useDealAnimation`. When the
board element exists it sets `data-resizing="true"` on it and removes the attribute in a `requestAnimationFrame`
callback; its cleanup cancels the frame. The first known size counts as a resize, so nothing glides from the table's
corner, and a change under 1 px never reaches the effect because `useBoardSize` ignores it. While the attribute is set,
`cards.css` turns both card transitions off, so the cards jump to their new places in the same frame. `playDeal`'s
release also removes the attribute, because its park already keeps the cards off the corner; otherwise a deal due at the
first size would release with transitions off. There is no `visualViewport` listener: browser bars showing or hiding
change the board's size, which the board's `ResizeObserver` already reports. Cancelling a drag is added with dragging in
Phase 6.

**The deal.** `useDealAnimation` has one layout effect, keyed on `[epoch, started, ready, reducedMotion, store]` (`ready` is the
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

`useBoardSize` and `useMediaQuery` read the browser through `useSyncExternalStore`, so a new value renders in the same
frame and no effect calls `setState`. The hooks are React and DOM code and the selectors are Redux code, so none of them
is part of the purity rule below.

- **`useBoardSize`** (`board/useBoardSize.ts`) — `useBoardSize()` returns `{ ref, size }`. `ref` is a stable callback
  ref for the board panel; it observes the element with a `ResizeObserver` and disconnects when React passes `null` on
  unmount. `size` is a `BoardSize` built from the observer entry's `contentRect`, or `null` before the first entry and
  wherever `ResizeObserver` is undefined. A change under 1 px on both axes, measured from the last accepted size, is
  ignored, and the snapshot keeps its identity until a change is accepted.
- **`useMediaQuery`** (`useMediaQuery.ts`) — `useMediaQuery(query)` returns whether the query matches, follows the
  `change` event live and returns `false` when `window.matchMedia` is missing (and on the server snapshot). The board
  uses it with `(pointer: coarse)`.
- **`useResizeSettle`** (`board/useResizeSettle.ts`) — `useResizeSettle(boardRef, size)` sets `data-resizing` on the
  board element for every `size`, the first included, and removes it on the next animation frame (see "Motion model").
  It does nothing while the element is not mounted. `Board` calls it before `useDealAnimation`.
- **`useBoardPointer`** (`board/useBoardPointer.ts`) — `useBoardPointer({ boardRef, layout, metrics, piles, activate })` binds
  delegated `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`, capture-phase `click` and
  `contextmenu` listeners on the board element once per element (plus a `keydown` on `document`), and reads the latest
  layout, metrics and piles through a ref. The controller state and the drag in progress live in closure variables, not
  React state, so a pointer frame costs no render. A press resolves to a `Hit` (`closest('[data-card-id]')` and
  `selectCardLocations` for a card, else `pileAt` over `landingAreas`) and only starts while `selectInputEnabled`
  holds; every accepted press calls `setPointerCapture` inside a `try`, so a refusal never breaks the drag. Effects:
  `tap` calls the `activate` function it is given (`useBoardActions`) with the hit and the double flag; `dragStart` dispatches `selectCard`, marks the run's elements
  `is-dragging` with a `--k` stacking key and remembers the landing areas and the legal targets; `dragMove` writes
  `--dx` / `--dy` on those elements only and toggles `is-hot` (`classList.toggle` with a force flag, so no React state per
  frame) on the `.ghost` whose `data-ghost` is the key of the largest-overlap legal target (the same overlap computation
  as `drop`, from one local helper), or on none; `drop` clears the class and properties, dispatches `selectionCleared`, and
  plays `{ type: 'move', from, index, to }` when the dragged rectangle overlaps a legal target (largest overlap),
  otherwise the removed offset glides back (instantly under `data-motion='off'`); `cancel` does the same without a
  move. While the controller's `suppressClick` is set, the capture-phase `click` listener swallows the click that
  follows a drag. Escape cancels only while dragging (and is then prevented), so `useGameShortcuts` skips it (it ignores every
  `defaultPrevented` key press) and does not handle Escape a second time then. Because React rewrites a card's whole `class` when `is-selected` flips, a layout effect re-adds `is-dragging` to the dragged elements after every commit. A change to the board piles (undo, redo or any other command mid-drag) also cancels the drag, so a drop never plays a stale move. A `metrics` change (which covers a size change) feeds `resize` and the input
  gate closing (`selectInputEnabled` turning false) feeds `gateClosed`; both cancel a drag. It is a hook, not a pure
  module, so it is not in the purity list below. `Board` calls it after `useResizeSettle`, `useDealAnimation` and `useBoardActions`.
- **`useBoardActions`** (`board/useBoardActions.ts`) — `useBoardActions(boardRef)` returns the stable
  `{ activate, pickUp }`, the functions every input path shares. `activate(hit, double = false)` is a tap or the keyboard's Enter and Space; `pickUp(hit)` is Shift+Enter and Shift+Space: on a movable card it dispatches `selectCard` (whatever the tap mode), or `selectionCleared` when that card is already the selection, and on anything else it does nothing; it too does nothing while the input gate is closed. It reads the store when called, so the
  listeners bound once per board element always see the position in play, and it does nothing while
  `selectInputEnabled` is false. A stock hit plays `draw`. In smart mode (`tapMode`, with nothing selected) a tap on a
  movable card plays `move` to its `bestTarget`; when nothing accepts it, it dispatches a `refused` announcement
  (`illegal-target`) and gives every card of the run `is-shake` (removed after `SHAKE_CLEAR_MS`, restarted by a reflow
  if the card is refused again; not added under `selectReducedMotion`). A `double` tap is always ignored in smart mode, with
  or without a selection, since its first tap already acted. Pending shake timers are cleared, and the class removed, on unmount. Under Select and place,
  or whenever a card is already picked up (in either mode, so a keyboard pick-up can be placed by a tap or by Enter), the private
  `selectAndPlace` rules apply. A tap resolves to a pile: a card's own pile, a slot's pile, or, for a `column` hit (a tap
  anywhere in the column's landing area, including the empty part below its last card), that tableau column; the stock and
  empty space have none, and the waste is never a legal target. (1) In Select and place only, a `double` tap on a movable card that is not on a
  foundation and whose lone group fits its suit's foundation (`canDrop` requires a single card) plays one `move` there
  (a counted move); any other double goes on as an ordinary tap. (2) With a selection, a tap whose pile is among `selectLegalTargets` plays `move` for the
  selection (placing wins over re-selecting, so a face-down or top card of a legal column counts); else a movable card
  other than the selected one becomes the selection (`selectCard`); else the selection is cleared. (3) With no selection
  a movable card is picked up and anything else does nothing. It is a hook, so it is not in the purity list below.
- **`useBoardKeyboard`** (`board/useBoardKeyboard.ts`) — `useBoardKeyboard({ boardRef, piles, stockRight, activate, pickUp })` returns `{ target, handlers }`. Focus rests on an anchor (a pile and the card it last rested on), so it follows a card that moves; `target` is that card's `{ from, index }` while the card can be picked up, otherwise the stop of the pile it is in now (`defaultStop`: the top card, the stock for an empty waste). `Board` gives that one element `tabIndex` 0 and every other card and slot -1. `onFocus` (bubbled from any card or slot, so a click also sets the position) records the anchor and the pile's remembered card. `onKeyDown` ignores Ctrl, Command and Alt; Tab, Shift+Tab and the arrow keys call `moveFocus` and `focus()` the element it names (a card by `data-pile` and `data-index`, a slot by `data-pile`), and when Tab or Left or Right lands on another pile the pile's remembered card replaces its default stop while that card is still in the pile and can be picked up. Arrow keys are always prevented; Tab and Shift+Tab only when focus moved, so the browser leaves the board past either end. Enter and Space (`keyToAction`) call `activate`, Shift with either calls `pickUp` (a held key acts once: an event with `repeat` is prevented and dropped, while the arrow keys and Tab keep repeating), with the `Hit` a pointer press on the target gives (a card, the stock, an empty foundation as a slot, an empty column as a column) and never a double tap; both are prevented so Space does not scroll. A new game epoch (`selectEpoch`) resets the anchor to the stock and forgets the remembered cards, since the next deal reuses the card ids. A layout effect moves DOM focus to the target when focus is inside the board on another element (a card that has just stopped being a tab stop). The focus ring is `.board .card:focus-visible::after` in `cards.css` (a frame 5 to 8px outside the card edge, clear of the selection outline, which reaches 4px), which leaves the selection outline on the card face free, and `.board .slot:focus-visible` in `board.css`, both in `--color-focus`. It is a hook, so it is not in the purity list below.
- **`useGameShortcuts`** (`board/useGameShortcuts.ts`) — `useGameShortcuts()`, mounted by `GameScreen`, binds one `keydown` listener on `window` (which sees an event after every `document` listener) and reads the store when a key arrives. It passes `event.code` to `keyToAction` so the letters work on any layout, and drops a `repeat` event of any mapped action (prevented, so Space does not scroll and a held key acts once). It skips a `defaultPrevented` event (the board's Enter, Space and Shift keys, and the drag's Escape, are already handled), works out the focus (`none` for the page itself, `board` inside `.board`, otherwise `other`) and maps the event with `keyToAction`; `activate` and `pickUp` are left to `useBoardKeyboard`. With a sheet open only Escape acts, dispatching `sheetClosed`. Otherwise, only while `selectInputEnabled` holds: Ctrl or Command with Z is `undo`, with Y or Shift+Z `redo`, H `requestHint`, A `finish` (which does nothing unless Finish is available), Space with nothing focused `play({ type: 'draw' })`, Escape `selectionCleared` when a selection exists. The acting keys are prevented. N (New deal) and P (Pause) are recognised and do nothing until Phase 7 adds their sheets. Typing in a text field never triggers a shortcut (`keyToAction`). It is a hook, so it is not in the purity list below.
- **`useDealAnimation`** (`board/useDealAnimation.ts`) — `useDealAnimation({ boardRef, ready, dealOrder })` plays the
  deal once per game epoch through `DealtEpochContext` and `playDeal`, and gives the epoch back when a deal is cancelled
  unfinished. It reads the epoch, the started flag and the reduced-motion preference itself, and keeps the latest
  `dealOrder` in a ref so a resize never replays the deal.
- **`cascade` and `useCascade`** (`board/cascade.ts`, `board/useCascade.ts`) — the win cascade's runner and trigger. Neither
  is pure, so neither is in the purity list below. `playCascade(boardEl, paths)` finds each path's persistent card
  element (`data-card-id`) and calls `el.animate` with one `transform: translate(x, y)` keyframe per frame (16 ms each,
  `easing: 'linear'`, `fill: 'forwards'`, the delay 70 ms per card), lifting the card to `zIndex` 2000 plus its index for
  the flight; only `transform` is animated. It returns `{ cancel }`, which is idempotent, stops every animation and puts a
  card's `zIndex` back only while it still holds the lifted value (a re-render that wrote a new one is kept).
  `useCascade({ boardRef, ready, starts, size, card })` reads `selectEpoch`, the game `status` and
  `selectReducedMotion` itself. One layout effect keyed on `[epoch, status]` compares them with what the previous run saw: a
  new epoch (a new deal, a cleared game, a restored game that is already won) cancels a running cascade and starts none;
  the same epoch turning to `won` while `ready`, with motion on, plays `cascadeFrames(starts, size, card, Math.random)`
  (`Math.random` is fine: the paths are a visual effect only). The other inputs are read from a ref refreshed each render,
  so a resize or a motion change mid-cascade neither cancels nor restarts it, and unmounting cancels it. It dispatches
  nothing and holds no store state: the win already closes the input gate. `Board` calls it before `useDealAnimation`, so a new deal finds the cascade already cancelled and parks the cards at the stock. jsdom
  has no Web Animations API, so tests that reach a win with a board mounted install `tests/support/waapi.ts`.
- **`selectors`** (`board/selectors.ts`) — `selectBoardPiles` is a memoised selector over the tableau, stock, waste,
  foundations and draw of the game in play: a `BoardPiles`, or `null` while there is no game. It keeps its identity
  while those five references do, so an `accrued` clock tick (which replaces the position but shares its piles) gives
  the board no new layout input. `selectStockSpent` is `true` for an empty stock that `canRecycle` refuses, and dims
  the stock slot. `selectCardLocations` is a memoised selector over the position in play: `cardIndex` of it (a map of
  card id to pile, index, face and movability), or `null` while there is no game. Its `resultEqualityCheck` is
  `sameLocations`, which compares each card's pile key, index and movability, so an `accrued` clock tick recomputes the
  map but keeps the previous reference and `Board` does not re-render.
- **App selectors** (`src/app/selectors.ts`) — besides `selectReducedMotion`, the named readers `selectDealing` (the
  deal in flight or `null`; `GameScreen`), `selectEpoch` (the game epoch; `useDealAnimation`, `useCascade`), `selectCurrentGame` (the position in
  play or `null`; `Hud`) and `selectBusy` (the gate flag; no component reads it yet). They take a structural root, so
  the module imports no store.

## Board purity rule

- A pure board module imports only its own siblings (`./name`) and domain modules (`../../domain/name`). It imports
  nothing from React, Redux, the DOM, storage or the network, and never from `src/features` or `src/app`.
- It uses no `Math.random` and no `crypto`.
- Two guards enforce this: an ESLint override on `src/ui/board/{metrics,layout,names,locate,landing,pointerController,keyboardController,cascadeFrames}.ts` (`eslint.config.js`) and
  `tests/unit/repo/boardPurity.test.ts`, which scans every module listed above.
