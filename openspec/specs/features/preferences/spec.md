# features/preferences Specification

## Purpose

Holds the player's settings with the defaults of specification §6, applies changes immediately,
remembers them, and chooses the first-run language from the browser's preferred languages.

## Requirements

### Requirement: Settings and their defaults

The system SHALL hold these settings with these defaults: Theme System (Light, Dark, System); Night
cards off; Four-colour deck off; Card back Harbour blue (Harbour blue, Deep navy, Sky, Coral); Tap a
card to Smart move (Smart move, Select & place); Highlight legal moves on; Auto-move safe cards off;
Stock on the right off; Animations on; Language (English, Ukrainian); Winnable deals only on; Selected
mode Draw 1 (Draw 1, Draw 3, Vegas, Daily). A change SHALL take effect immediately and be remembered
(see the persistence capability).

Input-agnostic: settings are values; their controls arrive in Phase 7.

*(KS-SET-01)*

#### Scenario: First run uses the defaults

- **WHEN** the app starts with no stored data
- **THEN** every setting has its default value

#### Scenario: A change applies at once

- **WHEN** the card back is set to Coral
- **THEN** the setting reads Coral immediately, without a reload

### Requirement: The first-run language follows the browser

When no language has been stored, the system SHALL choose the first of the browser's preferred
languages that it supports (matching on the primary language subtag, so `uk-UA` selects Ukrainian),
and English otherwise.

Input-agnostic: no interaction.

Deterministic: the same preferred-language list always yields the same language.

*(KS-I18N-02)*

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
