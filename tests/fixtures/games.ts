import { dealFromSeed } from '../../src/domain/deal';
import { applyCommand } from '../../src/domain/engine';
import type { GameState } from '../../src/domain/types';
import {
    accrued,
    committed,
    countedSet,
    gameReducer,
    initialGameState,
    installed,
} from '../../src/features/game/gameSlice';
import { WINNING_LINE, parseLine } from './deals';

/** A started Draw 1 game with one move played, so it is resumable and belongs in the record. */
export function playedGame() {
    let game = gameReducer(undefined, installed({ state: dealFromSeed(WINNING_LINE.seed, 'draw1'), dailyKey: null }));
    game = gameReducer(game, accrued({ atMs: 1000, eligible: true }));
    const [command] = parseLine(WINNING_LINE.line);
    if (game.current === null || command === undefined) throw new Error('expected a game and a command');
    game = gameReducer(game, committed(applyCommand(game.current, command).state));
    return gameReducer(game, countedSet(true));
}

/** A game slice holding `state`, installed the way a deal delivers it. */
export function gameOf(state: GameState) {
    return gameReducer(initialGameState, installed({ state, dailyKey: null }));
}
