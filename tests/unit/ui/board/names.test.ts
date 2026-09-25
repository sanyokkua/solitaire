import { describe, expect, it } from 'vitest';
import { cardId, DECK_SIZE } from '../../../../src/domain/cards';
import { cardName, pileName } from '../../../../src/ui/board/names';

describe('cardName', () => {
    it('spells out the rank and suit of a face-up card', () => {
        expect(cardName(cardId(3, 12), true)).toBe('Queen of Spades');
        expect(cardName(cardId(2, 7), true)).toBe('Seven of Clubs');
        expect(cardName(cardId(0, 1), true)).toBe('Ace of Hearts');
        expect(cardName(cardId(1, 10), true)).toBe('Ten of Diamonds');
    });

    it('names every face-down card the same, whatever it is', () => {
        expect(cardName(cardId(3, 12), false)).toBe('Face-down card');
        expect(cardName(cardId(0, 1), false)).toBe('Face-down card');
    });

    it('gives all 52 face-up cards distinct names', () => {
        const names = new Set(Array.from({ length: DECK_SIZE }, (_, id) => cardName(id, true)));
        expect(names.size).toBe(DECK_SIZE);
    });
});

describe('pileName', () => {
    it('names the stock with its count', () => {
        expect(pileName({ pile: 'stock' }, 18)).toBe('Stock, 18 cards');
    });

    it('numbers columns from 1', () => {
        expect(pileName({ pile: 'tableau', col: 2 }, 0)).toBe('Column 3, empty');
        expect(pileName({ pile: 'tableau', col: 3 }, 1)).toBe('Column 4, 1 card');
        expect(pileName({ pile: 'tableau', col: 2 }, 5)).toBe('Column 3, 5 cards');
    });

    it('names a foundation by its suit', () => {
        expect(pileName({ pile: 'foundation', suit: 0 }, 2)).toBe('Hearts foundation, 2 cards');
        expect(pileName({ pile: 'foundation', suit: 3 }, 0)).toBe('Spades foundation, empty');
    });

    it('names the waste', () => {
        expect(pileName({ pile: 'waste' }, 3)).toBe('Waste, 3 cards');
    });
});
