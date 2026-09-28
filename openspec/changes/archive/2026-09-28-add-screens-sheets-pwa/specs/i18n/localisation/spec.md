# Spec Delta

## Purpose

Defines how every piece of player-facing text is provided in English and Ukrainian, how the active
language is switched and remembered, and how a new language is added without touching screens or
components.

## ADDED Requirements

### Requirement: All player-facing text in English and Ukrainian

The system SHALL provide every visible string, every accessible name and description, every
live-region announcement, every notice and every sheet text in English and in Ukrainian. This covers
Home, the Game screen, every sheet, the notices, card names ("Queen of Spades" / "Дама пік"), pile
names ("Column 3, 5 cards"), the hint line, the deal and mode chips and the build-stamp label. No
player-facing string SHALL be written into a screen or component outside the language catalogs, so
rendering every screen and sheet with a test-only language whose every message is marked proves that
no unmarked text remains. Only language-neutral values stay the same in every language: digits,
zero-padded counters, the `m:ss` / `h:mm:ss` time, the `$47` / `-$52` Vegas bank, deal codes and the
product name "Solitaire" in the wordmark.

Input-agnostic: text content does not depend on how the player interacts. No animation.

*(KS-I18N-01, KS-A11Y-01 and KS-A11Y-02 names and announcements in the active language)*

#### Scenario: Ukrainian screens

- **WHEN** the language is Ukrainian and the player opens Home, the Game screen and each sheet
- **THEN** every visible label, button, heading, caption and message is Ukrainian

#### Scenario: Ukrainian accessible names and announcements

- **WHEN** the language is Ukrainian and a card is moved to a column
- **THEN** the card and pile accessible names are Ukrainian and the polite announcement is spoken in
  Ukrainian

#### Scenario: No text outside the catalogs

- **WHEN** Home, the Game screen and every sheet are rendered with a test-only language that marks
  every message
- **THEN** every visible text node and accessible name carries the mark, apart from the
  language-neutral values

### Requirement: Switching language applies at once and is remembered

WHEN the player selects a language in Settings, the system SHALL show every visible text, accessible
name and later announcement in that language at once, without a reload, and without closing or
resetting the open Settings sheet, the running game, the selection or the timer. Text inside an open
sheet SHALL change in place, and focus SHALL stay on the Language control. The chosen language SHALL
be remembered, so the next start uses it without consulting the browser. A language switch SHALL NOT
change the game, the score, the statistics or any other setting.

Input-agnostic: the language is chosen through the Settings Language control, whose tap and keyboard
coverage is defined in `ui/sheets`; the outcome here does not depend on the input. No animation
accompanies the switch.

*(KS-I18N-01, KS-SET-01)*

#### Scenario: Switch inside the open sheet

- **WHEN** Settings is open in English and the player selects Українська
- **THEN** the Settings heading, rows and buttons read in Ukrainian at once, Settings stays open and
  focus stays on the Language control

#### Scenario: Remembered after reload

- **WHEN** the player selects Українська and reloads the page
- **THEN** the app starts in Ukrainian

#### Scenario: Game unaffected

- **WHEN** the language is switched during a game
- **THEN** the cards, score, moves, time and undo history are unchanged

### Requirement: First-run text follows the chosen language

WHEN the app starts with no stored language, the system SHALL show all text in the language chosen
from the browser's preferred languages (the first supported one, otherwise English, as the
preferences capability selects it), from the first rendered frame, with no visible English flash
before a Ukrainian first run.

Input-agnostic: no player input is involved. No animation.

*(KS-I18N-02)*

#### Scenario: Ukrainian browser

- **WHEN** the app starts for the first time with preferred languages `uk-UA`, `en-US`
- **THEN** Home is shown in Ukrainian

#### Scenario: Unsupported browser language

- **WHEN** the app starts for the first time with preferred languages `de-DE`, `fr-FR`
- **THEN** Home is shown in English

### Requirement: The document follows the active language

The system SHALL set the document's language attribute to the active language's code (`en` or `uk`)
and the document title to that language's app title, at start and on every language change, so
screen readers pronounce text with the right voice and the browser tab shows the localised title.

Input-agnostic: a document-level effect of the language setting. No animation.

*(KS-I18N-01; KS-A11Y-01 pronunciation (new))*

#### Scenario: Language attribute and title

- **WHEN** the language changes from English to Ukrainian
- **THEN** the document language attribute becomes `uk` and the document title becomes the Ukrainian
  title

### Requirement: Plural forms follow each language's rules

The system SHALL choose the plural form of every counted message (cards, moves, shuffles, days) by
the plural rules of the active language, and SHALL NOT build plurals or change letter case by string
manipulation. English SHALL use its one/other forms; Ukrainian SHALL use its one/few/many forms.

Input-agnostic: text formatting only. No animation.

*(KS-I18N-01; plural correctness (new))*

#### Scenario: English cards

- **WHEN** the language is English and a pile holds 1 or 5 cards
- **THEN** its name reads "1 card" or "5 cards"

#### Scenario: Ukrainian cards

- **WHEN** the language is Ukrainian and a pile holds 1, 2, 5, 11 or 21 cards
- **THEN** its name uses "1 карта", "2 карти", "5 карт", "11 карт" and "21 карта"

### Requirement: Adding a language needs one catalog and one registration

The system SHALL keep one translation catalog per language and one registry of supported languages,
each entry giving the language code, its own display name and its catalog. Adding a language SHALL
require only adding its catalog and registering it: no screen or component changes. The Settings
Language control and the set of languages accepted for the stored language and for the first-run
choice SHALL be built from that registry, so a registered language appears in Settings, labelled by
its own name, and can be stored and chosen at first run without further changes.

Input-agnostic: a structural requirement. No animation.

*(KS-I18N-03)*

#### Scenario: Settings lists the registry

- **WHEN** Settings is opened
- **THEN** the Language control offers exactly the registered languages, each labelled with its own
  name ("English", "Українська"), in registry order

#### Scenario: A registered language needs no component change

- **WHEN** the registry is replaced by a module mock containing a third language
- **THEN** the Settings Language control lists it, labelled with its own name, with no component
  change

### Requirement: Every language provides every message

Every catalog SHALL provide every message that the English catalog defines, with the same
placeholders and plural categories required by its language. A catalog missing a message SHALL fail
the type check, so it cannot be built. At runtime, as a further safeguard, a message missing from the
active catalog SHALL fall back to its English text rather than showing a key or an empty string.

Input-agnostic: a completeness requirement. No animation.

*(KS-I18N-01, KS-I18N-03; build-time completeness and runtime fallback (new))*

#### Scenario: Missing Ukrainian message

- **WHEN** a message is removed from the Ukrainian catalog
- **THEN** the type check fails

#### Scenario: Runtime fallback

- **WHEN** the active catalog lacks a message at runtime
- **THEN** the English text is shown, never the message key

### Requirement: Longer strings never clip or overlap

The system SHALL display Home, the Game screen and every sheet at every device-matrix size and at
the baseline sizes, in portrait and landscape, without clipped, truncated-without-ellipsis or
overlapping text and without horizontal page scrolling, when every string is up to 30% longer than
its English text, and in real Ukrainian. Where a compact chip has no room for its whole text it SHALL
end with an ellipsis and keep the full text in its accessible name. The Game screen SHALL still fit
without scrolling under these strings.

Input-agnostic: a layout guarantee. No animation.

*(KS-I18N-04, KS-GEN-03, KS-GEN-05)*

#### Scenario: Padded strings

- **WHEN** every rendered string is padded to 130% of its English length and Home, the Game screen
  and each sheet are shown at each device-matrix size
- **THEN** no text element overflows its box or overlaps another, and the page does not scroll
  horizontally

#### Scenario: Ukrainian device fit

- **WHEN** the language is Ukrainian and the Game screen shows a worst-case column on each
  device-matrix configuration
- **THEN** the page does not scroll and every control lies inside the viewport

### Requirement: Number, score and time formats are language-neutral

The system SHALL format scores, the Vegas bank, moves, the LCD counters, times and deal codes the
same way in every language, so switching language never changes a displayed number. Every Daily
date SHALL be a UTC calendar date written in the active language, so players in different time zones
see the same day: the Home Daily tile shows today's UTC date, and the Daily mode chip shows the
current Daily game's own date (its Daily key), not today's. A Daily game with no Daily key (started
from a `D-…` deal code) SHALL show the plain "Daily" label with no date.

Input-agnostic: formatting only. No animation.

*(KS-I18N-01, KS-DEAL-07 UTC date)*

#### Scenario: Numbers unchanged

- **WHEN** the language switches from English to Ukrainian during a Vegas game at `-$37`, 42 moves
  and `3:07`
- **THEN** the HUD still shows `-$37`, `042` and `3:07`

#### Scenario: Localised UTC day

- **WHEN** it is 23:30 on 19 September in UTC−5 (04:30 on 20 September UTC) and the language is
  Ukrainian
- **THEN** the Daily tile shows 20 September written in Ukrainian

#### Scenario: A Daily game from a code shows no date

- **WHEN** a Daily game was started from a `D-…` deal code and so has no Daily key
- **THEN** the Daily mode chip shows plain "Daily" with no date
