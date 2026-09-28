# Spec Delta

## MODIFIED Requirements

### Requirement: Accessible names for cards and piles

Every card and pile name SHALL come from the active language and SHALL change at once when the
language changes. Every face-up card SHALL be exposed to assistive technology with its full rank and
suit name, capitalised as that language writes it (for example "Queen of Spades" and "Seven of
Clubs" in English, "Дама пік" in Ukrainian): as an image, or as a button when the rules allow it to
move (see `ui/board-keyboard`). Every face-down card SHALL be an image named for a face-down card
("Face-down card" in English). Every pile slot SHALL be named with its pile and card count, with the
count in the plural form the language requires: "Stock, 18 cards", "Hearts foundation, 2 cards",
"Column 3, 5 cards" in English, using "1 card" for one and "empty" for none (for example "Column 4,
empty"). The waste has no slot; its top card is named like any card.
Decorative parts (corner indices, pips, the recycle mark, the badge) SHALL be hidden from assistive
technology.

Input-agnostic: names are exposed regardless of input; focus handling is in `ui/board-keyboard`.

*(KS-A11Y-01, KS-I18N-01; foundation, one-card and empty-pile names (new))*

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

#### Scenario: Ukrainian card name

- **WHEN** the language is Ukrainian and the Queen of Spades is face up
- **THEN** its accessible name is "Дама пік"

#### Scenario: Ukrainian plural counts

- **WHEN** the language is Ukrainian and columns hold 1, 3 and 5 cards
- **THEN** each column's name uses the Ukrainian one, few and many form for its count

#### Scenario: Language switch

- **WHEN** the language changes from English to Ukrainian during a game
- **THEN** every card and pile name is in Ukrainian without a reload
