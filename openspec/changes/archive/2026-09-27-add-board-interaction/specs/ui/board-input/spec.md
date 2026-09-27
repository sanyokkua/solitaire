# Spec Delta

## Purpose

Defines how a player moves cards on the table with a pointer — mouse, touch or pen — through tap,
select and place, double-tap and drag, and how the board tells a tap from a drag.

## ADDED Requirements

### Requirement: Smart tap sends a card to its best place
While the tap setting is Smart move, tapping a movable card SHALL move it, with the cards on it, to
the best legal target: its foundation when it is a single card that fits, otherwise the first
non-empty column it fits scanning to the right of its own column and wrapping, otherwise the first
empty column when it is a King not already at a column's base. When no target exists the card and
the cards on it SHALL shake and nothing SHALL change. A tap on the stock SHALL draw, and a tap on the
empty stock SHALL turn the waste over when the pass limit allows.

Input-agnostic note: this requirement is the tap path; drag and keyboard paths are in the following
requirements and in `ui/board-keyboard`, and all resolve to the same commands.

No-motion path: the shake is replaced by an announcement that the move is not possible.

*(KS-INP-01, KS-MOVE-03, KS-MOVE-04)*

#### Scenario: Tap to a foundation
- **WHEN** an Ace is tapped in smart mode
- **THEN** it moves to its foundation

#### Scenario: Tap a run
- **WHEN** a face-up run that fits a column is tapped
- **THEN** the whole run moves to that column

#### Scenario: No target
- **WHEN** a card with no legal target is tapped
- **THEN** it shakes and the position is unchanged

#### Scenario: Tap the stock
- **WHEN** the stock is tapped
- **THEN** the mode's draw count moves to the waste

#### Scenario: Recycle
- **WHEN** the empty stock is tapped and a recycle is allowed
- **THEN** the waste turns over into the stock

### Requirement: Select and place
While the tap setting is Select and place, tapping a movable card SHALL select it and the cards on
it; tapping a legal target SHALL move the selection there; tapping another movable card that is not a
legal target SHALL change the selection (when the tapped card is itself in a legal target pile, placing
wins); tapping the selected card again or anywhere that is neither, SHALL clear it. A tap
anywhere in a column's area, including the empty part below its last card, SHALL count as a tap on
that column.

Input-agnostic note: drag and keyboard reach the same selection and moves; see their requirements.

*(KS-INP-02, KS-A11Y-04)*

#### Scenario: Select then place
- **WHEN** a movable card is tapped and then a legal column is tapped
- **THEN** the card moves to that column

#### Scenario: Place wins over re-select
- **WHEN** a card is selected and the top card of a column where it may legally go is tapped
- **THEN** the selection moves onto that column

#### Scenario: Change selection
- **WHEN** a card is selected and another movable card is tapped
- **THEN** the second card is selected

#### Scenario: Tap elsewhere
- **WHEN** a card is selected and an illegal spot is tapped
- **THEN** the selection is cleared

#### Scenario: Tap below the last card
- **WHEN** a legal column is tapped below its last card
- **THEN** the selection moves to that column

### Requirement: Double-tap sends a single card home
Two taps on the same card less than 320 ms apart (a double-tap or double-click) SHALL move a single
movable card that fits its foundation there, in either tap setting, as one counted move. The second
tap of a double-tap SHALL NOT repeat, undo or redirect what the first tap did. With the Smart move
setting the second tap is always ignored: the first tap has already sent a fitting single card home
(a foundation is the first choice of the smart move) and any other card keeps the result of its
first tap. With the Select and place setting, a fitting single card moves home and a card that does
not fit is handled as two ordinary taps.

*(KS-INP-03)*

#### Scenario: Double-tap in select mode
- **WHEN** a single card that fits its foundation is double-tapped in select and place mode
- **THEN** it moves to the foundation

#### Scenario: Double-tap in smart mode
- **WHEN** a single card that fits its foundation is double-tapped in smart mode
- **THEN** it is on the foundation after the first tap and the second tap changes nothing

#### Scenario: Second tap after a smart move
- **WHEN** the first tap of a double-tap in smart mode moved a card to a column or foundation
- **THEN** the second tap changes nothing, so the card is not moved back

#### Scenario: Card that does not fit in select mode
- **WHEN** a card that does not fit any foundation is double-tapped in select and place mode
- **THEN** it is treated as ordinary taps

#### Scenario: Window boundary
- **WHEN** two taps on the same card are exactly 320 ms apart
- **THEN** they are two ordinary taps

### Requirement: Drag with a threshold
Pressing a movable card and moving the pointer more than 5 px for a mouse, or 9 px for touch or
pen, SHALL start a drag of that card and all cards on it. The dragged cards SHALL follow the pointer
and stay above every other card. The stock cannot be dragged; the waste's top card, a foundation's
top card and face-up column runs can. Releasing without passing the threshold SHALL be a tap. A
release that ends a drag SHALL NOT be treated as a tap, and the click that follows it SHALL be
ignored.

Input-agnostic: mouse, touch and pen use the same rules with their own threshold.

*(KS-INP-04, KS-INP-07)*

#### Scenario: Mouse threshold
- **WHEN** a mouse presses a card and moves 4 px
- **THEN** no drag starts; at 6 px it does

#### Scenario: Touch threshold
- **WHEN** a finger presses a card and moves 8 px
- **THEN** no drag starts; at 10 px it does

#### Scenario: No tap after a drag
- **WHEN** a drag ends over the cards' origin
- **THEN** no smart tap or selection follows

#### Scenario: Stock is not draggable
- **WHEN** the stock is pressed and dragged
- **THEN** no drag starts

### Requirement: Drop on the largest overlap
While dragging, the legal target whose landing area overlaps the first dragged card the most SHALL
be the emphasised target; a target with no overlap SHALL not qualify. Releasing over a qualifying
target SHALL perform that move; releasing elsewhere, or after Esc, a pointer cancel, a resize or an
input-gate closing, SHALL return the cards to their origin with a glide. Ties resolve to the
lowest-numbered target.

Deterministic: overlap depends only on geometry.

No-motion path: without motion the cards return without a glide.

*(KS-INP-05, KS-INP-06)*

#### Scenario: Drop on a legal column
- **WHEN** a run is released mostly over a legal column
- **THEN** the run moves there

#### Scenario: Drop on nothing
- **WHEN** a card is released over no legal target
- **THEN** it glides back and nothing changes

#### Scenario: Two overlaps
- **WHEN** the dragged card overlaps two legal targets
- **THEN** the one with the larger overlap wins

#### Scenario: Cancelled by resize
- **WHEN** the board is resized during a drag
- **THEN** the drag is cancelled and the cards return

#### Scenario: Cancelled by Esc
- **WHEN** Esc is pressed during a drag
- **THEN** the cards return

### Requirement: The page does not scroll or zoom from the board
Gestures that start on the board SHALL NOT scroll, zoom or select text on the page, and SHALL NOT
open the touch callout or context menu.

Input-agnostic: applies to every pointer type.

*(KS-INP-10)*

#### Scenario: Touch drag
- **WHEN** a finger drags a card on the board
- **THEN** the page does not scroll

### Requirement: Board input is ignored while the gate is closed
Pointer input on the board SHALL be ignored while the input gate of `features/interaction` is
closed. A drag in progress when the gate closes SHALL be cancelled.

*(KS-INP-09)*

#### Scenario: Won game
- **WHEN** the game is won and a card is pressed
- **THEN** nothing happens
