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

### Requirement: Semantic colour tokens for the three palettes

The application SHALL express every colour through semantic tokens rather than literal values at the
point of use, and SHALL define a complete set of those tokens for the light palette, the dark palette
and the night-card palette of the product specification §8.1. The light and dark palettes SHALL each
define every colour role; the night-card palette SHALL define the card roles only (card face, card
edge, card shadow, suit inks including the four-colour inks, and the card-back tones and rim), so
that night cards change the cards and never the page, chrome or table. The dark palette SHALL be selectable
independently of the operating system so it can be tested. Text colours SHALL meet a contrast ratio
of at least 4.5:1 against their surfaces, including the LCD digits and labels against the LCD
panel, and every suit ink — red, black, four-colour blue and
four-colour green — SHALL meet at least 4.5:1 against the card face of each palette it is used on;
a repository test SHALL fail when any such pair falls below that ratio. *(KS-SET-03, KS-A11Y-05)*

#### Scenario: Every role is defined in every palette

- **WHEN** the token definitions are inspected
- **THEN** each colour role named in specification §8.1 — page background, surface, table and its
  dot texture, slot line and slot ink, text, muted text, primary action, accent, soft outline, hover,
  chrome shadow, LCD panel, outline, digits and labels, hint, card face, card edge, card shadow, red
  and black suit ink, four-colour suits, and the two tones of each card back with the back rim — has
  a value in the light palette and the dark palette, and each card role has a value in the
  night-card palette

#### Scenario: Night-card palette leaves the page alone

- **WHEN** the night-card token definitions are inspected
- **THEN** they define no page, surface, table, text, primary, accent, LCD or hint role

#### Scenario: Dark palette applies without a system change

- **WHEN** the document is switched to the dark theme
- **THEN** the rendered colours come from the dark palette

#### Scenario: Suit inks meet the contrast floor

- **WHEN** the contrast of every suit ink against the card face of the light, dark and night-card
  palettes is computed
- **THEN** every pair is at least 4.5:1

#### Scenario: Text meets the contrast floor

- **WHEN** the contrast of the text and muted text against the surface, and of the LCD digits and
  labels against the LCD panel, is computed for the light and dark palettes
- **THEN** every pair is at least 4.5:1

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

### Requirement: Browser storage is reached only through the storage gateway

Application source SHALL touch browser storage (`localStorage` or `sessionStorage`) only inside the
storage gateway module of the persistence feature. Every other module, and the lifecycle test that
exercises reloads, SHALL go through an injected gateway. This SHALL be checked automatically.

Input-agnostic: a structural rule.

*(new)*

#### Scenario: Storage use outside the gateway is caught

- **WHEN** a module other than the storage gateway refers to `localStorage`
- **THEN** the repository guard test fails and names the module

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
