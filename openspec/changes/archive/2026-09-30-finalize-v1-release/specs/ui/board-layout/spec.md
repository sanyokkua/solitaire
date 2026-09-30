# Spec Delta

## MODIFIED Requirements

### Requirement: Columns compress face-down cards first

Each tableau column SHALL step face-down cards by 0.11 of the card height and face-up cards by 0.27
of the card height (0.30 with a coarse pointer). When a column would run past the bottom of the
board, face-down steps SHALL shrink first, down to 0.04 of the card height, and only then SHALL
face-up steps shrink. Every card of every column SHALL stay inside the board. On the installed-mode
board of every screen in the device matrix, with a coarse pointer, a worst-case column SHALL keep a
face-up strip of at least 14 px. The device matrix is the 13 phone, tablet and foldable screens whose
viewport sizes are recorded in `docs/reference/device-matrix.md`.

Input-agnostic: pure computation.

*(KS-GEN-05, KS-A11Y-04 strip size)*

#### Scenario: Short column is not compressed

- **WHEN** a column holds 3 face-down and 2 face-up cards on a tall board
- **THEN** the steps are 0.11 and 0.27 (or 0.30 on touch) of the card height

#### Scenario: Face-down cards squeeze first

- **WHEN** a worst-case column does not fit the board at the normal steps
- **THEN** its face-down step shrinks before its face-up step, and never below 0.04 of the card height

#### Scenario: Worst case fits on every device

- **WHEN** the layout is computed with a coarse pointer for the installed-mode board size of each
  device-matrix screen, portrait and landscape, with a worst-case column
- **THEN** every card lies inside the board and the face-up strip is at least 14 px
