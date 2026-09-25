# UI layer

The screens, components and styles that render application state. Components dispatch typed commands and render
snapshots; they never apply game rules.

- `components/` — small shared components (`BuildStamp.tsx`).
- `screens/` — the Home and Game screens (`HomeScreen.tsx`, `GameScreen.tsx`).
- `styles/` — the CSS token contract (`tokens.css`) and global rules (`global.css`).
- `board/` — the table: pure layout geometry, listed below.

## Pure board modules

Modules in `board/` that compute geometry are pure functions of their inputs (each is listed as a backticked
`board/name.ts` bullet):

- `board/metrics.ts` — `measure(size, { coarse })`, which turns a board size and pointer type into card size,
  spacing, the stacked-or-wide table choice and the compact flag, and `worstStrip(...)`, the worst-case face-up strip
  behind that choice.
- `board/layout.ts` — `positions(piles, metrics, { stockRight })`, which turns the five board piles of a game position
  into a placement (`x`, `y`, stacking order, face-up and buried flags) for every card, the empty-pile slots, the stock
  count badge and the deal order, for the stacked table: column compression, the mirrored top row and the Draw 3 fan.

## Board purity rule

- A pure board module imports only its own siblings (`./name`) and domain modules (`../../domain/name`). It imports
  nothing from React, Redux, the DOM, storage or the network, and never from `src/features` or `src/app`.
- It uses no `Math.random` and no `crypto`.
- Two guards enforce this: an ESLint override on `src/ui/board/{metrics,layout}.ts` (`eslint.config.js`) and
  `tests/unit/repo/boardPurity.test.ts`, which scans every module listed above.
