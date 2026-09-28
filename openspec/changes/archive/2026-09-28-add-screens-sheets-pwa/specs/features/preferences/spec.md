# Spec Delta

## MODIFIED Requirements

### Requirement: Settings and their defaults

The system SHALL hold these settings with these defaults: Theme System (Light, Dark, System); Night
cards off; Four-colour deck off; Card back Harbour blue (Harbour blue, Deep navy, Sky, Coral); Tap a
card to Smart move (Smart move, Select & place); Highlight legal moves on; Auto-move safe cards off;
Stock on the right off; Animations on; Language (the registered languages: English and Ukrainian
today); Winnable deals only on; Selected mode Draw 1 (Draw 1, Draw 3, Vegas, Daily). A change SHALL
take effect immediately and be remembered (see the persistence capability). The set of allowed
language values SHALL be exactly the languages registered with the localisation layer, so
registering a language makes it a valid setting with no other change.

Input-agnostic: settings are values; their controls are defined by the Settings sheet in
`ui/sheets` (pointer and keyboard), and the selected mode and Winnable switch also by
`ui/home-screen`.

*(KS-SET-01, KS-I18N-03)*

#### Scenario: First run uses the defaults

- **WHEN** the app starts with no stored data
- **THEN** every setting has its default value

#### Scenario: A change applies at once

- **WHEN** the card back is set to Coral
- **THEN** the setting reads Coral immediately, without a reload

#### Scenario: Languages come from the registry

- **WHEN** the allowed language values are listed
- **THEN** they equal the registered languages, English and Ukrainian

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
