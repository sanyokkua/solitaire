import { describe, expect, it } from 'vitest';
import { bestTarget } from '../../../../src/domain/smartTap';
import { legalTargets } from '../../../../src/domain/rules';
import { SEVEN_OF_SPADES, SEVEN_OF_CLUBS, SIX_OF_DIAMONDS, twoTargetsPosition } from '../../../fixtures/boardPositions';

describe('twoTargetsPosition', () => {
    it('has one card with two legal columns, and Smart move prefers the one the keyboard spec does not use', () => {
        const state = twoTargetsPosition();
        const from = { pile: 'tableau', col: 0 } as const;

        const targets = legalTargets(state, [SIX_OF_DIAMONDS], from);

        expect(targets).toContainEqual({ pile: 'tableau', col: 1 });
        expect(targets).toContainEqual({ pile: 'tableau', col: 2 });
        expect(bestTarget(state, from, 0)).toEqual({ pile: 'tableau', col: 1 });
        expect(bestTarget(state, from, 0)).not.toEqual({ pile: 'tableau', col: 2 });
        expect(state.tableau[1][0]?.id).toBe(SEVEN_OF_CLUBS);
        expect(state.tableau[2][0]?.id).toBe(SEVEN_OF_SPADES);
    });

    it('places every card once', () => {
        const state = twoTargetsPosition();
        const ids = [...state.stock, ...state.tableau.flat().map((card) => card.id)];

        expect(new Set(ids).size).toBe(52);
        expect(ids).toHaveLength(52);
    });
});
