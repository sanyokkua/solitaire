# Spec Delta

## ADDED Requirements

### Requirement: The features layer depends on the app layer only through its slice, thunk type and store types

Features-layer modules SHALL import from the application layer only:
- the application slice's actions, and the selectors that read application state;
- the thunk type, imported as a type only;
- the store's state and dispatch types, imported as types only.

They SHALL NOT import the store instance or the function that creates it, the start-up lifecycle,
the typed hooks, or any other application-layer module (such as the theme controller or the assembly
of thunk dependencies). They SHALL NOT import the interface layer. This keeps the features layer
testable with its own store and free of start-up side effects.

These constraints SHALL be enforced by automated checks that fail the repository's gate on
violation.

The pure domain layer, the solver layer, the localisation layer and the offline layer remain governed
by their own isolation requirements, and the features layer's rule about solver code ("The features
layer never loads solver code on the input thread") still applies.

Input-agnostic: a structural rule. No animation.

*(new)*

#### Scenario: Importing the store instance fails the check

- **WHEN** a features module imports the store instance, or the function that creates it, from the
  application layer
- **THEN** the repository's checks fail

#### Scenario: Importing the lifecycle or the hooks fails the check

- **WHEN** a features module imports the start-up lifecycle or the typed hooks
- **THEN** the repository's checks fail

#### Scenario: Importing the interface layer fails the check

- **WHEN** a features module imports a module of the interface layer
- **THEN** the repository's checks fail

#### Scenario: The allowed imports pass

- **WHEN** a features module imports the application slice's actions, a selector over application
  state, the thunk type, and the store's state and dispatch types as types
- **THEN** the repository's checks pass

#### Scenario: The store type imported as a value fails the check

- **WHEN** a features module imports the store module as a value rather than for its types
- **THEN** the repository's checks fail

## MODIFIED Requirements

### Requirement: Build identification

The application SHALL display the build it is running, fixed when the app is built: the build number
given by continuous integration, and the date and time of the build in UTC, written
`YYYY-MM-DD HH:mm UTC`. The date and time SHALL be taken from the build machine's clock when the
build runs and converted to UTC, never from the player's clock or time zone.

A build made without a build number, such as a local build, SHALL show a development label in place
of the number, together with its build date and time. A value that the build environment supplies
empty or blank SHALL count as absent: the application SHALL never render an empty build number or an
empty identifier.

The date and time SHALL use the same language-neutral format in every language; only the words
around them are translated. The identifier SHALL be presented as text with an accessible name in the
active language, not as colour or image alone. It SHALL be shown in the Home footer and in the About
sheet next to the version, and SHALL be the same in both. The Game screen's footer shows it beside the
deal code (see `ui/game-screen`).

Input-agnostic: display only, with no interaction. No animation.

*(KS-GEN-11 (new))*

#### Scenario: Production build shows its timestamp

- **WHEN** the application is built by continuous integration with build number 128 at 14:05:30 UTC
  on 2026-09-28
- **THEN** the identifier shows the build number 128 and `2026-09-28 14:05 UTC`

#### Scenario: The time is shown in UTC

- **WHEN** the application is built with build number 129 on a machine whose local time is 01:30 on
  2026-09-29 at UTC+3
- **THEN** the identifier shows `2026-09-28 22:30 UTC`

#### Scenario: Development build shows a placeholder

- **WHEN** the application is built or served with no build number supplied, as in a local build
- **THEN** the identifier shows the development label in place of the number, with its build date and
  time in UTC

#### Scenario: An empty value counts as absent

- **WHEN** the build environment supplies an empty or blank build number
- **THEN** the identifier shows the development label and its build date and time, never an empty
  build number or an empty identifier

#### Scenario: Shown on Home and in About

- **WHEN** the Home screen is shown, and when the About sheet is opened
- **THEN** each shows the same build identifier as text

#### Scenario: The format does not follow the language

- **WHEN** the language is Ukrainian
- **THEN** the build number and the date and time read exactly as in English, only the surrounding
  words are translated, and the accessible name is in Ukrainian

### Requirement: Continue game on Home

While a resumable game exists, Home SHALL show a Continue game control. Activating it SHALL show the
Game screen with that game unchanged. While no resumable game exists, the control SHALL NOT be
shown.

The control SHALL be a tonal action button in Home's action row, directly after Deal cards and before
How to play. A tonal action button has:
- a solid fill in the theme's primary-container colour (a pale teal in the light theme, a deep blue in
  the dark theme);
- its label in the matching on-primary-container colour (navy in the light theme, pale teal in the
  dark theme), with a contrast of at least 4.5:1 against the fill;
- no outline, and the same rounded corners, minimum height, padding and bold label as How to play.

It SHALL be operable by pointer and by keyboard, SHALL have the accessible name "Continue game" in
English and its translation in the active language, SHALL show a visible focus indicator, and SHALL
be at least 44×44 px where the pointer is coarse. Drag is not an input path: there is no draggable
object on Home. Its only motion is the lift on hover and the press shared by every action button,
which are applied without transition when motion is reduced.

*(KS-PER-02, KS-GEN-04, KS-A11Y-03, KS-A11Y-04, KS-I18N-01, KS-SET-03)*

#### Scenario: Continue appears for a started game

- **WHEN** a started, unwon game exists and the player is on Home
- **THEN** a control named "Continue game" is shown between Deal cards and How to play

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

#### Scenario: The tonal style in both themes

- **WHEN** Continue game is shown in the light theme and in the dark theme
- **THEN** it is filled with the theme's primary-container colour, carries no outline, and its label
  meets at least 4.5:1 contrast against the fill

### Requirement: Semantic colour tokens for the three palettes

The application SHALL express every colour through semantic tokens rather than literal values at the
point of use, and SHALL define a complete set of those tokens for three palettes: the light palette,
the dark palette and the night-card palette. The colour roles are:
- page background, surface, the table and its dot texture, slot line and slot ink;
- text, muted text, primary action, accent, soft outline, hover and chrome shadow;
- the LCD panel, its outline, its digits and its labels, and the hint;
- card face, card edge, card shadow, red and black suit ink, the four-colour diamond and club inks,
  and the two tones of each card back with the back rim.

The light and dark palettes SHALL each define every colour role; the night-card palette SHALL define
the card roles only (card face, card edge, card shadow, suit inks including the four-colour inks, and
the card-back tones and rim), so that night cards change the cards and never the page, chrome or
table. The dark palette SHALL be selectable independently of the operating system so it can be
tested. Text colours SHALL meet a contrast ratio of at least 4.5:1 against their surfaces, including
the LCD digits and labels against the LCD panel, and every suit ink — red, black, four-colour blue and
four-colour green — SHALL meet at least 4.5:1 against the card face of each palette it is used on;
a repository test SHALL fail when any such pair falls below that ratio. *(KS-SET-03, KS-A11Y-05)*

#### Scenario: Every role is defined in every palette

- **WHEN** the token definitions are inspected
- **THEN** each colour role listed above has a value in the light palette and the dark palette, and
  each card role has a value in the night-card palette

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
