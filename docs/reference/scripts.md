# npm scripts

Source: `package.json`. In this repository's agent workflow, commands are prefixed with `rtk` (a token-saving
wrapper); the underlying commands are the same.

| Script                               | What it does                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Vite dev server (`/solitaire/`).                                                                                                                                             |
| `npm run dev-network`                | Dev server bound to all network interfaces.                                                                                                                                  |
| `npm run build`                      | `tsc -b && vite build` into `dist/`.                                                                                                                                         |
| `npm run preview`                    | Serve the built `dist/`.                                                                                                                                                     |
| `npm run format` / `format:check`    | Prettier write / check.                                                                                                                                                      |
| `npm run lint` / `lint:fix`          | ESLint (strict type-checked config) / with autofix.                                                                                                                          |
| `npm run typecheck`                  | `tsc -b --pretty false` (non-emitting).                                                                                                                                      |
| `npm run test`                       | `vitest run` over everything under `tests/` except e2e.                                                                                                                      |
| `npm run test:unit`                  | `vitest run tests/unit tests/component` (pre-commit hook; no coverage).                                                                                                      |
| `npm run test:coverage`              | Vitest with V8 coverage over every test; 80% thresholds for lines, functions, branches and statements. `validate` runs the same coverage over the unit and component suites. |
| `npm run bench`                      | Informational winnable-search latency benchmark (`tests/bench/`); never asserts, not in CI.                                                                                  |
| `npm run e2e` / `e2e:headed`         | Playwright suite (headless / visible browsers).                                                                                                                              |
| `npm run prepare`                    | Installs husky hooks (runs after `npm install`).                                                                                                                             |
| `npm run validate:lifecycle-storage` | `scripts/validate-lifecycle-storage.mjs`: lifecycle tests must inject their storage gateway.                                                                                 |
| `npm run validate:artifact`          | `scripts/validate-artifact.mjs`: checks the built `dist/` (run after `build`).                                                                                               |
| `npm run validate`                   | `format:check && lint && typecheck && validate:lifecycle-storage && vitest run tests/unit tests/component --coverage && build && validate:artifact`                          |

Other files in `scripts/`: `build-info.mjs` (`resolveBuildInfo`, the build number and UTC time `vite.config.ts` embeds as
`__APP_BUILD__`; imported by the config, not run directly), `generate-icons.mjs` (regenerates `public/favicon.svg` and the icons in `public/icons/` from one rectangle list;
not an npm script, run with `node scripts/generate-icons.mjs`).

What the two validation scripts check is described in [CI and deployment](../development/ci-and-deployment.md).
