import { suitOf } from '../domain/cards';
import { applyCommand } from '../domain/engine';
import { column, wasteTop } from '../domain/rules';
import type { CardId, Command, GameState, PileRef, Suit, TableauCol } from '../domain/types';

/**
 * A move of the search, in terms that survive replay. The search's talon positions shift as cards leave it, so talon
 * moves name the card; column moves keep the search's column and card index, which equal the engine's.
 */
export type SolverMove =
    | { readonly t: 'cf'; readonly col: number }
    | { readonly t: 'tf'; readonly card: CardId }
    | { readonly t: 'cc'; readonly from: number; readonly index: number; readonly to: number }
    | { readonly t: 'tc'; readonly card: CardId; readonly to: number }
    | { readonly t: 'fc'; readonly suit: Suit; readonly to: number };

/** A tableau pile reference; the search only ever yields the seven column indices. */
function tableau(col: number): PileRef {
    return { pile: 'tableau', col: col as TableauCol };
}

/**
 * Turns the search's moves into the player commands that make them, starting from `state`: a talon card is brought to
 * the waste top with draws (an empty stock recycles by itself) before it is moved, and sends to a foundation are
 * ordinary moves, never `autoFoundation`. Every command is run through `applyCommand`, so a move the engine refuses
 * throws. `state` is not modified.
 */
export function expandLine(state: GameState, moves: readonly SolverMove[]): Command[] {
    const line: Command[] = [];
    let current = state;

    const play = (command: Command): void => {
        const result = applyCommand(current, command);
        if (result.events.some((event) => event.type === 'rejected')) {
            throw new Error(`the engine refused ${JSON.stringify(command)}`);
        }
        line.push(command);
        current = result.state;
    };

    /** Draws until `card` is the waste top. Every talon card comes up within one pass plus the cards now in the waste. */
    const surface = (card: CardId): void => {
        if (!current.stock.includes(card) && !current.waste.includes(card)) {
            throw new Error(`card ${String(card)} is not in the stock or the waste`);
        }
        const bound = current.stock.length + current.waste.length + 1;
        for (let draws = 0; wasteTop(current) !== card; draws++) {
            if (draws >= bound) {
                throw new Error(`card ${String(card)} did not reach the waste top within ${String(bound)} draws`);
            }
            play({ type: 'draw' });
        }
    };

    const playFromWaste = (card: CardId, to: PileRef): void => {
        surface(card);
        play({ type: 'move', from: { pile: 'waste' }, index: current.waste.length - 1, to });
    };

    for (const move of moves) {
        switch (move.t) {
            case 'cf': {
                const cards = column(current, move.col as TableauCol);
                const top = cards.at(-1);
                if (top === undefined) {
                    throw new Error(`column ${String(move.col)} has no top card to send to a foundation`);
                }
                play({
                    type: 'move',
                    from: tableau(move.col),
                    index: cards.length - 1,
                    to: { pile: 'foundation', suit: suitOf(top.id) },
                });
                break;
            }
            case 'tf':
                playFromWaste(move.card, { pile: 'foundation', suit: suitOf(move.card) });
                break;
            case 'cc':
                play({ type: 'move', from: tableau(move.from), index: move.index, to: tableau(move.to) });
                break;
            case 'tc':
                playFromWaste(move.card, tableau(move.to));
                break;
            case 'fc':
                play({
                    type: 'move',
                    from: { pile: 'foundation', suit: move.suit },
                    index: current.foundations[move.suit].length - 1,
                    to: tableau(move.to),
                });
                break;
        }
    }
    return line;
}
