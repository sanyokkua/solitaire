# Documentation

Documentation for Klondike Solitaire. Start with the [README](../README.md) for what the project is and how to run it.

## Reading order

1. [Getting started](development/getting-started.md): install, run, build, check.
2. [Architecture overview](architecture/overview.md): layers and dependency rules.
3. [Project structure](development/project-structure.md): where things live and where to change what.
4. [Workflow](development/workflow.md): OpenSpec, branches, commits, hooks.

## Architecture

| Page                                                           | Contents                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| [overview](architecture/overview.md)                           | Layers, principles, runtime shape                                   |
| [domain-and-solver](architecture/domain-and-solver.md)         | Engine, commands, deals, scoring, hints, solver, worker protocol    |
| [state-and-persistence](architecture/state-and-persistence.md) | Store, thunks, lifecycle, timer, persistence                        |
| [ui](architecture/ui.md)                                       | Board, input, screens, sheets, themes, motion                       |
| [i18n-and-pwa](architecture/i18n-and-pwa.md)                   | Localisation, service worker, update and install                    |
| [data-flows](architecture/data-flows.md)                       | Sequence diagrams for the main runtime paths                        |

## Development

| Page                                                       | Contents                                          |
| ---------------------------------------------------------- | ------------------------------------------------- |
| [getting-started](development/getting-started.md)         | Prerequisites and commands                        |
| [project-structure](development/project-structure.md)     | Directory guide and "where do I change...?"       |
| [workflow](development/workflow.md)                        | OpenSpec workflow, branching, commits, hooks      |
| [code-standards](development/code-standards.md)            | Formatting, lint, types, layer rules, principles  |
| [testing](development/testing.md)                          | Test layers, guards, Playwright projects          |
| [ci-and-deployment](development/ci-and-deployment.md)      | Workflows, validation, GitHub Pages               |

## Reference

| Page                                                        | Contents                                  |
| ----------------------------------------------------------- | ----------------------------------------- |
| [scripts](reference/scripts.md)                             | All npm scripts                           |
| [keyboard-and-controls](reference/keyboard-and-controls.md) | Shortcuts and input behaviour             |
| [game-rules](reference/game-rules.md)                       | Implemented rules, modes, scoring         |
| [storage-format](reference/storage-format.md)               | The `solitaire.local-state` record        |

## Module READMEs

Deep, per-module references kept next to the code: [domain](../src/domain/README.md), [solver](../src/solver/README.md),
[features](../src/features/README.md), [i18n](../src/i18n/README.md), [pwa](../src/pwa/README.md),
[ui](../src/ui/README.md), [tests](../tests/README.md).

## Specification pack and OpenSpec

- [`docs/spec/`](spec/README.md): the original product specification, game-rules research, phased design and visual mockup.
  It is historical input and is not edited by ordinary changes.
- [`openspec/`](../openspec/): current per-capability specs and the change history. New work is introduced here; see
  [workflow](development/workflow.md).
- [`AGENTS.md`](../AGENTS.md): conventions for AI coding agents.
