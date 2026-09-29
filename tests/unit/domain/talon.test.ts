import { describe, expect, it } from 'vitest';
import { reachableTops, stepTalon } from '../../../src/domain/talon';
import { deepFreeze, frozenState, makeState, vegasAtLimit } from '../../fixtures/states';

// Card ids are arbitrary here; the talon rule never looks at rank or suit.
const [A, B, C, D, E, F, G] = [10, 11, 12, 13, 14, 15, 16];

describe('stepTalon', () => {
    it('draws one card and puts it on the waste top', () => {
        expect(stepTalon([A, B, C], [D], 1)).toEqual({ stock: [A, B], waste: [D, C], drew: 1, recycled: false });
    });

    it('draws three cards, the deepest of them ending on top', () => {
        expect(stepTalon([A, B, C, D, E], [], 3)).toEqual({
            stock: [A, B],
            waste: [E, D, C],
            drew: 3,
            recycled: false,
        });
    });

    it('draws what remains when the stock is short', () => {
        expect(stepTalon([A, B], [], 3)).toEqual({ stock: [], waste: [B, A], drew: 2, recycled: false });
    });

    it('recycles the waste into the stock, reversed, when the stock is empty', () => {
        expect(stepTalon([], [A, B, C], 3)).toEqual({ stock: [C, B, A], waste: [], drew: 0, recycled: true });
    });

    it('has nothing to step when stock and waste are empty', () => {
        expect(stepTalon([], [], 1)).toBeUndefined();
    });

    it('never mutates its input', () => {
        const stock = deepFreeze([A, B, C, D]);
        const waste = deepFreeze([E]);
        expect(() => stepTalon(stock, waste, 3)).not.toThrow();
        expect(() => stepTalon([], waste, 3)).not.toThrow();
    });
});

describe('reachableTops', () => {
    it('lists nothing for an empty stock and waste', () => {
        expect(reachableTops(frozenState({}))).toEqual([]);
        expect(reachableTops(vegasAtLimit({}))).toEqual([]);
    });

    it('reaches every talon card in Draw 1: waste top, stock top-down, then the rest of the waste bottom-up', () => {
        const state = frozenState({ stock: [A, B, C], waste: [D, E, F] });
        expect(reachableTops(state)).toEqual([F, C, B, A, D, E]);
    });

    it('reaches every talon card in Daily', () => {
        const state = frozenState({ mode: 'daily', stock: [A, B], waste: [C] });
        expect(reachableTops(state)).toEqual([C, B, A]);
    });

    it('reaches only the cards each draw leaves on top in Draw 3', () => {
        // Stock top-down: G F E D C B A. Draws of three leave E, B and, for the last card, A.
        const state = frozenState({ mode: 'draw3', draw: 3, stock: [A, B, C, D, E, F, G] });
        expect(reachableTops(state)).toEqual([E, B, A]);
    });

    it('lists, part-way through a Draw 3 pass, the waste top, the draws left, then the draws after a recycle', () => {
        // Waste holds A below B; the stock holds C, D, E, F from its top down.
        const state = frozenState({ mode: 'draw3', draw: 3, waste: [A, B], stock: [F, E, D, C] });
        expect(reachableTops(state)).toEqual([B, E, F, C]);
    });

    it('stops at the end of the stock on the last Vegas pass', () => {
        const state = vegasAtLimit({ waste: [A, B], stock: [F, E, D, C] });
        expect(reachableTops(state)).toEqual([B, E, F]);
    });

    it('reaches the recycled cards on the Vegas pass before the last', () => {
        const state = vegasAtLimit({ passes: 2, waste: [A, B], stock: [F, E, D, C] });
        expect(reachableTops(state)).toEqual([B, E, F, C]);
    });

    it('lists only the waste top when a Vegas recycle is refused', () => {
        expect(reachableTops(vegasAtLimit({ waste: [A, B, C] }))).toEqual([C]);
    });

    it('lists the same cards whichever pass an unlimited mode is on', () => {
        const stock = [A, B, C, D, E];
        expect(reachableTops(makeState({ mode: 'draw3', draw: 3, passes: 40, stock }))).toEqual(
            reachableTops(makeState({ mode: 'draw3', draw: 3, passes: 1, stock })),
        );
    });

    it('is deterministic and leaves a frozen input untouched', () => {
        const state = frozenState({ mode: 'draw3', draw: 3, waste: [A, B], stock: [F, E, D, C] });
        const snapshot = JSON.stringify(state);
        expect(reachableTops(state)).toEqual(reachableTops(state));
        expect(JSON.stringify(state)).toBe(snapshot);
    });
});
