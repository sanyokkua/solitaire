# UI layer

The screens, components and styles that render application state. Components dispatch typed commands and render
snapshots; they never apply game rules.

- `components/` — small shared components (`BuildStamp.tsx`).
- `screens/` — the Home and Game screens (`HomeScreen.tsx`, `GameScreen.tsx`).
- `styles/` — the CSS token contract (`tokens.css`), card faces and backs (`cards.css`), pile slots and the stock
  badge (`board.css`) and global rules (`global.css`, which imports all three).
- `board/` — the table: pure layout geometry and naming, listed below, the React card, slot and badge components,
  and the board size hook.
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
- `styles/cards.css` — the static card styles: `transform: translate(var(--x), var(--y))`, sizes in `--cw` units,
  the 3D flip structure with `-webkit-backface-visibility`, `--ink-*` inks per suit, the `--back-a` / `--back-b`
  checker (a fixed 8 px) with the `--color-back-rim` rim, and `box-shadow: none` on a buried card. It has no
  transitions and no colour literals.
- `board/PileSlot.tsx` — `PileSlot`, a memoised slot beneath a stock, foundation or tableau pile (the waste has none).
  Props: `pile`, `count`, `x`, `y` and an optional `spent`. The `div.slot` is a `role="group"` named by
  `pileName(pile, count)` with the inline `--x` / `--y`, the `slot--stock` / `slot--found` / `slot--tab` class and
  `is-spent` when `spent`. Its children are `aria-hidden`: the recycle mark (an inline SVG in `currentColor`, always
  drawn on the stock) on the stock, "A" plus the suit glyph (followed by U+FE0E) on a foundation and "K" on a column.
  The caller derives `spent` as an empty stock that cannot be recycled (`!canRecycle(state)`).
- `board/StockBadge.tsx` — `StockBadge`, the count of cards left in the stock at its top-right corner. It renders
  nothing at 0; otherwise an `aria-hidden` `div.stock-count` with the inline `--x` / `--y` and `z-index` `BADGE_Z`.
- `styles/board.css` — the static slot and badge styles, tokens only: dashed slot outline in `--color-slot-line`
  (solid on the stock), `.is-spent` at 45% opacity, faint placeholder ink in `--color-slot-ink`, and the badge as an
  LCD pill (`--color-lcd-panel` / `--color-lcd-time`, `--font-pixel`). It has no transitions, no cursor rules and no
  colour literals.

## Board state and hooks

Both hooks read the browser through `useSyncExternalStore`, so a new value renders in the same frame and no effect
calls `setState`. They are React and DOM code, so they are not part of the purity rule below.

- **`useBoardSize`** (`board/useBoardSize.ts`) — `useBoardSize()` returns `{ ref, size }`. `ref` is a stable callback
  ref for the board panel; it observes the element with a `ResizeObserver` and disconnects when React passes `null` on
  unmount. `size` is a `BoardSize` built from the observer entry's `contentRect`, or `null` before the first entry and
  wherever `ResizeObserver` is undefined. A change under 1 px on both axes, measured from the last accepted size, is
  ignored, and the snapshot keeps its identity until a change is accepted.
- **`useMediaQuery`** (`useMediaQuery.ts`) — `useMediaQuery(query)` returns whether the query matches, follows the
  `change` event live and returns `false` when `window.matchMedia` is missing (and on the server snapshot). The board
  uses it with `(pointer: coarse)`.

## Board purity rule

- A pure board module imports only its own siblings (`./name`) and domain modules (`../../domain/name`). It imports
  nothing from React, Redux, the DOM, storage or the network, and never from `src/features` or `src/app`.
- It uses no `Math.random` and no `crypto`.
- Two guards enforce this: an ESLint override on `src/ui/board/{metrics,layout,names}.ts` (`eslint.config.js`) and
  `tests/unit/repo/boardPurity.test.ts`, which scans every module listed above.
