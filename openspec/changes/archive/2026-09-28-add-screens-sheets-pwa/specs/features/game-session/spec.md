# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
