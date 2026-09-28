# Proposal

## Why

Phases 1–6 built a complete, playable table, but the product around it is missing. Home is a
36-line stub. No sheet exists: `app.sheet` is only state, so Settings, How to play, Statistics,
Pause, New deal, the Win sheet, deal-code entry and About cannot be reached. About 75 visible
strings are hard-coded English, and `src/i18n` is empty. The **N** and **P** keys do nothing,
nothing opens the Win sheet, and nothing makes the app installable or usable offline.

This change implements **Phase 7 (Screens, sheets & localisation)** and **Phase 8 (PWA, offline &
delivery hardening)** of `docs/spec/phased-design.md` §7 as **one change, at the author's
request**. The config rule of one phase slice per proposal is waived on purpose. The tasks are
still split by layer and ordered so that the Phase 8 groups depend only on Phase 7's notice host,
Home links and save port.

This is the last change that modifies application code; later phases only verify and release. So
the change also carries quality work on existing code that the new screens touch: a save port
reachable from thunks, navigation owned by thunks, shared test helpers, one source of "today", and
removal of duplicated helpers and casts.

## What Changes

How each item is built is in `design.md` (D1–D17). This section states only what changes.

- **Shared test helpers (group 1).** One `renderWithStore` / `testStore` helper replaces the store
  and `Provider` set-up duplicated in about 30 test files. Every later task uses it, so it lands
  first. It changes no behaviour.
- **Quality work folded into feature tasks.** Each item changes no behaviour and adds no
  requirement; it lands in the feature task that already edits the same code (D15), is accepted
  when the existing suites stay green, and keeps its own named test:
  - one CSS rule parser replaces four copies in the CSS static tests (task 4.1);
  - one timers module and store interface replace the copies in `clockTicker` and
    `persistenceWriter` (task 3.1);
  - one typed position-style helper replaces five `as CSSProperties` casts in the board views
    (task 2.4), and one card-element lookup replaces four copies (task 5.8);
  - the injected `today` now really drives the Daily deal; today the deal service reads its own
    `new Date()` (task 5.4);
  - the `sessionCodec` double cast goes (task 2.2);
  - session thunks (start, restart, continue) move out of the 347-line `gameThunks.ts` (task 3.4);
  - `selectRoute` moves to `app/selectors.ts`, and the game selectors misplaced there move beside
    `gameSlice` (task 3.2);
  - the shortcut test asserts outcomes instead of counting dispatches (task 5.5).
- **Localisation (`src/i18n`, new):**
  - English and Ukrainian catalogs, one file per language, plus a registry. Adding a language
    means adding one file and one registry line.
  - Plural-aware messages.
  - Switching language takes effect immediately, including in open sheets.
  - The document language and title follow the locale.
  - Card and pile names, announcements, notices and every screen string come from the catalog.
  - A pseudo-locale with strings 30% longer, used only in tests, proves that no text clips.
- **Sheets (`src/ui/sheets`, new):** one sheet host with a focus trap, focus return, Escape and
  backdrop dismissal (the Win sheet excepted), and an inert background. The eight sheets:
  - **Settings**, grouped as Appearance / Play / Language / Data, with confirmed resets;
  - **How to play**;
  - **Statistics**, with a confirmed reset;
  - **New deal options**: Restart this deal / New deal / Cancel, with a streak warning;
  - **Paused**, which hides the board;
  - **Win**;
  - **Play a deal code**, with an inline error;
  - **About**.
- **Home, in the mockup's look:**
  - top bar with theme toggle and Settings;
  - felt hero with badge, pixel wordmark, floating card fan and dither;
  - four card-styled mode tiles;
  - the Winnable deals switch;
  - Deal cards / Continue game / How to play, pinned to the bottom on phones and short screens;
  - an LCD record strip;
  - links to Statistics, Settings, Play a deal code and About, plus Install app where the browser
    supports it;
  - the build stamp.
- **Game chrome:**
  - mode and deal chips;
  - theme toggle and Settings in the top bar (Settings beside Back in the side rails);
  - the HUD New deal button (the N key);
  - Time is tappable to pause (the P key);
  - the hint line shows tap-mode text and key chips;
  - a deal-code footer with tap to copy;
  - the "Shuffling a winnable deal…" overlay;
  - the Win sheet opens over the running cascade.
- **Navigation and state:**
  - intent thunks own every route and sheet change: deal, request a new deal, restart, play a
    code, pause and resume, go Home;
  - pausing and asking for a new deal do nothing while a safe-card chain or Finish is running or a
    deal is being prepared, so no sheet ever hides a game that is still changing;
  - a runtime-only win summary (score, time, moves, bonus, new best time);
  - notices move to the app level, so storage notices also show on Home, and gain `update-ready`
    (with Update and Later) and `code-copied`.
- **PWA (`src/pwa`, new):**
  - a web manifest and icons, including maskable;
  - a service worker in prompt mode that precaches the app shell, the solver worker and the
    fonts;
  - offline cold start;
  - an install gateway;
  - an update notice that saves the game before the new version activates, and warns that the game
    will not be kept when saving is read-only or has failed.
- **Delivery:**
  - `scripts/validate-artifact.mjs` checks the base path, manifest, precache and that nothing the
    app loads (HTML, CSS, manifest, service-worker and script load references) comes from another
    origin, and it joins `validate`;
  - Playwright blocks service workers by default, and a Chromium-only PWA spec proves offline
    cold start and the update flow;
  - an axe scan of Home, Game and every sheet;
  - `pages.yml` stops building twice;
  - Lighthouse (installable, mobile performance ≥ 90) is a **documented manual check**, not a CI
    gate.
- **Spec-pack and docs alignment:**
  - `phased-design.md`: Phase 7/8 status, §3.1 layout, the features → i18n dependency, the
    thunk ports, and the stale "Phase 6 not yet archived" note;
  - `specification.md`: the §4.8 N/P note;
  - `README.md`, `AGENTS.md`, and the `src/*` and `tests` READMEs.

**Decisions where the mockup and the specification differ.** The specification decides behaviour
and the mockup decides looks, as in Phase 6.

- The New deal button opens the options sheet during a started, unfinished game. The mockup always
  deals at once.
- Settings keep the mockup's rows and controls, grouped under the mockup's `.sub-label` headings,
  with a Language row and two confirmed resets. The mockup has a flat list with no Language and no
  resets.
- Statistics Reset asks for confirmation. The mockup resets at once.
- Sheets are centred dialogs at every size, as in the mockup.
- These surfaces are not in the mockup, so they are designed from its tokens and components:
  Paused, New deal options, Play a deal code, the real About, the deal-code footer, the Install
  link and the update and storage notices.

**Not in this change:**
- a storage schema change: record v1 is untouched;
- Draw 3 winnable deals;
- the Phase 9 traceability matrix and full multi-browser edge-case sweep;
- the Phase 10 docs set (`docs/index.md`, architecture, and so on).

## Capabilities

### New Capabilities

- `i18n/localisation`: catalogs and registry, plural and placeholder messages, immediate language
  switch, document language and title, first-run language, and no clipping with longer strings.
- `ui/sheets`: the modal sheet host (one at a time, focus, dismissal, inert background, no-motion
  path) and the content and behaviour of all eight sheets.
- `ui/home-screen`: the Home screen's regions, mode choice, Winnable switch, actions (visible
  without scrolling on phones), record strip, links and Install app.
- `pwa/offline-install-update`: offline cold start, install offer and the save-before-update flow.

### Modified Capabilities

- `app/application-shell`:
  - the reserved-layer rule becomes a layer-boundary rule for `src/i18n` and `src/pwa`;
  - navigation is owned by intent thunks and reached from the new controls;
  - Continue game gets its final styling;
  - the build identification appears in About.
- `features/game-session`: requesting a new deal (sheet or immediate), dealing from a code, pause
  and resume.
- `features/interaction`: a runtime-only win summary.
- `features/persistence`: both resets are reachable from Settings after confirmation, and the save
  can be flushed on demand before an update.
- `features/preferences`: the supported languages come from the language registry.
- `features/statistics`: an overall record summary for Home.
- `ui/game-screen`:
  - mode and deal chips;
  - theme toggle and Settings in the top bar;
  - the New deal control and Time pause in the HUD;
  - the hint line's tap-mode text and key chips;
  - the deal-code footer;
  - the dealing overlay;
  - the board hidden while paused, with the deal code also shown in the Paused sheet;
  - localised names.
- `ui/notices`: the host is shown on every screen, update-ready and code-copied notices, and
  localised text.
- `ui/board-keyboard`: N and P are bound.
- `ui/win-cascade`: the Win sheet follows the cascade.
- `ui/board-render`: card and pile names come from the active language.
- `tooling/repository-foundation`:
  - artifact validation in the aggregate gate;
  - the no-third-party-hosts rule is checked on the built artifact's load references;
  - the PWA and accessibility end-to-end specs;
  - service workers blocked by default in end-to-end tests;
  - the deploy workflow builds once;
  - the Lighthouse manual check.

## Impact

- **`src/domain`, `src/solver`:** untouched. Only existing APIs are used: `encodeDealCode`,
  `decodeDealCode`, `dealFromSeed`.
- **`src/features`:**
  - new `game/{sessionThunks,navigationThunks}.ts` and `shared/timers.ts`;
  - `interaction` gains the win summary;
  - `stats` gains an overall selector and a `todayKey` thunk (today's UTC day key from the
    injected clock);
  - `persistence/resetThunks.ts` reads its ports from the thunk extra;
  - `preferences/locale.ts` reads the i18n registry. This is a new, data-only dependency from
    features to i18n.
- **`src/app`:**
  - `thunkExtra.ts` gains the `saver`, `languages` and `pwa` ports;
  - new `savePort.ts` and `pwaThunks.ts`;
  - `appSlice.ts` gains new notice ids and `installable`;
  - `lifecycle.tsx` wires the locale controller, the save port and the PWA gateways;
  - `App.tsx` hosts the sheets, the notices and the polite announcer (the last two outside the
    part made inert while a sheet is open).
- **`src/i18n` (new code):** `catalog.ts`, `translate.ts`, `useTranslate.ts`,
  `localeController.ts`, `locales/{en,uk}.ts`.
- **`src/pwa` (new code):** `registerPwa.ts`, `pwaGateway.ts`, `installGateway.ts`.
- **`src/ui`:**
  - new `sheets/*`, `screens/home/*`, and components (`Switch`, `Segmented`, `Swatches`,
    `SettingRow`, `ConfirmAction`, `ThemeToggle`, `ModeChip`, `DealChip`, `DealCode`,
    `DealingOverlay`, `HintLine`);
  - new `board/{dom,style,useWinSheet}.ts`;
  - new `useToday.ts`;
  - `names.ts`, `announce.ts`, `Notices`, `Announcer`, `Hud`, `Toolbar`, `GameScreen`,
    `HomeScreen` and `useGameShortcuts` change;
  - new `controls.css`, `sheets.css`, `home.css`, and extended `tokens.css`.
- **`public/` (new):** `manifest.webmanifest`, `icons/*`, `favicon.svg`.
- **Configuration:**
  - `vite.config.ts` gets the PWA plugin and a version define;
  - `index.html` gets manifest, theme-color, icons and description;
  - `playwright.config.ts` blocks service workers by default;
  - `eslint.config.js`: the UI may not import route or sheet actions (through
    `@typescript-eslint/no-restricted-imports`, so the purity overrides keep theirs), and the purity override
    allows a type-only i18n import;
  - `package.json` adds `vite-plugin-pwa`, `workbox-window`, `@axe-core/playwright` and the
    `validate:artifact` script;
  - `.github/workflows/pages.yml`.
- **`scripts/`:** new `validate-artifact.mjs` and `generate-icons.mjs`.
- **`tests/`:**
  - new unit, component and e2e suites;
  - `tests/support/{renderWithStore,testStore,css,clipboard,pseudoLocale}`;
  - `reservedLayers.test.ts` is replaced by a layer-boundary test.
- **Docs:** `README.md`, `AGENTS.md`, `src/{features,ui,i18n,pwa}/README.md`,
  `tests/README.md`, `docs/spec/phased-design.md`, `docs/spec/specification.md`.
- **Storage:** none. `locale` is already in record v1, and the win summary, the install
  availability and the update state are runtime-only.
- **Constitution:**
  - No principle changes.
  - Principle 4 (static and offline) is now enforced on the built artifact, not only on the
    source.
  - The "reserved layers carry no behaviour" guard (an application-shell requirement, not a
    principle) is replaced by import boundaries for `src/i18n` and `src/pwa`.
  - Principle 3 is strengthened: UI components no longer change the route or open sheets
    directly.
