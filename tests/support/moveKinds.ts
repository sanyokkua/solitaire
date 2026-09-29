import type { Command, GameState } from '../../src/domain/types';

/** The first face-up index of a column: how many cards lie face down below its run. */
function faceDownCount(state: GameState, col: number): number {
    const cards = state.tableau[col] ?? [];
    const firstUp = cards.findIndex((card) => card.up);
    return firstUp === -1 ? cards.length : firstUp;
}

/** A run moved without its base: it starts above the first face-up card of its column. */
export const partialRun = (command: Command, before: GameState): boolean =>
    command.type === 'move' &&
    command.from.pile === 'tableau' &&
    command.index > faceDownCount(before, command.from.col);

/** A card taken back off a foundation onto a column. */
export const foundationToColumn = (command: Command): boolean =>
    command.type === 'move' && command.from.pile === 'foundation' && command.to.pile === 'tableau';

/** A whole run moved off a column with nothing face down, onto another column, which leaves it empty. */
export const emptyingRun = (command: Command, before: GameState): boolean =>
    command.type === 'move' &&
    command.from.pile === 'tableau' &&
    command.to.pile === 'tableau' &&
    command.index === 0 &&
    faceDownCount(before, command.from.col) === 0 &&
    before.tableau[command.to.col].length > 0;
