import type { AppState } from '../../app/appSlice';
import type { GameSliceState } from './gameSlice';

/** The structural slice of the store the clock selector reads, so this module needs no store import. */
interface ClockRoot {
    readonly app: AppState;
    readonly game: GameSliceState;
}

/**
 * Whether play time may accrue (D12): the Game screen is shown, no sheet is open, the document is visible, and the game
 * has started and is not won. `busy` is deliberately not part of it, so time keeps counting while a safe-card chain or
 * a finish runs.
 */
export function selectClockEligible({ app, game }: ClockRoot): boolean {
    return (
        app.route === 'game' &&
        app.sheet === null &&
        app.documentVisible &&
        game.current?.started === true &&
        game.current.status === 'playing'
    );
}
