import type { GameState } from '../domain/types';
import { solveOrdered } from './ordered';
import { solve, type SolveResult } from './solver';

/**
 * The one entry to the solver for every mode (D2): a position that draws three cards (Draw 3, Vegas) goes to the
 * ordered-talon search, one that draws a single card (Draw 1, Daily) to the Draw 1 search. Each answers a position it
 * does not own with `unknown` and no nodes, so a mismatched pair (Vegas with one-card draws) is never searched.
 */
export function search(state: GameState, budget: number): SolveResult {
    return state.draw === 3 ? solveOrdered(state, budget) : solve(state, budget);
}
