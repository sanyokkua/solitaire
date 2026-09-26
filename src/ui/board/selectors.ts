import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { canRecycle } from '../../domain/rules';
import type { BoardPiles } from './layout';

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
