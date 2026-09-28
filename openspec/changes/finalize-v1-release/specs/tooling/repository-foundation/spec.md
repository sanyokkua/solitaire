# Spec Delta

## ADDED Requirements

### Requirement: Edge cases are proven end to end

The browser layer SHALL include specs that prove each of these edge cases against the production build.
Each SHALL assert through what the player perceives (the board, the HUD, notices and announcements) and,
where storage is the subject, through the stored record, never through a test hook in the shipped
application:
- **Corrupt stored record:** the app starts with default settings and statistics, shows a non-blocking
  notice, keeps a verbatim copy of the unreadable record in the backup key, and a new game is playable.
- **Failing save:** when writing to storage fails (for example, the quota is full), a non-blocking notice
  appears and the game in progress stays playable.
- **Reload during a drag:** no half-applied move is stored, and Continue game restores the last committed
  position.
- **Reload during Finish:** Continue game restores a consistent position that the game actually reached,
  with that position's score and move count, and play continues from it.
- **Vegas pass limit:** after the third pass, activating the empty stock does not recycle the waste and
  "No redeals left" is shown.
- **Draw 3 recycle penalty:** the recycles that begin the second and third passes cost no points, and each
  recycle that begins the fourth or a later pass costs exactly 20 points.
- **Undo and redo storm:** after a storm of moves, undos and redos that leaves more than 200 steps on
  each side of the history, and a reload, Continue game restores the same position with the newest 200
  undo steps and the nearest 200 redo steps, and no others.
- **Rapid double taps:** a double tap on a movable card applies at most one move, and the move counter
  rises by at most one.
- **Resize during the deal:** when the viewport changes while the deal is being laid out, every card ends
  at its final position for the new size and the game state is unchanged.
- **Daily rollover:** under a mocked clock that passes 00:00 UTC, the Daily started afterwards is the new
  UTC date's deal, not the previous date's. The daily streak still counts the run of completed UTC dates
  that ends on the previous date, and falls to zero once a date is missed.
- **Older stored record:** a valid version 1 record is upgraded to the current version with nothing lost
  and no backup copy, and Continue game restores its game.

Input coverage: the talon cases are proven by tap and by keyboard, because the stock is activated, never
dragged. The reload-during-a-drag case is proven by a mouse drag and the double-tap case by taps, because
each concerns that gesture. The remaining cases concern storage, time and layout, so they are
input-agnostic.

*(KS-PER-01, KS-PER-02, KS-PER-03, KS-PER-04, KS-PER-06 (new), KS-AST-05, KS-AST-07, KS-INP-03,
KS-INP-06, KS-MOVE-04, KS-MOVE-05, KS-SCO-01, KS-GEN-08, KS-DEAL-07, KS-STA-04; edge-case specs (new))*

#### Scenario: A corrupt record starts with defaults

- **WHEN** the stored record is not valid JSON and the application loads
- **THEN** Home shows the default settings and a non-blocking notice, the backup key holds the unreadable
  text unchanged, and a new game can be dealt and played

#### Scenario: A failing save keeps the game playable

- **WHEN** every storage write fails while a game is in progress and the player makes a move
- **THEN** a non-blocking notice appears, the move is applied, and further moves can be made

#### Scenario: Reload in the middle of a drag

- **WHEN** a card is being dragged with the mouse and the page reloads before the drag ends
- **THEN** Continue game restores the position before the drag, with no card moved and the move count
  unchanged

#### Scenario: Reload in the middle of Finish

- **WHEN** Finish is playing the remaining cards and the page reloads
- **THEN** Continue game restores a position the game reached, in which every card appears exactly once
  and the score and move count match that position

#### Scenario: Vegas refuses a fourth pass by tap and by keyboard

- **WHEN** a Vegas game has used its third pass and the player activates the empty stock by tap, and
  again by keyboard
- **THEN** the waste is not recycled either time, "No redeals left" is shown, and the score is unchanged

#### Scenario: Draw 3 charges from the fourth pass by tap and by keyboard

- **WHEN** a Standard Draw 3 game recycles the waste to begin the second, third and fourth passes, by tap
  and by keyboard
- **THEN** the recycles that begin the second and third passes cost no points, and the one that begins
  the fourth pass lowers the score by exactly 20 points

#### Scenario: Undo storm survives a reload

- **WHEN** moves, undos and redos leave more than 200 undo steps and more than 200 redo steps, and the
  page reloads
- **THEN** Continue game restores the same position with exactly 200 undos and 200 redos available: the
  newest undo steps and the nearest redo steps

#### Scenario: A double tap never applies two moves

- **WHEN** the player double-taps a movable card rapidly
- **THEN** at most one move is applied and the move counter rises by at most one

#### Scenario: Resize during the deal

- **WHEN** the viewport is resized while the deal is being laid out
- **THEN** every card ends at its final position for the new viewport, and the dealt position is the same
  as without the resize

#### Scenario: Daily rollover at midnight UTC

- **WHEN** the previous date's Daily is completed, the mocked clock passes 00:00 UTC, and the player
  starts the Daily
- **THEN** it is the new UTC date's deal, with a different deal code from the previous date's, and
  Statistics still shows the daily streak that ends on the previous date

#### Scenario: A missed date ends the daily streak

- **WHEN** the mocked clock moves past a whole UTC date on which no Daily was completed
- **THEN** Statistics shows a current daily streak of zero and keeps the best daily streak

#### Scenario: A version 1 record is upgraded

- **WHEN** the application loads a valid version 1 record that holds an unfinished game
- **THEN** no notice is shown, the backup key stays empty, Continue game restores that game exactly, and
  the next save writes the current version

### Requirement: Requirement traceability is generated and checked

The repository SHALL provide a command that generates a committed traceability matrix, kept in the
reference documentation. The matrix SHALL list every KS id cited by a requirement of the main OpenSpec specs. Delta specs of
active changes do not change the matrix, so a new proposal never makes it stale. For each id it SHALL
give:
- the capability and requirement names that cite it;
- the test files that declare coverage of it;
- or, where no automated test is practical, the recorded manual check that covers it.

Tests SHALL declare the ids they cover with a marked comment naming each id. Manual checks SHALL be
recorded, each with the ids it covers, in the repository's manual-checks record. Generation SHALL be
deterministic: the same specs, tests and manual checks always produce the same matrix, in the same order.

An automated test SHALL fail, naming the problem, when:
- the committed matrix differs from a fresh generation;
- a test or a manual check declares an id that no requirement cites, in the main specs or in an active
  change's delta specs;
- an id cited by a main-spec requirement has neither a test nor a manual check.

An id cited only by an active change's delta specs is known, so a test may already declare it, but it is
not yet required to be covered. It joins the matrix, and the coverage rule, when the change's specs are
synced into the main specs.

The test runs with the unit and component tests, so the validation gate enforces it.

Input-agnostic: a repository gate.

*(new)*

#### Scenario: The matrix is regenerated

- **WHEN** the generation command runs
- **THEN** it rewrites the committed matrix, listing each id's requirements, test files and manual checks,
  and a second run changes nothing

#### Scenario: A stale matrix fails

- **WHEN** a test adds a coverage comment for an id and the matrix is not regenerated
- **THEN** the traceability test fails and says that the matrix is out of date

#### Scenario: An unknown id fails

- **WHEN** a test declares coverage of an id that no requirement cites
- **THEN** the traceability test fails and names the test file and the id

#### Scenario: An uncovered id fails

- **WHEN** a requirement cites an id that no test and no manual check covers
- **THEN** the traceability test fails and names the id and the requirement

#### Scenario: A proposal does not make the matrix stale

- **WHEN** an active change adds a delta requirement citing a new id, and a test declares coverage of it
- **THEN** the traceability test passes and the committed matrix is unchanged until the change's specs are
  synced

#### Scenario: A manual check counts as coverage

- **WHEN** an id is covered only by an entry in the manual-checks record
- **THEN** the traceability test passes and the matrix lists that manual check for the id

### Requirement: No references to the retired spec pack

The retired specification pack SHALL NOT exist in the working tree. It was the `spec` folder under `docs/`:
the product specification, the research notes, the phased design and the HTML mockup.

No tracked file SHALL refer to it, apart from the exemptions below. This covers:
- source, tests and scripts;
- configuration and workflows;
- the documentation, the README, the changelog and the agent instructions;
- the OpenSpec configuration and the main specs.

A reference is any of:
- a path into the retired folder;
- the mockup's file name;
- the file name of one of the pack's three documents, and the phased design's name (`phased-design`)
  with or without its extension;
- a research-notes section citation (the letter R followed by a section sign and a number);
- a product-specification section citation (`spec §` or `specification §` followed by a number).

These are exempt:
- OpenSpec change folders, active or archived, because they record history;
- the guard's own source, which must name what it forbids;
- a reference pinned to a git revision (a commit id, a colon, then the file's former path). This names
  history, not the working tree.

A test fixture derived from the retired reference solver SHALL cite that solver by git revision. An
automated test SHALL enforce this requirement and SHALL name each offending file and line. It runs with
the unit and component tests, so the validation gate enforces it.

Input-agnostic: a repository gate.

*(new)*

#### Scenario: A research-notes citation fails the guard

- **WHEN** a source comment cites a research-notes section, or a doc links into the retired folder
- **THEN** the guard test fails and names the file and line

#### Scenario: A specification section citation fails the guard

- **WHEN** a main-spec footnote cites a product-specification section such as "spec §3.2"
- **THEN** the guard test fails and names the file and line

#### Scenario: Change history is exempt

- **WHEN** an archived OpenSpec change refers to the retired folder
- **THEN** the guard test passes

#### Scenario: A revision-pinned citation passes

- **WHEN** a solver fixture cites the retired reference solver by a commit id and its former path
- **THEN** the guard test passes

#### Scenario: The pack is gone

- **WHEN** the guard test runs
- **THEN** it fails if the retired folder exists in the working tree

### Requirement: Releases are versioned and recorded

The package version SHALL follow semantic versioning, and this release SHALL be 1.0.0. A changelog at the
repository root SHALL record each release, newest first, with its version, its date and its highlights. A
release procedure in the development documentation SHALL give the steps in order:
1. run the full validation gate and the end-to-end suite;
2. merge the change into the integration branch;
3. merge the release pull request into the default branch, which deploys to Pages;
4. tag the release.

A release tag SHALL be named `v` followed by the package version, and SHALL be created only on the default
branch, on the commit that the merged release pull request produced. The procedure SHALL state that
pushing, opening the pull request and tagging each happen only when the author asks.

Input-agnostic: a repository process.

*(new)*

#### Scenario: Version and changelog agree

- **WHEN** release 1.0.0 is prepared
- **THEN** the package version is 1.0.0, and the changelog's newest entry is 1.0.0 with its date and
  highlights

#### Scenario: Tags come only from the default branch

- **WHEN** the release pull request has merged into the default branch
- **THEN** the tag `v1.0.0` is created on the resulting default-branch commit, and no release tag exists
  on a feature or integration branch

#### Scenario: The procedure is documented

- **WHEN** the development documentation is read
- **THEN** it gives the build, verify, merge and tag steps and says that each push, pull request and tag
  needs the author's request

### Requirement: Committed reference screenshots are the look-and-feel reference

The repository SHALL commit a small set of reference screenshots of the production build, stored in the
documentation. The set SHALL show Home and the Game screen in the light and the dark theme, on a desktop
and a phone viewport; the Game screen shows a fixed seeded position. The README SHALL show them.

An opt-in end-to-end spec SHALL regenerate the set:
- it runs only when explicitly requested, in desktop Chromium;
- otherwise it is skipped, so ordinary suite runs and continuous integration never rewrite the set;
- it is registered in the Chromium-only guard list.

A change that alters the look SHALL be reviewed by eye against these screenshots, and SHALL regenerate the
affected ones in the same change. No pixel comparison SHALL gate a run.

Input-agnostic: captures of rendered states.

*(new; supports KS-GEN-03, KS-SET-03)*

#### Scenario: Ordinary runs leave the set alone

- **WHEN** the end-to-end suite runs without the opt-in
- **THEN** the capture spec is skipped and no committed screenshot is written

#### Scenario: The set is regenerated on request

- **WHEN** the capture spec runs with the opt-in
- **THEN** it writes each screenshot of the set from the production build to its committed location,
  replacing the previous file

#### Scenario: The README shows the set

- **WHEN** the README is read
- **THEN** its images are the committed reference screenshots

#### Scenario: A visual change is reviewed

- **WHEN** a change alters colours, type or layout
- **THEN** its review compares the new screenshots with the committed ones by eye, and the change commits
  the regenerated screenshots

### Requirement: Maintained documentation links resolve

Every relative Markdown link, and every repository path cited in inline code, in the maintained
documentation SHALL resolve to a file or directory that exists. An inline-code path is a token that
starts with `src/`, `tests/`, `docs/`, `scripts/`, `public/`, `openspec/` or `.github/`. Tokens that hold a
glob (`*`), a brace list (`{…}`), a placeholder (`<…>`), or that name generated output (`dist/`,
`coverage/`, `playwright-report/`, `test-results/`) are not paths and are not checked. This covers:
- the README and the changelog;
- the files under `docs/`;
- the module READMEs under `src/` and `tests/`;
- the agent instructions.

A cited source symbol written as `path#symbol` SHALL name an existing file. External `https://` links are
not checked. An automated test SHALL enforce this requirement and SHALL name each broken link with its file
and line. It runs with the unit and component tests, so the validation gate enforces it.

Input-agnostic: a repository gate.

*(new)*

#### Scenario: A broken relative link fails the check

- **WHEN** a maintained document links to a relative path that does not exist
- **THEN** the documentation-link test fails and names the file, the line and the missing target

#### Scenario: A moved source file is caught

- **WHEN** a source file cited as `path#symbol` in a maintained document is renamed or removed
- **THEN** the documentation-link test fails until the document is updated

#### Scenario: External links are not fetched

- **WHEN** a maintained document contains an `https://` link
- **THEN** the documentation-link test neither fetches nor fails on it

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

The browser layer SHALL run the device-fit matrix and the longer-strings check in one dedicated
desktop-Chromium project that emulates each matrix configuration's viewport, touch support and
pointer type per case; every other browser project SHALL skip them, and the dedicated project SHALL
run nothing else. Specs declared Chromium-only (visual parity, deal latency, the drag-performance trace,
the reference-screenshot capture, offline and update, and the accessibility scan) SHALL run in the
desktop Chromium project and skip in every other project, and a repository test SHALL fail when the
project split or a Chromium-only skip guard is missing.
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
  parity, deal latency, the drag-performance trace, the reference-screenshot capture, offline and update,
  accessibility scan), which skip in other projects, with touch profiles reporting a coarse pointer and
  touch support

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

### Requirement: Deterministic source formatting

The repository SHALL define a single formatting standard — 4-space indentation, a 120-column print
width, single quotes, trailing commas and terminating semicolons — applied to TypeScript, JavaScript,
JSON, CSS, HTML, YAML and Markdown. It SHALL expose one command that rewrites files to that standard
and one that checks conformance without writing. The OpenSpec planning tree, the lockfile and build
output SHALL be excluded from formatting. Maintained documentation, including every file under `docs/`,
SHALL NOT be excluded: the check covers it like source. *(new)*

#### Scenario: Conformant tree passes the check

- **WHEN** the format-check command runs after the format command
- **THEN** it reports no differences and exits zero

#### Scenario: Non-conformant file fails the check

- **WHEN** a source file uses 2-space indentation or omits a statement semicolon
- **THEN** the format-check command exits non-zero and names that file

#### Scenario: Specification pack is left alone

- **WHEN** the format command runs
- **THEN** no file under `openspec/`, the OpenSpec planning tree, is rewritten

#### Scenario: Maintained docs are checked

- **WHEN** a Markdown file under `docs/` does not match the formatting standard
- **THEN** the format-check command exits non-zero and names that file

### Requirement: Single aggregate validation gate

The repository SHALL expose one command that runs the full local gate in order:
1. format check;
2. lint;
3. type check;
4. the lifecycle-storage guard;
5. unit and component tests, with coverage;
6. build;
7. the artifact check of "The built artifact is validated".

The lifecycle-storage guard SHALL fail when the application lifecycle test uses ambient browser storage
instead of an injected storage gateway. The test step SHALL measure coverage and SHALL fail when line,
branch, function or statement coverage falls below 80%, even if every test passes. The gate SHALL stop at
the first failing step and exit non-zero.

*(new; artifact check KS-PWA-04; coverage in the gate (new))*

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

#### Scenario: Coverage below a threshold fails the gate

- **WHEN** every unit and component test passes but branch coverage is 79%
- **THEN** the validate command exits non-zero at the test step and does not run the build or the
  artifact check

#### Scenario: A bad artifact fails the gate

- **WHEN** the build succeeds but a built script loads a worker from a third-party origin
- **THEN** the validate command exits non-zero after the build

### Requirement: Continuous integration on every push and pull request

Continuous integration SHALL run on every push and pull request, performing a clean install followed
by the full validation gate and the end-to-end suite across all configured browser projects.

Every build it makes SHALL be stamped with the workflow's run number and a UTC build date and time, both
determined by the build itself when it runs. The run number SHALL come from the value the CI runner
provides to every step, and the build SHALL compute the time. The workflow SHALL NOT pass the build a
number or time through a workflow expression. So no build is stamped with an empty value, or with a
property that the workflow's context does not have.

It SHALL publish the end-to-end report as an artifact when the suite fails. It SHALL publish the
visual-parity screenshots as an artifact on every run, whether the suite passes or fails. Each such
screenshot SHALL be named by its screen and state (for example, the Game screen in the dark theme on a
phone). The screenshots are compared by eye with the committed reference screenshots; no pixel comparison
gates the run.

It SHALL request no more than read access to repository contents.

*(new; build stamp KS-GEN-11 (new); screenshot artifact (new))*

#### Scenario: Pull request is validated

- **WHEN** a pull request is opened or updated
- **THEN** the workflow installs from the lockfile, runs the validation gate, runs the end-to-end
  suite on every configured project, and reports a single pass/fail status

#### Scenario: The CI build is stamped

- **WHEN** continuous integration builds the application in its 57th run
- **THEN** the built application carries build number 57 and the UTC date and time of that build, and
  neither value is empty

#### Scenario: No build value comes from a workflow expression

- **WHEN** the workflow definitions are checked
- **THEN** no workflow sets a build number or build time for the build; the build reads the runner's run
  number and computes its own time

#### Scenario: Failure preserves evidence

- **WHEN** the end-to-end suite fails in continuous integration
- **THEN** the run uploads the report and result directories as a downloadable artifact

#### Scenario: Screenshots are always published

- **WHEN** the end-to-end suite passes in continuous integration
- **THEN** the run still uploads the visual-parity screenshots, each named by its screen and state, as a
  downloadable artifact

### Requirement: Deployment to GitHub Pages from the default branch

A deployment workflow SHALL publish the built artifact to GitHub Pages on pushes to the default
branch and on manual dispatch. It SHALL build exactly once per deployment, through the validation
gate (which builds and then checks the artifact), and deploy that same validated artifact.

That build SHALL be stamped as in continuous integration: with the deployment workflow's run number and
the UTC build date and time, both determined by the build itself. No build value SHALL be passed through
a workflow expression.

It SHALL serialize concurrent deployments. Write access to Pages and the OIDC token SHALL be granted only
to the job that performs the deployment.

*(new; build stamp KS-GEN-11 (new))*

#### Scenario: Default-branch push deploys

- **WHEN** a commit is pushed to the default branch
- **THEN** the workflow runs the validation gate, whose build is stamped with the run number and the UTC
  build time, uploads the resulting `dist/` as the Pages artifact without building again, and deploys it

#### Scenario: The deployed build is identified

- **WHEN** the deployed application is opened
- **THEN** it carries the deploying run's number and a UTC build date and time, and neither is empty

#### Scenario: Non-default branch does not deploy

- **WHEN** a commit is pushed to any other branch
- **THEN** no deployment occurs

#### Scenario: Elevated permissions are scoped

- **WHEN** the deployment workflow runs
- **THEN** only the deploying job holds Pages-write and identity-token permissions; the building job
  holds read access only

### Requirement: Informational solver benchmark outside the validation gate

The repository SHALL provide a separate benchmark command. For each of Draw 1, Draw 3 and Vegas, over a
fixed seed set, it SHALL report:
- the verdict distribution (win, loss, unknown) at the search budgets that the deal service uses for that
  mode;
- the median and the 95th percentile of the time to select a winnable deal;
- the share of verified deals graded Easy, Medium and Hard;
- the median and the 95th percentile of the time to grade one verified deal.

It SHALL NOT be part of any of these:
- the validation gate;
- the commit-time gate;
- the push-time gate;
- continuous integration.

The seed sets are fixed, so every run measures the same deals. The verdicts and grades it reports are
therefore identical from run to run; only the timings vary.

The *KS-PERF-02* targets for a deal searched on demand are a 300 ms median and a 1.5 s 95th percentile
for Draw 1 on a mid-range phone. The benchmark SHALL report the Draw 1 timings against them, and SHALL
report the Draw 3 and Vegas timings for information, with no target. It SHALL NOT gate on any timing.

Measuring deal latency in a real browser through the application's own worker, including deals from the
warm pool, is covered by "In-browser deal latency is reported".

*(KS-PERF-02; per-mode and grading report (new))*

#### Scenario: The benchmark reports latency

- **WHEN** the benchmark command runs
- **THEN** it prints, for Draw 1, Draw 3 and Vegas, the verdict distribution and the timing statistics
  for winnable selection over the fixed seed set, and exits zero whatever the timings

#### Scenario: The benchmark reports grading

- **WHEN** the benchmark command runs
- **THEN** it prints, per mode, the shares of Easy, Medium and Hard among the verified deals and the time
  to grade a deal, and a second run prints the same verdicts and shares

#### Scenario: The validation gate does not run the benchmark

- **WHEN** the validate command runs
- **THEN** no benchmark is executed

### Requirement: In-browser deal latency is reported

The browser layer SHALL include a desktop-Chromium-only spec that measures Winnable deals through the real
background solver in each of Draw 1, Draw 3 and Vegas. For each deal it SHALL measure:
- the time from activating the start control to the dealt table;
- the longest main-thread task during that time.

It SHALL measure two paths per mode:
- **On demand:** each of 10 iterations loads a fresh page and deals at once, before any pooled deal is
  ready. Every such deal is searched by a newly started background solver. These figures SHALL be
  labelled on-demand, cold-worker latency.
- **Warm pool:** 10 deals are each taken after the pool is known to hold a deal for that mode. The spec
  learns this from the pre-verification thread itself, by counting its completed selection replies, not
  by waiting a fixed time. These figures SHALL be labelled warm-pool latency.

It SHALL also report, for information, Draw 1 on demand with difficulty Hard, and Draw 1 on demand while a
pre-verification is in flight.

For each mode and path, the spec SHALL report the median, the 95th percentile and the maximum, and SHALL
show that the background solver ran. The targets are:
- Draw 1 on demand with difficulty Any: 300 ms at the median and 1.5 s at the 95th percentile;
- warm pool, every mode: 100 ms.

Draw 3 and Vegas on demand have no target and are reported for information. The spec SHALL pass whatever
the measured values.

Input-agnostic: a measurement, driven by pointer activation of the start control.

*(KS-DEAL-10, KS-PERF-02 reported, not gated; KS-DEAL-12 (new) warm pool; KS-DEAL-03 is proven by unit
tests and shown to the player by the deal chip of `ui/game-screen`; cold-worker loop and warm-pool
report (new))*

#### Scenario: Latency report

- **WHEN** the latency spec runs in the desktop Chromium project
- **THEN** for each of Draw 1, Draw 3 and Vegas, each of 10 iterations opens a fresh page, deals, and
  observes a worker start. The spec records the median, 95th percentile and maximum deal latency and the
  longest main-thread task as annotations labelled on-demand and cold-worker, and passes regardless of
  the measured values

#### Scenario: Warm-pool report

- **WHEN** the latency spec deals in each mode after the pool has filled for that mode
- **THEN** it records the median, 95th percentile and maximum deal latency and the longest main-thread
  task as annotations labelled warm-pool, against the 100 ms target, and passes regardless of the
  measured values

### Requirement: Pure input modules stay pure

The purity guard SHALL cover every pure input module listed in `src/ui/README.md` (the card locator,
landing areas, the pointer controller, the keyboard controller and the cascade frames, alongside the
existing layout modules): each SHALL import only its siblings and domain modules, and SHALL NOT use
React, the DOM, timers, storage, `crypto`, `Math.random`, `Date` or `performance`. The ESLint import
override SHALL list every such module, and a test SHALL fail when the README list and the override
disagree or a listed file is missing.

*(new; constitution principle 1: input controllers are testable without a browser)*

#### Scenario: A listed module imports React

- **WHEN** a listed pure module imports React
- **THEN** the guard test fails

#### Scenario: An unlisted pure module

- **WHEN** a module is listed in the README but missing from the ESLint override
- **THEN** the guard test fails

### Requirement: Input is proven end to end

The end-to-end suite SHALL play full games to a win through real input, in every mode:
- Draw 1 (Standard scoring) by tap, by drag and by keyboard;
- Draw 3 by keyboard;
- Vegas by drag;
- the Daily deal by tap. It is started from Home under a mocked clock set to a pinned date, so the
  application deals that date's Daily.

Every game SHALL be played with Auto-move safe cards off, and the tap games with Select and place. Each
win SHALL pass in the Chromium, Firefox and WebKit desktop projects and in at least one touch project. It
SHALL be asserted through what the player perceives (the "You win" announcement and the HUD), not through
internal state.

The winning lines SHALL be recorded fixtures:
- each was generated once by the solver from its deal's seed and mode, and is stored with them;
- the end-to-end helpers translate each command of a line into the gesture, and never run the solver;
- a replay test SHALL apply every recorded line through the game rules from its deal, without the solver,
  and SHALL fail unless the line ends in a won game.

The same seed and mode always produce the same deal, so each line replays identically on every run.

A keyboard scenario SHALL also move one card with the Smart move setting through Shift+Enter pick-up.

Touch drag SHALL be checked in the mobile projects:
- in the Chromium mobile project, with real touch events, asserting that the card moves (or returns) and
  that the page does not scroll;
- in the WebKit mobile projects, where Playwright cannot send touch drags, by asserting that the board's
  computed `touch-action` is `none` and that a pointer-event drag moves the card. iOS scroll suppression
  itself is a recorded manual check.

A spec limited to some projects SHALL skip elsewhere through the existing project guard, and a
Chromium-only spec SHALL be registered in the guard's spec list. No test hook SHALL ship in the
production bundle: the built page SHALL expose no store or hook on `window`.

*(new; KS-INP-02, KS-INP-04, KS-INP-05, KS-INP-06, KS-INP-07, KS-INP-08, KS-INP-10, KS-MOVE-07,
KS-DEAL-07, KS-A11Y-02; all-mode wins (new))*

#### Scenario: Win by tap

- **WHEN** the Draw 1 fixture line is played by taps
- **THEN** the game ends won and "You win" is announced

#### Scenario: Win by drag

- **WHEN** the Draw 1 fixture line is played by mouse drags
- **THEN** the game ends won

#### Scenario: Win by keyboard

- **WHEN** the Draw 1 fixture line is played by keyboard only
- **THEN** the game ends won

#### Scenario: Draw 3 win by keyboard

- **WHEN** the Draw 3 fixture line, with its explicit draws, is played by keyboard only
- **THEN** the game ends won and "You win" is announced

#### Scenario: Vegas win by drag

- **WHEN** the Vegas fixture line is played by drags, with the stock activated where the line draws
- **THEN** the game ends won and the HUD shows the final Vegas score as money

#### Scenario: Daily win by tap

- **WHEN** the clock is fixed on the pinned date, the Daily is started from Home, and that date's
  fixture line is played by taps
- **THEN** the dealt game is that date's Daily, and it ends won with "You win" announced

#### Scenario: Every engine and a touch project

- **WHEN** the end-to-end suite runs
- **THEN** each of these wins passes in the Chromium, Firefox and WebKit desktop projects and in at least
  one touch project

#### Scenario: Recorded lines replay without the solver

- **WHEN** the replay test runs
- **THEN** every recorded line ends in a won game from its deal, and a line changed to make an illegal
  move fails the test

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

### Requirement: Accessibility scan

The browser layer SHALL include a desktop-Chromium-only spec that runs an automated accessibility scan of
Home, the Game screen and every sheet. It SHALL scan each of them in the light theme, in the dark theme,
and in the dark theme with night cards. It SHALL fail on any finding rated serious or critical, including
text contrast below 4.5:1.

Input-agnostic: a scan of rendered states.

*(KS-A11Y-01, KS-A11Y-03, KS-A11Y-05, KS-SET-03 night cards; scan (new))*

#### Scenario: A serious finding fails the scan

- **WHEN** a sheet renders a button with no accessible name
- **THEN** the accessibility spec fails and names the finding

#### Scenario: Every surface in both themes

- **WHEN** the accessibility spec runs
- **THEN** it scans Home, Game and each of the eight sheets in the light theme, the dark theme, and the
  dark theme with night cards

#### Scenario: Night cards keep their contrast

- **WHEN** a card rendered with night cards has text or a suit symbol below 4.5:1 contrast against its
  face
- **THEN** the accessibility spec fails and names the finding

### Requirement: Performance and installability are checked manually and recorded

Checks that need a real device or a real browser session SHALL be documented manual checks, not gates.
They SHALL be listed in the repository's manual-checks record. Each entry SHALL give:
- the procedure and the target;
- the KS ids it covers;
- the latest result, with its date and the device and browser used, or, for a check that needs a device
  the author does not have, a dated waiver giving the reason.

The record SHALL cover at least:
- **Drag smoothness (KS-PERF-01):** dragging cards and the card animations hold 60 fps on a mid-range
  phone.
- **Deal latency (KS-PERF-02):** on a mid-range phone, a Draw 1 winnable deal with difficulty Any searched on
  demand takes 300 ms or less at the median and 1.5 s or less at the 95th percentile. A deal from a warm pool appears
  within 100 ms in every mode.
- **Lighthouse (KS-PERF-03, KS-PWA-02):** on the production build, the mobile performance score is at
  least 90 and the result is installable.
- **Real-device fit (KS-GEN-03, KS-GEN-05, KS-GEN-10):** on each real device checked, the record gives the
  actual `innerWidth`×`innerHeight`, in portrait and landscape, in the browser and installed. It records
  whether every control and card clears the safe areas, and compares the sizes with the device matrix.
- **iOS scroll suppression (KS-INP-10):** dragging a card by touch on iOS does not scroll or zoom the page.

Installability prerequisites and offline behaviour remain gated automatically by "The built artifact is
validated" and "Offline and update behaviour proven end to end".

The browser layer SHALL also include a desktop-Chromium-only spec, registered in the Chromium-only guard
list, that produces an informational drag-performance trace. It drags cards across the board on a
phone-sized touch viewport with the CPU throttled. It keeps the trace as a test attachment and reports the
frame timings as annotations, without asserting on them.

Input-agnostic: measurements and records; the trace is driven by drag, the gesture it measures.

*(KS-PERF-01, KS-PERF-02, KS-PERF-03, KS-PWA-02, KS-GEN-03, KS-GEN-05, KS-GEN-10, KS-INP-10; manual
checks and drag trace (new))*

#### Scenario: The result is recorded

- **WHEN** the manual-checks record is read
- **THEN** it states how to run the Lighthouse check, its targets, and the latest recorded result with
  its date and browser

#### Scenario: Every manual check is recorded

- **WHEN** the manual-checks record is read
- **THEN** it lists the drag-smoothness, deal-latency, Lighthouse, real-device-fit and iOS
  scroll-suppression checks, each with its procedure, target, KS ids and either a latest dated result on a
  named device and browser or a dated waiver with its reason

#### Scenario: The drag trace is informational

- **WHEN** the drag-performance spec runs in the desktop Chromium project
- **THEN** it attaches a performance trace of the throttled drags, records the frame timings as
  annotations, and passes regardless of the measured values
