import { rankOf, SUITS, suitColor, suitOf, TABLEAU_COLS } from './cards';
import { column, groupAt } from './rules';
import type { CardId, Command, GameState, PileRef } from './types';

/** Ranks up to this are always safe to send: nothing can be built on an Ace or a Two that a foundation lacks. */
const ALWAYS_SAFE_RANK = 2;

/** Whether the next card of `card`'s suit is `card` itself. */
export function isReady(state: GameState, card: CardId): boolean {
    return state.foundations[suitOf(card)].length === rankOf(card) - 1;
}

/**
 * Sending a ready card is safe when no tableau card could still need it as a resting place: that holds once both
 * opposite-colour foundations have reached at least one rank below it. Aces and Twos are always safe.
 */
export function isSafe(state: GameState, card: CardId): boolean {
    if (!isReady(state, card)) return false;
    const rank = rankOf(card);
    if (rank <= ALWAYS_SAFE_RANK) return true;
    const suit = suitOf(card);
    const oppositeHeights = SUITS.filter((other) => suitColor(other) !== suitColor(suit)).map(
        (other) => state.foundations[other].length,
    );
    return rank <= Math.min(...oppositeHeights) + 1;
}

export interface Source {
    readonly from: PileRef;
    readonly index: number;
    readonly card: CardId;
}

/** Cards that can be grabbed from the tableau and waste, in canonical source order: columns 0→6, then the waste. */
export function sourceCards(state: GameState): readonly Source[] {
    const candidates: readonly { readonly from: PileRef; readonly index: number }[] = [
        ...TABLEAU_COLS.map((col): { readonly from: PileRef; readonly index: number } => ({
            from: { pile: 'tableau', col },
            index: column(state, col).length - 1,
        })),
        { from: { pile: 'waste' }, index: state.waste.length - 1 },
    ];
    return candidates.flatMap(({ from, index }) => {
        const card = groupAt(state, from, index)?.[0];
        return card === undefined ? [] : [{ from, index, card }];
    });
}

/** The first safe card to send to a foundation, as a system-initiated command; `undefined` when none is safe. */
export function nextSafeMove(state: GameState): Extract<Command, { type: 'autoFoundation' }> | undefined {
    const source = sourceCards(state).find(({ card }) => isSafe(state, card));
    return source === undefined ? undefined : { type: 'autoFoundation', from: source.from };
}
