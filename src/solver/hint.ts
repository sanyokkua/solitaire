import type { MoveHint } from '../domain/assist';
import { groupAt } from '../domain/rules';
import type { GameState } from '../domain/types';
import { solve } from './solver';

/** A domain `Hint` without its heuristic priority: every domain `Hint` is assignable to it (D5). */
export type SolverHint = Omit<MoveHint, 'priority'> | { readonly kind: 'draw' } | { readonly kind: 'recycle' };

/**
 * The first command of the winning line from `solve(state, budget)` as a hint; `undefined` when the search does not
 * prove a win (a loss, `unknown`, an unsupported position) or the position is already won. A draw is a recycle when
 * the stock is empty. Throws when the line's first move has no movable group at its source, or the command is an `autoFoundation`,
 * which no valid line contains.
 */
export function solverHint(state: GameState, budget: number): SolverHint | undefined {
    const first = solve(state, budget).line?.[0];
    if (first === undefined) {
        return undefined;
    }
    switch (first.type) {
        case 'draw':
            return state.stock.length === 0 ? { kind: 'recycle' } : { kind: 'draw' };
        case 'move': {
            const cards = groupAt(state, first.from, first.index);
            if (cards === undefined) {
                throw new Error('solver line starts with a move whose source holds no movable group');
            }
            return { kind: 'move', command: first, cards };
        }
        default:
            throw new Error(`solver line starts with an unexpected ${first.type} command`);
    }
}
