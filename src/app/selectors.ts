import type { GameSliceState } from '../features/game/gameSlice';
import type { Preferences } from '../features/preferences/preferencesSlice';
import type { AppState } from './appSlice';

/**
 * The single reduced-motion signal: motion is reduced whenever the Animations preference is off or the device asks
 * for reduced motion. Every timed sequence reads this and nothing else.
 */
export function selectReducedMotion(state: { readonly app: AppState; readonly preferences: Preferences }): boolean {
    return !state.preferences.animations || state.app.systemReducedMotion;
}

/** The raised notices, oldest first. */
export function selectNotices(state: { readonly app: AppState }): AppState['notices'] {
    return state.app.notices;
}

/** The deal in flight, or `null` when none is. */
export function selectDealing(state: { readonly app: AppState }): AppState['dealing'] {
    return state.app.dealing;
}

/** Whether a safe-card chain or finish is running and the gate is closed. */
export function selectBusy(state: { readonly game: GameSliceState }): boolean {
    return state.game.busy;
}

/** The game epoch, bumped whenever a game is installed or cleared. */
export function selectEpoch(state: { readonly game: GameSliceState }): number {
    return state.game.epoch;
}

/** The position in play, or `null` when there is no game. */
export function selectCurrentGame(state: { readonly game: GameSliceState }): GameSliceState['current'] {
    return state.game.current;
}
