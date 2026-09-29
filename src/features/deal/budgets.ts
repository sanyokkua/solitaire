/** Nodes searched per candidate when a Draw 1 deal must be winnable. */
export const WINNABLE_BUDGET = 5_000;
/** Nodes searched per candidate when a Draw 3 deal must be winnable (the ordered-talon search). */
export const DRAW3_WINNABLE_BUDGET = 20_000;
/** Nodes searched per candidate when a Vegas deal must be winnable (the ordered-talon search). */
export const VEGAS_WINNABLE_BUDGET = 20_000;
/** Candidate seeds tried for a winnable deal, in every mode. */
export const MAX_ATTEMPTS = 40;
/** Nodes searched for a solver hint. */
export const HINT_BUDGET = 3_000;
