import { describe, expect, it } from 'vitest';
import { bestTarget } from '../../../src/domain/assist';
import { cardId } from '../../../src/domain/cards';
import type { PileRef, Suit, TableauCol } from '../../../src/domain/types';
import { faceDown, faceUp, foundationsOf, frozenState, tableauOf } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const CLUBS = 2;
const SPADES = 3;

/** A card that is buried face down and never takes part in a move. */
const BURIED = cardId(DIAMONDS, 9);

const c = cardId;
const col = (n: TableauCol): PileRef => ({ pile: 'tableau', col: n });
const home = (suit: Suit): PileRef => ({ pile: 'foundation', suit });
const WASTE: PileRef = { pile: 'waste' };

describe('bestTarget: foundation first', () => {
    it('sends a single waste card to its foundation, ahead of a column that also accepts it', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 2))), waste: [c(HEARTS, 1)] });
        expect(bestTarget(state, WASTE, 0)).toEqual(home(HEARTS));
    });

    it('sends a single column top to its foundation, ahead of a column that also accepts it', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 2)), [], [], faceUp(c(HEARTS, 1))) });
        expect(bestTarget(state, col(3), 0)).toEqual(home(HEARTS));
    });

    it('does not send a foundation card back to a foundation, and lets the tableau rules decide', () => {
        const state = frozenState({
            tableau: tableauOf([], [], faceUp(c(SPADES, 2))),
            foundations: foundationsOf(1, 0, 0, 0),
        });
        expect(bestTarget(state, home(HEARTS), 0)).toEqual(col(2));
    });

    it('never targets a foundation for a multi-card group, even when its lowest card is ready', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(HEARTS, 5), c(SPADES, 4))], faceUp(c(SPADES, 6))),
            foundations: foundationsOf(4, 0, 0, 0),
        });
        expect(bestTarget(state, col(0), 1)).toEqual(col(1));
    });

    it('sends a King to its foundation ahead of an empty column', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(HEARTS, 13))]),
            foundations: foundationsOf(12, 0, 0, 0),
        });
        expect(bestTarget(state, col(0), 1)).toEqual(home(HEARTS));
    });
});

describe('bestTarget: non-empty columns by relative scan', () => {
    it('picks the first accepting column right of the source, not the lowest-numbered one', () => {
        const state = frozenState({
            tableau: tableauOf(faceUp(c(SPADES, 6)), faceUp(c(HEARTS, 5)), faceUp(c(CLUBS, 6))),
        });
        expect(bestTarget(state, col(1), 0)).toEqual(col(2));
    });

    it('wraps around when the only accepting column lies left of the source', () => {
        const state = frozenState({
            tableau: tableauOf([], [], faceUp(c(CLUBS, 6)), [], [], faceUp(c(HEARTS, 5))),
        });
        expect(bestTarget(state, col(5), 0)).toEqual(col(2));
    });

    it('scans right of the source before wrapping to lower columns', () => {
        const state = frozenState({
            tableau: tableauOf([], faceUp(c(CLUBS, 6)), [], faceUp(c(HEARTS, 5)), [], faceUp(c(SPADES, 6))),
        });
        expect(bestTarget(state, col(3), 0)).toEqual(col(5));
    });

    it('never chooses the source column', () => {
        const state = frozenState({ tableau: tableauOf([], [], faceUp(c(SPADES, 6), c(HEARTS, 5))) });
        expect(bestTarget(state, col(2), 1)).toBeUndefined();
    });

    it('scans from column 0 for a waste card', () => {
        const state = frozenState({
            tableau: tableauOf([], [], [], faceUp(c(SPADES, 6)), [], faceUp(c(CLUBS, 6))),
            waste: [c(HEARTS, 5)],
        });
        expect(bestTarget(state, WASTE, 0)).toEqual(col(3));
        const earlier = frozenState({
            tableau: tableauOf(faceUp(c(SPADES, 6)), [], [], [], [], faceUp(c(CLUBS, 6))),
            waste: [c(HEARTS, 5)],
        });
        expect(bestTarget(earlier, WASTE, 0)).toEqual(col(0));
    });

    it('scans from column 0 for a foundation card', () => {
        const state = frozenState({
            tableau: tableauOf([], [], faceUp(c(HEARTS, 6)), [], faceUp(c(DIAMONDS, 6))),
            foundations: foundationsOf(0, 0, 0, 5),
        });
        expect(bestTarget(state, home(SPADES), 4)).toEqual(col(2));
    });

    it('moves a multi-card group onto a fitting column', () => {
        const state = frozenState({
            tableau: tableauOf(
                [...faceDown(BURIED), ...faceUp(c(HEARTS, 5), c(SPADES, 4))],
                faceUp(c(CLUBS, 6)),
                faceUp(c(SPADES, 6)),
            ),
        });
        expect(bestTarget(state, col(0), 1)).toEqual(col(1));
    });
});

describe('bestTarget: Kings and empty columns', () => {
    it('sends a King that is not at its column base to the first empty column', () => {
        const state = frozenState({ tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(SPADES, 13))]) });
        expect(bestTarget(state, col(0), 1)).toEqual(col(1));
    });

    it('sends a King group from mid-column to an empty column', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(SPADES, 13), c(HEARTS, 12))]),
        });
        expect(bestTarget(state, col(0), 1)).toEqual(col(1));
    });

    it('does not move a King already at its column base to an empty column', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 13), c(HEARTS, 12))) });
        expect(bestTarget(state, col(0), 0)).toBeUndefined();
    });

    it('finds the first empty column counting from column 0, not from the source', () => {
        const state = frozenState({
            tableau: tableauOf(
                faceUp(c(HEARTS, 2)),
                faceUp(c(HEARTS, 3)),
                [],
                faceUp(c(HEARTS, 4)),
                faceUp(c(HEARTS, 6)),
                [...faceDown(BURIED), ...faceUp(c(SPADES, 13))],
                [],
            ),
        });
        expect(bestTarget(state, col(5), 1)).toEqual(col(2));
    });

    it('prefers the lowest-numbered empty column over one right of the source', () => {
        const state = frozenState({
            tableau: tableauOf(
                [],
                faceUp(c(HEARTS, 3)),
                [...faceDown(BURIED), ...faceUp(c(SPADES, 13))],
                faceUp(c(HEARTS, 4)),
                faceUp(c(HEARTS, 6)),
                [],
                faceUp(c(HEARTS, 7)),
            ),
        });
        expect(bestTarget(state, col(2), 1)).toEqual(col(0));
    });

    it('sends a waste King to the first empty column from column 0', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(HEARTS, 2))), waste: [c(SPADES, 13)] });
        expect(bestTarget(state, WASTE, 0)).toEqual(col(1));
    });

    it('sends a King from a foundation to the first empty column', () => {
        const state = frozenState({
            tableau: tableauOf(faceUp(c(HEARTS, 2))),
            foundations: foundationsOf(0, 0, 0, 13),
        });
        expect(bestTarget(state, home(SPADES), 12)).toEqual(col(1));
    });

    it('never uses an empty column for a card that is not a King', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(HEARTS, 12))]),
        });
        expect(bestTarget(state, col(0), 1)).toBeUndefined();
    });
});

describe('bestTarget: no target', () => {
    it('is undefined when nothing accepts the group', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 9)), faceUp(c(HEARTS, 5))) });
        expect(bestTarget(state, col(1), 0)).toBeUndefined();
    });

    it('is undefined for a face-down card', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(HEARTS, 5))], faceUp(c(SPADES, 6))),
        });
        expect(bestTarget(state, col(0), 0)).toBeUndefined();
    });

    it('is undefined for a grab from the stock', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6))), stock: [c(HEARTS, 5)] });
        expect(bestTarget(state, { pile: 'stock' }, 0)).toBeUndefined();
    });

    it('is undefined for an index that is not the top of the waste', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6))), waste: [c(HEARTS, 5), c(CLUBS, 9)] });
        expect(bestTarget(state, WASTE, 0)).toBeUndefined();
    });
});
