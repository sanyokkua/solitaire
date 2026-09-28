# Spec Delta

## ADDED Requirements

### Requirement: The built artifact is validated

The repository SHALL provide a command that checks the built artifact and fails, naming the problem,
when any of these does not hold:
- every local script, stylesheet, icon, manifest and asset reference in the entry page (anchors
  excluded) begins with the `/solitaire/` base path;
- the web manifest's start URL and scope are `/solitaire/`, its display mode is standalone, and every
  icon it lists exists in the artifact, including at least one maskable icon;
- the offline cache list exists and includes the entry page, every emitted script and stylesheet,
  the solver's background-thread script, both bundled typefaces, the icons and the manifest;
- no reference the app loads points to another origin, as "No third-party runtime hosts" requires
  (plain URL text and anchors are not loads).

Each check SHALL be covered by tests against small fixture artifacts, one passing and one failing
per check.

Input-agnostic: a repository gate.

*(KS-PWA-01, KS-PWA-02, KS-PWA-04, KS-GEN-01; artifact check (new))*

#### Scenario: A reference outside the base path

- **WHEN** the built entry page references a script at `/assets/app.js`
- **THEN** the artifact check exits non-zero and names that reference

#### Scenario: A missing maskable icon

- **WHEN** the manifest lists no maskable icon, or lists an icon file that is not in the artifact
- **THEN** the artifact check exits non-zero

#### Scenario: The worker is not cached

- **WHEN** the offline cache list omits the solver's background-thread script
- **THEN** the artifact check exits non-zero

#### Scenario: A clean artifact passes

- **WHEN** the artifact check runs on a fresh production build, whose scripts contain XML namespace
  strings and library error-documentation URLs as plain text
- **THEN** it exits zero

### Requirement: End-to-end tests do not use service workers unless they opt in

The browser layer SHALL block service workers by default, so no spec sees offline caching or an
update prompt it did not ask for. A spec that tests offline or update behaviour SHALL opt in
explicitly for its own pages.

Input-agnostic: test configuration.

*(new; supports KS-PWA-01, KS-PWA-03)*

#### Scenario: Default specs run without a worker

- **WHEN** an ordinary end-to-end spec loads the application
- **THEN** no service worker is registered for its page

#### Scenario: The offline spec opts in

- **WHEN** the offline and update spec loads the application
- **THEN** a service worker is registered and controls its page

### Requirement: Offline and update behaviour proven end to end

The browser layer SHALL include a desktop-Chromium-only spec that proves two flows against the
production build:
- offline cold start: after one online visit, with the network cut, a new page on `/solitaire/`
  loads, a Winnable Draw 1 game is dealt through the cached background solver, and one move is
  played;
- update: when a changed service worker is found, the update-ready notice appears; choosing Update
  reloads the page on the new version with the game restored exactly.

If serving a changed service-worker script proves unreliable in the browser layer, the update flow
MAY instead be proven by a component test with a fake PWA gateway, and the task that makes this
choice SHALL record it in `tests/README.md`. That fallback SHALL still assert that the save runs
before the update activates and that the game restores from the saved record. The offline cold start
flow stays proven end to end regardless, with no fallback.

Input-agnostic: the flows are driven by pointer activation; tap, drag and keyboard play are proven
elsewhere.

*(KS-PWA-01, KS-PWA-03)*

#### Scenario: Offline cold start

- **WHEN** the application has been visited once online and a new page is opened offline
- **THEN** Home loads, a Winnable Draw 1 game is dealt and a move is applied

#### Scenario: Update keeps the game

- **WHEN** a game has moves, a new version is found and the player chooses Update
- **THEN** after the reload Continue game restores the identical game

#### Scenario: Fallback recorded when the end-to-end update flow is unreliable

- **WHEN** the task decides that serving a changed service-worker script is unreliable in the browser
  layer and proves the update flow with a component test and a fake PWA gateway instead
- **THEN** `tests/README.md` records that choice, and the component test asserts the save runs before
  the update activates and that the game restores from the saved record

### Requirement: Accessibility scan

The browser layer SHALL include a desktop-Chromium-only spec that runs an automated accessibility
scan of Home, the Game screen and every sheet, in the light and the dark theme, and SHALL fail on any
finding rated serious or critical.

Input-agnostic: a scan of rendered states.

*(KS-A11Y-01, KS-A11Y-03, KS-A11Y-05; scan (new))*

#### Scenario: A serious finding fails the scan

- **WHEN** a sheet renders a button with no accessible name
- **THEN** the accessibility spec fails and names the finding

#### Scenario: Every surface in both themes

- **WHEN** the accessibility spec runs
- **THEN** it scans Home, Game and each of the eight sheets in the light and the dark theme

### Requirement: Performance and installability are checked manually and recorded

Mobile performance and installability SHALL be measured with Lighthouse on the production build as a
documented manual check, not as a gate: the target is a mobile performance score of at least 90 and
an installable result. The procedure and the latest result SHALL be recorded in the repository's
test documentation. Installability prerequisites and offline behaviour remain gated automatically by
"The built artifact is validated" and "Offline and update behaviour proven end to end".

Input-agnostic: a measurement.

*(KS-PERF-03, KS-PWA-02; manual check (new))*

#### Scenario: The result is recorded

- **WHEN** the test documentation is read
- **THEN** it states how to run the Lighthouse check, its targets, and the latest recorded result

### Requirement: Longer strings are checked on the device matrix

The device-fit project SHALL check that no text clips or overlaps on Home, the Game screen and the
sheets when every visible string is 30% longer than English, and SHALL run the device-fit matrix
again in Ukrainian. A component-level check SHALL render every screen and sheet with a test-only
pseudo-language derived from English, so any string not taken from the language catalog is found.
The pseudo-language SHALL NOT ship in the production bundle.

Input-agnostic: layout checks.

*(KS-I18N-01, KS-I18N-04, KS-GEN-03, KS-GEN-05)*

#### Scenario: Padded strings do not clip

- **WHEN** the longer-strings check runs on each device-matrix configuration
- **THEN** no checked element overflows its box

#### Scenario: Ukrainian fits

- **WHEN** the device-fit matrix runs in Ukrainian
- **THEN** it passes as in English

#### Scenario: A hard-coded string is found

- **WHEN** a component renders a literal English string instead of a catalog message
- **THEN** the pseudo-language component check fails

## MODIFIED Requirements

### Requirement: Single aggregate validation gate

The repository SHALL expose one command that runs the full local gate in order: format check, lint,
type check, the lifecycle-storage guard, unit and component tests, build, then the artifact check
of "The built artifact is validated". The lifecycle-storage guard SHALL fail when the application
lifecycle test uses ambient browser storage instead of an injected storage gateway. The gate SHALL
stop at the first failing step and exit non-zero. *(new; artifact check KS-PWA-04)*

#### Scenario: Whole gate passes

- **WHEN** the validate command runs on a clean checkout
- **THEN** every step runs in order and the command exits zero

#### Scenario: Gate stops at the first failure

- **WHEN** linting fails
- **THEN** the validate command exits non-zero and does not run type checking, the lifecycle-storage
  guard, tests, the build or the artifact check

#### Scenario: The lifecycle test must inject storage

- **WHEN** the application lifecycle test refers to ambient `localStorage`
- **THEN** the lifecycle-storage guard exits non-zero and names the violation

#### Scenario: A bad artifact fails the gate

- **WHEN** the build succeeds but a built script loads a worker from a third-party origin
- **THEN** the validate command exits non-zero after the build

### Requirement: Deployment to GitHub Pages from the default branch

A deployment workflow SHALL publish the built artifact to GitHub Pages on pushes to the default
branch and on manual dispatch. It SHALL build exactly once per deployment, through the validation
gate (which builds and then checks the artifact), stamp that build with the run's start time, and
deploy that same validated artifact. It SHALL serialize concurrent deployments. Write access to
Pages and the OIDC token SHALL be granted only to the job that performs the deployment. *(new)*

#### Scenario: Default-branch push deploys

- **WHEN** a commit is pushed to the default branch
- **THEN** the workflow runs the validation gate with the build timestamp set, uploads the resulting
  `dist/` as the Pages artifact without building again, and deploys it

#### Scenario: Non-default branch does not deploy

- **WHEN** a commit is pushed to any other branch
- **THEN** no deployment occurs

#### Scenario: Elevated permissions are scoped

- **WHEN** the deployment workflow runs
- **THEN** only the deploying job holds Pages-write and identity-token permissions; the building job
  holds read access only

### Requirement: No third-party runtime hosts

The shipped application SHALL load no font, image, stylesheet or script from a third-party host. All
such assets SHALL be served from the deployed artifact itself. This SHALL be checked on the source
and on the built artifact. On the built artifact, only the references the app **loads** are checked:
HTML `src`/`href` attributes, including every `<link>`; CSS `url()` and `@import`; the manifest's
`start_url`, `scope` and `icons[].src`; the service worker's precache entries and `importScripts`; and
the string arguments of `import()`, `new Worker(…)`, `new URL(…, import.meta.url)` and
`importScripts(…)` in built scripts. Each such reference SHALL be relative or under `/solitaire/`.
Anchors (`<a href>`, which are navigations, not loads) and plain URL text (for example XML namespace
strings and library error-documentation links) are exempt. *(KS-PWA-04, KS-GEN-01)*

#### Scenario: Remote asset reference is rejected

- **WHEN** a stylesheet or the HTML entry point references an `http://` or `https://` URL for a font,
  image, stylesheet or script
- **THEN** the automated check asserting local-only assets fails

#### Scenario: A third-party load in the bundle is rejected

- **WHEN** a built script calls `import('https://cdn.example.com/lib.js')`
- **THEN** the artifact check exits non-zero and names the file and URL

#### Scenario: Plain URL text and anchors pass

- **WHEN** the built artifact contains XML namespace strings and library error-documentation URLs as
  plain text, and the About sheet's source and licence anchors, and loads nothing from another origin
- **THEN** the artifact check passes

### Requirement: Test suites separated by execution layer

The repository SHALL provide two independently runnable test layers:
- an in-process layer covering unit and component tests;
- a browser layer covering end-to-end tests.

The in-process layer SHALL NOT execute browser-layer specs, and the browser layer SHALL NOT execute
in-process tests. File naming SHALL make the layer unambiguous.

By default the in-process layer SHALL run against a DOM environment whose document URL sits under
the `/solitaire/` base path. A test file that needs no DOM MAY declare a Node environment instead.
Background-thread (worker) entry modules SHALL be exercisable in the in-process layer: the real
worker module runs in-process, with no browser.

The in-process layer SHALL report coverage on demand. Coverage SHALL be measured across every
source file in the project, not only those a test happens to load. A module with no test at all
therefore counts against the configured thresholds instead of being absent from the report.

The browser layer SHALL run the device-fit matrix and the longer-strings check in one dedicated
desktop-Chromium project that emulates each matrix configuration's viewport, touch support and
pointer type per case; every other browser project SHALL skip them, and the dedicated project SHALL
run nothing else. Specs declared Chromium-only (visual parity, deal latency, offline and update, and
the accessibility scan) SHALL run in the desktop Chromium project and skip in every other project,
and a repository test SHALL fail when the project split or a Chromium-only skip guard is missing.
Browser-layer specs that need a known position SHALL obtain it by storing a valid versioned record
before the page loads, never through a test-only hook in the shipped application.

*(new; device-fit project, Chromium-only specs and record seeding (new); KS-I18N-04)*

#### Scenario: In-process layer excludes end-to-end specs

- **WHEN** the unit/component command runs
- **THEN** it executes every unit and component test and no end-to-end spec

#### Scenario: Browser layer covers desktop and touch

- **WHEN** the end-to-end command runs
- **THEN** each specified desktop engine and each specified touch device profile executes the suite,
  except the device-fit matrix, the longer-strings check and the specs declared Chromium-only (visual
  parity, deal latency, offline and update, accessibility scan), which skip in other projects, with
  touch profiles reporting a coarse pointer and touch support

#### Scenario: Device-fit matrix runs once

- **WHEN** the end-to-end command runs
- **THEN** the device-fit matrix and the longer-strings check execute only in their dedicated
  Chromium project, each touch case reports a coarse pointer, and that project executes no other
  spec

#### Scenario: Known positions come from a stored record

- **WHEN** a browser-layer spec needs a fixture position
- **THEN** it writes a valid versioned record before the page loads, and the shipped application
  contains no fixture or test hook

#### Scenario: Coverage falls below threshold

- **WHEN** the coverage command runs and measured coverage is below the configured thresholds
- **THEN** the command exits non-zero

#### Scenario: An untested source file is still measured

- **WHEN** the coverage command runs and a source file is loaded by no test
- **THEN** that file appears in the coverage report with no covered lines and counts towards the
  configured thresholds

#### Scenario: A worker round-trips in-process

- **WHEN** an in-process test starts the solver's background-thread entry through the same worker
  URL the application uses, and posts it a request
- **THEN** the reply arrives with no browser, and the entry module counts towards coverage

### Requirement: In-browser deal latency is reported

The browser layer SHALL include a spec that starts a Winnable Draw 1 game in desktop Chromium
through the real background solver and reports, without failing on the numbers, the time from
activating the start control to the dealt table and the longest main-thread task during the search,
against the targets of 300 ms median and 1.5 s at the 95th percentile. Each of its 10 iterations
SHALL load a fresh page, so every deal starts a new background worker; the report SHALL label the
figures as cold-worker latency and SHALL show that the worker ran.

Input-agnostic: a measurement, driven by pointer activation of the start control.

*(KS-DEAL-10, KS-PERF-02 reported, not gated; KS-DEAL-03 is proven by unit tests and shown to the
player by the deal chip of `ui/game-screen`; cold-worker loop (new))*

#### Scenario: Latency report

- **WHEN** the latency spec runs in the desktop Chromium project
- **THEN** each of 10 iterations opens a fresh page, deals, and observes a worker start, and the spec
  records the median, 95th percentile and maximum deal latency and the longest main-thread task as
  annotations labelled cold-worker, and passes regardless of the measured values
