export type Locale = 'en' | 'uk';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'uk'];

const isLocale = (value: string): value is Locale => (SUPPORTED_LOCALES as readonly string[]).includes(value);

/**
 * The first-run language: the first browser-preferred language whose primary subtag is supported (`uk-UA` selects
 * `uk`), otherwise English. Pure and deterministic.
 */
export function resolveLocale(languages: readonly string[]): Locale {
    for (const language of languages) {
        const primary = language.split('-', 1).join('').toLowerCase();
        if (isLocale(primary)) {
            return primary;
        }
    }
    return 'en';
}
