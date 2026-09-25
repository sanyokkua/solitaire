# Spec Delta

## MODIFIED Requirements

### Requirement: A mode fixes the draw count and the scoring rules

Each mode SHALL fix the draw count and scoring rules for the life of the game: Draw 1 draws one under
Standard scoring, Draw 3 draws three under Standard, Vegas draws three under Vegas, and Daily draws
one under Standard. A fresh deal SHALL be on pass 1, with no moves, no elapsed time, no undo charges,
not started, not won, and the starting score of its scoring rules. Input-agnostic: no interaction.
Deterministic: a mode always maps to the same draw count and scoring rules. *(KS-SET-06)*

#### Scenario: Each mode maps to its draw count and scoring

- **WHEN** a game is dealt in a given mode
- **THEN** its draw count and scoring rules are those the mode defines

#### Scenario: A fresh deal starts on the first pass

- **WHEN** a game is dealt
- **THEN** it is on its first pass through the stock, has made no moves, has no elapsed time, has no
  undo charges, is not yet started, is not won, and carries the starting score for its scoring rules
