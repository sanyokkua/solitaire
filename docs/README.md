# Documentation

Documentation for Klondike Solitaire. Start with the [README](../README.md) for what the project is and how to run it.

## Reading order

1. [Getting started](development/getting-started.md): install, run, build, check.
2. [Architecture overview](architecture/overview.md): layers and dependency rules.
3. [Project structure](development/project-structure.md): where things live and where to change what.
4. [Workflow](development/workflow.md): OpenSpec, branches, commits, hooks.
5. [Code standards](development/code-standards.md) and [testing](development/testing.md): what a change must satisfy.

## Source of truth

When sources disagree, prefer them in this order (the same order as in [`AGENTS.md`](../AGENTS.md)):

1. The code, the configuration, the tests and the GitHub Actions workflows: what is actually implemented.
2. [`openspec/specs/`](../openspec/specs/): the product behaviour per capability, with the `KS-*` requirement ids that
   [traceability](reference/traceability.md) maps to the tests and manual checks that prove them.
3. This documentation.
4. The committed reference screenshots in [`docs/assets/screenshots/`](assets/screenshots/): the look and feel is fixed,
   and a visual change is deliberate and reviewed against them.

If a spec and a page conflict, fix whichever is wrong.

## Architecture

| Page                                                           | Contents                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| [overview](architecture/overview.md)                           | Layers, principles, runtime shape                                |
| [domain-and-solver](architecture/domain-and-solver.md)         | Engine, commands, deals, scoring, hints, solver, worker protocol |
| [state-and-persistence](architecture/state-and-persistence.md) | Store, thunks, lifecycle, timer, persistence                     |
| [ui](architecture/ui.md)                                       | Board, input, screens, sheets, themes, motion                    |
| [i18n-and-pwa](architecture/i18n-and-pwa.md)                   | Localisation, service worker, update and install                 |
| [data-flows](architecture/data-flows.md)                       | Sequence diagrams for the main runtime paths                     |

## Development

| Page                                                  | Contents                                              |
| ----------------------------------------------------- | ----------------------------------------------------- |
| [getting-started](development/getting-started.md)     | Prerequisites and commands                            |
| [project-structure](development/project-structure.md) | Directory guide and "where do I change...?"           |
| [workflow](development/workflow.md)                   | OpenSpec workflow, branching, commits, hooks          |
| [code-standards](development/code-standards.md)       | Formatting, lint, types, layer rules, principles      |
| [testing](development/testing.md)                     | Test layers, guards, Playwright projects, docs checks |
| [ci-and-deployment](development/ci-and-deployment.md) | Workflows, validation, GitHub Pages                   |
| [release](development/release.md)                     | Release procedure: version, changelog, merge, tag     |
| [CHANGELOG](../CHANGELOG.md)                          | What each release contains                            |

## Reference

| Page                                                        | Contents                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| [scripts](reference/scripts.md)                             | All npm scripts                                                  |
| [keyboard-and-controls](reference/keyboard-and-controls.md) | Shortcuts and input behaviour                                    |
| [game-rules](reference/game-rules.md)                       | Implemented rules, modes, scoring                                |
| [storage-format](reference/storage-format.md)               | The `solitaire.local-state` record                               |
| [winnability](reference/winnability.md)                     | Winnable and graded deals, the solver, the deal pool             |
| [device-matrix](reference/device-matrix.md)                 | The 13 screens the table layout must fit, and how fit is checked |
| [traceability](reference/traceability.md)                   | KS ids against requirements, tests and manual checks (generated) |
| [manual-checks](reference/manual-checks.md)                 | Checks made by hand on real devices, with results                |

## Screenshots

[`docs/assets/screenshots/`](assets/screenshots/) holds the eight reference screenshots the [README](../README.md) shows:
Home and the Game screen, in the light and the dark theme, on a desktop and a phone. They are regenerated with
`npm run screenshots` (see [testing](development/testing.md#reference-screenshots)).

## Module READMEs

Deep, per-module references kept next to the code: [domain](../src/domain/README.md), [solver](../src/solver/README.md),
[features](../src/features/README.md), [i18n](../src/i18n/README.md), [pwa](../src/pwa/README.md),
[ui](../src/ui/README.md), [fonts](../src/assets/fonts/README.md), [tests](../tests/README.md).

## OpenSpec and agents

- [`openspec/`](../openspec/): current per-capability specs and the change history. New work is introduced here; see
  [workflow](development/workflow.md).
- [`AGENTS.md`](../AGENTS.md): conventions for AI coding agents.
