# Tests

Tests live in this top-level tree, mirroring `src/` — never colocated with source.

Naming convention:

- `*.test.ts(x)` — Vitest, run in-process
- `*.spec.ts` — Playwright, run in a real browser

Layers:

- `unit/` — domain, solver and store logic (e.g. `unit/app/store.test.ts`, `unit/ui/tokens.test.ts`)
- `component/` — React Testing Library component behaviour (e.g. `component/appShell.test.tsx`,
  `component/buildStamp.test.tsx`)
- `e2e/` — Playwright end-to-end specs against the built artifact (added in task 5.1)

`setup.ts` is the shared Vitest setup file (`tests/setup.ts`), loaded via `vitest.config.ts`.
