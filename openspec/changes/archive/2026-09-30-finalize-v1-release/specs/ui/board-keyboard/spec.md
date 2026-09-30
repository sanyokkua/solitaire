# Spec Delta

## MODIFIED Requirements

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
being prepared (`app.dealing` non-null). With these bindings, together with the focus, Enter and
Space keys of this capability, every game action is reachable from the keyboard alone: moving focus
between piles and cards, drawing and recycling, moving a card or run to its best target or to a
chosen one, undo, redo, hint, Finish, new deal, pause and resume, cancelling a selection or a drag,
and closing a sheet. So *KS-INP-08* is complete.

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
