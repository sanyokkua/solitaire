# Internationalisation layer

Typed English/Ukrainian catalogs (Phase 7 — Screens, sheets & localisation).

- `translate.ts` — `Catalog`, `Message` (a string with `{name}` placeholders, or a plural object keyed by CLDR
  category), `TranslateParams` and `Translate`; `createTranslator(locale, catalog, fallback)` returns a `t(key,
params?)` that selects the plural form of a counted message with a cached `Intl.PluralRules(locale)` from
  `params.count`, fills `{name}` placeholders, and falls back to `fallback`'s message (English, in production) for a
  key `catalog` does not have; a key present in neither returns unchanged, as a last resort that never throws.
  `formatDate(locale, date, options?)` formats a UTC calendar date in `locale`'s words, the same regardless of the
  environment's time zone (the Daily chip and tile). Depends on nothing outside this file.
- `catalog.ts` — `CATALOGS` (the registry: one entry per language, its own display name and its catalog),
  `Locale` (`keyof typeof CATALOGS`) and `SUPPORTED_LOCALES`. `src/features/preferences/locale.ts` re-exports
  `Locale`/`SUPPORTED_LOCALES` from here, so `recordCodec.ts`'s stored-locale check and the Settings Language
  control (Phase 7) follow the registry automatically. Adding a language is one `locales/<code>.ts` file plus one
  entry here.
- `useTranslate.ts` — `useTranslate()`, the only React-aware i18n module: reads `state.preferences.locale`
  through `react-redux`'s `useSelector` directly (not `src/app/hooks`, to keep the layer boundary) and returns a
  `t` memoised on the active locale, built with `createTranslator` from `catalog.ts`'s registry.
- `localeController.ts` — `createLocaleController(store, root)`, modelled on `src/app/themeController.ts`: sets
  `root.lang` and `document.title` (to that locale's `app.title` message) at construction and on every store
  change where the locale differs from the one last applied, and does nothing further after `dispose()`. Takes a
  narrow `{ getState, subscribe }` store, so it needs no `src/app` import. `src/app/lifecycle.tsx`'s `startApp`
  creates and disposes it alongside the theme controller.
- `locales/en.ts` — the English catalog, `as const satisfies Catalog`; exports `MessageKey = keyof typeof en`, the
  typed source of every translation key. Holds every string the UI shows: card and pile names, the announcer and hint sentences,
  the notices, and the Game, Home and sheet text.
- `locales/uk.ts` — the Ukrainian catalog, typed `Record<MessageKey, Message>`, so a key missing from it fails
  `typecheck` (proved by `tests/unit/i18n/catalogCompleteness.test-d.ts`).

## How to add a language

1. Create `locales/<code>.ts` exporting a catalog typed `Record<MessageKey, Message>` (import `MessageKey` and the
   `Message` type from `./en` and `../translate`), as `uk.ts` does. A key missing from it fails `typecheck`
   (`tests/unit/i18n/catalogCompleteness.test-d.ts`). Give plural messages the categories of
   `Intl.PluralRules('<code>')` (Ukrainian: `one`, `few`, `many`, `other`; a category the language lacks fails
   `tests/unit/i18n/catalog.test.ts`).
2. Register it in `CATALOGS` in `catalog.ts` with the language's own display name (`{ name: 'Polski', catalog: pl }`).
   Registry order is the order Settings lists.
3. Nothing else changes: `Locale` and `SUPPORTED_LOCALES` derive from the registry, the Settings Language control
   renders one option per registry entry, and the stored-locale check in `recordCodec.ts` follows it. A locale not
   in the registry is rejected when a saved record is decoded.
4. Run `rtk npm run validate`. `catalog.test.ts` checks every registered catalog for every English key, non-empty
   messages and valid plural categories.

`SUPPORTED_LOCALES` also drives first-run detection: `resolveLocale` in `src/features/preferences/locale.ts` picks the
first browser-preferred language whose primary subtag is registered (`uk-UA` selects `uk`), else English. A newly
registered language therefore becomes the first-run language for browsers that prefer it.

`src/i18n` imports nothing from `src/app`, `src/features` or `src/ui`; `useTranslate.ts` is the only file that may
import `react` or `react-redux` (`tests/unit/repo/layerBoundaries.test.ts` enforces both).
