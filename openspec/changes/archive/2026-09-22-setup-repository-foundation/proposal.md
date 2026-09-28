# Proposal

## Why

The repository is pre-implementation: it contains `docs/spec/`, `AGENTS.md`, `LICENSE` and an empty
`openspec/`, but no `package.json`, no `src/`, no tests and no CI. Nothing from Phases 2–11 of
`docs/spec/phased-design.md` §7 can start until there is a project that installs, builds, formats,
lints, type-checks, tests and deploys. Phase 1 exists to create exactly that: an empty but
production-shaped application whose quality gates are real and enforced from the first commit, so
every later change lands inside a working harness instead of building one as it goes.

## What Changes

**Build spine**

- An npm project pinned to Node `>= 22.22.2`: Vite 8 + `@vitejs/plugin-react` + React 19 +
  TypeScript 5.9 + Redux Toolkit 2, with `base: '/solitaire/'` and a `__APP_BUILD_TIMESTAMP__`
  define, as in the sibling `sanyokkua/minesweeper` repository.
- TypeScript project references (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`) under
  `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals`/`noUnusedParameters` and `verbatimModuleSyntax`.

**Quality gates**

- Prettier at 4-space indent, 120 columns, single quotes, trailing commas **and semicolons**.
- **BREAKING (documentation):** this reverses the `no-semicolons` rule currently recorded in
  `docs/spec/phased-design.md` §1, `AGENTS.md` and `openspec/config.yaml`. All three are corrected in
  this change so no document describes the former rule.
- ESLint 10 flat config on `typescript-eslint`'s **`strictTypeChecked` + `stylisticTypeChecked`**
  (not `recommended`) with the type-aware project service, `react-hooks`, `react-refresh` and
  `eslint-config-prettier`; `@typescript-eslint/no-explicit-any` is an error.
- Vitest 4 + jsdom + React Testing Library for unit and component tests; Playwright 1.62 with
  desktop (`chromium`, `firefox`, `webkit`) and touch (`iphone-17-pro`, `iphone-14-pro-max`,
  `galaxy-s25`) projects for end-to-end tests.
- **New for this project:** husky + lint-staged git hooks. `pre-commit` formats and auto-fixes the
  staged files, re-stages them, then runs `typecheck` and the unit/component suites. `pre-push` runs
  Playwright. The sibling project has no hooks at all, so this is an addition rather than a port.
- An aggregate `validate` script: `format:check && lint && typecheck && test:unit && build`.

**Application shell**

- A Redux store with an `app` slice holding the current route, the Home and Game screen shells
  (static text from `docs/spec/specification.md` §3, with real navigation controls), a build stamp,
  `tokens.css` carrying the complete light, dark and night-card palettes from `specification.md`
  §8.1, and Inter + Press Start 2P bundled locally under `src/assets/`.
- The `src/` layers that later phases fill (`domain`, `solver`, `features`, `i18n`, `pwa`) are
  created as directories with a `README.md` stating what belongs there and which phase fills it.
  **No placeholder modules and no stub exports** — only code that is genuinely real in Phase 1.

**Delivery**

- `.github/workflows/ci.yml` and `.github/workflows/pages.yml`, with action versions checked against
  current releases rather than copied from the sibling repository.
- `README.md`, and updates to `AGENTS.md` so it describes the tooling that now exists.

**Deferred on purpose** (named here so they are not silently dropped): `vite-plugin-pwa`, the web
manifest, icons, the service worker and `scripts/validate-artifact.mjs` belong to Phase 8;
`scripts/validate-lifecycle-storage.mjs` belongs to Phase 4, because it guards a persistence seam
that does not exist yet. The `validate` chain and `pages.yml` therefore omit the artifact step for
now. The live GitHub Pages deploy is only observable once this work reaches `master`, which is out of
this change's reach under `AGENTS.md`'s branch policy; it is recorded as a follow-up.

## Capabilities

### New Capabilities

- `tooling/repository-foundation`: how the repository installs, builds, formats, lints, type-checks
  and tests itself; which gates run on commit, on push and in CI; how the `/solitaire/` base path
  stays consistent across the build, test and CI configuration; and how the deployable artifact is
  produced.
- `app/application-shell`: the runnable shell the later phases extend — route state in the Redux
  store, the Home and Game screens, the semantic design tokens for the three palettes, the locally
  bundled fonts, and the build stamp.

### Modified Capabilities

None. `openspec/specs/` is empty; this change introduces the project's first two capabilities.

## Impact

**Source layers touched**

| Layer | Impact |
| --- | --- |
| `src/app` | New: `store.ts`, `appSlice.ts`, `hooks.ts` — route state only. |
| `src/ui` | New: `screens/HomeScreen.tsx`, `screens/GameScreen.tsx`, `components/BuildStamp.tsx`, `styles/tokens.css`, `styles/global.css`. |
| `src/assets` | New: `fonts/Inter-Variable.woff2`, `fonts/PressStart2P-Regular.ttf`, `fonts/README.md` (SIL OFL attribution). |
| `src/domain`, `src/solver`, `src/features`, `src/i18n`, `src/pwa` | Directory + `README.md` only. **No code.** Filled by Phases 2–8. |
| `tests/unit`, `tests/component`, `tests/e2e` | New: harness (`tests/setup.ts`) and the suites covering the real Phase 1 code. |
| `scripts/` | **Not created.** Its first occupants are Phase 4 and Phase 8 scripts. |
| `docs/spec` | `phased-design.md` §1 Prettier row corrected. The rest of the pack is unchanged historical input. |

**Repository root**: `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`,
`vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.prettierrc.json`,
`.prettierignore`, `index.html`, `.husky/`, `.github/workflows/`, `README.md`, `AGENTS.md`,
`.gitignore`.

**Dependencies**: React 19, React DOM, Redux Toolkit, React Redux (runtime); Vite, TypeScript,
ESLint + typescript-eslint, Prettier, Vitest + `@vitest/coverage-v8`, jsdom, Testing Library,
Playwright, husky, lint-staged (development). No runtime network dependency and no third-party asset
host, per `KS-GEN-01` and `KS-PWA-04`.

**Constitution and architecture principles**: no principle in `AGENTS.md` "Architecture principles"
changes. This change *establishes* the layer boundaries those principles govern, and enforces
principle 9 (docs are part of the change) by correcting the documents the semicolon decision
invalidates. The only documented convention that changes is the Prettier semicolon rule, restated
under **What Changes** above and recorded in `design.md`.
