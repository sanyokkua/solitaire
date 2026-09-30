/**
 * Pinned Daily v1 selections for ten fixed UTC dates: month ends, year ends and two dates that need a second attempt.
 *
 * Each entry is the seed `findWinnable(dailySeeds(day), DAILY_V1.budget)` picks and the attempt that won. Recipe
 * (design D2, D7): the reference solver copied verbatim from `git show d72187f:docs/spec/mockup/klondike-mockup.html`
 * (`mulberry32`, `shuffle`, `dealFrom`, `solveDraw1`), run at a 20,000-node budget over the Daily step's candidates
 * `(YYYYMMDD * 131 + attempt * 7919) >>> 0` for attempts 1 to 40, stopping at the first proven win. The values come
 * from the reference, never from the implementation under test; a mismatch means the solver, the deal or the formula
 * changed a published Daily, so fix the code and do not edit this table. The `grade` column is different: no reference
 * grades a deal, so it is grading v1's own output, pinned so that a Daily deal keeps its grade.
 */
import type { Grade } from '../../src/domain/types';

export interface DailyGolden {
    readonly day: string;
    readonly seed: number;
    readonly attempts: number;
    /** The grading v1 grade of the deal, from the implementation (task 7.5); a new grading version changes it on purpose. */
    readonly grade: Grade;
}

export const DAILY_GOLDEN: readonly DailyGolden[] = [
    { day: '2026-01-01', seed: 2654081150, attempts: 1, grade: 'easy' },
    { day: '2026-02-28', seed: 2654097787, attempts: 1, grade: 'hard' },
    { day: '2026-03-31', seed: 2654119199, attempts: 2, grade: 'hard' },
    { day: '2026-06-15', seed: 2654148484, attempts: 1, grade: 'hard' },
    { day: '2026-09-24', seed: 2654188963, attempts: 1, grade: 'hard' },
    { day: '2026-12-31', seed: 2654229180, attempts: 1, grade: 'hard' },
    { day: '2027-01-01', seed: 2655391150, attempts: 1, grade: 'hard' },
    { day: '2027-04-30', seed: 2655434249, attempts: 1, grade: 'medium' },
    { day: '2027-07-04', seed: 2655478062, attempts: 2, grade: 'medium' },
    { day: '2027-12-31', seed: 2655539180, attempts: 1, grade: 'medium' },
];
