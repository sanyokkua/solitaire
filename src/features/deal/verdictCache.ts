/**
 * The seed verdict cache (D8): what the solver's searches have established about a seed at one mode and budget, kept in
 * memory so a restarted search, or a Daily candidate list that is the same all day, is not searched or graded twice.
 * Search and grading are deterministic, so the cache never changes which deal is selected, only how long it takes.
 * Nothing about it is stored. Pure: no timers, no I/O.
 */
import type { Mode } from '../../domain/types';
import type { Outcome } from '../../solver/winnable';

const DEFAULT_LIMIT = 256;

export interface VerdictCache {
    /** The entries held for exactly `seeds` at `mode` and `budget`, in no particular order; each read is a use. */
    readonly known: (mode: Mode, budget: number, seeds: readonly number[]) => Outcome[];
    /** Stores `outcome` for `mode` and `budget`; recording an entry again refreshes it. */
    readonly record: (mode: Mode, budget: number, outcome: Outcome) => void;
}

/** Creates a cache that holds at most `limit` outcomes and drops the least recently used first. */
export function createVerdictCache(limit = DEFAULT_LIMIT): VerdictCache {
    // A Map iterates in insertion order, so deleting and setting an entry moves it to the most recent end.
    const entries = new Map<string, Outcome>();
    const keyOf = (mode: Mode, budget: number, seed: number): string => `${mode}:${String(budget)}:${String(seed)}`;

    function known(mode: Mode, budget: number, seeds: readonly number[]): Outcome[] {
        const held: Outcome[] = [];
        for (const seed of seeds) {
            const key = keyOf(mode, budget, seed);
            const outcome = entries.get(key);
            if (outcome !== undefined) {
                entries.delete(key);
                entries.set(key, outcome);
                held.push(outcome);
            }
        }
        return held;
    }

    function record(mode: Mode, budget: number, outcome: Outcome): void {
        const key = keyOf(mode, budget, outcome.seed);
        entries.delete(key);
        entries.set(key, outcome);
        if (entries.size > limit) {
            const oldest = entries.keys().next();
            if (oldest.done !== true) {
                entries.delete(oldest.value);
            }
        }
    }

    return { known, record };
}
