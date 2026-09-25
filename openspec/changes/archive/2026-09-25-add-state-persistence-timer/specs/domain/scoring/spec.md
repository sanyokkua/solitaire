# Spec Delta

## MODIFIED Requirements

### Requirement: Time penalty, win bonus and undo penalty

With *s* = elapsed play time in whole seconds (fraction discarded) and *u* = the game's undo charges:
- **Time penalty** (Standard only): 2 × floor(*s* / 10), computed as a total from the elapsed time,
  never accrued into the stored score.
- **Win bonus** (Standard only): floor(700,000 / *s*) once the game is won and *s* > 30; otherwise 0.
- **Undo cost:** 2 under Standard, 0 under Vegas. Undo itself restores the earlier position's stored
  move score exactly; the cost is charged through the undo charges, which never rewind and are
  never refunded by redo.
- **Displayed score:** the stored move score minus the time penalty and minus *u* × the undo cost,
  floored at 0 under Standard only, plus the win bonus once won. Computing it SHALL NOT change the
  stored move score.

Vegas has no time penalty, no bonus and no undo cost. Input-agnostic: a function of time, undo
charges and rules. Deterministic: the same elapsed time, undo charges and rules always yield the
same penalty, bonus and displayed score. *(KS-SCO-01, KS-SCO-03, KS-SCO-04)*

#### Scenario: The time penalty accrues every ten seconds

- **WHEN** the counted play time of a Standard game is just under 10 seconds, exactly 10 seconds
  and 100 seconds
- **THEN** the penalty is 0, 2 and 20 points respectively

#### Scenario: The win bonus needs more than thirty whole seconds

- **WHEN** a Standard game is won at exactly 30 seconds, again a fraction short of 31 seconds, and
  again at 31 seconds
- **THEN** no bonus is added in the first two cases and the whole part of 700,000 divided by 31 is
  added in the third

#### Scenario: The bonus applies only once won

- **WHEN** a Standard game has run for more than 30 seconds but is still being played
- **THEN** no bonus is included in the score shown

#### Scenario: Vegas has no time penalty or bonus

- **WHEN** a Vegas game runs for several minutes and is won
- **THEN** neither a time penalty nor a bonus changes the bankroll

#### Scenario: The undo cost is two points under Standard rules only

- **WHEN** the cost of an undo is requested under Standard scoring and again under Vegas scoring
- **THEN** it is 2 points under Standard and nothing under Vegas

#### Scenario: Undo charges lower the displayed Standard score

- **WHEN** a Standard position with a stored move score of 50, 5 seconds of play and 3 undo charges
  is displayed
- **THEN** the displayed score is 44

#### Scenario: Undo charges never take the Standard score below zero

- **WHEN** a Standard position with a stored move score of 4 and 3 undo charges is displayed
- **THEN** the displayed score is 0

#### Scenario: Vegas ignores undo charges

- **WHEN** a Vegas position with a bank of −$27 and 3 undo charges is displayed
- **THEN** the displayed bank is −$27

#### Scenario: The displayed score is derived, not stored

- **WHEN** the score to display is requested twice for the same position
- **THEN** the same value is returned both times and the stored move score is unchanged
