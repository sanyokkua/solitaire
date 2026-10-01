// covers: KS-DEAL-03, KS-DEAL-05
import { describe, expect, it, vi } from 'vitest';
import { dealFromSeed } from '../../../src/domain/deal';
import type { Mode } from '../../../src/domain/types';
import { gradeDeal } from '../../../src/solver/grading';
import { findWinnable } from '../../../src/solver/winnable';
import { corpusSeeds } from '../../fixtures/solverCorpus';

const BUDGET = 5000;
const FASTEST_WIN_SEED = 19;

const [WIN_SEED = 0, OTHER_WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');
const [UNKNOWN_SEED = 0] = corpusSeeds('unknown');

/** Runs `findWinnable` and records every `onAttempt` number, in order. */
function run(seeds: readonly number[], budget = BUDGET, mode: Mode = 'draw1') {
    const attempts: number[] = [];
    const result = findWinnable(seeds, budget, mode, { onAttempt: (attempt) => attempts.push(attempt) });
    return { result, attempts };
}

describe('findWinnable', () => {
    it('picks the fixture seeds from the corpus', () => {
        expect(new Set([WIN_SEED, OTHER_WIN_SEED, LOSS_SEED, UNKNOWN_SEED]).size).toBe(4);
        expect(WIN_SEED).toBeGreaterThan(0);
        expect(OTHER_WIN_SEED).toBeGreaterThan(0);
        expect(LOSS_SEED).toBeGreaterThan(0);
        expect(UNKNOWN_SEED).toBeGreaterThan(0);
    });

    it('selects the first candidate when it is winnable', () => {
        const { result, attempts } = run([WIN_SEED]);
        expect(result).toMatchObject({ seed: WIN_SEED, verdict: 'win', attempts: 1 });
        expect(attempts).toEqual([1]);
    });

    it('skips failed candidates, reporting each attempt in order and stopping at the win', () => {
        const { result, attempts } = run([LOSS_SEED, UNKNOWN_SEED, WIN_SEED, OTHER_WIN_SEED]);
        expect(result).toMatchObject({ seed: WIN_SEED, verdict: 'win', attempts: 3 });
        expect(attempts).toEqual([1, 2, 3]);
    });

    it('reports each attempt number in order, one per candidate tried', () => {
        const { result, attempts } = run([LOSS_SEED, WIN_SEED]);
        expect(attempts).toEqual([1, 2]);
        expect(result).toMatchObject({ seed: WIN_SEED, verdict: 'win', attempts: 2 });
    });

    it('falls back to the last seed as random when no candidate wins', () => {
        const { result, attempts } = run([LOSS_SEED, UNKNOWN_SEED]);
        expect(result).toMatchObject({ seed: UNKNOWN_SEED, verdict: 'random', attempts: 2 });
        expect(attempts).toEqual([1, 2]);
    });

    it('searches each deal with the given budget', () => {
        expect(run([FASTEST_WIN_SEED], 1).result).toMatchObject({
            seed: FASTEST_WIN_SEED,
            verdict: 'random',
            attempts: 1,
        });
        expect(run([FASTEST_WIN_SEED], BUDGET).result).toMatchObject({
            seed: FASTEST_WIN_SEED,
            verdict: 'win',
            attempts: 1,
        });
    });

    it('works without an attempt callback', () => {
        expect(findWinnable([LOSS_SEED, WIN_SEED], BUDGET, 'draw1')).toMatchObject({
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 2,
        });
    });

    it('grades the selected deal, and grades nothing else for Any', () => {
        const result = findWinnable([LOSS_SEED, WIN_SEED, OTHER_WIN_SEED], BUDGET, 'draw1');
        expect(result.grade).toBe(gradeDeal(dealFromSeed(WIN_SEED, 'draw1')).grade);
        expect(result.spares).toEqual([]);
    });

    it('gives a random fallback no grade and no spares', () => {
        expect(findWinnable([LOSS_SEED, UNKNOWN_SEED], BUDGET, 'draw1')).toMatchObject({
            grade: undefined,
            spares: [],
        });
    });

    it('refuses an empty seed list', () => {
        const onAttempt = vi.fn();
        expect(() => findWinnable([], BUDGET, 'draw1', { onAttempt })).toThrow(RangeError);
        expect(onAttempt).not.toHaveBeenCalled();
    });

    it('is deterministic', () => {
        const seeds = [LOSS_SEED, UNKNOWN_SEED, WIN_SEED];
        expect(findWinnable(seeds, BUDGET, 'draw1')).toEqual(findWinnable(seeds, BUDGET, 'draw1'));
    });
});

describe('findWinnable in Draw 3, Vegas and Daily', () => {
    // Pinned with the ordered-talon search at 5,000 nodes: Draw 3 seed 1 is unknown, 10 is a loss, 8 a win; Vegas seed
    // 9 is a loss, 21 a win, and Draw 3's winner 8 is unknown in Vegas.
    it('deals and searches each candidate in Draw 3', () => {
        expect(run([1, 10, 8], BUDGET, 'draw3')).toMatchObject({
            result: { seed: 8, verdict: 'win', attempts: 3 },
            attempts: [1, 2, 3],
        });
    });

    it('deals and searches each candidate in Vegas', () => {
        expect(run([9, 21], BUDGET, 'vegas')).toMatchObject({
            result: { seed: 21, verdict: 'win', attempts: 2 },
            attempts: [1, 2],
        });
    });

    it('judges the same seed by the rules of the mode it is dealt in', () => {
        expect(findWinnable([8], BUDGET, 'draw3').verdict).toBe('win');
        expect(findWinnable([8], BUDGET, 'vegas')).toMatchObject({ seed: 8, verdict: 'random', attempts: 1 });
    });

    it('falls back to the last seed as random when no Draw 3 candidate is proven', () => {
        expect(findWinnable([1, 10], BUDGET, 'draw3')).toMatchObject({ seed: 10, verdict: 'random', attempts: 2 });
    });

    it('treats Daily as Draw 1', () => {
        const seeds = [LOSS_SEED, UNKNOWN_SEED, WIN_SEED];
        expect(findWinnable(seeds, BUDGET, 'daily')).toEqual(findWinnable(seeds, BUDGET, 'draw1'));
    });
});
