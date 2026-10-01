import { findMove, hint, type Hint } from './hint';
import { isWon, legalTargets } from './rules';
import { reachableTops } from './talon';
import type { GameState } from './types';

/** Whether some talon card that drawing can bring to the waste top would be accepted, as a single card, somewhere. */
function talonPlayable(state: GameState): boolean {
    // Neither talon pile is ever a destination, so the source pile does not affect the targets.
    return reachableTops(state).some((card) => legalTargets(state, [card], { pile: 'stock' }).length > 0);
}

/** No productive move remains, and drawing cannot bring up a playable card: the pass limit and the draw count count. */
export function isDeadEnd(state: GameState): boolean {
    return !isWon(state) && findMove(state) === undefined && !talonPlayable(state);
}

/** What to suggest next: a dead end, or the hint. */
export type Advice = { readonly kind: 'dead-end' } | Hint;

/** The dead end exactly when {@link isDeadEnd} reports one, else the hint; `undefined` only for a won position. */
export function advise(state: GameState): Advice | undefined {
    return isDeadEnd(state) ? { kind: 'dead-end' } : hint(state);
}
