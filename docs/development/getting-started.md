# Getting started

## Prerequisites

- Node.js `>= 22.22.2` (`engines` in `package.json`).
- npm, using the committed `package-lock.json`.
- Playwright browsers for the end-to-end suite: `npx playwright install --with-deps chromium firefox webkit`.

## Install and run

```sh
npm ci
npm run dev        # http://localhost:5173/solitaire/
```

`npm run dev-network` binds the dev server to all interfaces (test on a phone on the same network).

The Vite `base` is `/solitaire/` (`vite.config.ts`). Always browse under that path, in dev, preview and production.

## Build and preview

```sh
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serves dist/ at http://localhost:4173/solitaire/ by default
```

The build injects `__APP_VERSION__` (from `package.json`) and `__APP_BUILD__` (the `GITHUB_RUN_NUMBER` env value, if any,
and the UTC build time; without a number the stamp reads "Development build"). The service worker is only generated in the production build; it is not active in `npm run dev`.

## Check your work

```sh
npm run validate   # the gate that must pass before every commit
npm run e2e        # Playwright; builds and previews the app itself
```

`npm run e2e` runs `npm run build && npm run preview` on port 5173 first, and outside CI reuses a server that is already
listening there, so stop a stale preview before you run it against new code. The suite takes a while: it runs seven
projects.

Two scripts are outside the gate: `npm run bench` (informational solver benchmarks) and `npm run screenshots`
(regenerates the committed reference screenshots, only when a change alters the look; see
[testing](testing.md#reference-screenshots)). See [scripts reference](../reference/scripts.md) for every script and
[testing](testing.md) for running a single test.

## Git hooks

`npm ci` runs `prepare`, which installs husky hooks: `pre-commit` (lint-staged, `typecheck`, `test:unit`) and `pre-push`
(`e2e`, all seven Playwright projects, so a push takes minutes). Details in [workflow](workflow.md#git-hooks).

## Next

- [Project structure](project-structure.md) to find your way around.
- [Architecture overview](../architecture/overview.md) to understand the layers.
- [Workflow](workflow.md) before making a change.
