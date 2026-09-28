# features/game-session Specification

## Purpose

Holds the game in progress around the pure engine: starting and replacing deals, applying player
commands, undo and redo history, the safe-card chain, finishing, restarting, and keeping settings
from changing a game that has already started.

## Requirements

### Requirement: Starting a game installs a fresh deal

Starting a game SHALL request a deal for a named mode, passing the current "Winnable deals only"
setting, and SHALL install the delivered deal as the current game with empty undo and redo history
and no undo charges.

While a deal is being prepared, the dealing progress (the attempt being tried and whether the
overlay is due) SHALL be available to the interface. It SHALL be cleared once the deal settles.

A newer start SHALL supersede an older one that has not been delivered yet. A superseded or
cancelled start SHALL leave the current game, its history and every statistic unchanged.

Input-agnostic: a start is requested from Home's Deal cards, the New deal control, the N shortcut and
the Win sheet's Deal again; the same command is issued from every one of them.

Deterministic: the installed game is exactly the deal the deal service delivers; the state layer
adds no randomness.

*(KS-DEAL-03, KS-DEAL-04, KS-SET-06)*

#### Scenario: A delivered deal becomes the current game

- **WHEN** a Draw 3 game is started and the deal service delivers a deal
- **THEN** that deal is the current game, in Draw 3, with no undo or redo steps, and the dealing
  progress is cleared

#### Scenario: A newer start wins

- **WHEN** a Draw 1 start is still being prepared and a Vegas start is requested
- **THEN** only the Vegas deal is installed, and the Draw 1 request changes nothing

#### Scenario: Dealing progress is exposed while a winnable deal is prepared

- **WHEN** a winnable Draw 1 deal takes longer than the overlay delay to prepare
- **THEN** the dealing progress reports the overlay as due with the current attempt number until the
  deal is installed

### Requirement: Player commands advance the game

A player command SHALL be applied to the current game through the rules engine. An accepted command
SHALL become the current game and SHALL record one undo step holding the position before it. A
rejected command SHALL change nothing: no position, history, clock or statistic.

Every play SHALL report whether the command was accepted and, either way, the events the rules
engine produced for it (including the refusal reason of a rejected command), so that callers can
announce the result, shake a refused card or show "No redeals left". A safe-card send or a finish
step SHALL report its events through the same path as it commits.

Commands SHALL be ignored while no game is in progress, while the game is won, and while a
system-driven sequence (the safe-card chain or finishing) is running.

Input-agnostic: tap, drag and keyboard input all resolve to the same command before it reaches this
layer, so every input path gets identical results.

Deterministic: the same deal and the same command sequence always produce the same game.

*(KS-AST-07, KS-INP-09, KS-A11Y-02, KS-MOVE-05)*

#### Scenario: An accepted move records one undo step

- **WHEN** a legal move is played on a fresh deal
- **THEN** the game shows the move's result and exactly one undo step exists

#### Scenario: A rejected move changes nothing

- **WHEN** an illegal move is played
- **THEN** the game, its undo and redo history and its statistics are unchanged

#### Scenario: A rejected move reports why

- **WHEN** a Vegas recycle beyond the pass limit is played
- **THEN** the report says the command was refused with the reason "pass-limit"

#### Scenario: An accepted move reports its events

- **WHEN** a move that turns a card face up is played
- **THEN** the report lists the move and the flip

#### Scenario: Commands are ignored after a win

- **WHEN** a command is played on a won game
- **THEN** nothing changes

### Requirement: Undo restores the position before the last player move

Undo SHALL restore the exact position that preceded the last player command, including every
automatic follow-up it caused (turned-over cards and safe-card moves). The restored position's
cards, move score, move count and pass count SHALL be those it had before the command, so the undone
command's points are reversed exactly.

Each undo SHALL add one undo charge to the game. Elapsed play time, the started flag and the undo
charges SHALL NOT be rewound by undo.

Undo SHALL be unavailable when there is nothing to undo, after the game is won, and while a
system-driven sequence is running.

Input-agnostic: the undo command is the same for every input path (each wired by
`src/ui/board/useGameShortcuts.ts` and the Toolbar).

Deterministic: the same history always restores the same position.

*(KS-AST-07, KS-SCO-03, KS-SCO-05)*

#### Scenario: Undo returns the turned-over card

- **WHEN** a move exposes and turns over a face-down card and the player undoes
- **THEN** the moved cards are back in their column, the exposed card is face down again, and the
  move score and move count are those from before the move

#### Scenario: Undo removes the safe-card chain with the move

- **WHEN** a move triggers two automatic safe-card moves and the player undoes once
- **THEN** the position from before the move is restored, with both safe cards back where they were

#### Scenario: Undo does not rewind time or charges

- **WHEN** the player undoes twice after 40 seconds of play
- **THEN** the elapsed time is still 40 seconds, the game is still started, and two undo charges are
  recorded

#### Scenario: Undo is unavailable after a win

- **WHEN** the game has been won
- **THEN** undo is unavailable and requesting it changes nothing

### Requirement: Redo re-applies an undone move until a new move is made

Redo SHALL re-apply the most recently undone step, restoring the position that followed it,
including its automatic follow-ups. Redo SHALL NOT remove an undo charge. An accepted new command
after one or more undos SHALL discard every redo step.

Redo SHALL be unavailable when there is nothing to redo, after the game is won, and while a
system-driven sequence is running.

Input-agnostic: the redo command is the same for every input path.

Deterministic: redo reproduces exactly the position that was undone.

*(KS-AST-07, KS-AST-08)*

#### Scenario: Redo restores the undone move

- **WHEN** the player undoes a move and then redoes
- **THEN** the position after the move is restored and the undo charge remains

#### Scenario: A new move clears redo

- **WHEN** the player undoes twice and then plays a legal move
- **THEN** no redo steps remain

### Requirement: Undo history has no in-memory limit

Undo SHALL reach back to the start of the deal for as long as the game stays in memory. Only the
stored copy of the history is limited (see the persistence capability).

Input-agnostic: no interaction.

*(KS-AST-07, KS-PER-01)*

#### Scenario: Undo reaches the deal after 250 moves

- **WHEN** 250 accepted commands are played and then undone one by one
- **THEN** every undo succeeds and the final position is the original deal, apart from elapsed time,
  the started flag and undo charges

### Requirement: Safe cards chain to the foundations inside the move's step

While "Auto-move safe cards" is on, after each accepted player command the system SHALL move safe
cards to the foundations one at a time, each as a system-initiated send, until none remains. The
steps SHALL be spaced 160 ms apart, or applied without spacing while reduced motion is in effect. The
whole chain SHALL belong to the undo step of the command that caused it.

The chain SHALL NOT start when the setting is switched on, after undo or after redo. It SHALL stop
at its next step if the setting is switched off, if the game is won, or if the game is replaced or
reset.

Input-agnostic: system-initiated after any accepted command, whatever input produced it.

Deterministic: the same position always yields the same chain of sends.

No-motion path: with reduced motion the sends are committed without spacing; animating them belongs
to Phase 5.

*(KS-AST-04, KS-SET-04)*

#### Scenario: Safe cards follow a move one by one

- **WHEN** "Auto-move safe cards" is on and a move leaves two safe cards exposed
- **THEN** both are sent to the foundations one after the other, and a single undo step covers the
  move and both sends

#### Scenario: The setting alone does not move cards

- **WHEN** "Auto-move safe cards" is switched on while safe cards are exposed
- **THEN** nothing moves until the next accepted command

#### Scenario: Reduced motion removes the spacing

- **WHEN** reduced motion is in effect and a move leaves safe cards exposed
- **THEN** the whole chain is committed without waiting between sends

#### Scenario: A new deal stops a running chain

- **WHEN** a new game is installed while a chain is between steps
- **THEN** no further send is applied, to either game

### Requirement: Finishing plays every remaining card home

Finishing SHALL be available exactly when the game is not won, no system-driven sequence is running,
and a finish plan exists. Finishing SHALL apply the plan's commands one at a time, spaced 75 ms
apart, or without spacing while reduced motion is in effect. Its draws and recycles are scored,
counted and pass-limited like the player's. The whole sequence SHALL be one undo step, and it SHALL
stop if the game is replaced or reset.

Input-agnostic: the finish command is the same for every input path (its control is the Toolbar's
Finish button and the A shortcut).

Deterministic: the same position always yields the same finishing sequence and final score.

No-motion path: with reduced motion the steps are committed without spacing.

*(KS-AST-05, KS-SET-04)*

#### Scenario: Finish wins the game

- **WHEN** every tableau card is face up and the player finishes
- **THEN** the game is won, and its score includes every draw and recycle the plan made

#### Scenario: Finish is unavailable with a face-down card

- **WHEN** a tableau card is still face down
- **THEN** finishing is unavailable and requesting it changes nothing

### Requirement: Restart replays the same deal

Restarting SHALL deal the current game's seed again in the same mode, keeping its deal provenance
(verdict and attempt count) and its Daily date, without asking the solver. Score, moves, elapsed
time, undo charges and undo and redo history SHALL be reset.

Input-agnostic: the restart command is the same for every input path (its control is Restart this
deal in the New deal options, operable by pointer and keyboard).

Deterministic: a restart always reproduces the identical layout.

*(KS-DEAL-08)*

#### Scenario: Restart gives the identical layout

- **WHEN** the player restarts a Draw 1 game after 10 moves
- **THEN** the layout equals the original deal, with no moves, no time, no undo charges and no
  history, and the deal code is unchanged

### Requirement: A game is resumable once started

A game SHALL be resumable exactly while it is started and not won. Leaving the Game screen SHALL
keep it resumable.

Input-agnostic: a property of the game state.

*(KS-GEN-04, KS-PER-02)*

#### Scenario: A fresh deal is not resumable

- **WHEN** a game has been dealt but no command has been accepted
- **THEN** it is not resumable

#### Scenario: A won game is not resumable

- **WHEN** the game is won
- **THEN** it is not resumable

### Requirement: Settings never change a game in progress

Changing any setting SHALL NOT change the current game's mode, draw count, scoring rules, deal or
position. The mode and "Winnable deals only" are read only when a new game is started. "Auto-move
safe cards" is read after each accepted command.

Input-agnostic: settings are values, however they are changed.

*(KS-SET-06)*

#### Scenario: Changing the selected mode mid-game

- **WHEN** the selected mode changes from Draw 1 to Vegas during a Draw 1 game
- **THEN** the current game still draws one card under Standard scoring

#### Scenario: Restart ignores the settings

- **WHEN** the selected mode or "Winnable deals only" changes and the player restarts
- **THEN** the restarted game uses the original seed, mode and provenance

### Requirement: Finish availability is stable across clock ticks
Whether Finish is available SHALL depend only on the piles and the session's busy state, never on
elapsed time. While the clock ticks and the piles do not change, the finish plan SHALL NOT be
computed again.

*(KS-AST-05)*

#### Scenario: Clock ticks
- **WHEN** the clock accrues time and the piles are unchanged
- **THEN** the availability is unchanged and the plan is not recomputed

#### Scenario: Piles change
- **WHEN** a move changes the piles
- **THEN** the availability is recomputed

### Requirement: A new deal asks first during a game in progress

Requesting a new deal SHALL depend on the current game:
- while the game is started and not won, the New deal options SHALL be offered (Restart this deal,
  New deal, Cancel) and nothing SHALL change until one is chosen;
- while the game is unstarted or won, a new game in the current game's mode SHALL be dealt at once;
- while no game exists, a new game in the selected mode SHALL be dealt at once.

Choosing New deal SHALL deal a new game in the current game's mode; replacing the started, unwon game
breaks that mode's streak as the statistics capability defines. Choosing Restart this deal SHALL
restart as "Restart replays the same deal" defines. Choosing Cancel SHALL close the options and leave
the game, its clock and every statistic unchanged. While the options are offered, the clock SHALL
NOT accrue time.

Requesting a new deal SHALL do nothing while a safe-card chain or Finish is running, or while a deal
is already being prepared: in both cases the current game, its clock and every statistic stay
unchanged and no options, restart or new deal follows.

Input-agnostic: the HUD New deal control (pointer or keyboard) and the N shortcut issue the same
request; the options' controls are defined by `ui/sheets`.

Deterministic: the new deal comes from the deal service as in "Starting a game installs a fresh
deal"; this request adds no randomness.

*(KS-DEAL-08, KS-STA-03, KS-SCO-06; spec §3.3 New deal options)*

#### Scenario: A started game offers options

- **WHEN** a new deal is requested during a started, unwon Draw 1 game
- **THEN** the New deal options are offered and the game, its time and its statistics are unchanged

#### Scenario: Choosing New deal

- **WHEN** the options are offered for a started Draw 3 game with a streak of 2 and New deal is
  chosen
- **THEN** a new Draw 3 game is installed and Draw 3's current streak is 0

#### Scenario: Choosing Cancel

- **WHEN** the options are offered and Cancel is chosen
- **THEN** the options close and the game continues unchanged

#### Scenario: An unstarted game deals at once

- **WHEN** a new deal is requested before any move of a Vegas game
- **THEN** a new Vegas game is installed without offering options, and no streak changes

#### Scenario: No game deals the selected mode

- **WHEN** no game exists, the selected mode is Draw 3 and a new deal is requested
- **THEN** a new Draw 3 game is installed

#### Scenario: A running sequence refuses a new deal

- **WHEN** a safe-card chain or Finish is running and a new deal is requested
- **THEN** nothing changes: no options open and no deal is installed

#### Scenario: A deal being prepared refuses a new deal

- **WHEN** a deal is already being prepared and a new deal is requested
- **THEN** nothing changes: no options open and no second deal is installed

#### Scenario: The clock does not accrue while options are open

- **WHEN** the New deal options are offered for 30 seconds
- **THEN** the game's elapsed time when the options close equals its elapsed time when they opened

### Requirement: Dealing from a deal code

Playing a deal code SHALL ignore surrounding whitespace and letter case. A valid code SHALL install
exactly the deal its seed and mode produce, without asking the solver, marked as a random deal with
one attempt and with no Daily date, and SHALL show the Game screen. A Daily code SHALL play under
Daily's rules but SHALL NOT count toward the Daily streak. Installing it SHALL discard any start
still being prepared and end that start's dealing progress, so board input reopens, and a started,
unfinished game it replaces SHALL be treated as abandoned (its mode's streak breaks). An invalid code SHALL change nothing: no game, route, history or statistic,
and the caller SHALL be told it was invalid so an inline error can be shown.

Input-agnostic: the code comes from the Play a deal code sheet, whose controls are defined by
`ui/sheets`; typing and submitting work by pointer and keyboard there.

Deterministic: the same code always installs the identical deal (seeded input, seeded output).

*(KS-DEAL-02, KS-DEAL-09, KS-STA-03, KS-STA-04)*

#### Scenario: A valid code reproduces the deal

- **WHEN** the code of a Draw 1 deal is played
- **THEN** the installed game has that seed, draws one card, shows the same deal code, and is marked
  as a random deal

#### Scenario: Case and spaces are ignored

- **WHEN** the same code is played in lower case with surrounding spaces
- **THEN** the identical deal is installed

#### Scenario: An invalid code changes nothing

- **WHEN** "hello" is played
- **THEN** the current game, route and statistics are unchanged and the result reports it invalid

#### Scenario: A code replaces a started game

- **WHEN** a code is played during a started, unwon Vegas game with a streak of 1
- **THEN** the code's deal is installed and Vegas's current streak is 0

#### Scenario: A code wins over a pending start

- **WHEN** a winnable Draw 1 start is still being prepared and a code is played
- **THEN** only the code's deal is installed, the dealing progress is cleared and board input is
  accepted

#### Scenario: A Daily code does not record a date

- **WHEN** a Daily code is played and won
- **THEN** Daily's played and won counts grow and no completed Daily date is recorded

### Requirement: Pause and resume

Pausing SHALL be possible only while the Game screen is shown with a game that is not won. It SHALL
open the Paused sheet. While paused, no play time SHALL accrue and no board input or game command
SHALL be accepted. Resuming SHALL close the Paused sheet and restore play exactly as it was; time
accrues again only once the game is started. Pausing SHALL NOT change the position, score, moves,
history or statistics.

Pausing SHALL be refused, leaving the game unchanged, while a safe-card chain or Finish is running or
while a deal is being prepared; no Paused sheet opens in either case.

Input-agnostic: activating Time (pointer or keyboard) and the P key issue the same pause; Resume,
Escape, the backdrop and P issue the same resume.

Deterministic: pausing and resuming leave the game state identical.

*(KS-SCO-05, KS-SCO-06, KS-SCO-07, KS-INP-09)*

#### Scenario: Pausing stops the clock

- **WHEN** a started game is paused for 30 seconds and then resumed
- **THEN** the elapsed time is the same as when it was paused

#### Scenario: No input while paused

- **WHEN** the game is paused and a move is attempted
- **THEN** nothing changes

#### Scenario: A won game cannot be paused

- **WHEN** the game is won and a pause is requested
- **THEN** no Paused sheet opens

#### Scenario: Home cannot be paused

- **WHEN** the Home screen is shown and a pause is requested
- **THEN** nothing changes

#### Scenario: A running sequence cannot be paused

- **WHEN** a safe-card chain or Finish is running and a pause is requested
- **THEN** no Paused sheet opens and the sequence keeps running

#### Scenario: A deal being prepared refuses a pause

- **WHEN** a deal is being prepared and a pause is requested
- **THEN** no Paused sheet opens
