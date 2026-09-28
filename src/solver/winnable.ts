import { dealFromSeed } from '../domain/deal';
import { solve } from './solver';

/** The seed `findWinnable` selected, how it was judged, and how many candidates were tried (D4). */
export interface WinnableResult {
    readonly seed: number;
    readonly verdict: 'win' | 'random';
    readonly attempts: number;
}

/**
 * Reject sampling over caller-supplied seeds (D4): each seed is dealt in Draw 1 and searched with `budget` nodes, in
 * order, and the first proven `win` is returned with its 1-based position as `attempts`. When none wins (a `loss` and
 * `unknown` both fail an attempt) the last seed is returned as `random` with `attempts` equal to `seeds.length`.
 * `onAttempt(k)` is called just before attempt `k` is solved, so it never reports an attempt that is not then tried.
 * Returns the seed, not a state, so the caller deals it itself. Deterministic: no `Math.random`, no `crypto`. Throws a
 * `RangeError` for an empty `seeds`, which leaves nothing to return.
 */
export function findWinnable(
    seeds: readonly number[],
    budget: number,
    onAttempt?: (attempt: number) => void,
): WinnableResult {
    let last: number | undefined;
    let attempts = 0;
    for (const seed of seeds) {
        attempts++;
        last = seed;
        onAttempt?.(attempts);
        if (solve(dealFromSeed(seed, 'draw1'), budget).verdict === 'win') {
            return { seed, verdict: 'win', attempts };
        }
    }
    if (last === undefined) {
        throw new RangeError('findWinnable needs at least one candidate seed');
    }
    return { seed: last, verdict: 'random', attempts };
}
