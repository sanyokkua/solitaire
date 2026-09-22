# Klondike Solitaire

Klondike Solitaire is a calm, retro-styled, offline-capable static SPA and installable PWA. It
runs entirely in the browser, stores all game state, preferences and statistics in a versioned
`solitaire.local-state` browser `localStorage` record, and is built for GitHub Pages under the
`/solitaire/` repository path.

The repository does not contain a backend, API, account system, database, or runtime server
dependency.

Source repository: <https://github.com/sanyokkua/solitaire>

## Current status

**Phase 1 (repository foundation) is complete.** The build, lint, test, CI and deployment
tooling are in place, and the app has a routed Home/Game shell with no game logic yet.
Phases 2–11 (card engine, board, solver, state/persistence, animation, screens/localisation,
PWA hardening, and the rest of the phased build plan) are pending — see
`docs/spec/phased-design.md` for the full phase list. There is no deployed build yet.

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

| Command                 | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `npm run dev`           | Start the Vite development server.                                    |
| `npm run dev-network`   | Start the Vite development server bound to all network interfaces.    |
| `npm run build`         | Type-check the project, then produce the production build in `dist/`. |
| `npm run preview`       | Serve the production build locally.                                   |
| `npm run format`        | Format repository files with Prettier.                                |
| `npm run format:check`  | Check Prettier formatting without writing files.                      |
| `npm run lint`          | Run ESLint.                                                           |
| `npm run lint:fix`      | Run ESLint and apply automatic fixes.                                 |
| `npm run typecheck`     | Run the non-emitting TypeScript project build.                        |
| `npm run test`          | Run the Vitest unit and component test set.                           |
| `npm run test:unit`     | Run unit and component tests.                                         |
| `npm run test:coverage` | Run unit/component tests with V8 coverage thresholds.                 |
| `npm run e2e`           | Run the Playwright suite across desktop and touch projects.           |
| `npm run e2e:headed`    | Run the Playwright suite with visible browsers.                       |
| `npm run prepare`       | Install the Husky git hooks (runs automatically after `npm install`). |
| `npm run validate`      | Run formatting, lint, typecheck, unit/component tests, and the build. |

The usual local gate is:

```sh
npm run validate
npm run e2e
```

This mirrors the repository's git hooks: `.husky/pre-commit` runs lint-staged, `typecheck` and
`test:unit` on every commit, and `.husky/pre-push` runs the full `e2e` suite before every push.

## Repository layout

```text
src/app/          Redux store and the application route slice
src/ui/           Screens, reusable components, and token-based CSS
src/assets/       Bundled fonts and other static assets
src/domain/       Reserved for the pure game engine (Phase 2) — directory + README only today
src/solver/       Reserved for the bounded-DFS solver (Phase 3) — directory + README only today
src/features/     Reserved for the deal service and slices (Phases 3–4) — directory + README only today
src/i18n/         Reserved for the English/Ukrainian catalogs (Phase 7) — directory + README only today
src/pwa/          Reserved for the service-worker lifecycle (Phase 8) — directory + README only today
tests/unit/       Vitest unit tests
tests/component/  Vitest + Testing Library component tests
tests/e2e/        Playwright end-to-end specs
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
