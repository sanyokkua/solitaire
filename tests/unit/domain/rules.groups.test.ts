import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { column, columnTop, foundationTop, groupAt, isMovable, wasteTop } from '../../../src/domain/rules';
import type { Column, GameState, PileRef } from '../../../src/domain/types';
import { deepFreeze, faceDown, faceUp, makeState } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const CLUBS = 2;
const SPADES = 3;

const kingSpades = cardId(SPADES, 13);
const queenHearts = cardId(HEARTS, 12);
const jackClubs = cardId(CLUBS, 11);

const col0: PileRef = { pile: 'tableau', col: 0 };
const waste: PileRef = { pile: 'waste' };
const stock: PileRef = { pile: 'stock' };
const hearts: PileRef = { pile: 'foundation', suit: HEARTS };

/** A frozen position whose only non-empty tableau column is column 0. */
function withColumn0(cards: Column): GameState {
    return deepFreeze(makeState({ tableau: [cards, [], [], [], [], [], []] }));
}

/** K♠ Q♥ J♣ — a complete alternating run, all face up, over a face-down 9♦. */
const runColumn = [...faceDown(cardId(DIAMONDS, 9)), ...faceUp(kingSpades, queenHearts, jackClubs)];

describe('pile accessors', () => {
    const state = deepFreeze(
        makeState({
            tableau: [faceUp(kingSpades, queenHearts), [], [], [], [], [], []],
            waste: [cardId(HEARTS, 4), cardId(CLUBS, 7)],
            foundations: [[cardId(HEARTS, 1), cardId(HEARTS, 2)], [], [], []],
        }),
    );

    it('reads a column and its top card', () => {
        expect(column(state, 0)).toEqual(faceUp(kingSpades, queenHearts));
        expect(columnTop(state, 0)).toEqual({ id: queenHearts, up: true });
    });

    it('reads the top of the waste and of a foundation', () => {
        expect(wasteTop(state)).toBe(cardId(CLUBS, 7));
        expect(foundationTop(state, HEARTS)).toBe(cardId(HEARTS, 2));
    });

    it('reports an empty pile as having no top', () => {
        expect(columnTop(state, 3)).toBeUndefined();
        expect(foundationTop(state, SPADES)).toBeUndefined();
        expect(wasteTop(makeState())).toBeUndefined();
    });
});

describe('groupAt from the tableau', () => {
    it('yields the grabbed face-up card and every card above it', () => {
        const state = withColumn0(runColumn);
        expect(groupAt(state, col0, 2)).toEqual([queenHearts, jackClubs]);
    });

    it('lets a full run and a single top card be grabbed', () => {
        const state = withColumn0(runColumn);
        expect(groupAt(state, col0, 1)).toEqual([kingSpades, queenHearts, jackClubs]);
        expect(groupAt(state, col0, 3)).toEqual([jackClubs]);
    });

    it('yields nothing when the cards above do not descend by one rank', () => {
        const state = withColumn0(faceUp(cardId(HEARTS, 9), cardId(SPADES, 5)));
        expect(groupAt(state, col0, 0)).toBeUndefined();
        expect(groupAt(state, col0, 1)).toEqual([cardId(SPADES, 5)]);
    });

    it('yields nothing when the cards above do not alternate colours', () => {
        const state = withColumn0(faceUp(queenHearts, cardId(DIAMONDS, 11)));
        expect(groupAt(state, col0, 0)).toBeUndefined();
    });

    it('yields nothing when the run breaks partway up', () => {
        const state = withColumn0(faceUp(kingSpades, queenHearts, cardId(HEARTS, 3)));
        expect(groupAt(state, col0, 0)).toBeUndefined();
        expect(groupAt(state, col0, 1)).toBeUndefined();
        expect(groupAt(state, col0, 2)).toEqual([cardId(HEARTS, 3)]);
    });

    it('yields nothing for a face-down card', () => {
        const state = withColumn0(runColumn);
        expect(groupAt(state, col0, 0)).toBeUndefined();
    });

    it('yields nothing for an empty column', () => {
        expect(groupAt(withColumn0([]), col0, 0)).toBeUndefined();
    });
});

describe('groupAt from the waste, a foundation and the stock', () => {
    const a = cardId(HEARTS, 4);
    const b = cardId(CLUBS, 7);
    const c = cardId(SPADES, 9);
    const state = deepFreeze(makeState({ stock: [a, b, c], waste: [a, b, c], foundations: [[a, b, c], [], [], []] }));

    it('grabs only the top of the waste', () => {
        expect(groupAt(state, waste, 2)).toEqual([c]);
        expect(groupAt(state, waste, 1)).toBeUndefined();
        expect(groupAt(state, waste, 0)).toBeUndefined();
    });

    it('grabs only the top of a foundation', () => {
        expect(groupAt(state, hearts, 2)).toEqual([c]);
        expect(groupAt(state, hearts, 1)).toBeUndefined();
        expect(groupAt(state, hearts, 0)).toBeUndefined();
    });

    it('never grabs from the stock', () => {
        for (const index of [0, 1, 2]) {
            expect(groupAt(state, stock, index)).toBeUndefined();
        }
    });
});

describe('groupAt with a position outside the pile', () => {
    const state = deepFreeze(
        makeState({
            tableau: [faceUp(kingSpades, queenHearts, jackClubs), [], [], [], [], [], []],
            waste: [cardId(HEARTS, 4), cardId(CLUBS, 7), cardId(SPADES, 9)],
            foundations: [[cardId(HEARTS, 1), cardId(HEARTS, 2), cardId(HEARTS, 3)], [], [], []],
        }),
    );

    it.each([-1, 3, 99, 1.5, Number.NaN])('yields nothing without throwing at index %s', (index) => {
        expect(groupAt(state, col0, index)).toBeUndefined();
        expect(groupAt(state, waste, index)).toBeUndefined();
        expect(groupAt(state, hearts, index)).toBeUndefined();
        expect(groupAt(state, stock, index)).toBeUndefined();
    });
});

describe('isMovable', () => {
    it('is true exactly when a group is produced', () => {
        const state = withColumn0(runColumn);
        expect(isMovable(state, col0, 2)).toBe(true);
        expect(isMovable(state, col0, 0)).toBe(false);
        expect(isMovable(state, col0, 9)).toBe(false);
        expect(isMovable(state, stock, 0)).toBe(false);
    });
});
