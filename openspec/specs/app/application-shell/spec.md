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

The internationalisation layer and the progressive-web-app layer SHALL exist as documented
locations only. They SHALL contain no executable code, no placeholder module and no stub export
until the phase that implements them.

The pure domain layer, the solver layer and the features layer are not reserved:
- the domain layer is governed by "The pure domain layer is isolated from the rest of the
  application";
- the solver layer by "The solver layer is isolated from the rest of the application";
- the features layer by "The features layer never loads solver code on the input thread".

*(new)*

#### Scenario: Reserved layer contains no code

- **WHEN** a layer reserved for a later phase is inspected
- **THEN** it contains only documentation stating what belongs there and which phase fills it

#### Scenario: The domain layer is not reserved

- **WHEN** the pure domain layer is inspected
- **THEN** it contains implemented modules, and it is not treated as a reserved layer

#### Scenario: The solver and features layers are not reserved

- **WHEN** the solver layer or the features layer is inspected
- **THEN** it is not treated as a reserved layer, so it may contain implemented modules

### Requirement: The pure domain layer is isolated from the rest of the application

The pure domain layer SHALL import only its own modules. It SHALL NOT reference the user interface
framework, the state-management library, the document, the window, any storage mechanism, any
network facility, or the platform's unseeded random number source. The only permitted platform
dependency SHALL be the cryptographic entropy source, confined to one module and supplied as a
replaceable parameter. The layer SHALL contain exactly the modules its `README.md` lists. These
constraints SHALL be enforced by automated checks that fail the repository's gate on violation.
*(new)*

#### Scenario: A dependency on another layer fails the check

- **WHEN** a domain module is given an import that reaches outside the domain layer
- **THEN** the repository's checks fail

#### Scenario: A platform dependency fails the check

- **WHEN** a domain module references the document, the window, a storage mechanism, a network
  facility or the unseeded random number source
- **THEN** the repository's checks fail

#### Scenario: The entropy source is confined and injectable

- **WHEN** the domain layer's use of the cryptographic entropy source is inspected
- **THEN** it appears in exactly one module and is reached through a replaceable parameter rather
  than directly at every call site

#### Scenario: The layer holds exactly its documented modules

- **WHEN** the domain layer's contents are compared against its documentation
- **THEN** every documented module is present and no undocumented module exists

### Requirement: The solver layer is isolated from the rest of the application

The solver layer SHALL import only its own modules and modules of the pure domain layer.

It SHALL NOT reference any of these:
- the user interface framework;
- the state-management library;
- the document or the window;
- any storage mechanism;
- any network facility;
- the platform's unseeded random number source;
- the cryptographic entropy source.

Only the background-thread entry module SHALL reference the worker's global scope.

The layer SHALL contain exactly the modules its `README.md` lists. These constraints SHALL be
enforced by automated checks that fail the repository's gate on violation.

*(new)*

#### Scenario: A dependency outside the solver and domain layers fails the check

- **WHEN** a solver module is given an import that reaches outside the solver and domain layers
- **THEN** the repository's checks fail

#### Scenario: A platform dependency fails the check

- **WHEN** a solver module references any of these:
  - the document or the window;
  - a storage mechanism or a network facility;
  - the unseeded random number source or the cryptographic entropy source;
- **THEN** the repository's checks fail

#### Scenario: The worker scope is confined to the entry module

- **WHEN** a solver module other than the background-thread entry references the worker's global
  scope
- **THEN** the repository's checks fail

#### Scenario: The layer holds exactly its documented modules

- **WHEN** the solver layer's contents are compared against its documentation
- **THEN** every documented module is present and no undocumented module exists

### Requirement: The features layer never loads solver code on the input thread

Features-layer modules SHALL NOT import solver modules as values. They MAY:
- import types from solver modules, since type-only imports are erased at build time;
- reference the background-thread entry, but only as a worker URL.

This keeps the search off the input thread and out of the main bundle. Linting SHALL enforce it.

*(new, KS-DEAL-10)*

#### Scenario: A value import of the search fails lint

- **WHEN** a features module imports the search or selection function from the solver layer as a
  value
- **THEN** linting fails

#### Scenario: A type-only import passes

- **WHEN** a features module imports only types from the solver layer
- **THEN** linting passes
