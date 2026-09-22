# Internationalisation layer

Typed English/Ukrainian catalogs. Lands in Phase 7 — Screens, sheets & localisation.

- `catalog.ts` — registry of locales
- `translate.ts` — translation lookup
- `useTranslate.ts` — translation hook, consumed by `src/ui`
- `localeController.ts` — active-locale state
- `locales/en.ts` — English catalog; defines the translation key type
- `locales/uk.ts` — Ukrainian catalog

Adding a language is one new file under `locales/` plus a registry entry — no other layer changes.
