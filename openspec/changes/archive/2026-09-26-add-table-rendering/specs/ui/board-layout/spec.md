# Spec Delta

## Purpose

Defines the table's geometry: given a game position, the board's size and the pointer type, where
every card, slot and badge goes, so that every pile fits the board and long columns stay tappable.

## ADDED Requirements

### Requirement: Layout is a pure, deterministic function

The board geometry SHALL be computed from four inputs only: the piles of the game position (tableau,
stock, waste, foundations and draw count), the board's inner size, whether the primary pointer is
coarse (touch) or fine (mouse), and the Stock on the right preference. The same inputs SHALL always
produce the same placements, and a change to any other part of the game state (score, moves, time)
SHALL not change them. The geometry SHALL not depend
on the DOM, on timers, on storage or on randomness, and a repository guard SHALL enforce this.

Input-agnostic: pure computation; the pointer type is an input value, not an interaction.
Determinism: a seeded deal and a fixed size give identical placements on every run.

*(KS-GEN-05; determinism per constitution principle 2 (new))*

#### Scenario: Same inputs, same placements

- **WHEN** the layout is computed twice for the same seeded deal, board size, pointer type and
  mirror preference
- **THEN** both results are identical

#### Scenario: Purity is guarded

- **WHEN** the layout module imports a UI framework, the DOM, storage or a random source
- **THEN** the repository guard fails

### Requirement: Card size and spacing follow the board size

For a board of inner width W and height H, with `small` meaning W < 520 px, the layout SHALL use:

- padding `pad = max(small ? 4 : 8, min(18, 0.022·W))` px;
- column gap `gap = max(small ? 3 : 4, min(14, 0.016·W))` px;
- row gap between the top row and the tableau `max(1.4·gap, 10)` px;
- with inner size `iw = W − 2·pad`, `ih = H − 2·pad`, card width
  `cw = max(30, min(104, (iw − 6·gap) / 7, ih / (1.4 · 3.1)))` in the stacked geometry and
  `cw = max(30, min(104, (iw − 8·gap) / 9, ih / (1.4 · 2.5)))` in the wide geometry.

When the 30 px card floor would make the columns wider than the padded board, the gap SHALL shrink just
enough that the pile grid fits within the padded board (never below 0); the geometry choice and the card
width SHALL not depend on that shrink. The wide geometry's vertical spacing between stacked side-column
cards uses the same gap.

The card height SHALL be 1.4 times its width. Cards narrower than 70 px SHALL be marked compact. The
pile grid SHALL be centred horizontally within the board.

Input-agnostic: pure computation.

*(KS-GEN-05, R§10; padding and gap minimums from the mockup)*

#### Scenario: Desktop cap

- **WHEN** the layout is computed for a 1180×690 board with a fine pointer
- **THEN** the card width is 104 px and cards are not compact

#### Scenario: Narrow phone

- **WHEN** the layout is computed for a 360-px-wide portrait board
- **THEN** the card width is below 70 px, at least 30 px, and cards are compact

#### Scenario: Small-board spacing

- **WHEN** the layout is computed for a board narrower than 520 px
- **THEN** the padding is at least 4 px and the gap at least 3 px, following the formulas above (except where
  the card floor forces the gap lower, see above)

#### Scenario: Narrowest board fits

- **WHEN** the layout is computed with a coarse pointer for the board left by a 320×480 screen (about
  308×245 px)
- **THEN** every column lies inside the board's width

### Requirement: Stacked or wide table is chosen by the worst-case strip

The layout SHALL estimate the face-up strip left for a worst-case column of 6 face-down and 13
face-up cards in both the stacked geometry (top row above seven columns) and the wide geometry (nine
columns: stock and waste in one side column, foundations in the other). It SHALL use the wide
geometry exactly when the stacked strip is below 14 px with a coarse pointer (9 px with a fine
pointer) and the wide strip is thicker than the stacked one; otherwise it SHALL use the stacked
geometry.

Input-agnostic: pure computation; the pointer type is an input value.

*(KS-GEN-07)*

#### Scenario: Landscape phone uses the wide table

- **WHEN** the layout is computed with a coarse pointer for a board of a landscape phone browser view
  (for example 700×280)
- **THEN** the wide geometry is chosen and its worst-case strip is thicker than the stacked one

#### Scenario: Desktop stays stacked

- **WHEN** the layout is computed with a fine pointer for a 1180×690 board
- **THEN** the stacked geometry is chosen

### Requirement: Columns compress face-down cards first

Each tableau column SHALL step face-down cards by 0.11 of the card height and face-up cards by 0.27
of the card height (0.30 with a coarse pointer). When a column would run past the bottom of the
board, face-down steps SHALL shrink first, down to 0.04 of the card height, and only then SHALL
face-up steps shrink. Every card of every column SHALL stay inside the board. On every §8.5 device
board in installed mode with a coarse pointer, a worst-case column SHALL keep a face-up strip of at
least 14 px.

Input-agnostic: pure computation.

*(KS-GEN-05, KS-A11Y-04 strip size, R§10)*

#### Scenario: Short column is not compressed

- **WHEN** a column holds 3 face-down and 2 face-up cards on a tall board
- **THEN** the steps are 0.11 and 0.27 (or 0.30 on touch) of the card height

#### Scenario: Face-down cards squeeze first

- **WHEN** a worst-case column does not fit the board at the normal steps
- **THEN** its face-down step shrinks before its face-up step, and never below 0.04 of the card height

#### Scenario: Worst case fits on every device

- **WHEN** the layout is computed with a coarse pointer for the installed-mode board size of each
  §8.5 screen, portrait and landscape, with a worst-case column
- **THEN** every card lies inside the board and the face-up strip is at least 14 px

### Requirement: Top row, mirror and Draw 3 fan

In the stacked geometry the top row SHALL hold, from left to right, the stock, the waste, an empty
gap and the four foundations in the order hearts, clubs, diamonds, spades. While Stock on the right
is on, the stock and waste SHALL move to the right end (stock outermost) and the foundations to the
left, keeping their suit order, and the waste SHALL fan leftward; the tableau SHALL not be mirrored.
In the wide geometry the stock SHALL sit at the top of one side column with the waste below it, the
foundations SHALL stack in the other side column (overlapping when the board is short), and Stock on
the right SHALL swap the two side columns. While the mode draws 3, the top three waste cards (or
fewer) SHALL fan by 0.24 of the card width horizontally (0.2 of the card height downward in the wide
geometry), with every lower waste card beneath the first fan position.

Input-agnostic: pure computation; Stock on the right is an input value.

*(KS-MOVE-06, KS-SET-05)*

#### Scenario: Default top row

- **WHEN** the stacked layout is computed with Stock on the right off
- **THEN** the stock is in the leftmost column, the waste in the second, and the foundations fill the
  four rightmost columns in the order hearts, clubs, diamonds, spades

#### Scenario: Mirrored top row

- **WHEN** the stacked layout is computed with Stock on the right on
- **THEN** the stock is in the rightmost column, the waste to its left, the foundations fill the four
  leftmost columns in the order hearts, clubs, diamonds, spades, and the waste fans leftward

#### Scenario: Draw 3 fan

- **WHEN** a Draw 3 game has 5 cards in the waste
- **THEN** the top three waste cards are offset by 0, 1 and 2 fan steps, the top card is furthest out,
  and the two lower cards share the first fan position

#### Scenario: Draw 1 has no fan

- **WHEN** a Draw 1 game has several cards in the waste
- **THEN** every waste card shares one position

#### Scenario: Wide-table mirror

- **WHEN** the wide layout is computed with Stock on the right on
- **THEN** the stock and waste occupy the right side column and the foundations the left one

### Requirement: Stacking order, buried cards and anchors

Every placement SHALL carry a stacking order in which, from lowest to highest, stock cards lie below
waste cards, waste below foundation cards, and foundation below tableau cards, with later cards of a
pile above earlier ones. A card SHALL be marked buried when it is hidden under another card of the
same stacked pile — every stock card but the top one, every waste card beneath the visible fan, and
every foundation card but the top one; tableau cards are never buried. The layout SHALL also give
the position of each empty-pile slot, of the stock count badge, and the order in which a fresh deal
places its 28 tableau cards (row by row, left to right).

Input-agnostic: pure computation.

*(KS-PERF-01 rendering, R§10, R§12.6; deal order (new))*

#### Scenario: Only the top stock card is not buried

- **WHEN** the stock holds 24 cards
- **THEN** 23 stock cards are buried and the top one is not

#### Scenario: Tableau above top row

- **WHEN** the layout of any position is computed
- **THEN** every tableau card has a higher stacking order than every stock, waste and foundation card

#### Scenario: Deal order

- **WHEN** the deal order of a fresh deal is requested
- **THEN** it lists the 28 tableau cards row by row: the first card of each of the 7 columns, then the
  second card of columns 2 to 7, and so on
