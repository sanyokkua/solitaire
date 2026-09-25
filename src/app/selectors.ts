import type { Preferences } from '../features/preferences/preferencesSlice';
import type { AppState } from './appSlice';

/**
 * The single reduced-motion signal: motion is reduced whenever the Animations preference is off or the device asks
 * for reduced motion. Every timed sequence reads this and nothing else.
 */
export function selectReducedMotion(state: { readonly app: AppState; readonly preferences: Preferences }): boolean {
    return !state.preferences.animations || state.app.systemReducedMotion;
}
