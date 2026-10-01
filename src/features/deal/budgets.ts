import type { Mode } from '../../domain/types';

/** Nodes searched per candidate when a Draw 1 deal must be winnable. */
export const WINNABLE_BUDGET = 5_000;
/** Nodes searched per candidate when a Draw 3 deal must be winnable (the ordered-talon search). */
export const DRAW3_WINNABLE_BUDGET = 20_000;
/** Nodes searched per candidate when a Vegas deal must be winnable (the ordered-talon search). */
export const VEGAS_WINNABLE_BUDGET = 20_000;
/**
 * Candidate seeds tried for a winnable deal, in every mode: 20% more than the 40 the first release tried, so a request
 * finds a proven deal (and one of the requested grade) more often. The Daily v1 selection keeps its own pinned 40.
 */
export const MAX_ATTEMPTS = 48;
/** Nodes searched for a solver hint. */
export const HINT_BUDGET = 3_000;
/**
 * Proven-winnable candidates one request may grade in search of the requested grade before settling for the closest.
 * Raised from 4 to 8 with grading v2, whose Easy grade is rarer (about one proven deal in six), so an Easy request more
 * often ends with a real Easy deal; the longer search shows the "Shuffling cards before the game…" screen.
 */
export const GRADE_LIMIT = 8;

/**
 * Nodes searched per candidate when a deal of `mode` must be winnable. A Daily deal is not one of them: it always
 * searches, at the pinned `DAILY_V1.budget`, whatever the "Winnable deals only" switch says.
 */
export function winnableBudget(mode: Exclude<Mode, 'daily'>): number {
    switch (mode) {
        case 'draw1':
            return WINNABLE_BUDGET;
        case 'draw3':
            return DRAW3_WINNABLE_BUDGET;
        case 'vegas':
            return VEGAS_WINNABLE_BUDGET;
    }
}
