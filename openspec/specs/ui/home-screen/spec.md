# ui/home-screen Specification

## Purpose
Defines the Home screen in the mockup's look — top bar, hero, mode choice, Winnable switch, actions,
record strip, links and footer — and the rule that its main actions stay visible on phones and short
screens.

## Requirements

### Requirement: Home top bar

Home SHALL show a top bar (mockup `.topbar`) with the pixel logo mark and the title "Solitaire", a
theme toggle and a Settings button. The theme toggle SHALL switch between the light and dark themes
(from System it switches to the opposite of the scheme currently shown), apply at once and be
remembered; its icon SHALL show the target theme (moon in light, sun in dark) and its accessible name
SHALL describe the action ("Switch to dark theme" / "Switch to light theme"). Settings SHALL open the
Settings sheet. Both buttons SHALL be at least 44×44 px where the pointer is coarse and show a visible
focus indicator. The logo mark is decorative and hidden from assistive technology.

Input coverage: both buttons work by tap/click and by keyboard (Enter/Space); drag is not an input
path (nothing on Home is draggable). No-motion: the theme change is instant.

*(KS-SET-01, KS-SET-02, KS-A11Y-03, KS-A11Y-04; spec §3.1 top bar)*

#### Scenario: Toggle by tap

- **WHEN** the light theme is shown and the player taps the theme toggle
- **THEN** the page turns dark at once, the toggle's name becomes "Switch to light theme", and the
  dark theme is kept after a reload

#### Scenario: Toggle by keyboard

- **WHEN** the theme toggle is focused and the player presses Enter
- **THEN** the theme switches

#### Scenario: Settings

- **WHEN** the player activates Settings
- **THEN** the Settings sheet opens

### Requirement: Home hero

Home SHALL show a table-coloured hero panel (mockup `.home-hero`) with the badge "Klondike · Draw 1 &
3" led by its small live dot (mockup `.live-dot`, decorative and hidden from assistive technology),
the pixel wordmark SOLITAIRE as the screen's level-one heading with a stepped two-colour shadow,
a one-paragraph pitch, a fan of five face-up cards (mockup `.hero-fan`) that floats slowly, and a
dithered strip along its bottom edge (mockup `.dither`). The fan and dither are decorative and hidden
from assistive technology. On wide screens the copy and fan sit side by side; on phones they stack,
with a compact hero. The wordmark and pitch SHALL meet 4.5:1 contrast on the hero in the light and
dark themes. With reduced motion or Animations off, the fan SHALL be still.

Input-agnostic: the hero is not interactive. No-motion: stated above.

*(KS-GEN-03, KS-SET-03, KS-SET-04; spec §3.1 hero)*

#### Scenario: Still fan

- **WHEN** Animations is off, or reduced motion is requested
- **THEN** the hero fan does not move

#### Scenario: Phone layout

- **WHEN** Home is shown in a 390×844 viewport
- **THEN** the hero copy and fan are stacked and there is no horizontal scrolling

### Requirement: Mode choice

Home SHALL show "Choose a game" and four tiles styled as playing cards (mockup `.mode-row`,
`.mode-card`), each with a corner index and suit: `1♠` Draw 1, `3♥` Draw 3, `$♦` Vegas and `<day>♣`
Daily deal, where `<day>` is today's UTC day of the month. Each tile SHALL show its rules line (the
Daily tile shows today's UTC date in the active language) and the player's best time in that mode, or
"No record yet". The tiles SHALL form one named single-choice group ("Game mode"): each tile exposes
the radio role, its mode name and its checked state, only the selected tile is in the Tab order, and
the arrow keys move the selection within the group. The selected tile SHALL lift, gain a ring and a
pixel corner mark, so the selection is shown by more than colour. The selection SHALL be remembered.
Selecting a mode SHALL NOT start a game.

Input coverage: select by tap/click, or by keyboard (arrow keys, Space); drag is not an input path.
No-motion: with reduced motion or Animations off the tile changes state without lifting motion.

*(KS-DEAL-07, KS-SET-01, KS-A11Y-03, KS-A11Y-05; spec §3.1 Choose a game and §6 Selected mode)*

#### Scenario: Select by tap

- **WHEN** Draw 1 is selected and the player taps the Vegas tile
- **THEN** Vegas is checked and marked as selected, and it is still selected after a reload

#### Scenario: Select by keyboard

- **WHEN** the Draw 1 tile has focus and the player presses the right arrow
- **THEN** Draw 3 is checked and focused

#### Scenario: No record

- **WHEN** the player has never won a Draw 3 game
- **THEN** the Draw 3 tile shows "No record yet"

### Requirement: Winnable deals only switch

Home SHALL show a Winnable deals only switch with a one-line caption (mockup `.toggle-card`), exposing
the switch role, the name "Winnable deals only" and its on/off state. Its state SHALL be remembered.
While Draw 3 or Vegas is selected the switch SHALL be disabled, report off for that mode, and its
caption SHALL explain that those deals are not checked by the solver. While Daily is selected the
switch SHALL also be disabled, report on, and its caption SHALL explain that Daily deals are always
winnable (KS-DEAL-07). The stored choice SHALL NOT change when a disabled mode is selected.

Input coverage: toggle by tap/click or keyboard (Space); drag is not an input path. No-motion: the
switch knob moves instantly with reduced motion or Animations off.

*(KS-DEAL-03, KS-DEAL-07, KS-SET-01)*

#### Scenario: Toggle

- **WHEN** Draw 1 is selected and the player turns the switch off by tap or with Space
- **THEN** the switch reports off and stays off after a reload

#### Scenario: Disabled for Draw 3

- **WHEN** Draw 3 is selected
- **THEN** the switch is disabled and the caption explains why

#### Scenario: Disabled for Daily

- **WHEN** Daily is selected
- **THEN** the switch is disabled, reports on, and the caption explains that Daily deals are always
  winnable

### Requirement: Home actions

Home SHALL show **Deal cards** (primary, pixel label, press effect), **Continue game** (only while a
resumable game exists) and **How to play** (mockup `.cta-row`). Deal cards SHALL start a new game in
the selected mode, honouring Winnable deals only for Draw 1, and show the Game screen; if a started,
unfinished game exists, that mode's streak breaks. Continue game SHALL show the Game screen with the
saved game restored. How to play SHALL open its sheet. WHILE Home is shown on a phone or in any
viewport at most 720 px tall or 720 px wide, the actions SHALL be pinned to the bottom of the
viewport, above the safe area, so Deal cards and Continue game stay visible without scrolling while
the rest of Home scrolls. Each action SHALL be at least 44×44 px where the pointer is coarse.

Input coverage: every action works by tap/click and keyboard (Enter/Space); drag is not an input
path. No-motion: the press effect is skipped with reduced motion or Animations off.

*(KS-GEN-09, KS-GEN-10, KS-PER-02, KS-STA-03, KS-DEAL-03, KS-A11Y-04)*

#### Scenario: Deal cards

- **WHEN** Vegas is selected and the player activates Deal cards
- **THEN** the Game screen shows a new Vegas game

#### Scenario: Continue only when resumable

- **WHEN** no unfinished game is stored
- **THEN** Continue game is not shown

#### Scenario: Actions visible on short screens

- **WHEN** Home is shown at 874×350, 390×844 or 1280×720
- **THEN** Deal cards (and Continue game when present) lie fully inside the viewport and clear of the
  safe area without scrolling

### Requirement: Home record strip

Home SHALL show an LCD record strip (mockup `.stat-strip`), named "Your record", with Played, Won,
Win rate and Streak across all modes. Played and Won SHALL be totals zero-padded to three digits; Win
rate SHALL be the rounded percentage "n%" of won over played, or "--" with no games played; Streak
SHALL show the largest current streak across modes, followed by "/best" with the largest best streak
when one exists. The digits SHALL meet 4.5:1 contrast on the LCD panel.

Input-agnostic: the strip is read-only. No animation.

*(KS-STA-01, KS-STA-02, KS-SET-03; strip formatting (new), from the mockup)*

#### Scenario: Empty record

- **WHEN** no game has been played
- **THEN** the strip reads 000, 000, -- and 0

#### Scenario: Totals

- **WHEN** 12 games were played and 5 won across modes, with a current streak of 2 and a best of 3
- **THEN** the strip reads 012, 005, 42% and 2/3

### Requirement: Home links, install offer and footer

Home SHALL show the links Statistics, Settings, Play a deal code and About (mockup `.footlinks`), each
opening its sheet, and an Install app link only while the browser offers installation (see
`pwa/offline-install-update`). Below them Home SHALL show the build stamp in pixel type. Storage
notices raised at start-up are shown on Home; see `ui/notices` "Transient notices". Every link SHALL
show a visible focus indicator and meet 4.5:1 text contrast in the light and dark themes.

Input coverage: links work by tap/click and keyboard (Enter); drag is not an input path. No
animation.

*(KS-GEN-02, KS-PWA-02, KS-PER-03, KS-PER-04, KS-A11Y-03, KS-SET-03)*

#### Scenario: Link opens its sheet

- **WHEN** the player activates Play a deal code
- **THEN** the Play a deal code sheet opens with focus in its input

#### Scenario: No install offer

- **WHEN** the browser does not offer installation
- **THEN** no Install app link is shown

### Requirement: Home fits every size and text follows the language

Home SHALL render at every size from 320×480 to 2560×1440 in portrait and landscape without
horizontal scrolling, with its content clear of the safe areas, and all its text, names and the Daily
date in the active language. Focus SHALL be visible on every Home control.

Input-agnostic: a layout guarantee. No animation.

*(KS-GEN-03, KS-GEN-10, KS-I18N-01, KS-I18N-04, KS-A11Y-03)*

#### Scenario: Smallest viewport

- **WHEN** Home is shown at 320×480
- **THEN** the page does not scroll horizontally and Deal cards is visible
