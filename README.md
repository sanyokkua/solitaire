# Klondike Solitaire

Klondike Solitaire is a calm, retro-styled, offline-capable static SPA and installable PWA. It
runs entirely in the browser, stores all game state, preferences and statistics in a versioned
`solitaire.local-state` browser `localStorage` record, and is built for GitHub Pages under the
`/solitaire/` repository path.

The repository does not contain a backend, API, account system, database, or runtime server
dependency.

Source repository: <https://github.com/sanyokkua/solitaire>

## Current status

**Phases 1–4 are complete.** The build, lint, test, CI and deployment tooling are in place.
The pure Klondike engine lives in `src/domain/`, the bounded-DFS solver in `src/solver/`,
and the deal service (deals per mode, Daily v1, solver hints) in `src/features/deal/`. The
application state layer (`app`, `preferences`, `stats`, `game` and `persistence` slices, with
thunks for start, play, undo/redo, restart and finish) plays, scores and times a game. Preferences,
statistics and an unfinished game are saved in the versioned `solitaire.local-state` record and
restored on reload. The Home and Game shell is wired to it: Home "Deal cards" starts a game,
"Continue game" appears while one can be resumed, and Back keeps it. There is still no board, so
the game cannot yet be played on screen.
Phases 5–11 (table rendering and motion, interaction and assistance UI, screens and
localisation, PWA hardening, verification, documentation and release, and the optional Draw 3
winnable deals) are pending — see `docs/spec/phased-design.md` for the full phase list. There is
no deployed build yet.

## Prerequisites

- Node.js 22.22.2 or newer.
- npm, using the committed `package-lock.json`.
- Playwright browser binaries for the full browser suite. Install them with
  `npx playwright install --with-deps chromium firefox webkit` when needed.

## Local development

```sh
npm ci
npm run dev
```

Open `http://localhost:5173/solitaire/`. The Vite base path is part of the application
configuration, so local testing should use the `/solitaire/` path.

To serve the production build locally:

```sh
npm run build
npm run preview
```

## Quality commands

| Command                              | Purpose                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Start the Vite development server.                                                                 |
| `npm run dev-network`                | Start the Vite development server bound to all network interfaces.                                 |
| `npm run build`                      | Type-check the project, then produce the production build in `dist/`.                              |
| `npm run preview`                    | Serve the production build locally.                                                                |
| `npm run format`                     | Format repository files with Prettier.                                                             |
| `npm run format:check`               | Check Prettier formatting without writing files.                                                   |
| `npm run lint`                       | Run ESLint.                                                                                        |
| `npm run lint:fix`                   | Run ESLint and apply automatic fixes.                                                              |
| `npm run typecheck`                  | Run the non-emitting TypeScript project build.                                                     |
| `npm run test`                       | Run the Vitest unit and component test set.                                                        |
| `npm run test:unit`                  | Run unit and component tests.                                                                      |
| `npm run test:coverage`              | Run unit/component tests with V8 coverage thresholds.                                              |
| `npm run bench`                      | Run the informational winnable-search latency benchmark.                                           |
| `npm run e2e`                        | Run the Playwright suite across desktop and touch projects.                                        |
| `npm run e2e:headed`                 | Run the Playwright suite with visible browsers.                                                    |
| `npm run prepare`                    | Install the Husky git hooks (runs automatically after `npm install`).                              |
| `npm run validate:lifecycle-storage` | Check that the application lifecycle tests inject their storage gateway.                           |
| `npm run validate`                   | Run formatting, lint, typecheck, the lifecycle-storage guard, unit/component tests, and the build. |

`bench` reports median and p95 for the winnable-deal search against KS-PERF-02; it never asserts
on timings and is not part of `validate`, the git hooks or CI.

The usual local gate is:

```sh
npm run validate
npm run e2e
```

This mirrors the repository's git hooks: `.husky/pre-commit` runs lint-staged, `typecheck` and
`test:unit` on every commit, and `.husky/pre-push` runs the full `e2e` suite before every push.

## Repository layout

```text
src/app/          Redux store, application state slices, lifecycle bootstrap
src/ui/           Screens, reusable components, and token-based CSS (layout and interaction planned)
src/assets/       Bundled fonts and other static assets
src/domain/       Pure Klondike engine: cards, seeded deals, rules, scoring, commands, hints
src/solver/       Pure bounded-DFS solver and its Web Worker message protocol
src/features/     Deal service (Phase 3), game state thunks and history, statistics, preferences,
                  persistence (codec, storage gateway, loader, writer, reset)
src/i18n/         Reserved for the English/Ukrainian catalogs (Phase 7) — directory + README only today
src/pwa/          Reserved for the service-worker lifecycle (Phase 8) — directory + README only today
tests/unit/       Vitest unit tests
tests/component/  Vitest + Testing Library component tests
tests/e2e/        Playwright end-to-end specs
tests/bench/      Informational winnable-search latency benchmark
tests/fixtures/   Shared seeded deals, storage doubles, and test utilities
docs/spec/        Product specification, game-rules research, and the phased build plan
openspec/         OpenSpec change proposals, specs and tasks
```

## Documentation

- [`docs/spec/specification.md`](docs/spec/specification.md) — product behavior and the
  `KS-*` requirements.
- [`docs/spec/research.md`](docs/spec/research.md) — game rules, algorithms and
  accessibility/UX facts.
- [`docs/spec/phased-design.md`](docs/spec/phased-design.md) — architecture, data model, and
  the phase-by-phase build plan.
- [`docs/spec/mockup/klondike-mockup.html`](docs/spec/mockup/klondike-mockup.html) and
  [`docs/spec/mockup/screens/`](docs/spec/mockup/screens/) — visual and behavioral reference
  for the finished app. This is reference only: it shows gameplay the app does not implement
  yet, and production code does not copy its structure.
- [`AGENTS.md`](AGENTS.md) — guidance and conventions for AI coding agents working in this
  repository.

## Changes

New behavior is planned through the repository's OpenSpec workflow under
[`openspec/`](openspec/). Changes to behavior, dependencies, configuration, CI, deployment, or
documented interfaces must update the affected documentation in the same change.

## License

The application is licensed under the [MIT License](LICENSE). The bundled Inter and Press
Start 2P fonts are licensed under the SIL Open Font License 1.1; their sources are listed in
[`src/assets/fonts/README.md`](src/assets/fonts/README.md).
