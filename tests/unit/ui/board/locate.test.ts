import { describe, expect, it } from 'vitest';
import { cardId, DECK_SIZE } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { PileRef } from '../../../../src/domain/types';
import { cardIndex, pileKey } from '../../../../src/ui/board/locate';
import { freshDrawOneState, freshDrawThreeState } from '../../../fixtures/boardPositions';
import { faceDown, faceUp, foundationsOf, makeState, tableauOf } from '../../../fixtures/states';

const KING_SPADES = cardId(3, 13);
const QUEEN_HEARTS = cardId(0, 12);
const JACK_CLUBS = cardId(2, 11);
const TEN_DIAMONDS = cardId(1, 10);
const NINE_SPADES = cardId(3, 9);
const FIVE_CLUBS = cardId(2, 5);

describe('pileKey', () => {
    it('names each pile', () => {
        expect(pileKey({ pile: 'stock' })).toBe('stock');
        expect(pileKey({ pile: 'waste' })).toBe('waste');
        expect(pileKey({ pile: 'foundation', suit: 2 })).toBe('foundation:2');
        expect(pileKey({ pile: 'tableau', col: 4 })).toBe('tableau:4');
    });
});

describe('cardIndex', () => {
    it('places stock cards face down and unmovable at their index', () => {
        const stock = [cardId(0, 1), cardId(1, 2), cardId(2, 3)];
        const located = cardIndex(makeState({ stock }));
        stock.forEach((id, index) => {
            expect(located.get(id)).toEqual({ from: { pile: 'stock' }, index, faceUp: false, movable: false });
        });
    });

    it('makes only the top waste card movable in Draw 3, and every waste card face up', () => {
        const waste = [cardId(0, 4), cardId(1, 5), cardId(2, 6), cardId(3, 7)];
        const located = cardIndex(makeState({ mode: 'draw3', draw: 3, waste }));
        waste.forEach((id, index) => {
            expect(located.get(id)).toEqual({
                from: { pile: 'waste' },
                index,
                faceUp: true,
                movable: index === waste.length - 1,
            });
        });
    });

    it('makes the single Draw 1 waste card movable', () => {
        const only = cardId(2, 9);
        expect(cardIndex(makeState({ waste: [only] })).get(only)).toEqual({
            from: { pile: 'waste' },
            index: 0,
            faceUp: true,
            movable: true,
        });
    });

    it('makes only the top foundation card movable', () => {
        const located = cardIndex(makeState({ foundations: foundationsOf(0, 3, 0, 1) }));
        const from: PileRef = { pile: 'foundation', suit: 1 };
        expect(located.get(cardId(1, 1))).toEqual({ from, index: 0, faceUp: true, movable: false });
        expect(located.get(cardId(1, 2))).toEqual({ from, index: 1, faceUp: true, movable: false });
        expect(located.get(cardId(1, 3))).toEqual({ from, index: 2, faceUp: true, movable: true });
        expect(located.get(cardId(3, 1))).toEqual({
            from: { pile: 'foundation', suit: 3 },
            index: 0,
            faceUp: true,
            movable: true,
        });
    });

    it('makes a face-up run movable from its first card and from any card above it', () => {
        const tableau = tableauOf([], [], faceDown(FIVE_CLUBS).concat(faceUp(KING_SPADES, QUEEN_HEARTS, JACK_CLUBS)));
        const located = cardIndex(makeState({ tableau }));
        const from: PileRef = { pile: 'tableau', col: 2 };
        expect(located.get(FIVE_CLUBS)).toEqual({ from, index: 0, faceUp: false, movable: false });
        expect(located.get(KING_SPADES)).toEqual({ from, index: 1, faceUp: true, movable: true });
        expect(located.get(QUEEN_HEARTS)).toEqual({ from, index: 2, faceUp: true, movable: true });
        expect(located.get(JACK_CLUBS)).toEqual({ from, index: 3, faceUp: true, movable: true });
    });

    it('makes a face-up card unmovable when the cards above it do not form a run', () => {
        const tableau = tableauOf([], [], [], faceUp(KING_SPADES, TEN_DIAMONDS, NINE_SPADES));
        const located = cardIndex(makeState({ tableau }));
        const from: PileRef = { pile: 'tableau', col: 3 };
        expect(located.get(KING_SPADES)).toEqual({ from, index: 0, faceUp: true, movable: false });
        expect(located.get(TEN_DIAMONDS)).toEqual({ from, index: 1, faceUp: true, movable: true });
        expect(located.get(NINE_SPADES)).toEqual({ from, index: 2, faceUp: true, movable: true });
    });

    it('never makes a face-down tableau card movable', () => {
        const ids = [cardId(0, 8), cardId(1, 8), cardId(2, 8)];
        const located = cardIndex(makeState({ tableau: tableauOf(faceDown(...ids)) }));
        for (const id of ids) {
            expect(located.get(id)?.faceUp).toBe(false);
            expect(located.get(id)?.movable).toBe(false);
        }
    });

    it.each([
        ['a fresh Draw 1 game', freshDrawOneState()],
        ['a fresh Draw 3 game', freshDrawThreeState()],
        ['an unstarted deal', dealFromSeed(1234, 'draw1')],
    ])('lists each of the 52 cards exactly once in %s, at its position in its pile', (_name, state) => {
        const located = cardIndex(state);
        expect(located.size).toBe(DECK_SIZE);
        expect([...located.keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: DECK_SIZE }, (_, i) => i));

        state.tableau.forEach((cards, col) => {
            cards.forEach((card, index) => {
                expect(located.get(card.id)).toMatchObject({
                    from: { pile: 'tableau', col },
                    index,
                    faceUp: card.up,
                });
            });
        });
        state.stock.forEach((id, index) => {
            expect(located.get(id)).toMatchObject({ from: { pile: 'stock' }, index });
        });
        state.waste.forEach((id, index) => {
            expect(located.get(id)).toMatchObject({ from: { pile: 'waste' }, index });
        });
    });
});
