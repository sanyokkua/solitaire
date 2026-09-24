import { describe, expect, it } from 'vitest';
import { hint, type HintPriority } from '../../../src/domain/assist';
import { cardId } from '../../../src/domain/cards';
import type { CardId, PileRef, Suit, TableauCol } from '../../../src/domain/types';
import { faceDown, faceUp, foundationsOf, frozenState, tableauOf, vegasAtLimit } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const CLUBS = 2;
const SPADES = 3;

/** A card that is buried face down and never takes part in a move. */
const BURIED = cardId(CLUBS, 9);

const c = cardId;
const col = (n: TableauCol): PileRef => ({ pile: 'tableau', col: n });
const home = (suit: Suit): PileRef => ({ pile: 'foundation', suit });
const WASTE: PileRef = { pile: 'waste' };

/** The suggestion for moving `cards` from `index` of `from` to `to` at `priority`. */
function suggestion(priority: HintPriority, from: PileRef, index: number, to: PileRef, cards: readonly CardId[]) {
    return { kind: 'move', priority, command: { type: 'move', from, index, to }, cards };
}

describe('hint: one position per priority', () => {
    it('priority 1: a tableau top onto its foundation', () => {
        const state = frozenState({ tableau: tableauOf([], [], faceUp(c(SPADES, 1))) });
        expect(hint(state)).toEqual(suggestion(1, col(2), 0, home(SPADES), [c(SPADES, 1)]));
    });

    it('priority 1: the waste top onto its foundation', () => {
        const state = frozenState({ waste: [c(SPADES, 9), c(HEARTS, 1)] });
        expect(hint(state)).toEqual(suggestion(1, WASTE, 1, home(HEARTS), [c(HEARTS, 1)]));
    });

    it('priority 2: a whole run revealing a face-down card onto a non-empty column', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(HEARTS, 5), c(SPADES, 4))], faceUp(c(SPADES, 6))),
        });
        expect(hint(state)).toEqual(suggestion(2, col(0), 1, col(1), [c(HEARTS, 5), c(SPADES, 4)]));
    });

    it('priority 3: the waste top onto a tableau column', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6))), waste: [c(HEARTS, 5)] });
        expect(hint(state)).toEqual(suggestion(3, WASTE, 0, col(0), [c(HEARTS, 5)]));
    });

    it('priority 4: a partial run that exposes a card its foundation is ready for', () => {
        const state = frozenState({
            tableau: tableauOf(faceUp(c(HEARTS, 3), c(SPADES, 2)), faceUp(c(DIAMONDS, 3))),
            foundations: foundationsOf(2, 0, 0, 0),
        });
        expect(hint(state)).toEqual(suggestion(4, col(0), 1, col(1), [c(SPADES, 2)]));
    });

    it('priority 5: a King run into an empty column that reveals a face-down card', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(SPADES, 13), c(HEARTS, 12))]),
        });
        expect(hint(state)).toEqual(suggestion(5, col(0), 1, col(1), [c(SPADES, 13), c(HEARTS, 12)]));
    });
});

describe('hint: higher priorities win', () => {
    it('priority 1 beats priority 2, even from a later column', () => {
        const state = frozenState({
            tableau: tableauOf(
                [...faceDown(BURIED), ...faceUp(c(HEARTS, 5))],
                faceUp(c(SPADES, 6)),
                faceUp(c(CLUBS, 1)),
            ),
        });
        expect(hint(state)).toEqual(suggestion(1, col(2), 0, home(CLUBS), [c(CLUBS, 1)]));
    });

    it('priority 1 beats a tableau move of the same waste card', () => {
        const state = frozenState({
            tableau: tableauOf(faceUp(c(SPADES, 3))),
            waste: [c(HEARTS, 2)],
            foundations: foundationsOf(1, 0, 0, 0),
        });
        expect(hint(state)).toEqual(suggestion(1, WASTE, 0, home(HEARTS), [c(HEARTS, 2)]));
    });

    it('priority 2 beats priority 3', () => {
        const state = frozenState({
            tableau: tableauOf(
                [],
                faceUp(c(SPADES, 5)),
                [...faceDown(BURIED), ...faceUp(c(HEARTS, 5))],
                faceUp(c(CLUBS, 6)),
            ),
            waste: [c(DIAMONDS, 4)],
        });
        expect(hint(state)).toEqual(suggestion(2, col(2), 1, col(3), [c(HEARTS, 5)]));
    });

    it('priority 3 beats priority 4', () => {
        const state = frozenState({
            tableau: tableauOf(faceUp(c(HEARTS, 3), c(SPADES, 2)), faceUp(c(SPADES, 5)), faceUp(c(DIAMONDS, 3))),
            waste: [c(DIAMONDS, 4)],
            foundations: foundationsOf(2, 0, 0, 0),
        });
        expect(hint(state)).toEqual(suggestion(3, WASTE, 0, col(1), [c(DIAMONDS, 4)]));
    });

    it('priority 4 beats priority 5', () => {
        const state = frozenState({
            tableau: tableauOf(
                [...faceDown(BURIED), ...faceUp(c(SPADES, 13))],
                faceUp(c(HEARTS, 3), c(SPADES, 2)),
                faceUp(c(DIAMONDS, 3)),
            ),
            foundations: foundationsOf(2, 0, 0, 0),
        });
        expect(hint(state)).toEqual(suggestion(4, col(1), 1, col(2), [c(SPADES, 2)]));
    });
});

describe('hint: King moves', () => {
    it('does not suggest a King run that would reveal nothing', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 13), c(HEARTS, 12))) });
        expect(hint(state)).toBeUndefined();
    });

    it('suggests a revealing whole run that fits only an empty column at priority 5, not 2', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(HEARTS, 13))], faceUp(c(CLUBS, 6)), [], []),
        });
        expect(hint(state)).toEqual(suggestion(5, col(0), 1, col(2), [c(HEARTS, 13)]));
    });

    it('suggests a waste King into the first empty column at priority 3', () => {
        expect(hint(frozenState({ waste: [c(DIAMONDS, 13)] }))).toEqual(
            suggestion(3, WASTE, 0, col(0), [c(DIAMONDS, 13)]),
        );
        const state = frozenState({ tableau: tableauOf(faceUp(c(CLUBS, 5))), waste: [c(DIAMONDS, 13)] });
        expect(hint(state)).toEqual(suggestion(3, WASTE, 0, col(1), [c(DIAMONDS, 13)]));
    });
});

describe('hint: canonical scan order', () => {
    it('takes the first column among several foundation-bound tops', () => {
        const state = frozenState({ tableau: tableauOf([], [], [], faceUp(c(HEARTS, 1)), [], faceUp(c(SPADES, 1))) });
        expect(hint(state)).toEqual(suggestion(1, col(3), 0, home(HEARTS), [c(HEARTS, 1)]));
    });

    it('takes a tableau column before the waste', () => {
        const state = frozenState({ tableau: tableauOf([], [], [], [], faceUp(c(SPADES, 1))), waste: [c(HEARTS, 1)] });
        expect(hint(state)).toEqual(suggestion(1, col(4), 0, home(SPADES), [c(SPADES, 1)]));
    });

    it('takes the first source column among revealing runs', () => {
        const state = frozenState({
            tableau: tableauOf(
                [],
                [...faceDown(BURIED), ...faceUp(c(HEARTS, 5))],
                [],
                [...faceDown(BURIED), ...faceUp(c(DIAMONDS, 5))],
                [],
                faceUp(c(SPADES, 6)),
            ),
        });
        expect(hint(state)).toEqual(suggestion(2, col(1), 1, col(5), [c(HEARTS, 5)]));
    });

    it('takes the first accepting destination for a run', () => {
        const state = frozenState({
            tableau: tableauOf(
                [...faceDown(BURIED), ...faceUp(c(HEARTS, 5))],
                [],
                faceUp(c(CLUBS, 6)),
                [],
                [],
                [],
                faceUp(c(SPADES, 6)),
            ),
        });
        expect(hint(state)).toEqual(suggestion(2, col(0), 1, col(2), [c(HEARTS, 5)]));
    });

    it('takes the first accepting column for the waste top', () => {
        const state = frozenState({
            tableau: tableauOf([], [], [], faceUp(c(CLUBS, 6)), [], faceUp(c(SPADES, 6))),
            waste: [c(HEARTS, 5)],
        });
        expect(hint(state)).toEqual(suggestion(3, WASTE, 0, col(3), [c(HEARTS, 5)]));
    });

    it('prefers the split nearer the base when a column offers two freeing splits', () => {
        // 5♥ and 4♠ are both ready; splitting under 5♥ goes to column 2, splitting under 4♠ to column 1.
        const state = frozenState({
            tableau: tableauOf(
                faceUp(c(HEARTS, 5), c(SPADES, 4), c(DIAMONDS, 3)),
                faceUp(c(CLUBS, 4)),
                faceUp(c(DIAMONDS, 5)),
            ),
            foundations: foundationsOf(4, 0, 0, 3),
        });
        expect(hint(state)).toEqual(suggestion(4, col(0), 1, col(2), [c(SPADES, 4), c(DIAMONDS, 3)]));
    });

    it('skips a source with no accepting destination and takes a later one at priority 2', () => {
        const state = frozenState({
            tableau: tableauOf(
                [...faceDown(BURIED), ...faceUp(c(SPADES, 9))],
                [...faceDown(BURIED), ...faceUp(c(HEARTS, 5))],
                faceUp(c(SPADES, 6)),
            ),
        });
        expect(hint(state)).toEqual(suggestion(2, col(1), 1, col(2), [c(HEARTS, 5)]));
    });

    it('skips a split with no accepting destination and takes the next one at priority 4', () => {
        // Splitting under 5♥ moves 4♠ and 3♦, which nothing accepts; splitting under 4♠ moves 3♦ onto 4♣.
        const state = frozenState({
            tableau: tableauOf(faceUp(c(HEARTS, 5), c(SPADES, 4), c(DIAMONDS, 3)), faceUp(c(CLUBS, 4))),
            foundations: foundationsOf(4, 0, 0, 3),
        });
        expect(hint(state)).toEqual(suggestion(4, col(0), 2, col(1), [c(DIAMONDS, 3)]));
    });

    it('takes a freeing split from a later column when an earlier one does not qualify', () => {
        const state = frozenState({
            tableau: tableauOf(
                faceUp(c(CLUBS, 7), c(DIAMONDS, 6)),
                faceUp(c(HEARTS, 3), c(SPADES, 2)),
                faceUp(c(DIAMONDS, 3)),
            ),
            foundations: foundationsOf(2, 0, 0, 0),
        });
        expect(hint(state)).toEqual(suggestion(4, col(1), 1, col(2), [c(SPADES, 2)]));
    });
});

describe('hint: priority 4 needs a ready, face-up card to expose', () => {
    it('does not suggest a split that exposes a card its foundation is not ready for', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(HEARTS, 3), c(SPADES, 2)), faceUp(c(DIAMONDS, 3))) });
        expect(hint(state)).toBeUndefined();
    });

    it('does not treat a face-down card below a run as exposed by a split', () => {
        // A♠ is ready but face down: moving the run reveals it (priority 5), it is not a freeing split.
        const state = frozenState({
            tableau: tableauOf([...faceDown(c(SPADES, 1)), ...faceUp(c(SPADES, 13), c(HEARTS, 12))]),
        });
        expect(hint(state)).toEqual(suggestion(5, col(0), 1, col(1), [c(SPADES, 13), c(HEARTS, 12)]));
    });
});

describe('hint: stock fallbacks', () => {
    it('suggests a draw while the stock holds cards, even with a waste', () => {
        const state = frozenState({ stock: [c(HEARTS, 9)], waste: [c(SPADES, 9)] });
        expect(hint(state)).toEqual({ kind: 'draw' });
        expect(hint(frozenState({ stock: [c(HEARTS, 9)] }))).toEqual({ kind: 'draw' });
    });

    it('suggests a recycle when the stock is empty and recycling is permitted', () => {
        expect(hint(frozenState({ waste: [c(SPADES, 9)] }))).toEqual({ kind: 'recycle' });
        expect(
            hint(frozenState({ mode: 'vegas', scoring: 'vegas', draw: 3, passes: 2, waste: [c(SPADES, 9)] })),
        ).toEqual({
            kind: 'recycle',
        });
    });

    it('reports nothing at the Vegas pass limit with an exhausted stock', () => {
        expect(hint(vegasAtLimit({ waste: [c(SPADES, 9)] }))).toBeUndefined();
    });

    it('reports nothing when no move and no stock action remains', () => {
        expect(hint(frozenState({}))).toBeUndefined();
    });

    it('prefers a board move to the stock', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(HEARTS, 1))), stock: [c(SPADES, 9)] });
        expect(hint(state)).toEqual(suggestion(1, col(0), 0, home(HEARTS), [c(HEARTS, 1)]));
    });

    it('gives a won game no suggestion', () => {
        const state = frozenState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' });
        expect(hint(state)).toBeUndefined();
    });
});

describe('hint: purity', () => {
    it('is deterministic and leaves a frozen input untouched', () => {
        const state = frozenState({
            tableau: tableauOf([...faceDown(BURIED), ...faceUp(c(HEARTS, 5))], faceUp(c(SPADES, 6))),
            waste: [c(DIAMONDS, 4)],
        });
        const snapshot = JSON.stringify(state);
        expect(hint(state)).toEqual(hint(state));
        expect(JSON.stringify(state)).toBe(snapshot);
    });
});
