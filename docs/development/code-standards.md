# Code standards

## Formatting, linting, types

- **Prettier** (`.prettierrc.json`): 4-space indent, 120 columns, semicolons, single quotes, trailing commas everywhere.
  `.prettierignore` excludes `docs/`, so Markdown under `docs/` is not auto-formatted.
- **ESLint** (`eslint.config.js`): `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, `react-hooks`,
  `react-refresh`. `no-explicit-any` and `consistent-type-imports` are errors. Layer rules below are also ESLint rules.
- **TypeScript** (`tsconfig.app.json`): `strict`, `noUnusedLocals`/`noUnusedParameters`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (use `import type` for types), `noEmit`.

## Architecture principles

The authoritative list is in `AGENTS.md`. Summary and what enforces each:

| Principle                                              | Enforced by                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Pure domain and solver (no React, Redux, DOM, storage) | ESLint import restrictions; `tests/unit/repo/domainPurity.test.ts`, `solverPurity.test.ts` |
| Deterministic by seed (mulberry32, no `Math.random`)   | Purity tests ban `Math.random`; `src/domain/prng.ts`                   |
| UI renders state and dispatches commands               | Convention; `applyCommand` lives in domain; ESLint bans route/sheet actions in UI |
| Static and offline, no third-party hosts               | `scripts/validate-artifact.mjs` (no cross-origin URLs)                 |
| Every move reachable by tap, drag and keyboard         | E2E `playByTap`, `playByDrag`, `playByKeyboard` win tests              |
| Motion is optional                                     | Single no-motion path (`data-motion='off'`); `motion.spec.ts`          |
| Accessible by default                                  | `a11y.spec.ts` (axe), `contrast.test.ts`, announcer and focus tests    |
| Versioned, defensively decoded storage                 | `storageBoundary.test.ts`, codec tests                                 |
| Docs are part of the change                            | Review; see [workflow](workflow.md#documentation-is-part-of-the-change) |
| Mockup is visual reference only                        | Convention                                                             |

## Layer boundaries

| Layer          | May import                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `src/domain`   | Only its own sibling files. One exception: `prng.ts` may use `crypto` (injectable seed source).        |
| `src/solver`   | Its siblings and `../domain/<file>`. No `crypto`; `self` only in `solver.worker.ts`.                   |
| `src/features` | Domain, other features, i18n types. Value imports from `solver/` are banned (type imports fine): the solver runs in a Web Worker reached by URL. |
| `src/i18n`     | Only itself. `useTranslate.ts` is the only file allowed to import React or react-redux.                |
| `src/pwa`      | Nothing from `app`, `features` or `ui`. Only `registerPwa.ts` imports `virtual:pwa-register`; only `main.tsx` imports `registerPwa`. |
| `src/ui`       | Anything above except: `setRoute`, `sheetOpened`, `sheetClosed` from `app/appSlice` are banned; dispatch the intents in `features/game/navigationThunks.ts` instead. |
| Pure board modules (`src/ui/board/{metrics,layout,names,locate,landing,pointerController,keyboardController,cascadeFrames}.ts`) | Siblings, `../../domain/<file>`, type-only `i18n/translate`. No React, DOM globals, storage, `crypto`, `Math.random` (`boardPurity.test.ts`). |
| Browser storage | Only `src/features/persistence/storageGateway.ts` may name `localStorage` (`storageBoundary.test.ts`). |

`tests/unit/repo/layerBoundaries.test.ts` and `eslintRules.test.ts` guard these rules themselves, so loosening a rule fails a test.

## Engineering principles

- Reuse before adding: search `src/` for an existing function, component or type first.
- DRY, YAGNI, KISS. No speculative abstractions, wrappers or compatibility paths without a real requirement.
- One responsibility per module. Put code in the layer it belongs to, not where it is convenient.
- New logic ships with tests at its layer (see [testing](testing.md)). Do not weaken tests to make code pass.
- Comments explain non-obvious intent, not what the code says. Keep code comments and docs current.
- No placeholders or TODO implementations.

## Conventions seen in the code

- Redux slices hold state; side effects live in thunks that receive injected dependencies (`src/app/thunkExtra.ts`: deal service, clock, delay, storage gateway, PWA port). Tests inject fakes instead of stubbing globals.
- Domain functions are pure and never throw on bad input; refusals return the same state object plus a `rejected` event.
- Runtime-only state (selection, hint, announcements, busy flags) is never persisted.
- User-visible strings come from typed catalogs in `src/i18n/locales/`; a missing key in a locale fails the typecheck.
- Colours, spacing and sizes come from CSS tokens (`src/ui/styles/tokens.css`), not literals in components.
