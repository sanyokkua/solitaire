# tooling/repository-foundation Specification

## Purpose
Defines how the repository installs, builds, formats, lints, type-checks, tests and deploys itself,
and which of those gates run automatically on commit, on push and in continuous integration, so that
every later change lands inside an already-working harness.

## Requirements

### Requirement: Reproducible install on a pinned runtime

The repository SHALL declare a minimum Node runtime of 22.22.2 and SHALL commit a lockfile so that a
clean checkout installs byte-identical dependency versions. Direct dependency versions SHALL be exact
(no range specifiers). *(new)*

#### Scenario: Clean install from a fresh checkout

- **WHEN** a contributor runs the clean-install command on a checkout with no `node_modules`
- **THEN** the install completes without modifying the lockfile, and every quality command below is
  runnable afterwards

#### Scenario: Unsupported Node version

- **WHEN** the installed Node runtime is older than 22.22.2
- **THEN** the install reports the engine mismatch rather than silently producing an unsupported
  environment

### Requirement: Production build under the Pages base path

The build SHALL emit a static artifact into `dist/` in which every generated asset reference is
prefixed with the `/solitaire/` base path, and the build SHALL fail on any type error before emitting
output. The artifact SHALL be servable as static files with no server, API or database. *(KS-GEN-01)*

#### Scenario: Successful build

- **WHEN** the build command runs on a checkout that type-checks cleanly
- **THEN** `dist/index.html` exists and every script, stylesheet and asset URL it references begins
  with `/solitaire/`

#### Scenario: Build blocked by a type error

- **WHEN** the build command runs while any source file fails type checking
- **THEN** the command exits non-zero and no `dist/` output is produced or updated

### Requirement: Deterministic source formatting

The repository SHALL define a single formatting standard — 4-space indentation, a 120-column print
width, single quotes, trailing commas and terminating semicolons — applied to TypeScript, JavaScript,
JSON, CSS, HTML, YAML and Markdown. It SHALL expose one command that rewrites files to that standard
and one that checks conformance without writing. The spec pack under `docs/spec/`, the OpenSpec
planning tree, the lockfile and build output SHALL be excluded from formatting. *(new)*

#### Scenario: Conformant tree passes the check

- **WHEN** the format-check command runs after the format command
- **THEN** it reports no differences and exits zero

#### Scenario: Non-conformant file fails the check

- **WHEN** a source file uses 2-space indentation or omits a statement semicolon
- **THEN** the format-check command exits non-zero and names that file

#### Scenario: Specification pack is left alone

- **WHEN** the format command runs
- **THEN** no file under `docs/spec/` or `openspec/` is rewritten

### Requirement: Static analysis rejects unsound typing

Linting SHALL apply type-aware rules across all TypeScript and TSX sources. Explicit `any`,
floating promises, unsafe member access on untyped values and unused declarations SHALL be reported
as errors, not warnings. Formatting concerns SHALL NOT be duplicated as lint rules. *(new)*

#### Scenario: Clean tree lints cleanly

- **WHEN** the lint command runs on the committed source tree
- **THEN** it exits zero with no errors and no warnings

#### Scenario: Explicit `any` is rejected

- **WHEN** a source file declares a value or parameter typed as `any`
- **THEN** the lint command exits non-zero and reports it as an error

#### Scenario: Unhandled promise is rejected

- **WHEN** a source file calls a promise-returning function without awaiting or otherwise handling it
- **THEN** the lint command exits non-zero and reports it as an error

### Requirement: Strict type checking

Type checking SHALL run as a standalone command and SHALL enforce, beyond TypeScript's `strict`
family, that indexed access yields possibly-undefined values, that optional properties are exact,
that overrides are explicit, that switch cases do not fall through, and that unused locals and
parameters are errors. *(new)*

#### Scenario: Unchecked index access is rejected

- **WHEN** a source file reads an array element by index and uses it without a presence check
- **THEN** the type-check command exits non-zero

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

### Requirement: Single aggregate validation gate

The repository SHALL expose one command that runs the full local gate in order: format check, lint,
type check, unit and component tests, then build. It SHALL stop at the first failing step and exit
non-zero. *(new)*

#### Scenario: Whole gate passes

- **WHEN** the validate command runs on a clean checkout
- **THEN** every step runs in order and the command exits zero

#### Scenario: Gate stops at the first failure

- **WHEN** linting fails
- **THEN** the validate command exits non-zero and does not run type checking, tests or the build

### Requirement: Commit-time gate

Committing SHALL automatically format and auto-fix the staged files, restage the resulting content so
the commit contains the corrected text, and then run type checking and the unit and component tests.
The commit SHALL be rejected if any of those steps fails. End-to-end tests SHALL NOT run at commit
time. *(new)*

#### Scenario: Mis-formatted staged file is corrected in place

- **WHEN** a contributor stages a file that violates the formatting standard and commits
- **THEN** the file is reformatted, the reformatted content is included in that commit, and the
  commit succeeds

#### Scenario: Type error blocks the commit

- **WHEN** a contributor commits while the tree contains a type error
- **THEN** the commit is rejected and the error is reported

#### Scenario: Failing unit test blocks the commit

- **WHEN** a contributor commits while a unit or component test fails
- **THEN** the commit is rejected

### Requirement: Push-time gate

Pushing SHALL run the end-to-end suite and SHALL reject the push if it fails. *(new)*

#### Scenario: Failing end-to-end test blocks the push

- **WHEN** a contributor pushes while an end-to-end spec fails
- **THEN** the push is rejected and the failure is reported

### Requirement: Continuous integration on every push and pull request

Continuous integration SHALL run on every push and pull request, performing a clean install followed
by the full validation gate and the end-to-end suite across all configured browser projects. It SHALL
publish the end-to-end report as an artifact when the suite fails. It SHALL request no more than read
access to repository contents. *(new)*

#### Scenario: Pull request is validated

- **WHEN** a pull request is opened or updated
- **THEN** the workflow installs from the lockfile, runs the validation gate, runs the end-to-end
  suite on every configured project, and reports a single pass/fail status

#### Scenario: Failure preserves evidence

- **WHEN** the end-to-end suite fails in continuous integration
- **THEN** the run uploads the report and result directories as a downloadable artifact

### Requirement: Deployment to GitHub Pages from the default branch

A deployment workflow SHALL publish the built artifact to GitHub Pages on pushes to the default
branch and on manual dispatch. It SHALL run the validation gate before building, stamp the build with
the run's start time, and serialize concurrent deployments. Write access to Pages and the OIDC token
SHALL be granted only to the job that performs the deployment. *(new)*

#### Scenario: Default-branch push deploys

- **WHEN** a commit is pushed to the default branch
- **THEN** the workflow validates, builds with the build timestamp set, uploads `dist/` as the Pages
  artifact, and deploys it

#### Scenario: Non-default branch does not deploy

- **WHEN** a commit is pushed to any other branch
- **THEN** no deployment occurs

#### Scenario: Elevated permissions are scoped

- **WHEN** the deployment workflow runs
- **THEN** only the deploying job holds Pages-write and identity-token permissions; the building job
  holds read access only

### Requirement: Base path agreement across configurations

The `/solitaire/` base path SHALL be identical in the build configuration, the in-process test
environment URL and the end-to-end base URL, and an automated test SHALL fail if any of them
diverges. *(new)*

#### Scenario: One configuration drifts

- **WHEN** the base path is changed in the build configuration but not in the test configurations
- **THEN** the unit test asserting base-path agreement fails

### Requirement: No third-party runtime hosts

The shipped application SHALL load no font, image, stylesheet or script from a third-party host. All
such assets SHALL be served from the deployed artifact itself. *(KS-PWA-04, KS-GEN-01)*

#### Scenario: Remote asset reference is rejected

- **WHEN** a stylesheet or the HTML entry point references an `http://` or `https://` URL for a font,
  image, stylesheet or script
- **THEN** the automated check asserting local-only assets fails

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
