# Spec Delta

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

*(new)*

#### Scenario: In-process layer excludes end-to-end specs

- **WHEN** the unit/component command runs
- **THEN** it executes every unit and component test and no end-to-end spec

#### Scenario: Browser layer covers desktop and touch

- **WHEN** the end-to-end command runs
- **THEN** each specified desktop engine and each specified touch device profile executes the suite,
  with touch profiles reporting a coarse pointer and touch support

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

## ADDED Requirements

### Requirement: Informational solver benchmark outside the validation gate

The repository SHALL provide a separate benchmark command. It SHALL measure how long it takes to
select a winnable Draw 1 deal over a fixed seed set, and SHALL report the median and the 95th
percentile.

It SHALL NOT be part of any of these:
- the validation gate;
- the commit-time gate;
- the push-time gate;
- continuous integration.

The *KS-PERF-02* targets are a 300 ms median and a 1.5 s 95th percentile on a mid-range phone. The
benchmark SHALL report timings against them but not gate on them.

Measuring the same thing in a real browser (Chromium) through the application's own worker belongs
to the first phase whose end-to-end test deals a game. `docs/spec/phased-design.md` records it in
that phase's "done when".

*(KS-PERF-02)*

#### Scenario: The benchmark reports latency

- **WHEN** the benchmark command runs
- **THEN** it prints timing statistics for winnable Draw 1 selection over the fixed seed set and
  exits zero whatever the timings

#### Scenario: The validation gate does not run the benchmark

- **WHEN** the validate command runs
- **THEN** no benchmark is executed
