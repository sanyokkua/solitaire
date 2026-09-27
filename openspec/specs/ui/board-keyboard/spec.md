# ui/board-keyboard Specification

## Purpose

Defines how the whole game is played from the keyboard alone: where focus goes, how a card is
picked up and placed, and the shortcut keys, with roles and names for assistive technology.

## Requirements

### Requirement: Focus moves between piles and cards
The board SHALL offer one tab stop per pile (stock, waste, four foundations, seven columns) in that
visual order, mirrored when Stock on the right is on. An empty waste has nothing to focus and is
skipped; every other pile, including an empty foundation or column, is a stop. Tab and Shift+Tab SHALL move between piles and
SHALL leave the board past the first and last pile. Left and Right arrows SHALL move focus between
piles; Up and Down SHALL move between the face-up cards of a column. Focus SHALL never rest on a
face-down card. Each pile's stop SHALL remember its last focused card while that card still exists.
A visible focus indicator SHALL mark the focused card or empty pile.

Input-agnostic: this is the keyboard path itself.

*(KS-INP-08, KS-A11Y-03)*

#### Scenario: Tab between piles
- **WHEN** focus is on the stock, the waste holds cards, and Tab is pressed
- **THEN** focus moves to the waste

#### Scenario: Empty waste skipped
- **WHEN** focus is on the stock, the waste is empty, and Tab is pressed
- **THEN** focus moves to the first foundation

#### Scenario: Arrow within a column
- **WHEN** focus is on a column card and Up is pressed
- **THEN** focus moves to the face-up card above it, or stays on the topmost

#### Scenario: Stock on the right
- **WHEN** Stock on the right is on and Right is pressed on the leftmost foundation
- **THEN** focus moves to the next pile in mirrored order

#### Scenario: Leaving the board
- **WHEN** focus is on the last pile and Tab is pressed
- **THEN** focus leaves the board to the next page control

### Requirement: Enter and Space act as a tap
Enter or Space on a focused card SHALL do what a tap on it does under the current tap setting: a
smart move (or a shake and announcement when none exists), or select, place or clear. On the focused
stock they SHALL draw or recycle; on a focused empty column or foundation while a selection exists
they SHALL place it. Space with nothing on the board focused SHALL draw from the stock.

Shift+Enter or Shift+Space on a focused movable card SHALL select it and the cards on it in either
tap setting, so a keyboard player can choose any legal target under Smart move too. While a selection
exists, Enter or Space on a focused pile or card SHALL place the selection there when legal and
otherwise follow the Select and place rules (change or clear the selection), whichever the tap
setting; Shift+Enter on the selected card clears it.

*(KS-INP-08, KS-MOVE-03)*

#### Scenario: Smart move by keyboard
- **WHEN** a movable card is focused and Enter is pressed in smart mode
- **THEN** it moves to its best target

#### Scenario: Place by keyboard
- **WHEN** a card is selected, a legal column is focused and Enter is pressed
- **THEN** the selection moves there

#### Scenario: Choose a target in smart mode
- **WHEN** the tap setting is Smart move, a card is focused and Shift+Enter is pressed, then focus moves
  to a legal column that is not the best target and Enter is pressed
- **THEN** the card moves to that column

#### Scenario: Clear by keyboard
- **WHEN** a card is selected and Shift+Enter is pressed on it
- **THEN** the selection is cleared

#### Scenario: Draw
- **WHEN** nothing is focused and Space is pressed
- **THEN** the stock draws

### Requirement: Shortcuts
While the Game screen is shown and no sheet is open: Ctrl/⌘+Z SHALL undo; Ctrl/⌘+Y and
Ctrl/⌘+Shift+Z SHALL redo; H SHALL request a hint; A SHALL Finish when it is available; Esc SHALL
cancel a selection or an active drag. Other key combinations SHALL be ignored, and typing in a text
field SHALL NOT trigger shortcuts. The N (New deal) and P (Pause) keys are recognised but bound only
when their sheets exist (Phase 7); until then they do nothing, and *KS-INP-08* is complete at that
point. With a sheet open, only Esc (closing the sheet) applies.

The letter shortcuts SHALL work on any keyboard layout: a Latin letter typed is taken as it is (so
AZERTY and Dvorak follow their labels), and when the layout produces a non-Latin character (for
example Ukrainian) the physical key position (`event.code`, `KeyH`) decides. A held key SHALL act
once: an auto-repeated Space, Enter, letter shortcut or Ctrl/⌘ shortcut is swallowed without
effect (and without scrolling the page), while the arrow and Tab keys keep repeating focus moves.

*(KS-INP-08, KS-AST-02, KS-AST-05, KS-AST-07)*

#### Scenario: Undo and redo
- **WHEN** Ctrl+Z and then Ctrl+Shift+Z are pressed
- **THEN** the last move is undone and re-applied

#### Scenario: Hint key
- **WHEN** H is pressed
- **THEN** a hint is requested

#### Scenario: Finish unavailable
- **WHEN** A is pressed and Finish is not available
- **THEN** nothing happens

#### Scenario: Esc cancels
- **WHEN** a card is selected and Esc is pressed
- **THEN** the selection is cleared

#### Scenario: Sheet open
- **WHEN** a sheet is open and H is pressed
- **THEN** no hint is requested

#### Scenario: Non-Latin layout
- **WHEN** the layout is Ukrainian and the physical H key (which types "р") is pressed
- **THEN** a hint is requested

#### Scenario: Held key
- **WHEN** H or Space is held down so that the key auto-repeats
- **THEN** the hint or the draw happens once, on the first press

### Requirement: Cards and piles have roles and state for assistive technology
A face-up card the rules allow to move SHALL be exposed as a button named "<Rank> of <Suit>" whose
pressed state shows whether it is selected. Other face-up cards and face-down cards SHALL stay
images with their names. The stock and every empty column or foundation that can be a target SHALL
be exposed as buttons named with their pile and count. Focusing a card SHALL NOT change the game.

*(KS-A11Y-01, KS-A11Y-03)*

#### Scenario: Movable card role
- **WHEN** a face-up column card can move
- **THEN** it is a button named for the card, not pressed

#### Scenario: Selected card
- **WHEN** a card is selected
- **THEN** its button is pressed

#### Scenario: Face-down card
- **WHEN** a card is face down
- **THEN** it is an image named "Face-down card" and is not focusable
