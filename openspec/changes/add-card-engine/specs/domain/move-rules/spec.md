# Spec Delta

## Purpose

Which cards may be picked up, where they may be placed, the order in which the domain scans piles,
when the stock may be turned over again, and when the game is won.

## ADDED Requirements

### Requirement: Movable groups

The system SHALL determine, for a pile and a position in it, which cards would move together:
- From a tableau column: a face-up card and every card above it, including a partial run, provided
  those cards descend by one rank in alternating colours. A face-down card SHALL never be movable.
- From the waste: only the topmost card.
- From a foundation: only the topmost card.
- From the stock: nothing.
- A position outside the pile SHALL yield nothing rather than fail.

Input-agnostic: tap, drag and keyboard all resolve a grab through this rule. Deterministic: the same
position, pile and index always yield the same group. *(KS-MOVE-01, KS-MOVE-06)*

#### Scenario: A face-up tableau run moves as a unit

- **WHEN** a face-up card partway up a column is grabbed
- **THEN** that card and every card above it form the group

#### Scenario: Cards that are not a valid run are not movable

- **WHEN** a face-up card is grabbed whose cards above it do not descend by one rank in alternating
  colours
- **THEN** no group is produced

#### Scenario: Face-down cards are not movable

- **WHEN** a face-down tableau card is grabbed
- **THEN** no group is produced

#### Scenario: Only the top of the waste is playable

- **WHEN** any waste card other than the topmost is grabbed
- **THEN** no group is produced

#### Scenario: Only the top of a foundation is playable

- **WHEN** any foundation card other than the topmost is grabbed
- **THEN** no group is produced, and grabbing the topmost card yields that card alone

#### Scenario: The stock is never grabbed

- **WHEN** a stock card is grabbed
- **THEN** no group is produced

#### Scenario: A position outside the pile yields nothing

- **WHEN** a position beyond the end of a pile, or before its start, is grabbed
- **THEN** no group is produced and the request does not fail abruptly

### Requirement: Legal tableau and foundation drops

The system SHALL permit exactly these placements and reject all others:
- Onto a non-empty tableau column: the group's lowest card is one rank below, and of the opposite
  colour to, the column's topmost card.
- Onto an empty tableau column: the group's lowest card is a King.
- Onto a foundation: a single card of that foundation's suit whose rank is one above the
  foundation's height (an Ace onto an empty foundation). Foundation slots are fixed by suit.
- A foundation's top card MAY return to a tableau column under the tableau rule.
- Foundation to foundation SHALL never be permitted, nor a drop onto the group's own source pile.

The system SHALL list every legal destination for a group in the canonical destination order (see
"Canonical scan order"). Input-agnostic: every input path consults this rule. Deterministic: the same
position and group always yield the same verdict and destinations. *(KS-MOVE-01, KS-AST-01)*

#### Scenario: Tableau builds down in alternating colours

- **WHEN** a group is tested against a non-empty column
- **THEN** it is accepted only if its lowest card is one rank below and the opposite colour of that
  column's topmost card

#### Scenario: Only a King enters an empty column

- **WHEN** a group is tested against an empty column
- **THEN** it is accepted only if its lowest card is a King

#### Scenario: Foundations build up by suit from the Ace

- **WHEN** a card is tested against a foundation
- **THEN** it is accepted only if it is a single card of that foundation's suit whose rank is one
  above the cards already there, and an Ace is accepted onto an empty foundation

#### Scenario: Foundation to foundation is refused

- **WHEN** a foundation's topmost card is tested against another foundation
- **THEN** it is refused

#### Scenario: Legal destinations are reported

- **WHEN** the legal destinations for a group are requested
- **THEN** every pile that would accept it is listed in the canonical destination order, and the
  group's own source pile is not

### Requirement: Canonical scan order

Every scan in the domain layer, except the smart-tap target choice, SHALL use these orders:
- **Sources:** tableau columns 0→6, then the waste top. Within one column, candidate groups are
  taken from the one nearest the column's base upward.
- **Destinations:** the four foundations in suit-encoding order (hearts, diamonds, clubs, spades),
  then tableau columns 0→6.

Input-agnostic: an ordering convention. Deterministic: the same position always yields the same
ordered candidates. *(new)*

#### Scenario: Destinations are reported foundation-first, then by column

- **WHEN** a single card is accepted by its foundation and by tableau columns 5 and 2
- **THEN** its legal destinations are listed as the foundation, then column 2, then column 5

### Requirement: Stock passes and recycling

The system SHALL track the pass through the stock in progress, starting at 1. Recycling — turning an
exhausted stock back over from the waste — SHALL begin the next pass and SHALL be permitted only when
the stock is empty, the waste is not, and the pass in progress is below the mode's pass limit. The
pass limit SHALL be 3 for Vegas (two recycles allowed, the third refused) and unlimited for every
other mode. Input-agnostic: every input path reaching the stock consults it. Deterministic: the same
position always yields the same verdict. *(KS-MOVE-04, KS-MOVE-05)*

#### Scenario: Standard modes recycle without limit

- **WHEN** a Standard game with an exhausted stock and a non-empty waste is tested, at any pass
  count
- **THEN** recycling is permitted

#### Scenario: Vegas refuses the pass beyond its limit

- **WHEN** a Vegas game with an exhausted stock and a non-empty waste is tested on its first and
  second pass and again on its third
- **THEN** recycling is permitted on the first two and refused on the third

#### Scenario: Recycling needs cards to recycle

- **WHEN** a game with an exhausted stock and an empty waste is tested
- **THEN** recycling is refused

### Requirement: Win detection

A position SHALL be won exactly when each of the four foundations holds 13 cards. Input-agnostic: a
predicate over a position. Deterministic: the same position always yields the same verdict.
*(KS-MOVE-07)*

#### Scenario: All four foundations complete

- **WHEN** every foundation holds 13 cards
- **THEN** the position is won

#### Scenario: Any incomplete foundation

- **WHEN** at least one foundation holds fewer than 13 cards
- **THEN** the position is not won
