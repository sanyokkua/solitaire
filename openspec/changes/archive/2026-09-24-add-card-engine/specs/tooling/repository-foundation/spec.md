# Spec Delta

## MODIFIED Requirements

### Requirement: Test suites separated by execution layer

The repository SHALL provide two independently runnable test layers: an in-process layer covering
unit and component tests, and a browser layer covering end-to-end tests. The in-process layer SHALL
NOT execute browser-layer specs, and the browser layer SHALL NOT execute in-process tests. File
naming SHALL make the layer unambiguous. The in-process layer SHALL run against a DOM environment
whose document URL sits under the `/solitaire/` base path, and SHALL report coverage on demand.
Coverage SHALL be measured across every source file in the project, not only those a test happens
to load, so that a module with no test at all counts against the configured thresholds instead of
being absent from the report. *(new)*

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
