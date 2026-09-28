# Spec Delta

## Purpose

Defines the Game screen's frame around the table — the stacked and side-rails chrome profiles, safe
areas, the read-only HUD and the Undo/Redo toolbar — and the guarantee that the whole screen fits
every supported device without scrolling.

## ADDED Requirements

### Requirement: Two chrome profiles

The Game screen SHALL use the side-rails profile while the viewport is in landscape and at most 720 px
tall, and the stacked profile otherwise. In the stacked profile the screen SHALL show, top to bottom:
a top bar with the Back control and a reserved chip slot, the HUD, a reserved hint-line region, the
table, the toolbar and a footer holding the build stamp, at most 64rem (1024 px) wide. In the stacked
profile the footer SHALL be hidden at 480 px wide or narrower, and the hint-line region SHALL be
hidden in portrait with height ≤ 600 px. In the side-rails profile the top bar, hint-line region and
footer SHALL be hidden; a left rail SHALL hold Back, Score, Moves and Time, a right rail SHALL hold
the toolbar, and the table SHALL fill the space between them at full width. The Back control SHALL
keep the accessible name "Back to Home" in both profiles and SHALL be at least 44×44 px where the
pointer is coarse. The chrome profile and the table geometry (stacked or wide table) SHALL be chosen
independently. Region sizes SHALL follow the mockup, and regions reserved for later content SHALL
keep a fixed mockup size so the fit does not change when that content arrives: the HUD New-deal slot
at 2.9rem square (2.6rem at 460 px wide or narrower, 2.5rem in the rails), the hint line at one line
of 0.7rem text (0.64rem at 480 px wide or narrower) with line-height 1.4, and the chip slot at the
Back control's height within the remaining top-bar width.

Input-agnostic: the profile follows the viewport. No animation accompanies a profile change, so no
reduced-motion alternative is required.

*(KS-GEN-06; KS-A11Y-04 Back target size; Back control name kept from Phase 4 and reserved region
sizes (new), from the mockup)*

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

### Requirement: The Game screen never scrolls and respects safe areas

While the Game screen is shown, the page SHALL not scroll in either direction, and every card of any
position — including a worst-case column of 6 face-down and 13 face-up cards — and every control
SHALL lie inside the viewport. This SHALL hold for each §8.5 screen in portrait and landscape, in the
browser (viewport height reduced by the browser bars) and installed, and at 320×480, 1280×720 and
2560×1440. The screen SHALL fill the dynamic viewport height, and its content and controls SHALL keep
clear of every safe-area inset (notch, rounded corners, home indicator) on all edges in both
profiles. On installed screens with a coarse pointer, a worst-case column SHALL keep a face-up strip
of at least 14 px.

Input-agnostic: a layout guarantee. No animation.

*(KS-GEN-03, KS-GEN-05, KS-GEN-10, KS-A11Y-04 strip size)*

#### Scenario: Device-fit matrix

- **WHEN** the Game screen shows a worst-case column on each of the 52 §8.5 configurations and the
  three baseline sizes
- **THEN** the page does not scroll, every card lies inside the table, and the toolbar, the Back
  control and every HUD value lie inside the viewport

#### Scenario: Finger strip on installed phones

- **WHEN** the worst-case column is shown on an installed-mode configuration with a coarse pointer
- **THEN** each exposed face-up card in that column shows at least 14 px

#### Scenario: Safe areas

- **WHEN** the frame styles are inspected
- **THEN** both profiles pad the frame by `env(safe-area-inset-top)`, `env(safe-area-inset-right)`,
  `env(safe-area-inset-bottom)` and `env(safe-area-inset-left)` on every edge; confirmation on real
  devices is part of the Phase 9 checklist, because browser emulation reports no insets

### Requirement: Read-only HUD

The HUD SHALL show Score, Moves and Time for the current game. In Vegas it SHALL show Bank instead of
Score, as whole dollars with a leading minus sign when negative (for example "$47" and "-$52").
Score SHALL be the displayed Standard score (including the time and undo penalties), padded to at
least three digits. Time SHALL show "m:ss" below one hour and "h:mm:ss" from one hour, as spec §4.7
states (the mockup shows only "m:ss"). The values SHALL update as the game and the clock advance. On
viewports 360 px wide or narrower in the stacked profile, Moves SHALL be hidden; the rails SHALL
always show it. The HUD SHALL expose each value with a text label ("Score", "Bank", "Moves", "Time")
to assistive technology, and every HUD text colour SHALL meet 4.5:1 contrast against its
background. Tapping Time to pause (KS-SCO-07) and the New deal control arrive in Phase 7.

Input-agnostic: display only. No animation.

*(KS-SCO-02 money display, KS-SCO-05 timer display; formats from spec §3.2 and §4.7; three-digit
Score padding and hidden Moves at 360 px (new, from the mockup); KS-SET-03 contrast)*

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

### Requirement: Undo and Redo toolbar

The toolbar SHALL offer Undo and Redo. Activating Undo SHALL undo the last player move and activating
Redo SHALL re-apply the last undone move, exactly as the game session defines them. Each control SHALL
be disabled while its action is unavailable (nothing to undo or redo, or a finish sequence is
running), SHALL be operable by pointer activation and by keyboard (Enter or Space when focused),
SHALL have the accessible name "Undo" or "Redo", SHALL show a visible focus indicator, and SHALL be at
least 44×44 px where the pointer is coarse. Drag is not an input path for this requirement: toolbar
buttons are not draggable objects. Hint and Finish controls arrive in Phase 6.

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

The Game screen SHALL keep a level-one heading "Klondike" for assistive technology (it MAY be
visually hidden), and SHALL keep a polite status region announcing "Dealing…" while a deal is being
prepared. While a winnable deal is being prepared, the previous table MAY remain visible; the
dealing overlay arrives in Phase 7.

Input-agnostic: no interaction. No animation.

*(KS-A11Y-01, KS-DEAL-04 context)*

#### Scenario: Screen name

- **WHEN** the Game screen is shown
- **THEN** a level-one heading named "Klondike" is present

#### Scenario: Dealing status

- **WHEN** a deal is being prepared
- **THEN** the status region reads "Dealing…"
