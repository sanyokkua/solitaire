import { describe, expect, it } from 'vitest';
import { CATALOGS, SUPPORTED_LOCALES, type Locale } from '../../../src/i18n/catalog';
import { en, type MessageKey } from '../../../src/i18n/locales/en';
import type { Message } from '../../../src/i18n/translate';
import { uk } from '../../../src/i18n/locales/uk';

const messageKeys = Object.keys(en) as MessageKey[];

describe('the language registry', () => {
    it('lists SUPPORTED_LOCALES as exactly the registry keys', () => {
        expect(SUPPORTED_LOCALES).toEqual(Object.keys(CATALOGS));
    });

    it.each(Object.entries(CATALOGS) as [Locale, (typeof CATALOGS)[Locale]][])(
        '%s provides every English key, with no empty message',
        (_locale, entry) => {
            for (const key of messageKeys) {
                const message: Message = entry.catalog[key];
                expect(message, key).toBeDefined();
                if (typeof message === 'string') {
                    expect(message.length, key).toBeGreaterThan(0);
                } else {
                    expect(
                        Object.values(message).some((text) => text.length > 0),
                        key,
                    ).toBe(true);
                }
            }
        },
    );

    it.each(Object.keys(CATALOGS) as Locale[])('%s plural messages use only its own plural categories', (locale) => {
        const categories = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
        const catalog = CATALOGS[locale].catalog;
        for (const key of messageKeys) {
            const message = catalog[key];
            if (typeof message === 'string') continue;
            for (const category of Object.keys(message)) {
                expect(categories.has(category as Intl.LDMLPluralRule), `${locale} ${key} ${category}`).toBe(true);
            }
        }
    });
});

describe('catalog completeness (type-level)', () => {
    it('has en and uk with the same key set', () => {
        expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort());
    });
});
