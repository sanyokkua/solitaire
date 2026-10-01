# pwa/offline-install-update Specification

## Purpose
Defines how the game keeps working offline after one online visit, how it is offered for
installation, and how a new version is applied only when the player chooses, after the game has been
saved.

## Requirements

### Requirement: Fully playable offline after one online visit

WHEN the app has been opened once online and its offline cache is complete, the system SHALL load and
be fully playable with no network, including a cold start in a fresh tab or the installed app: Home,
every sheet, dealing in every mode including a winnable Draw 1 deal proven by the solver, playing,
undo, hints, saving and resuming, and both bundled typefaces. A service worker SHALL cache the app
shell, the solver's worker code, the fonts, the icons and the manifest ahead of time, and SHALL answer
every navigation within `/solitaire/` with the cached app. Nothing outside that ahead-of-time cache is
cached at runtime. When a newer version is cached, caches of older versions SHALL be removed.

Input-agnostic: availability does not depend on how the player interacts; play offline keeps tap,
drag and keyboard input exactly as online. No animation.

*(KS-PWA-01, KS-GEN-01)*

#### Scenario: Offline cold start

- **WHEN** the app was visited once online, the device goes offline and a fresh tab opens
  `/solitaire/`
- **THEN** Home appears with its fonts, and Deal cards in Draw 1 with Winnable deals only deals a
  proven-winnable game that accepts a move

#### Scenario: Deep navigation offline

- **WHEN** the device is offline and the player reloads while on the Game screen
- **THEN** the app loads and Continue game restores the game

### Requirement: The first load never waits for the offline cache

The system SHALL register the service worker and fill the offline cache only after the page has
finished loading, so the first visit's time to an interactive Home is not delayed by caching. The
offline cache SHALL hold only the app's own files (app shell, solver worker code, two fonts, icons,
manifest).

Input-agnostic: a loading-order guarantee. No animation.

*(KS-PERF-03, KS-PWA-01)*

#### Scenario: First visit

- **WHEN** the app is opened for the first time
- **THEN** Home becomes interactive before the service worker starts caching

#### Scenario: Registration waits for the load event

- **WHEN** the page is opened
- **THEN** service-worker registration is requested only after the page's `load` event fires, never
  before it

### Requirement: The app is installable

The system SHALL publish a web app manifest whose start URL and scope are `/solitaire/`, with
standalone display, the name "Solitaire", theme and background colours from the
palette, and icons at 192 px and 512 px plus a maskable 512 px icon whose mark lies inside the safe
zone (the central circle whose diameter is 80% of the icon's width), and a 180 px touch icon for
home-screen use on iOS. The page SHALL link the manifest and an SVG favicon, and declare theme colours
for the light and dark schemes.

The favicon and every icon (192, 512, maskable 512 and the 180 px touch icon) SHALL show the same card
motif, drawn in a pixel-art style with crisp square pixels to match the app's retro look: two
staggered playing cards on the navy brand background, a card back in the brand's two-tone pixel
checker behind and offset up and to the left, and in front a white ace of spades face showing a pixel
"A" and a spade in the card ink. Each icon SHALL draw the motif centred, at a whole-pixel scale, with
navy padding around it; the maskable icon SHALL keep both cards inside its safe zone.

Input-agnostic: a delivery requirement. No animation.

*(KS-PWA-02; manifest and icon details, and the card icon (new), checked on the built artifact)*

#### Scenario: Manifest

- **WHEN** the built manifest is read
- **THEN** its start URL and scope are `/solitaire/`, its display is standalone, and every listed
  icon exists, including a maskable one

#### Scenario: Card icon everywhere

- **WHEN** the favicon, the 192 px and 512 px icons, the maskable icon and the touch icon of the
  built artifact are viewed at 16, 32, 180 and 512 px
- **THEN** each shows a card back behind an ace of spades face on the navy background, with crisp
  pixel edges and the same design in every file

#### Scenario: Maskable safe zone

- **WHEN** the maskable icon is cropped to the central circle whose diameter is 80% of its width
- **THEN** both cards lie wholly inside that circle

### Requirement: Install app is offered only when the browser offers installation

WHILE the browser signals that the app can be installed, Home SHALL show an Install app link. WHEN the
player activates it, the system SHALL show the browser's own install prompt. WHEN the player installs
or dismisses that prompt, or the app is installed by other means, the link SHALL be hidden. Where the
browser never signals installability (for example, when already installed or unsupported), the link
SHALL never appear. The link SHALL have the accessible name "Install app" (localised) and a visible
focus indicator.

Input coverage: the link works by tap/click and by keyboard (Enter); drag is not an input path
(nothing is draggable). No animation of its own.

*(KS-PWA-02, KS-A11Y-03, KS-I18N-01)*

#### Scenario: Offer and install

- **WHEN** the browser signals installability and the player activates Install app by tap or with
  Enter
- **THEN** the browser's install prompt appears, and after the player accepts or dismisses it the
  link is gone

#### Scenario: No signal

- **WHEN** the browser never signals installability
- **THEN** Home shows no Install app link

### Requirement: Updates apply only when the player chooses, after saving

WHEN a new version has been downloaded and is waiting, the system SHALL show a persistent update
notice, on Home and on the Game screen, reading that a new version is ready, with **Update** and
**Later** buttons. The notice SHALL be announced politely, SHALL NOT take focus or block board input,
and both buttons SHALL be reachable and operable by keyboard. WHILE saving is read-only, or an
earlier save has failed, at the moment the notice is shown, its text SHALL also warn that the current
game will not be kept. WHEN the player chooses Update, the system SHALL first request a save of the
current game and settings, then activate the new version and reload, whether or not that request
writes anything: a save request that fails only at that moment, with no earlier warning shown, SHALL
NOT block or delay the update and adds no further warning. After the reload, Continue game SHALL
restore the game from the last successful save, if any. WHEN the player chooses Later, the notice
SHALL be hidden for the rest of the session and the new version SHALL activate on the next cold
start. The system SHALL never replace the running version without the player's choice during a
session.

Input coverage: Update and Later work by tap/click and by keyboard (Tab, Enter/Space); drag is not an
input path. No-motion: the notice appears without a slide with reduced motion or Animations off.

*(KS-PWA-03, KS-PER-02, KS-A11Y-02, KS-SET-04)*

#### Scenario: Update saves first

- **WHEN** a game is in progress with 15 moves and the player chooses Update
- **THEN** the game is saved before the new version activates, the page reloads on the new version,
  and Continue game restores the same 15-move position, score and time

#### Scenario: Update proceeds when saving is read-only

- **WHEN** saving is read-only for the session, a game is in progress, and the player chooses Update
- **THEN** the notice has already warned that the current game will not be kept, nothing is written,
  and the new version still activates and reloads, with the game restored from the last successful
  save, if any

#### Scenario: A first-time save failure at Update adds no fresh warning

- **WHEN** saving was not read-only and no earlier save had failed when the notice appeared, and the
  save requested at Update fails
- **THEN** the update still activates and reloads with no fresh warning, and the game restored is the
  one from the last successful save, if any

#### Scenario: Later

- **WHEN** the player chooses Later
- **THEN** the notice is gone for the session, the old version keeps running, and the next cold start
  runs the new version

#### Scenario: Announced and keyboard-operable

- **WHEN** the update notice appears
- **THEN** it is announced politely without moving focus, and the player can Tab to Update and
  activate it with Enter

### Requirement: No third-party hosts at runtime

The system SHALL load no script, style, font, image, manifest or worker from any host other than its
own origin: every request the running app makes goes to the app's own origin. The build-time rule
that enforces this on the artifact, and the exact references that count as a load, are defined by
`tooling/repository-foundation` "No third-party runtime hosts"; this requirement states the
player-facing guarantee it exists to protect.

Input-agnostic: a delivery guarantee. No animation.

*(KS-PWA-04, KS-GEN-01; artifact-level enforcement in `tooling/repository-foundation`)*

#### Scenario: Runtime requests

- **WHEN** the offline end-to-end run loads the app, deals and plays a game, with every request the
  page makes recorded
- **THEN** every recorded request goes to the app's own origin
