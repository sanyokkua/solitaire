import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { canRecycle } from '../../domain/rules';
import type { CardId } from '../../domain/types';
import type { BoardPiles } from './layout';
import { cardIndex, pileKey, type CardLocation } from './locate';

/**
 * The five piles the board draws, or `null` while there is no game. The result keeps its identity for as long as the
 * five piles keep theirs, so a clock tick (which replaces the position but shares its piles) never gives the board a
 * new layout input.
 */
export const selectBoardPiles = createSelector(
    [
        (state: RootState) => state.game.current?.tableau,
        (state: RootState) => state.game.current?.stock,
        (state: RootState) => state.game.current?.waste,
        (state: RootState) => state.game.current?.foundations,
        (state: RootState) => state.game.current?.draw,
    ],
    (tableau, stock, waste, foundations, draw): BoardPiles | null =>
        tableau === undefined ||
        stock === undefined ||
        waste === undefined ||
        foundations === undefined ||
        draw === undefined
            ? null
            : { tableau, stock, waste, foundations, draw },
);

/** Whether the stock is empty and cannot be recycled, which dims its slot. */
export function selectStockSpent(state: RootState): boolean {
    const { current } = state.game;
    return current !== null && current.stock.length === 0 && !canRecycle(current);
}

/**
 * Whether two card-location maps place every card in the same pile at the same index with the same movability. The
 * face is left out on purpose: the board reads it from the layout, not from here.
 */
export function sameLocations(
    a: ReadonlyMap<CardId, CardLocation> | null,
    b: ReadonlyMap<CardId, CardLocation> | null,
): boolean {
    if (a === null || b === null) return a === b;
    if (a === b) return true;
    if (a.size !== b.size) return false;
    for (const [id, left] of a) {
        const right = b.get(id);
        if (right === undefined) return false;
        if (left.index !== right.index || left.movable !== right.movable) return false;
        if (pileKey(left.from) !== pileKey(right.from)) return false;
    }
    return true;
}

/**
 * Where every card sits (pile, index, movability), or `null` while there is no game. The result keeps its identity for
 * as long as no card changes place, so a clock tick (a new position with the same cards) never re-renders the board.
 */
export const selectCardLocations = createSelector(
    [(state: RootState) => state.game.current],
    (current) => (current === null ? null : cardIndex(current)),
    { memoizeOptions: { resultEqualityCheck: sameLocations } },
);
