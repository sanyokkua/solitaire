# app/appearance Specification

## Purpose
Applies the player's appearance preferences — theme, night cards, four-colour deck, card back and
motion — to the whole page, so every screen renders the chosen palette and motion level.

## Requirements

### Requirement: The theme follows the preference, including System

The page SHALL render with the light or the dark palette according to the Theme preference. Light and
Dark SHALL apply regardless of the device setting. System SHALL follow the device's colour-scheme
preference and SHALL switch palettes live, without a reload, when the device setting changes while
the app is open. A theme change SHALL keep the game in progress unchanged.

Input-agnostic: the preference is changed through the settings (Phase 7) or restored from storage;
this requirement covers how a stored value is applied, not how it is entered. Changing the palette
is not an animation beyond the existing 250 ms background-colour transition, which is disabled with
the rest of motion when motion is reduced.

*(KS-SET-02, KS-SET-03)*

#### Scenario: Dark theme regardless of the device

- **WHEN** the Theme preference is Dark and the device prefers a light colour scheme
- **THEN** the page renders with the dark palette

#### Scenario: System follows the device live

- **WHEN** the Theme preference is System and the device switches from a light to a dark colour scheme
  while the Game screen is shown
- **THEN** the page switches to the dark palette without a reload, the game position and moves are
  unchanged, and the score and time carry on from their earlier values without being reset

#### Scenario: Restored preference is applied before first use

- **WHEN** the app starts with a stored Theme preference of Dark
- **THEN** the first rendered screen uses the dark palette

### Requirement: Night cards change the cards only

While Night cards is on, card faces, card edges, suit inks, card shadows and card backs SHALL use the
night-card palette, and every other surface (page, chrome, table and LCD) SHALL keep the colours of
the current theme. The cards include Home's mode cards, which are drawn as playing cards. Night
cards SHALL apply with either theme.

The night-card palette SHALL look like this:
- card faces are dark navy with a lighter steel-blue edge, and cast a deeper shadow than day cards;
- inks are light: a soft rose red for hearts and diamonds and a pale blue-white for spades and clubs,
  including the corner indices, pips and face-card letters;
- with Four-colour deck on, diamonds are a light sky blue and clubs a light mint green;
- the Harbour blue, Sky and Coral backs all render in one pale steel-blue two-tone checker with a
  dark navy rim;
- the Deep navy back renders in its own darker navy two-tone checker with a light steel-blue rim, so
  it stays visible against the dark night face.

Every night ink SHALL meet a contrast ratio of at least 4.5:1 against the night card face (see
application-shell "Semantic colour tokens for the three palettes"), and face-down cards SHALL stay
clearly distinct from face-up cards.

Input-agnostic: applies a stored preference. Switching Night cards on or off changes colours only and
adds no animation.

*(KS-SET-03, KS-A11Y-05; night-card scope and back overrides (new))*

#### Scenario: Night cards with the light theme

- **WHEN** the theme is Light and Night cards is on
- **THEN** cards render with the dark navy night face, its lighter edge and the light inks, and the
  page, chrome, table and LCD keep their light-palette colours

#### Scenario: Night cards with the dark theme

- **WHEN** the theme is Dark and Night cards is on
- **THEN** cards render with the night face, edge and inks, and the page, chrome, table and LCD keep
  their dark-palette colours

#### Scenario: Night inks stay readable

- **WHEN** Night cards is on, with and without Four-colour deck
- **THEN** every suit ink meets at least 4.5:1 against the night card face

#### Scenario: Night cards override the pale backs

- **WHEN** Night cards is on and the card back is Harbour blue, Sky or Coral
- **THEN** face-down cards render in the pale steel-blue night back with a dark navy rim

#### Scenario: Deep navy keeps a night variant

- **WHEN** Night cards is on and the card back is Deep navy
- **THEN** face-down cards render in the darker navy night variant with a light steel-blue rim

### Requirement: Four-colour deck and card back selection

While Four-colour deck is on, diamonds SHALL render in blue and clubs in green, while hearts stay red
and spades stay black, in every palette including night cards. The Card back preference SHALL select
one of Harbour blue, Deep navy, Sky or Coral for every face-down card. Suits SHALL remain
distinguishable by their shapes with or without the four-colour deck.

Input-agnostic: applies a stored preference.

*(KS-A11Y-05; four-colour deck and card backs; see src/app/themeController.ts)*

#### Scenario: Four colours

- **WHEN** Four-colour deck is on
- **THEN** diamond cards render in the four-colour blue ink and club cards in the four-colour green
  ink, and hearts and spades keep red and black

#### Scenario: Card back choice

- **WHEN** the Card back preference is Coral and Night cards is off
- **THEN** every face-down card renders with the Coral back

### Requirement: The page exposes one motion flag

The page SHALL expose whether motion is reduced as a single document-level state derived from the
one reduced-motion signal (Animations off, or the device requesting reduced motion). Every animated
element SHALL read motion only from this state; no stylesheet SHALL consult the device's
reduced-motion media query on its own. When the signal changes, the flag SHALL update without a
reload.

Input-agnostic: no interaction.

*(KS-SET-04)*

#### Scenario: Device requests reduced motion

- **WHEN** Animations is on and the device requests reduced motion
- **THEN** the page's motion flag is off

#### Scenario: Animations switched on again

- **WHEN** the device does not request reduced motion and Animations changes from off to on
- **THEN** the page's motion flag changes to on without a reload
