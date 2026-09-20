# Tasks

> Conventions for every task below: commands are run with the `rtk` wrapper per `AGENTS.md`;
> `*.test.ts(x)` files are Vitest, `*.spec.ts` files are Playwright; tests live in the top-level
> `tests/` tree mirroring `src/`, never colocated. Requirement names in **Implements** refer to
> `specs/tooling/repository-foundation/spec.md` (T) and `specs/app/application-shell/spec.md` (A).

## 1. Build spine

- [ ] 1.1 Create the npm project with pinned dependencies and the script surface, and verify a clean install succeeds and every declared script resolves
    - **Implements:** T "Reproducible install on a pinned runtime"
    - **Files:** `package.json`, `package-lock.json`, `.gitignore` (add `playwright-report/`, `test-results/`, `.husky/_/`)
    - **Details:** `private: true`, `type: "module"`, `engines.node: ">=22.22.2"`, exact version pins with no range specifiers. Runtime deps: `react`, `react-dom`, `@reduxjs/toolkit`, `react-redux`. Dev deps: `vite`, `@vitejs/plugin-react`, `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`, `husky`, `lint-staged`, `@types/node`, `@types/react`, `@types/react-dom`. Scripts: `dev`, `dev-network`, `build`, `preview`, `format`, `format:check`, `lint`, `lint:fix`, `typecheck`, `test`, `test:unit`, `test:coverage`, `e2e`, `e2e:headed`, `prepare`, and `validate` = `format:check && lint && typecheck && test:unit && build`. Take `/Users/ok/Development/GitHub/minesweeper/package.json` as the version baseline but confirm each pin against the current registry release, per `phased-design.md` §1 ("refresh at Phase 1"). Do **not** add `vite-plugin-pwa` (Phase 8).
    - **Verify:** `rtk npm ci` completes without rewriting `package-lock.json`, and `rtk npm run` lists every script above
    - **Note:** `prepare` is wired to husky in task 6.1; until then it may be absent or a no-op

- [ ] 1.2 Add the TypeScript project-reference configuration at the strictness level design D4 requires, and verify the type-check command passes and rejects an unchecked index read
    - **Implements:** T "Strict type checking"
    - **Files:** `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `src/vite-env.d.ts`
    - **Details:** Root delegates to an app project (`include: ["src", "tests"]`) and a node project (`include` the config files and, later, `scripts`). Beyond `strict`: `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `noEmit`, `jsx: react-jsx`, `moduleResolution: Bundler`, types `vitest/globals`, `vite/client`, `node`. `src/vite-env.d.ts` declares `__APP_BUILD_TIMESTAMP__: string`. Per design D6/risk list, confirm `tsc -b` actually works with the chosen `composite` settings rather than copying the sibling's shape, which omits `composite` on the referenced app project.
    - **Verify:** `rtk npm run typecheck` exits zero; temporarily reading an array element by index and using it without a guard makes it exit non-zero (revert the probe afterwards)

- [ ] 1.3 Add the Vite build configuration and the application entry point, and verify the build emits a `/solitaire/`-based artifact
    - **Implements:** T "Production build under the Pages base path" (KS-GEN-01)
    - **Files:** `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`
    - **Details:** `base: '/solitaire/'`, `define.__APP_BUILD_TIMESTAMP__` from `process.env.BUILD_TIMESTAMP ?? 'dev version'`, `@vitejs/plugin-react`. `index.html` carries `viewport-fit=cover` and no manifest link yet (Phase 8) and no external URL of any kind. `src/main.tsx` mounts `App` inside `StrictMode` and the Redux `Provider` — the store arrives in 4.1, so this task may land `App` as a minimal named-export component and 4.3 gives it routing. Use named exports throughout, matching the sibling project's convention.
    - **Verify:** `rtk npm run build` exits zero and every asset URL in `dist/index.html` begins with `/solitaire/`; `grep -E "https?://" dist/index.html` finds nothing

## 2. Code quality tooling

- [ ] 2.1 Configure Prettier to the project house style and verify the whole tree checks clean while the spec pack is untouched
    - **Implements:** T "Deterministic source formatting"; design decision D1
    - **Files:** `.prettierrc.json`, `.prettierignore`
    - **Details:** `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 120, "tabWidth": 4 }` — note `semi: true`, which reverses the rule still written in `phased-design.md` §1, `AGENTS.md` and `openspec/config.yaml`; task 8.2 corrects those documents and must not be skipped. Ignore `node_modules/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `package-lock.json`, `docs/`, `openspec/`, `.agents/`, `.claude/`, `.husky/_/`.
    - **Verify:** `rtk npm run format` then `rtk npm run format:check` exits zero, and `git status --porcelain docs/ openspec/` is empty afterwards

- [ ] 2.2 Configure ESLint with type-aware strict rules and verify it is clean and rejects `any` and floating promises
    - **Implements:** T "Static analysis rejects unsound typing"; design decision D4
    - **Files:** `eslint.config.js`
    - **Details:** Flat config via `tseslint.config()`: global ignores (`dist`, `coverage`, `playwright-report`, `test-results`, `node_modules`), `@eslint/js` recommended, `tseslint.configs.strictTypeChecked` and `stylisticTypeChecked` (not `recommended`), `languageOptions.parserOptions.projectService: true` with `tsconfigRootDir`, `react-hooks` recommended, `react-refresh/only-export-components`, explicit `@typescript-eslint/no-explicit-any: 'error'` and `consistent-type-imports: 'error'`, and `eslint-config-prettier` **last**. Config files and `tests/` may need a relaxed override block — add one only if a concrete rule conflict appears, and record why inline.
    - **Verify:** `rtk npm run lint` exits zero with no warnings; a temporary `const probe: any = 1` and a temporary unawaited promise call each make it exit non-zero (revert the probes)

## 3. Test harness

- [ ] 3.1 Configure Vitest with jsdom and Testing Library, and verify the in-process layer runs and excludes Playwright specs
    - **Implements:** T "Test suites separated by execution layer"
    - **Files:** `vitest.config.ts`, `tests/setup.ts`
    - **Details:** `environment: 'jsdom'` with `environmentOptions.jsdom.url = 'http://localhost/solitaire/'`, `setupFiles: ['./tests/setup.ts']`, `globals: true`, `css: true`, `include: ['tests/**/*.{test,spec}.{ts,tsx}']`, `exclude: ['tests/e2e/**/*.spec.ts']`, v8 coverage with `reporter: ['text','html']` and thresholds, excluding `src/main.tsx` and `src/vite-env.d.ts`. `tests/setup.ts` imports `@testing-library/jest-dom/vitest` and installs a `matchMedia` implementation (jsdom has none; this is the one place a test double is unavoidable, per design D2). Set coverage thresholds to what the real Phase 1 code actually achieves once tasks 4.1–4.4 land — revisit this task's numbers at the end of group 4 rather than guessing now.
    - **Verify:** `rtk npm run test:unit` runs and reports zero failures (no tests yet is acceptable at this point); `rtk npm run test:coverage` produces a report

## 4. Application shell

- [ ] 4.1 Implement the Redux store and the `app` route slice, and verify the store unit test passes
    - **Implements:** A "Two top-level screens" (KS-GEN-02)
    - **Files:** `src/app/store.ts`, `src/app/appSlice.ts`, `src/app/hooks.ts`
    - **Tests:** `tests/unit/app/store.test.ts` — asserts the initial route is `home`; dispatching `setRoute('game')` yields `game`; the exported `RootState`/`AppDispatch` types resolve against the configured store; a selector reads the route from real store state (no mocked store)
    - **Details:** `appSlice` holds only `route: 'home' | 'game'` with a `setRoute` reducer. Typed `useAppDispatch`/`useAppSelector` hooks. Nothing else — sheets, notices and visibility are Phases 6–7.
    - **Verify:** `rtk npm run test:unit -- tests/unit/app/store.test.ts` passes

- [ ] 4.2 Add the design tokens, global stylesheet and bundled fonts, and verify the token contract test passes
    - **Implements:** A "Semantic colour tokens for the three palettes" (KS-SET-03), A "Locally bundled typefaces" (KS-PWA-04), T "No third-party runtime hosts"
    - **Files:** `src/ui/styles/tokens.css`, `src/ui/styles/global.css`, `src/assets/fonts/Inter-Variable.woff2`, `src/assets/fonts/PressStart2P-Regular.ttf`, `src/assets/fonts/README.md`
    - **Tests:** `tests/unit/ui/tokens.test.ts` — reads `tokens.css` as text and asserts (a) every colour role in `docs/spec/specification.md` §8.1 has a custom property under `:root`, under the dark selector and under the night-card selector; (b) every `@font-face` `src` is a path relative to `../../assets/fonts/` and no declaration contains `http://` or `https://`; (c) the `--font-ui` and `--font-pixel` tokens exist
    - **Details:** Copy both font binaries and the SIL OFL attribution README from `/Users/ok/Development/GitHub/minesweeper/src/assets/fonts/` (present locally; no download needed). Fonts live under `src/assets/` so Vite fingerprints them, per design D8. Tokens carry the full light, dark and night-card palettes from specification §8.1. `global.css` starts with `@import './tokens.css'` and sets base typography from the tokens only.
    - **Verify:** `rtk npm run test:unit -- tests/unit/ui/tokens.test.ts` passes

- [ ] 4.3 Implement the Home and Game screen shells and route-driven rendering, and verify the shell component test passes for pointer and keyboard
    - **Implements:** A "Two top-level screens" (KS-GEN-02), A "Navigation between the two screens" (KS-GEN-02, KS-A11Y-03)
    - **Files:** `src/ui/screens/HomeScreen.tsx`, `src/ui/screens/GameScreen.tsx`, `src/App.tsx` (routing + stylesheet imports)
    - **Tests:** `tests/component/appShell.test.tsx` — Home renders on first mount and Game does not; a pointer click on the start control renders Game; keyboard focus plus Enter on the start control renders Game; the back control returns to Home by both paths; each navigation control has an accessible name. Drag is not asserted and the test states why inline (no draggable object exists in the shell; card dragging arrives with the board in Phase 5), as `openspec/config.yaml` `rules.specs` requires.
    - **Details:** Static screen text is drawn from `docs/spec/specification.md` §3.1 and §3.2; the controls are real `<button>` elements. `App.tsx` imports the stylesheets in fixed order and renders by `route`. No sheets, no modes, no deal — those are Phases 6–7.
    - **Verify:** `rtk npm run test:unit -- tests/component/appShell.test.tsx` passes

- [ ] 4.4 Add the build stamp component, and verify it renders the injected timestamp and the development placeholder
    - **Implements:** A "Build identification"
    - **Files:** `src/ui/components/BuildStamp.tsx`, `src/App.tsx` (render it in the shell)
    - **Tests:** `tests/component/buildStamp.test.tsx` — asserts the value of `__APP_BUILD_TIMESTAMP__` is rendered as text with an accessible name, and that the `dev version` placeholder appears when no build timestamp was supplied
    - **Verify:** `rtk npm run test:unit -- tests/component/buildStamp.test.tsx` passes

- [ ] 4.5 Create the reserved layer directories with documentation only, and verify no executable code exists in them
    - **Implements:** A "Layers reserved for later phases carry no behaviour"; design decision D2
    - **Files:** `src/domain/README.md`, `src/solver/README.md`, `src/features/README.md`, `src/i18n/README.md`, `src/pwa/README.md`, `tests/README.md`
    - **Details:** Each README states what belongs in that layer (from `phased-design.md` §3.1), which phase fills it, and the import restrictions that apply to it (for `domain` and `solver`: no React, Redux, DOM or storage imports). `tests/README.md` records the `*.test.ts(x)` vs `*.spec.ts` convention and the three test layers. No `.ts` or `.tsx` file is created in any of these directories.
    - **Verify:** `find src/domain src/solver src/features src/i18n src/pwa -name '*.ts' -o -name '*.tsx' | wc -l` reports `0`, and each directory is tracked by git

## 5. End-to-end layer

- [ ] 5.1 Configure Playwright with desktop and touch projects and add the smoke spec, and verify it passes on every project
    - **Implements:** T "Test suites separated by execution layer" (browser-layer scenario)
    - **Files:** `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
    - **Tests:** `tests/e2e/smoke.spec.ts` — loads the app at the base URL, asserts the Home shell heading is visible, asserts the page does not scroll (`scrollHeight <= innerHeight`, `scrollWidth <= innerWidth`), navigates to Game and asserts the Game shell heading, then navigates back
    - **Details:** `testDir: './tests/e2e'`, `testMatch: '**/*.spec.ts'`, `baseURL: 'http://127.0.0.1:5173/solitaire/'`, `webServer` building then serving, `forbidOnly`/`retries` keyed off `CI`, trace and screenshot on failure. Projects: `chromium`, `firefox`, `webkit`, plus the touch projects `iphone-17-pro` (WebKit, 402×874), `iphone-14-pro-max` (WebKit, 430×932) and `galaxy-s25` (Chromium, 360×780), each with `hasTouch` and `isMobile`, per `phased-design.md` §5.
    - **Verify:** `rtk npx playwright install --with-deps chromium firefox webkit` then `rtk npm run e2e` passes on all six projects

## 6. Local gates

- [ ] 6.1 Install husky and lint-staged and add the pre-commit gate, and verify a mis-formatted file is corrected *in the commit* and a type error blocks the commit
    - **Implements:** T "Commit-time gate"; design decision D5
    - **Files:** `package.json` (`prepare: "husky"`, `lint-staged` config), `.husky/pre-commit`
    - **Details:** `lint-staged`: `*.{ts,tsx}` → `prettier --write` then `eslint --fix`; `*.{json,css,html,md,yml,yaml}` → `prettier --write`. lint-staged restages what it rewrites. `.husky/pre-commit` runs `npx lint-staged`, then `npm run typecheck`, then `npm run test:unit` — never Playwright.
    - **Verify:** On a throwaway commit, stage a file written with 2-space indent and no semicolons; after committing, `git show HEAD:<path>` shows 4-space indent and semicolons — assert the **committed blob**, not the working-tree file (design risk list). Then confirm a deliberate type error causes the commit to be rejected. Reset the throwaway commit afterwards.

- [ ] 6.2 Add the pre-push gate and verify a failing end-to-end spec blocks the push
    - **Implements:** T "Push-time gate"
    - **Files:** `.husky/pre-push`
    - **Details:** Runs `npm run e2e`.
    - **Verify:** With a temporarily broken assertion in `tests/e2e/smoke.spec.ts`, a push to a throwaway remote ref is rejected; with the assertion restored, it is allowed

## 7. Continuous integration and delivery

- [ ] 7.1 Add the CI workflow, and verify its contract test passes and its steps reproduce the local gate
    - **Implements:** T "Continuous integration on every push and pull request"
    - **Files:** `.github/workflows/ci.yml`
    - **Details:** Triggers on `push` and `pull_request`; top-level `permissions: contents: read`; `BUILD_TIMESTAMP` from the run start time; checkout, Node 22.22.2 with npm cache, `npm ci`, `npm run validate`, `npx playwright install --with-deps chromium firefox webkit`, `npm run e2e`, then upload `playwright-report/` and `test-results/` as an artifact on failure. **Per `AGENTS.md`, web-search the current release of each action and pin it exactly (`vX.Y.Z`) — do not copy the sibling repository's pins.** No `validate:artifact` step (Phase 8, design D6).
    - **Verify:** `rtk npm run validate` reproduces the workflow's gate locally; the workflow file parses as valid YAML and task 7.3's contract test passes

- [ ] 7.2 Add the Pages deployment workflow, and verify its permission scoping and contract test
    - **Implements:** T "Deployment to GitHub Pages from the default branch"
    - **Files:** `.github/workflows/pages.yml`
    - **Details:** Triggers on `push: branches: [master]` and `workflow_dispatch`; `concurrency: { group: pages, cancel-in-progress: false }`; top-level `permissions: contents: read`. Build job guarded by `if: github.ref == 'refs/heads/master'`: checkout, Node 22.22.2, `npm ci`, `npm run validate`, `npm run build` with `BUILD_TIMESTAMP`, `upload-pages-artifact` with `path: dist`. Deploy job depends on build and is the **only** job granted `pages: write` and `id-token: write`. Action versions looked up and pinned as in 7.1. No `validate:artifact` step (Phase 8).
    - **Verify:** Task 7.3's contract test asserts the guards, the concurrency group, the job-scoped permissions and the pinned versions
    - **Out of scope, record as follow-up:** the live deploy at `https://sanyokkua.github.io/solitaire/` is only observable after this work reaches `master`, which `AGENTS.md` forbids here. Do not mark it verified.

- [ ] 7.3 Add the repository configuration contract test, and verify it fails when the base path or a pinned action version drifts
    - **Implements:** T "Base path agreement across configurations", T "Continuous integration…", T "Deployment to GitHub Pages…"
    - **Files:** `tests/unit/repo/configContract.test.ts`
    - **Tests:** Reads `vite.config.ts`, `vitest.config.ts` and `playwright.config.ts` as text and asserts all three carry `/solitaire/`; reads both workflow files and asserts each required step, the `master` ref guard, `concurrency: pages`, `pages: write` and `id-token: write` present **only** in the deploy job, and that every `uses:` is pinned to an exact `vX.Y.Z` tag
    - **Details:** This is the executable form of design D3's configuration-test rationale — the base path is coupled across four files and its breakage is otherwise deploy-time-only.
    - **Verify:** `rtk npm run test:unit -- tests/unit/repo/configContract.test.ts` passes; temporarily changing `base` in `vite.config.ts` makes it fail (revert the probe)

- [ ] 7.4 Revisit the coverage thresholds set in task 3.1 against the real measured coverage, and verify the coverage command passes at the committed thresholds
    - **Implements:** T "Test suites separated by execution layer" (coverage scenario)
    - **Files:** `vitest.config.ts`
    - **Details:** Set thresholds to the coverage the Phase 1 code actually achieves, leaving no headroom that a later phase could silently consume. If a real file is genuinely untestable in-process, exclude it explicitly and record why, rather than lowering a global threshold.
    - **Verify:** `rtk npm run test:coverage` exits zero; lowering any real file's coverage makes it exit non-zero

## 8. Documentation

- [ ] 8.1 Write the project README, and verify every command it documents actually runs
    - **Implements:** Constitution principle 9
    - **Files:** `README.md`
    - **Details:** Follow the sibling project's shape: intro with the explicit negative-scope statement (no backend, API, account or database), prerequisites including the Node floor, a table mapping every npm script to its purpose, the local gate block, a fenced repository-layout listing with one line per directory, the current implementation status (Phase 1 complete; Phases 2–11 pending), and the licence note covering both the MIT application licence and the SIL OFL fonts with a link to `src/assets/fonts/README.md`.
    - **Verify:** Every command in the script table runs successfully from a clean checkout; `rtk npm run format:check` passes on the README

- [ ] 8.2 Reconcile the documents invalidated by this change, and verify no document still describes the former rules
    - **Implements:** Constitution principle 9; design decision D1
    - **Files:** `AGENTS.md`, `docs/spec/phased-design.md` (§1 "Quality gates" row), `openspec/config.yaml` (`context` block)
    - **Details:** Four corrections. (a) **Semicolons:** `phased-design.md` §1, `AGENTS.md` and the `openspec/config.yaml` `context` block all say "no semicolons" — change all three to state semicolons, 4 spaces, 120 columns, single quotes, trailing commas. The config block matters most: it is injected into every future planning session. (b) **Scaffolding status:** `AGENTS.md` says the repository is pre-implementation with no `package.json` or tooling — replace with the real script list, the hook gates, and the Phase 8 / Phase 4 deferrals of `validate:artifact` and `validate:lifecycle-storage`. (c) **Speckit:** `AGENTS.md` says Speckit "will be installed later" and instructs copying the constitution into `.specify/memory/constitution.md` — OpenSpec is installed and Speckit is not, so state that and drop the `.specify` instruction, keeping `AGENTS.md` itself as the constitution's home. (d) **Divergence from the sibling project:** record that semicolons, git hooks and lint strictness now deliberately differ from `sanyokkua/minesweeper`, so "as in Minesweeper" is no longer literal for those three.
    - **Verify:** `grep -rin "no semicolon\|no-semicolons" AGENTS.md docs/spec openspec/config.yaml README.md` returns nothing; `grep -n "not set up yet\|will be installed into this repo later" AGENTS.md` returns nothing; `rtk npm run validate` still passes

## 9. Whole-change verification

- [ ] 9.1 Run the complete gate end to end on a clean checkout and confirm every spec scenario is covered by a passing check
    - **Implements:** T "Single aggregate validation gate"
    - **Details:** Spans every task above, so it is a separate verification task rather than an inline one. Walk each `#### Scenario:` in both delta specs and name the test or command that exercises it; anything unexercised is a gap to close, not to note.
    - **Verify:** From a clean clone: `rtk npm ci` → `rtk npm run validate` → `rtk npm run e2e` all exit zero, and a commit and a push through the hooks both behave as tasks 6.1 and 6.2 describe
