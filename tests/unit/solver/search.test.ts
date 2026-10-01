import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../src/domain/deal';
import { solveOrdered } from '../../../src/solver/ordered';
import { search } from '../../../src/solver/search';
import { solve } from '../../../src/solver/solver';

const BUDGET = 2000;

describe('search', () => {
    it.each(['draw1', 'daily'] as const)('sends a %s position to the Draw 1 search', (mode) => {
        const state = dealFromSeed(19, mode);
        expect(search(state, BUDGET)).toEqual(solve(state, BUDGET));
        expect(search(state, BUDGET).verdict).toBe('win');
    });

    it.each(['draw3', 'vegas'] as const)('sends a %s position to the ordered-talon search', (mode) => {
        const state = dealFromSeed(8, mode);
        expect(search(state, BUDGET)).toEqual(solveOrdered(state, BUDGET));
        expect(search(state, BUDGET).nodes).toBeGreaterThan(0);
    });

    it('leaves a position with mismatched draw and mode unsearched', () => {
        const oneCardVegas = { ...dealFromSeed(19, 'vegas'), draw: 1 as const };
        expect(search(oneCardVegas, BUDGET)).toEqual({ verdict: 'unknown', nodes: 0 });
    });
});
