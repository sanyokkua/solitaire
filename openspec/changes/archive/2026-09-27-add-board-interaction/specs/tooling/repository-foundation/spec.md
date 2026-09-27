# Spec Delta

## ADDED Requirements

### Requirement: Pure input modules stay pure
The purity guard SHALL cover every pure input module listed in `src/ui/README.md` (the card locator,
landing areas, the pointer controller, the keyboard controller and the cascade frames, alongside the
existing layout modules): each SHALL import only its siblings and domain modules, and SHALL NOT use
React, the DOM, timers, storage, `crypto`, `Math.random`, `Date` or `performance`. The ESLint import
override SHALL list every such module, and a test SHALL fail when the README list and the override
disagree or a listed file is missing.

*(new; constitution principle 1 and the phased-design Phase 6 guardrail on browser-free controller
tests)*

#### Scenario: A listed module imports React
- **WHEN** a listed pure module imports React
- **THEN** the guard test fails

#### Scenario: An unlisted pure module
- **WHEN** a module is listed in the README but missing from the ESLint override
- **THEN** the guard test fails

### Requirement: Input is proven end to end
The end-to-end suite SHALL play a fixture deal (the seeded winning line, Draw 1, Standard, Auto-move
safe cards off, Select and place) to a win by tap, by drag and by keyboard in desktop Chromium,
asserting the win through what the player perceives (the announcement and the HUD), not through
internal state. A keyboard scenario SHALL also move one card with the Smart move setting through
Shift+Enter pick-up. Touch drag SHALL be checked in the mobile projects: in the Chromium mobile
project with real touch events, asserting the card moves (or returns) and the page does not scroll;
in the WebKit mobile projects, where Playwright cannot send touch drags, by asserting that the board's
computed `touch-action` is `none` and that a pointer-event drag moves the card (iOS scroll
suppression itself is a recorded manual check). Specs that run in Chromium only SHALL skip elsewhere
through the existing guard and be registered in the guard's spec list. The helpers SHALL translate a
command of the fixture line into the gesture, and no test hook SHALL ship in the production bundle:
the built page SHALL expose no store or hook on `window`.

*(new; phased-design Phase 6 exit criteria, KS-INP-04…08, KS-INP-10)*

#### Scenario: Win by tap
- **WHEN** the fixture line is played by taps
- **THEN** the game ends won and "You win" is announced

#### Scenario: Win by drag
- **WHEN** the fixture line is played by mouse drags
- **THEN** the game ends won

#### Scenario: Win by keyboard
- **WHEN** the fixture line is played by keyboard only
- **THEN** the game ends won

#### Scenario: Pick up in smart mode
- **WHEN** the Smart move setting is on and a card is moved with Shift+Enter, an arrow to another pile
  and Enter
- **THEN** the card is in that pile

#### Scenario: Touch drag does not scroll
- **WHEN** a card is dragged by touch in the Chromium mobile project
- **THEN** `scrollY` is unchanged and the move applies or the card returns

#### Scenario: WebKit board gesture settings
- **WHEN** the board is inspected in a WebKit mobile project
- **THEN** its computed `touch-action` is `none` and a pointer-event drag applies the move

#### Scenario: No hook in the bundle
- **WHEN** the production page is loaded
- **THEN** `window` exposes no store or test hook
