# Spec Delta

## MODIFIED Requirements

### Requirement: Navigation between the two screens

The player SHALL be able to move from Home to Game and back. Home's start control SHALL start a new
game in the selected mode and show the Game screen; Game's back control SHALL show Home and keep the
current game resumable. Both navigation controls SHALL be operable by pointer activation and by
keyboard, SHALL expose an accessible name describing their destination, and SHALL show a visible
focus indicator when focused. Drag is not an input path for this requirement: there is no draggable
object in the shell, and card dragging is introduced with the board in a later phase. No animation
accompanies the transition, so no reduced-motion alternative is required. *(KS-GEN-02, KS-GEN-04,
KS-A11Y-03)*

#### Scenario: Pointer navigation to Game

- **WHEN** the player activates the Home screen's start control with a pointer
- **THEN** a game in the selected mode is started, the route becomes Game and the Game screen is
  rendered

#### Scenario: Keyboard navigation to Game

- **WHEN** the player moves focus to the Home screen's start control and presses Enter or Space
- **THEN** a game in the selected mode is started, the route becomes Game and the Game screen is
  rendered

#### Scenario: Return to Home

- **WHEN** the player activates the Game screen's back control by pointer or keyboard
- **THEN** the route becomes Home, the Home screen is rendered, and a started game stays resumable

#### Scenario: Focus is visible

- **WHEN** a navigation control receives keyboard focus
- **THEN** a focus indicator is visible against the current palette

## ADDED Requirements

### Requirement: Continue game on Home

While a resumable game exists, Home SHALL show a Continue game control. Activating it SHALL show the
Game screen with that game unchanged. While no resumable game exists, the control SHALL NOT be
shown. The control SHALL be operable by pointer and by keyboard, SHALL have the accessible name
"Continue game", and SHALL show a visible focus indicator. Drag is not an input path: there is no
draggable object on Home. No animation is involved, so no reduced-motion alternative is required.
Its styling belongs to Phase 7.

*(KS-PER-02, KS-GEN-04, KS-A11Y-03)*

#### Scenario: Continue appears for a started game

- **WHEN** a started, unwon game exists and the player is on Home
- **THEN** a control named "Continue game" is shown

#### Scenario: Continue by pointer or keyboard resumes the game

- **WHEN** the player activates Continue game with a pointer, or focuses it and presses Enter or
  Space
- **THEN** the Game screen is shown and the game's position, score, moves and time are unchanged

#### Scenario: No Continue without a resumable game

- **WHEN** no game exists, or the game is unstarted or won
- **THEN** no Continue game control is shown

### Requirement: Browser storage is reached only through the storage gateway

Application source SHALL touch browser storage (`localStorage` or `sessionStorage`) only inside the
storage gateway module of the persistence feature. Every other module, and the lifecycle test that
exercises reloads, SHALL go through an injected gateway. This SHALL be checked automatically.

Input-agnostic: a structural rule.

*(new)*

#### Scenario: Storage use outside the gateway is caught

- **WHEN** a module other than the storage gateway refers to `localStorage`
- **THEN** the repository guard test fails and names the module
