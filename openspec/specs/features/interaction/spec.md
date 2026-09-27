# features/interaction Specification

## Purpose

Holds the short-lived state of playing — what is selected, which hint is showing, what to announce
and which dead ends were already reported — and the actions that create it, so every input path
shares one behaviour. Nothing here is saved.

## Requirements

### Requirement: Selection is a single pile position
The interaction state SHALL hold at most one selection, naming a pile and the index of a card in it.
Selecting SHALL be accepted only for a card or run that the rules allow to move. The selection SHALL
be cleared when the position changes (any accepted command, undo, redo, restart, a new deal, or
clearing the game), when the player cancels it, and when a different selection replaces it.

Input-agnostic: tap, drag start and keyboard all select through the same action, so every path
yields the same selection.

*(KS-INP-02, KS-AST-01)*

#### Scenario: Select a movable run
- **WHEN** a face-up column card that heads a legal run is selected
- **THEN** the selection names that column and card index

#### Scenario: A face-down card cannot be selected
- **WHEN** selecting a face-down card is requested
- **THEN** no selection exists afterwards

#### Scenario: The position changes
- **WHEN** a card is selected and the player undoes a move
- **THEN** the selection is cleared

### Requirement: The input gate closes the board
A selector SHALL report whether board input is accepted. It SHALL be false while a deal is being
prepared, while any sheet is open, while the game is won (which includes the whole win cascade),
while a safe-card chain or Finish is running, when there is no game, and away from the Game route.
Every input path (pointer, keyboard, and the toolbar's Hint and Finish) SHALL consult it, and input
that arrives while it is false SHALL change nothing. Undo and Redo are already unavailable after a
win and during a sequence (`features/game-session`), so the frozen board after a win needs no
further state.

Input-agnostic: one gate for all paths.

*(KS-INP-09, phased-design Phase 6 "ignore board input while dealing")*

#### Scenario: Dealing
- **WHEN** a winnable deal is being prepared and the player taps a card of the previous table
- **THEN** nothing changes

#### Scenario: A sheet is open
- **WHEN** a sheet is open and the player presses a shortcut key
- **THEN** no game action happens

#### Scenario: After a win
- **WHEN** the game is won
- **THEN** the gate is closed and stays closed until a new game is installed

### Requirement: Hints come from the solver line or the heuristic
Requesting a hint SHALL first ask for the position's advice: when it is a dead end, the player SHALL
be told so through the dead-end notice and no hint SHALL be shown. Otherwise the hint SHALL be the
first move of the solver's winning line where the deal service supplies one within its budget
(Draw 1 and Daily), and the heuristic hint otherwise. The hint SHALL name the source cards and the
target pile, or the stock when the best move is to draw or recycle. A hint SHALL be shown for about
2 seconds, described in text, and then cleared; it SHALL also be cleared by the next pointer press,
undo, redo, a new position or a new deal. A hint that arrives after the position or the game changed
SHALL be dropped. A hint SHALL cost no score and no move and SHALL NOT change the game.

Deterministic: the same position gives the same heuristic hint; a solver hint is the solver's
first command.

*(KS-AST-02, KS-AST-03)*

#### Scenario: Draw 1 uses the solver line
- **WHEN** a hint is requested in a winnable Draw 1 position and the solver answers in time
- **THEN** the hint's source and target are the first move of that line

#### Scenario: Heuristic fallback
- **WHEN** a hint is requested in Draw 3, or the solver does not answer in time
- **THEN** the heuristic hint is shown

#### Scenario: Draw from the stock
- **WHEN** the best advice is to draw
- **THEN** the hint names the stock

#### Scenario: A stale hint is dropped
- **WHEN** the player moves while a hint request is pending
- **THEN** no hint is shown when it arrives

#### Scenario: A hint expires
- **WHEN** a hint has been shown for about 2 seconds
- **THEN** it is cleared

### Requirement: The dead end is reported once per position
After the position settles following a player command or a Finish (not after undo or redo), the
system SHALL check for a dead end. When there is one and it was not already reported for that
position, it SHALL raise the dead-end notice once. Returning to a reported position later SHALL NOT
raise it again in the same game. Starting or restarting a game SHALL forget the reported positions.
The game stays open for Undo.

Deterministic: position identity depends only on the piles.

*(KS-AST-06)*

#### Scenario: First time
- **WHEN** a move leaves a position with no productive move
- **THEN** the dead-end notice is raised once

#### Scenario: Same position again
- **WHEN** undo and a replay of the same move return to that position
- **THEN** the notice is not raised a second time

#### Scenario: Restart forgets
- **WHEN** the deal is restarted and the same dead end is reached
- **THEN** the notice is raised again

### Requirement: Announcements describe what happened
Every accepted move, draw, recycle, undo, redo, hint, refused move, refused recycle and the win SHALL
produce an announcement carrying its facts (cards, source pile, target pile, counts) rather than
text. Announcements produced close together (a move and the dead end it causes, a Finish and the win)
SHALL all be kept and spoken; a later one SHALL NOT overwrite an earlier one. A safe-card chain or Finish SHALL produce one summary announcement (the number of cards sent to the
foundations) when it ends, not one per step, so assistive technology is not flooded. A refused move
SHALL announce that the move is not possible.

*(KS-A11Y-02, KS-MOVE-05)*

#### Scenario: A move
- **WHEN** the Seven of Clubs moves to column 4
- **THEN** an announcement carrying that card, its source and column 4 is produced

#### Scenario: A Finish
- **WHEN** Finish sends 20 cards home
- **THEN** one announcement carrying the count 20 is produced when it ends

#### Scenario: A Finish that wins
- **WHEN** Finish sends the last cards home and the game is won
- **THEN** the summary announcement and the win announcement are both produced

#### Scenario: A move that ends in a dead end
- **WHEN** a move leaves a dead end
- **THEN** the move's announcement and the dead-end announcement are both produced

#### Scenario: A refused recycle
- **WHEN** a Vegas recycle beyond the pass limit is refused
- **THEN** a refusal announcement and the "No redeals left" notice are produced
