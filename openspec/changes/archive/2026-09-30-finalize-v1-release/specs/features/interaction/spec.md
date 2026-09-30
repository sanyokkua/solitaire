# Spec Delta

## MODIFIED Requirements

### Requirement: Hints come from the solver line or the heuristic
Requesting a hint SHALL first ask for the position's advice: when it is a dead end, the player SHALL
be told so through the dead-end notice and no hint SHALL be shown. Otherwise the hint SHALL be the
first move of the solver's winning line where the deal service supplies one within its budget, in
every mode (Draw 1, Draw 3, Vegas and Daily), and the heuristic hint otherwise. The hint SHALL name
the source cards and the target pile, or the stock when the best move is to draw or recycle. A hint
SHALL be shown for about 2 seconds, described in text, and then cleared; it SHALL also be cleared by
the next pointer press, undo, redo, a new position or a new deal. A hint that arrives after the
position or the game changed SHALL be dropped. A hint SHALL cost no score and no move and SHALL NOT
change the game.

Input-agnostic: the Hint control (pointer or keyboard) and the H shortcut issue the same request;
drag is not an input path, since a hint is asked for, not moved.

Deterministic: the same position gives the same heuristic hint; a solver hint is the solver's
first command.

*(KS-AST-02, KS-AST-03)*

#### Scenario: Draw 1 uses the solver line
- **WHEN** a hint is requested in a winnable Draw 1 position and the solver answers in time
- **THEN** the hint's source and target are the first move of that line

#### Scenario: Draw 3 and Vegas use the solver line
- **WHEN** a hint is requested in a winnable Draw 3 or Vegas position and the solver answers in time
- **THEN** the hint's source and target are the first move of that line, or the stock when that move
  is a draw or a recycle

#### Scenario: Heuristic fallback
- **WHEN** a hint is requested and the solver offers no line or does not answer in time
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

### Requirement: Win summary

When a game is won, the system SHALL record a win summary holding the game's mode, its grade (none
when the game has no grade: a random deal, a deal played from a code, or a game upgraded from an
older stored record), final score (for Vegas, the final bank), elapsed time, move count, time bonus
(zero when none applies) and whether it is a new best time. The grade is the one the game was dealt
with, including after a restart. The final score already includes the time bonus: it is the same
score that statistics records as the mode's best. It is a new best time when it is the mode's first
win, or when the time is strictly lower than the mode's previous best time; the previous best SHALL
be read before the win updates the statistics. The summary SHALL be runtime-only and never stored.
It SHALL be cleared when a new deal is installed or the game is cleared.

Input-agnostic: recorded on the transition to won, whether it came from a player move, a safe-card
send or finishing.

Deterministic: the same game and statistics always yield the same summary.

*(KS-STA-02, KS-SCO-04, KS-DEAL-11 (new); runtime-only storage (new))*

#### Scenario: First win is a new best

- **WHEN** the first Draw 1 game is won in 2 minutes with 90 moves
- **THEN** the summary holds Draw 1, the final score, 2 minutes, 90 moves, the time bonus and a new
  best time

#### Scenario: The summary carries the grade

- **WHEN** a winnable Draw 3 game graded Hard is won
- **THEN** the summary holds the grade Hard

#### Scenario: An ungraded game has no grade in the summary

- **WHEN** a game dealt from a deal code is won
- **THEN** the summary holds no grade

#### Scenario: The displayed score includes the time bonus

- **WHEN** a game is won with a non-zero time bonus
- **THEN** the summary's score is the final score with the time bonus already added, the same value
  statistics records as the mode's best

#### Scenario: A slower win is not a new best

- **WHEN** a Draw 1 game is won more slowly than the mode's best time
- **THEN** the summary does not mark a new best time

#### Scenario: An equal time is not a new best

- **WHEN** a game is won in exactly the mode's best time
- **THEN** the summary does not mark a new best time

#### Scenario: A new deal clears it

- **WHEN** a summary exists and a new deal is installed
- **THEN** no summary exists

#### Scenario: Never stored

- **WHEN** a summary exists and the state is saved
- **THEN** the stored record holds no summary
