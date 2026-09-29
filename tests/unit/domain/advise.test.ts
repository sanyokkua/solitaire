import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { advise } from '../../../src/domain/deadEnd';
import { hint } from '../../../src/domain/hint';
import { faceUp, foundationsOf, frozenState, tableauOf } from '../../fixtures/states';

const HEARTS = 0;
const DIAMONDS = 1;
const SPADES = 3;

const c = cardId;

describe('advise', () => {
    it('reports a dead end rather than a draw when no stock card can be played anywhere', () => {
        const state = frozenState({ stock: [c(HEARTS, 9)], waste: [c(SPADES, 9)] });
        expect(hint(state)).toEqual({ kind: 'draw' });
        expect(advise(state)).toEqual({ kind: 'dead-end' });
    });

    it('reports a dead end rather than a recycle when the pass limit leaves nothing playable', () => {
        const state = frozenState({ waste: [c(SPADES, 9)] });
        expect(hint(state)).toEqual({ kind: 'recycle' });
        expect(advise(state)).toEqual({ kind: 'dead-end' });
    });

    it('reports a dead end rather than a Draw 3 draw when the playable card is one the grouping never uncovers', () => {
        // Stock top-down: H1 S9 D9. The one draw leaves D9 on top, and the ace stays buried under it.
        const state = frozenState({
            mode: 'draw3',
            draw: 3,
            stock: [c(DIAMONDS, 9), c(SPADES, 9), c(HEARTS, 1)],
        });
        expect(hint(state)).toEqual({ kind: 'draw' });
        expect(advise(state)).toEqual({ kind: 'dead-end' });
    });

    it('returns the productive move, with priority 1 for a card that goes home', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 1))), stock: [c(HEARTS, 9)] });
        expect(advise(state)).toEqual({
            kind: 'move',
            priority: 1,
            command: {
                type: 'move',
                from: { pile: 'tableau', col: 0 },
                index: 0,
                to: { pile: 'foundation', suit: SPADES },
            },
            cards: [c(SPADES, 1)],
        });
    });

    it('returns a draw when no board move exists but a stock card can be played', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6))), stock: [c(HEARTS, 5)] });
        expect(advise(state)).toEqual({ kind: 'draw' });
    });

    it('returns a recycle when the stock is empty, the waste is not, and it is not a dead end', () => {
        const state = frozenState({ waste: [c(HEARTS, 1), c(SPADES, 9)] });
        expect(advise(state)).toEqual({ kind: 'recycle' });
    });

    it('is deterministic', () => {
        const state = frozenState({ tableau: tableauOf(faceUp(c(SPADES, 6))), stock: [c(HEARTS, 5)] });
        expect(advise(state)).toEqual(advise(state));
    });

    it('has no advice for a won position', () => {
        expect(advise(frozenState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' }))).toBeUndefined();
    });
});
