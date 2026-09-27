import { TABLEAU_COLS } from './cards';
import { canRecycle, column, groupAt, isWon, legalTargets } from './rules';
import { isReady, sourceCards } from './safeMoves';
import type { CardId, Column, Command, GameState, PileRef } from './types';

export type MoveCommand = Extract<Command, { type: 'move' }>;
export type HintPriority = 1 | 2 | 3 | 4 | 5;

export interface MoveHint {
    readonly kind: 'move';
    readonly command: MoveCommand;
    /** The cards the move carries, lowest first. */
    readonly cards: readonly CardId[];
    readonly priority: HintPriority;
}

export type Hint = MoveHint | { readonly kind: 'draw' } | { readonly kind: 'recycle' };

function isTableau(to: PileRef): boolean {
    return to.pile === 'tableau';
}

function isEmptyColumn(state: GameState, to: PileRef): boolean {
    return to.pile === 'tableau' && column(state, to.col).length === 0;
}

/** The move of the group at `index` of `from` to the first legal target that `accepts`, if there is one. */
function moveHint(
    state: GameState,
    from: PileRef,
    index: number,
    priority: HintPriority,
    accepts: (to: PileRef) => boolean,
): MoveHint | undefined {
    const cards = groupAt(state, from, index);
    if (cards === undefined) return undefined;
    const to = legalTargets(state, cards, from).find(accepts);
    return to === undefined ? undefined : { kind: 'move', command: { type: 'move', from, index, to }, cards, priority };
}

/** The first of `hints` that is a move; every scan runs in canonical order. */
function firstMove(hints: readonly (MoveHint | undefined)[]): MoveHint | undefined {
    return hints.find((found) => found !== undefined);
}

/** Priority 1: a tableau top or the waste top onto its foundation. */
function sendHome(state: GameState): MoveHint | undefined {
    return firstMove(
        sourceCards(state).map(({ from, index }) => moveHint(state, from, index, 1, (to) => to.pile === 'foundation')),
    );
}

/** A whole face-up run sitting on a face-down card, moved to a column that `accepts` it (priorities 2 and 5). */
function revealingRun(
    state: GameState,
    priority: HintPriority,
    accepts: (to: PileRef) => boolean,
): MoveHint | undefined {
    return firstMove(
        TABLEAU_COLS.map((col) => {
            const base = column(state, col).findIndex((card) => card.up);
            return base > 0 ? moveHint(state, { pile: 'tableau', col }, base, priority, accepts) : undefined;
        }),
    );
}

/** Priority 3: the waste top onto any tableau column, empty ones included. */
function wasteToTableau(state: GameState): MoveHint | undefined {
    return moveHint(state, { pile: 'waste' }, state.waste.length - 1, 3, isTableau);
}

/**
 * Priority 4: a partial run onto a tableau column, exposing a card that its foundation is ready for. Only a King
 * fits an empty column, and a King never rests on a face-up card, so in play the target is always non-empty.
 */
function freeingSplit(state: GameState): MoveHint | undefined {
    return firstMove(
        TABLEAU_COLS.flatMap((col) => {
            const cards: Column = column(state, col);
            return cards.flatMap((card, index) => {
                const below = cards[index - 1];
                return card.up && below?.up === true && isReady(state, below.id)
                    ? [moveHint(state, { pile: 'tableau', col }, index, 4, isTableau)]
                    : [];
            });
        }),
    );
}

/** The first productive board move, by hint priority; `undefined` when there is none. */
export function findMove(state: GameState): MoveHint | undefined {
    return (
        sendHome(state) ??
        revealingRun(state, 2, (to) => isTableau(to) && !isEmptyColumn(state, to)) ??
        wasteToTableau(state) ??
        freeingSplit(state) ??
        revealingRun(state, 5, (to) => isEmptyColumn(state, to))
    );
}

/** The suggested next step: the best board move, else a draw or recycle; `undefined` when none remains or won. */
export function hint(state: GameState): Hint | undefined {
    if (isWon(state)) return undefined;
    const move = findMove(state);
    if (move !== undefined) return move;
    if (state.stock.length > 0) return { kind: 'draw' };
    return canRecycle(state) ? { kind: 'recycle' } : undefined;
}
