# Project structure

## Top level

| Path                                                                                               | Purpose                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`                                                                                             | Application code, split into layers (below).                                                                                                                                                    |
| `tests/`                                                                                           | `unit/`, `component/` (Vitest), `e2e/` (Playwright), `bench/` (informational benchmarks), plus shared `fixtures/`, `support/` and `setup.ts`.                                                   |
| `public/`                                                                                          | Static PWA files: `manifest.webmanifest`, `favicon.svg`, `icons/`.                                                                                                                              |
| `scripts/`                                                                                         | Repository scripts: `validate-artifact.mjs`, `validate-lifecycle-storage.mjs`, `trace-requirements.mjs` (the traceability matrix), `generate-icons.mjs` and `build-info.mjs` (the build stamp). |
| `docs/`                                                                                            | This documentation (`architecture/`, `development/`, `reference/`), and `assets/screenshots/`, the committed reference screenshots.                                                             |
| `openspec/`                                                                                        | OpenSpec: `specs/` (current capability specs), `changes/` (active and `archive/`), `config.yaml`.                                                                                               |
| `.github/workflows/`                                                                               | `ci.yml` and `pages.yml`.                                                                                                                                                                       |
| `.husky/`                                                                                          | Git hooks.                                                                                                                                                                                      |
| `.claude/`, `.agents/`                                                                             | Agent configuration: OpenSpec skills (both) and `/opsx:*` commands (`.claude/commands/opsx/`). Do not delete.                                                                                   |
| `AGENTS.md`, `README.md`                                                                           | Conventions for AI agents (also the canonical statement of the architecture principles); the project overview.                                                                                  |
| `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `tsconfig*.json` | Tool configuration.                                                                                                                                                                             |

Generated and ignored: `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `node_modules/`.

## `src/` layers

| Directory       | Responsibility                                                                                          | Deep reference                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/domain/`   | Pure Klondike engine: cards, seeded deals, rules, scoring, hints, commands                              | [README](../../src/domain/README.md)                              |
| `src/solver/`   | Pure bounded-DFS solver and its Web Worker protocol                                                     | [README](../../src/solver/README.md)                              |
| `src/features/` | Deal service, game/session state and thunks, stats, preferences, persistence, interaction state         | [README](../../src/features/README.md)                            |
| `src/app/`      | Redux store, app slice, thunk dependencies, lifecycle bootstrap, theme controller, deal pool controller | [state and persistence](../architecture/state-and-persistence.md) |
| `src/i18n/`     | Typed English/Ukrainian catalogs, registry, translator, `useTranslate`                                  | [README](../../src/i18n/README.md)                                |
| `src/pwa/`      | Service-worker registration, update and install gateways                                                | [README](../../src/pwa/README.md)                                 |
| `src/ui/`       | Board, cards, motion, input, Game frame, Home screen, sheets, CSS tokens                                | [README](../../src/ui/README.md)                                  |
| `src/assets/`   | Bundled fonts (with licences)                                                                           | [README](../../src/assets/fonts/README.md)                        |

Entry points: `index.html` -> `src/main.tsx` (starts `startApp` from `src/app/lifecycle.tsx`, registers the PWA) ->
`src/App.tsx` (Home or Game screen, sheet host).

## Where do I change...?

| I want to...                                          | Look in                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Change a game rule, scoring or hint                   | `src/domain/` (`rules.ts`, `engine.ts`, `scoring.ts`, `hint.ts`) + domain tests                                      |
| Change how winnable deals are found or served         | `src/solver/`; `src/features/deal/` (`dealService.ts`, `dealPool.ts`, `budgets.ts`), `src/app/dealPoolController.ts` |
| Add a command or state field                          | `src/domain/types.ts`, `engine.ts`; then `src/features/game/`; persistence codec if stored                           |
| Change what is saved                                  | `src/features/persistence/` (bump `RECORD_VERSION` for incompatible shapes)                                          |
| Add a preference                                      | `src/features/preferences/preferencesSlice.ts`, codec, Settings sheet, catalogs                                      |
| Change board layout or card geometry                  | `src/ui/board/metrics.ts`, `layout.ts`, `src/ui/styles/`                                                             |
| Change input behaviour (drag, tap, keyboard)          | `src/ui/board/pointerController.ts`, `useBoardActions.ts`, `keyboardController.ts`, `useGameShortcuts.ts`            |
| Add or edit a sheet                                   | `src/ui/sheets/` (register in `SheetHost.tsx`, id in `src/app/appSlice.ts`)                                          |
| Change user-visible text or add a language            | `src/i18n/locales/`, `src/i18n/catalog.ts`                                                                           |
| Change offline or update behaviour                    | `src/pwa/`, `vite.config.ts`, `public/manifest.webmanifest`                                                          |
| Change CI or deployment                               | `.github/workflows/`, `scripts/validate-artifact.mjs`                                                                |
| Change the look and refresh the reference screenshots | `src/ui/styles/`, then `npm run screenshots` (see [testing](testing.md#reference-screenshots))                       |
| Add or change a test                                  | `tests/` (see [testing](testing.md)); cite the KS ids it proves with `// covers:` and run `npm run trace`            |

Layer import rules that constrain these changes are in [code standards](code-standards.md#layer-boundaries).
