import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { canDrop, legalTargets } from '../../../src/domain/rules';
import type { GameState, PileRef, TableauCol } from '../../../src/domain/types';
import { deepFreeze, faceUp, makeState } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const CLUBS = 2;
const SPADES = 3;

const tableauRef = (col: TableauCol): PileRef => ({ pile: 'tableau', col });
const foundationRef = (suit: 0 | 1 | 2 | 3): PileRef => ({ pile: 'foundation', suit });

describe('canDrop onto a non-empty column', () => {
    // Column 0 is topped by 7♥.
    const state = deepFreeze(
        makeState({ tableau: [faceUp(cardId(SPADES, 9), cardId(HEARTS, 7)), [], [], [], [], [], []] }),
    );

    it('accepts one rank lower in the opposite colour', () => {
        expect(canDrop(state, [cardId(CLUBS, 6)], tableauRef(0))).toBe(true);
        expect(canDrop(state, [cardId(SPADES, 6)], tableauRef(0))).toBe(true);
    });

    it('accepts a multi-card group by its lowest card', () => {
        expect(canDrop(state, [cardId(CLUBS, 6), cardId(DIAMONDS, 5)], tableauRef(0))).toBe(true);
    });

    it('rejects the same colour', () => {
        expect(canDrop(state, [cardId(DIAMONDS, 6)], tableauRef(0))).toBe(false);
        expect(canDrop(state, [cardId(HEARTS, 6)], tableauRef(0))).toBe(false);
    });

    it('rejects the wrong rank', () => {
        expect(canDrop(state, [cardId(CLUBS, 5)], tableauRef(0))).toBe(false);
        expect(canDrop(state, [cardId(CLUBS, 7)], tableauRef(0))).toBe(false);
        expect(canDrop(state, [cardId(CLUBS, 8)], tableauRef(0))).toBe(false);
    });

    it('rejects an empty group', () => {
        expect(canDrop(state, [], tableauRef(0))).toBe(false);
    });
});

describe('canDrop onto an empty column', () => {
    const state = deepFreeze(makeState());

    it('accepts a King and a King-led run', () => {
        expect(canDrop(state, [cardId(SPADES, 13)], tableauRef(3))).toBe(true);
        expect(canDrop(state, [cardId(HEARTS, 13), cardId(CLUBS, 12)], tableauRef(3))).toBe(true);
    });

    it('rejects every other rank', () => {
        expect(canDrop(state, [cardId(SPADES, 12)], tableauRef(3))).toBe(false);
        expect(canDrop(state, [cardId(SPADES, 1)], tableauRef(3))).toBe(false);
    });
});

describe('canDrop onto a foundation', () => {
    const state = deepFreeze(makeState({ foundations: [[cardId(HEARTS, 1), cardId(HEARTS, 2)], [], [], []] }));

    it('accepts an Ace onto an empty foundation of its suit', () => {
        expect(canDrop(state, [cardId(SPADES, 1)], foundationRef(SPADES))).toBe(true);
    });

    it('accepts the next rank of the suit', () => {
        expect(canDrop(state, [cardId(HEARTS, 3)], foundationRef(HEARTS))).toBe(true);
    });

    it('rejects a rank skip and a repeated rank', () => {
        expect(canDrop(state, [cardId(HEARTS, 4)], foundationRef(HEARTS))).toBe(false);
        expect(canDrop(state, [cardId(HEARTS, 2)], foundationRef(HEARTS))).toBe(false);
    });

    it('rejects a non-Ace onto an empty foundation', () => {
        expect(canDrop(state, [cardId(SPADES, 2)], foundationRef(SPADES))).toBe(false);
    });

    it('rejects the wrong suit', () => {
        expect(canDrop(state, [cardId(SPADES, 3)], foundationRef(HEARTS))).toBe(false);
        expect(canDrop(state, [cardId(DIAMONDS, 1)], foundationRef(HEARTS))).toBe(false);
    });

    it('rejects a multi-card group even when its lowest card would fit', () => {
        expect(canDrop(state, [cardId(HEARTS, 3), cardId(SPADES, 2)], foundationRef(HEARTS))).toBe(false);
    });
});

describe('canDrop from a foundation', () => {
    const state = deepFreeze(
        makeState({
            tableau: [faceUp(cardId(CLUBS, 4)), [], [], [], [], [], []],
            foundations: [[cardId(HEARTS, 1), cardId(HEARTS, 2), cardId(HEARTS, 3)], [cardId(DIAMONDS, 1)], [], []],
        }),
    );

    it('lets a foundation top return to a column under the tableau rule', () => {
        expect(canDrop(state, [cardId(HEARTS, 3)], tableauRef(0))).toBe(true);
    });

    it('refuses foundation to foundation, including its own foundation', () => {
        expect(canDrop(state, [cardId(HEARTS, 3)], foundationRef(DIAMONDS))).toBe(false);
        expect(canDrop(state, [cardId(HEARTS, 3)], foundationRef(HEARTS))).toBe(false);
        expect(
            legalTargets(state, [cardId(HEARTS, 3)], foundationRef(HEARTS)).some((t) => t.pile === 'foundation'),
        ).toBe(false);
    });
});

describe('canDrop onto the stock or the waste', () => {
    it('never accepts', () => {
        const state = deepFreeze(makeState());
        expect(canDrop(state, [cardId(SPADES, 13)], { pile: 'stock' })).toBe(false);
        expect(canDrop(state, [cardId(SPADES, 13)], { pile: 'waste' })).toBe(false);
    });
});

describe('legalTargets', () => {
    // 2♥ is accepted by the hearts foundation (holding A♥), by 3♠ in column 2 and by 3♣ in column 5.
    const twoHearts = cardId(HEARTS, 2);
    const state: GameState = deepFreeze(
        makeState({
            tableau: [
                faceUp(cardId(HEARTS, 9)),
                [],
                faceUp(cardId(SPADES, 3)),
                faceUp(cardId(DIAMONDS, 8)),
                [],
                faceUp(cardId(CLUBS, 3)),
                [],
            ],
            waste: [twoHearts],
            foundations: [[cardId(HEARTS, 1)], [], [], []],
        }),
    );

    it('lists the foundation first, then columns in ascending order', () => {
        expect(legalTargets(state, [twoHearts], { pile: 'waste' })).toEqual([
            foundationRef(HEARTS),
            tableauRef(2),
            tableauRef(5),
        ]);
    });

    it('lists nothing when no pile accepts the group', () => {
        expect(legalTargets(state, [cardId(SPADES, 12)], { pile: 'waste' })).toEqual([]);
    });

    it('lists empty columns in order for a King', () => {
        expect(legalTargets(state, [cardId(SPADES, 13)], { pile: 'waste' })).toEqual([
            tableauRef(1),
            tableauRef(4),
            tableauRef(6),
        ]);
    });

    it('never lists the source pile, even when it would accept the group', () => {
        // Hypothetical input: 2♥ claimed to come from column 2, whose 3♠ top would accept it.
        expect(legalTargets(state, [twoHearts], tableauRef(2))).toEqual([foundationRef(HEARTS), tableauRef(5)]);
    });
});
