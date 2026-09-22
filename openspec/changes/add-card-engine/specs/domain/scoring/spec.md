# Spec Delta

## Purpose

How a game's score is earned and lost under Standard and Vegas rules, including the time penalty,
undo cost and win bonus.

## ADDED Requirements

### Requirement: Standard move scoring

Under Standard scoring a game SHALL start at 0, and each event SHALL score:
- waste → tableau +5; waste → foundation +10; tableau → foundation +10;
- a tableau card turned face up +5;
- foundation → tableau −15;
- tableau → tableau, a draw, a refusal and a win 0.

The events of one command SHALL be summed and applied to the stored move score in one step, and the
result floored at 0. Input-agnostic: a function of events and rules. Deterministic: the same events
under the same rules always yield the same score. *(KS-SCO-01)*

#### Scenario: A Standard game starts at zero

- **WHEN** a game under Standard scoring is dealt
- **THEN** its score is zero

#### Scenario: Each scoring event is worth its stated points

- **WHEN** each scoring event of the Standard table occurs in turn
- **THEN** the score changes by that event's stated amount, and events outside the table change it
  by nothing

#### Scenario: A move that reveals a card scores both parts

- **WHEN** a card is moved from a tableau column to a foundation and reveals a face-down card
- **THEN** the score increases by 15, being 10 for the foundation and 5 for the turn

#### Scenario: The Standard score floors at zero

- **WHEN** a deduction would take the Standard score below zero
- **THEN** the score reported is zero

### Requirement: Recycle penalties follow the pass count

Under Standard scoring with a one-card draw, every recycle SHALL deduct 100. Under Standard scoring
with a three-card draw, a recycle SHALL deduct 20 when the pass it begins is the fourth or later, and
nothing otherwise, so the first three passes are free. Input-agnostic: a function of events and
rules. Deterministic: the same pass and rules always yield the same deduction. *(KS-SCO-01)*

#### Scenario: One-card draw charges every recycle

- **WHEN** a one-card Standard game recycles repeatedly
- **THEN** each recycle deducts 100 points

#### Scenario: Three-card draw charges after three free passes

- **WHEN** a three-card Standard game performs four successive recycles, beginning passes two,
  three, four and five
- **THEN** the deductions are nothing, nothing, 20 points and 20 points respectively

### Requirement: Vegas bankroll

Under Vegas scoring a game SHALL start at −52, gain 5 for each card placed on a foundation and lose 5
for each card taken off one. No other event SHALL change the bankroll, and it SHALL NOT be floored.
Input-agnostic: a function of events and rules. Deterministic: the same events always yield the same
bankroll. *(KS-SCO-02)*

#### Scenario: The bankroll starts at minus 52

- **WHEN** a Vegas game is dealt
- **THEN** its score is minus 52

#### Scenario: Only foundation movement changes the bankroll

- **WHEN** a card is placed on a foundation, then taken off one, then a card is turned face up and
  the stock is recycled
- **THEN** the bankroll rises by 5, falls by 5, and is unchanged by the remaining two events

#### Scenario: The bankroll is not floored

- **WHEN** a Vegas game's bankroll is negative
- **THEN** the negative value is reported unchanged

### Requirement: Time penalty, win bonus and undo penalty

With *s* = elapsed play time in whole seconds (fraction discarded):
- **Time penalty** (Standard only): 2 × floor(*s* / 10), computed as a total from the elapsed time,
  never accrued into the stored score.
- **Win bonus** (Standard only): floor(700,000 / *s*) once the game is won and *s* > 30; otherwise 0.
- **Undo cost:** 2 under Standard, 0 under Vegas. The domain only provides the amount; the phase
  owning undo history applies it.
- **Displayed score:** the stored move score minus the time penalty, floored at 0 under Standard
  only, plus the win bonus once won. Computing it SHALL NOT change the stored move score.

Vegas has no time penalty and no bonus. Input-agnostic: a function of time and rules. Deterministic:
the same elapsed time and rules always yield the same penalty, bonus and displayed score.
*(KS-SCO-01, KS-SCO-03, KS-SCO-04)*

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

#### Scenario: The displayed score is derived, not stored

- **WHEN** the score to display is requested twice for the same position
- **THEN** the same value is returned both times and the stored move score is unchanged
