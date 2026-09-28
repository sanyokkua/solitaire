# Design

## Context

See `proposal.md` — Why. The constraints that actually shape the approach:

- The repository is empty of code. Every convention set here is inherited unchanged by Phases 2–11,
  so the cost of getting a convention wrong compounds, and the cost of making it strict is at its
  lowest now — there is no existing code to migrate.
- The sibling project `/Users/ok/Development/GitHub/minesweeper` is the stated conventions reference
  ("as in Minesweeper" throughout `docs/spec/phased-design.md`). It is checked out locally, so its
  configuration and its two font binaries are available without network access. It is a *reference*,
  not a template: it has no git hooks, and several of its choices are deliberately superseded below.
- `openspec/config.yaml` `rules.design` asks for a design document only when a change crosses `src/`
  layer boundaries or alters a constitution principle. This change does both — it establishes every
  layer boundary at once, and it reverses a documented convention — so a design document is
  warranted.
- `AGENTS.md` forbids working on or pushing `master`. Anything only observable after a `master` push
  is therefore unverifiable inside this change and must be designed as such.

## Goals / Non-Goals

**Goals**

- One local command (`validate`) that reproduces what continuous integration checks, so a red build
  is reproducible before pushing.
- Gates that cannot be forgotten: formatting is applied rather than merely reported, and the
  expensive suites run at the moment they are cheapest to act on.
- A strictness ceiling chosen now, at zero migration cost, rather than tightened later across a full
  game engine.
- A shell that contains only real code, so every test written in this change tests something the
  product actually does.

**Non-Goals**

- Any game behaviour. No cards, no rules, no persistence, no solver.
- Progressive-web-app concerns. Manifest, icons, service worker and artifact validation are Phase 8
  and are not partially anticipated here.
- Visual fidelity to the mockup. Phase 1 defines the palette tokens; Phases 5–7 consume them.
- Performance tuning of the gates. Correctness first; if the pre-commit hook becomes slow once the
  domain lands, that is a later, evidence-driven change.

## Decisions

### D1 — Prettier uses semicolons, reversing the documented rule

`docs/spec/phased-design.md` §1, `AGENTS.md` and `openspec/config.yaml` all currently specify
`no-semicolons`. The project owner has chosen a Java-adjacent house style: 4-space indent, 120
columns, and terminating semicolons. Semicolons win.

*Alternative considered:* keep `semi: false` and treat the owner's instruction as applying only to
indentation and width. Rejected — it reads the instruction narrower than it was given, and a style
disagreement is far cheaper to settle before the first source file than after.

*Consequence:* three documents describe a rule that will no longer be true. Constitution principle 9
("docs are part of the change") makes correcting them part of this change, not a follow-up. The
`openspec/config.yaml` `context` block matters most: it is injected into every future planning
session, so leaving it stale would repeatedly mislead later changes.

### D2 — No stubs, anywhere

`phased-design.md` Phase 1 says "the folder skeleton from §3.1 with placeholder modules and one
smoke test each" — roughly fifty stub files. That is rejected in favour of directories carrying a
`README.md` and nothing else, with code appearing only when a phase genuinely implements it.

*Rationale:* a stub plus its smoke test is a test that asserts a stub is a stub. It produces coverage
that means nothing, files that every later phase must delete before writing the real thing, and an
import graph that claims structure the code does not have. `AGENTS.md`'s engineering principles
(YAGNI, "reuse before adding") point the same way. The same reasoning applies to test doubles: mocks
are used only where there is no way to exercise the real collaborator, not as a default.

*Alternative considered:* follow Phase 1's literal wording. Rejected as above; `phased-design.md` is
authority level 4 and is explicitly revisable by a phase's planning, which this is.

*Consequence:* the directories `src/domain`, `src/solver`, `src/features`, `src/i18n` and `src/pwa`
exist in git only because each holds a `README.md`. That README is the artifact — it states what
belongs in the layer and which phase fills it — and it is also what makes the layer boundary visible
before there is code to enforce it.

### D3 — What there is to test in a skeleton

With no stubs, the testable surface is exactly the code that is real. That turns out to be enough
for four genuinely meaningful suites:

| Layer | Subject | What the test actually proves |
| --- | --- | --- |
| Unit | `app` slice and store | Route state starts at Home, transitions on dispatch, and the typed selector hooks resolve against the real root state. |
| Unit | `tokens.css` contents | Every colour role of specification §8.1 is defined in all three palettes, and every font source is a bundle-relative path — this is the executable form of `KS-SET-03` and `KS-PWA-04`. |
| Unit | Repository configuration | The `/solitaire/` base path agrees across build, in-process test and end-to-end configuration, and the workflows contain their required steps and pinned action versions. |
| Component | Shell navigation and build stamp | Home renders, pointer and keyboard both reach Game, back returns, and the build-time define reaches the DOM. |
| End-to-end | Smoke | The built artifact actually loads under `/solitaire/` in every browser and touch project and navigates. |

The configuration tests are the unusual ones and they earn their place: the base path is coupled
across four files, and the sibling project demonstrates that this coupling is exactly where a
silent, deploy-time-only breakage lives. Asserting it in-process converts a broken deployment into a
failing unit test.

### D4 — Lint strictness: `strictTypeChecked`, not `recommended`

The sibling project uses `tseslint.configs.recommended` plus two hand-added rules. This project uses
`strictTypeChecked` and `stylisticTypeChecked` with the type-aware project service, keeping
`no-explicit-any` and `consistent-type-imports` explicit for visibility, and `eslint-config-prettier`
last so no formatting rule is duplicated between the two tools.

*Rationale:* the owner asked for "strict typing, no any usage, modern typescript with strict
verifications". Type-aware rules — `no-floating-promises`, `no-unnecessary-condition`,
`no-unsafe-*` — are the part of that request `recommended` does not deliver, and they are precisely
the rules that pay off in a Web Worker and pointer-event codebase, both of which arrive in later
phases.

*Trade-off:* type-aware linting needs type information and is therefore slower than syntactic
linting. Accepted; see R2.

*Compiler settings follow the same reasoning:* `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes` on top of `strict`. `noUncheckedIndexedAccess` in particular is aimed at
the game engine, where the tableau is an array of arrays and an out-of-range column read must not
type as a `TableauCard`.

### D5 — Hook layering: cheap gates on commit, expensive gates on push

`pre-commit` runs lint-staged (format and auto-fix the staged files, then restage them), then
`typecheck`, then the unit and component suites. `pre-push` runs Playwright.

*Rationale:* lint-staged is scoped to staged files because the whole-tree cost grows with the
repository, while `typecheck` and the in-process tests are whole-tree by nature — a staged-file-only
check cannot see that an edit broke a different module. Playwright starts browsers and builds the
app; it belongs at the push boundary, which is also the last point before other people see the work.

*Alternative considered:* run the full `validate` chain on commit. Rejected — it duplicates
`format:check` against lint-staged's write pass and adds a production build to every commit.

*Note:* the restaging behaviour is the part that needs verifying rather than assuming. The
requirement is that the *commit contains the corrected text*, which is stronger than "the file on
disk was fixed", and the task for this carries an explicit verification of that.

### D6 — Phase 8 and Phase 4 deferrals, and what they cost now

`vite-plugin-pwa`, the manifest, the icons and `scripts/validate-artifact.mjs` are Phase 8;
`scripts/validate-lifecycle-storage.mjs` is Phase 4. Consequently `validate` is
`format:check && lint && typecheck && test:unit && build` — the sibling's chain minus the two
validation scripts — and `pages.yml` has no artifact-validation step.

*Rationale:* the sibling's `validate-artifact.mjs` asserts a manifest, a service worker and a
precache list. Written now, most of its assertions would have to be commented out or weakened, and a
weakened guard is worse than an absent one because it looks like coverage. Its one assertion that
does apply today — no remote URLs — is instead covered by the `tokens.css` unit test, which is where
a remote font would actually be introduced.

*Consequence:* the `KS-PWA-04` guard exists in this change but at the source level rather than the
artifact level. Phase 8 promotes it to an artifact-level check and should keep both.

### D7 — Action versions are looked up, not copied

`AGENTS.md` requires checking current GitHub Action versions by web search when writing CI. The
sibling's pins are a starting point, not an answer; whatever versions are current at implementation
time are pinned exactly (`vX.Y.Z`, never a floating major) and asserted by the workflow contract
test, so a later unreviewed bump fails a test rather than passing silently.

### D8 — Fonts are copied from the local sibling checkout

Inter and Press Start 2P are copied from `minesweeper/src/assets/fonts/`, along with its SIL OFL
attribution README. They live under `src/assets/` rather than `public/` so the bundler fingerprints
them and rewrites their URLs, which is also what makes the relative-path assertion in D3 meaningful.

*Rationale:* the files are already present locally at the exact versions the spec pack assumes, so no
network fetch is required and there is no risk of shipping a differently-subsetted Inter.

## Risks / Trade-offs

- **The commit hook's restaging is subtle and easy to get wrong.** A hook that formats the working
  tree but not the index produces commits whose content differs from the files that were checked.
  → The task verifies the committed blob, not the working-tree file, and the verification is run
  against a throwaway commit that is then reset.

- **Type-aware linting plus a whole-tree typecheck and test run makes commits slower.** Today the
  tree is tiny and the cost is invisible; by Phase 5 it will not be.
  → Accepted deliberately. If it becomes a real friction point, the honest fix is to move
  `test:unit` to `pre-push` and leave `typecheck` on commit — a one-line change, recorded here so
  the option is not rediscovered from scratch.

- **`exactOptionalPropertyTypes` is the strictest setting here and interacts badly with some
  third-party type definitions**, notably around React prop spreading.
  → It is being enabled with essentially no code in the tree, which is the only cheap moment to find
  out. If a third-party definition makes it untenable, it is disabled in this change with the reason
  recorded, rather than being worked around with casts — casts would defeat D4.

- **The Pages deployment cannot be verified here.** `AGENTS.md` forbids pushing `master`, and the
  deploy is only observable after that push. The workflow can be wrong in ways no local check
  catches (repository Pages settings, environment protection rules).
  → The workflow contract test covers what is statically checkable — steps, ordering, permission
  scoping, pinned versions. The live deploy is recorded as an explicit follow-up rather than as a
  task checkbox that could be ticked without evidence.

- **The sibling's `tsconfig.app.json` is referenced by a project-references root but omits
  `composite: true`, while its build runs `tsc -b`.** Copying that shape blindly risks importing a
  latent misconfiguration.
  → The build task verifies `tsc -b` behaves correctly here rather than assuming the sibling's shape
  is sound.

- **Divergence from the sibling project.** Semicolons, hooks and lint strictness now differ, so
  "as in Minesweeper" is no longer literally true for those three things.
  → Recorded in `AGENTS.md` as part of this change, so the next contributor reads the current rule
  rather than inferring it from the sibling.

## Migration Plan

There is nothing to migrate: no code, no users, no stored data, and no persistence layer until
Phase 4. `openspec/config.yaml` `rules.design` requires the versioned `localStorage` record to be
addressed whenever a change touches persistence — this change does not touch it, and deliberately
does not create the storage seam early.

Deployment is forward-only: the branch `feature/repository-foundation` is squash-merged into
`feature/app-v1-implementation` on archive. Rollback is reverting that commit, which returns the
repository to a documentation-only state. No external system is affected.

## Open Questions

None that can be deferred without changing the specs or the task breakdown. The two decisions that
could have been left open — the semicolon rule and the skeleton depth — were resolved with the
project owner before this document was written, and are recorded as D1 and D2.
