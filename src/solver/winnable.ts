import { GRADES, dealFromSeed } from '../domain/deal';
import type { Grade, Mode } from '../domain/types';
import { gradeDeal, type GradeTarget } from './grading';
import { search } from './search';

/** A proven-winnable candidate that selection graded but did not select. */
export interface Spare {
    readonly seed: number;
    readonly grade: Grade;
}

/**
 * The seed `findWinnable` selected, how it was judged and how many candidates were tried (D4, D7). `grade` is the selected
 * deal's own grade, `undefined` for a `random` fallback, which is never graded. `spares` holds every other proven
 * candidate it graded on the way, in the order they were tried; a `random` fallback has none.
 */
export interface WinnableResult {
    readonly seed: number;
    readonly verdict: 'win' | 'random';
    readonly attempts: number;
    readonly grade: Grade | undefined;
    readonly spares: readonly Spare[];
}

/** Which grade selection wants, and how many proven candidates it may grade before settling for the closest. */
export interface Selection {
    readonly target: GradeTarget;
    readonly gradeLimit: number;
}

/** The selection that takes the first proven deal, whatever its grade, however many candidates that needs. */
export const ANY_SELECTION: Selection = { target: 'any', gradeLimit: Number.POSITIVE_INFINITY };

/** What is known of one seed at the request's budget: its search verdict, and its grade when it is a `win`. */
export type Outcome =
    | { readonly seed: number; readonly verdict: 'win'; readonly grade: Grade }
    | { readonly seed: number; readonly verdict: 'loss' | 'unknown'; readonly grade: undefined };

export interface FindOptions {
    readonly selection?: Selection | undefined;
    /** Verdicts already established at this request's budget: those seeds are neither searched nor graded again. */
    readonly known?: readonly Outcome[] | undefined;
    /** Called just before attempt `k` (from 1) is solved, so it never reports an attempt that is not then tried. */
    readonly onAttempt?: (attempt: number) => void;
    /** Called with each seed that was really searched, once its verdict and grade are settled. */
    readonly onOutcome?: (outcome: Outcome) => void;
}

function distance(from: Grade, to: Grade): number {
    return Math.abs(GRADES.indexOf(from) - GRADES.indexOf(to));
}

/** Searches the deal of `seed` and, when the search proves it, grades it; reports the result to `onOutcome`. */
function solve(seed: number, budget: number, mode: Mode, onOutcome: FindOptions['onOutcome']): Outcome {
    const deal = dealFromSeed(seed, mode);
    const { verdict } = search(deal, budget);
    const outcome: Outcome =
        verdict === 'win' ? { seed, verdict, grade: gradeDeal(deal).grade } : { seed, verdict, grade: undefined };
    onOutcome?.(outcome);
    return outcome;
}

/**
 * Reject sampling over caller-supplied seeds (D4, D7): each seed is dealt in `mode` and searched with `budget` nodes by
 * the search that fits the mode (Draw 1 and Daily, or the ordered-talon search), in order, unless `known` already
 * says how it fares. A proven `win` is graded. With the target `any` the first win is selected. With a grade, the first
 * win of that grade is selected; failing that, once `gradeLimit` wins have been graded or the seeds run out, the win
 * whose grade is closest to the target (the earlier on a tie), labelled with its own grade. `attempts` is the 1-based
 * position of the selected seed when it is the first win or an exact match, and otherwise the number of candidates
 * tried. When none wins (a `loss` and `unknown` both fail an attempt) the last seed is returned as `random`, ungraded,
 * with `attempts` equal to `seeds.length`. Returns seeds, not states, so the caller deals them itself. Deterministic
 * and unchanged by `known`, which only saves work: no `Math.random`, no `crypto`. Throws a `RangeError` for an empty
 * `seeds`, which leaves nothing to return.
 */
export function findWinnable(
    seeds: readonly number[],
    budget: number,
    mode: Mode,
    { selection = ANY_SELECTION, known = [], onAttempt, onOutcome }: FindOptions = {},
): WinnableResult {
    if (seeds.length === 0) {
        throw new RangeError('findWinnable needs at least one candidate seed');
    }
    const { target, gradeLimit } = selection;
    const remembered = new Map(known.map((outcome) => [outcome.seed, outcome]));
    const graded: Spare[] = [];
    let closest: Spare | undefined;
    let attempts = 0;
    let last = 0;
    for (const seed of seeds) {
        attempts++;
        last = seed;
        onAttempt?.(attempts);
        const outcome = remembered.get(seed) ?? solve(seed, budget, mode, onOutcome);
        if (outcome.verdict !== 'win') continue;
        const { grade } = outcome;
        if (target === 'any' || grade === target) {
            return { seed, verdict: 'win', attempts, grade, spares: graded };
        }
        const candidate: Spare = { seed, grade };
        graded.push(candidate);
        if (closest === undefined || distance(grade, target) < distance(closest.grade, target)) closest = candidate;
        if (graded.length >= gradeLimit) break;
    }
    if (closest === undefined) {
        return { seed: last, verdict: 'random', attempts, grade: undefined, spares: [] };
    }
    const selected = closest;
    return {
        seed: selected.seed,
        verdict: 'win',
        attempts,
        grade: selected.grade,
        spares: graded.filter((spare) => spare !== selected),
    };
}
