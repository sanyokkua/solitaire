# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
