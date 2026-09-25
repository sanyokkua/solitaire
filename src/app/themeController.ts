import { selectReducedMotion } from './selectors';
import type { AppStore } from './store';

/** The media query behind the device's colour-scheme preference. */
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The running controller: `dispose()` stops it following the store and the device. */
export interface ThemeController {
    /** Removes the store subscription and the media-query listener. Idempotent. */
    dispose(): void;
}

/**
 * Applies the appearance preferences to `root` (the document element) as attributes the stylesheets select on:
 * `data-theme` (`light` or `dark`, with System resolved here from the device so the dark palette is written once),
 * `data-night-cards`, `data-four-color`, `data-back` and `data-motion` (`off` when `selectReducedMotion` says motion is
 * reduced, `on` otherwise; the one motion signal).
 *
 * It applies once when created, then on every store change and whenever the device's colour scheme changes, and it
 * writes an attribute only when its value differs. `matchMedia` is optional: without it (or without listener support)
 * System resolves to light, and without listener support it keeps the value read at start-up.
 */
export function createThemeController(
    store: Pick<AppStore, 'getState' | 'subscribe'>,
    root: HTMLElement,
    matchMedia: ((query: string) => MediaQueryList) | undefined,
): ThemeController {
    const darkQuery = matchMedia?.(DARK_QUERY);

    const apply = (): void => {
        const state = store.getState();
        const { theme, nightCards, fourColor, cardBack } = state.preferences;
        const attributes: Readonly<Record<string, string>> = {
            'data-theme': theme === 'system' ? (darkQuery?.matches === true ? 'dark' : 'light') : theme,
            'data-night-cards': String(nightCards),
            'data-four-color': String(fourColor),
            'data-back': cardBack,
            'data-motion': selectReducedMotion(state) ? 'off' : 'on',
        };
        for (const [name, value] of Object.entries(attributes)) {
            if (root.getAttribute(name) !== value) root.setAttribute(name, value);
        }
    };

    apply();
    const unsubscribe = store.subscribe(apply);
    if (typeof darkQuery?.addEventListener === 'function') {
        darkQuery.addEventListener('change', apply);
    }

    let disposed = false;
    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            unsubscribe();
            if (typeof darkQuery?.removeEventListener === 'function') {
                darkQuery.removeEventListener('change', apply);
            }
        },
    };
}
