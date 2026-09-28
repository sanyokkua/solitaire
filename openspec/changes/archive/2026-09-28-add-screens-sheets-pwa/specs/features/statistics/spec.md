# Spec Delta

## ADDED Requirements

### Requirement: Overall record

The system SHALL provide an overall record across the four modes (Draw 1, Draw 3, Vegas and Daily):
- played SHALL be the sum of every mode's played count;
- won SHALL be the sum of every mode's won count;
- win rate SHALL be won divided by played, as a whole percent rounded to the nearest integer, and
  SHALL be absent (shown as no value) while played is 0;
- current streak SHALL be the largest current streak among the modes;
- best streak SHALL be the largest best streak among the modes.

The Daily date streak is kept separately and is not part of the overall streak.

Input-agnostic: derived from the statistics; shown on Home's record strip.

Deterministic: the same statistics always yield the same overall record.

*(new; spec §3.1 Record strip; KS-STA-01, KS-STA-02)*

#### Scenario: Sums across modes

- **WHEN** Draw 1 has 3 played and 2 won and Vegas has 1 played and 0 won
- **THEN** the overall record shows 4 played, 2 won and a 50% win rate

#### Scenario: Rounded win rate

- **WHEN** 3 games are played and 1 is won
- **THEN** the win rate is 33%

#### Scenario: No games

- **WHEN** no game has been played
- **THEN** played and won are 0 and there is no win rate

#### Scenario: Largest streaks

- **WHEN** Draw 1 has a current streak of 2 and best of 5, and Draw 3 a current streak of 4 and best
  of 4
- **THEN** the overall current streak is 4 and the overall best streak is 5

## MODIFIED Requirements

### Requirement: Reset statistics clears every statistic

When the player confirms Reset statistics, every per-mode statistic and every Daily record SHALL be
cleared. The current game and the settings SHALL be unaffected. The reset SHALL be reachable from
the Statistics sheet and from the Data group of the Settings sheet, and SHALL run only after an
explicit confirmation; declining the confirmation SHALL change nothing.

Input-agnostic: the reset is one command; its confirmation controls are defined by `ui/sheets` and
work by pointer and keyboard.

*(KS-STA-05)*

#### Scenario: Reset clears all modes and the Daily record

- **WHEN** statistics exist for several modes and Daily dates and the player resets statistics
- **THEN** every mode shows no games, and no Daily dates or streaks remain

#### Scenario: Declined reset keeps the statistics

- **WHEN** the player starts Reset statistics and cancels the confirmation
- **THEN** every statistic is unchanged
