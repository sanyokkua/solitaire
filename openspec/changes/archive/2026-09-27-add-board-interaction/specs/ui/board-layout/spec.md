# Spec Delta

## ADDED Requirements

### Requirement: Landing areas
For any position the layout SHALL give a landing rectangle for each foundation, each column, the
stock and the waste. A foundation's, the stock's and the waste's rectangle is its slot (for the
waste, its anchor, which the layout SHALL expose). A column's rectangle has the column's card width
and spans from the top of the tableau area down to 1.2 card heights below the position where the
next card would land on that column (an empty column: 1.2 card heights from the top of its slot), clipped to the board rectangle, so
that a tap or drop anywhere in the column's area, including the empty part below its last card,
counts for that column. A function SHALL choose, from a dragged rectangle and a set of candidate
targets, the target with the largest overlap area (none when every overlap is zero), resolving ties
to the lowest-numbered target. All of this is a pure, deterministic function of the position, the
metrics and the stock-side flag, at every supported board size.

Input-agnostic: pure computation used by pointer, keyboard placement and hint visuals.

*(KS-INP-05, KS-INP-06, KS-A11Y-04, R§8)*

#### Scenario: Foundation area
- **WHEN** landing areas are computed
- **THEN** each foundation's rectangle equals its slot

#### Scenario: Column area
- **WHEN** a column holds 5 cards
- **THEN** its rectangle ends 1.2 card heights below the top of the position where a sixth card would
  go

#### Scenario: Clipped to the board
- **WHEN** a long column's rectangle would extend past the board's bottom edge
- **THEN** it ends at the board's bottom edge

#### Scenario: Empty column
- **WHEN** a column is empty
- **THEN** its rectangle starts at its slot's top and is 1.2 card heights tall

#### Scenario: Stock and waste
- **WHEN** landing areas are computed
- **THEN** the stock's rectangle equals its slot and the waste's equals its anchor

#### Scenario: Largest overlap
- **WHEN** a dragged rectangle overlaps two targets by 40% and 60% of its area
- **THEN** the second is chosen

#### Scenario: No overlap
- **WHEN** a dragged rectangle overlaps no candidate
- **THEN** none is chosen

#### Scenario: Tie
- **WHEN** a dragged rectangle overlaps two targets equally
- **THEN** the lower-numbered one is chosen

#### Scenario: Mirror
- **WHEN** Stock on the right is on
- **THEN** every area is mirrored with its slot
