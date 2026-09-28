import { describe, expect, it, vi } from 'vitest';
import type * as SolverModule from '../../../src/solver/solver';
import { findWinnable } from '../../../src/solver/winnable';
import { corpusSeeds } from '../../fixtures/solverCorpus';

/** Everything `solve` and `onAttempt` do, in call order; `solve` is wrapped, never replaced. */
const events: string[] = [];

vi.mock('../../../src/solver/solver', async (importOriginal) => {
    const original = await importOriginal<typeof SolverModule>();
    return {
        ...original,
        solve: (...args: Parameters<typeof original.solve>) => {
            events.push('solve');
            return original.solve(...args);
        },
    };
});

const BUDGET = 5000;
const FASTEST_WIN_SEED = 19;

const [WIN_SEED = 0, OTHER_WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');
const [UNKNOWN_SEED = 0] = corpusSeeds('unknown');

/** Runs `findWinnable` and records every `onAttempt` number, in order. */
function run(seeds: readonly number[], budget = BUDGET) {
    const attempts: number[] = [];
    const result = findWinnable(seeds, budget, (attempt) => attempts.push(attempt));
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
        expect(result).toEqual({ seed: WIN_SEED, verdict: 'win', attempts: 1 });
        expect(attempts).toEqual([1]);
    });

    it('skips failed candidates, reporting each attempt in order and stopping at the win', () => {
        const { result, attempts } = run([LOSS_SEED, UNKNOWN_SEED, WIN_SEED, OTHER_WIN_SEED]);
        expect(result).toEqual({ seed: WIN_SEED, verdict: 'win', attempts: 3 });
        expect(attempts).toEqual([1, 2, 3]);
    });

    it('reports attempt k before solving it', () => {
        events.length = 0;
        const result = findWinnable([LOSS_SEED, WIN_SEED], BUDGET, (attempt) => {
            events.push(`attempt ${String(attempt)}`);
        });
        expect(events).toEqual(['attempt 1', 'solve', 'attempt 2', 'solve']);
        expect(result.verdict).toBe('win');
    });

    it('falls back to the last seed as random when no candidate wins', () => {
        const { result, attempts } = run([LOSS_SEED, UNKNOWN_SEED]);
        expect(result).toEqual({ seed: UNKNOWN_SEED, verdict: 'random', attempts: 2 });
        expect(attempts).toEqual([1, 2]);
    });

    it('searches each deal with the given budget', () => {
        expect(run([FASTEST_WIN_SEED], 1).result).toEqual({ seed: FASTEST_WIN_SEED, verdict: 'random', attempts: 1 });
        expect(run([FASTEST_WIN_SEED], BUDGET).result).toEqual({ seed: FASTEST_WIN_SEED, verdict: 'win', attempts: 1 });
    });

    it('works without an attempt callback', () => {
        expect(findWinnable([LOSS_SEED, WIN_SEED], BUDGET)).toEqual({ seed: WIN_SEED, verdict: 'win', attempts: 2 });
    });

    it('refuses an empty seed list', () => {
        const onAttempt = vi.fn();
        expect(() => findWinnable([], BUDGET, onAttempt)).toThrow(RangeError);
        expect(onAttempt).not.toHaveBeenCalled();
    });

    it('is deterministic', () => {
        const seeds = [LOSS_SEED, UNKNOWN_SEED, WIN_SEED];
        expect(findWinnable(seeds, BUDGET)).toEqual(findWinnable(seeds, BUDGET));
    });
});
