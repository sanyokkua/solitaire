# Tasks

> **Conventions**
>
> - **Commands.** Run commands through `rtk`. Use `rtk proxy <cmd>` when the wrapper rejects a flag.
> - **Where tests live.**
>   - Vitest tests are `*.test.ts(x)` under `tests/`, mirroring `src/`.
>   - Component tests live in `tests/component/`. Sheet tests live in `tests/component/sheets/`.
>   - Home tests live in `tests/component/home/`.
>   - Playwright specs are `tests/e2e/*.spec.ts`.
> - **Requirement names** refer to this change's delta specs. Abbreviations:
>
>   | Code | Delta spec |
>   | --- | --- |
>   | **LO** | `specs/i18n/localisation` |
>   | **SH** | `specs/ui/sheets` |
>   | **HO** | `specs/ui/home-screen` |
>   | **PW** | `specs/pwa/offline-install-update` |
>   | **AS** | `specs/app/application-shell` |
>   | **GS** | `specs/features/game-session` |
>   | **IN** | `specs/features/interaction` |
>   | **PE** | `specs/features/persistence` |
>   | **PR** | `specs/features/preferences` |
>   | **ST** | `specs/features/statistics` |
>   | **GM** | `specs/ui/game-screen` |
>   | **NT** | `specs/ui/notices` |
>   | **BK** | `specs/ui/board-keyboard` |
>   | **WC** | `specs/ui/win-cascade` |
>   | **BR** | `specs/ui/board-render` |
>   | **RF** | `specs/tooling/repository-foundation` |
>
> - **Design decisions.** `Dn` is `design.md` decision *n*. Read every decision a task names before coding.
> - **Shared references.**
>   - **spec:** `docs/spec/specification.md` §3.1–3.3, §4.7–4.8, §6, and the KS ids.
>   - **phased-design:** `docs/spec/phased-design.md` §3.1, §3.3, §6, and Phases 7–8 (L372–401).
>   - **mockup (visual authority):** `docs/spec/mockup/klondike-mockup.html` and the screens `01`, `02`, `10`, `11`, `13`. Cite mockup regions by class name (`.home-hero`, `.modal-sheet`, …), not by line number.
>   - **state API:** `src/features/README.md`.
>   - **UI map:** `src/ui/README.md`.
> - **Test set-up.**
>   - Build stores with `testStore()` and render with `renderWithStore()` from `tests/support/` once task 1.1 lands. Both preload `locale: 'en'`.
>   - No in-process test uses real timers, real `matchMedia`, the real clipboard or real browser storage. Inject or stub them.
> - **Catalog keys.** Task 2.2 creates the catalogs with keys only for the strings that exist today (the current UI, card and pile names, announcements and notices). Every later task that adds player-facing text (3.5, 5.x, 6.x, 7.x, 8.3) lists `src/i18n/locales/{en,uk}.ts` in its Files and adds its own keys in both catalogs; the catalog completeness test of 2.2 keeps them in sync.
> - **Documentation.** Every module added to `src/<layer>` is described in that layer's README in the same task.
> - **Verification.**
>   - Every task ends with `rtk npm run test:unit`, `rtk npm run lint` and `rtk npm run typecheck` green.
>   - Tasks that add or change a Playwright spec also run the named `rtk npx playwright test …` command.
>   - Tasks that fill a region reserved in Phase 5 also run `rtk npx playwright test --project=device-fit`.
>   - A task that changes a screen's markup or accessible names, the App composition, or a sheet also runs the full `rtk npm run e2e`.
>   - Before each task commit, run the full, unmodified `rtk npm run validate` and fix everything it reports.
> - **Behaviour.** Group 1 changes no behaviour. Its tests are the existing suites plus the new ones each task names.
> - **Selectors in new tests.** New component and e2e tests locate controls by role and accessible name, not by CSS class.
> - **Visual parity.** Screenshots are compared with the mockup by eye. `tests/e2e/visualParity.spec.ts` is Chromium only and has no pixel gate.
> - **Storage-gateway injection.** Tasks 2.3, 3.1 and 8.3 edit `tests/component/appLifecycle*.test.tsx`; each of those edits must inject the storage gateway rather than touch ambient browser storage, or `rtk npm run validate:lifecycle-storage` fails.
> - **Archive check.** At archive, confirm that the `## Purpose` of each new capability introduced here (`i18n/localisation`, `ui/sheets`, `ui/home-screen`, `pwa/offline-install-update`) reached the main specs.

## 1. Shared test helpers (no behaviour change)

- [x] 1.1 Shared store test helpers for component tests
    - **Implements:** D15. No requirement change.
    - **Files:**
      - new `tests/support/{testStore.ts,renderWithStore.tsx}`;
      - migrate the component files that hand-build `createAppStore` + `<Provider>`: `notices`, `announcer`, `gameFrame`, `hud`, `toolbar`, `gameShortcuts`, `hintVisuals`, `cascade`, `dealAnimation`, `appShell` and `board` (`tests/component/*.test.tsx`), and the shared `tests/support/boardHarness.tsx`;
      - `tests/README.md`.
    - **Tests:** new `tests/unit/support/testStore.test.ts`, which checks:
      - the default deps (`fakeDealService`, fixed `now`, instant `delay`);
      - that overrides merge;
      - that `preferences.locale` is `en`.

      Migrated suites keep their assertions.
    - **Verify:** `rtk npx vitest run tests/component tests/unit/support` passes.

- [x] 1.2 Migrate the unit feature tests to `testStore`
    - **Implements:** D15.
    - **Files:** the `tests/unit/features/**` files that build a store (a local `setup()`/`storeWith()` or a direct `createAppStore` call). These include:
      - `game/{play,finish,autoSafe,startRestart,continueGame,finishable,sequence,clock,clockTicker}`;
      - `interaction/{announcements,deadEnd,selection,hint,gate}`;
      - `persistence/{persistenceLoader,persistenceWriter,resetThunks}`.
    - **Tests:** unchanged assertions, all green.
    - **Verify:** `rtk npx vitest run tests/unit/features` passes.

## 2. Localisation core

- [x] 2.1 Translator with plurals and placeholders; i18n layer boundary
    - **Implements:**
      - LO "Plural forms follow each language's rules" and "Number, score and time formats are language-neutral" (the UTC date formatting);
      - AS "The localisation and offline layers keep their boundaries" (i18n half); *KS-I18N-01*.
    - **Files:**
      - new `src/i18n/translate.ts` (`createTranslator`, `formatDate`);
      - `src/i18n/README.md`;
      - `tests/unit/repo/reservedLayers.test.ts` becomes `layerBoundaries.test.ts`. Using `purityScanner`, it checks that `src/i18n` imports nothing from `app`, `features` or `ui`, except `react` / `react-redux` in `useTranslate.ts` once that exists. `src/pwa` is still README only until 8.2;
      - `eslint.config.js` gets an i18n import restriction (a block matching `src/i18n/**` only, restricting what it may import — not a `src/features`/`src/ui` block, so it does not collide with the D3 flat-config precedence issue that 3.2 and 8.2 work around).
    - **Tests:** `tests/unit/i18n/translate.test.ts` covers:
      - en one/other;
      - uk one/few/many at 1, 2, 5, 11 and 21;
      - `{x}` substitution;
      - the English fallback;
      - a UTC date that stays the same in any time zone.
    - **Verify:** `rtk npx vitest run tests/unit/i18n tests/unit/repo` passes.

- [x] 2.2 Catalogs and the language registry
    - **Implements:**
      - LO "Adding a language needs one catalog and one registration" and "Every language provides every message";
      - PR "Settings and their defaults" and "The first-run language follows the browser" (supported = registered); *KS-I18N-02/03*.
    - **Files:**
      - new `src/i18n/{catalog.ts,locales/en.ts,locales/uk.ts}`, holding keys for the strings that exist today: the current UI text (explicitly including today's Home stub — its heading, "Deal cards" and "Continue game"), card and pile names, announcements and notices (drafted Ukrainian). Later tasks add their own keys (see Conventions);
      - `src/features/preferences/locale.ts` re-exports `Locale` and `SUPPORTED_LOCALES` from the registry;
      - the `sessionCodec` locale check, which drops the `as unknown as Record` double cast for a typed builder (folded quality work, behaviour-neutral; existing suites stay green — D15);
      - `src/i18n/README.md`, `src/features/README.md`.
    - **Tests:**
      - `tests/unit/i18n/catalog.test.ts`: every locale has every key, no message is empty, plural objects use only the categories of that locale's `Intl.PluralRules`, and a new assertion that `SUPPORTED_LOCALES` equals the registry keys;
      - `tests/unit/features/preferences/locale.test.ts` stays green;
      - a missing `uk` key fails `typecheck`, which is shown by a `// @ts-expect-error` fixture in the test.
    - **Verify:** `rtk npm run typecheck && rtk npx vitest run tests/unit/i18n tests/unit/features/preferences` passes.

- [x] 2.3 `useTranslate` and the locale controller
    - **Implements:** LO "Switching language applies at once and is remembered", "The document follows the active language" and "First-run text follows the chosen language"; *KS-I18N-01/02*.
    - **Files:**
      - new `src/i18n/{useTranslate.ts,localeController.ts}`;
      - `src/app/lifecycle.tsx` starts and disposes the controller;
      - `src/i18n/README.md`, and the `src/app` notes in `src/features/README.md` (there is no `src/app/README.md`).
    - **Tests:**
      - `tests/unit/i18n/localeController.test.ts`: sets `lang` and `title` at start, updates them on a change, and does nothing after dispose;
      - `tests/component/useTranslate.test.tsx`: re-renders on a locale change;
      - `tests/component/appLifecycle.wiring.test.tsx`: `<html lang>` follows a stored `uk`, and the chosen language is remembered after a reload (read back from the encoded record). This test injects the storage gateway per `validate:lifecycle-storage` (see Conventions). (The first-run-in-Ukrainian assertion moves to 2.5, once Home is localised.)
    - **Verify:** `rtk npx vitest run tests/unit/i18n tests/component/useTranslate tests/component/appLifecycle` passes.

- [x] 2.4 Card and pile names and announcements from the catalog
    - **Implements:** BR "Accessible names for cards and piles", BK "Cards and piles have roles and state for assistive technology", NT "One polite announcer"; *KS-A11Y-01/02*, *KS-I18N-01*.
    - **Files:**
      - `src/ui/board/names.ts` (`cardName(t, …)`, `pileLabel(t, …)`);
      - `src/ui/announce.ts` (`formatAnnouncement(t, …)`, `hintText(t, …)`), with the case munging and hand-built plurals removed;
      - `Announcer.tsx` and the board views that call `names`;
      - new `src/ui/board/style.ts`, a typed `--x/--y` position style with no `as CSSProperties` cast, replacing the five casts in `CardView`, `PileSlot`, `StockBadge`, `Ghosts` and `Board` (folded quality work, behaviour-neutral; existing suites stay green — D15). `style.ts` may be a pure bullet in `src/ui/README.md` if it is added to the purity override in `eslint.config.js`;
      - `eslint.config.js` purity override: its `no-restricted-imports` pattern is changed to allow the `../../i18n/translate` path, keeping the rule itself (not switched to `@typescript-eslint/no-restricted-imports`);
      - `tests/unit/repo/boardPurity.test.ts` allow-list, extended to require the `../../i18n/translate` import in `names.ts` to be `import type`;
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/unit/ui/board/names.test.ts` and `tests/unit/ui/announce.test.ts` in en and uk (counts 1, 3, 5; face-down; empty column);
      - new `tests/unit/ui/board/style.test.ts` checks the property names and the `px` values;
      - `boardRoles`, `announcer` and `playByKeyboard`-dependent component suites stay green in en.
    - **Verify:** `rtk npx vitest run tests/unit/ui tests/unit/repo tests/component` passes.

- [x] 2.5 Localise the existing Game chrome, Home stub and notices text
    - **Implements:** GM "HUD values and the Time control" and "The Game screen keeps its name and dealing status" (names), NT "Transient notices" (text at render time), LO "All player-facing text in English and Ukrainian" and "First-run text follows the chosen language" (the existing Game chrome, the Home stub and notices); *KS-I18N-01/02*.
    - **Files:**
      - `Hud.tsx`, `Toolbar.tsx`, `GameScreen.tsx`, `BuildStamp.tsx`, `src/ui/screens/HomeScreen.tsx` (localise the existing stub's heading, "Deal cards" and "Continue game");
      - `Notices.tsx`: the import-time `TEXT` table becomes a render-time lookup;
      - `tests/component/appLifecycle.wiring.test.tsx`: adds the first-run assertion moved from 2.3 (see 2.3);
      - `src/ui/README.md`.
    - **Tests:**
      - the `hud`, `toolbar`, `notices`, `gameFrame` and `buildStamp` suites pass in en;
      - each gains one `uk` render that asserts a translated accessible name;
      - `tests/component/localeSwitch.test.tsx`: changing the preference while the Game screen is shown updates the toolbar names without a remount, and leaves the game itself (tableau position, score and time) and every rendered number unchanged;
      - `appLifecycle.wiring`: a first run with `languages: ['uk-UA']` renders Home in Ukrainian with no English text in the first render. This test injects the storage gateway per `validate:lifecycle-storage` (see Conventions).
    - **Verify:** `rtk npx vitest run tests/component` passes.

## 3. App services, intents and state

- [x] 3.1 Save port and languages in the thunk extra; resets become parameterless
    - **Implements:** D8; PE "Reset all local data restores defaults" and "The game is saved on demand before an update"; *KS-PER-05*.
    - **Files:**
      - new `src/app/savePort.ts`;
      - `src/app/{thunkExtra.ts,lifecycle.tsx}` (connect the writer after it is created);
      - `src/features/persistence/resetThunks.ts` reads `saver` and `languages` from the extra;
      - new `src/features/shared/timers.ts` (`globalTimers`, `SubscribableStore`), used by `src/features/game/clockTicker.ts` and `src/features/persistence/persistenceWriter.ts` in place of their own copies (folded quality work, behaviour-neutral; existing suites stay green — D15);
      - `tests/support/testStore.ts` provides the fakes;
      - `src/features/README.md`.
    - **Tests:**
      - `tests/unit/app/savePort.test.ts`: does nothing before connection, forwards `flush` and `cancel` after;
      - `tests/unit/features/persistence/resetThunks.test.ts` uses the injected ports, and covers reset-all closing the open sheet and dismissing `storage-read`, `storage-read-only` and `storage-write` notices (the assertion that it does not dismiss `update-ready`/`code-copied` moves to 3.5, once those notice ids exist);
      - `tests/unit/features/persistence/persistenceWriter.test.ts`, and the existing `clockTicker` suite, stay green against the shared timers module, plus: `flush` writes inside the debounce window and no second write follows at the 250 ms debounce; a failed flush follows the failed-save rule; `flush` is a no-op in read-only mode;
      - `appLifecycle.wiring`: a flush through the extra reaches the writer. This test injects the storage gateway per `validate:lifecycle-storage` (see Conventions).
    - **Verify:** `rtk npx vitest run tests/unit/app tests/unit/features/game tests/unit/features/persistence tests/component/appLifecycle` passes.

- [x] 3.2 Navigation intents; the UI stops changing route and sheet directly
    - **Implements:** GS "A new deal asks first during a game in progress" and "Pause and resume", AS "Navigation between the two screens" and "Continue game on Home", SH "Escape and the backdrop close a sheet" (the state half: `closeSheet` never closes Win); *KS-GEN-02/04*, *KS-DEAL-08*.
    - **Files:**
      - new `src/features/game/navigationThunks.ts` (`dealNewGame`, `requestNewDeal`, `restartDeal`, `goHome`, `openSheet`, `closeSheet`, `pause`, `resume`);
      - `HomeScreen.tsx`, `GameScreen.tsx` (Back) and `useGameShortcuts.ts` (Esc closes through `closeSheet`) use them;
      - `eslint.config.js`: a `src/ui/**` block bans importing `setRoute`, `sheetOpened` and `sheetClosed` with `@typescript-eslint/no-restricted-imports` — a rule distinct from the `no-restricted-imports` of the purity overrides, so flat-config precedence does not replace the pure-board override for the modules both blocks match (D3);
      - new `tests/unit/repo/eslintRules.test.ts`;
      - `src/app/selectors.ts` gains `selectRoute` (moved from `appSlice.ts`) and a new `selectSheet`; `selectBusy`, `selectEpoch` and `selectCurrentGame` move beside `src/features/game/gameSlice.ts`, which also gains `selectGameControlsIdle` (named in D3: false while `game.busy` or `app.dealing` is non-null, used by the HUD New deal control and Time in 5.5 and 5.7); update every importer (folded quality work, behaviour-neutral; existing suites stay green — D15);
      - `tests/e2e/{smoke,frame}.spec.ts` only if Home's or Game's dispatch wiring changes an observable name or structure they assert on;
      - `src/features/README.md`.
    - **Tests:**
      - `tests/unit/features/game/navigation.test.ts` covers:
        - `requestNewDeal` opens `newDeal` for a started game and deals at once for an unstarted, won or missing game (the selected mode is used when there is no game);
        - `restartDeal` closes the sheet and reinstalls the same seed;
        - `goHome` keeps the game resumable, and closes any open sheet, Win included;
        - `pause` is refused on Home, with no game, or with a won game;
        - `pause` and `requestNewDeal` do nothing while `game.busy` (a safe-card chain or Finish is running) or while `app.dealing` is non-null (a deal is being prepared) (B1, B2);
        - the clock does not accrue while `newDeal` is open;
        - `resume` closes `paused`;
        - `closeSheet` closes any open sheet except `win`, which it leaves open.
      - `tests/unit/features/game/gameSlice.test.ts` covers `selectGameControlsIdle`: false while `game.busy` or `app.dealing` is non-null, true otherwise.
      - `tests/component/gameShortcuts.test.tsx`: Esc through `useGameShortcuts` with `win` open leaves it open.
      - `tests/unit/repo/eslintRules.test.ts`, through ESLint's Node API (`calculateConfigForFile`): a pure board module (`src/ui/board/layout.ts`) still has its purity `no-restricted-imports` restriction, and a UI component (`src/ui/screens/GameScreen.tsx`) has the route and sheet ban under `@typescript-eslint/no-restricted-imports`.
      - `tests/unit/app/selectors.test.ts` covers `selectSheet`; the moved selectors keep their tests (`tests/unit/features/game/gameSlice.test.ts`).
      - Traceability: `navigation.test.ts` also names GS "Starting a game installs a fresh deal" and "Restart replays the same deal".

      `appShell` and `gameFrame` stay green.
    - **Verify:** `rtk npx vitest run tests/unit/features/game tests/unit/app tests/unit/repo tests/component && rtk npm run lint` passes. This task changes navigation dispatch wiring reachable from Home and Game, so also run the full `rtk npm run e2e` (see Conventions).
    - **Size note.** This task now carries the navigation thunks, the sequence/dealing guards, the eslint rule and its test, and the folded selector move. If it does not fit a single ~128k planning session, split it along that last seam: land the selector move (`selectRoute`/`selectSheet` and the game selectors beside `gameSlice`) as the first half, then the navigation thunks and guards as the second, keeping both inside this task number as 3.2a/3.2b rather than opening a new group (D15).

- [x] 3.3 Play a deal code
    - **Implements:** GS "Dealing from a deal code"; *KS-DEAL-09*, *KS-DEAL-01/02*.
    - **Files:** `src/features/game/navigationThunks.ts` (`playDealCode`), `src/features/README.md`.
    - **Tests:** `tests/unit/features/game/dealCode.test.ts` covers:
      - a valid code installs exactly `dealFromSeed(seed, mode)` (determinism: same code twice → same tableau and stock), with route `game`, provenance `random` and `dailyKey` null;
      - an invalid code returns `{ ok: false }` and changes no state;
      - an in-flight `startGame` result is discarded, and its dealing progress ends (`dealingEnded`), so `dealing` is null and the input gate reopens;
      - an unfinished started game breaks its streak;
      - a `D-…` code never records a Daily completion on win.
    - **Verify:** `rtk npx vitest run tests/unit/features/game` passes.

- [x] 3.4 Win summary
    - **Implements:** IN "Win summary"; *KS-SCO-04*, *KS-STA-02*.
    - **Files:**
      - `src/features/interaction/{interactionSlice.ts,selectors.ts}` (`win`, `winRecorded`, `selectWinSummary`, cleared on `installed` and `cleared`);
      - `src/features/game/gameThunks.ts` (`commitCommand` reads the previous best before `won`);
      - new `src/features/game/sessionThunks.ts` (`startGame`, `restart`, `continueGame`, the `latestStart` guard, `breakStreakOf`), split out of `gameThunks.ts`; update every importer in `src/` and `tests/` (this runs after 3.2, so the moved `navigationThunks` imports move too) (folded quality work, behaviour-neutral; existing suites stay green — D15);
      - `src/features/README.md`.
    - **Tests:**
      - the existing `startRestart`, `continueGame` and `play` suites stay green with the moved imports;
      - `tests/unit/features/interaction/winSummary.test.ts` covers:
        - the first win is a new best;
        - a slower win is not;
        - a strictly faster one is;
        - an equal time is not;
        - the Standard time bonus is present and Vegas has none;
        - the summary is cleared by a new deal;
        - it is never in the encoded record (`encodeRecord` output).
    - **Verify:** `rtk npx vitest run tests/unit/features` passes.

- [x] 3.5 Notices and the announcer at the app level; update-ready and code-copied
    - **Implements:** NT "Transient notices", "Update-ready notice" and "One polite announcer", GM "Notices host and announcer are part of the frame", HO "Home links, install offer and footer" (storage notices visible on Home); *KS-PER-03*, *KS-PWA-03* (the UI part), *KS-A11Y-02*.
    - **Files:**
      - `src/app/appSlice.ts` (`NoticeId` gains `code-copied` and `update-ready`);
      - `Notices.tsx` (a kind/text/actions table; Update calls an `onUpdate` prop);
      - `App.tsx` mounts `Notices` and the polite `Announcer` as siblings of the screen, outside the subtree that task 4.2 wraps in the inert `.app-screen` (D2, D7);
      - `GameScreen.tsx` drops both;
      - `tests/component/gameFrame.test.tsx`: the frame-order assertion (the list with `'notices'`, around L83–92) no longer lists the announcer and notices inside `.screen--game`;
      - `tests/e2e/{smoke,frame}.spec.ts` only if the App/Home/Game structure they assert on changes;
      - `tests/unit/features/persistence/resetThunks.test.ts` (the assertion moved from 3.1: reset-all dismisses `storage-read`, `storage-read-only` and `storage-write` but does not dismiss `update-ready` or `code-copied`);
      - `src/i18n/locales/{en,uk}.ts` (the new notice texts);
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/component/notices.test.tsx` covers:
        - a storage notice shows on Home;
        - `code-copied` disappears after 3.2 s (fake timers);
        - `update-ready` stays until Later, and Later dismisses it;
        - the `update-ready` warning text shows when `persistence.readOnly` or `persistence.lastError === 'write'` (B4);
        - `update-ready` does not take focus, is announced politely, and has a no-motion path;
        - Update calls the handler;
        - both buttons work by keyboard;
        - Update and Later each have a hit area of at least 44×44 (I8);
        - the text is in `uk` when that locale is set.
      - `tests/component/announcer.test.tsx`: the announcer is mounted once by `App`, on Home and on Game, and a return to the Game screen does not replay earlier announcements.
      - `tests/unit/features/persistence/resetThunks.test.ts` (moved from 3.1): reset-all does not dismiss `update-ready` or `code-copied` notices.
    - **Verify:** `rtk npx vitest run tests/component/notices tests/component/announcer tests/component/gameFrame tests/component/appShell tests/unit/features/persistence` passes. This task changes the App composition (notices and announcer move to `App`), so also run the full `rtk npm run e2e` (see Conventions).

## 4. Sheet host

- [x] 4.1 Surface tokens and the control and sheet styles
    - **Implements:** D13; SH "One modal sheet at a time" (looks, no-motion path); *KS-SET-03*, *KS-A11Y-03*.
    - **Files:**
      - `src/ui/styles/tokens.css`: the new roles in light, dark and night sets;
      - new `src/ui/styles/{controls.css,sheets.css}`;
      - `global.css` imports them;
      - new `tests/support/css.ts` (rule body, declarations, custom properties, `@media` blocks), replacing the four private parsers that `tests/unit/ui/{tokens,layoutCss,boardCss,hudCss}.test.ts` each define today (folded quality work, behaviour-neutral; existing suites stay green — D15);
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/unit/ui/tokens.test.ts`: the new tokens exist in both themes;
      - `tests/unit/ui/contrast.test.ts`: the new text/surface pairs reach 4.5:1 in light and dark;
      - new `tests/unit/ui/sheetsCss.test.ts`: `sheet-in` and the control transitions have `:root[data-motion='off']` overrides, and no stylesheet uses `prefers-reduced-motion`;
      - new `tests/unit/support/css.test.ts` covers the rule lookup, a nested `@media` block and custom-property reads.
    - **Verify:** `rtk npx vitest run tests/unit/ui tests/unit/support` passes.

- [x] 4.2 `ModalSheet` and `SheetHost`
    - **Implements:** SH "One modal sheet at a time", "Sheet focus is trapped and returned", "Escape and the backdrop close a sheet" and "Sheet text follows the language at once"; *KS-GEN-02*, *KS-A11Y-03*.
    - **Files:**
      - new `src/ui/sheets/{ModalSheet.tsx,SheetHost.tsx}`;
      - `App.tsx` (the host, plus `inert` on `.app-screen` while a sheet is open; `.app-screen` wraps only the current screen, so the `Notices` host and the `Announcer` mounted by 3.5 stay outside it and keep working while a sheet is open);
      - the screen headings get `tabIndex={-1}`;
      - `src/i18n/locales/{en,uk}.ts` (the Close name);
      - `tests/e2e/{smoke,frame}.spec.ts` only if mounting the sheet host or the heading `tabIndex` changes the names or structure they assert on;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/modalSheet.test.tsx`, using a test sheet, covers:
      - `role="dialog"`, `aria-modal`, and a name from the heading;
      - the initial focus;
      - Tab and Shift+Tab wrap;
      - focus returns to the opener, or to the heading when the opener is gone;
      - the opener is the element that was focused when the sheet opened; when it is disconnected, hidden or disabled at close, focus goes to the screen heading instead (I5);
      - Escape and a scrim click dismiss;
      - `dismissable={false}` ignores both;
      - the screen is `inert`, and the notices host and the announcer are not inside the inert subtree;
      - a game shortcut (H) does nothing while open;
      - Escape does not also clear a board selection.
    - **Verify:** `rtk npx vitest run tests/component/modalSheet` passes. This task changes the App composition (the sheet host mounts in `App`), so also run the full `rtk npm run e2e` (see Conventions).

## 5. Sheets and the Game controls that open them

- [x] 5.1 Settings: Appearance and Play
    - **Implements:** SH "Settings sheet" (Appearance and Play groups); *KS-SET-01/02/03/04/05*.
    - **Files:**
      - new `src/ui/sheets/SettingsSheet.tsx`;
      - new `src/ui/components/{SettingRow,Switch,Segmented,Swatches}.tsx`;
      - `controls.css`;
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/sheets/settings.test.tsx` covers:
      - every control changes its preference at once;
      - switches have role `switch` with `aria-checked` and a name;
      - the segmented control and the swatches are radio groups with arrow keys;
      - the group headings are present;
      - the theme applies to `<html data-theme>` through the running theme controller (wiring render);
      - initial focus lands on the Theme control when the sheet opens (I5).
    - **Verify:** `rtk npx vitest run tests/component/sheets/settings` passes.

- [x] 5.2 Settings: Language and Data
    - **Implements:**
      - SH "Settings sheet" (Language, Data) and "Sheet text follows the language at once";
      - LO "Switching language applies at once and is remembered" and "Adding a language needs one catalog and one registration" (the Settings side);
      - ST "Reset statistics clears every statistic", PE "Reset all local data restores defaults"; *KS-I18N-01/03*, *KS-STA-05*, *KS-PER-05*.
    - **Files:**
      - `SettingsSheet.tsx`;
      - new `src/ui/components/ConfirmAction.tsx` (inline confirm and cancel);
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/sheets/settings.test.tsx` covers:
      - the Language options come from the registry;
      - with the registry replaced by a module mock (`vi.mock` of `src/i18n/catalog.ts`) that adds a third language, the Language control lists it by its own name, with no component change;
      - choosing Українська re-renders the open sheet's heading and rows;
      - each reset asks first, Cancel keeps the data, and Confirm clears it, and focus returns to that Reset control after either Confirm or Cancel (I5);
      - reset-all shows Home with the defaults and the browser language, and removes the record and the backup through the injected gateway.
    - **Verify:** `rtk npx vitest run tests/component/sheets` passes. (The visual-parity shot of screen 10 is taken in 6.1, once Home can open Settings.)

- [x] 5.3 How to play
    - **Implements:** SH "How to play sheet"; *KS-GEN-02*, *KS-INP-08* (documented keys).
    - **Files:**
      - new `src/ui/sheets/HelpSheet.tsx`;
      - `sheets.css` (rule cards, keys table);
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/sheets/help.test.tsx` covers:
      - four rules;
      - a keys table that lists Tap/Click, Drag, Double-click, Space, Ctrl+Z/Ctrl+Y, H, A, N, P and Esc;
      - the Standard and Vegas scoring summary;
      - initial focus lands on "Got it" when the sheet opens (I5);
      - "Got it" closes the sheet and returns focus.
    - **Verify:** `rtk npx vitest run tests/component/sheets/help` passes. (The visual-parity shot of screen 11 is taken in 6.3, once Home can open How to play.)

- [x] 5.4 Statistics and the overall record selector
    - **Implements:** SH "Statistics sheet", ST "Overall record" and "Reset statistics clears every statistic"; *KS-STA-01…05*.
    - **Files:**
      - `src/features/stats/statsSlice.ts` (`selectOverallStats`);
      - new `src/features/stats/statsThunks.ts` (`todayKey(): AppThunk<string>`, returning `utcDayKey(extra.today())`; D8);
      - new `src/ui/useToday.ts`, which dispatches `todayKey()` to get the UTC day key from the injected clock;
      - new `src/ui/sheets/StatsSheet.tsx`;
      - `src/app/thunkExtra.ts`: `defaultThunkExtra` takes the clock for its lazy deal service (`createDealService({ now })`) instead of the service reading its own `new Date()`;
      - `src/app/store.ts`: `createAppStore` builds the merged extra (`{ ...defaultThunkExtra(…), ...deps }`) and hands the default deal service a lazy clock `() => extra.today()` that closes over that final merged object, so an injected `today` is the one read when a Daily deal is requested;
      - `src/app/lifecycle.tsx` only if its store creation needs the same change (folded quality work, behaviour-neutral; existing suites stay green — D15);
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/features/README.md`, `src/ui/README.md`.
    - **Tests:**
      - `tests/unit/features/stats/overall.test.ts`: sums, win rate rounding, none at 0 played, max current and max best streak;
      - `tests/unit/features/stats/todayKey.test.ts`: `todayKey()` returns the UTC day key of the injected `today` (an instant of 04:30 UTC on 20 September, which is 23:30 on 19 September in UTC−5, gives the key for 20 September);
      - `tests/unit/app/thunkExtra.test.ts`: a `today` injected through `createAppStore({ deps: { today } })` drives the Daily day key that the default (lazy) deal service uses, and is read at call time, not when the store is built; an injected `dealService` is used as given;
      - `tests/component/sheets/stats.test.tsx`: 4 mode columns, "—" for missing, the Vegas best as `$`, the Daily streak, the local-only note, and a Reset that needs confirmation; initial focus lands on Close when the sheet opens, and focus returns to the Reset control after Confirm or Cancel (I5).
    - **Verify:** `rtk npx vitest run tests/unit/features/stats tests/unit/app tests/component/sheets/stats` passes.

- [x] 5.5 New deal options, the HUD New deal control and N
    - **Implements:** SH "New deal options sheet", GM "New deal control in the HUD", BK "Shortcuts" (N); *KS-DEAL-08*, *KS-INP-08*, *KS-A11Y-04*.
    - **Files:**
      - new `src/ui/sheets/NewDealSheet.tsx`;
      - `Hud.tsx` (the face button with its caption in the reserved `.game-face`, and a 44×44 hit area on coarse pointers);
      - `useGameShortcuts.ts`: N is handled before the input-gate check (D3) and acts only on the Game route, while not dealing and with no sheet open, through `requestNewDeal()`; the board-move shortcuts keep the gate;
      - `tests/component/gameShortcuts.test.tsx`, where the dispatch-count spy (L131–146) is replaced by outcome assertions (folded quality work, behaviour-neutral; existing suites stay green — D15);
      - `tests/component/gameFrame.test.tsx`: the `.game-face` part of "keeps the reserved regions in both profiles, empty" is rewritten — the face now holds the New deal button and loses `aria-hidden`;
      - `tests/e2e/frame.spec.ts` extended to measure a ≥44×44 hit area on coarse pointers for the HUD New deal control;
      - `docs/spec/specification.md` §4.8 note (N bound);
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/component/sheets/newDeal.test.tsx`: the streak warning, Restart re-deals the same code, New deal uses the same mode, Cancel changes nothing, choosing New deal sets that mode's current streak to 0, and initial focus lands on Cancel when the sheet opens (I5, never the destructive Restart);
      - `gameShortcuts`: N on an unstarted game deals at once; N on a started game opens `newDeal`; N during the cascade of a won game (before the Win sheet opens) deals a new game at once; N while dealing or with a sheet open does nothing; N with auto-repeat is ignored; N does nothing while a sequence runs (B1); N on a Ukrainian layout (`code: 'KeyN'`) still deals or opens the sheet;
      - the HUD New deal button is disabled while a sequence runs or a deal is prepared;
      - `layoutCss`: the `.game-face` size pins are unchanged;
      - traceability: `tests/unit/features/game/navigation.test.ts` (3.2) and this task's `gameShortcuts`/`newDeal` tests together cover GS "Starting a game installs a fresh deal" and "Restart replays the same deal".
      - `gameFrame`: the rewritten `.game-face` part of "keeps the reserved regions in both profiles, empty" now finds the New deal button, with no `aria-hidden`.
    - **Verify:** `rtk npx vitest run tests/component && rtk npx playwright test --project=device-fit` passes.

- [x] 5.6 Deal code display and copy (Game footer)
    - **Implements:** GM "Deal code footer", NT "Transient notices" (code-copied); *KS-DEAL-02*.
    - **Files:**
      - new `src/ui/components/DealCode.tsx`;
      - new `tests/support/clipboard.ts`;
      - new `src/features/interaction/announcements.ts` (a `codeCopied` announcement descriptor);
      - `src/ui/announce.ts` (its wording, through `t`);
      - `src/features/interaction/` gains a `dealCodeCopied()` thunk that raises the `code-copied` notice and the announcement together (D14); `DealCode.tsx` dispatches it after a successful copy;
      - `GameScreen.tsx` (the reserved footer holds the code and the build stamp);
      - `layout.css` if needed without changing sizes;
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/features/README.md`, `src/ui/README.md`.
    - **Tests:**
      - `tests/component/dealCode.test.tsx` covers:
        - it shows `Deal 1-XXXXXXX` for the current game;
        - activating it by click and by Enter dispatches `dealCodeCopied()`, which copies the encoded code, raises `code-copied` and announces it;
        - with the clipboard rejected, the code text is selected.
      - new `tests/unit/features/interaction/dealCodeCopied.test.ts` covers the thunk raising both the `code-copied` notice and the announcement.
    - **Verify:** `rtk npx vitest run tests/component/dealCode tests/unit/features/interaction && rtk npx playwright test --project=device-fit` passes.

- [x] 5.7 Paused, Time tap and P
    - **Implements:** SH "Paused sheet", GM "HUD values and the Time control" (Time pauses) and "The board is hidden while paused", BK "Shortcuts" (P); *KS-SCO-07*, *KS-INP-08*.
    - **Files:**
      - new `src/ui/sheets/PausedSheet.tsx` (reuses `DealCode`);
      - `Hud.tsx` (Time as a button with a name that includes the time);
      - `GameScreen.tsx` (`data-paused`);
      - `layout.css` (one visibility rule);
      - `useGameShortcuts.ts`: P is handled before the input-gate check (D3): it pauses through `pause()` when no sheet is open, resumes when the open sheet is `paused`, and is ignored while any other sheet is open;
      - `tests/e2e/frame.spec.ts` extended to measure a ≥44×44 hit area on coarse pointers for the Time control (the top-bar Settings and theme buttons are measured in 7.1);
      - `docs/spec/specification.md` §4.8 note (P bound);
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/sheets/paused.test.tsx` covers:
      - Time by click and by Enter pauses;
      - P pauses and resumes;
      - P with Settings open does nothing, and P on a won game does not pause;
      - P and Time do nothing while a sequence runs or a deal is prepared (B1, B2): Time is disabled but keeps its name, and Time is disabled on a won game;
      - P on a Ukrainian layout (`code: 'KeyP'`) still pauses and resumes;
      - initial focus lands on Resume when the sheet opens (I5);
      - P pressed with nothing focused: closing the sheet by Resume returns focus to the Game screen's heading;
      - P pressed while a card is focused: closing the sheet by Resume returns focus to that same card;
      - the board is hidden and out of the accessibility tree;
      - the time is frozen across ticks (injected clock);
      - Resume, Escape, the scrim and P resume;
      - the deal code is shown, and activating its copy control while the sheet is open raises `code-copied` and is announced (I8).
    - **Verify:** `rtk npx vitest run tests/component` passes.

- [x] 5.8 Win sheet and its timing
    - **Implements:** SH "Win sheet", WC "The Win sheet follows the cascade" and "Input is ignored during the cascade"; *KS-GEN-02*, *KS-SET-04*.
    - **Files:**
      - new `src/ui/sheets/WinSheet.tsx`;
      - new `src/ui/board/useWinSheet.ts`, mounted beside `useCascade`;
      - new `src/ui/board/dom.ts` (`cardElement(root, id)`), replacing the four lookups in `useBoardActions`, `useBoardPointer`, `cascade` and `animations` (folded quality work, behaviour-neutral; existing suites stay green — D15). Describe `dom.ts` in the bold-name form in `src/ui/README.md`;
      - `sheets.css` (`.outcome-*`, `.best-badge`);
      - `visualParity.spec.ts` (screen `13-win-sheet`);
      - `tests/e2e/playBy{Tap,Drag,Keyboard}.spec.ts`, whose end assertions change now that the fixture win ends on the Win sheet;
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md` (bold-name form for the hook).
    - **Tests:** `tests/component/sheets/win.test.tsx` covers:
      - it opens 2,400 ms after the win (fake timers), and at once with reduced motion;
      - it is not opened when a new deal replaces the game first;
      - it is not opened after Back to Home, and not opened after the game is cleared (B3);
      - a sheet opened during the cascade (for example Settings) is replaced by the Win sheet once it opens (B3);
      - the tiles and the bonus line;
      - Vegas shows the Bank in the Score tile and no bonus line (B3);
      - the badge only on a new best;
      - Deal again and Menu;
      - no close button, and Escape and the scrim are ignored — Escape is pressed with the full `GameScreen` rendered (so `useGameShortcuts` and the sheet both see it) and the Win sheet stays open;
      - focus lands on Deal again;
      - the board component suites that exercise `useBoardActions`, `useBoardPointer`, `cascade` and `animations` stay green against `dom.ts`'s `cardElement`.
    - **Verify:** `rtk npx vitest run tests/component/sheets/win tests/component/cascade tests/unit/ui && rtk npx playwright test playByTap playByDrag playByKeyboard visualParity --project=chromium` passes (the fixture win now ends on the Win sheet in all three input paths).
    - **Size note.** This task now carries the Win sheet, `useWinSheet`, the folded `dom.ts`, and updates to all three `playBy*` specs. If it does not fit a single ~128k planning session, split it along that last seam: land `dom.ts` and its four call-site swaps first (behaviour-neutral, existing suites stay green), then the Win sheet and `useWinSheet` with their own tests, keeping both halves inside this task number rather than opening a new group (D15).

- [x] 5.9 Play a deal code sheet
    - **Implements:** SH "Play a deal code sheet"; *KS-DEAL-09*.
    - **Files:** new `src/ui/sheets/DealCodeSheet.tsx`, `src/i18n/locales/{en,uk}.ts`, `src/ui/README.md`.
    - **Tests:** `tests/component/sheets/dealCode.test.tsx` covers:
      - a labelled input;
      - initial focus lands in the input when the sheet opens (I5);
      - an invalid code shows an inline error through `aria-describedby`, starts no game, and keeps focus in the input;
      - typing in the input never triggers a game shortcut;
      - a valid code (lower case, with spaces) starts that deal on the Game screen.
    - **Verify:** `rtk npx vitest run tests/component/sheets/dealCode` passes.

- [x] 5.10 About sheet
    - **Implements:** SH "About sheet", AS "Build identification"; *KS-GEN-02*, *KS-PWA-04*.
    - **Files:**
      - new `src/ui/sheets/AboutSheet.tsx`, which reads `__APP_VERSION__` behind the same `typeof … === 'string'` guard that `src/ui/components/BuildStamp.tsx` uses for `__APP_BUILD_TIMESTAMP__` (falling back to a dev label), so `vitest.config.ts` needs no define;
      - `vite.config.ts` (the `__APP_VERSION__` define from `package.json`);
      - `src/vite-env.d.ts`;
      - `tests/unit/repo/configContract.test.ts`;
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/sheets/about.test.tsx` checks the name, the version (the dev fallback under Vitest) and build stamp, the source and licence links (`<a href>` to `https://github.com/sanyokkua/solitaire…`, with `rel="noopener noreferrer"`) and the privacy line, and that initial focus lands on Close when the sheet opens (I5). `configContract` checks the define.
    - **Verify:** `rtk npx vitest run tests/component/sheets/about tests/unit/repo` passes.

## 6. Home

- [x] 6.1 Home top bar and hero
    - **Implements:** HO "Home top bar" and "Home hero"; *KS-SET-01/02*, *KS-SET-04*.
    - **Files:**
      - `src/ui/screens/HomeScreen.tsx` split into `src/ui/screens/home/{HomeTopbar,HomeHero}.tsx`;
      - new `src/ui/components/ThemeToggle.tsx`;
      - new `src/ui/styles/home.css` (`.topbar`, `.home-hero`, wordmark, `.hero-fan` float, `.dither`);
      - `tests/unit/ui/sheetsCss.test.ts` extended to `home.css` motion-off overrides;
      - `tests/e2e/visualParity.spec.ts` (screen `10-settings-sheet`, opened with the Home top bar's Settings button);
      - `tests/e2e/{smoke,frame}.spec.ts` only if the Home split into `HomeTopbar`/`HomeHero` changes the names or structure they assert on;
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/home/hero.test.tsx` covers:
      - the theme toggle's name describes the action and it switches light/dark (from System, the opposite of what is shown);
      - Settings opens its sheet and focus returns;
      - the hero has the badge with its live dot, the wordmark and five fan cards; the dot and the fan are hidden from assistive technology;
      - `data-motion='off'` stops the float (CSS test).
    - **Verify:** `rtk npx vitest run tests/component/home tests/unit/ui && rtk npx playwright test visualParity --project=chromium` passes.

- [x] 6.2 Mode tiles and the Winnable switch
    - **Implements:** HO "Mode choice" and "Winnable deals only switch"; *KS-DEAL-03*, *KS-DEAL-05*, *KS-STA-03*.
    - **Files:** new `src/ui/screens/home/{ModeTiles,WinnableToggle}.tsx`, `home.css`, `src/i18n/locales/{en,uk}.ts`, `src/ui/README.md`.
    - **Tests:** `tests/component/home/modes.test.tsx` covers:
      - a radio group with four named tiles, arrow keys and click select, and the selection is remembered;
      - best time or "No record yet";
      - the Daily tile shows today's UTC day and date from the injected clock (through `useToday`), in en and uk;
      - the switch is role `switch`, remembered, and disabled and reports off for Draw 3 and Vegas, with a caption explaining those deals are not checked by the solver, while keeping the stored value;
      - the switch is also disabled and reports on for Daily, with a caption explaining that Daily deals are always winnable, while keeping the stored value (I6, I8).
    - **Verify:** `rtk npx vitest run tests/component/home` passes.

- [x] 6.3 Home actions, record strip, links and footer
    - **Implements:** HO "Home actions", "Home record strip", "Home links, install offer and footer" and "Home fits every size and text follows the language", AS "Continue game on Home"; *KS-GEN-09*, *KS-PER-02*.
    - **Files:**
      - new `src/ui/screens/home/{HomeActions,RecordStrip,HomeLinks}.tsx`;
      - `home.css` (the sticky `.cta-row` at `max-width: 720px` or `max-height: 720px` above the safe area);
      - `App.tsx` (build stamp placement);
      - new `tests/e2e/home.spec.ts`;
      - `visualParity.spec.ts` (screens `01-home-light-desktop`, `02-home-dark-phone`, and `11-how-to-play-sheet`, opened with the Home How to play button);
      - `tests/e2e/{smoke,frame}.spec.ts` only if the new Home actions/record-strip/links structure changes the names or structure they assert on;
      - `src/i18n/locales/{en,uk}.ts`;
      - `README.md` feature list;
      - `src/ui/README.md`.
    - **Tests:**
      - `tests/component/home/actions.test.tsx`: Deal cards starts the selected mode and shows Game, Continue appears only when resumable, How to play and each link open their sheet, the record strip formats (`007`, `43%`, `--`, `3/5`), and Continue is at least 44×44 on coarse pointers and localised (I8);
      - `home.spec.ts` (all projects): at the HO "Home actions" viewports 874×350, 390×844 and 1280×720, plus 360×780, Deal cards and Continue lie within the viewport and clear of the safe area without scrolling; add 320×480 and 2560×1440, and check the hero stacks correctly at 390×844 (I8).
    - **Verify:** `rtk npx vitest run tests/component/home && rtk npx playwright test home visualParity` passes.

## 7. Game chrome

- [x] 7.1 Game top bar actions, mode and deal chips
    - **Implements:** GM "Game top bar actions", "Mode and deal chips" and "Two chrome profiles", RF "In-browser deal latency is reported" (KS-DEAL-03, the Winnable setting used for the deal, is shown to the player by the deal chip built here); *KS-DEAL-06*, *KS-A11Y-04*.
    - **Files:**
      - new `src/ui/components/{ModeChip,DealChip}.tsx`;
      - `GameScreen.tsx` (chips in the reserved chip slot; `ThemeToggle` and Settings after it; Settings beside Back in the rails);
      - `layout.css` (icon-only deal chip at ≤460 px, ellipsis, `text-transform: uppercase` on the mode chip as in the mockup, no size change);
      - `tests/component/gameFrame.test.tsx` (the chip-slot part of "keeps the reserved regions in both profiles, empty" is rewritten to the filled chip slot; the `.game-face` and `.game-hint` parts are rewritten by 5.5 and 7.2);
      - `tests/e2e/{smoke,frame}.spec.ts` only if the chip slot, `ThemeToggle` or Settings placement changes the names or structure they assert on; `frame.spec.ts` extended to measure a ≥44×44 hit area on coarse pointers for the top-bar Settings and theme buttons;
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/chips.test.tsx` covers:
      - the mode chip text and accessible name in normal case — "Draw 1 · Standard", "Vegas", and "Daily · Sep 19" for a Daily game whose `dailyKey` is 19 September — in en and uk (the date is the game's, not today's);
      - "Winnable · 3 shuffles" / "Winnable" / "Random deal";
      - the accessible name keeps the full text when only the icon shows;
      - a Daily game started from a `D-…` code, whose `dailyKey` is `null`, shows the chip "Daily" with no date (B5);
      - the theme toggle is hidden in the side rails, and focus returns to Settings there (I6, I8).

      The `layoutCss` test checks the mode chip's `text-transform: uppercase`.

      `gameFrame` also checks that Settings opens its sheet in both profiles.
    - **Verify:** `rtk npx vitest run tests/component tests/unit/ui && rtk npx playwright test --project=device-fit` passes.

- [x] 7.2 Hint line: tap-mode text and key chips
    - **Implements:** GM "The hint line shows the hint"; *KS-AST-02*, *KS-INP-08*.
    - **Files:**
      - new `src/ui/components/HintLine.tsx`;
      - `GameScreen.tsx`;
      - `layout.css` (`.hint-keys` hidden at ≤460 px and on coarse pointers);
      - `tests/component/gameFrame.test.tsx` (the `.game-hint` part of "keeps the reserved regions in both profiles, empty" is rewritten, now that the hint line always shows tap-mode text instead of being empty);
      - `src/i18n/locales/{en,uk}.ts`;
      - `src/ui/README.md`.
    - **Tests:** `tests/component/hintLine.test.tsx` covers:
      - the smart and select texts;
      - key chips only with a fine pointer (`matchMedia` stub);
      - a hint replaces the text and the text returns after it clears;
      - the uk text.

      `gameFrame`'s rewritten `.game-hint` part checks the tap-mode text instead of an empty region.
    - **Verify:** `rtk npx vitest run tests/component/hintLine tests/component/gameFrame && rtk npx playwright test --project=device-fit` passes.

- [x] 7.3 Dealing overlay
    - **Implements:** GM "The Game screen keeps its name and dealing status"; *KS-DEAL-04*, *KS-SET-04*.
    - **Files:** new `src/ui/components/DealingOverlay.tsx`, `GameScreen.tsx`, `board.css` (the spinner stops under `data-motion='off'`), `src/i18n/locales/{en,uk}.ts`, `src/ui/README.md`.
    - **Tests:** `tests/component/dealingOverlay.test.tsx` covers:
      - hidden until `dealing.overlay` is set, then "Shuffling a winnable deal…" with the attempt counter;
      - the status is still announced;
      - the previous table stays underneath.

      The CSS test covers the motion-off rule.
    - **Verify:** `rtk npx vitest run tests/component/dealingOverlay tests/unit/ui` passes.

- [x] 7.4 Longer strings and Ukrainian on the device matrix
    - **Implements:** LO "Longer strings never clip or overlap" and "All player-facing text in English and Ukrainian" (the pseudo-locale proof that no text is outside the catalogs), RF "Longer strings are checked on the device matrix" and "Test suites separated by execution layer" (the device-fit project isolates this layer), GM "Two chrome profiles" (the fit is unchanged); *KS-I18N-01*, *KS-I18N-04*.
    - **Files:**
      - new `tests/support/pseudoLocale.ts` (a +30 %, accented, bracketed catalog from `en`);
      - new `tests/component/pseudoLocale.test.tsx`;
      - new `tests/e2e/pseudoLocale.spec.ts` (device-fit project, an init script pads text by 30 %);
      - `tests/e2e/deviceFit.spec.ts` (a `uk` pass seeded through the record);
      - `playwright.config.ts`: the device-fit `testMatch` covers both specs, and the `testIgnore` of the six other projects excludes both (today they ignore only `DEVICE_FIT_SPEC`);
      - `tests/unit/repo/playwrightProjects.test.ts`: the expectations that `testMatch` and every other project's `testIgnore` equal `DEVICE_FIT_SPEC` change to the two-spec pattern;
      - `tests/README.md`.
    - **Tests:**
      - the component test renders Home, Game and every sheet with the pseudo catalog and finds no untranslated English literal;
      - the e2e specs check no horizontal overflow in the chips, HUD, toolbar, hint line, Home actions or sheet rows, and the Deal cards bar stays visible;
      - the e2e specs also check the sheet height cap (≤88% of the viewport) with the body scrolling, at 320×480 (I8).
    - **Verify:** `rtk npx vitest run tests/component/pseudoLocale tests/unit/repo && rtk npx playwright test --project=device-fit` passes, and `rtk npm run e2e` still runs neither spec outside the device-fit project.

- [x] 7.5 Phase 7 documentation alignment
    - **Implements:** constitution principle 9 for groups 2–7.
    - **Files:**
      - `AGENTS.md` (repository state and layout: `src/i18n` implemented, sheets, Home);
      - `docs/spec/phased-design.md`: Phase 7 status, §3.1 (the real `ui/sheets`, `ui/screens/home` and `i18n` files), §3.3 (the `win` summary and the notice ids), the features → i18n dependency, and the stale "Phase 6 … not yet archived" line;
      - `src/i18n/README.md` (how to add a language).
    - **Tests:** none (docs only).
    - **Verify:** every path cited in the edited sections exists (`rtk grep` each), and `rtk npm run format:check` passes.

## 8. PWA

- [x] 8.1 Plugin, manifest, icons and head tags
    - **Implements:** PW "The app is installable" and "The first load never waits for the offline cache", RF "No third-party runtime hosts"; *KS-PWA-02/04*, *KS-PERF-03*.
    - **Files:**
      - `package.json` (`vite-plugin-pwa` 1.3.0 dev, `workbox-window` runtime, pinned exactly);
      - `vite.config.ts` (D9 settings);
      - new `public/manifest.webmanifest`;
      - new `scripts/generate-icons.mjs` and `public/icons/*`, `public/favicon.svg`;
      - `index.html` (manifest, theme-color light and dark, icons, description);
      - `src/vite-env.d.ts` (`vite-plugin-pwa/client` types);
      - `tests/unit/repo/configContract.test.ts`.
    - **Tests:**
      - new `tests/unit/repo/icons.test.ts`: regenerated bytes equal the committed files, and the PNG sizes are 180, 192, 512, and 512 maskable;
      - `configContract`: prompt mode, `injectRegister: false`, `manifest: false`, the glob patterns, the navigate fallback, no runtime caching;
      - `tests/unit/repo/manifest.test.ts`: `start_url` and `scope` are `/solitaire/`, `standalone`, and the icons exist.
    - **Verify:** `rtk npm run build` produces `dist/sw.js` and `dist/manifest.webmanifest`, and the unit tests pass.

- [x] 8.2 PWA and install gateways; offline layer boundary
    - **Implements:** PW "Updates apply only when the player chooses, after saving" and "Install app is offered only when the browser offers installation", AS "The localisation and offline layers keep their boundaries" (pwa half); *KS-PWA-02/03*.
    - **Files:**
      - new `src/pwa/{registerPwa.ts,pwaGateway.ts,installGateway.ts}`;
      - `tests/unit/repo/layerBoundaries.test.ts`: `src/pwa` imports nothing from `features` or `ui`; no file in `src/features` or `src/ui` imports `src/pwa/*`; `src/pwa/registerPwa.ts` is the only importer of `virtual:pwa-register`; and only `main.tsx` imports `registerPwa`. `eslint.config.js` is not touched for this boundary: a new block for the same rule would replace the existing features solver ban and the ui route/sheet ban in flat config (D3), so the test above enforces it instead;
      - `src/pwa/README.md`.
    - **Tests:** `tests/unit/pwa/{pwaGateway,installGateway}.test.ts` with a fake `register` and a fake window:
      - need-refresh notifies;
      - `applyUpdate` calls `updateSW(true)`;
      - `beforeinstallprompt` is prevented and stored;
      - `prompt()` resolves accepted or dismissed, and `unavailable` with no event;
      - `appinstalled` clears the availability.
    - **Verify:** `rtk npx vitest run tests/unit/pwa tests/unit/repo` passes.

- [x] 8.3 Lifecycle wiring, PWA thunks and the Install link
    - **Implements:** PW "Updates apply only when the player chooses, after saving" and "Install app is offered only when the browser offers installation", NT "Update-ready notice", HO "Home links, install offer and footer" (Install), RF "End-to-end tests do not use service workers unless they opt in" (the default block, which must land with the task that starts registration); *KS-PWA-02/03*.
    - **Files:**
      - new `src/app/pwaThunks.ts` (`applyUpdate`, `installApp`);
      - `src/app/{appSlice.ts,thunkExtra.ts,lifecycle.tsx}` (`installable`, the `pwa` port, the gateway subscriptions);
      - `src/main.tsx` (registers after `load`);
      - `Notices.tsx` (Update → `applyUpdate`);
      - `HomeLinks.tsx`;
      - `src/i18n/locales/{en,uk}.ts` (the Install app name);
      - `playwright.config.ts` (`use.serviceWorkers: 'block'`), so no existing spec sees the worker that this task starts registering;
      - `tests/unit/repo/playwrightProjects.test.ts` (asserts `use.serviceWorkers` is `'block'`);
      - `README.md` (offline and install);
      - the `src/app` notes in `src/features/README.md`.
    - **Tests:**
      - `tests/unit/app/pwaThunks.test.ts`: `flush` runs before `applyUpdate` (call order through fakes); `installApp` clears `installable` after the prompt resolves; with read-only persistence, Update still applies even though the flush writes nothing (B4); when the writer's flush fails, `pwa.applyUpdate()` still runs (I2);
      - `appLifecycle.wiring`: a need-refresh raises `update-ready`, and install availability shows and hides the Install link. This test injects the storage gateway per `validate:lifecycle-storage` (see Conventions);
      - a `main.tsx`/registration test with a fake `window`: the service worker registers only after `load`, never before (I8);
      - `tests/component/home/actions.test.tsx`: Install is absent while `installable` is false; the Install link activates by Enter and has a localised name (I8);
      - `playwrightProjects`: service workers are blocked by default.
    - **Verify:** `rtk npx vitest run tests/unit/app tests/unit/repo tests/component/appLifecycle tests/component/home` passes, and the full `rtk npm run e2e` stays green.

- [x] 8.4 Offline cold start end to end
    - **Implements:** RF "End-to-end tests do not use service workers unless they opt in" (the opt-in), "Offline and update behaviour proven end to end" and "Test suites separated by execution layer" (the Chromium-only PWA spec is its own suite), PW "Fully playable offline after one online visit" and "No third-party hosts at runtime" (the origin scenario, per I3); *KS-PWA-01*.
    - **Files:**
      - new `tests/e2e/pwa.spec.ts` (Chromium only; it opts in with `test.use({ serviceWorkers: 'allow' })` over the default block set in 8.3);
      - `tests/unit/repo/playwrightProjects.test.ts` (the Chromium-only list);
      - `tests/README.md`.
    - **Tests:** `pwa.spec.ts` "offline cold start":
      1. visit online and wait for the controller;
      2. go offline and open a new page;
      3. Home renders with its fonts;
      4. a Winnable Draw 1 deals through the worker;
      5. one move plays;
      6. the Settings sheet opens.

      A second case: while offline, reload on the Game screen, then use Continue from Home, proving deep navigation survives a cold start. Both cases record every page request with `page.on('request')` and assert each is same-origin (I3, I8).
    - **Verify:** `rtk npx playwright test pwa --project=chromium` passes, and the full `rtk npm run e2e` stays green.

- [x] 8.5 Update flow end to end
    - **Implements:** PW "Updates apply only when the player chooses, after saving"; *KS-PWA-03*.
    - **Files:** `tests/e2e/pwa.spec.ts`, new `tests/e2e/support/distServer.ts`, `tests/README.md`.
    - **Tests:** "update after saving":
      1. start a game and make moves;
      2. serve a changed `sw.js` and call `registration.update()`. `context.route` cannot be used: Playwright routes the worker's first script fetch but never its update check (tried with `registration.update()`, a reload and a new page). The test therefore starts a test-owned Node HTTP server (`support/distServer.ts`) that serves `dist/` under `/solitaire/` on its own port and appends a comment to `sw.js` each time `changeWorker()` is called, and uses it as the page's origin. Before this step the test reloads until `navigator.serviceWorker.controller` is set, because a new worker only waits behind a controlled page (on the first, uncontrolled visit it activates at once and no notice is raised);
      3. the Update notice appears;
      4. Later hides it, and a changed worker found again (another `changeWorker()` and `registration.update()`) does not bring the notice back for the rest of the session;
      5. reload the page (a new session; the changed worker is still waiting), the notice is offered again, and choose Update;
      6. after the reload the game's moves and time are restored.

      This task states, rather than asserts, that choosing Later and reaching the next cold start runs the new version: that is the Workbox default (`cleanupOutdatedCaches` plus the waiting worker activating on the next navigation with no controlled clients), not a behaviour this app adds, so it is not exercised by a dedicated test case.

      The component-level fake-gateway proof (the earlier D12 fallback) was not needed.
    - **Verify:** `rtk npx playwright test pwa --project=chromium` passes.

## 9. Delivery, CI and accessibility

- [x] 9.1 Artifact validation joins `validate`
    - **Implements:** RF "The built artifact is validated", "Single aggregate validation gate" and "No third-party runtime hosts", PW "No third-party hosts at runtime"; *KS-PWA-04*, *KS-GEN-01*.
    - **Files:**
      - new `scripts/validate-artifact.mjs`, which exports its checks. The third-party check inspects only the references the app loads (D11 check 4): HTML `src`/`href` including every `<link>` (anchors excluded), CSS `url()` and `@import`, the manifest's `start_url`, `scope` and `icons[].src`, the precache entries and `importScripts` of `sw.js`, and the string arguments of `import()`, `new Worker(…)`, `new URL(…, import.meta.url)` and `importScripts(…)` in built scripts. Plain URL text is not inspected;
      - `package.json` (`validate:artifact`; `validate` ends with `build && validate:artifact`);
      - new `tests/fixtures/dist/*` mini trees;
      - `AGENTS.md` (commands list and the `validate` definition, removing "`validate:artifact` does not exist yet");
      - `tests/README.md`.
    - **Tests:** `tests/unit/repo/validateArtifact.test.ts` checks that each of the four checks passes on a good tree and fails on its broken fixture:
      - a local reference outside `/solitaire/`;
      - the manifest scope or a missing icon;
      - the worker chunk missing from the precache;
      - a third-party load: one fixture each for an HTML `<script src="https://…">`, a CSS `url(https://…)` and a script `new Worker('https://…')`.

      The good tree also proves what is accepted: a script holding an XML namespace string (`http://www.w3.org/1998/Math/MathML`) and a library error-documentation URL string (for example `https://react.dev/errors/…`), and an `<a href="https://github.com/sanyokkua/solitaire">`.
    - **Verify:** `rtk npm run validate` passes end to end.

- [x] 9.2 Deploy workflow builds once
    - **Implements:** RF "Deployment to GitHub Pages from the default branch".
    - **Files:** `.github/workflows/pages.yml` (drop the second build and deploy the validated `dist`), and `.github/workflows/ci.yml` only if an action version is outdated. Check the latest action versions online before editing (AGENTS.md).
    - **Tests:** `tests/unit/repo/configContract.test.ts` checks that `pages.yml` runs `validate` once and has no separate `npm run build` step.
    - **Verify:** `rtk npx vitest run tests/unit/repo` passes.

- [x] 9.3 Accessibility scan
    - **Implements:** RF "Accessibility scan" and "Test suites separated by execution layer" (the Chromium-only a11y project is its own suite); *KS-A11Y-01/03*, *KS-SET-03*.
    - **Files:**
      - `package.json` (`@axe-core/playwright`, pinned);
      - new `tests/e2e/a11y.spec.ts` (Chromium only);
      - `playwrightProjects.test.ts`;
      - `tests/README.md`.
    - **Tests:** axe runs on Home, Game and each of the eight sheets, in light and dark, and fails on `serious` or `critical`.
    - **Verify:** `rtk npx playwright test a11y --project=chromium` passes.

- [x] 9.4 Phase 8 documentation alignment
    - **Implements:** constitution principle 9 for group 8–9.
    - **Files:**
      - `AGENTS.md` (repository state: Phases 7–8 complete; `public/` exists; `src/pwa` implemented; service workers blocked in e2e by default);
      - `docs/spec/phased-design.md` (Phase 8 status, §6 CI with `validate:artifact`, §3.1 `public/` and `pwa/`);
      - `src/pwa/README.md`.
    - **Tests:** none (docs only).
    - **Verify:** every cited path exists, and `rtk npm run format:check` passes.

## 10. Integration checks

- [x] 10.1 Full verification run
    - **Implements:** the integration of every group.
    - **Checks:**
      - run `rtk npm run validate`;
      - run the full `rtk npm run e2e` (all seven projects);
      - look over the visual-parity screenshots for screens 01, 02, 10, 11 and 13 against `docs/spec/mockup/screens/`, and record any accepted differences in `tests/README.md`.
    - **Verify:** both commands exit 0, and the screenshot review is recorded.

- [x] 10.2 Lighthouse manual check
    - **Implements:** RF "Performance and installability are checked manually and recorded"; *KS-PERF-03*, *KS-PWA-02*.
    - **Files:** `tests/README.md` (the procedure and the recorded result).
    - **Procedure:** `rtk npm run build && rtk npm run preview`, then Lighthouse mobile emulation on `/solitaire/`. Record the installability and the performance score (target ≥ 90) with the date and the browser version.
    - **Verify:** the result is recorded. If the score is below 90, stop and surface it rather than lowering the bar.

- [x] 10.3 Independent final review
    - **Implements:** AGENTS.md "Sub-agent driven workflow".
    - **Checks:** a fresh-context reviewer compares the whole diff with the delta specs, `design.md` and the AGENTS.md Architecture and Engineering principles:
      - no UI imports of route or sheet actions;
      - no English literals outside `locales/en.ts`;
      - every animation has a no-motion path;
      - no storage change.
    - **Verify:** there are no open Blocking or Important findings, and the fixes are committed after `rtk npm run validate`.
