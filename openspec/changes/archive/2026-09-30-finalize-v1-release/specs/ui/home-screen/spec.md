# Spec Delta

## MODIFIED Requirements

### Requirement: Home top bar

Home SHALL show a top bar that stays at the top of the viewport while Home scrolls, drawn in the page
colour, slightly translucent, with a thin outline along its bottom edge. At its start it SHALL show the
pixel logo mark (three small squares in a row, in the text, primary and secondary colours) and the
title "Solitaire" in the bold body typeface; at its end, a theme toggle and a Settings button drawn as
borderless icon buttons in the muted text colour. The theme toggle SHALL switch between the light and
dark themes (from System it switches to the opposite of the scheme currently shown), apply at once and
be remembered; its icon SHALL show the target theme (moon in light, sun in dark) and its accessible
name SHALL describe the action ("Switch to dark theme" / "Switch to light theme"). Settings SHALL open
the Settings sheet. Both buttons SHALL be at least 44×44 px where the pointer is coarse and show a
visible focus indicator. The logo mark is decorative and hidden from assistive technology.

Input coverage: both buttons work by tap/click and by keyboard (Enter/Space); drag is not an input
path (nothing on Home is draggable). No-motion: the theme change is instant.

*(KS-SET-01, KS-SET-02, KS-A11Y-03, KS-A11Y-04; top-bar look (new))*

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

Home SHALL show a hero panel with rounded corners and a thin outline, filled with the table colour
under a faint dot grid. It SHALL hold:
- a pill-shaped badge on the surface colour reading "Klondike · Draw 1 & 3" in small, capitalised,
  muted body type, led by a small round live dot in the success colour (decorative and hidden from
  assistive technology);
- the wordmark SOLITAIRE in capitals in the pixel typeface, as the screen's level-one heading, with a
  stepped two-colour shadow (two copies offset down and to the right, in the theme's two wordmark
  shadow colours);
- a one-paragraph pitch in the body typeface;
- a fan of five face-up cards (the Aces of Spades, Diamonds, Clubs and Hearts and the King of Spades,
  drawn as the table draws card faces) spread in an arc, which floats slowly up and down;
- a dithered checker strip along its bottom edge.

The fan and dither are decorative and hidden from assistive technology. On screens at least 640 px
wide the copy, aligned left, and the fan sit side by side; narrower, they stack and are centred, with
a compact hero at 460 px wide or narrower. The wordmark and pitch SHALL meet 4.5:1 contrast on the
hero in the light and dark themes. With reduced motion or Animations off, the fan SHALL be still.

Input-agnostic: the hero is not interactive. No-motion: stated above.

*(KS-GEN-03, KS-SET-03, KS-SET-04; hero look (new))*

#### Scenario: Still fan

- **WHEN** Animations is off, or reduced motion is requested
- **THEN** the hero fan does not move

#### Scenario: Phone layout

- **WHEN** Home is shown in a 390×844 viewport
- **THEN** the hero copy and fan are stacked and there is no horizontal scrolling

### Requirement: Mode choice

Home SHALL show the section label "Choose a game", in small capitalised muted type, and four tiles
styled as playing cards: the card-face colour, a card edge, rounded corners and the card shadow. The
tiles SHALL sit in one row of four on screens at least 640 px wide, and in two rows of two when
narrower. Each tile SHALL show, in its top-left corner, an index in the pixel typeface followed by a
suit symbol, both in that suit's ink (following the four-colour deck): `1♠` Draw 1, `3♥` Draw 3,
`$♦` Vegas and `<day>♣` Daily deal, where `<day>` is today's UTC day of the month; and a large, faint
copy of the suit as a watermark in its bottom-right corner. Below the index each tile SHALL show its
mode name in the bold body typeface, its rules line in the pixel typeface (the Daily tile shows
today's UTC date in the active language), and the player's best in that mode — the best time, or the
best bank in Vegas — or "No record yet". The tiles SHALL form one named single-choice group ("Game
mode"): each tile exposes the radio role, its mode name and its checked state, only the selected tile
is in the Tab order, and the arrow keys move the selection within the group. The selected tile SHALL
lift, gain a ring in the secondary colour and a pixel corner mark (three small squares forming a
corner at its top right), so the selection is shown by more than colour. The selection SHALL be
remembered. Selecting a mode SHALL NOT start a game.

Input coverage: select by tap/click, or by keyboard (arrow keys, Space); drag is not an input path.
No-motion: with reduced motion or Animations off the tile changes state without lifting motion.

*(KS-DEAL-07, KS-SET-01, KS-A11Y-03, KS-A11Y-05; tile look (new))*

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

Home SHALL show, below the mode tiles, a Winnable card: a rounded panel on the surface colour with a
thin outline and a soft shadow. It SHALL hold the title "Winnable deals only" in the bold body
typeface, a one-line caption in muted body type beneath it, and, at the card's end, a switch exposing
the switch role, the name "Winnable deals only" and its on/off state. The switch SHALL read and write
one stored choice, remembered and shared by Draw 1, Draw 3 and Vegas:
- while Draw 1, Draw 3 or Vegas is selected, the switch SHALL be enabled and show the stored choice,
  and its caption SHALL explain that a built-in solver checks every deal before it is shown, and that
  a deal it cannot prove winnable within the attempt limit is marked "Random deal";
- while Daily is selected, the switch SHALL be disabled and report on, its caption SHALL explain that
  Daily deals are always checked, and the stored choice SHALL NOT change (KS-DEAL-07).

Inside the same card, under the caption, Home SHALL show a Difficulty control with four options, Any,
Easy, Medium and Hard (one choice; Any by default). It SHALL use the segmented style of the Settings
choices: a rounded track with equal-width options, and the chosen option raised on the surface colour
with its label in the primary colour. It SHALL be exposed as a single-choice group named
"Difficulty", each option with the radio role and its checked state. Its choice SHALL be one stored
choice, remembered and shared by Draw 1, Draw 3 and Vegas; the next deal in those modes with the switch
on is chosen for it, as `features/deal-service` defines. The control SHALL be enabled only while the
switch is on and Draw 1, Draw 3 or Vegas is selected. While it is disabled (the switch off, or Daily
selected), it SHALL still show the stored choice, expose its disabled state to assistive technology,
and never change the stored choice.

Changing the switch or the difficulty SHALL NOT change a game in progress; it applies from the next
deal. Each Difficulty option SHALL show a visible focus indicator and be at least 44×44 px where the
pointer is coarse. The card's title, caption and enabled option labels SHALL meet 4.5:1 contrast in
the light and dark themes. The card, including the Difficulty control, SHALL fit every Home size from
320×480 to 2560×1440, with every string up to 30% longer than English, without clipped or overlapping
text and without horizontal scrolling.

Input coverage:
- the switch toggles by tap/click or by keyboard (Space);
- a Difficulty option is chosen by tap/click, or by keyboard: Tab reaches the group at its chosen
  option, the arrow keys move to the neighbouring option and choose it, and Space or Enter chooses the
  focused option;
- drag is not an input path: neither the switch nor the segmented control is a draggable object.

No-motion: the switch knob moves instantly with reduced motion or Animations off. The Difficulty
control has no animation of its own, and any colour transition on it is skipped with reduced motion or
Animations off.

*(KS-DEAL-03, KS-DEAL-07, KS-DEAL-11 (new), KS-SET-01, KS-SET-04, KS-SET-06, KS-A11Y-03,
KS-A11Y-04, KS-I18N-04)*

#### Scenario: Toggle

- **WHEN** Draw 1 is selected and the player turns the switch off by tap or with Space
- **THEN** the switch reports off and stays off after a reload, and the Difficulty control is disabled

#### Scenario: Disabled for Draw 3

- **WHEN** Draw 3 is selected and the player turns the switch off
- **THEN** the switch stays enabled and reports off, and only the Difficulty control is disabled,
  still showing the stored difficulty

#### Scenario: Live in Draw 3 and Vegas

- **WHEN** the stored choice is on and the player selects Draw 3, and then Vegas
- **THEN** in both modes the switch is enabled and reports on, the Difficulty control is enabled, and
  the caption explains that the solver checks every deal before it is shown

#### Scenario: Disabled for Daily

- **WHEN** Daily is selected
- **THEN** the switch is disabled and reports on, the caption explains that Daily deals are always
  checked, and the Difficulty control is disabled and still shows the stored difficulty

#### Scenario: Choose a difficulty by tap

- **WHEN** Draw 3 is selected, the switch is on and the player taps Hard
- **THEN** Hard is checked, Any is not, and Hard is still checked after a reload

#### Scenario: Choose a difficulty by keyboard

- **WHEN** the switch is on, the player tabs to the Difficulty group, which is on Any, and presses the
  right arrow
- **THEN** Easy is checked and focused, and pressing Space or Enter on it keeps Easy checked

#### Scenario: Disabled control keeps the stored choice

- **WHEN** the stored difficulty is Medium, the switch is off and the player taps Hard
- **THEN** Medium stays checked, the group is exposed as disabled, and the stored difficulty is still
  Medium

#### Scenario: Daily leaves the choices untouched

- **WHEN** Winnable deals only is on and Hard is stored, and the player selects Daily and then Vegas
- **THEN** in Vegas the switch reports on and Hard is checked and enabled

#### Scenario: A game in progress is not changed

- **WHEN** a game is in progress, the player goes Home, changes the difficulty from Any to Hard and
  activates Continue game
- **THEN** the same game is restored with its deal and its deal chip unchanged

#### Scenario: Fits with longer strings

- **WHEN** Home is shown at 320×480 with every string 30% longer than English
- **THEN** the Winnable card's title, caption and all four Difficulty options are fully visible, and
  the page does not scroll horizontally

### Requirement: Home actions

Home SHALL show three actions centred in one row, which wraps when narrow:
- **Deal cards**, a button filled with the primary colour whose label is in capitals in the pixel
  typeface, with a solid drop shadow that presses flat when it is activated;
- **Continue game**, shown only while a resumable game exists, a tonal button in the
  primary-container colours;
- **How to play**, an outlined button.

Deal cards SHALL start a new game in the selected mode and show the Game screen. In Draw 1, Draw 3 and
Vegas it SHALL honour Winnable deals only and the chosen Difficulty; in Daily it SHALL deal the day's
verified deal. If a started, unfinished game exists, that mode's streak breaks. Continue game SHALL
show the Game screen with the saved game restored. How to play SHALL open its sheet. WHILE Home is
shown in any viewport at most 720 px wide or at most 800 px tall (every phone, and a foldable's
main screen in landscape), the actions SHALL be pinned to the bottom of the viewport, above the safe
area, so Deal cards and Continue game stay visible without scrolling while the rest of Home scrolls. Each action SHALL be at least 44×44 px where the pointer is
coarse.

Input coverage: every action works by tap/click and keyboard (Enter/Space); drag is not an input
path. No-motion: the press effect is skipped with reduced motion or Animations off.

*(KS-GEN-09, KS-GEN-10, KS-PER-02, KS-STA-03, KS-DEAL-03, KS-DEAL-07, KS-DEAL-11 (new),
KS-A11Y-04; action look (new))*

#### Scenario: Deal cards

- **WHEN** Vegas is selected and the player activates Deal cards
- **THEN** the Game screen shows a new Vegas game

#### Scenario: Deal cards honours the Winnable choices

- **WHEN** Draw 3 is selected, Winnable deals only is on, Difficulty is Easy and the player activates
  Deal cards
- **THEN** the Game screen shows a new Draw 3 game dealt for Winnable deals only with Easy as the
  requested grade, as `features/deal-service` defines

#### Scenario: Continue only when resumable

- **WHEN** no unfinished game is stored
- **THEN** Continue game is not shown

#### Scenario: Actions visible on short screens

- **WHEN** Home is shown at 874×350, 835×752, 390×844 or 1280×720
- **THEN** Deal cards (and Continue game when present) lie fully inside the viewport and clear of the
  safe area without scrolling

### Requirement: Home record strip

Home SHALL show a record strip, named "Your record", styled as an LCD panel: four cells side by side
on a dark navy panel, divided by thin darker lines inside a rounded dark frame, each cell with a small
capitalised label in muted blue-grey body type above its value in the pixel typeface in a bright LCD
colour. The cells SHALL be Played, Won, Win rate and Streak across all modes. Played and Won SHALL be
totals zero-padded to three digits; Win rate SHALL be the rounded percentage "n%" of won over played,
or "--" with no games played; Streak SHALL show the largest current streak across modes, followed by
"/best" with the largest best streak when one exists. The labels and digits SHALL meet 4.5:1 contrast
on the LCD panel.

Input-agnostic: the strip is read-only. No animation.

*(KS-STA-01, KS-STA-02, KS-SET-03; strip formatting and look (new))*

#### Scenario: Empty record

- **WHEN** no game has been played
- **THEN** the strip reads 000, 000, -- and 0

#### Scenario: Totals

- **WHEN** 12 games were played and 5 won across modes, with a current streak of 2 and a best of 3
- **THEN** the strip reads 012, 005, 42% and 2/3

### Requirement: Home links, install offer and footer

Home SHALL show a centred row of text links, which wraps when narrow, in the bold, muted body type:
Statistics, Settings, Play a deal code and About, each opening its sheet, and an Install app link only
while the browser offers installation (see `pwa/offline-install-update`). Below them Home SHALL show
the build stamp, centred, in small muted pixel type: the build number and the UTC build date and time,
or the development label on a local build, as `app/application-shell` "Build identification" defines.
Storage notices raised at start-up are shown on Home; see `ui/notices` "Transient notices". Every link
SHALL show a visible focus indicator and meet 4.5:1 text contrast in the light and dark themes.

Input coverage: links work by tap/click and keyboard (Enter); drag is not an input path. No
animation.

*(KS-GEN-02, KS-GEN-11 (new), KS-PWA-02, KS-PER-03, KS-PER-04, KS-A11Y-03, KS-SET-03)*

#### Scenario: Link opens its sheet

- **WHEN** the player activates Play a deal code
- **THEN** the Play a deal code sheet opens with focus in its input

#### Scenario: No install offer

- **WHEN** the browser does not offer installation
- **THEN** no Install app link is shown

#### Scenario: Build stamp on Home

- **WHEN** Home is shown in a build made by CI
- **THEN** the footer shows that build's number and its UTC build date and time, and is never empty
