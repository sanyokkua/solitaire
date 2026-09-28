# Spec Delta

## MODIFIED Requirements

### Requirement: Accessible names for cards and piles

Every face-up card SHALL be exposed to assistive technology with the name "<Rank> of <Suit>", with
the rank and suit spelled out and capitalised (for example "Queen of Spades", "Seven of Clubs"): as
an image, or as a button when the rules allow it to move (see `ui/board-keyboard`). Every face-down
card SHALL be an image named "Face-down card". Every pile slot SHALL be named with its pile and card
count: "Stock, 18 cards", "Hearts foundation, 2 cards", "Column 3, 5 cards", using "1 card" for one
and "empty" for none (for example "Column 4, empty"). The waste has no slot; its top card is named
like any card.
Decorative parts (corner indices, pips, the recycle mark, the badge) SHALL be hidden from assistive
technology. Names are English until the language catalogs arrive.

Input-agnostic: names are exposed regardless of input; focus handling is in `ui/board-keyboard`.

*(KS-A11Y-01; foundation, one-card and empty-pile names (new))*

#### Scenario: Face-up card name

- **WHEN** the Queen of Spades is face up
- **THEN** its accessible name is "Queen of Spades"

#### Scenario: Face-down card name

- **WHEN** a card is face down
- **THEN** its accessible name is "Face-down card"

#### Scenario: Pile names

- **WHEN** the stock holds 18 cards and column 3 is empty
- **THEN** the stock is named "Stock, 18 cards" and column 3 is named "Column 3, empty"

#### Scenario: Movable card is a button

- **WHEN** a face-up column card can move
- **THEN** it is exposed as a button with the same name
