# ui/notices Specification

## Purpose

Defines the small messages the game shows without interrupting play, and the single polite
announcer that tells assistive technology what happened.

## Requirements

### Requirement: Transient notices
The system SHALL show raised notices in one fixed region at the bottom right (or bottom of a narrow
screen), kept clear of the safe areas, one message per notice id. The notices host SHALL be shown
on every screen (Home and Game), so notices raised at start-up are seen on Home. Every notice text
SHALL come from the active language and SHALL change at once when the language changes. In English
the dead-end notice reads "No moves left. Undo a few steps or deal again."; the refused-recycle
notice reads "No redeals left"; the code-copied notice reads "Deal code copied"; the storage notices
show their existing meaning. Dead-end, refused-recycle and code-copied notices SHALL disappear after
about 3.2 s; storage notices SHALL stay until dismissed and offer a Dismiss button; the update-ready
notice is covered by "Update-ready notice". The dead-end, refused-recycle and code-copied messages
are spoken once, through the announcer, so the host has no live region of its own for them; each
storage notice is its own polite status. Notices SHALL NOT take focus and SHALL NOT block board
input. The Dismiss button SHALL be operable by pointer and keyboard and show a visible focus
indicator; drag is not an input path.

No-motion path: the notice appears and disappears without a slide.

*(KS-AST-06, KS-MOVE-05, KS-PER-03 context, KS-PER-04, KS-DEAL-02 copy confirmation, KS-GEN-10,
KS-I18N-01)*

#### Scenario: Dead end
- **WHEN** the dead-end notice is raised
- **THEN** the message appears and is gone after about 3.2 s

#### Scenario: No redeals
- **WHEN** a Vegas recycle is refused
- **THEN** "No redeals left" appears

#### Scenario: Storage notice
- **WHEN** a storage notice is raised
- **THEN** it stays until dismissed

#### Scenario: Storage notice on Home
- **WHEN** stored data is unreadable at start-up and Home is shown
- **THEN** the storage notice is shown on Home

#### Scenario: Code copied
- **WHEN** the deal code is copied
- **THEN** "Deal code copied" appears and is gone after about 3.2 s

#### Scenario: Language switch
- **WHEN** a storage notice is shown and the language changes to Ukrainian
- **THEN** the notice reads its Ukrainian text at once

### Requirement: One polite announcer
The application SHALL contain one polite live region, separate from the Game screen's "Dealing…"
status and mounted once beside the current screen, outside the part made inert while a sheet is open
(see `ui/game-screen` "Notices host and announcer are part of the frame"), that speaks each new
announcement in the active language, with plural forms correct for that language.
In English, for example: "Seven of Clubs moved to column 4", "Drew 3 cards", "Moved 12 cards to the
foundations", "Turned the waste over", "Undid the last move", "Redid the move", "Hint: move the Four
of Hearts onto column 6", "That move is not possible", "Deal code copied" and "You win".
Announcements SHALL not repeat on unrelated re-renders, SHALL be spoken even when the same text
repeats in a row, and SHALL work with motion off.

*(KS-A11Y-02, KS-I18N-01)*

#### Scenario: A move
- **WHEN** a card moves
- **THEN** the region reads "<Card> moved to <pile>"

#### Scenario: Same text twice
- **WHEN** two consecutive draws produce the same text
- **THEN** both are spoken

#### Scenario: Unrelated render
- **WHEN** the clock ticks
- **THEN** the region's text does not change

#### Scenario: Ukrainian plurals
- **WHEN** the language is Ukrainian and Finish sends 2, then 5, cards home
- **THEN** each announcement uses the Ukrainian plural form for its count

### Requirement: Update-ready notice

When a new version of the application is ready, the system SHALL show the update-ready notice, saying in the active language that a new version
is ready, with two buttons, Update and Later. The
notice SHALL stay until one of them is used and SHALL NOT be dismissed by a timer. It SHALL be its
own polite status, so it is announced once when it appears. Update SHALL start the update as
`pwa/offline-install-update` defines (the game is saved first); Later SHALL dismiss the notice for
the rest of the session. WHEN saving is read-only or the last save failed, the notice's text SHALL
also warn that the current game will not be kept; Update SHALL still apply the new version in that
case. Both buttons SHALL be operable by pointer and by keyboard (Enter or Space
when focused), SHALL have accessible names in the active language, SHALL show a visible focus
indicator, and SHALL be at least 44×44 px where the pointer is coarse. Drag is not an input path:
they are buttons. The notice SHALL NOT take focus when it appears and SHALL NOT block board input.

No-motion path: the notice appears and disappears without a slide.

*(KS-PWA-03, KS-A11Y-02, KS-A11Y-03, KS-A11Y-04, KS-I18N-01)*

#### Scenario: The notice waits for the player

- **WHEN** an update becomes ready and 10 seconds pass
- **THEN** the update-ready notice is still shown with Update and Later

#### Scenario: Later by keyboard

- **WHEN** Later is focused and Enter is pressed
- **THEN** the notice is dismissed and does not return in this session

#### Scenario: Update by pointer

- **WHEN** the player taps Update
- **THEN** the game is saved and the update starts

#### Scenario: Focus is not taken

- **WHEN** the notice appears while a card is focused
- **THEN** focus stays on the card

#### Scenario: Warns when the game will not be kept

- **WHEN** an update becomes ready while saving is read-only, or the last save failed
- **THEN** the notice's text warns that the current game will not be kept, and Update still applies
  the new version
