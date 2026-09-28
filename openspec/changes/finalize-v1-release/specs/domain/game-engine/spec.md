# Spec Delta

## MODIFIED Requirements

### Requirement: A game state can be checked for validity

The system SHALL provide a check that accepts a game state only if all of these hold:
- the 52 card identifiers each appear exactly once across stock, waste, foundations and tableau;
- each foundation holds cards of its own suit in ascending rank order starting from the ace;
- no face-down card lies above a face-up card in any column;
- mode, draw count and scoring rules agree with each other as the mode defines;
- the seed is an unsigned 32-bit integer, the verdict and status are known values, and the move
  count, pass count, attempt count, elapsed time and undo charges are finite non-negative integers,
  with the pass count at least 1;
- the pass count is no more than the mode's pass limit: 3 for Vegas, and no limit for every other
  mode;
- the grade is one of none, Easy, Medium or Hard, and is none unless the verdict is `win`;
- the status is won exactly when all 52 cards are on the foundations.

The check SHALL never throw, whatever value it is given.

Input-agnostic: a predicate over stored data. Deterministic: the same value always gets the same
answer.

*(KS-PER-03, KS-MOVE-05, KS-DEAL-11 (new))*

#### Scenario: Every dealt and played position is valid

- **WHEN** fixture deals in every mode, with and without a grade, and every position of the fixture
  winning lines are checked
- **THEN** each is accepted

#### Scenario: A duplicated card is rejected

- **WHEN** a position lists the same card in the stock and in a column
- **THEN** it is rejected

#### Scenario: A buried face-up card is rejected

- **WHEN** a column holds a face-down card on top of a face-up card
- **THEN** it is rejected

#### Scenario: A Vegas game past its pass limit is rejected

- **WHEN** a Vegas position on its fourth pass is checked, and the same piles in Draw 3 on its fourth
  pass
- **THEN** the Vegas position is rejected and the Draw 3 position is accepted

#### Scenario: A grade needs a proven deal

- **WHEN** a position with the verdict `win` and the grade Medium, one with the verdict `random` and
  the grade Easy, and one with an unknown grade value are checked
- **THEN** the first is accepted and the other two are rejected

#### Scenario: A proven deal may have no grade

- **WHEN** a position with the verdict `win` and no grade is checked
- **THEN** it is accepted

#### Scenario: Arbitrary values are rejected without throwing

- **WHEN** `null`, a number, an array or an object missing its piles is checked
- **THEN** each is rejected and nothing is thrown
