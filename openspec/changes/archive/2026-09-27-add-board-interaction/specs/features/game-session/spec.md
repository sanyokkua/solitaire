# Spec Delta

## MODIFIED Requirements

### Requirement: Player commands advance the game

A player command SHALL be applied to the current game through the rules engine. An accepted command
SHALL become the current game and SHALL record one undo step holding the position before it. A
rejected command SHALL change nothing: no position, history, clock or statistic.

Every play SHALL report whether the command was accepted and, either way, the events the rules
engine produced for it (including the refusal reason of a rejected command), so that callers can
announce the result, shake a refused card or show "No redeals left". A safe-card send or a finish
step SHALL report its events through the same path as it commits.

Commands SHALL be ignored while no game is in progress, while the game is won, and while a
system-driven sequence (the safe-card chain or finishing) is running.

Input-agnostic: tap, drag and keyboard input all resolve to the same command before it reaches this
layer, so every input path gets identical results.

Deterministic: the same deal and the same command sequence always produce the same game.

*(KS-AST-07, KS-INP-09, KS-A11Y-02, KS-MOVE-05)*

#### Scenario: An accepted move records one undo step

- **WHEN** a legal move is played on a fresh deal
- **THEN** the game shows the move's result and exactly one undo step exists

#### Scenario: A rejected move changes nothing

- **WHEN** an illegal move is played
- **THEN** the game, its undo and redo history and its statistics are unchanged

#### Scenario: A rejected move reports why

- **WHEN** a Vegas recycle beyond the pass limit is played
- **THEN** the report says the command was refused with the reason "pass-limit"

#### Scenario: An accepted move reports its events

- **WHEN** a move that turns a card face up is played
- **THEN** the report lists the move and the flip

#### Scenario: Commands are ignored after a win

- **WHEN** a command is played on a won game
- **THEN** nothing changes

## ADDED Requirements

### Requirement: Finish availability is stable across clock ticks
Whether Finish is available SHALL depend only on the piles and the session's busy state, never on
elapsed time. While the clock ticks and the piles do not change, the finish plan SHALL NOT be
computed again.

*(KS-AST-05)*

#### Scenario: Clock ticks
- **WHEN** the clock accrues time and the piles are unchanged
- **THEN** the availability is unchanged and the plan is not recomputed

#### Scenario: Piles change
- **WHEN** a move changes the piles
- **THEN** the availability is recomputed
