import { describe, expect, it } from 'vitest';
import { cardId, DECK_SIZE } from '../../../../src/domain/cards';
import { CATALOGS } from '../../../../src/i18n/catalog';
import { createTranslator, type Translate } from '../../../../src/i18n/translate';
import { cardName, pileName } from '../../../../src/ui/board/names';

const en: Translate = createTranslator('en', CATALOGS.en.catalog, CATALOGS.en.catalog);
const uk: Translate = createTranslator('uk', CATALOGS.uk.catalog, CATALOGS.en.catalog);

describe('cardName', () => {
    it('spells out the rank and suit of a face-up card, in English', () => {
        expect(cardName(en, cardId(3, 12), true)).toBe('Queen of Spades');
        expect(cardName(en, cardId(2, 7), true)).toBe('Seven of Clubs');
        expect(cardName(en, cardId(0, 1), true)).toBe('Ace of Hearts');
        expect(cardName(en, cardId(1, 10), true)).toBe('Ten of Diamonds');
    });

    it('spells out the rank and suit of a face-up card, in Ukrainian', () => {
        expect(cardName(uk, cardId(3, 12), true)).toBe('Дама пік');
        expect(cardName(uk, cardId(2, 7), true)).toBe('Сімка треф');
        expect(cardName(uk, cardId(0, 1), true)).toBe('Туз червів');
        expect(cardName(uk, cardId(1, 10), true)).toBe('Десятка бубон');
    });

    it('names every face-down card the same, whatever it is', () => {
        expect(cardName(en, cardId(3, 12), false)).toBe('Face-down card');
        expect(cardName(en, cardId(0, 1), false)).toBe('Face-down card');
        expect(cardName(uk, cardId(3, 12), false)).toBe('Перевернута карта');
    });

    it('gives all 52 face-up cards distinct names', () => {
        const names = new Set(Array.from({ length: DECK_SIZE }, (_, id) => cardName(en, id, true)));
        expect(names.size).toBe(DECK_SIZE);
    });
});

describe('pileName', () => {
    it('names the stock with its count, in English', () => {
        expect(pileName(en, { pile: 'stock' }, 18)).toBe('Stock, 18 cards');
    });

    it('names the stock with its count, in Ukrainian', () => {
        expect(pileName(uk, { pile: 'stock' }, 18)).toBe('Колода, 18 карт');
    });

    it('numbers columns from 1, at counts 1, 3 and 5 and an empty column, in English', () => {
        expect(pileName(en, { pile: 'tableau', col: 2 }, 0)).toBe('Column 3, empty');
        expect(pileName(en, { pile: 'tableau', col: 3 }, 1)).toBe('Column 4, 1 card');
        expect(pileName(en, { pile: 'tableau', col: 3 }, 3)).toBe('Column 4, 3 cards');
        expect(pileName(en, { pile: 'tableau', col: 2 }, 5)).toBe('Column 3, 5 cards');
    });

    it('numbers columns from 1, at counts 1, 3 and 5 and an empty column, in Ukrainian', () => {
        expect(pileName(uk, { pile: 'tableau', col: 2 }, 0)).toBe('Колонка 3, порожньо');
        expect(pileName(uk, { pile: 'tableau', col: 3 }, 1)).toBe('Колонка 4, 1 карта');
        expect(pileName(uk, { pile: 'tableau', col: 3 }, 3)).toBe('Колонка 4, 3 карти');
        expect(pileName(uk, { pile: 'tableau', col: 2 }, 5)).toBe('Колонка 3, 5 карт');
    });

    it('names a foundation by its suit, in English', () => {
        expect(pileName(en, { pile: 'foundation', suit: 0 }, 2)).toBe('Hearts foundation, 2 cards');
        expect(pileName(en, { pile: 'foundation', suit: 3 }, 0)).toBe('Spades foundation, empty');
    });

    it('names a foundation by its suit, in Ukrainian', () => {
        expect(pileName(uk, { pile: 'foundation', suit: 0 }, 2)).toBe('Фундамент червів, 2 карти');
        expect(pileName(uk, { pile: 'foundation', suit: 3 }, 0)).toBe('Фундамент пік, порожньо');
    });

    it('names the waste, in English and Ukrainian', () => {
        expect(pileName(en, { pile: 'waste' }, 3)).toBe('Waste, 3 cards');
        expect(pileName(uk, { pile: 'waste' }, 3)).toBe('Відбій, 3 карти');
    });
});
