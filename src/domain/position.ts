import type { GameState, Pile } from './types';

const list = (pile: Pile): string => pile.join(',');

/**
 * A string that identifies a position by its piles alone: each tableau card's id and face state, the stock, the
 * waste and the foundations. Two states have equal keys exactly when those piles are equal; score, moves, time,
 * undo count, passes and mode do not take part. Cards within a pile are separated by `,`, tableau columns by `/`
 * (each card ends in `u` face up or `d` face down), and the tableau, stock, waste and foundations by `|`.
 */
export function positionKey(state: GameState): string {
    const tableau = state.tableau.map((column) =>
        column.map((card) => `${String(card.id)}${card.up ? 'u' : 'd'}`).join(','),
    );
    return [tableau.join('/'), list(state.stock), list(state.waste), state.foundations.map(list).join('/')].join('|');
}
