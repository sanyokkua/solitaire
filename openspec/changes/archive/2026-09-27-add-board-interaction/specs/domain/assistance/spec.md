# Spec Delta

## ADDED Requirements

### Requirement: One advice for a position
The domain SHALL offer one advice function for a position that returns exactly one of: a dead end,
a productive move hint (with its source cards, target and priority), a draw, or a recycle. It SHALL
return the dead end exactly when dead-end detection reports one, so a position is never both a
dead end and given a draw or recycle hint. It SHALL be pure and deterministic: the same position
gives the same advice. The existing hint function, its R§6.1 priority order and the R§6.4 dead-end
rule are unchanged; the advice function adds the dead-end check in front of the hint. A won position has no advice.

*(KS-AST-02, KS-AST-06)*

#### Scenario: Dead end wins over draw
- **WHEN** the stock holds cards but none can be played anywhere and no tableau move is productive
- **THEN** the advice is a dead end, not a draw

#### Scenario: Productive move
- **WHEN** a card can go to its foundation
- **THEN** the advice is that move with priority 1

#### Scenario: Draw is useful
- **WHEN** no tableau move exists but a card in the stock can be played
- **THEN** the advice is to draw

#### Scenario: Determinism
- **WHEN** the advice of the same position is computed twice
- **THEN** the results are equal

### Requirement: Position identity
The domain SHALL offer a position key: a string that depends only on the piles (tableau with face
states, stock, waste, foundations) and is equal for two positions exactly when those piles are
equal. It SHALL NOT depend on the score, moves, time, undo count or clock ticks.

*(KS-AST-06)*

#### Scenario: Time does not matter
- **WHEN** two states differ only in elapsed time
- **THEN** their keys are equal

#### Scenario: A move changes the key
- **WHEN** a card moves
- **THEN** the key differs from the one before

#### Scenario: A flip changes the key
- **WHEN** a face-down card is turned up
- **THEN** the key differs
