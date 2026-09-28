import type { AppThunk } from './appThunk';
import { installableChanged } from './appSlice';

/**
 * Applies the waiting update (PWA "Updates apply only when the player chooses, after saving"): saves the game first,
 * then hands over to the service worker, which reloads the page. Update always applies: with read-only persistence the
 * flush writes nothing and a failing flush may throw, and neither may keep the player on the old version. The flush is
 * quiet: the notice's warning was decided when it appeared, so a failure now adds no fresh one.
 */
export function applyUpdate(): AppThunk<Promise<void>> {
    return async (_dispatch, _getState, { saver, pwa }) => {
        try {
            saver.flushQuietly();
        } catch {
            // The update notice already warns when the save cannot be relied on; apply anyway.
        }
        await pwa.applyUpdate();
    };
}

/** Shows the browser's install prompt, then hides the Install link: the offer is spent whatever the player chose. */
export function installApp(): AppThunk<Promise<void>> {
    return async (dispatch, _getState, { pwa }) => {
        try {
            await pwa.promptInstall();
        } catch {
            // A prompt that fails is as spent as one the player dismissed.
        }
        dispatch(installableChanged(false));
    };
}
