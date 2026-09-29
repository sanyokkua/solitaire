import { describe, expect, it } from 'vitest';
import { isDeadEnd } from '../../../src/domain/deadEnd';
import { cardId } from '../../../src/domain/cards';
import { faceUp, foundationsOf, frozenState, tableauOf, vegasAtLimit } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const SPADES = 3;

const c = cardId;

describe('isDeadEnd', () => {
    it('is false for a won position', () => {
        expect(isDeadEnd(frozenState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' }))).toBe(false);
    });

    it('is true when nothing can be moved and the talon is empty', () => {
        expect(isDeadEnd(frozenState({}))).toBe(true);
    });

    it('is false when a priority move exists', () => {
        expect(isDeadEnd(frozenState({ tableau: tableauOf(faceUp(c(SPADES, 1))) }))).toBe(false);
        expect(isDeadEnd(vegasAtLimit({ tableau: tableauOf(faceUp(c(SPADES, 1))) }))).toBe(false);
    });

    it('is false when a stock card could be played', () => {
        expect(isDeadEnd(frozenState({ stock: [c(HEARTS, 1)] }))).toBe(false);
        const onTableau = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6))), stock: [c(HEARTS, 5)] });
        expect(isDeadEnd(onTableau)).toBe(false);
    });

    it('is false when a playable card sits anywhere in the stock', () => {
        expect(isDeadEnd(frozenState({ stock: [c(HEARTS, 9), c(HEARTS, 1), c(SPADES, 9)] }))).toBe(false);
    });

    it('is false when a card buried in the waste could be played', () => {
        const state = frozenState({ waste: [c(HEARTS, 1), c(SPADES, 9)] });
        expect(isDeadEnd(state)).toBe(false);
    });

    it('is true when no stock or waste card could be played anywhere', () => {
        expect(isDeadEnd(frozenState({ stock: [c(HEARTS, 9)], waste: [c(SPADES, 9)] }))).toBe(true);
        expect(isDeadEnd(frozenState({ tableau: tableauOf(faceUp(c(DIAMONDS, 6))), stock: [c(HEARTS, 9)] }))).toBe(
            true,
        );
    });

    it('is a dead end at the Vegas pass limit but not under Standard', () => {
        // The Ace is buried under a card nothing accepts, so no priority move exists.
        const waste = [c(HEARTS, 1), c(SPADES, 9)];
        expect(isDeadEnd(vegasAtLimit({ waste }))).toBe(true);
        expect(isDeadEnd(frozenState({ waste }))).toBe(false);
        // AST "The pass limit can create a dead end": on pass 2 the one recycle left turns the waste back over in the
        // same groups of three, so it brings back only S9 on top and the buried ace stays out of reach.
        expect(isDeadEnd(vegasAtLimit({ passes: 2, waste }))).toBe(true);
    });

    it('is a dead end on the last Vegas pass but not the one before, when a recycle would bring a card up', () => {
        // Waste bottom-up S9 S8 H1 D9. Recycled and drawn in threes, S9 S8 H1 turn first, so the ace tops the waste.
        const waste = [c(SPADES, 9), c(SPADES, 8), c(HEARTS, 1), c(DIAMONDS, 9)];
        expect(isDeadEnd(vegasAtLimit({ passes: 2, waste }))).toBe(false);
        expect(isDeadEnd(vegasAtLimit({ passes: 3, waste }))).toBe(true);
    });

    it('is a dead end in Draw 3 when the only playable stock card is one the grouping never leaves on top', () => {
        // Stock top-down: H1 S9 D9. One draw turns all three, leaving D9 on top; recycling repeats that exactly.
        const stock = [c(DIAMONDS, 9), c(SPADES, 9), c(HEARTS, 1)];
        expect(isDeadEnd(frozenState({ mode: 'draw3', draw: 3, stock }))).toBe(true);
        expect(isDeadEnd(frozenState({ stock }))).toBe(false);
    });

    it('is not a dead end in Draw 3 when the playable card is one a draw leaves on top', () => {
        const stock = [c(HEARTS, 1), c(SPADES, 9), c(DIAMONDS, 9)];
        expect(isDeadEnd(frozenState({ mode: 'draw3', draw: 3, stock }))).toBe(false);
    });

    it('is not a dead end with a waste King, an empty column and recycling refused', () => {
        expect(isDeadEnd(vegasAtLimit({ waste: [c(DIAMONDS, 13)] }))).toBe(false);
    });

    it('is a dead end when nothing is playable, whether or not recycling is allowed', () => {
        expect(isDeadEnd(vegasAtLimit({ waste: [c(SPADES, 9)] }))).toBe(true);
        expect(isDeadEnd(frozenState({ waste: [c(SPADES, 9)] }))).toBe(true);
    });

    it('is deterministic and leaves a frozen input untouched', () => {
        const state = vegasAtLimit({ waste: [c(HEARTS, 1), c(SPADES, 9)] });
        const snapshot = JSON.stringify(state);
        expect(isDeadEnd(state)).toBe(isDeadEnd(state));
        expect(JSON.stringify(state)).toBe(snapshot);
    });
});
