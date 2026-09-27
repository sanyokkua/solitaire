# ui/notices Specification

## Purpose

Defines the small messages the game shows without interrupting play, and the single polite
announcer that tells assistive technology what happened.

## Requirements

### Requirement: Transient notices
The system SHALL show raised notices in a fixed region at the bottom right (or bottom of a narrow
screen, above the safe area), one message per notice id. The dead-end notice reads "No moves left.
Undo a few steps or deal again."; the refused-recycle notice reads "No redeals left"; the storage
notices show their existing meaning. Dead-end and refused-recycle notices SHALL disappear after
about 3.2 s; storage notices SHALL stay until dismissed and offer a Dismiss button. The dead-end and refused-recycle
messages are spoken once, through the announcer, so the host has no live region of its own for them;
each storage notice is its own polite status. Notices SHALL NOT take focus and SHALL NOT block board
input. Text is English until the
catalogs arrive.

No-motion path: the notice appears and disappears without a slide.

*(KS-AST-06, KS-MOVE-05, KS-PER-03 context)*

#### Scenario: Dead end
- **WHEN** the dead-end notice is raised
- **THEN** the message appears and is gone after about 3.2 s

#### Scenario: No redeals
- **WHEN** a Vegas recycle is refused
- **THEN** "No redeals left" appears

#### Scenario: Storage notice
- **WHEN** a storage notice is raised
- **THEN** it stays until dismissed

### Requirement: One polite announcer
The Game screen SHALL contain one polite live region, separate from the "Dealing…" status, that
speaks each new announcement in English, for example "Seven of Clubs moved to column 4", "Drew 3
cards", "Moved 12 cards to the foundations", "Turned the waste over", "Undid the last move", "Redid the move", "Hint: move the Four of
Hearts onto column 6", "That move is not possible" and "You win". Announcements SHALL not repeat on
unrelated re-renders, SHALL be spoken even when the same text repeats in a row, and SHALL work with
motion off.

*(KS-A11Y-02)*

#### Scenario: A move
- **WHEN** a card moves
- **THEN** the region reads "<Card> moved to <pile>"

#### Scenario: Same text twice
- **WHEN** two consecutive draws produce the same text
- **THEN** both are spoken

#### Scenario: Unrelated render
- **WHEN** the clock ticks
- **THEN** the region's text does not change
