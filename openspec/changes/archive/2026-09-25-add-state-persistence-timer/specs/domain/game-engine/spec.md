# Spec Delta

## MODIFIED Requirements

### Requirement: Move count, start flag and clock are engine-owned or engine-untouched

The move count SHALL increase by one for each accepted player move and each accepted draw or recycle,
and SHALL NOT change for a system-initiated send. The game SHALL be marked started on its first
accepted command. No command SHALL change the elapsed time, the undo charges, seed, mode, draw count,
scoring rules or deal provenance. Input-agnostic: applies to every command. Deterministic: the same
command sequence always yields the same move count. *(KS-SCO-05, KS-STA-01, KS-SCO-03)*

#### Scenario: System-initiated foundation moves are not counted

- **WHEN** a card is sent to a foundation on the system's own initiative
- **THEN** the move count is unchanged

#### Scenario: The first accepted command starts the game

- **WHEN** the first command of a fresh deal is accepted
- **THEN** the game is marked started, and a command refused before it leaves the game unstarted

#### Scenario: The engine never moves the clock

- **WHEN** any sequence of commands is applied
- **THEN** the elapsed time, undo charges, seed, mode, draw count, scoring rules and deal provenance
  are unchanged throughout

## ADDED Requirements

### Requirement: A game state can be checked for validity

The system SHALL provide a check that accepts a game state only if all of these hold:
- the 52 card identifiers each appear exactly once across stock, waste, foundations and tableau;
- each foundation holds cards of its own suit in ascending rank order starting from the ace;
- no face-down card lies above a face-up card in any column;
- mode, draw count and scoring rules agree with each other as the mode defines;
- the seed is an unsigned 32-bit integer, the verdict and status are known values, and the move
  count, pass count, attempt count, elapsed time and undo charges are finite non-negative integers,
  with the pass count at least 1;
- the status is won exactly when all 52 cards are on the foundations.

The check SHALL never throw, whatever value it is given.

Input-agnostic: a predicate over stored data. Deterministic: the same value always gets the same
answer.

*(KS-PER-03)*

#### Scenario: Every dealt and played position is valid

- **WHEN** fixture deals in every mode and every position of the fixture winning line are checked
- **THEN** each is accepted

#### Scenario: A duplicated card is rejected

- **WHEN** a position lists the same card in the stock and in a column
- **THEN** it is rejected

#### Scenario: A buried face-up card is rejected

- **WHEN** a column holds a face-down card on top of a face-up card
- **THEN** it is rejected

#### Scenario: Arbitrary values are rejected without throwing

- **WHEN** `null`, a number, an array or an object missing its piles is checked
- **THEN** each is rejected and nothing is thrown
