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
Ctrl/⌘+Shift+Z SHALL redo; H SHALL request a hint; A SHALL Finish when it is available; N SHALL
request a new deal exactly as the HUD New deal control does (the New deal options during a started,
unwon game, otherwise an immediate deal); P SHALL pause the game when it is not won; Esc SHALL
cancel a selection or an active drag. Other key combinations SHALL be ignored, and typing in a text
field (such as the deal-code input) SHALL NOT trigger shortcuts. With a sheet open, the board
shortcuts SHALL be ignored: Esc closes the sheet (except the Win sheet), and P SHALL resume when the
open sheet is Paused and do nothing while any other sheet is open.

The board-move shortcuts (undo, redo, hint, Finish, draw, and Esc on a selection) SHALL act only
while board input is accepted (see `features/interaction`). N and P SHALL NOT depend on that input
gate, which is closed on a won game and while a sheet is open: N SHALL act whenever the Game screen
is shown, no deal is being prepared and no sheet is open, so N during the win cascade, before the
Win sheet opens, deals a new game at once; P SHALL follow the pause and resume rules above. N and P
SHALL both be ignored while a safe-card chain or Finish is running (`game.busy`) or while a deal is
being prepared (`app.dealing` non-null). With these bindings every action
of spec §4.8 is reachable from the keyboard, so *KS-INP-08* is complete.

The letter shortcuts SHALL work on any keyboard layout: a Latin letter typed is taken as it is (so
AZERTY and Dvorak follow their labels), and when the layout produces a non-Latin character (for
example Ukrainian) the physical key position (`event.code`, `KeyH`) decides. A held key SHALL act
once: an auto-repeated Space, Enter, letter shortcut or Ctrl/⌘ shortcut is swallowed without
effect (and without scrolling the page), while the arrow and Tab keys keep repeating focus moves.

*(KS-INP-08, KS-AST-02, KS-AST-05, KS-AST-07, KS-DEAL-08, KS-SCO-07)*

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

#### Scenario: New deal key during a game
- **WHEN** a started, unwon game is shown and N is pressed
- **THEN** the New deal options sheet opens

#### Scenario: New deal key on a fresh deal
- **WHEN** no move has been made and N is pressed
- **THEN** a new game in the same mode is dealt at once

#### Scenario: Pause and resume by P
- **WHEN** P is pressed during a game, and then P is pressed again
- **THEN** the Paused sheet opens and the time stops, then the sheet closes and play resumes

#### Scenario: P with another sheet open
- **WHEN** the Settings sheet is open and P is pressed
- **THEN** nothing happens

#### Scenario: N during the cascade of a won game
- **WHEN** a game has just been won, the cascade is running, the Win sheet has not opened yet and N
  is pressed
- **THEN** a new game in the same mode is dealt at once and the Win sheet does not open

#### Scenario: N while dealing
- **WHEN** a deal is being prepared and N is pressed
- **THEN** nothing happens

#### Scenario: N and P while a sequence is running
- **WHEN** a safe-card chain or Finish is running and N or P is pressed
- **THEN** nothing happens

#### Scenario: Typing a deal code
- **WHEN** the deal-code input has focus and the player types "N" or "P"
- **THEN** the letter is typed and no new deal or pause happens

#### Scenario: Non-Latin layout for N and P
- **WHEN** the layout is Ukrainian and the physical P key is pressed during a game
- **THEN** the game is paused

### Requirement: Cards and piles have roles and state for assistive technology
A face-up card the rules allow to move SHALL be exposed as a button named for the card in the active
language ("<Rank> of <Suit>" in English, see `ui/board-render`) whose pressed state shows whether it
is selected. Other face-up cards and face-down cards SHALL stay images with their names. The stock
and every empty column or foundation that can be a target SHALL be exposed as buttons named with
their pile and count. Focusing a card SHALL NOT change the game.

*(KS-A11Y-01, KS-A11Y-03, KS-I18N-01)*

#### Scenario: Movable card role
- **WHEN** a face-up column card can move
- **THEN** it is a button named for the card, not pressed

#### Scenario: Selected card
- **WHEN** a card is selected
- **THEN** its button is pressed

#### Scenario: Face-down card
- **WHEN** a card is face down
- **THEN** it is an image named "Face-down card" and is not focusable
