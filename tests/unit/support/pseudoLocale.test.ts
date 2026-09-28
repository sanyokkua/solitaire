import { describe, expect, it } from 'vitest';
import { en } from '../../../src/i18n/locales/en';
import { createTranslator } from '../../../src/i18n/translate';
import { buildPseudoCatalog, isPseudoOrNeutral, pseudoText, PSEUDO_LOCALE } from '../../support/pseudoLocale';

describe('pseudoText', () => {
    it('brackets the text and accents its vowels', () => {
        expect(pseudoText('Undo last move')).toMatch(/^\[Úndó lást móvé/);
        expect(pseudoText('Undo')).toMatch(/^\[.*\]$/);
    });

    it('grows the text by at least 30 %, brackets excluded', () => {
        for (const text of [
            'Undo',
            'Turn the waste back over',
            'A',
            'No moves left. Undo a few steps or deal again.',
        ]) {
            const inner = pseudoText(text).slice(1, -1);
            expect(inner.length, text).toBeGreaterThanOrEqual(Math.ceil(text.length * 1.3));
        }
    });

    it('keeps every {placeholder} unchanged', () => {
        const result = pseudoText('{card} moved to {place}');

        expect(result).toContain('{card}');
        expect(result).toContain('{place}');
        expect(result.match(/\{\w+\}/g)).toEqual(['{card}', '{place}']);
    });
});

describe('buildPseudoCatalog', () => {
    const pseudo = buildPseudoCatalog();

    it('has the same keys as English, every message transformed', () => {
        expect(Object.keys(pseudo)).toEqual(Object.keys(en));
        for (const [key, message] of Object.entries(pseudo)) {
            const texts = typeof message === 'string' ? [message] : Object.values(message);
            for (const text of texts) expect(text, key).toMatch(/^\[.*\]$/s);
        }
    });

    it('keeps the categories of every plural message', () => {
        const plurals = Object.entries(en).filter(([, message]) => typeof message !== 'string');

        expect(plurals.length).toBeGreaterThan(0);
        for (const [key, message] of plurals) {
            const converted = pseudo[key];
            expect(typeof converted, key).toBe('object');
            expect(Object.keys(converted as object), key).toEqual(Object.keys(message as object));
        }
    });

    it('still selects the plural form and fills placeholders through the translator', () => {
        const t = createTranslator(PSEUDO_LOCALE, pseudo, en);

        expect(t('pile.count', { count: 1 })).toMatch(/^\[1 /);
        expect(t('pile.count', { count: 5 })).toContain('5');
        expect(t('pile.count', { count: 1 })).not.toBe(t('pile.count', { count: 5 }));
    });
});

describe('isPseudoOrNeutral', () => {
    it.each(['[Úndó·]', '  [x]  ', '12', '2:05', '$47', '042', '—', 'Solitaire', ''])('accepts %j', (text) => {
        expect(isPseudoOrNeutral(text)).toBe(true);
    });

    it.each(['Undo', 'Score', 'Deal 1-K7Q29XD', '[unclosed'])('rejects %j', (text) => {
        expect(isPseudoOrNeutral(text)).toBe(false);
    });
});
