import { rankOf } from './cards';
import { applyCommand } from './engine';
import { isWon } from './rules';
import { isReady, sourceCards, type Source } from './safeMoves';
import type { Command, GameEvent, GameState } from './types';

export interface FinishPlan {
    /** The settled, won position. */
    readonly state: GameState;
    /** Every event the plan produced, in order. */
    readonly events: readonly GameEvent[];
    /** The system-driven commands that lead from the original position to `state`. */
    readonly commands: readonly Command[];
}

/** The ready source card with the lowest rank; ties keep the earlier one in canonical source order. */
function lowestReady(state: GameState): Source | undefined {
    return sourceCards(state)
        .filter(({ card }) => isReady(state, card))
        .reduce<Source | undefined>(
            (best, source) => (best === undefined || rankOf(source.card) < rankOf(best.card) ? source : best),
            undefined,
        );
}

/**
 * The plan that finishes a game whose tableau is entirely face up, or `undefined` when there is none.
 *
 * Repeatedly: send the lowest-ranked card that is ready for its foundation (a tableau top or the waste top), else
 * draw (which recycles an exhausted stock). Every step is an ordinary engine command, so draws and recycles are
 * scored, counted and pass-limited as the player's would be, and sends are uncounted. The plan ends once won.
 *
 * It gives up when a step is refused, or when an exhausted stock would have to be recycled a second time with no card
 * sent since the first recycle. After that first recycle the stock holds every card that has not gone home, so the
 * draws up to the next exhaustion are one complete pass; with nothing sent, the stock and waste come back in the same
 * order, so every later pass repeats it exactly (in a draw-3 game too, waste tops included). If no card was playable
 * during that pass, none ever will be. Counting turned-over cards instead would stop a draw-3 pass short whenever the
 * pass in progress began with a non-empty waste. Each send resets the count and there are at most 52 sends, so the
 * loop always ends.
 */
export function finishPlan(state: GameState): FinishPlan | undefined {
    if (isWon(state) || state.tableau.some((cards) => cards.some((card) => !card.up))) return undefined;
    let current = state;
    let recycles = 0;
    const events: GameEvent[] = [];
    const commands: Command[] = [];
    while (!isWon(current)) {
        const send = lowestReady(current);
        if (send === undefined && current.stock.length === 0 && recycles > 0) return undefined;
        const command: Command = send === undefined ? { type: 'draw' } : { type: 'autoFoundation', from: send.from };
        const result = applyCommand(current, command);
        if (result.events.some((event) => event.type === 'rejected')) return undefined;
        current = result.state;
        events.push(...result.events);
        commands.push(command);
        recycles =
            send === undefined ? recycles + result.events.filter((event) => event.type === 'recycled').length : 0;
    }
    return { state: current, events, commands };
}
