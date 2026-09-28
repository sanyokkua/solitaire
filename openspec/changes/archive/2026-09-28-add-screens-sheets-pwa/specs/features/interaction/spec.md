# Spec Delta

## ADDED Requirements

### Requirement: Win summary

When a game is won, the system SHALL record a win summary holding the game's mode, final score (for
Vegas, the final bank), elapsed time, move count, time bonus (zero when none applies) and whether it
is a new best time. The final score already includes the time bonus: it is the same score that
statistics records as the mode's best. It is a new best time when it is the mode's first win, or when
the time is strictly lower than the mode's previous best time; the previous best SHALL be read before
the win updates the statistics. The summary SHALL be runtime-only and never stored. It SHALL be
cleared when a new deal is installed or the game is cleared.

Input-agnostic: recorded on the transition to won, whether it came from a player move, a safe-card
send or finishing.

Deterministic: the same game and statistics always yield the same summary.

*(KS-STA-02, KS-SCO-04; spec §3.3 Win; runtime-only storage (new))*

#### Scenario: First win is a new best

- **WHEN** the first Draw 1 game is won in 2 minutes with 90 moves
- **THEN** the summary holds Draw 1, the final score, 2 minutes, 90 moves, the time bonus and a new
  best time

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
