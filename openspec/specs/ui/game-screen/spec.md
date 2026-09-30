# ui/game-screen Specification

## Purpose
Defines the Game screen's frame around the table — the stacked and side-rails chrome profiles, safe
areas, the read-only HUD and the Undo/Redo toolbar — and the guarantee that the whole screen fits
every supported device without scrolling.

## Requirements
### Requirement: Two chrome profiles

The Game screen SHALL use the side-rails profile while the viewport is in landscape and at most 720 px
tall, and the stacked profile otherwise. In the stacked profile the screen SHALL show, top to bottom:
a top bar with the Back control, the chip slot holding the mode and deal chips, the theme toggle and
the Settings control, the HUD with the
New deal control and its caption in its centre slot, the hint line, the table, the toolbar and a
footer holding the deal code and the build stamp, at most 64rem (1024 px) wide. In the stacked
profile the footer SHALL be hidden at 480 px wide or narrower, and the hint line SHALL be hidden in
portrait with height ≤ 600 px. In the side-rails profile the top bar, hint line and footer SHALL be
hidden; a left rail SHALL hold Back and Settings side by side, then Score, Moves, the New deal control and Time, a right rail SHALL
hold the toolbar, and the table SHALL fill the space between them at full width. The Back
control SHALL keep the accessible name "Back to Home" in English, and its translation in the active
language, in both profiles and SHALL be at least 44×44 px where the pointer is coarse. The chrome
profile and the table geometry (stacked or wide table) SHALL be chosen independently. Region sizes
SHALL keep the sizes reserved for this content, so the fit does not change now that it is filled:
the HUD New deal slot at 2.9rem square (2.6rem at 460 px wide or narrower, 2.5rem in the rails), the
hint line at one line of 0.7rem text (0.64rem at 480 px wide or narrower) with line-height 1.4, and
the chip slot at the Back control's height within the top-bar width left after Back, the theme
toggle and Settings.

In both themes the chrome SHALL look as follows: the top bar is drawn in the page colour, slightly
translucent, with a thin outline along its bottom edge; the HUD and the toolbar (in the side-rails
profile, the left and right rails) are rounded panels on the surface colour with a thin outline and a
soft shadow; and the footer shows the deal code and the build stamp side by side, centred, in small
muted pixel type.

Input-agnostic: the profile follows the viewport. No animation accompanies a profile change, so no
reduced-motion alternative is required.

*(KS-GEN-06; KS-A11Y-04 Back target size; KS-I18N-01; region sizes and chrome look (new))*

#### Scenario: Phone on its side uses rails

- **WHEN** the Game screen is shown in a 874×350 landscape viewport
- **THEN** the side-rails profile is used, and no top bar, hint line or footer is shown

#### Scenario: Tall landscape stays stacked

- **WHEN** the Game screen is shown in a 835×752 landscape viewport
- **THEN** the stacked profile is used

#### Scenario: Short desktop window uses rails

- **WHEN** the Game screen is shown in a 1280×720 viewport
- **THEN** the side-rails profile is used with the stacked table geometry

#### Scenario: Back touch target

- **WHEN** the pointer is coarse, in the stacked profile or in a 874×350 side-rails viewport
- **THEN** the Back control measures at least 44×44 px

#### Scenario: Filled regions keep their sizes

- **WHEN** the chips, the New deal control, the hint line and the footer are filled
- **THEN** each region keeps its reserved size and the device-fit matrix still passes

### Requirement: The Game screen never scrolls and respects safe areas

While the Game screen is shown, the page SHALL not scroll in either direction, and every card of any
position — including a worst-case column of 6 face-down and 13 face-up cards — and every control
SHALL lie inside the viewport. This SHALL hold on every screen of the device matrix, in portrait and
landscape, in the browser (viewport height reduced by the browser bars) and installed: the iPhone 14
Pro, 14 Pro Max, 17 Pro and 17 Pro Max; the Galaxy S25, and the Galaxy S25+ / S25 Ultra at both its
FHD+ and QHD+ settings; the iPhone Duo outer and inner screens; and the Galaxy Z Fold 8 and Galaxy Z
Fold 8 Ultra cover and main screens — 13 screens and 52 configurations, whose viewport sizes are kept
in `docs/reference/device-matrix.md`. It SHALL also hold at 320×480, 1280×720 and 2560×1440. The
screen SHALL fill the dynamic viewport height, and its content and controls SHALL keep clear of every
safe-area inset (notch, rounded corners, home indicator) on all edges in both profiles. On installed
screens with a coarse pointer, a worst-case column SHALL keep a face-up strip of at least 14 px.

Input-agnostic: a layout guarantee. No animation.

*(KS-GEN-03, KS-GEN-05, KS-GEN-10, KS-A11Y-04 strip size)*

#### Scenario: Device-fit matrix

- **WHEN** the Game screen shows a worst-case column on each of the 52 device-matrix configurations
  and the three baseline sizes
- **THEN** the page does not scroll, every card lies inside the table, and the toolbar, the Back
  control and every HUD value lie inside the viewport

#### Scenario: Finger strip on installed phones

- **WHEN** the worst-case column is shown on an installed-mode configuration with a coarse pointer
- **THEN** each exposed face-up card in that column shows at least 14 px

#### Scenario: Safe areas

- **WHEN** the frame styles are inspected
- **THEN** both profiles pad the frame by `env(safe-area-inset-top)`, `env(safe-area-inset-right)`,
  `env(safe-area-inset-bottom)` and `env(safe-area-inset-left)` on every edge; confirmation on real
  devices is part of the real-device checklist in `docs/reference/device-matrix.md`, because browser
  emulation reports no insets

### Requirement: HUD values and the Time control

The HUD SHALL show Score, Moves and Time for the current game. In Vegas it SHALL show Bank instead of
Score, as whole dollars with a leading minus sign when negative (for example "$47" and "-$52").
Score SHALL be the displayed Standard score (including the time and undo penalties), padded to at
least three digits. Time SHALL show "m:ss" below one hour and "h:mm:ss" from one hour. The values
SHALL update as the game and the clock advance. On viewports 360 px wide or narrower in the stacked
profile, Moves SHALL be hidden; the rails SHALL always show it. The HUD SHALL expose each value with a
text label in the active language ("Score", "Bank", "Moves", "Time" in English) to assistive
technology, and every HUD text colour SHALL meet 4.5:1 contrast against its background.

Each value SHALL be shown as an LCD-style display, the same in the light and dark themes: a dark navy
panel with a darker outline and an inset shadow, a small capitalised label in muted blue-grey body
type, and the value beneath it in the pixel typeface, pink for Score or Bank, pale aqua for Moves and
sky blue for Time.

Score, Bank and Moves SHALL stay read-only. Time SHALL be a control: activating it by pointer or by
keyboard (Enter or Space when focused) SHALL pause the game as `features/game-session` defines.
While paused, Time sits behind the Paused sheet on the inert screen, so it cannot be activated; the
game is resumed from the Paused sheet. Its accessible name SHALL include the time and the pause
action, it SHALL show a visible focus indicator, and it SHALL be at least 44×44 px where the pointer
is coarse. Drag is not an input path: Time is a button. Time SHALL also be disabled, keeping its
accessible name, on a won game (pause is refused then), while a safe-card chain or Finish is running
(`game.busy`), or while a deal is being prepared (`app.dealing` non-null).

No animation.

*(KS-SCO-02 money display, KS-SCO-05 timer display, KS-SCO-07 pause; three-digit Score padding,
hidden Moves at 360 px and the LCD look (new); KS-SET-03 contrast; KS-A11Y-03, KS-A11Y-04)*

#### Scenario: Vegas bank

- **WHEN** a Vegas game's bank is −52
- **THEN** the HUD shows "Bank" with "-$52"

#### Scenario: Standard score padding

- **WHEN** a Standard game's displayed score is 5
- **THEN** the HUD shows "005"

#### Scenario: Time over an hour

- **WHEN** the elapsed time is 3 725 seconds
- **THEN** the HUD shows "1:02:05"

#### Scenario: Narrow phone hides Moves

- **WHEN** the Game screen is shown in a 360×780 portrait viewport
- **THEN** Score and Time are shown and Moves is not

#### Scenario: Tap Time to pause

- **WHEN** the player taps Time during a game that is not won
- **THEN** the Paused sheet opens and the time stops

#### Scenario: Pause from the keyboard

- **WHEN** Time is focused and Enter is pressed
- **THEN** the Paused sheet opens

#### Scenario: Score is not a control

- **WHEN** the HUD is inspected
- **THEN** Score, Bank and Moves are text, not buttons

#### Scenario: Time disabled on a won game

- **WHEN** the game is won
- **THEN** Time is disabled, keeps its accessible name, and activating it does nothing

#### Scenario: Time disabled during a sequence or while dealing

- **WHEN** a safe-card chain is running, or a deal is being prepared
- **THEN** Time is disabled and keeps its accessible name

### Requirement: Undo and Redo toolbar

The toolbar SHALL offer Undo and Redo. Activating Undo SHALL undo the last player move and activating
Redo SHALL re-apply the last undone move, exactly as the game session defines them. Each control SHALL
be disabled while its action is unavailable (nothing to undo or redo, or a finish sequence is
running), SHALL be operable by pointer activation and by keyboard (Enter or Space when focused),
SHALL have the accessible name "Undo" or "Redo", SHALL show a visible focus indicator, and SHALL be at
least 44×44 px where the pointer is coarse. Drag is not an input path for this requirement: toolbar
buttons are not draggable objects. Hint and Finish are covered by the requirement "Hint and Finish
tools".

No-motion path: the cards' response to Undo and Redo follows the board-motion capability.

*(KS-AST-07, KS-AST-08 controls; KS-A11Y-03 focus; KS-A11Y-04 target size)*

#### Scenario: Undo by pointer

- **WHEN** a started game has a move to undo and the player taps or clicks Undo
- **THEN** the position before that move is shown and Redo becomes enabled

#### Scenario: Redo by keyboard

- **WHEN** Redo is enabled, focused, and the player presses Enter
- **THEN** the undone move is re-applied

#### Scenario: Disabled when unavailable

- **WHEN** a fresh deal has no move yet
- **THEN** Undo and Redo are both disabled

#### Scenario: Touch target size

- **WHEN** the pointer is coarse
- **THEN** Undo and Redo each measure at least 44×44 px

### Requirement: The Game screen keeps its name and dealing status

The Game screen SHALL keep a level-one heading naming the game in the active language ("Klondike" in
English) for assistive technology (it MAY be visually hidden), and SHALL keep a polite status region
announcing "Dealing…" (in the active language) while a deal is being prepared.

When preparing a winnable deal takes longer than 160 ms, an overlay SHALL cover the table reading
"Shuffling cards before the game…" with an attempt counter ("deal #N" in English) that follows the attempt
being tried, until the deal is ready; the overlay SHALL then disappear. Until the overlay appears the
previous table MAY remain visible. The overlay's spinner SHALL be decorative and hidden from
assistive technology, and with motion off it SHALL be still. Board input stays closed while dealing
(see `features/interaction`).

Input-agnostic: no interaction.

*(KS-DEAL-04, KS-A11Y-01, KS-A11Y-02, KS-SET-04)*

#### Scenario: Screen name

- **WHEN** the Game screen is shown
- **THEN** a level-one heading named "Klondike" is present

#### Scenario: Dealing status

- **WHEN** a deal is being prepared
- **THEN** the status region reads "Dealing…"

#### Scenario: Slow winnable deal shows the overlay

- **WHEN** a winnable Draw 1 deal is still being prepared after 160 ms, on its fourth attempt
- **THEN** the overlay reads "Shuffling cards before the game…" and "deal #4"

#### Scenario: Quick deal shows no overlay

- **WHEN** a deal is ready within 160 ms
- **THEN** no overlay is shown

#### Scenario: Still spinner without motion

- **WHEN** motion is off and the overlay is shown
- **THEN** its spinner does not animate

### Requirement: Hint and Finish tools
The toolbar SHALL also offer Hint and Finish, after Undo and Redo, named "Hint" and "Finish", each at
least 44×44 px where the pointer is coarse and with a visible focus indicator. Hint SHALL be enabled
while the input gate is open and the game is started or fresh; it requests a hint. Finish SHALL be
enabled exactly when the game session offers Finish, SHALL be highlighted while enabled, and
activating it SHALL play every remaining card home. Both SHALL be disabled while their action is
unavailable, and while a sequence or the win cascade runs. They are operable by pointer and keyboard;
dragging is not an input path for a button.

*(KS-AST-02, KS-AST-05, KS-A11Y-03, KS-A11Y-04)*

#### Scenario: Hint by pointer
- **WHEN** Hint is tapped in a started game
- **THEN** a hint is requested

#### Scenario: Finish enabled and highlighted
- **WHEN** every tableau card is face up and a finish plan exists
- **THEN** Finish is enabled and highlighted

#### Scenario: Finish unavailable
- **WHEN** a face-down card remains
- **THEN** Finish is disabled

#### Scenario: Keyboard
- **WHEN** Finish is enabled, focused and Enter is pressed
- **THEN** Finish runs

#### Scenario: Touch target size
- **WHEN** the pointer is coarse
- **THEN** Hint and Finish each measure at least 44×44 px

### Requirement: The hint line shows the hint
While no hint is showing, the hint line SHALL describe the current tap setting in the active
language: under Smart move "Tap a card to send it to its best spot · drag to place it yourself", and
under Select & place "Tap a card to pick it up, tap a spot to place it · drag works too" (English).
Key chips for the draw, undo and hint shortcuts SHALL follow the text only where the pointer is fine
and the viewport is wider than 460 px. While a hint is showing, the hint line SHALL show its text
instead ("Hint: move the Four of Hearts onto column 6", "Hint: draw from the stock", "Hint: turn the
waste back over") and revert to the tap-setting text afterwards. Where the hint line is not
displayed (side rails, short portrait screens), the highlights and the announcement carry the hint,
so the hint never depends on the line alone. The line SHALL stay one line at its reserved size and
its text SHALL meet 4.5:1 contrast.

Input-agnostic: display only.

*(KS-AST-02, KS-INP-01, KS-INP-02, KS-INP-08, KS-I18N-01)*

#### Scenario: Hint text
- **WHEN** a hint is showing in the stacked profile
- **THEN** the line reads the hint

#### Scenario: Hidden line
- **WHEN** a hint is showing in the side-rails profile
- **THEN** the source and target are highlighted and the hint is announced

#### Scenario: Tap-mode text
- **WHEN** the tap setting changes from Smart move to Select & place
- **THEN** the line reads "Tap a card to pick it up, tap a spot to place it · drag works too"

#### Scenario: Key chips only for fine pointers
- **WHEN** the pointer is coarse, or the viewport is 460 px wide or narrower
- **THEN** no key chips are shown

#### Scenario: Back to the tap-mode text
- **WHEN** a hint has been shown and cleared
- **THEN** the line reads the tap-setting text again

### Requirement: Notices host and announcer are part of the frame
The notices host (shown on every screen, see `ui/notices`) and the polite announcer SHALL be
mounted once at the application level, beside the current screen and outside the part of the page
that is made inert while a sheet is open, so notices stay operable and announcements are spoken while
a sheet is open. They SHALL be placed so they never move the board or the toolbar and never cause
page scrolling.

*(KS-A11Y-02, KS-GEN-05)*

#### Scenario: Frame does not shift
- **WHEN** a notice appears
- **THEN** the board and toolbar keep their positions

#### Scenario: Announced while a sheet is open
- **WHEN** the Paused sheet is open and the player copies the deal code from it
- **THEN** "Deal code copied" is announced and the code-copied notice is shown

### Requirement: Game top bar actions

In the stacked profile the Game top bar SHALL show, after the chip slot, a theme toggle and a
Settings control, as on Home: two borderless icon buttons in the muted text colour at the end of the
bar. The theme toggle SHALL switch between the light and dark theme at once and remember the choice;
while the theme is System it SHALL switch to the opposite of the scheme currently shown. Its
accessible name SHALL describe the action (for example "Switch to dark theme") in the active
language. Settings SHALL open the Settings sheet, and closing that sheet SHALL return focus to it. In
the side-rails profile the Settings control SHALL sit beside Back at the top of the left rail and the
theme toggle SHALL not be shown. Both controls SHALL be at least 44×44 px where the pointer is coarse
and SHALL show a visible focus indicator.

Input coverage: tap/click and keyboard (Enter/Space); drag is not an input path because the controls
are not draggable. No animation accompanies the theme switch, so no reduced-motion alternative is
required.

*(KS-SET-01, KS-SET-02, KS-A11Y-03, KS-A11Y-04, KS-I18N-01; placement (new))*

#### Scenario: Toggle theme from the game

- **WHEN** the light theme is shown and the player activates the theme toggle by tap or presses Enter
  on it
- **THEN** the dark theme is applied at once and is still applied after a reload

#### Scenario: Settings from the rails

- **WHEN** the Game screen is shown in a 874×350 viewport and the player activates Settings
- **THEN** the Settings sheet opens, and closing it returns focus to the Settings control

### Requirement: Mode and deal chips

The top bar's chip slot SHALL show a mode chip and a deal chip for the current game, with text from
the active language. Both chips SHALL be pills in small, bold, letter-spaced body type, displayed in
capitals by styling alone; the catalog text and the accessible names are in normal case.
- The mode chip, on the primary-container colours, SHALL read "Draw 1 · Standard", "Draw 3 ·
  Standard", "Vegas" or "Daily · <date>" in English (shown as "DRAW 1 · STANDARD" and so on), where
  the date is the current Daily game's own UTC date (its Daily key, not today's date) formatted in the
  active language (for example "Daily · Sep 19"). A Daily game with no Daily key (one started from a
  `D-…` deal code) SHALL show the mode chip as plain "Daily", with no date.
- The deal chip SHALL follow the current game's deal provenance:
  - a deal proven winnable and graded SHALL read "Winnable · <grade>" ("Winnable · Easy", "Winnable ·
    Medium" or "Winnable · Hard" in English), with a check icon, on the success-container colours;
  - a deal proven winnable with no grade SHALL read "Winnable", with the same icon and colours;
  - a `random` deal SHALL read "Random deal", with a dice icon, on the surface-variant colours.

The shuffle count SHALL NOT be part of the chip's visible text or accessible name. When a proven deal
needed more than one shuffle, the chip SHALL carry the note "found after N shuffles" (plural-correct
in the active language) as its accessible description, and its hover description SHALL give the chip
text followed by that note; otherwise the hover description is the chip text alone.

The icons SHALL be decorative and hidden from assistive technology, so the chip never depends on the
icon alone. At 460 px wide or narrower the deal chip SHALL show its icon only, and a chip whose text
does not fit SHALL truncate with an ellipsis; in both cases its accessible name SHALL keep the full
text, and the full text SHALL also be offered as a hover description. The chips SHALL stay within
the chip slot's existing size. Chip text SHALL meet 4.5:1 contrast against the chip.

Input-agnostic: display only; the chips are not interactive, so no pointer, drag or keyboard path
applies. No animation.

*(KS-DEAL-06, KS-DEAL-11 (new), KS-DEAL-03, KS-DEAL-05, KS-DEAL-07, KS-I18N-01, KS-I18N-04,
KS-A11Y-05)*

#### Scenario: Winnable after several shuffles

- **WHEN** a winnable Draw 1 deal graded Medium needed 3 shuffles
- **THEN** the mode chip is named "Draw 1 · Standard" and shown as "DRAW 1 · STANDARD", the deal chip
  reads "Winnable · Medium" (shown as "WINNABLE · MEDIUM"), its accessible description is "found after
  3 shuffles", and its hover description gives both

#### Scenario: Winnable Draw 3 deal on the first shuffle

- **WHEN** a Draw 3 deal proven winnable and graded Hard needed one shuffle
- **THEN** the deal chip reads "Winnable · Hard" with the check icon and has no shuffle note

#### Scenario: Graded Daily deal

- **WHEN** the Daily deal, graded Easy, is shown
- **THEN** the deal chip reads "Winnable · Easy"

#### Scenario: Proven deal without a grade

- **WHEN** the current game is proven winnable but carries no grade
- **THEN** the deal chip reads "Winnable" with the check icon

#### Scenario: Random deal

- **WHEN** a game was dealt with Winnable deals only off, or started from a deal code
- **THEN** the deal chip reads "Random deal" with the dice icon

#### Scenario: Daily date in UTC

- **WHEN** the Daily deal for 19 September (UTC) is shown in English
- **THEN** the mode chip is named "Daily · Sep 19" (shown as "DAILY · SEP 19") whatever the device's
  time zone

#### Scenario: A resumed Daily keeps its date

- **WHEN** the Daily deal for 19 September (UTC) is continued on 20 September (UTC)
- **THEN** the mode chip still names 19 September

#### Scenario: Narrow phone keeps the name

- **WHEN** the Game screen is 375 px wide and the deal is winnable, graded Medium, after 3 shuffles
- **THEN** the deal chip shows only its icon, its accessible name is "Winnable · Medium" and its
  accessible description is "found after 3 shuffles"

#### Scenario: Daily from a deal code has no date

- **WHEN** a Daily game was started from a `D-…` deal code and so has no Daily key
- **THEN** the mode chip reads "Daily" (shown as "DAILY") with no date

### Requirement: New deal control in the HUD

The HUD's centre slot SHALL hold a New deal control with the caption "New deal" beneath it, both in
the active language. Activating it by pointer or by keyboard (Enter or Space when focused), or
pressing N, SHALL request a new deal as `features/game-session` defines (options during a started,
unwon game, otherwise an immediate deal). The control SHALL have the accessible name "New deal" in
English, show a visible focus indicator, and give a target area of at least 44×44 px where the
pointer is coarse, even where its visible face is smaller. It SHALL be disabled, while keeping its
accessible name, whenever the input gate is closed for dealing, while a safe-card chain or Finish is
running (`game.busy`), or while a deal is being prepared (`app.dealing` non-null). Drag is not an
input path: the control is a button. Its press effect SHALL have a no-motion path with no scaling.

*(KS-INP-08, KS-DEAL-08, KS-A11Y-03, KS-A11Y-04, KS-SET-04)*

#### Scenario: New deal by pointer on a fresh deal

- **WHEN** no move has been made and the player taps New deal
- **THEN** a new game in the same mode is dealt at once

#### Scenario: New deal by keyboard during a game

- **WHEN** a started game is in progress and the player focuses New deal and presses Enter
- **THEN** the New deal options sheet opens

#### Scenario: Touch target

- **WHEN** the pointer is coarse
- **THEN** the New deal control's target area measures at least 44×44 px

#### Scenario: Disabled during a sequence or while dealing

- **WHEN** a safe-card chain is running, or a deal is being prepared
- **THEN** the New deal control is disabled and keeps the accessible name "New deal"

### Requirement: Deal code footer

The footer SHALL show the current deal code as "Deal <code>" (for example "Deal 1-K7Q29XD"), with the
label in the active language. Activating it by pointer or by keyboard (Enter or Space when focused)
SHALL copy the code to the clipboard and confirm it with the code-copied notice and a polite
announcement. When copying is unavailable or refused, the code text SHALL be selected instead so the
player can copy it themselves, and no confirmation SHALL be shown. The control's accessible name
SHALL include the code and the copy action, and it SHALL show a visible focus indicator. Drag is not
an input path: the control is a button. No animation.

*(KS-DEAL-02, KS-A11Y-02, KS-A11Y-03)*

#### Scenario: Copy by pointer

- **WHEN** the clipboard is available and the player taps the deal code
- **THEN** the code is on the clipboard and the code-copied notice appears and is announced

#### Scenario: Copy by keyboard

- **WHEN** the deal code is focused and Space is pressed
- **THEN** the code is copied and the confirmation is shown

#### Scenario: No clipboard

- **WHEN** the clipboard refuses the write
- **THEN** the code text is selected and no code-copied notice appears

### Requirement: The board is hidden while paused

While the Paused sheet is open, the table SHALL be hidden: no card, slot or badge is visible, and the
table is removed from the accessibility tree, so a paused game cannot be studied. The HUD SHALL keep
showing the frozen time. Resuming SHALL show the table again exactly as it was. Hiding and showing
the table SHALL involve no animation, so the no-motion path is the same.

Input-agnostic: follows the paused state, however pausing was requested.

*(KS-SCO-07)*

#### Scenario: Paused hides the table

- **WHEN** the game is paused
- **THEN** no card is visible or exposed to assistive technology

#### Scenario: Resume shows the same position

- **WHEN** the game is resumed
- **THEN** every card is shown where it was before pausing
