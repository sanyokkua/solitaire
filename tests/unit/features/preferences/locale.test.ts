import { describe, expect, it } from 'vitest';
import { resolveLocale, SUPPORTED_LOCALES } from '../../../../src/features/preferences/locale';

describe('resolveLocale', () => {
    it('supports English and Ukrainian', () => {
        expect(SUPPORTED_LOCALES).toEqual(['en', 'uk']);
    });

    it.each([
        [['uk-UA', 'en-US'], 'uk'],
        [['de-DE', 'fr-FR'], 'en'],
        [['EN-gb'], 'en'],
        [['UK-ua'], 'uk'],
        [[], 'en'],
        [['fr', 'uk', 'en'], 'uk'],
        [['de', 'en', 'uk'], 'en'],
        [[''], 'en'],
        [['', 'uk'], 'uk'],
        [['-uk'], 'en'],
        [['uk-'], 'uk'],
        [['uk-Cyrl-UA'], 'uk'],
        [['en-US-x-private', 'uk'], 'en'],
        [['ukr', 'en'], 'en'],
        [['uk_UA'], 'en'],
        [['ukrainian', 'uk'], 'uk'],
    ] as const)('%j resolves to %s', (languages, expected) => {
        expect(resolveLocale(languages)).toBe(expected);
    });
});
