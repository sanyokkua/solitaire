# Spec Delta

## Purpose

Keeps the player's statistics per mode (played, won, streaks, best time and best score) and the Daily
record of completed UTC days and streaks, updated from game events and cleared on request.

## ADDED Requirements

### Requirement: A game counts as played at its first accepted command

A game SHALL be counted as played for its mode exactly once, when its first command is accepted.
Undo and redo SHALL NOT count it again. If statistics are reset while a started game is in progress,
that game SHALL be counted again at its next accepted command, or at its win if that comes first, so
that won never exceeds played.

Input-agnostic: triggered by accepted commands, whatever input produced them.

*(KS-STA-01, KS-STA-05)*

#### Scenario: The first draw counts the game

- **WHEN** the first accepted command of a Draw 1 game is a draw
- **THEN** Draw 1's played count grows by one

#### Scenario: Undo and redo do not count again

- **WHEN** the player undoes to the deal and redoes the first move
- **THEN** the played count is unchanged

#### Scenario: A reset mid-game still counts the game

- **WHEN** statistics are reset during a started game that is later won
- **THEN** that mode shows 1 played and 1 won

### Requirement: Winning updates the mode's record

When a game is won, by a player move, a safe-card send or finishing, the system SHALL add one win to
the game's mode, increase its current streak by one, raise its best streak if the current streak is
higher, keep the lower of the previous best time and this game's elapsed time, and keep the higher
of the previous best score and this game's final displayed score (for Vegas, its final bank).

Input-agnostic: triggered by the transition to won.

*(KS-STA-02)*

#### Scenario: First win of a mode

- **WHEN** the first Draw 1 game is won in 2 minutes with a displayed score of 3,000
- **THEN** Draw 1 shows 1 played, 1 won, streak 1, best streak 1, best time 2 minutes and best
  score 3,000

#### Scenario: A slower, lower win keeps the records

- **WHEN** a later win takes longer and scores less
- **THEN** the best time and best score are unchanged, and the streak grows

### Requirement: Replacing a started, unfinished game breaks its streak

When a started, unwon game is replaced by a newly installed deal (New deal, a new game from Home, or
a deal code) or by a restart, the current streak of the replaced game's mode SHALL be reset to 0.
Leaving the Game screen, a cancelled start, and replacing an unstarted or won game SHALL NOT break a
streak.

Input-agnostic: triggered by replacing the game, however that is requested.

*(KS-STA-03)*

#### Scenario: Restart breaks the streak

- **WHEN** a Draw 1 player with a streak of 3 restarts a started game
- **THEN** Draw 1's current streak is 0 and its best streak is unchanged

#### Scenario: The replaced game's mode loses the streak

- **WHEN** a started Vegas game is replaced by a new Draw 3 game from Home
- **THEN** Vegas's current streak is 0 and Draw 3's is unchanged

#### Scenario: Going Home keeps the streak

- **WHEN** the player leaves a started game for Home and continues it later
- **THEN** no streak changes

### Requirement: Daily completions and the Daily streak

When a Daily game that was dealt as the Daily deal for a UTC date is won, that date SHALL be recorded
as completed, once. Completed dates SHALL be kept for at least the last 400 dates. The Daily streak
SHALL be the number of consecutive completed UTC dates ending today or yesterday (UTC), and 0
otherwise. The best Daily streak SHALL be the longest such run ever reached. A Daily game replayed
from a deal code SHALL count toward the Daily mode's played and won counts but SHALL NOT record a
completed date.

Input-agnostic: triggered by winning.

Deterministic: the streak depends only on the completed dates and the current UTC date.

*(KS-STA-04)*

#### Scenario: Consecutive days build the streak

- **WHEN** the Daily deals of three consecutive UTC dates are won
- **THEN** the Daily streak and the best Daily streak are 3

#### Scenario: Winning the same day twice records it once

- **WHEN** the same date's Daily deal is won twice
- **THEN** that date is recorded once and the streak does not grow

#### Scenario: A missed day ends the streak

- **WHEN** the last completed date is two or more days before today (UTC)
- **THEN** the current Daily streak is 0 and the best Daily streak is unchanged

#### Scenario: A late finish counts for the deal's day

- **WHEN** a Daily deal dealt at 23:59 UTC is won at 00:01 UTC the next day
- **THEN** the earlier date is recorded as completed

### Requirement: Reset statistics clears every statistic

When the player confirms Reset statistics, every per-mode statistic and every Daily record SHALL be
cleared. The current game and the settings SHALL be unaffected.

Input-agnostic: the confirmation control arrives in Phase 7; the reset is one command.

*(KS-STA-05)*

#### Scenario: Reset clears all modes and the Daily record

- **WHEN** statistics exist for several modes and Daily dates and the player resets statistics
- **THEN** every mode shows no games, and no Daily dates or streaks remain
