# Spec Delta

## ADDED Requirements

### Requirement: An older record is upgraded without loss

A readable version 1 record SHALL be decoded whole, under version 1's own rules, and then upgraded
to version 2 by adding exactly what version 2 adds:
- the Difficulty setting, set to Any;
- a grade of none for every stored game: the current game and the game held in each undo and redo
  step.

Nothing else SHALL change: every setting, statistic, game, undo and redo step, undo charge, Daily date
and played flag SHALL be kept exactly as version 1 held it. Nothing readable SHALL be dropped. A
readable version 1 record SHALL NOT be copied to the backup key and SHALL NOT raise a notice. The next
save SHALL write version 2 over it.

A version 1 record that is not readable under version 1's own rules (malformed, invalid or
incomplete) SHALL be handled like any other unreadable record, as "Stored data is decoded
defensively" and "Unreadable data is never lost" define: the app starts with defaults, the stored
value is kept in the backup key before anything is written over it, and the notice is shown. No part
of it SHALL be salvaged.

A tab still running an earlier version of the app can later save a version 1 record over a version 2
one. The next load SHALL upgrade that record again as above, so only what version 1 cannot hold is
lost: the Difficulty setting returns to Any and the stored games carry no grade.

Input-agnostic: no interaction.

Deterministic: the upgrade is a total function, so the same version 1 record always upgrades to the
same state.

*(KS-PER-06 (new), KS-PER-01, KS-PER-02, KS-PER-03)*

#### Scenario: A version 1 record is upgraded

- **WHEN** a readable version 1 record holding custom settings, statistics and a started game with 3
  undo steps and 1 redo step is loaded
- **THEN** the settings, statistics, game and its undo and redo steps are restored exactly, the
  Difficulty setting is Any, every stored game has no grade, no notice is shown and the backup key is
  untouched

#### Scenario: The next save writes version 2

- **WHEN** a version 1 record has been upgraded and the state is then saved
- **THEN** the stored record carries version 2 and holds the Difficulty setting and each stored game's
  grade

#### Scenario: An unreadable version 1 record is not salvaged

- **WHEN** a version 1 record holds a game with a duplicated card
- **THEN** the app starts with defaults, the stored value is copied unchanged to the backup key before
  anything is written over it, the unreadable-data notice is shown, and no part of the record is kept

#### Scenario: An older tab writes version 1 back

- **WHEN** a version 2 record is stored, and a tab still running the earlier version of the app then
  saves a version 1 record over it
- **THEN** the next load upgrades that record without a notice or a backup copy, keeping everything
  that tab saved, with the Difficulty setting back to Any and no grade on its games

## MODIFIED Requirements

### Requirement: One versioned record holds what the device keeps

The system SHALL store, under the single device-storage key `solitaire.local-state`, one record
carrying a format version (2), the settings (including the Difficulty setting), the statistics and,
only while a game is resumable, that game with its newest 200 undo steps, its nearest 200 redo steps,
its undo charges, its Daily date if any, and whether it has been counted as played. Every stored game
(the current game and the game held in each undo and redo step) SHALL carry its deal's provenance,
including its grade, or none when it has no grade. A won or unstarted game SHALL NOT be stored.

Input-agnostic: no interaction.

Deterministic: the same application state always encodes to the same record.

*(KS-PER-01)*

#### Scenario: A started game is stored with its history

- **WHEN** a game has 250 undo steps and 3 redo steps and the state is saved
- **THEN** the record holds the game, its newest 200 undo steps and its 3 redo steps

#### Scenario: A won game is not stored

- **WHEN** the game is won and the state is saved
- **THEN** the record holds settings and statistics but no game

#### Scenario: The difficulty and the grade are stored

- **WHEN** the Difficulty setting is Hard, a started game graded Medium is in progress, and the state
  is saved
- **THEN** the record carries version 2, the Difficulty setting Hard and the game's grade Medium

#### Scenario: An ungraded game is stored without a grade

- **WHEN** a started game dealt from a deal code is saved
- **THEN** the stored game carries no grade

### Requirement: Stored data is decoded defensively

The system SHALL accept a stored record only if its version is known and every part is well formed.
Versions 1 and 2 are known. Each known version SHALL be decoded whole by its own rules, with its own
exact set of keys: a key that version does not define, or a key it requires that is missing, makes
the record malformed. Every part SHALL be well formed: known setting values, finite non-negative
statistics, well-formed dates, and games that pass the game-state validity check with every undo and
redo step belonging to the same deal. A readable version 1 record SHALL then be upgraded as "An older
record is upgraded without loss" defines. A record whose version is above 2 is a future version and
SHALL NOT be interpreted. The decoding SHALL never throw.

When no record exists, the system SHALL start with defaults and no notice. When a record exists but
is unreadable, malformed, invalid or of an unknown version, the system SHALL start with defaults,
keep the stored value untouched (see the next requirement) and show a non-blocking notice.

Input-agnostic: no interaction.

Deterministic: the same stored text always decodes to the same outcome.

*(KS-PER-03, KS-PER-06 (new))*

#### Scenario: First run is silent

- **WHEN** no record is stored
- **THEN** the app starts with defaults and shows no notice

#### Scenario: Corrupt data falls back to defaults

- **WHEN** the stored value is not valid JSON
- **THEN** the app starts with defaults and shows the unreadable-data notice

#### Scenario: A future version is not interpreted

- **WHEN** the stored record carries version 3
- **THEN** the app starts with defaults and shows the unreadable-data notice

#### Scenario: A current record is accepted

- **WHEN** a well-formed version 2 record is stored
- **THEN** it is restored exactly and no notice is shown

#### Scenario: A version's keys are exact

- **WHEN** a record carries version 1 but holds the Difficulty setting, or carries version 2 but lacks
  it
- **THEN** the app starts with defaults and shows the unreadable-data notice

#### Scenario: An impossible game is rejected

- **WHEN** the stored game contains a duplicated card
- **THEN** the app starts with defaults and shows the unreadable-data notice
