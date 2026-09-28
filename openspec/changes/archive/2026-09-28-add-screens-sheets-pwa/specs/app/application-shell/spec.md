# Spec Delta

## ADDED Requirements

### Requirement: The localisation and offline layers keep their boundaries

The localisation layer and the offline (progressive-web-app) layer SHALL contain implemented code,
and each SHALL keep a narrow boundary:
- the localisation layer SHALL depend on nothing in the application, features or interface layers,
  except that its one interface binding reads the language preference from application state;
- the features layer MAY read the localisation layer's registry of supported languages as data, and
  the pure board modules MAY refer to the translator's type only, so neither gains a behaviour
  dependency on it;
- the offline layer SHALL be used only by the application shell's start-up; the features and
  interface layers SHALL NOT import it;
- the platform's service-worker registration SHALL be reached through exactly one module of the
  offline layer, and only the application entry point SHALL load that module.

These boundaries SHALL be enforced by automated checks that fail the repository's gate on violation.

The pure domain layer, the solver layer and the features layer remain governed as before:
- the domain layer by "The pure domain layer is isolated from the rest of the application";
- the solver layer by "The solver layer is isolated from the rest of the application";
- the features layer by "The features layer never loads solver code on the input thread".

Input-agnostic: a structural rule. No animation.

*(new; supports KS-I18N-03 and KS-PWA-01…03)*

#### Scenario: The localisation layer reaching into the application fails the check

- **WHEN** a localisation module other than its interface binding imports from the application,
  features or interface layers
- **THEN** the repository's checks fail

#### Scenario: The interface importing the offline layer fails the check

- **WHEN** an interface or features module imports a module of the offline layer
- **THEN** the repository's checks fail

#### Scenario: The service-worker registration has one entry

- **WHEN** a module other than the offline layer's registration module references the platform's
  service-worker registration, or a module other than the application entry point loads that
  registration module
- **THEN** the repository's checks fail

#### Scenario: Reading the language registry is allowed

- **WHEN** the preferences feature reads the list of supported languages from the localisation
  registry
- **THEN** the repository's checks pass

#### Scenario: The domain, solver and features layers keep their own rules

- **WHEN** the domain, solver or features layer is inspected
- **THEN** it is checked by its own isolation requirement and contains implemented modules

## REMOVED Requirements

### Requirement: Layers reserved for later phases carry no behaviour

**Reason**: The localisation and offline layers now hold implemented code, so a rule that they stay
empty no longer applies.

**Migration**: Replaced by "The localisation and offline layers keep their boundaries", which keeps
the domain, solver and features layers under their own isolation requirements and adds import
boundaries for the two layers; the repository test that checked the reserved layers is replaced by a
layer-boundary test.

## MODIFIED Requirements

### Requirement: Navigation between the two screens

The player SHALL be able to move from Home to Game and back:
- Home's Deal cards control SHALL start a new game in the selected mode and show the Game screen;
- Game's Back control SHALL show Home and keep the current game resumable;
- the Win sheet's Menu control SHALL close the sheet and show Home, and its Deal again control SHALL
  deal a new game in the won game's mode on the Game screen.

Every route and sheet change SHALL be made through the application's navigation intents, so each
entry point (control, shortcut or sheet action) produces the same result.

Every navigation control SHALL be operable by pointer activation and by keyboard, SHALL expose an
accessible name, in the active language, describing its destination ("Deal cards", "Back to Home",
"Menu" and "Deal again" in English), and SHALL show a visible focus indicator when focused. Drag is
not an input path for this requirement: these controls are buttons, not draggable objects. No
animation accompanies a route change, so no reduced-motion alternative is required; the Win sheet's
own motion follows `ui/sheets`.

*(KS-GEN-02, KS-GEN-04, KS-A11Y-03, KS-I18N-01)*

#### Scenario: Pointer navigation to Game

- **WHEN** the player activates the Home screen's Deal cards control with a pointer
- **THEN** a game in the selected mode is started, the route becomes Game and the Game screen is
  rendered

#### Scenario: Keyboard navigation to Game

- **WHEN** the player moves focus to the Home screen's Deal cards control and presses Enter or Space
- **THEN** a game in the selected mode is started, the route becomes Game and the Game screen is
  rendered

#### Scenario: Return to Home

- **WHEN** the player activates the Game screen's Back control by pointer or keyboard
- **THEN** the route becomes Home, the Home screen is rendered, and a started game stays resumable

#### Scenario: Menu on the Win sheet

- **WHEN** the Win sheet is open and the player activates Menu by pointer or by keyboard
- **THEN** the sheet closes and the Home screen is rendered

#### Scenario: Deal again on the Win sheet

- **WHEN** a Vegas game has been won and the player activates Deal again
- **THEN** the sheet closes and a new Vegas game is started on the Game screen

#### Scenario: Names follow the language

- **WHEN** the language is Ukrainian
- **THEN** the Back control's accessible name is the Ukrainian translation of "Back to Home"

#### Scenario: Focus is visible

- **WHEN** a navigation control receives keyboard focus
- **THEN** a focus indicator is visible against the current palette

### Requirement: Continue game on Home

While a resumable game exists, Home SHALL show a Continue game control. Activating it SHALL show the
Game screen with that game unchanged. While no resumable game exists, the control SHALL NOT be
shown. The control SHALL be styled as the mockup's tonal action button beside Deal cards. It SHALL be
operable by pointer and by keyboard, SHALL have the accessible name "Continue game" in English and
its translation in the active language, SHALL show a visible focus indicator, and SHALL be at least
44×44 px where the pointer is coarse. Drag is not an input path: there is no draggable object on
Home. No animation is involved, so no reduced-motion alternative is required.

*(KS-PER-02, KS-GEN-04, KS-A11Y-03, KS-A11Y-04, KS-I18N-01)*

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

#### Scenario: Continue in Ukrainian

- **WHEN** the language is Ukrainian and a resumable game exists
- **THEN** the control's accessible name is the Ukrainian translation of "Continue game"

### Requirement: Build identification

The application SHALL display an identifier for the build it is running, sourced from a value fixed at
build time. When no build timestamp is supplied, a development placeholder SHALL be shown instead.
The identifier SHALL be presented as text with an accessible name, not as colour or image alone. It
SHALL be shown in the Home footer, in the Game footer where the footer is displayed, and in the
About sheet next to the version.

Input-agnostic: display only, with no interaction.

*(new; spec §3.1 footer and §3.3 About)*

#### Scenario: Production build shows its timestamp

- **WHEN** the application is built with a build timestamp supplied
- **THEN** that timestamp is rendered in the shell

#### Scenario: Development build shows a placeholder

- **WHEN** the application is built or served with no build timestamp supplied
- **THEN** a development placeholder is rendered in its place

#### Scenario: Shown on Home and in About

- **WHEN** the Home screen is shown, and when the About sheet is opened
- **THEN** each shows the same build identifier as text
