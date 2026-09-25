# Spec Delta

## ADDED Requirements

### Requirement: In-browser deal latency is reported

The browser layer SHALL include a spec that starts a Winnable Draw 1 game in desktop Chromium
through the real background solver and reports, without failing on the numbers, the time from
activating the start control to the dealt table and the longest main-thread task during the search,
against the targets of 300 ms median and 1.5 s at the 95th percentile. Each of its 10 iterations
SHALL load a fresh page, so every deal starts a new background worker; the report SHALL label the
figures as cold-worker latency and SHALL show that the worker ran.

Input-agnostic: a measurement, driven by pointer activation of the start control.

*(KS-DEAL-10, KS-PERF-02 reported, not gated; KS-DEAL-03 remains proven by unit tests until the deal
chip in Phase 7; cold-worker loop (new))*

#### Scenario: Latency report

- **WHEN** the latency spec runs in the desktop Chromium project
- **THEN** each of 10 iterations opens a fresh page, deals, and observes a worker start, and the spec
  records the median, 95th percentile and maximum deal latency and the longest main-thread task as
  annotations labelled cold-worker, and passes regardless of the measured values

## MODIFIED Requirements

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

The browser layer SHALL run the device-fit matrix in one dedicated desktop-Chromium project that
emulates each matrix configuration's viewport, touch support and pointer type per case; every other
browser project SHALL skip the device-fit matrix, and the dedicated project SHALL run nothing else.
Specs declared Chromium-only (visual parity and deal latency) SHALL run in the desktop Chromium
project and skip in every other project, and a repository test SHALL fail when the project split or
a Chromium-only skip guard is missing. Browser-layer specs that need a known position SHALL obtain
it by storing a valid versioned record before the page loads, never through a test-only hook in the
shipped application.

*(new; device-fit project, Chromium-only specs and record seeding (new))*

#### Scenario: In-process layer excludes end-to-end specs

- **WHEN** the unit/component command runs
- **THEN** it executes every unit and component test and no end-to-end spec

#### Scenario: Browser layer covers desktop and touch

- **WHEN** the end-to-end command runs
- **THEN** each specified desktop engine and each specified touch device profile executes the suite,
  except the device-fit matrix and the specs declared Chromium-only (visual parity, deal latency),
  which skip in other projects, with touch profiles reporting a coarse pointer and touch support

#### Scenario: Device-fit matrix runs once

- **WHEN** the end-to-end command runs
- **THEN** the device-fit matrix executes only in its dedicated Chromium project, each touch case
  reports a coarse pointer, and that project executes no other spec

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

### Requirement: Continuous integration on every push and pull request

Continuous integration SHALL run on every push and pull request, performing a clean install followed
by the full validation gate and the end-to-end suite across all configured browser projects. It SHALL
publish the end-to-end report as an artifact when the suite fails, and SHALL publish the
visual-parity screenshots as an artifact on every run, whether the suite passes or fails. It SHALL
request no more than read access to repository contents. *(new; screenshot artifact (new))*

#### Scenario: Pull request is validated

- **WHEN** a pull request is opened or updated
- **THEN** the workflow installs from the lockfile, runs the validation gate, runs the end-to-end
  suite on every configured project, and reports a single pass/fail status

#### Scenario: Failure preserves evidence

- **WHEN** the end-to-end suite fails in continuous integration
- **THEN** the run uploads the report and result directories as a downloadable artifact

#### Scenario: Screenshots are always published

- **WHEN** the end-to-end suite passes in continuous integration
- **THEN** the run still uploads the visual-parity screenshots as a downloadable artifact
