# app/application-shell Specification

## Purpose
The runnable application shell that later phases extend: the two top-level screens and the route
state that switches between them, the semantic design tokens carrying the light, dark and night-card
palettes, the locally bundled typefaces, and the build identification shown to the player.

## Requirements

### Requirement: Two top-level screens

The application SHALL provide exactly two top-level screens, Home and Game, and SHALL render exactly
one of them at a time, chosen by a single route value held in application state. On first load the
Home screen SHALL be shown. *(KS-GEN-02)*

#### Scenario: First load shows Home

- **WHEN** the application is opened
- **THEN** the Home screen is rendered and the Game screen is not

#### Scenario: Exactly one screen at a time

- **WHEN** the route value is Game
- **THEN** the Game screen is rendered and no Home screen content remains in the document

### Requirement: Navigation between the two screens

The player SHALL be able to move from Home to Game and back. Both navigation controls SHALL be
operable by pointer activation and by keyboard, SHALL expose an accessible name describing their
destination, and SHALL show a visible focus indicator when focused. Drag is not an input path for
this requirement: there is no draggable object in the shell, and card dragging is introduced with the
board in a later phase. No animation accompanies the transition, so no reduced-motion alternative is
required. *(KS-GEN-02, KS-A11Y-03)*

#### Scenario: Pointer navigation to Game

- **WHEN** the player activates the Home screen's start control with a pointer
- **THEN** the route becomes Game and the Game screen is rendered

#### Scenario: Keyboard navigation to Game

- **WHEN** the player moves focus to the Home screen's start control and presses Enter or Space
- **THEN** the route becomes Game and the Game screen is rendered

#### Scenario: Return to Home

- **WHEN** the player activates the Game screen's back control by pointer or keyboard
- **THEN** the route becomes Home and the Home screen is rendered

#### Scenario: Focus is visible

- **WHEN** a navigation control receives keyboard focus
- **THEN** a focus indicator is visible against the current palette

### Requirement: Semantic colour tokens for the three palettes

The application SHALL express every colour through semantic tokens rather than literal values at the
point of use, and SHALL define a complete set of those tokens for the light palette, the dark palette
and the night-card palette of the product specification §8.1. The dark palette SHALL be selectable
independently of the operating system so it can be tested, and text colours SHALL meet a contrast
ratio of at least 4.5:1 against their surfaces. *(KS-SET-03)*

#### Scenario: Every role is defined in every palette

- **WHEN** the token definitions are inspected
- **THEN** each colour role named in specification §8.1 — page background, surface, table, text,
  muted text, primary action, accent, LCD panel and digits, hint, card face, card edge, red and black
  suit ink, four-colour suits, night-card face, edge, ink and backs, and card backs — has a value in
  the light palette, the dark palette and the night-card palette

#### Scenario: Dark palette applies without a system change

- **WHEN** the document is switched to the dark theme
- **THEN** the rendered colours come from the dark palette

#### Scenario: Components do not hard-code colour

- **WHEN** any stylesheet other than the token definitions is inspected
- **THEN** it references colour only through semantic tokens

### Requirement: Locally bundled typefaces

The application SHALL bundle the Inter and Press Start 2P typefaces within its own artifact, expose
them through semantic font tokens, and reference them by paths relative to the bundle. Their licences
and sources SHALL be documented alongside the files. *(KS-PWA-04)*

#### Scenario: Fonts resolve from the bundle

- **WHEN** the font declarations are inspected
- **THEN** each source is a path relative to the bundled asset directory and none is an absolute
  `http://` or `https://` URL

#### Scenario: Licences are recorded

- **WHEN** the bundled font directory is inspected
- **THEN** it documents each typeface's licence and upstream source

### Requirement: Build identification

The application SHALL display an identifier for the build it is running, sourced from a value fixed at
build time. When no build timestamp is supplied, a development placeholder SHALL be shown instead.
The identifier SHALL be presented as text with an accessible name, not as colour or image alone.
*(new)*

#### Scenario: Production build shows its timestamp

- **WHEN** the application is built with a build timestamp supplied
- **THEN** that timestamp is rendered in the shell

#### Scenario: Development build shows a placeholder

- **WHEN** the application is built or served with no build timestamp supplied
- **THEN** a development placeholder is rendered in its place

### Requirement: Layers reserved for later phases carry no behaviour

The pure domain layer, the solver layer, the features layer, the internationalisation layer and the
progressive-web-app layer SHALL exist as documented locations only. They SHALL contain no executable
code, no placeholder module and no stub export until the phase that implements them. *(new)*

#### Scenario: Reserved layer contains no code

- **WHEN** a layer reserved for a later phase is inspected
- **THEN** it contains only documentation stating what belongs there and which phase fills it
