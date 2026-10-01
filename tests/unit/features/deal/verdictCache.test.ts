import { describe, expect, it } from 'vitest';
import { createVerdictCache } from '../../../../src/features/deal/verdictCache';
import type { Outcome } from '../../../../src/solver/winnable';

function win(seed: number): Outcome {
    return { seed, verdict: 'win', grade: 'easy' };
}

function loss(seed: number): Outcome {
    return { seed, verdict: 'loss', grade: undefined };
}

describe('verdict cache', () => {
    it('returns a recorded outcome for its mode, budget and seed', () => {
        const cache = createVerdictCache();
        cache.record('draw1', 5000, win(7));
        cache.record('draw1', 5000, loss(8));

        expect(cache.known('draw1', 5000, [7])).toEqual([win(7)]);
        expect(cache.known('draw1', 5000, [8])).toEqual([loss(8)]);
    });

    it('returns nothing for a seed it does not hold, a different budget or a different mode', () => {
        const cache = createVerdictCache();
        cache.record('draw1', 5000, win(7));

        expect(cache.known('draw1', 5000, [9])).toEqual([]);
        expect(cache.known('draw1', 20000, [7])).toEqual([]);
        expect(cache.known('draw3', 5000, [7])).toEqual([]);
    });

    it('keeps the same seed apart across modes and budgets', () => {
        const cache = createVerdictCache();
        cache.record('draw1', 5000, win(7));
        cache.record('draw3', 5000, loss(7));
        cache.record('draw1', 20000, { seed: 7, verdict: 'unknown', grade: undefined });

        expect(cache.known('draw1', 5000, [7])).toEqual([win(7)]);
        expect(cache.known('draw3', 5000, [7])).toEqual([loss(7)]);
        expect(cache.known('draw1', 20000, [7])).toEqual([{ seed: 7, verdict: 'unknown', grade: undefined }]);
    });

    it('returns only the seeds asked for, whatever their order', () => {
        const cache = createVerdictCache();
        cache.record('daily', 20000, win(1));
        cache.record('daily', 20000, loss(2));
        cache.record('daily', 20000, win(3));

        const known = cache.known('daily', 20000, [3, 99, 1]);

        expect(known).toHaveLength(2);
        expect(known).toEqual(expect.arrayContaining([win(1), win(3)]));
    });

    it('drops the least recently used entry first at the limit', () => {
        const cache = createVerdictCache(2);
        cache.record('draw1', 5000, win(1));
        cache.record('draw1', 5000, win(2));
        cache.record('draw1', 5000, win(3));

        expect(cache.known('draw1', 5000, [1, 2, 3])).toEqual(expect.arrayContaining([win(2), win(3)]));
        expect(cache.known('draw1', 5000, [1])).toEqual([]);
    });

    it('counts a read as a use', () => {
        const cache = createVerdictCache(2);
        cache.record('draw1', 5000, win(1));
        cache.record('draw1', 5000, win(2));
        cache.known('draw1', 5000, [1]);
        cache.record('draw1', 5000, win(3));

        expect(cache.known('draw1', 5000, [2])).toEqual([]);
        expect(cache.known('draw1', 5000, [1, 3])).toEqual(expect.arrayContaining([win(1), win(3)]));
    });

    it('refreshes an entry that is recorded again', () => {
        const cache = createVerdictCache(2);
        cache.record('draw1', 5000, win(1));
        cache.record('draw1', 5000, win(2));
        cache.record('draw1', 5000, win(1));
        cache.record('draw1', 5000, win(3));

        expect(cache.known('draw1', 5000, [2])).toEqual([]);
        expect(cache.known('draw1', 5000, [1, 3])).toHaveLength(2);
    });

    it('holds 256 entries by default', () => {
        const cache = createVerdictCache();
        for (let seed = 0; seed < 257; seed++) {
            cache.record('draw1', 5000, win(seed));
        }

        expect(cache.known('draw1', 5000, [0])).toEqual([]);
        expect(cache.known('draw1', 5000, [1, 256])).toHaveLength(2);
    });
});
