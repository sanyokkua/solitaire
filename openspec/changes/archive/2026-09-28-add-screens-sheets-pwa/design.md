# Design

## Context

A design document is warranted. The change crosses `src/i18n` ↔ `src/features` ↔ `src/app` ↔ `src/ui` ↔ `src/pwa`, it introduces two layers that were reserved until now, it adds build-time and runtime dependencies (the PWA plugin, workbox-window and axe), and it replaces an application-shell guard. There is **no storage change** (see Migration Plan).

The current state was verified against the code, and it shapes the approach:

- **Sheets and notices exist only as state.**
  - `app.sheet: SheetId | null` holds at most one of `settings | help | stats | newDeal | paused | win | dealCode | about`, and nothing renders it.
  - `selectClockEligible` (`features/game/clock.ts`) already stops the clock while any sheet is open, and `selectInputEnabled` already closes the board gate. So pausing needs no game-state change.
  - `Notices` is mounted only in `GameScreen`, which means storage notices raised at start-up never show on Home.
  - Its English `TEXT` table is built at import time.
- **Navigation is split.**
  - `HomeScreen.tsx` (a 36-line stub) dispatches `startGame` and then `setRoute('game')` itself.
  - `continueGame` is a thunk that sets the route.
  - `useGameShortcuts` has N and P stubbed.
  - `selectRoute` lives in `appSlice.ts`; there is no `selectSheet`.
- **Unreachable features.**
  - `resetAllLocalData(writer, languages)` and `resetStatistics` are dispatched only by tests. The writer and `navigator.languages` exist only inside `startApp`.
  - `ThunkExtra.today` is never read. `lazyDealService` builds `createDealService()` without it, so the Daily deal reads its own `new Date()`.
  - `encodeDealCode` and `decodeDealCode` (`domain/dealCode.ts`, modes `1`/`3`/`V`/`D`) have no caller.
  - `selectModeStats`, `selectWinRate` and `selectDailyStreak` are unused.
- **Strings.**
  - About 75 English literals are spread across `HomeScreen`, `GameScreen`, `Hud`, `Toolbar`, `Notices`, `BuildStamp`, `announce.ts` and `board/names.ts`.
  - `announce.ts` and `names.ts` build "1 card"/"N cards" and change case by string munging, which cannot express Ukrainian one/few/many forms.
  - `index.html` hard-codes `lang="en"`, and `themeController` never sets it.
- **Reserved layers.** `src/i18n` and `src/pwa` hold only a README. `tests/unit/repo/reservedLayers.test.ts` and the application-shell requirement "Layers reserved for later phases carry no behaviour" enforce that.
- **Reserved regions (table-rendering D1).** Phase 5 reserved the chip slot, the 2.9rem `.game-face`, a one-line hint line and the footer at mockup sizes so the device-fit matrix would not change. `gameFrame.test.tsx` asserts that they are empty.
- **Tooling.**
  - There is no `public/` directory and no PWA plugin.
  - `index.html` has no manifest, theme-color or icons.
  - `pages.yml` runs `validate` (which builds) and then builds again.
  - Playwright runs the production build in seven projects, and service workers are not configured.
- **Tests.** About 30 files repeat `createAppStore({ preloadedState, deps: { dealService: fakeDealService(), … } })` plus `<Provider>`. Four CSS static tests each define their own rule parser.
- **Mockup (visual authority).** The mockup-to-code map is in the table below.

  | Surface | Mockup reference |
  | --- | --- |
  | Home | `.topbar`, `.home-hero`, `.hero-fan`, `.dither`, `.mode-row`/`.mode-card`, `.toggle-card`, `.cta-row` with its sticky rule at `max-width:720px` or `max-height:720px`, `.stat-strip`, `.footlinks`, `.build-stamp` |
  | Game | `.diff-chip`, `.deal-chip`, `.game-face`, `.game-hint`/`.hint-keys`, `.deal-overlay` |
  | Sheets | `.modal-layer`, `.modal-sheet`, `sheet-in` 180 ms, `.setting-row`, `.segmented`, `.switch`, `.swatch`, `.help-rule`, `.keys-table`, `.stats-table`, `.outcome-sheet`, `.best-badge` |
  | Notices | `.notices` |

  Screens `01`, `02`, `10`, `11` and `13` are the targets. The mockup has **no** Paused, New deal options, deal-code entry, real About, deal-code footer, install, update or storage notice, and no Ukrainian.

## Goals / Non-Goals

**Goals:**

- Every Phase 7 and Phase 8 surface matches the mockup's look. Where the mockup is silent, surfaces are built from its tokens and components.
- Every string comes from a typed catalog. Adding a language touches no component.
- The UI only dispatches intents and renders snapshots (constitution 3). No component sets the route or opens a sheet directly.
- Every new animation has a no-motion path through `data-motion='off'` (constitution 6).
- The whole app works offline after one online visit, and updates only when the player chooses, after the game has been saved.
- Quality work on touched code changes no behaviour and lands inside the feature task that edits the same code (D15).

**Non-Goals:**

- A storage schema change, or salvaging data from other keys.
- A router or URLs per screen: the route stays a Redux enum.
- Runtime caching of anything outside the precache, background sync, or push.
- An i18n, dialog or icon library.
- Refactoring `useBoardPointer`'s large effect or adding a board-geometry context. Both were considered and left alone: they work, end-to-end tests prove them, and this change does not touch them.

## Decisions

### D1 — The typed English catalog defines the keys; one file per language plus a registry

- **Catalog shape.**
  - `src/i18n/locales/en.ts` exports `en`: a flat object with dotted keys (`'home.deal'`, `'sheet.stats.title'`, `'card.rank.12'`), written `as const satisfies Catalog`.
  - `MessageKey = keyof typeof en`.
  - A message is either a string with `{name}` placeholders or a plural object `{ one?, few?, many?, other }`.
  - `locales/uk.ts` is typed `Record<MessageKey, Message>`, so a missing Ukrainian key fails the type check.
- **Registry.**
  - `src/i18n/catalog.ts` holds `CATALOGS = { en: { name: 'English', catalog: en }, uk: { name: 'Українська', catalog: uk } }`, plus `Locale = keyof typeof CATALOGS` and `SUPPORTED_LOCALES`.
  - `features/preferences/locale.ts` re-exports `Locale` and `SUPPORTED_LOCALES` from the registry. The session codec and `resolveLocale` therefore follow it, and the Settings Language control is built from it.
  - Adding a language means one file and one registry line (I18N-03).
- **Translator.**
  - `translate.ts` exports `createTranslator(locale): Translate`, where `t(key, params?)` works as follows:
    - it picks the plural form with a cached `Intl.PluralRules(locale)` from `params.count`, falling back to `other`;
    - it fills `{x}` placeholders;
    - it falls back to English for a missing key, as defence in depth.
  - It also exports `formatDate`, which uses a UTC `Intl.DateTimeFormat` for the Daily chip and tile.
- **React binding and document effects.**
  - `useTranslate.ts` is the only React-aware i18n file. It reads `preferences.locale` and returns a memoised `t`.
  - `localeController.ts` follows `themeController`'s shape: a narrow `{ getState, subscribe }` store and a `root` element. It sets `<html lang>` and `document.title` at start and on every change. `startApp` creates it.
- **Formatters take `t`.**
  - `board/names.ts` becomes `cardName(t, id, up)` and `pileLabel(t, ref, count)`.
  - `announce.ts` becomes `formatAnnouncement(t, item)` and `hintText(t, hint)`.
  - Notice text is looked up at render time.
  - The case munging and hand-built plurals are deleted.
  - Card names are composed from per-rank and per-suit keys (`card.rank.12`, `card.suit.0`) through a per-language template key `card.name` (en `'{rank} of {suit}'`, uk `'{rank} {suit}'`), so word order is set per language without 52 phrases. Ukrainian sentences are written to avoid grammatical case (for example "Підказка: {card} → {place}").
  - `names.ts` stays a pure board module. The ESLint purity override and `boardPurity` allow a **type-only** import of `Translate`.
- **Unchanged and test-only parts.**
  - `format.ts` (zero-padded numbers, `$` bank, `m:ss`) is language-neutral and stays as it is.
  - The pseudo-locale is test-only (D16).
  - Component tests run in English: `testStore` preloads `locale: 'en'`.
- *Alternatives:*
  - i18next or FormatJS would add ~20–40 KB and a runtime for two languages, against KS-PERF-03.
  - Nested catalog objects give weaker key types than flat dotted keys.
  - Putting the locale in React context would split the source of truth from Redux.

### D2 — One `SheetHost`, one `ModalSheet`

- **Host.** `src/ui/sheets/SheetHost.tsx` is mounted once in `App`. It maps `SheetId` to a component and renders nothing when `sheet === null`.
- **Dialog.** `ModalSheet.tsx` renders a scrim (`.modal-layer`) and a panel (`.modal-sheet`, or `--wide` at 34rem). The panel has `role="dialog"`, `aria-modal="true"` and `aria-labelledby` pointing at its `h2`, plus a close button named "Close".
- **Focus.**
  - On open, initial focus goes to the sheet's `initialFocus` control: Settings its first control (Theme), How to play "Got it", Statistics and About Close, New deal options **Cancel** (never the destructive Restart), Paused Resume, Win Deal again, Play a deal code the input.
  - Tab and Shift+Tab wrap within the panel.
  - The "opener" is `document.activeElement` captured when the sheet opens — the previously focused card, control, or the document body, whichever had focus — so sheets opened by N, P or the Win timer need no special case. On close, once the screen is no longer inert and the sheet is no longer rendered, focus returns to the opener if it is still connected, visible and focusable (not disabled, not inside an inert subtree). Otherwise it goes to the current screen's heading, which carries `tabIndex={-1}`.
  - `ConfirmAction` returns focus to its Reset control after Confirm or Cancel. Reset all local data closes the sheet and goes Home, so focus lands on the Home heading through the rule above.
- **Dismissal.** Escape and a scrim click call `onDismiss` unless `dismissable={false}` (Win). Escape is stopped at the dialog.
- **Background.** While a sheet is open, `App` wraps the current screen in `.app-screen` with `inert`. The `Notices` host and the polite `Announcer` are mounted by `App` as siblings of `.app-screen`, outside the inert subtree (D7), so a notice's buttons stay operable and announcements (for example "Deal code copied" from the Paused sheet) are still spoken while a sheet is open.
- **Motion.** `sheet-in` lasts 180 ms. Under `:root[data-motion='off']` there is no animation.
- **Size.** The panel is centred at every size, with `max-height: 88dvh` and a scrolling body.
- *Alternative:* native `<dialog>.showModal()`. jsdom's support is partial, and `inert` plus a small trap gives the same behaviour with tests we control.

### D3 — Intent thunks own route and sheet changes

- **Session-thunk move (in task 3.4, D15).** `startGame`, `restart`, `continueGame`, the `latestStart` guard and `breakStreakOf` move from `gameThunks.ts` to `features/game/sessionThunks.ts`. This is a pure move.
- **New intent thunks** in `features/game/navigationThunks.ts`:
  - `dealNewGame(mode)` closes any sheet, shows the Game route and starts a game.
  - `requestNewDeal()` opens `newDeal` when the game is started and not won. Otherwise it deals the current mode at once, or the selected mode when there is no game.
  - `restartDeal()` closes the sheet and restarts.
  - `goHome()` closes any open sheet, Win included, and shows Home.
  - `openSheet(id)` and `closeSheet()`. `closeSheet()` refuses to close `win`: only Menu (`goHome()`) and Deal again (`dealNewGame(mode)`) leave the Win sheet, so an Escape that reaches `useGameShortcuts` cannot dismiss it.
  - `pause()` works only on the Game route with a started or unstarted game that is not won.
  - `resume()`.
  - **Sequence and dealing guard.** `pause()` and `requestNewDeal()` do nothing while `game.busy` (a safe-card chain or Finish is running) or while `app.dealing !== null` (a deal is being prepared). Sequences check only the epoch, not `app.sheet`, so without this guard Finish could keep moving cards, or even win, behind a Paused or New deal sheet, and a deal could install behind the Paused sheet. The HUD New deal button and Time are disabled in the same states (Time also on a won game), using a shared selector next to the thunks, `selectGameControlsIdle` (`src/features/game/`; false while `game.busy` or `app.dealing` is non-null).
  - `playDealCode(code)` (D5).
- **Enforcement.**
  - An ESLint rule bans `setRoute`, `sheetOpened` and `sheetClosed` in `src/ui/**`. It uses `@typescript-eslint/no-restricted-imports`, a rule distinct from the `no-restricted-imports` of the purity overrides: in flat config a later block's options for the same rule replace an earlier one's, so reusing `no-restricted-imports` would drop the pure-board restriction for the modules both blocks match. `tests/unit/repo/eslintRules.test.ts` checks both through ESLint's `calculateConfigForFile`.
  - `selectRoute` and a new `selectSheet` live in `app/selectors.ts`.
  - The game selectors misplaced there (`selectBusy`, `selectEpoch`, `selectCurrentGame`) move next to `gameSlice`.
  - The same pattern covers the i18n and pwa layer boundaries (D9): they are enforced by `tests/unit/repo/layerBoundaries.test.ts`, not by a new ESLint block, because a block matching the same files under `no-restricted-imports` would replace this one's options in flat config.
- **N and P bypass the input gate.** `useGameShortcuts` checks `selectInputEnabled` before its key switch, and that gate is closed on a won game and while any sheet is open, so N and P are handled before the gate check; the board-move shortcuts (undo, redo, hint, finish, draw, Escape on a selection) keep it.
  - **N** acts only on the Game route with no sheet open, and dispatches `requestNewDeal()` (which refuses while dealing or during a sequence). On a won game it therefore deals at once during the cascade, before the Win sheet opens; once that sheet is open N does nothing.
  - **P** dispatches `pause()` when no sheet is open (the thunk refuses Home, no game, a won game, a running sequence and a deal in preparation), `resume()` when the open sheet is `paused`, and is ignored while any other sheet is open.
- *Alternative:* keep the dispatch pairs in components. That duplicates flow logic across Home, HUD, keys and the Win sheet, and each copy can drift.

### D4 — Win summary in the command pipeline; the Win sheet follows the cascade

- **Why in the pipeline.** "New best time" cannot be derived after `won(...)` runs, because the stats reducer overwrites `bestTimeMs`.
- **Recording the summary.**
  - `commitCommand` reads the mode's previous best just before dispatching `won`.
  - It then dispatches `winRecorded({ mode, score, elapsedMs, moves, timeBonus, newBestTime })` into the runtime-only interaction slice (`win: WinSummary | null`).
  - The summary is cleared on `installed` and `cleared`.
  - `newBestTime` is true on the mode's first win, or when the time is strictly lower than the previous best.
- **Opening the sheet.**
  - `ui/board/useWinSheet.ts`, beside `useCascade`, opens `win` 2,400 ms after the current epoch becomes won (the mockup's timing). With reduced motion it opens at once.
  - The timer is cancelled on an epoch change or unmount (a new deal, a cleared game, or leaving the Game screen).
  - During the cascade Back to Home, New deal (HUD and N), Settings and the theme toggle stay live; Time and the board-move controls do not. If a sheet opened during the cascade (Settings) is showing when the timer fires, `win` replaces it: `app.sheet` holds one id, so `sheetOpened('win')` is the replacement.
- **Actions.** Deal again calls `dealNewGame(mode)`; Menu calls `goHome()`.
- *Alternative:* open the sheet from the thunk. The delay is a presentation detail tied to the cascade, so it belongs in the UI.

### D5 — Dealing from a code needs no solver

- `playDealCode(code)` trims the code, then calls `decodeDealCode`.
- If the code is invalid, the thunk returns `{ ok: false }` and changes nothing. The sheet shows an inline error linked with `aria-describedby` (DEAL-09).
- If the code is valid:
  - an unfinished started game breaks its streak;
  - the thunk installs `dealFromSeed(seed, mode)` with provenance `random` and 1 attempt, and `dailyKey: null`;
  - it shows the Game route.
- Consequences:
  - The epoch bump makes any in-flight `startGame` discard its result, through the existing guard. `playDealCode` also ends that start's dealing progress (`dealingEnded`), because the discarded start will never clear it, so `app.dealing` is null and the input gate reopens.
  - The chip reads "Random deal", because the code carries no verdict.
  - A `D-…` code plays with Daily's rules, but a null `dailyKey` means it never counts toward the Daily streak, and its mode chip reads plain "Daily" with no date.
- `DealRequest` is not changed.

### D6 — Pause is a sheet; the board is hidden while paused

- `pause()` opens `paused`. The clock stops through the existing eligibility check.
- `.screen--game[data-paused]` sets the board to `visibility: hidden`, which also removes it from the accessibility tree.
- The sheet shows the frozen time and a Resume button.
- Resume, Escape, the scrim and **P** resume. Time cannot resume: while the sheet is open the screen behind it, Time included, is inert (D2).
- Time becomes a button whose accessible name includes the time and the pause action. It is disabled, keeping its name, whenever `pause()` would refuse on the Game screen: a won game, a running sequence, or a deal in preparation (D3).

### D6a — Game top bar actions

- The mockup's Game top bar has the theme toggle and Settings after the chips; the side rails put Settings beside Back (`.rail-top`). A shared `ThemeToggle` and a Settings icon button are used on both screens.
- The chip slot keeps its height and takes the width left after these controls; chips truncate with the full text in their accessible name.
- The New deal face keeps its reserved visual size; where the pointer is coarse its hit area is extended to 44×44 px with padding or a pseudo-element, without changing layout (KS-A11Y-04).

### D7 — Notices at the app level, with persistent and action notices

- `Notices` and the polite `Announcer` move from `GameScreen` to `App`, outside the inert `.app-screen` subtree (D2), so notices show on Home and stay operable, and announcements are spoken, while a sheet is open. `Notices` keeps its current model: one message per notice id, shown together in one fixed region.
- `NoticeId` gains `code-copied` (transient, 3.2 s) and `update-ready` (persistent, with Update and Later).
- A table maps each id to `{ kind, textKey, actions? }`.
- The region stays bottom-right, inside the safe area, styled with the mockup's `.notice`.

### D8 — Ports in `ThunkExtra`, wired late where needed

- `ThunkExtra` gains:
  - `languages: () => readonly string[]`, defaulting to `navigator.languages`;
  - `saver: SavePort` (`{ flush(): void; cancel(): void }`);
  - `pwa: PwaPort` (`{ applyUpdate(): Promise<void>; promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> }`).
- `app/savePort.ts` provides a forwarding port. `startApp` creates it before the store and connects it to the writer once the writer exists. Before connection it does nothing.
- `resetAllLocalData()` becomes parameterless and reads `saver` and `languages` from the extra.
- **One source of today.**
  - `createAppStore` merges `{ ...defaultThunkExtra(…), ...deps }`, so a deal service built inside `defaultThunkExtra` from its own `today` would ignore an injected one. Instead the default lazy deal service takes a clock `() => extra.today()` that closes over the final merged `extra` object built in `store.ts` and is read only when a Daily deal is requested, so an injected `today` drives the Daily date.
  - The UI reads today the same way: `todayKey(): AppThunk<string>` in `features/stats/statsThunks.ts` returns `utcDayKey(extra.today())`, and `ui/useToday.ts` dispatches it (the Daily streak in Statistics and the Home Daily tile). The Daily mode chip shows the game's own `dailyKey`, not today.
- *Alternative:* a React context that exposes services to components. It would put flow logic back in components and bypass the thunk tests.

### D9 — PWA: vite-plugin-pwa in prompt mode behind gateways

- **Plugin configuration.** `vite.config.ts` adds `VitePWA` with:
  - `registerType: 'prompt'` and `injectRegister: false`;
  - `manifest: false`, because a reviewed manifest is committed at `public/manifest.webmanifest`;
  - Workbox `globPatterns: ['**/*.{js,css,html,woff2,ttf,png,svg,webmanifest}']`, which covers the solver worker chunk and both fonts;
  - `navigateFallback: 'index.html'` and `cleanupOutdatedCaches: true`;
  - no runtime caching;
  - `devOptions.enabled: false`.
- **Gateways in `src/pwa`.**
  - `registerPwa.ts` is the **only** importer of `virtual:pwa-register`, and only `main.tsx` imports it.
  - `pwaGateway.ts`: `createPwaGateway(register)` returns `{ onUpdateReady(cb), applyUpdate() }`, and `applyUpdate` calls `updateSW(true)`.
  - `installGateway.ts`: `createInstallGateway(win)` captures `beforeinstallprompt` (calling `preventDefault`) and listens for `appinstalled`. It exposes `onAvailabilityChange(cb)` and `prompt()`.
- **State and thunks.**
  - `app.installable: boolean` is the only new app state. A separate PWA slice is not needed.
  - `app/pwaThunks.ts`:
    - `applyUpdate()` calls `saver.flush()`, then `pwa.applyUpdate()` (PWA-03). When `persistence.readOnly` is set or `persistence.lastError === 'write'`, the flush cannot be relied on (read-only writes nothing; a failing write may fail again); the `update-ready` notice then shows its warning text (the current game will not be kept) instead of the plain text, and Update still applies;
    - `installApp()` prompts, then clears `installable`.
  - Later dismisses the notice for the session. The waiting worker activates on the next cold start (Workbox default).
- **Timing.** Registration runs after `load`, so it never delays the first render (PERF-03).
- **`index.html`** gains a manifest link, light and dark `theme-color`, `apple-touch-icon`, `icon` and `description`.
- **Versions.**
  - `vite-plugin-pwa` 1.3.0 is current and has a peer dependency on Vite `^8`.
  - `workbox-window` satisfies its `^7.4.1` peer.
  - Both are pinned exactly, like the other dependencies.

### D10 — Icons from a dependency-free script

- `scripts/generate-icons.mjs` draws the mockup's pixel-dot mark (three blocks: on-bg, primary, secondary) on the harbour background, as a pixel grid at an integer scale.
- It writes PNGs with `node:zlib`: 192, 512, maskable 512 (the mark inside the 80 % safe zone) and apple-touch 180. It also writes `favicon.svg`.
- The outputs are committed to `public/icons/`.
- `tests/unit/repo/icons.test.ts` regenerates the icons in memory and compares them byte for byte, which also checks the PNG sizes.
- *Alternative:* `@vite-pwa/assets-generator` or sharp. Both are native or heavy dependencies for four pixel-art files.

### D11 — Artifact validation joins `validate`

- `scripts/validate-artifact.mjs` checks `dist/`:
  1. every local `src`/`href` in `index.html` (anchors excluded) starts with `/solitaire/`;
  2. the manifest has `start_url` and `scope` equal to `/solitaire/`, `display: standalone`, and icons that exist, including a maskable one;
  3. `sw.js` exists, and its precache list includes `index.html`, `manifest.webmanifest`, every emitted JS file other than `sw.js` itself, every emitted CSS, font and icon file, and the solver worker chunk;
  4. no reference the app **loads** points to another origin. Only loads are inspected, each of which must be relative or under `/solitaire/`: HTML `src`/`href` including every `<link>`, CSS `url()` and `@import`, the manifest's `start_url`, `scope` and `icons[].src`, the precache entries and `importScripts` of `sw.js`, and the string arguments of `import()`, `new Worker(…)`, `new URL(…, import.meta.url)` and `importScripts(…)` in built scripts. Anchors (`<a href>`) are navigations, not loads, so About's links to `https://github.com/sanyokkua/solitaire` and its licence are allowed. Plain URL text is not a load either: the bundle legitimately contains XML namespace strings (`http://www.w3.org/1998/Math/MathML`, `http://www.w3.org/XML/1998/namespace`) and React/Redux error-documentation links, and a check over every `http(s)://` string would reject them.
- Its checks are exported and unit-tested against small fixture `dist` trees.
- `validate` becomes `… && build && validate:artifact`.
- `pages.yml` drops its second build.
- Action versions are checked online when the workflow is edited (AGENTS.md).

### D12 — Service workers blocked in end-to-end tests by default

- `playwright.config.ts` sets `use.serviceWorkers: 'block'`, so no existing spec sees caching or an update prompt.
- `tests/e2e/pwa.spec.ts` is Chromium only and opts in with `serviceWorkers: 'allow'`. It covers two flows.
- **Offline cold start:**
  1. Visit online and wait for the controller.
  2. Set the context offline.
  3. Open a new page on `/solitaire/`.
  4. Deal a Winnable Draw 1. The worker chunk comes from the precache.
  5. Play one move.
- **Update flow:**
  1. Serve a changed `sw.js` from a test-owned Node server (`tests/e2e/support/distServer.ts`, its own port) and call `registration.update()`. `context.route` does not intercept a worker's update fetch (Playwright 1.63, Chromium). The page must be controlled first (reload after the first activation), or the new worker activates without waiting.
  2. The Update notice appears.
  3. Click Update.
  4. The page reloads with the game restored.
- **Fallback (not needed).** Routing proved unreliable, so the update flow uses the test-owned server above instead; the component-level fake-gateway proof was not required.

### D13 — Tokens and styles

- **Tokens.** The `--color-*` naming stays. `tokens.css` gains the mockup roles these surfaces need, in the light, dark and night-card sets where relevant:
  - `--color-surface-1`, `--color-surface-variant`, `--color-on-surface-muted`, `--color-outline`, `--color-scrim`;
  - `--color-primary-container` / `--color-on-primary-container`, `--color-secondary`, `--color-tertiary` / `--color-on-tertiary`;
  - `--color-success`, `--color-success-container` / `--color-on-success-container`;
  - `--color-dither`, `--color-word-shadow-1/2`, `--color-card-ink(-muted)`, `--color-card-accent`;
  - `--shadow-md/lg`.
- **Stylesheets.** New `controls.css` (row, switch, segmented, swatch, action buttons including the pixel "Deal cards", `.sub-label`, `.kbd`, LCD tile), `sheets.css` and `home.css`. They keep `layout.css` (454 lines) from growing.
- **Reserved regions.** The game chrome fills them at their existing sizes. The `layoutCss` size pins stay, and the device-fit matrix re-runs.
- **Motion.** The fan float, `sheet-in` and the mode-tile lift get `data-motion='off'` overrides. The rule that forbids `prefers-reduced-motion` in stylesheets still holds.
- **Contrast.** `contrast.test.ts` extends to the new text-on-surface pairs, which must reach 4.5:1.

### D14 — Deal-code footer copy, and where the code shows when the footer is hidden

- `DealCode.tsx` shows `t('game.dealCode', { code })`.
- Activating it calls `navigator.clipboard.writeText`:
  - on success it dispatches `dealCodeCopied()` (`features/interaction`), which raises `code-copied` and the announcement together, from a `codeCopied` descriptor in `features/interaction/announcements.ts` (worded through `ui/announce.ts`'s `t`);
  - on rejection, or with no clipboard API, it selects the code text.
- The footer is hidden at 480 px wide or narrower and in the side rails (Phase 5 layout), so the Paused sheet also shows the code with the same copy control (`DealCode` reused). The layout does not change.
- This stays a DOM-only concern, with no port. Tests stub the clipboard in `tests/support/clipboard.ts`.

### D15 — Quality work and where it lands

This is the last change that modifies application code, so the duplication and casts the new work touches are fixed here. Only the shared test store is a task of its own (group 1), because every later task uses it. Every other item is behaviour-neutral and lands in the feature task that already edits the same code, keeping its own named test:

| Item | Task | Why there |
| --- | --- | --- |
| `tests/support/{renderWithStore.tsx,testStore.ts}`, duplicated set-ups migrated | 1.1, 1.2 | every later test uses it |
| a typed builder instead of the `sessionCodec.ts` double cast | 2.2 | edits the codec's locale check |
| `ui/board/style.ts` (typed `--x/--y` position style, five casts) | 2.4 | edits the same board views for names |
| `features/shared/timers.ts` (`globalTimers`, `SubscribableStore`) | 3.1 | edits `persistenceWriter` for `flush` |
| `selectRoute` to `app/selectors.ts`; `selectBusy`, `selectEpoch`, `selectCurrentGame` beside `gameSlice` | 3.2 | adds `selectSheet` and the navigation thunks |
| `sessionThunks.ts` split out of `gameThunks.ts` | 3.4 | edits `commitCommand` in `gameThunks.ts`; after 3.2, so `navigationThunks` imports move too |
| `tests/support/css.ts`, shared by the four CSS static tests | 4.1 | adds the first new CSS test |
| `today` wired into the deal service | 5.4 | adds `todayKey`, its consumer |
| `ui/board/dom.ts` (`cardElement`, four lookups) | 5.8 | adds `useWinSheet` beside `cascade.ts` |
| `gameShortcuts.test.tsx` asserts outcomes | 5.5 | binds N and rewrites the same test |

**Out of scope (see Non-Goals):** the rest.

### D16 — Pseudo-locale and the axe scan

- **Pseudo-locale.**
  - `tests/support/pseudoLocale.ts` derives a catalog from `en`: accented, padded to +30 %, and bracketed.
  - Component tests render every sheet and screen with it, to prove every string comes from the catalog.
  - The production bundle has no pseudo-locale. So `tests/e2e/pseudoLocale.spec.ts` (device-fit project) pads rendered text by 30 % with an init script before asserting that no checked element overflows, then runs the Home, Game and sheet cases.
- **Real Ukrainian.** `deviceFit.spec.ts` gains a `uk` pass.
- **axe.** `tests/e2e/a11y.spec.ts` (Chromium) runs `@axe-core/playwright` on Home, Game and each sheet, in light and dark. It fails on `serious` or `critical` findings.

### D17 — Dependencies

| Package | Kind | Version | Why |
| --- | --- | --- | --- |
| `vite-plugin-pwa` | dev | 1.3.0 | Build plugin (D9). |
| `workbox-window` | runtime | ≥ 7.4.1 | Used by `virtual:pwa-register` (D9). |
| `@axe-core/playwright` | dev | latest at install time, pinned | The axe scan (D16). |

No i18n, dialog or icon library is added.

### Defaults recorded for minor product choices

These defaults do not affect the architecture. Each can be changed later by editing one test and its component.

- The Home record-strip Streak shows the largest current streak across modes, and "/best" when a best exists (mockup).
- The first win in a mode shows "New best time".
- A game from a code shows "Random deal".
- A Daily code never counts toward the Daily streak.
- Later on the update notice dismisses it for the session.
- About links to `https://github.com/sanyokkua/solitaire` and its `LICENSE`.
- The Winnable switch is disabled for Daily too (Daily is always winnable, KS-DEAL-07), keeping the stored value.
- New deal options open with focus on Cancel; an inline reset returns focus to its Reset control.
- A Daily game from a code shows the chip "Daily" with no date.
- The Vegas Win sheet shows the Bank in the Score tile and no time-bonus line.

## Risks / Trade-offs

- **The change is large (Phases 7 and 8 together)** → Tasks are single-layer and dependency-ordered. Groups 1–7 (Phase 7) never depend on groups 8–9 (Phase 8), so the change can be split at that boundary if needed.
- **Filling the reserved regions could break the device fit, and Ukrainian chips are the likeliest overflow** → Chips truncate with an ellipsis and keep the full text in their accessible name. The device-fit matrix re-runs with `uk` and the pseudo-locale.
- **Service-worker behaviour in Playwright (routing `sw.js`, update detection) may be flaky** → Service workers are blocked by default. Only `pwa.spec.ts` opts in, and D12 records that the update test serves its own origin instead of routing `sw.js`.
- **The pseudo-locale init script can fight React's text updates** → It pads idempotently through a marker and runs only on settled screens. It measures clipping, while the catalog test covers completeness.
- **Ukrainian grammar in placeholder sentences** → Sentence patterns avoid case inflection. The author reviews the machine-drafted text (spec §11).
- **`inert` is only an attribute in jsdom** → Component tests assert the attribute, and the e2e and axe specs cover the behaviour.
- **Lighthouse is manual** → Its result is recorded in `tests/README.md`. Installability and offline behaviour are still proven automatically (validate:artifact and `pwa.spec.ts`).
- **Precache size delays first load** → Registration runs after `load`, and the precache is only the app shell, the worker and two fonts.

## Migration Plan

- **Storage.** The versioned `solitaire.local-state` record stays **v1**, and the codec is not changed.
  - `locale` is already stored and decoded defensively. Its allowed values now come from the registry, which still contains exactly `en` and `uk`, so every existing record decodes the same way.
  - The win summary, `installable` and the update state are runtime-only and never persisted.
- **Resets.**
  - Reset statistics writes the record normally.
  - Reset all local data keeps its Phase 4 behaviour: it cancels the pending save, removes the record and the `.unreadable` backup key through the gateway (the player asked for everything to go), and restores defaults with the browser language.
- **Updates.** Before a new service worker activates, the game is flushed through the save port. A player who chooses Later keeps the old version until the next cold start.
- **Deployment.** GitHub Pages under `/solitaire/` is unchanged. The first deploy with the service worker needs no migration, because no earlier worker exists.
- **Rollback.** Revert the change. A deployed worker is replaced by the next deploy's worker, and the plugin's generated `sw.js` cleans outdated caches.
