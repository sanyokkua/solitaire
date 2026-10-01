// covers: KS-AST-06
import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { positionKey } from '../../../src/domain/position';
import { faceDown, faceUp, foundationsOf, frozenState, tableauOf } from '../../fixtures/states';

const HEARTS = 0;
const SPADES = 3;

const c = cardId;

describe('positionKey', () => {
    const base = frozenState({
        tableau: tableauOf(faceDown(c(HEARTS, 9)), faceUp(c(SPADES, 6))),
        stock: [c(HEARTS, 5)],
        waste: [c(SPADES, 2)],
        foundations: foundationsOf(1, 0, 0, 0),
    });

    it('is equal for states that differ only in time, score, moves, undos, passes or mode', () => {
        const other = frozenState({
            ...base,
            elapsedMs: 90_000,
            score: 40,
            moves: 12,
            undos: 3,
            passes: 2,
            mode: 'draw3',
            draw: 3,
            started: true,
        });
        expect(positionKey(other)).toBe(positionKey(base));
    });

    it('is deterministic', () => {
        expect(positionKey(base)).toBe(positionKey(base));
    });

    it('changes when a card moves', () => {
        const moved = frozenState({
            ...base,
            tableau: tableauOf(faceDown(c(HEARTS, 9)), faceUp(c(SPADES, 6), c(HEARTS, 5))),
            stock: [],
        });
        expect(positionKey(moved)).not.toBe(positionKey(base));
    });

    it('changes when a face-down card is turned up', () => {
        const flipped = frozenState({ ...base, tableau: tableauOf(faceUp(c(HEARTS, 9)), faceUp(c(SPADES, 6))) });
        expect(positionKey(flipped)).not.toBe(positionKey(base));
    });

    it('differs when the same cards sit in a different order in a pile', () => {
        const a = frozenState({ stock: [c(HEARTS, 5), c(SPADES, 2)] });
        const b = frozenState({ stock: [c(SPADES, 2), c(HEARTS, 5)] });
        expect(positionKey(a)).not.toBe(positionKey(b));
    });

    it('differs when the same cards are split across different piles', () => {
        const stock = frozenState({ stock: [c(HEARTS, 5), c(SPADES, 2)] });
        const waste = frozenState({ waste: [c(HEARTS, 5), c(SPADES, 2)] });
        const split = frozenState({ stock: [c(HEARTS, 5)], waste: [c(SPADES, 2)] });
        const keys = new Set([positionKey(stock), positionKey(waste), positionKey(split)]);
        expect(keys.size).toBe(3);
    });

    it('differs when the same cards are split across different columns', () => {
        const one = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6), c(HEARTS, 5))) });
        const two = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6)), faceUp(c(HEARTS, 5))) });
        const shifted = frozenState({ tableau: tableauOf([], faceUp(c(SPADES, 6), c(HEARTS, 5))) });
        const keys = new Set([positionKey(one), positionKey(two), positionKey(shifted)]);
        expect(keys.size).toBe(3);
    });
});
