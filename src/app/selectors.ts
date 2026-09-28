import type { Preferences } from '../features/preferences/preferencesSlice';
import type { AppState, Route, SheetId } from './appSlice';

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

/** The current screen. */
export function selectRoute(state: { readonly app: AppState }): Route {
    return state.app.route;
}

/** The open sheet, or `null` when none is open. */
export function selectSheet(state: { readonly app: AppState }): SheetId | null {
    return state.app.sheet;
}
