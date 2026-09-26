# Spec Delta

## Purpose

Defines what the table shows for any game position — the 52 cards with their faces and backs, the
pile slots and placeholders, the stock states and badge — and how each card and pile is named for
assistive technology.

## ADDED Requirements

### Requirement: One persistent element per card

While the Game screen shows a game, the table SHALL render exactly 52 card elements, one per card,
each identified by its card, in an order that never changes for the life of the screen. A change of
position (a move, a draw, an undo, a redo, a restart or a new deal) SHALL move and restyle these
same elements and SHALL never create, remove or re-order them. Each card SHALL be placed only by a
translation, at the position the layout gives it. While no game exists yet, the table SHALL render
its slots and no cards.

Input-agnostic: rendering only; board input arrives in Phase 6. Motion for these changes is covered
by the board-motion capability, including its no-motion path.

*(KS-PERF-01 rendering, R§10, R§12.2)*

#### Scenario: Elements survive a position change

- **WHEN** the player undoes a move on the Game screen
- **THEN** the 52 card elements present before the undo are the same elements afterwards, in the
  same document order, each at its new position

#### Scenario: Each card is identifiable

- **WHEN** the table is inspected
- **THEN** each of the 52 card elements carries the identity of exactly one card, and no card appears
  twice

### Requirement: Card faces follow the mockup

A face-up card SHALL show, in the top-left corner, its rank and suit symbol on one line in the pixel
typeface, and a large centre suit symbol. Jacks, Queens and Kings SHALL instead show their letter in
a pixel-drawn box in the centre, with no centre suit. While the card is not compact, a copy of the
corner index SHALL appear rotated in the bottom-right corner; compact cards SHALL omit it. Suit
symbols SHALL render as text, never as colour emoji, so each suit keeps its distinct shape in every
palette. Hearts and diamonds SHALL use the red ink and clubs and spades the black ink, unless the
four-colour deck is on. Every size on the face SHALL scale with the card width.

Input-agnostic: rendering only. No animation.

*(KS-A11Y-05; face anatomy from spec §8.2 and the mockup; compact threshold (new))*

#### Scenario: Number card face

- **WHEN** the Seven of Clubs is face up on a card that is not compact
- **THEN** it shows "7♣" in the top-left corner, a large ♣ in the centre and a rotated "7♣" in the
  bottom-right corner, in the black ink

#### Scenario: Court card face

- **WHEN** the Queen of Hearts is face up
- **THEN** it shows "Q♥" in the corner and a boxed "Q" in the centre with no centre suit, in the red
  ink

#### Scenario: Compact card

- **WHEN** cards are compact
- **THEN** no card shows the bottom-right corner index

### Requirement: Card backs

A face-down card SHALL show a two-tone pixel checker in the colours of the selected card back, with a
thin inset rim, and no rank or suit. The checker SHALL keep a fixed pixel size at every card size.

Input-agnostic: rendering only.

*(Card backs from spec §6 and §8.2; back rendering (new))*

#### Scenario: Face-down card hides its identity

- **WHEN** a card is face down
- **THEN** no rank, suit or symbol of that card is visible or exposed to assistive technology

### Requirement: Slots, placeholders and the stock

The table SHALL draw a slot beneath the stock, each foundation and each tableau column, so an empty
pile stays visible; the waste SHALL have no slot. An empty foundation SHALL show a faint "A" and its
suit symbol. An empty column SHALL show a faint "K". The stock slot SHALL show a recycle mark, visible
once the stock is empty. While the stock is empty and the waste cannot be recycled (the waste is
empty, or the Vegas pass limit is reached), the stock slot SHALL be dimmed. While the stock holds at
least one card, a badge SHALL show the number of cards left in it; it SHALL be hidden while the stock
is empty. The badge SHALL be visible at the stock's top-right corner in every layout.

Input-agnostic: rendering only; activating the stock is Phase 6. No animation beyond the badge
following the stock, which follows the no-motion path.

*(KS-MOVE-06 context; placeholders and badge from spec §3.2; spent state (new), from the mockup)*

#### Scenario: Empty foundation placeholder

- **WHEN** the spades foundation is empty
- **THEN** its slot shows a faint "A" and "♠"

#### Scenario: Stock badge

- **WHEN** the stock holds 18 cards
- **THEN** the badge shows 18

#### Scenario: Spent Vegas stock

- **WHEN** a Vegas game has an empty stock and has reached its pass limit
- **THEN** the stock slot shows the recycle mark dimmed and no badge

#### Scenario: Recyclable stock

- **WHEN** a Draw 1 game has an empty stock and a non-empty waste
- **THEN** the stock slot shows the recycle mark at full strength

### Requirement: Shadows and layering

Only a card that is not buried SHALL cast a shadow; buried cards SHALL render without one, so deep
piles do not darken. The table SHALL form its own stacking context, so no card, at any stacking
order, is ever drawn above content outside the table (chrome, sheets, notices).

Input-agnostic: rendering only.

*(R§10, R§12.5, R§12.6)*

#### Scenario: Buried stock cards

- **WHEN** the stock holds several cards
- **THEN** only its top card casts a shadow

#### Scenario: Table content stays inside

- **WHEN** a card's stacking order is higher than that of the chrome
- **THEN** the chrome is still drawn above the table

### Requirement: Accessible names for cards and piles

Every face-up card SHALL be exposed to assistive technology as an image named "<Rank> of <Suit>",
with the rank and suit spelled out and capitalised (for example "Queen of Spades", "Seven of
Clubs"). Every face-down card SHALL be named "Face-down card". Every pile slot SHALL be named with
its pile and card count: "Stock, 18 cards", "Hearts foundation, 2 cards", "Column 3, 5 cards",
using "1 card" for one and "empty" for none (for example "Column 4, empty"). The waste has no slot;
its name arrives with Phase 6 focus.
Decorative parts (corner indices, pips, the recycle mark, the badge) SHALL be hidden from assistive
technology. Names are English until the language catalogs arrive.

Input-agnostic: names are exposed regardless of input; focus handling is Phase 6.

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
