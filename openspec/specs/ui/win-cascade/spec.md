# ui/win-cascade Specification

## Purpose

Defines the celebration that plays when the last card reaches its foundation, and how it interacts
with input.

## Requirements

### Requirement: The cascade plays on a win
When the last card reaches its foundation, the 52 cards SHALL fly off the foundations one after
another — kings first, then down to aces, each rank in the order hearts, clubs, diamonds, spades —
bouncing off the bottom edge and leaving through the sides, staggered by 70 ms. Each card's path
SHALL depend only on its start position, the board size, the card size and a random source that can be replaced by a
fixed one, so a fixed source gives the same paths; the start positions come from the layout, which depends only on the
board size. The cards stay where they end until the next deal, which cancels
the cascade. The cascade SHALL animate only movement and opacity.

No-motion path: with motion off, there is no cascade and the win is announced immediately.

*(KS-MOVE-07, spec §4.6, KS-SET-04)*

#### Scenario: Cascade order
- **WHEN** the cascade starts
- **THEN** the first card to fly is the King of hearts and the last is the Ace of spades

#### Scenario: Fixed source
- **WHEN** paths are generated twice from the same fixed source and size
- **THEN** they are identical

#### Scenario: Next deal
- **WHEN** a new deal starts during a cascade
- **THEN** the cascade is cancelled and the cards return to the deal

#### Scenario: Motion off
- **WHEN** motion is off and the game is won
- **THEN** no card animates and "You win" is announced

### Requirement: Input is ignored during the cascade
While the cascade runs, board input and the game actions SHALL be ignored. The game is won for the
whole cascade, so the input gate of `features/interaction` is already closed and Undo and Redo are
already unavailable; the cascade needs no state of its own and is cancelled when a new game is
installed or the game is cleared. The Win sheet arrives in Phase 7; until then Back to Home and the
browser remain usable.

*(KS-INP-09)*

#### Scenario: Press during the cascade
- **WHEN** a card is pressed while the cascade runs
- **THEN** nothing happens
