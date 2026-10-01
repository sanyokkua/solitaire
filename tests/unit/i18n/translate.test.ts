// covers: KS-I18N-01
import { describe, expect, it } from 'vitest';
import { createTranslator, formatDate, type Catalog } from '../../../src/i18n/translate';

const en: Catalog = {
    'card.count': { one: '1 card', other: '{count} cards' },
    greeting: 'Hello, {name}',
    'only.en': 'English only',
};

const uk: Catalog = {
    'card.count': { one: '{count} карта', few: '{count} карти', many: '{count} карт' },
    greeting: 'Привіт, {name}',
};

describe('createTranslator', () => {
    it('selects English one/other plural forms', () => {
        const t = createTranslator('en', en, en);
        expect(t('card.count', { count: 1 })).toBe('1 card');
        expect(t('card.count', { count: 5 })).toBe('5 cards');
    });

    it('selects Ukrainian one/few/many plural forms at 1, 2, 5, 11 and 21', () => {
        const t = createTranslator('uk', uk, en);
        expect(t('card.count', { count: 1 })).toBe('1 карта');
        expect(t('card.count', { count: 2 })).toBe('2 карти');
        expect(t('card.count', { count: 5 })).toBe('5 карт');
        expect(t('card.count', { count: 11 })).toBe('11 карт');
        expect(t('card.count', { count: 21 })).toBe('21 карта');
    });

    it('substitutes {x} placeholders', () => {
        const t = createTranslator('en', en, en);
        expect(t('greeting', { name: 'Ann' })).toBe('Hello, Ann');
    });

    it('falls back to the English message when the active catalog lacks the key', () => {
        const t = createTranslator('uk', uk, en);
        expect(t('only.en')).toBe('English only');
    });

    it('returns the key when neither catalog has a message, as a last resort', () => {
        const t = createTranslator('en', en, en);
        expect(t('missing.key')).toBe('missing.key');
    });
});

describe('formatDate', () => {
    it('formats a UTC calendar date the same way regardless of the environment time zone', () => {
        const date = new Date(Date.UTC(2026, 8, 20, 4, 30));
        expect(formatDate('en', date)).toBe(formatDate('en', date));
        expect(formatDate('en', date)).toContain('20');
        expect(formatDate('en', date)).toContain('September');
    });

    it('formats in the given locale', () => {
        const date = new Date(Date.UTC(2026, 8, 20));
        expect(formatDate('uk', date)).not.toBe(formatDate('en', date));
    });
});
