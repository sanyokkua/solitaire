import { findMove, hint, type Hint } from './hint';
import { canRecycle, isWon, legalTargets } from './rules';
import type { GameState } from './types';

/** Whether some stock or waste card would be accepted, as a single card, by a foundation or a tableau column. */
function talonPlayable(state: GameState): boolean {
    // Neither talon pile is ever a destination, so the source pile does not affect the targets.
    return [...state.stock, ...state.waste].some((card) => legalTargets(state, [card], { pile: 'stock' }).length > 0);
}

/** No productive move remains, and the talon cannot help: nothing playable in it, or it cannot be turned over. */
export function isDeadEnd(state: GameState): boolean {
    return (
        !isWon(state) &&
        findMove(state) === undefined &&
        (!talonPlayable(state) || (state.stock.length === 0 && !canRecycle(state)))
    );
}

/** What to suggest next: a dead end, or the hint. */
export type Advice = { readonly kind: 'dead-end' } | Hint;

/** The dead end exactly when {@link isDeadEnd} reports one, else the hint; `undefined` only for a won position. */
export function advise(state: GameState): Advice | undefined {
    return isDeadEnd(state) ? { kind: 'dead-end' } : hint(state);
}
