# Spec Delta

## MODIFIED Requirements

### Requirement: Starting a game installs a fresh deal

Starting a game SHALL request a deal for a named mode, passing the "Winnable deals only" setting and
the Difficulty setting as they are when the start begins, and SHALL install the delivered deal as the
current game with empty undo and redo history and no undo charges. The installed game SHALL carry the
provenance the deal was delivered with: its verdict, its attempt count and its grade (none when it
has none). A change to the mode, "Winnable deals only" or the Difficulty after the start has begun
SHALL NOT change the deal requested or the game installed.

While a deal is being prepared, the dealing progress (the attempt being tried and whether the
overlay is due) SHALL be available to the interface. It SHALL be cleared once the deal settles. A
deal served at once from the pool (see `features/deal-service`) brings no dealing progress.

A newer start SHALL supersede an older one that has not been delivered yet. A superseded or
cancelled start SHALL leave the current game, its history and every statistic unchanged.

Input-agnostic: a start is requested from Home's Deal cards, the New deal control, the N shortcut and
the Win sheet's Deal again; the same command is issued from every one of them.

Deterministic: the installed game is exactly the deal the deal service delivers; the state layer
adds no randomness.

*(KS-DEAL-03, KS-DEAL-04, KS-SET-06, KS-DEAL-11 (new))*

#### Scenario: A delivered deal becomes the current game

- **WHEN** a Draw 3 game is started and the deal service delivers a deal
- **THEN** that deal is the current game, in Draw 3, with no undo or redo steps, and the dealing
  progress is cleared

#### Scenario: The start carries the difficulty

- **WHEN** a Vegas game is started with "Winnable deals only" on and the Difficulty Easy
- **THEN** the deal is requested for Vegas with the switch on and target Easy, and the installed game
  carries the verdict, attempts and grade it was delivered with

#### Scenario: Settings changed during the start are ignored

- **WHEN** a winnable Draw 1 start begins with the Difficulty Hard, and the Difficulty is changed to
  Easy before the deal is delivered
- **THEN** the deal requested for Hard is installed, with the grade it was delivered with

#### Scenario: A newer start wins

- **WHEN** a Draw 1 start is still being prepared and a Vegas start is requested
- **THEN** only the Vegas deal is installed, and the Draw 1 request changes nothing

#### Scenario: Dealing progress is exposed while a winnable deal is prepared

- **WHEN** a winnable Draw 1 deal takes longer than the overlay delay to prepare
- **THEN** the dealing progress reports the overlay as due with the current attempt number until the
  deal is installed

### Requirement: Restart replays the same deal

Restarting SHALL deal the current game's seed again in the same mode, keeping its deal provenance
(verdict, attempt count and grade) and its Daily date, without asking the solver. Score, moves,
elapsed time, undo charges and undo and redo history SHALL be reset.

Input-agnostic: the restart command is the same for every input path (its control is Restart this
deal in the New deal options, operable by pointer and keyboard).

Deterministic: a restart always reproduces the identical layout.

*(KS-DEAL-08, KS-DEAL-11 (new))*

#### Scenario: Restart gives the identical layout

- **WHEN** the player restarts a Draw 1 game after 10 moves
- **THEN** the layout equals the original deal, with no moves, no time, no undo charges and no
  history, and the deal code is unchanged

#### Scenario: Restart keeps the grade

- **WHEN** the player restarts a winnable Vegas game graded Hard
- **THEN** the restarted game has verdict `win`, the same attempt count and the grade Hard

#### Scenario: Restart keeps an absent grade

- **WHEN** the player restarts a game dealt from a deal code
- **THEN** the restarted game is still a random deal with no grade

### Requirement: Settings never change a game in progress

Changing any setting SHALL NOT change the current game's mode, draw count, scoring rules, deal,
provenance (verdict, attempts and grade) or position. The mode, "Winnable deals only" and the
Difficulty are read only when a new game is started. "Auto-move safe cards" is read after each
accepted command.

Input-agnostic: settings are values, however they are changed.

*(KS-SET-06, KS-DEAL-11 (new))*

#### Scenario: Changing the selected mode mid-game

- **WHEN** the selected mode changes from Draw 1 to Vegas during a Draw 1 game
- **THEN** the current game still draws one card under Standard scoring

#### Scenario: Changing the difficulty mid-game

- **WHEN** the Difficulty changes from Easy to Hard during a winnable Draw 1 game graded Easy
- **THEN** the current game keeps its deal, its position and its grade Easy

#### Scenario: Restart ignores the settings

- **WHEN** the selected mode, "Winnable deals only" or the Difficulty changes and the player restarts
- **THEN** the restarted game uses the original seed, mode and provenance, including its grade

### Requirement: Dealing from a deal code

Playing a deal code SHALL ignore surrounding whitespace and letter case. A valid code SHALL install
exactly the deal its seed and mode produce, without asking the solver, marked as a random deal with
one attempt, with no grade and with no Daily date, and SHALL show the Game screen. A Daily code SHALL
play under Daily's rules but SHALL NOT count toward the Daily streak. Installing it SHALL discard any
start still being prepared and end that start's dealing progress, so board input reopens, and a
started, unfinished game it replaces SHALL be treated as abandoned (its mode's streak breaks). An
invalid code SHALL change nothing: no game, route, history or statistic, and the caller SHALL be told
it was invalid so an inline error can be shown.

Input-agnostic: the code comes from the Play a deal code sheet, whose controls are defined by
`ui/sheets`; typing and submitting work by pointer and keyboard there.

Deterministic: the same code always installs the identical deal (seeded input, seeded output).

*(KS-DEAL-02, KS-DEAL-09, KS-STA-03, KS-STA-04, KS-DEAL-11 (new))*

#### Scenario: A valid code reproduces the deal

- **WHEN** the code of a Draw 1 deal is played
- **THEN** the installed game has that seed, draws one card, shows the same deal code, and is marked
  as a random deal with no grade

#### Scenario: The code of a graded deal carries no grade

- **WHEN** the code of a winnable Draw 3 deal graded Easy is played
- **THEN** the identical layout is installed, marked as a random deal with one attempt and no grade

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
