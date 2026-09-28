# Spec Delta

## Purpose

Defines the modal sheets shown over Home and the Game screen — how one sheet opens, holds focus and
closes — and the content and behaviour of each of the eight sheets.

## ADDED Requirements

### Requirement: One modal sheet at a time

The system SHALL show at most one sheet at a time; opening a sheet replaces any open one. A sheet
SHALL be a centred modal dialog at every viewport size, over a dimmed backdrop, with `dialog` role,
modal state and an accessible name taken from its visible heading. Its height SHALL be at most 88% of
the dynamic viewport height; content that does not fit SHALL scroll inside the sheet, never the page.
Every sheet except Win SHALL have a close button named "Close" (localised) of at least 44×44 px
where the pointer is coarse. While a sheet is open the screen behind it SHALL be inert: none of its
controls or cards can be focused, activated or reached by assistive technology, and board input is
ignored. The sheet SHALL open with a short rise-in animation (about 180 ms); with reduced motion or
Animations off it SHALL appear at once in its final place. Sheet text SHALL meet 4.5:1 contrast in
the light and dark themes.

Input-agnostic: sheet presentation does not depend on the input that opened it. Nothing in a sheet is
draggable, so drag is not an input path for any sheet; every sheet control is reachable by tap/click
and by keyboard.

*(KS-GEN-02, KS-GEN-03, KS-INP-09, KS-A11Y-04, KS-SET-03, KS-SET-04; 88% cap and centring from the
mockup `.modal-layer`/`.modal-sheet` (new))*

#### Scenario: Only one sheet

- **WHEN** Settings was opened during the win cascade and is still open when the Win sheet's delay
  ends
- **THEN** the Win sheet replaces Settings, and only the Win sheet is shown

#### Scenario: Background inert

- **WHEN** a sheet is open over the Game screen
- **THEN** Tab never reaches a card or HUD control, and a tap on the board does nothing

#### Scenario: Tall content scrolls inside

- **WHEN** How to play is open in a 320×480 viewport
- **THEN** the sheet is at most 88% of the viewport height, its body scrolls and the page does not

#### Scenario: No motion

- **WHEN** Animations is off, or reduced motion is requested, and a sheet opens
- **THEN** it appears at once with no rise-in

### Requirement: Sheet focus is trapped and returned

WHEN a sheet opens, the system SHALL move focus to its designated starting control: Settings its
first control (the Theme choice), How to play its "Got it" action, Statistics its Close button, About
its Close button, New deal options its Cancel action (never the destructive Restart this deal), Paused
its Resume button, the Win sheet its Deal again action, and Play a deal code its text input. While a
sheet is open, Tab and Shift+Tab SHALL cycle only through the sheet's controls. The opener is the
element that had focus when the sheet opened, whether that was a card, a control, or nothing in
particular. WHEN the sheet closes, once the screen behind it is no longer inert and the sheet is no
longer shown, focus SHALL return to the opener if it is still connected to the page, focusable and
visible; otherwise focus SHALL go to the current screen's heading. After an inline Confirm or Cancel on a
Data reset row in Settings or Statistics, focus SHALL return to that row's Reset control. After
Reset all local data, which shows Home and closes the sheet, focus SHALL go to the Home screen
heading. Every focusable control in a sheet SHALL show a visible focus indicator.

Input-agnostic: focus handling is the same whether the sheet was opened by tap/click or by keyboard;
drag is not an input path (nothing is draggable).

*(KS-A11Y-03)*

#### Scenario: Focus in and trapped

- **WHEN** Settings opens from the Home top bar and the player presses Tab repeatedly
- **THEN** focus starts on the Theme choice inside Settings and never leaves it

#### Scenario: Focus returns

- **WHEN** Statistics was opened from the Home link and is closed
- **THEN** focus is back on the Statistics link

#### Scenario: Invoker gone

- **WHEN** the Win sheet's Menu action closes it and shows Home
- **THEN** focus goes to the Home screen heading

#### Scenario: New deal options starts on Cancel

- **WHEN** the New deal options sheet opens
- **THEN** focus starts on Cancel, not on Restart this deal or New deal

#### Scenario: P pressed with nothing focused

- **WHEN** nothing is focused and P opens the Paused sheet
- **THEN** focus starts on Resume, and closing the sheet returns focus to the Game screen's heading

#### Scenario: P pressed while a card is focused

- **WHEN** a card is focused and P opens the Paused sheet
- **THEN** focus starts on Resume, and closing the sheet returns focus to that same card

#### Scenario: Focus back to Reset after confirming

- **WHEN** Reset statistics is confirmed in the Settings sheet
- **THEN** focus returns to the Reset statistics control

#### Scenario: Focus to Home after resetting everything

- **WHEN** Reset all local data is confirmed
- **THEN** the sheet closes, Home is shown and focus goes to the Home screen heading

### Requirement: Escape and the backdrop close a sheet

WHEN the player presses Escape, clicks or taps the backdrop, or activates the close button, the
system SHALL close the open sheet, except the Win sheet, which ignores Escape and the backdrop and has
no close button. No close request closes the Win sheet, whichever path it comes from (the sheet, or
the Game screen's Escape shortcut); only its Menu and Deal again actions leave it. Escape SHALL close only the sheet, never also cancel a board selection or trigger a
game shortcut. Closing Paused this way resumes the game; closing New deal options this way cancels
it.

Input-agnostic note: covered for tap/click (backdrop, close button) and keyboard (Escape); drag is
not an input path.

*(KS-GEN-02, KS-INP-08 Esc)*

#### Scenario: Escape

- **WHEN** How to play is open and the player presses Escape
- **THEN** it closes

#### Scenario: Backdrop tap

- **WHEN** Statistics is open and the player taps the backdrop
- **THEN** it closes

#### Scenario: Win cannot be dismissed

- **WHEN** the Win sheet is open and the player presses Escape or taps the backdrop
- **THEN** the Win sheet stays open

### Requirement: Sheet text follows the language at once

WHEN the language changes while a sheet is open, the system SHALL update the sheet's heading, its
accessible name and all its text at once, keep the sheet open and keep focus on the same control.

Input-agnostic: see `i18n/localisation`. No animation.

*(KS-I18N-01)*

#### Scenario: Language switch in an open sheet

- **WHEN** Settings is open and the player selects Українська
- **THEN** the dialog's accessible name and every row read in Ukrainian and Settings stays open

### Requirement: Settings sheet

The Settings sheet SHALL show the settings in four groups under visible group headings, each row with
a label and a one-line explanation (mockup `.setting-row`, `.sub-label`):
- **Appearance**: Theme (Light / Dark / System), Night cards (switch), Four-colour deck (switch),
  Card back (Harbour blue / Deep navy / Sky / Coral swatches);
- **Play**: Tap a card to… (Smart move / Select & place), Highlight legal moves, Auto-move safe
  cards, Stock on the right and Animations (switches);
- **Language**: one option per registered language, labelled with its own name;
- **Data**: Reset statistics and Reset all local data.

Each change SHALL apply at once, without a reload, and be remembered; it never changes the rules of
a game in progress. Switches SHALL expose the switch role, the row's name and their on/off state.
Segmented options and swatches SHALL each be a named single-choice group whose options expose the
radio role and checked state; arrow keys move and select within a group. Swatches SHALL be named by
colour ("Harbour blue"), not by colour alone. Each Data action SHALL require an explicit
confirmation step in the sheet — a second, clearly labelled confirming control with a Cancel — before
anything is cleared: confirmed Reset statistics clears all statistics; confirmed Reset all local data
clears stored data and restores defaults (the language from the browser). Cancelling, or closing
the sheet, clears nothing.

Input coverage: every control works by tap/click and by keyboard (Tab, Enter/Space, arrow keys
within a group); drag is not an input path (nothing is draggable). No-motion: switch and swatch
state changes are instant with reduced motion or Animations off.

*(KS-SET-01, KS-SET-02, KS-SET-04, KS-SET-06, KS-STA-05, KS-PER-05, KS-I18N-01; groups and
confirmations (new), from spec §3.3/§6 over the mockup's flat list)*

#### Scenario: A switch by tap and by keyboard

- **WHEN** the player taps the Four-colour deck switch, or focuses it and presses Space
- **THEN** it reports on, the deck shows four colours at once, and after a reload it is still on

#### Scenario: Segmented choice by keyboard

- **WHEN** the Theme group is focused on Light and the player presses the right arrow
- **THEN** Dark is checked and the page turns dark at once

#### Scenario: Reset needs confirmation

- **WHEN** the player activates Reset statistics
- **THEN** nothing is cleared until the confirming control is activated; Cancel clears nothing

#### Scenario: Reset all local data

- **WHEN** the player confirms Reset all local data
- **THEN** statistics, settings and the saved game are cleared and defaults are restored

### Requirement: How to play sheet

The How to play sheet SHALL show four rule cards (fill the foundations Ace to King; build down in
alternating colours; only Kings fill an empty column; Draw 1 versus Draw 3), a controls table
(tap/click, drag, double-click, Space, Ctrl+Z / Ctrl+Y, H, A, N, P, Esc) and a short scoring
summary for Standard and Vegas, following the mockup's `.help-rule` and `.keys-table`. Its primary
action "Got it" closes it. Key names SHALL be marked up as keys and read in full by assistive
technology.

Input coverage: open and close by tap/click or keyboard; drag is not an input path. No animation
beyond the sheet's own.

*(KS-GEN-02, KS-INP-08; spec §3.3 How to play)*

#### Scenario: Controls listed

- **WHEN** How to play is opened
- **THEN** the controls table lists tap, drag, double-click, Space, Ctrl+Z / Ctrl+Y, H, A, N, P and
  Esc, and the scoring summary covers Standard and Vegas

### Requirement: Statistics sheet

The Statistics sheet SHALL show a table with a column per mode (Draw 1, Draw 3, Vegas, Daily) and rows
Played, Won, Win rate, Best time, Best score (Best bank shown as money for Vegas) and Best streak,
plus the Daily streak, following the mockup's `.stats-table`. A value that does not exist yet SHALL
show "—". The table SHALL have header cells for its rows and columns, and scroll sideways inside the
sheet when narrow. A note SHALL say the statistics are kept only in this browser. Reset SHALL ask for
confirmation in the sheet; only the confirmed Reset clears all statistics, and the table then shows
zeros and "—".

Input coverage: Reset, confirm, Cancel and Close work by tap/click and keyboard; drag is not an input
path.

*(KS-STA-02, KS-STA-04, KS-STA-05; confirmation over the mockup's instant reset)*

#### Scenario: Missing records

- **WHEN** Draw 3 has been played but never won
- **THEN** its Best time, Best score and Best streak show "—"

#### Scenario: Confirmed reset

- **WHEN** the player activates Reset and then confirms
- **THEN** every mode shows 0 played and 0 won, and the Daily streak is 0

### Requirement: New deal options sheet

WHEN the player asks for a new deal (the HUD New deal button or N) during a started, unfinished game,
the system SHALL show the New deal options sheet with **Restart this deal**, **New deal** and
**Cancel**, and a line warning that leaving breaks the current streak. Restart this deal SHALL
re-deal the same deal code in the same mode with score, moves, time and history reset. New deal SHALL
deal a fresh game in the same mode. Both SHALL reset that mode's current streak. Cancel, Escape or the
backdrop SHALL close the sheet and leave the game unchanged. WHEN no move has been made yet, or the
game is won, a new deal SHALL start at once without the sheet.

Input coverage: the request comes by tap/click (New deal button) or keyboard (N); the choices work
by tap/click and keyboard; drag is not an input path.

*(KS-DEAL-08, KS-STA-03, KS-INP-08 N)*

#### Scenario: Restart this deal

- **WHEN** a started game shows deal code `1-K7Q29XD` and the player chooses Restart this deal
- **THEN** the same layout is dealt with code `1-K7Q29XD`, score 0, moves 0, time 0:00 and no undo
  history

#### Scenario: Cancel keeps the game

- **WHEN** the player presses N mid-game and then Cancel
- **THEN** the game, time and streak are unchanged

#### Scenario: Unstarted game

- **WHEN** no move has been made and the player activates New deal
- **THEN** a new deal starts at once and no sheet opens

### Requirement: Paused sheet

WHEN the player activates the Time counter or presses P during an unfinished game, the system SHALL
pause and show the Paused sheet. While it is open the board SHALL be hidden and removed from the
accessibility tree, the clock and time penalty SHALL not advance, and the sheet SHALL show the frozen
time, the deal code with a control that copies it (the same behaviour as the Game footer's deal
code, so the code is reachable where that footer is hidden), and a Resume button that has focus.
Resume, Escape, the backdrop or P SHALL close the sheet, show the board and resume the clock. Time
cannot resume the game, because the screen behind the sheet is inert.

Input coverage: pause and resume by tap/click (Time counter, Resume, backdrop) and keyboard (P,
Escape, Enter/Space on Resume); drag is not an input path.

*(KS-SCO-07, KS-SCO-06, KS-INP-08 P)*

#### Scenario: Pause by keyboard

- **WHEN** the time reads 2:14 and the player presses P
- **THEN** the Paused sheet shows 2:14, the cards are hidden, and after 10 s it still shows 2:14

#### Scenario: Resume by tap

- **WHEN** the Paused sheet is open and the player taps Resume
- **THEN** the board is shown and the clock continues from 2:14

#### Scenario: Deal code on a narrow phone

- **WHEN** the Game screen is 360 px wide (footer hidden) and the player opens the Paused sheet
- **THEN** the sheet shows the current deal code, and activating its copy control copies it

### Requirement: Win sheet

The Win sheet's timing — when it opens relative to the cascade, and what cancels it — is defined by
`ui/win-cascade` "The Win sheet follows the cascade". WHEN it opens, it SHALL follow the mockup's
`.outcome-sheet`: the pixel title "You win!", a one-line summary that includes the time bonus in
Standard scoring (omitted in Vegas, which has no time bonus), a "New best time" badge when the time
is strictly lower than the mode's previous best or it is the mode's first win, Score (Bank in Vegas,
formatted as the HUD formats it, for example "$47"), Time and Moves tiles, and **Menu** and **Deal
again**. Deal again SHALL start a new game in the same mode; Menu SHALL show Home. The Win sheet
SHALL have no close button and SHALL NOT close on Escape or the backdrop; a request to close the open
sheet leaves it open, so only Menu and Deal again leave it. Focus SHALL move to Deal again.

Input coverage: Menu and Deal again work by tap/click and keyboard; drag is not an input path.
No-motion: see `ui/win-cascade` "The Win sheet follows the cascade".

*(KS-GEN-02, KS-SCO-04, KS-STA-02, KS-SET-04; "New best time" on first win (new))*

#### Scenario: Standard win with bonus

- **WHEN** a Standard game is won in 2:00 with a best of 3:10 for the mode
- **THEN** the summary includes the 5833-point time bonus and the "New best time" badge shows

#### Scenario: Vegas score tile

- **WHEN** a Vegas game is won with a bank of $84
- **THEN** the Score tile shows "Bank" with "$84" and the summary has no time-bonus line

#### Scenario: Not dismissable

- **WHEN** the Win sheet is open and the player presses Escape
- **THEN** it stays open until Menu or Deal again is chosen

### Requirement: Play a deal code sheet

The Play a deal code sheet SHALL show a labelled text input with focus and a Play button. WHEN the
player submits a valid code (Play, or Enter in the input), the system SHALL close the sheet, show the
Game screen and start exactly that deal in the code's mode; the same code SHALL always give the same
layout (deterministic: code → seed → deal). Surrounding spaces are ignored. IF the code is invalid,
THEN the system SHALL show an inline error associated with the input as its description, mark the
input invalid, keep focus in the input and start no game. Starting a code while a started game is
unfinished breaks that mode's streak.

Input coverage: submit by tap/click (Play) or keyboard (Enter); drag is not an input path.

*(KS-DEAL-02, KS-DEAL-09, KS-STA-03)*

#### Scenario: Valid code

- **WHEN** the player enters `1-K7Q29XD` and presses Enter
- **THEN** the Game screen shows that Draw 1 deal with code `1-K7Q29XD`, and entering it again deals
  the identical layout

#### Scenario: Invalid code

- **WHEN** the player enters `hello` and taps Play
- **THEN** an inline error is announced as the input's description, focus stays in the input and no
  game starts

### Requirement: About sheet

The About sheet SHALL show the app name, its version and build stamp, a link to the source
repository, the licence and a privacy line stating that no data leaves this device. Links SHALL have
accessible names describing their destination.

Input coverage: links and Close work by tap/click and keyboard; drag is not an input path.

*(KS-GEN-01, KS-GEN-02; spec §3.3 About)*

#### Scenario: About content

- **WHEN** About is opened
- **THEN** it shows the name, version, build stamp, source link, licence and the privacy line
