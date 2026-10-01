import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOGS, SUPPORTED_LOCALES } from '../../../src/i18n/catalog';
import { en } from '../../../src/i18n/locales/en';
import { createTranslator, formatDate, type Catalog, type Message } from '../../../src/i18n/translate';
import { formatBank, formatMoves, formatScore, formatTime } from '../../../src/ui/format';
import { woff2CodePoints } from '../../support/fontCoverage';

const pixel = woff2CodePoints(readFileSync('src/assets/fonts/PressStart2P-Regular.woff2'));
const body = woff2CodePoints(readFileSync('src/assets/fonts/Inter-Variable-subset.woff2'));

/** The characters of `text` the font has no glyph for, so the browser would draw them with a fallback font. */
function missing(text: string, font: Set<number>, ignore: ReadonlySet<number> = new Set()): string[] {
    return [...new Set(Array.from(text))].filter((char) => {
        const code = char.codePointAt(0) ?? 0;
        return !font.has(code) && !ignore.has(code);
    });
}

/** The suit symbols and their presentation selectors, which come from a symbol fallback font on purpose. */
const SUIT_SYMBOLS = new Set([0x2660, 0x2661, 0x2662, 0x2663, 0x2664, 0x2665, 0x2666, 0x2667, 0xfe0e, 0xfe0f]);

describe('font coverage helper', () => {
    it('reads Press Start 2P and Inter code points from their WOFF2 cmap', () => {
        expect(pixel.has('A'.codePointAt(0) ?? 0)).toBe(true);
        expect(pixel.has(0x0457)).toBe(true); // Cyrillic i with diaeresis
        expect(body.has(0x0457)).toBe(true);
        expect(pixel.has(0x2212)).toBe(false); // the minus sign: the reason the pixel-font strings use "-"
        expect(body.has(0x2212)).toBe(true);
    });
});

/**
 * Every catalog message the app draws in Press Start 2P (`--font-pixel`), found from the classes the components put the
 * message in: the wordmark, the mode tile corner and detail line, the deal button, the deal and attempt lines of the
 * dealing overlay, the build stamp and deal code footers, the win heading and the key caps.
 */
const PIXEL_KEYS: readonly (readonly [string, Record<string, string | number>?])[] = [
    ['app.title'],
    ['home.deal'],
    ['home.modes.draw1.meta'],
    ['home.modes.draw3.meta'],
    ['home.modes.vegas.meta'],
    ['game.dealingOverlay.title'],
    ['game.dealingOverlay.attempt', { count: 48 }],
    ['game.dealCode', { code: 'v-0123ABC' }],
    ['build.number', { number: '1234', time: '2026-09-30 12:34 UTC' }],
    ['build.dev', { time: '2026-09-30 12:34 UTC' }],
    ['build.label', { value: 'Build 1234 · 2026-09-30 12:34 UTC' }],
    ['win.heading'],
    ['help.key.tap'],
    ['help.key.click'],
    ['help.key.drag'],
    ['help.key.doubleClick'],
    ['help.key.space'],
];

/** Text the components put in a pixel-font element that does not come from a catalog message. */
const PIXEL_LITERALS = [
    'A→K R/B K 1|3', // the How to play rule icons
    'Ctrl+Z Ctrl+Y H A N P Esc', // the key caps
    'A 2 3 4 5 6 7 8 9 10 J Q K', // card ranks
    '0123456789 $ - -- % /', // scores, banks, counts, the record strip
];

describe('pixel-font text', () => {
    it.each(SUPPORTED_LOCALES)('every %s message drawn in Press Start 2P uses only glyphs the font has', (locale) => {
        const t = createTranslator(locale, CATALOGS[locale].catalog, en);
        const gaps = PIXEL_KEYS.flatMap(([key, params]) => {
            const gap = missing(t(key, params), pixel);
            return gap.length > 0 ? [`${key}: ${gap.join(' ')}`] : [];
        });
        expect(gaps).toEqual([]);
    });

    it.each(SUPPORTED_LOCALES)('the %s Daily deal weekday and month draw with glyphs the font has', (locale) => {
        const months = Array.from({ length: 12 }, (_, month) => new Date(Date.UTC(2026, month, 1 + month)));
        const days = Array.from({ length: 7 }, (_, day) => new Date(Date.UTC(2026, 8, 6 + day)));
        const text = [...months, ...days].map((date) => formatDate(locale, date, { weekday: 'short', month: 'short' }));
        expect(missing(text.join(' '), pixel)).toEqual([]);
    });

    it('the number formatters use only glyphs the font has', () => {
        const text = [
            formatScore(5),
            formatMoves(1234),
            formatBank(47),
            formatBank(-52),
            formatTime(59),
            formatTime(3725),
        ].join(' ');
        expect(missing(text, pixel)).toEqual([]);
    });

    it('the literal pixel-font text has glyphs', () => {
        expect(missing(PIXEL_LITERALS.join(' '), pixel)).toEqual([]);
    });

    it('draws no catalog minus sign in the pixel font: the Vegas detail line uses a hyphen', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(CATALOGS[locale].catalog['home.modes.vegas.meta']).toMatch(/^-\$52 · /);
        }
    });
});

describe('body-font text', () => {
    it.each(SUPPORTED_LOCALES)('every %s catalog character has an Inter glyph', (locale) => {
        const catalog: Catalog = CATALOGS[locale].catalog;
        const all = Object.values(catalog)
            .flatMap((message: Message) => (typeof message === 'string' ? [message] : Object.values(message)))
            .join('');
        expect(missing(all, body, SUIT_SYMBOLS)).toEqual([]);
    });
});
