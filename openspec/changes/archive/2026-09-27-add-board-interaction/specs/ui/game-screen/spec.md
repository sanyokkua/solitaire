# Spec Delta

## MODIFIED Requirements

### Requirement: Undo and Redo toolbar

The toolbar SHALL offer Undo and Redo. Activating Undo SHALL undo the last player move and activating
Redo SHALL re-apply the last undone move, exactly as the game session defines them. Each control SHALL
be disabled while its action is unavailable (nothing to undo or redo, or a finish sequence is
running), SHALL be operable by pointer activation and by keyboard (Enter or Space when focused),
SHALL have the accessible name "Undo" or "Redo", SHALL show a visible focus indicator, and SHALL be at
least 44×44 px where the pointer is coarse. Drag is not an input path for this requirement: toolbar
buttons are not draggable objects. Hint and Finish are covered by the requirement "Hint and Finish
tools".

No-motion path: the cards' response to Undo and Redo follows the board-motion capability.

*(KS-AST-07, KS-AST-08 controls; KS-A11Y-03 focus; KS-A11Y-04 target size)*

#### Scenario: Undo by pointer

- **WHEN** a started game has a move to undo and the player taps or clicks Undo
- **THEN** the position before that move is shown and Redo becomes enabled

#### Scenario: Redo by keyboard

- **WHEN** Redo is enabled, focused, and the player presses Enter
- **THEN** the undone move is re-applied

#### Scenario: Disabled when unavailable

- **WHEN** a fresh deal has no move yet
- **THEN** Undo and Redo are both disabled

#### Scenario: Touch target size

- **WHEN** the pointer is coarse
- **THEN** Undo and Redo each measure at least 44×44 px

## ADDED Requirements

### Requirement: Hint and Finish tools
The toolbar SHALL also offer Hint and Finish, after Undo and Redo, named "Hint" and "Finish", each at
least 44×44 px where the pointer is coarse and with a visible focus indicator. Hint SHALL be enabled
while the input gate is open and the game is started or fresh; it requests a hint. Finish SHALL be
enabled exactly when the game session offers Finish, SHALL be highlighted while enabled, and
activating it SHALL play every remaining card home. Both SHALL be disabled while their action is
unavailable, and while a sequence or the win cascade runs. They are operable by pointer and keyboard;
dragging is not an input path for a button.

*(KS-AST-02, KS-AST-05, KS-A11Y-03, KS-A11Y-04)*

#### Scenario: Hint by pointer
- **WHEN** Hint is tapped in a started game
- **THEN** a hint is requested

#### Scenario: Finish enabled and highlighted
- **WHEN** every tableau card is face up and a finish plan exists
- **THEN** Finish is enabled and highlighted

#### Scenario: Finish unavailable
- **WHEN** a face-down card remains
- **THEN** Finish is disabled

#### Scenario: Keyboard
- **WHEN** Finish is enabled, focused and Enter is pressed
- **THEN** Finish runs

#### Scenario: Touch target size
- **WHEN** the pointer is coarse
- **THEN** Hint and Finish each measure at least 44×44 px

### Requirement: The hint line shows the hint
While a hint is showing, the hint line SHALL show its text ("Hint: move the Four of Hearts onto column
6", "Hint: draw from the stock", "Hint: turn the waste back over") and revert to empty afterwards.
Where the hint line is not displayed (side rails, short portrait screens), the highlights and the
announcement carry the hint, so the hint never depends on the line alone. The line's other content
(tap-mode text, keyboard chips) arrives in Phase 7.

Input-agnostic: display only.

*(KS-AST-02)*

#### Scenario: Hint text
- **WHEN** a hint is showing in the stacked profile
- **THEN** the line reads the hint

#### Scenario: Hidden line
- **WHEN** a hint is showing in the side-rails profile
- **THEN** the source and target are highlighted and the hint is announced

### Requirement: Notices host and announcer are part of the frame
The Game screen SHALL contain the notices host and the polite announcer defined by `ui/notices`,
placed so they never move the board or the toolbar and never cause page scrolling.

*(KS-A11Y-02, KS-GEN-05)*

#### Scenario: Frame does not shift
- **WHEN** a notice appears
- **THEN** the board and toolbar keep their positions
