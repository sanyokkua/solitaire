# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, etc.) working in this repository.

## Current project

This repository will become **Klondike Solitaire**, a calm, retro-styled, offline-capable static SPA/PWA (Vite + React + TypeScript + Redux Toolkit), deployed to GitHub Pages under `/solitaire/`. There is no backend, API, database, or account system; game state, preferences and statistics live in the browser in a versioned `solitaire.local-state` localStorage record.

**Repository state: pre-implementation.** As of now the repository contains only `docs/spec/` (the full product spec, game-rules research, and phased build plan) plus `LICENSE` and this file. No `package.json`, source tree, or tooling exists yet — that is Phase 1 of the plan below. Do not assume any npm script, source file, or test exists until you have checked.

GitHub Speckit (or OpenSpec) will be installed into this repo later to drive phase-by-phase implementation; it is not set up yet.

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

**Not yet scaffolded.** Once Phase 1 lands, this repo follows the same conventions as the sibling project `sanyokkua/minesweeper` (Vite + React + TS + Redux Toolkit + vite-plugin-pwa + Vitest + Playwright + GitHub Pages). Expect npm scripts equivalent to:

```sh
rtk npm ci
rtk npm run dev
rtk npm run format:check
rtk npm run lint
rtk npm run typecheck
rtk npm run validate:lifecycle-storage
rtk npm run test:unit
rtk npm run test:coverage
rtk npm run build
rtk npm run validate:artifact
rtk npm run e2e
rtk npm run validate
```

Prefix commands with `rtk`; use `rtk proxy <cmd>` when the wrapper rejects a required flag. Node floor: `>= 22.22.2`. The build must preserve the `/solitaire/` base path.

Formatting/lint conventions (phased-design.md §1): Prettier — 4-space indent, 120-column width, no semicolons, single quotes, trailing commas; TypeScript strict with no-unused checks; ESLint + typescript-eslint + react-hooks.

## Architecture principles (constitution seed — see phased-design.md §2)

1. **Pure domain.** `src/domain/` and `src/solver/` import nothing from React, Redux, the DOM or storage; tested with seeded deals.
2. **Deterministic by seed.** Every deal comes from a 32-bit seed via mulberry32 + Fisher–Yates. No `Math.random()` in game logic.
3. **UI renders state, issues commands.** Components dispatch typed commands and render snapshots; they never apply rules themselves.
4. **Static and offline.** No runtime network dependency; no third-party asset hosts.
5. **Every input path is equal.** Each move is reachable by tap, drag and keyboard; tests cover all three.
6. **Motion is optional.** Every animation has a no-motion path.
7. **Accessible by default.** Accessible names, live announcements, focus management and 4.5:1 contrast are acceptance criteria, not polish.
8. **Versioned storage.** A single versioned record, decoded defensively; never delete unreadable data silently.
9. **Docs are part of the change.** Update `README.md`/`docs/`/`AGENTS.md` whenever documented behavior changes.
10. **Mockup is visual reference only.** Production code does not copy `docs/spec/mockup/klondike-mockup.html`'s structure.

When Speckit is installed, copy this section into `.specify/memory/constitution.md` per `docs/spec/README.md`'s Phase 0 instructions; keep both in sync.

## Engineering principles

- **Reuse before adding.** Before writing a new widget, function, or component, check whether an existing one in `src/` already does the job or can be extended. Don't duplicate logic or UI that already exists.
- **DRY, YAGNI, KISS.** Don't repeat yourself; don't build for hypothetical future requirements; prefer the simplest design that satisfies the current, real requirement.
- **SOLID.** Each module/component has one clear responsibility; depend on narrow interfaces rather than concrete details where that adds real value — don't over-abstract for its own sake.
- **Small, scoped components — no god objects.** Split by responsibility along the layer boundaries in "Repository layout" above; a component, slice, or module doing too much should be broken up rather than grown.
- **Structure and design matter.** New code goes in the layer it belongs to (domain vs. features vs. ui vs. solver), not wherever is convenient; keep the intended architecture (see "Architecture principles" above) intact as the codebase grows.
- **Test coverage.** New logic ships with tests at the appropriate layer — unit for `domain`/`solver`, component for UI, Playwright for end-to-end flows (see `docs/spec/phased-design.md` §5).
- **Documentation stays fresh.** Code comments, README, `docs/`, and this file must reflect current behavior — see "Documentation maintenance" below.

## GitHub Actions

- When you need to create/update the CI pipeline - always check via web-search the latest versions of the GitHub Actions to keep CI up-to-date.

## Documentation maintenance

Documentation is part of the change. Whenever a change alters a documented fact — behavior, scripts, configuration, CI, deployment, dependencies, storage shape, source layout, or user-facing controls — update the affected README/docs/AGENTS.md in the same change. Don't leave a document describing former behavior.

## Git and review

Use concise Conventional Commit subjects. Don't commit generated `dist`, coverage, or Playwright report output once they exist. Don't commit or push unless explicitly requested.

No work should happen on the master branch. You need to create feature branches if current branch is master.
