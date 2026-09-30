# features/preferences Specification

## Purpose

Holds the player's settings with their documented defaults, applies changes immediately,
remembers them, and chooses the first-run language from the browser's preferred languages.

## Requirements

### Requirement: Settings and their defaults

The system SHALL hold these settings with these defaults: Theme System (Light, Dark, System); Night
cards off; Four-colour deck off; Card back Harbour blue (Harbour blue, Deep navy, Sky, Coral); Tap a
card to Smart move (Smart move, Select & place); Highlight legal moves on; Auto-move safe cards off;
Stock on the right off; Animations on; Language (the registered languages: English and Ukrainian
today); Winnable deals only on; Difficulty Any (Any, Easy, Medium, Hard); Selected mode Draw 1
(Draw 1, Draw 3, Vegas, Daily). A change SHALL take effect immediately and be remembered (see the
persistence capability). The set of allowed language values SHALL be exactly the languages
registered with the localisation layer, so registering a language makes it a valid setting with no
other change.

Difficulty is the grade a winnable deal is asked for. It SHALL be read only when a game starts, and
only for a Draw 1, Draw 3 or Vegas start with Winnable deals only on (see `features/deal-service`).
Changing it SHALL never change a game in progress, its deal or its grade.

Input-agnostic: settings are values; their controls are defined by the Settings sheet in
`ui/sheets` (pointer and keyboard), and the selected mode, the Winnable switch and the Difficulty by
`ui/home-screen`.

*(KS-SET-01, KS-I18N-03, KS-SET-06, KS-DEAL-11 (new))*

#### Scenario: First run uses the defaults

- **WHEN** the app starts with no stored data
- **THEN** every setting has its default value, and the Difficulty is Any

#### Scenario: A change applies at once

- **WHEN** the card back is set to Coral
- **THEN** the setting reads Coral immediately, without a reload

#### Scenario: Languages come from the registry

- **WHEN** the allowed language values are listed
- **THEN** they equal the registered languages, English and Ukrainian

#### Scenario: Changing the difficulty leaves the game alone

- **WHEN** the Difficulty changes from Any to Hard during a started Draw 1 game
- **THEN** the setting reads Hard immediately, the current game keeps its deal, position and grade,
  and the next winnable Draw 1 start asks for a Hard deal

### Requirement: The first-run language follows the browser

When no language has been stored, the system SHALL choose the first of the browser's preferred
languages that is one of the registered languages (matching on the primary language subtag, so
`uk-UA` selects Ukrainian), and English otherwise.

Input-agnostic: no interaction.

Deterministic: the same preferred-language list and the same registered languages always yield the
same language.

*(KS-I18N-02, KS-I18N-03)*

#### Scenario: Ukrainian browser

- **WHEN** the preferred languages are `uk-UA` then `en-US`
- **THEN** the language is Ukrainian

#### Scenario: Unsupported browser language

- **WHEN** the preferred languages are `de-DE` then `fr-FR`
- **THEN** the language is English

### Requirement: One reduced-motion signal

The system SHALL treat motion as reduced whenever Animations is off or the device asks for reduced
motion, and SHALL expose this as a single signal that every timed sequence uses.

Input-agnostic: no interaction.

*(KS-SET-04)*

#### Scenario: The device asks for reduced motion

- **WHEN** Animations is on but the device requests reduced motion
- **THEN** motion is treated as reduced

#### Scenario: Animations switched off

- **WHEN** Animations is off and the device does not request reduced motion
- **THEN** motion is treated as reduced
