import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { canRecycle, isWon, passLimit } from '../../../src/domain/rules';
import type { GameState, Mode, Pile, Suit } from '../../../src/domain/types';
import { deepFreeze, makeState } from '../../fixtures/states';

/** An exhausted stock over a one-card waste, at the given pass. */
function exhausted(mode: Mode, passes: number): GameState {
    return deepFreeze(makeState({ mode, passes, stock: [], waste: [cardId(0, 5)] }));
}

describe('passLimit', () => {
    it.each<[Mode, number]>([
        ['draw1', Number.POSITIVE_INFINITY],
        ['draw3', Number.POSITIVE_INFINITY],
        ['daily', Number.POSITIVE_INFINITY],
        ['vegas', 3],
    ])('is %s → %s', (mode, limit) => {
        expect(passLimit(mode)).toBe(limit);
    });
});

describe('canRecycle', () => {
    it('is refused while the stock holds cards', () => {
        const state = deepFreeze(makeState({ stock: [cardId(0, 1)], waste: [cardId(0, 5)] }));
        expect(canRecycle(state)).toBe(false);
    });

    it('is refused with an empty waste', () => {
        expect(canRecycle(deepFreeze(makeState({ stock: [], waste: [] })))).toBe(false);
    });

    it.each<Mode>(['draw1', 'draw3', 'daily'])('is permitted in %s at any pass', (mode) => {
        for (const passes of [1, 2, 3, 4, 50]) {
            expect(canRecycle(exhausted(mode, passes))).toBe(true);
        }
    });

    it('is permitted in Vegas on passes 1 and 2 and refused on pass 3', () => {
        expect(canRecycle(exhausted('vegas', 1))).toBe(true);
        expect(canRecycle(exhausted('vegas', 2))).toBe(true);
        expect(canRecycle(exhausted('vegas', 3))).toBe(false);
    });
});

describe('isWon', () => {
    const fullSuit = (suit: Suit): Pile => Array.from({ length: 13 }, (_, i) => suit * 13 + i);

    it('is true when all four foundations hold 13 cards', () => {
        const state = deepFreeze(makeState({ foundations: [fullSuit(0), fullSuit(1), fullSuit(2), fullSuit(3)] }));
        expect(isWon(state)).toBe(true);
    });

    it('is false when any foundation holds fewer than 13', () => {
        const almost = fullSuit(2).slice(0, 12);
        const state = deepFreeze(makeState({ foundations: [fullSuit(0), fullSuit(1), almost, fullSuit(3)] }));
        expect(isWon(state)).toBe(false);
    });

    it('is false for a fresh empty position', () => {
        expect(isWon(deepFreeze(makeState()))).toBe(false);
    });
});
