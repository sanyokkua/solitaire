import { en } from './locales/en';
import { uk } from './locales/uk';
import type { Catalog } from './translate';

/** One entry per supported language: its own display name and its catalog. */
export interface LocaleEntry {
    readonly name: string;
    readonly catalog: Catalog;
}

/**
 * The registry of supported languages, in the order Settings lists them (KS-I18N-03). Adding a language is one new
 * `locales/<code>.ts` file plus one entry here — no screen or component change.
 */
export const CATALOGS = {
    en: { name: 'English', catalog: en },
    uk: { name: 'Українська', catalog: uk },
} as const satisfies Readonly<Record<string, LocaleEntry>>;

/** A supported language code. */
export type Locale = keyof typeof CATALOGS;

/** Every supported language code, in registry order. */
export const SUPPORTED_LOCALES: readonly Locale[] = Object.keys(CATALOGS) as Locale[];
