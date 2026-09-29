# Klondike Solitaire

Klondike Solitaire as a static, offline-capable single-page app and installable PWA. It is built with
Vite, React, TypeScript and Redux Toolkit. There is no backend, API or account system: game state,
preferences and statistics are kept in the browser's `localStorage` (record `solitaire.local-state`).
The build is served under the `/solitaire/` base path (GitHub Pages).

Source: <https://github.com/sanyokkua/solitaire>

## Game

- Modes: Draw 1, Draw 3, Vegas and a Daily deal. Draw 1, Draw 3 and Vegas can be limited to deals the solver found winnable, at a chosen difficulty.
- Play by tap, drag or keyboard. Undo, redo, hint, finish and pause are available.
- Deals are deterministic from a seed and can be shared as a deal code.
- Light, dark and system themes, a four-colour deck, night cards and four card backs; reduced-motion aware.
- English and Ukrainian interface.
- Works offline after the first visit and can be installed from the browser.

## Requirements

- Node.js 22.22.2 or newer
- npm (uses the committed `package-lock.json`)

## Run locally

```sh
npm ci
npm run dev
```

Open <http://localhost:5173/solitaire/>.

## Build

```sh
npm run build      # type-check, then build into dist/
npm run preview    # serve the production build
```

## Check

```sh
npm run validate   # format, lint, typecheck, unit/component tests, build, artifact check
npx playwright install --with-deps chromium firefox webkit   # once, for the browser suite
npm run e2e        # Playwright end-to-end suite
```

All scripts are listed in [docs/reference/scripts.md](docs/reference/scripts.md).

## Documentation

| Document                                                                       | Contents                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| [docs/README.md](docs/README.md)                                               | Index and reading order                              |
| [docs/architecture/overview.md](docs/architecture/overview.md)                 | Layers, dependency rules, how the pieces fit         |
| [docs/development/project-structure.md](docs/development/project-structure.md) | Where things live and how to navigate the repository |
| [docs/development/workflow.md](docs/development/workflow.md)                   | OpenSpec workflow, branches, commits, hooks          |
| [docs/development/testing.md](docs/development/testing.md)                     | Test layers, guards and how to run them              |
| [docs/spec/](docs/spec/README.md)                                              | Original product specification pack                  |
| [AGENTS.md](AGENTS.md)                                                         | Conventions for AI coding agents                     |

## Contributing

Features and behaviour changes are introduced through [OpenSpec](openspec/): a change is proposed,
implemented task by task, then archived into `openspec/specs/`. See
[docs/development/workflow.md](docs/development/workflow.md). Documentation is updated in the same change.

## License

[MIT](LICENSE). The bundled Inter and Press Start 2P fonts are under the SIL Open Font License 1.1;
sources are in [src/assets/fonts/README.md](src/assets/fonts/README.md).
