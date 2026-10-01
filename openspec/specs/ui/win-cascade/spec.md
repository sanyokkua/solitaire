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

*(KS-MOVE-07, KS-SET-04)*

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
installed or the game is cleared. Until the Win sheet opens, exactly these controls stay live: Back
to Home, New deal (the HUD button and N, both of which deal a new game at once on a won game),
Settings and the theme toggle. Undo, Redo, Hint, Finish, Time (and P) and the board are ignored for
the whole cascade. Once the Win sheet opens, the sheet makes the screen behind it inert and the N
shortcut ignores keys while a sheet is open, so from then on the Win sheet's Deal again and Menu are
the only ways out. If a sheet such as Settings was opened during the cascade and is still showing
when the Win sheet's delay ends, the Win sheet replaces it. The browser remains usable throughout.

*(KS-INP-09)*

#### Scenario: Press during the cascade
- **WHEN** a card is pressed while the cascade runs
- **THEN** nothing happens

#### Scenario: Back to Home before the Win sheet
- **WHEN** the cascade runs, the Win sheet has not opened yet and the player activates Back to Home
- **THEN** Home is shown and the Win sheet does not open

#### Scenario: Win sheet replaces a sheet opened during the cascade
- **WHEN** Settings is opened during the cascade and is still open when the Win sheet's delay ends
- **THEN** the Win sheet replaces Settings

### Requirement: The Win sheet follows the cascade

When a game is won, the Win sheet SHALL open about 2.4 s after the last card reaches its foundation,
over the cascade, which keeps running behind it. With motion off (no cascade) it SHALL open at once.
It SHALL NOT open if a new deal replaced the game, or the game was cleared, before the delay ended,
and leaving the Game screen before then SHALL cancel it. The sheet's content, focus handling and
controls are defined by `ui/sheets`; the sheet cannot be dismissed by Escape or the backdrop.

Input-agnostic: triggered by the win, whatever input produced it.

No-motion path: with motion off the sheet opens immediately, without the cascade.

*(KS-MOVE-07, KS-SET-04, KS-A11Y-03)*

#### Scenario: Sheet over the cascade

- **WHEN** a game is won with motion on
- **THEN** the Win sheet opens about 2.4 s later while the cards are still flying

#### Scenario: Motion off

- **WHEN** a game is won with motion off
- **THEN** the Win sheet opens at once

#### Scenario: A new deal first

- **WHEN** a game is won and a new deal is installed within 2.4 s
- **THEN** the Win sheet does not open
