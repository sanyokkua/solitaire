import { describe, expect, it } from 'vitest';
import {
    DECK_SIZE,
    FOUNDATION_DISPLAY_ORDER,
    RANK_LABELS,
    SUIT_KEYS,
    SUIT_SYMBOLS,
    cardId,
    cardLabels,
    colorOf,
    isCardId,
    rankOf,
    suitColor,
    suitOf,
} from '../../../src/domain/cards';
import * as cardsModule from '../../../src/domain/cards';
import type { Rank } from '../../../src/domain/cards';
import type { CardId, Suit } from '../../../src/domain/types';

const ALL_IDS: readonly CardId[] = Array.from({ length: 52 }, (_, id) => id);
const SUITS: readonly Suit[] = [0, 1, 2, 3];

describe('card identity encoding', () => {
    it('has a 52-card deck', () => {
        expect(DECK_SIZE).toBe(52);
    });

    it.each(ALL_IDS)('round-trips card %i through suit and rank', (id) => {
        expect(cardId(suitOf(id), rankOf(id))).toBe(id);
    });

    it('derives suit as the quotient by 13 and rank as the remainder plus one', () => {
        expect(suitOf(0)).toBe(0);
        expect(rankOf(0)).toBe(1);
        expect(suitOf(12)).toBe(0);
        expect(rankOf(12)).toBe(13);
        expect(suitOf(13)).toBe(1);
        expect(rankOf(13)).toBe(1);
        expect(suitOf(51)).toBe(3);
        expect(rankOf(51)).toBe(13);
    });

    it('produces every identifier exactly once from the 4 x 13 suit-rank grid', () => {
        const ids = SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => cardId(suit, (i + 1) as Rank)));

        expect([...ids].sort((a, b) => a - b)).toEqual(ALL_IDS);
    });
});

describe('card colour', () => {
    it('makes identifiers 0 through 25 red and 26 through 51 black', () => {
        for (const id of ALL_IDS) {
            expect(colorOf(id)).toBe(id <= 25 ? 'red' : 'black');
        }
    });

    it('makes hearts and diamonds red, clubs and spades black', () => {
        expect(SUITS.map(suitColor)).toEqual(['red', 'red', 'black', 'black']);
    });
});

describe('card validity check', () => {
    it.each(ALL_IDS)('accepts %i', (id) => {
        expect(isCardId(id)).toBe(true);
    });

    it.each([-1, 52, 1.5, Number.NaN, '3', null, undefined])('rejects %s', (value) => {
        expect(isCardId(value)).toBe(false);
    });
});

describe('locale-independent label tables', () => {
    it('labels ranks A, 2 through 10, J, Q, K', () => {
        expect(RANK_LABELS).toEqual({
            1: 'A',
            2: '2',
            3: '3',
            4: '4',
            5: '5',
            6: '6',
            7: '7',
            8: '8',
            9: '9',
            10: '10',
            11: 'J',
            12: 'Q',
            13: 'K',
        });
    });

    it('keys suits by fixed identifiers', () => {
        expect(SUIT_KEYS).toEqual({ 0: 'hearts', 1: 'diamonds', 2: 'clubs', 3: 'spades' });
    });

    it('symbols suits with the four card-suit glyphs', () => {
        expect(SUIT_SYMBOLS).toEqual({ 0: '♥', 1: '♦', 2: '♣', 3: '♠' });
    });

    it('composes a card label from the three tables', () => {
        expect(cardLabels(0)).toEqual({ rank: 'A', suitKey: 'hearts', suitSymbol: '♥' });
        expect(cardLabels(23)).toEqual({ rank: 'J', suitKey: 'diamonds', suitSymbol: '♦' });
        expect(cardLabels(51)).toEqual({ rank: 'K', suitKey: 'spades', suitSymbol: '♠' });
    });
});

describe('foundation display order', () => {
    it('is a permutation of the four suits', () => {
        expect([...FOUNDATION_DISPLAY_ORDER].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    });

    it('alternates colours between adjacent slots', () => {
        for (let i = 1; i < FOUNDATION_DISPLAY_ORDER.length; i++) {
            const previous = FOUNDATION_DISPLAY_ORDER[i - 1];
            const current = FOUNDATION_DISPLAY_ORDER[i];
            if (previous === undefined || current === undefined) {
                throw new Error('display order is shorter than four entries');
            }
            expect(suitColor(current)).not.toBe(suitColor(previous));
        }
    });

    it('lays out hearts, clubs, diamonds, spades', () => {
        expect(FOUNDATION_DISPLAY_ORDER).toEqual([0, 2, 1, 3]);
    });
});

describe('no translated text in the card model', () => {
    /** Locale-independent values only: rank labels, suit keys and suit symbols. */
    const ALLOWED = new Set([
        ...['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
        ...['hearts', 'diamonds', 'clubs', 'spades'],
        ...['♥', '♦', '♣', '♠'],
    ]);
    const COLOUR_KEYS = new Set(['red', 'black']);

    function stringsIn(value: unknown): string[] {
        if (typeof value === 'string') return [value];
        if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsIn);
        return [];
    }

    it('exports no string beyond labels, keys and symbols', () => {
        const exported = Object.values(cardsModule).filter((value) => typeof value !== 'function');
        expect(exported.length).toBeGreaterThan(0);
        for (const text of stringsIn(exported)) expect(ALLOWED).toContain(text);
    });

    it('labels and colours every card with keys only', () => {
        for (const id of ALL_IDS) {
            for (const text of stringsIn(cardLabels(id))) expect(ALLOWED).toContain(text);
            expect(COLOUR_KEYS).toContain(colorOf(id));
        }
    });
});
