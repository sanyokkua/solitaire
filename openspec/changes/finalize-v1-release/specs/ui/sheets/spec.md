# Spec Delta

## MODIFIED Requirements

### Requirement: Settings sheet

The Settings sheet SHALL show the settings in four groups, each under a visible group heading in small,
capitalised, muted type. Each row SHALL show its label in the bold body typeface with a one-line
explanation in muted body type beneath it, and its control either at the row's end (a switch) or below
the label (a segmented choice or the swatches); rows are divided by thin lines. The groups are:
- **Appearance**: Theme (Light / Dark / System), Night cards (switch), Four-colour deck (switch),
  Card back (Harbour blue / Deep navy / Sky / Coral swatches);
- **Play**: Tap a card to… (Smart move / Select & place), Highlight legal moves, Auto-move safe
  cards, Stock on the right and Animations (switches);
- **Language**: one option per registered language, labelled with its own name;
- **Data**: Reset statistics and Reset all local data.

A segmented choice SHALL be a rounded track with equal-width options, the chosen option raised on the
surface colour with its label in the primary colour. A swatch SHALL be a small card-shaped tile
showing that back's two-tone pixel checker, and the chosen swatch SHALL carry an outline ring, so the
choice is shown by more than colour.

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

*(KS-SET-01, KS-SET-02, KS-SET-04, KS-SET-06, KS-STA-05, KS-PER-05, KS-I18N-01, KS-A11Y-05; groups,
row look and confirmations (new))*

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

The How to play sheet SHALL show:
- four rule cards (fill the foundations Ace to King; build down in alternating colours; only Kings
  fill an empty column; Draw 1 versus Draw 3), each a row with a small rounded tile in the
  primary-container colours holding a short symbol in the pixel typeface (decorative and hidden from
  assistive technology), then a bold title and a one-line muted description, the rows divided by thin
  lines;
- under a small, capitalised, muted "Controls" heading, a controls table (tap/click, drag,
  double-click, Space, Ctrl+Z / Ctrl+Y, H, A, N, P, Esc), each key shown as a small outlined key chip
  in the pixel typeface beside its action;
- under a "Scoring" heading, a short scoring summary for Standard and Vegas;
- under a "Winnable deals" heading, a short passage explaining that with Winnable deals only on, a
  built-in solver proves every Draw 1, Draw 3 and Vegas deal winnable before it is shown; that a
  proven deal is graded by replaying it the way a person plays, seeing only the face-up cards, and
  asking the solver whether it can still be won — Easy when it stays winnable through many plausible
  mistakes, Medium through some, and Hard when only a narrow line wins, although the solver proved it
  winnable; and that Difficulty on Home asks for one of these grades.

Its primary action "Got it" closes it. Key names SHALL be marked up as keys and read in full by
assistive technology.

Input coverage: open and close by tap/click or keyboard; drag is not an input path. No animation
beyond the sheet's own.

*(KS-GEN-02, KS-INP-08, KS-DEAL-03, KS-DEAL-11 (new); rule-card and key-chip look (new))*

#### Scenario: Controls listed

- **WHEN** How to play is opened
- **THEN** the controls table lists tap, drag, double-click, Space, Ctrl+Z / Ctrl+Y, H, A, N, P and
  Esc, and the scoring summary covers Standard and Vegas

#### Scenario: Grades explained

- **WHEN** How to play is opened
- **THEN** its Winnable deals passage says that Draw 1, Draw 3 and Vegas deals are proven winnable
  when Winnable deals only is on, and explains Easy, Medium and Hard by how many plausible mistakes
  a deal stays winnable through

### Requirement: Statistics sheet

The Statistics sheet, a little wider than the other sheets, SHALL show a table with a column per mode
(Draw 1, Draw 3, Vegas, Daily) and rows Played, Won, Win rate, Best time, Best score (Best bank shown
as money for Vegas) and Best streak, plus the Daily streak. The table SHALL be compact: row labels
aligned left, values aligned right in figures of equal width, column headings in small, capitalised,
muted type, and rows divided by thin lines. A value that does not exist yet SHALL show "—". The table
SHALL have header cells for its rows and columns, and scroll sideways inside the sheet when narrow. A
note SHALL say the statistics are kept only in this browser. Reset SHALL ask for confirmation in the
sheet; only the confirmed Reset clears all statistics, and the table then shows zeros and "—".

Input coverage: Reset, confirm, Cancel and Close work by tap/click and keyboard; drag is not an input
path.

*(KS-STA-02, KS-STA-04, KS-STA-05; table look and the confirmation step (new))*

#### Scenario: Missing records

- **WHEN** Draw 3 has been played but never won
- **THEN** its Best time, Best score and Best streak show "—"

#### Scenario: Confirmed reset

- **WHEN** the player activates Reset and then confirms
- **THEN** every mode shows 0 played and 0 won, and the Daily streak is 0

### Requirement: Win sheet

The Win sheet's timing — when it opens relative to the cascade, and what cancels it — is defined by
`ui/win-cascade` "The Win sheet follows the cascade". WHEN it opens, it SHALL show, centred:
- the title "You win!" in the pixel typeface, with the stepped two-colour shadow of the Home wordmark;
- a "New best time" badge — a pill in the tertiary (amber) colour with small capitalised text — when
  the time is strictly lower than the mode's previous best or it is the mode's first win;
- for a graded game, the deal's grade as text: "Easy deal", "Medium deal" or "Hard deal" in English;
  a game with no grade (a random deal, or one started from a deal code) shows no grade;
- a one-line muted summary that includes the time bonus in Standard scoring (omitted in Vegas, which
  has no time bonus);
- three tiles, Score (Bank in Vegas, formatted as the HUD formats it, for example "$47"), Time and
  Moves, each a rounded tile on the raised surface colour with a thin outline, its value in the pixel
  typeface above a small, capitalised, muted label;
- **Menu**, an outlined button, and **Deal again**, a button filled with the primary colour, side by
  side.

Deal again SHALL start a new game in the same mode; Menu SHALL show Home. The Win sheet SHALL have no
close button and SHALL NOT close on Escape or the backdrop; a request to close the open sheet leaves
it open, so only Menu and Deal again leave it. Focus SHALL move to Deal again. The grade SHALL be read
by assistive technology as part of the sheet's text, and SHALL meet 4.5:1 contrast like the rest of
the sheet.

Input coverage: Menu and Deal again work by tap/click and keyboard; drag is not an input path.
No-motion: see `ui/win-cascade` "The Win sheet follows the cascade".

*(KS-GEN-02, KS-SCO-04, KS-STA-02, KS-SET-04, KS-DEAL-11 (new); "New best time" on first win and the
outcome look (new))*

#### Scenario: Standard win with bonus

- **WHEN** a Standard game is won in 2:00 with a best of 3:10 for the mode
- **THEN** the summary includes the 5833-point time bonus and the "New best time" badge shows

#### Scenario: Vegas score tile

- **WHEN** a Vegas game is won with a bank of $84
- **THEN** the Score tile shows "Bank" with "$84" and the summary has no time-bonus line

#### Scenario: Graded win

- **WHEN** a Draw 3 game whose deal was graded Hard is won
- **THEN** the Win sheet shows "Hard deal"

#### Scenario: Ungraded win

- **WHEN** a game started from a deal code is won
- **THEN** the Win sheet shows no grade

#### Scenario: Not dismissable

- **WHEN** the Win sheet is open and the player presses Escape
- **THEN** it stays open until Menu or Deal again is chosen

### Requirement: About sheet

The About sheet SHALL show the app name; its version; the build identification, as
`app/application-shell` "Build identification" defines it — the build number and the UTC build date
and time for a build made by CI (for example "Build 42 · 2026-09-28 14:05 UTC" in English), or the
development label with the build time for a local build; a link to the source repository; the
licence; and a privacy line stating that no data leaves this device. Links SHALL have accessible names
describing their destination.

Input coverage: links and Close work by tap/click and keyboard; drag is not an input path.

*(KS-GEN-01, KS-GEN-02, KS-GEN-11 (new))*

#### Scenario: About content

- **WHEN** About is opened in a build made by CI
- **THEN** it shows the name, the version, the build number with its UTC build date and time, the
  source link, the licence and the privacy line

#### Scenario: Local build

- **WHEN** About is opened in a build made locally, with no build number
- **THEN** it shows the development label with the build time in place of the build number
