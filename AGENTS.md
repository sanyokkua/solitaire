# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, etc.) working in this repository.

## Current project

This repository will become **Klondike Solitaire**, a calm, retro-styled, offline-capable static SPA/PWA (Vite + React + TypeScript + Redux Toolkit), deployed to GitHub Pages under `/solitaire/`. There is no backend, API, database, or account system; game state, preferences and statistics live in the browser in a versioned `solitaire.local-state` localStorage record.

**Repository state: Phase 1 scaffolding complete; the Phase 2 card engine (pure domain in `src/domain`) now exists.** The repository has a full Vite + React + TypeScript + Redux Toolkit toolchain: `package.json`, a `src/` tree, `tests/`, GitHub Actions CI/Pages workflows, and husky/lint-staged git hooks all exist. See "Runtime and commands" below for the actual npm scripts — don't assume a script beyond that list exists.

OpenSpec (not GitHub Speckit) is installed and drives phase-by-phase implementation via `openspec/` change proposals; see "Sub-agent driven workflow" below.

## Source of truth

Use these sources in this order:

1. Current source, configuration, tests, and GitHub Actions workflows, once they exist — always prefer what's actually implemented over what's planned.
2. `docs/spec/specification.md` — product behavior and the `KS-*` EARS requirements.
3. `docs/spec/research.md` — game rules, algorithms and UX/accessibility facts (cited as `R§n`); source of truth for game-logic details.
4. `docs/spec/phased-design.md` — tech stack, architecture, data model, and the phase-by-phase build plan with Speckit seed prompts (§7). May be revised by a phase's `/speckit.plan`; if so, record the change here.
5. `docs/spec/mockup/klondike-mockup.html` and `docs/spec/mockup/screens/` — visual/behavioral reference only. Do not port its code structure into production code.

If `specification.md` and `research.md` conflict, fix the documents — don't silently pick one. See `docs/spec/README.md` for the full authority note.

## Repository layout (planned — see phased-design.md §3.1 for full detail)

- `src/domain/` — pure game engine (cards, deal, rules, scoring, hints). No React/Redux/DOM/storage imports.
- `src/solver/` — pure bounded-DFS solver, run in a Web Worker.
- `src/features/` — deal service, game/stats/preferences slices, persistence (codec + storage gateway).
- `src/app/` — Redux store, route/sheet state, theme handling.
- `src/i18n/` — typed English/Ukrainian catalogs.
- `src/pwa/` — service-worker registration, install, update lifecycle.
- `src/ui/` — screens, board, sheets, components, CSS tokens.
- `public/` — manifest, icons.
- `tests/{unit,component,e2e}/` — Vitest/RTL and Playwright coverage.
- `scripts/` — artifact validation.
- `docs/spec/` — this spec pack; treat as historical input once real docs (`docs/index.md`, `architecture.md`, etc., per Phase 10) exist.

Keep domain and solver logic out of React components: UI dispatches typed commands and renders state snapshots (`applyCommand(state, cmd)` is pure); Redux owns application state; persistence goes through a codec + storage gateway.

## Runtime and commands

This repo follows the same base conventions as the sibling project `sanyokkua/minesweeper` (Vite + React + TS + Redux Toolkit + vite-plugin-pwa + Vitest + Playwright + GitHub Pages), with the divergences noted below. The actual npm scripts, from `package.json`:

```sh
rtk npm ci
rtk npm run dev
rtk npm run dev-network
rtk npm run build
rtk npm run preview
rtk npm run format
rtk npm run format:check
rtk npm run lint
rtk npm run lint:fix
rtk npm run typecheck
rtk npm run test
rtk npm run test:unit
rtk npm run test:coverage
rtk npm run e2e
rtk npm run e2e:headed
rtk npm run validate
```

`validate` runs `format:check && lint && typecheck && test:unit && build`. `validate:lifecycle-storage` and `validate:artifact` do not exist yet — they're deferred to Phase 4 and Phase 8 respectively (design decision D6) and are not part of `validate` until then.

Git hooks (husky, installed via the `prepare` script): `.husky/pre-commit` runs `npx lint-staged` (Prettier+ESLint on staged `*.{ts,tsx}`; Prettier on staged `*.{json,css,html,md,yml,yaml}`), then `npm run typecheck`, then `npm run test:unit`. `.husky/pre-push` runs `npm run e2e`.

Prefix commands with `rtk`; use `rtk proxy <cmd>` when the wrapper rejects a required flag. Node floor: `>= 22.22.2`. The build must preserve the `/solitaire/` base path.

Formatting/lint conventions (phased-design.md §1): Prettier — 4-space indent, 120-column width, semicolons, single quotes, trailing commas; TypeScript strict with no-unused checks; ESLint + typescript-eslint + react-hooks.

**Divergence from the sibling project.** This repo's Prettier semicolon rule, git hooks (husky + lint-staged — new; the sibling has none), and ESLint strictness (`strictTypeChecked`/`stylisticTypeChecked`, vs. the sibling's `recommended`) are deliberate departures from `sanyokkua/minesweeper`. "As in Minesweeper" elsewhere in this file and in `phased-design.md` no longer holds literally for those three things.

## Architecture principles (constitution seed — see phased-design.md §2)

1. **Pure domain.** `src/domain/` and `src/solver/` import nothing from React, Redux, the DOM or storage; tested with seeded deals. One narrow exception: `src/domain/prng.ts` may reference `crypto`, because `cryptoSeed` takes an injectable seed source that defaults to `globalThis.crypto` (it throws when none is available and never falls back to `Math.random`); no other domain file may touch `crypto`.
2. **Deterministic by seed.** Every deal comes from a 32-bit seed via mulberry32 + Fisher–Yates. No `Math.random()` in game logic.
3. **UI renders state, issues commands.** Components dispatch typed commands and render snapshots; they never apply rules themselves.
4. **Static and offline.** No runtime network dependency; no third-party asset hosts.
5. **Every input path is equal.** Each move is reachable by tap, drag and keyboard; tests cover all three.
6. **Motion is optional.** Every animation has a no-motion path.
7. **Accessible by default.** Accessible names, live announcements, focus management and 4.5:1 contrast are acceptance criteria, not polish.
8. **Versioned storage.** A single versioned record, decoded defensively; never delete unreadable data silently.
9. **Docs are part of the change.** Update `README.md`/`docs/`/`AGENTS.md` whenever documented behavior changes.
10. **Mockup is visual reference only.** Production code does not copy `docs/spec/mockup/klondike-mockup.html`'s structure.

OpenSpec (not Speckit) is installed; this section is the constitution's canonical home directly — there is no `.specify/memory/constitution.md` copy step.

## Engineering principles

- **Reuse before adding.** Before writing a new widget, function, or component, check whether an existing one in `src/` already does the job or can be extended. Don't duplicate logic or UI that already exists.
- **DRY, YAGNI, KISS.** Don't repeat yourself; don't build for hypothetical future requirements; prefer the simplest design that satisfies the current, real requirement.
- **SOLID.** Each module/component has one clear responsibility; depend on narrow interfaces rather than concrete details where that adds real value — don't over-abstract for its own sake.
- **Small, scoped components — no god objects.** Split by responsibility along the layer boundaries in "Repository layout" above; a component, slice, or module doing too much should be broken up rather than grown.
- **Structure and design matter.** New code goes in the layer it belongs to (domain vs. features vs. ui vs. solver), not wherever is convenient; keep the intended architecture (see "Architecture principles" above) intact as the codebase grows.
- **Test coverage.** New logic ships with tests at the appropriate layer — unit for `domain`/`solver`, component for UI, Playwright for end-to-end flows (see `docs/spec/phased-design.md` §5).
- **Documentation stays fresh.** Code comments, README, `docs/`, and this file must reflect current behavior — see "Documentation maintenance" below.

## Sub-agent driven workflow

Non-trivial work here is decomposed into focused, single-purpose passes rather than done end-to-end in one broadly-scoped session: separate passes for research/analysis, planning, implementation, test-writing, verification, and review. Each pass is given only the context it needs for its one job, and no more. A pass that writes code and then judges its own correctness is a biased reviewer of its own work; a pass loaded with unrelated context makes worse decisions than one scoped tightly to its task.

Apply this whenever the work is non-trivial:

- Research/analysis before planning, so the plan is grounded in what's actually there.
- Planning before implementation, with the plan reviewed before code starts.
- Implementation and test-writing as focused, test-first passes.
- A dedicated verification pass that actually runs the stated checks (build/lint/typecheck/tests) rather than assuming they pass.
- A dedicated review pass, separate from the implementer, checking the diff against the task's stated requirements and this file's Architecture and Engineering principles above.

This repo's OpenSpec change loop (`openspec-apply-change` / `/opsx:apply`) is always run restricted to one task at a time, driven from a planning session. For each task: a scoped read of that task's own stated requirements and files, then test-first implementation, then verification, then review — only after that does the task's checkbox move from `- [ ]` to `- [x]` in `tasks.md`. If a task turns out to need work beyond what it states, stop and surface the added scope rather than silently narrowing, deferring, or absorbing it.

Once a task's checkbox moves to `- [x]`, commit its changes (including the `tasks.md` edit) before starting the next task, so every implemented task lands as its own commit — see "Git and review" below.

Concrete tooling varies by agent. `openspec/config.yaml`'s `operations.apply` and `operations.archive` guidance names the specific skills to invoke at each moment for whichever agent is running them (e.g. Claude Code's installed "superpowers" skill set) — consult it, and use your environment's equivalent tooling if a named skill isn't available.

### Task sizing and context budget

Planning happens in sessions with a practical context budget (roughly 128k tokens) that can't always be cleared before implementation starts. Tasks are therefore kept small and single-layer/single-module wherever possible, so a task's full working set — the files it touches plus the docs and existing tests it references — fits comfortably in that budget. This is enforced at task-generation time by `openspec/config.yaml`'s `rules.tasks`; this section describes how the resulting tasks get executed, not how they get sized.

## GitHub Actions

- When you need to create/update the CI pipeline - always check via web-search the latest versions of the GitHub Actions to keep CI up-to-date.

## Documentation maintenance

Documentation is part of the change. Whenever a change alters a documented fact — behavior, scripts, configuration, CI, deployment, dependencies, storage shape, source layout, or user-facing controls — update the affected README/docs/AGENTS.md in the same change. Don't leave a document describing former behavior.

## Git and review

Use concise Conventional Commit subjects. Don't commit generated `dist`, coverage, or Playwright report output once they exist.

Don't commit or push unless explicitly requested — with one standing exception: while implementing an OpenSpec change task-by-task (see "Sub-agent driven workflow" above), commit after each task's checkbox moves to `- [x]`, without needing to ask each time. That exception covers committing only; pushing still requires an explicit request every time.

No work should happen on the master branch. You need to create feature branches if current branch is master.

Till the App will be implemented and fully working, branch - "feature/app-v1-implementation" is the main integration branch.

For each change should be created separate branch from "feature/app-v1-implementation", using the pattern "feature/change-short-name".

Till the change is archived - all the work happens in the "feature/change-short-name".
When change is archived - "feature/change-short-name" is squash-merged back to the "feature/app-v1-implementation".
