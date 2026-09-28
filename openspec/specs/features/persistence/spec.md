# features/persistence Specification

## Purpose

Keeps settings, statistics and the unfinished game on the device in one versioned record, restores
them exactly, never loses data it cannot read, keeps the game playable when saving fails, and clears
everything on request.

## Requirements

### Requirement: One versioned record holds what the device keeps

The system SHALL store, under the single device-storage key `solitaire.local-state`, one record
carrying a format version (1), the settings, the statistics and, only while a game is resumable,
that game with its newest 200 undo steps, its nearest 200 redo steps, its undo charges, its Daily
date if any, and whether it has been counted as played. A won or unstarted game SHALL NOT be stored.

Input-agnostic: no interaction.

Deterministic: the same application state always encodes to the same record.

*(KS-PER-01)*

#### Scenario: A started game is stored with its history

- **WHEN** a game has 250 undo steps and 3 redo steps and the state is saved
- **THEN** the record holds the game, its newest 200 undo steps and its 3 redo steps

#### Scenario: A won game is not stored

- **WHEN** the game is won and the state is saved
- **THEN** the record holds settings and statistics but no game

### Requirement: Reopening restores the unfinished game exactly

When the app is opened with a stored resumable game, the system SHALL load it before the first screen
is shown, offer it through Continue game, and restore it exactly: cards, move score, undo charges,
moves, passes, elapsed time, deal code and provenance, and its stored undo and redo steps. The app
SHALL still open on Home.

Input-agnostic: loading happens at start-up; Continue game's controls are covered by the application
shell.

Deterministic: decoding a record produced from a state yields that same state.

*(KS-PER-02)*

#### Scenario: Reload restores an identical game

- **WHEN** the player makes 10 moves, undoes one, and the app is reloaded
- **THEN** after Continue game the cards, score, moves, time, deal code and the undo and redo steps
  are identical to those before the reload

### Requirement: Stored data is decoded defensively

The system SHALL accept a stored record only if its version is known and every part is well formed:
known setting values, finite non-negative statistics, well-formed dates, and games that pass the
game-state validity check with every undo and redo step belonging to the same deal. The decoding
SHALL never throw.

When no record exists, the system SHALL start with defaults and no notice. When a record exists but
is unreadable, malformed, invalid or of an unknown version, the system SHALL start with defaults,
keep the stored value untouched (see the next requirement) and show a non-blocking notice.

Input-agnostic: no interaction.

Deterministic: the same stored text always decodes to the same outcome.

*(KS-PER-03)*

#### Scenario: First run is silent

- **WHEN** no record is stored
- **THEN** the app starts with defaults and shows no notice

#### Scenario: Corrupt data falls back to defaults

- **WHEN** the stored value is not valid JSON
- **THEN** the app starts with defaults and shows the unreadable-data notice

#### Scenario: A future version is not interpreted

- **WHEN** the stored record carries version 2
- **THEN** the app starts with defaults and shows the unreadable-data notice

#### Scenario: An impossible game is rejected

- **WHEN** the stored game contains a duplicated card
- **THEN** the app starts with defaults and shows the unreadable-data notice

### Requirement: Unreadable data is never lost

Before anything is written over an unreadable or unknown-version record, the system SHALL copy the
stored value unchanged to the backup key `solitaire.local-state.unreadable` and then continue saving
normally. If the backup key already holds a different value, or the copy cannot be written, the
system SHALL NOT write the record at all for the rest of the session. The game SHALL stay playable,
and the notice SHALL say that progress will not be kept.

Input-agnostic: no interaction.

When the stored record or the backup key cannot be read at all (storage unavailable or blocked), what is stored is
unknown, so the system SHALL start with defaults, write nothing for the session and show the not-saving notice.

*(KS-PER-03)* *(new: the backup key)* *(new: the user approved never overwriting what could not be read)*

#### Scenario: The unreadable value is backed up

- **WHEN** an unreadable record is found and the player then changes a setting
- **THEN** the backup key holds the original value unchanged and the record holds the new state

#### Scenario: An occupied backup blocks saving

- **WHEN** an unreadable record is found and the backup key already holds a different value
- **THEN** nothing is written to either key during the session and the not-saving notice is shown

#### Scenario: Unreadable storage blocks saving

- **WHEN** storage refuses reads
- **THEN** the app starts with defaults, nothing is written during the session and the not-saving notice is shown

### Requirement: Saving keeps up with play and survives leaving the page

The system SHALL save the record within 250 ms of the last change to the settings, the statistics or
the game, except that a change to the elapsed time alone SHALL be saved at most once every 5
seconds. It SHALL save at once when the page is hidden or being left.

Input-agnostic: no interaction.

*(KS-PER-01, KS-PER-02)* *(new: timings)*

#### Scenario: A burst of moves is saved once

- **WHEN** five moves are made within 100 ms of each other
- **THEN** the record is written once, 250 ms after the last move

#### Scenario: Leaving the page saves immediately

- **WHEN** a move is made and the page is hidden 50 ms later
- **THEN** the record holding that move is written without waiting

### Requirement: A failed save keeps the game playable

If writing the record fails (for example storage is full or has become unavailable), the system SHALL keep the
current game playable, show one non-blocking notice that progress may not be kept, and try again at
the next save. The notice SHALL NOT repeat for further failures until a save succeeds again.

Input-agnostic: no interaction.

*(KS-PER-04)*

#### Scenario: Storage quota exceeded

- **WHEN** storage refuses every write while the player makes several moves
- **THEN** every move is still applied and exactly one save-failure notice is shown

### Requirement: Reset all local data restores defaults

When the player confirms Reset all local data, the system SHALL cancel any pending save, remove the
record and the backup key, restore every default setting (choosing the language again from the
browser), clear all statistics, discard the current game and stop any running sequence or pending
deal, close any open sheet, dismiss the storage notices (`storage-read`, `storage-read-only` and
`storage-write`; `update-ready` and `code-copied` are unaffected), return to Home, and resume normal
saving.

The reset SHALL be reachable from the Data group of the Settings sheet and SHALL run only after an
explicit confirmation; declining or leaving the confirmation SHALL change nothing. After the reset
the Home screen SHALL show the default settings in the language chosen from the browser.

Input-agnostic: the reset is one command; its confirmation control is defined by `ui/sheets` and
works by pointer and keyboard.

*(KS-PER-05, KS-I18N-02)*

#### Scenario: Reset all during a game

- **WHEN** the player resets all local data during a started game with custom settings
- **THEN** the stored record and backup are gone, settings are defaults, no game is resumable, the
  route is Home, and a stale pending save does not bring the old data back

#### Scenario: Nothing happens without confirmation

- **WHEN** the player starts Reset all local data in Settings and then cancels the confirmation
- **THEN** the stored record, settings, statistics and game are unchanged

#### Scenario: Language comes back from the browser

- **WHEN** the language was set to English, the browser prefers `uk-UA`, and the player confirms the
  reset
- **THEN** Home is shown in Ukrainian with every other setting at its default

### Requirement: The game is saved on demand before an update

A save request SHALL write the current record at once, even inside the 250 ms debounce window or the
5-second elapsed-time window, and SHALL cancel the pending timed save it replaces. While saving is
read-only for the session, a save request SHALL write nothing and SHALL still complete, so the
caller is never blocked. A save request whose write fails SHALL follow "A failed save keeps the game
playable", writing nothing.

The requesting update flow SHALL proceed whether or not the on-demand save writes anything: the
update-ready notice (specified in `ui/notices`) warns in advance, from the session's saving state at
the moment it is shown, when the game will not be kept; a save that is refused or fails only at the
moment of the request adds no further warning, and choosing Update still activates the new version.

Input-agnostic: requested by the system before a new version activates (see
`pwa/offline-install-update`), not by a player control.

*(KS-PWA-03, KS-PER-01, KS-PER-04)*

#### Scenario: A save inside the debounce window

- **WHEN** a move is made and a save is requested 50 ms later
- **THEN** the record holding that move is written immediately, and no second write follows at
  250 ms

#### Scenario: Read-only session

- **WHEN** saving is read-only for the session and a save is requested
- **THEN** nothing is written and the request completes

#### Scenario: Update proceeds after a refused or failed save

- **WHEN** an update is chosen while saving is read-only, or the on-demand save fails to write
- **THEN** nothing is written and the new version still activates; the update-ready notice has already
  warned when the session's saving was already read-only or previously failing before the notice
  appeared
