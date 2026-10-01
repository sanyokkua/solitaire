import type { Mode } from '../domain/types';
import type { DealService } from '../features/deal/dealService';
import type { AppStore } from './store';

/** The longest the pool waits for an idle period before it starts anyway (D8). */
export const POOL_IDLE_TIMEOUT_MS = 2000;

/** Runs a callback once, at the first idle period. */
export interface IdleScheduler {
    /** Calls `callback` once; the returned function cancels a call not yet made. */
    schedule(callback: () => void): () => void;
}

/** The idle-callback API, which WebKit and Safari have not reliably shipped, so either member may be missing. */
type IdleHost = Partial<Pick<typeof globalThis, 'requestIdleCallback' | 'cancelIdleCallback'>>;

/**
 * `requestIdleCallback(cb, { timeout: 2000 })` where the browser has it, and a 2 s `setTimeout` otherwise (D8), so the
 * pool's worker never competes with the first load.
 */
export const defaultIdleScheduler: IdleScheduler = {
    schedule: (callback) => {
        const host: IdleHost = globalThis;
        if (typeof host.requestIdleCallback === 'function') {
            const handle = host.requestIdleCallback(
                () => {
                    callback();
                },
                { timeout: POOL_IDLE_TIMEOUT_MS },
            );
            return () => {
                host.cancelIdleCallback?.(handle);
            };
        }
        const handle = setTimeout(callback, POOL_IDLE_TIMEOUT_MS);
        return () => {
            clearTimeout(handle);
        };
    },
};

/** The running controller: `dispose()` stops it following the store. */
export interface DealPoolController {
    /** Cancels an idle signal still awaited and removes the store subscription; the service is not called again. Idempotent. */
    dispose(): void;
}

/** The inputs the pool follows: the Home choice (mode and "Winnable deals only") and the document's visibility. */
interface Inputs {
    readonly mode: Mode;
    readonly winnableOnly: boolean;
    readonly visible: boolean;
}

/**
 * Keeps the deal pool filling for the player's choice (DS "The pool follows the player's choice", D8). Nothing happens
 * before the scheduler's first idle signal; from then on, while the page is visible, it calls
 * `dealService.prefetch({ mode, winnableOnly })` for the current `selectedMode` and `winnableOnly`, and again whenever
 * either changes or the page becomes visible; when the page becomes hidden it calls `dealService.pause()`. The service
 * decides what a choice fills (Daily or the switch off fills nothing). The Difficulty and every other store change are
 * ignored: the pool fills the emptiest grade whatever the Difficulty.
 */
export function createDealPoolController(
    store: Pick<AppStore, 'getState' | 'subscribe'>,
    dealService: Pick<DealService, 'prefetch' | 'pause'>,
    scheduler: IdleScheduler = defaultIdleScheduler,
): DealPoolController {
    let last: Inputs | undefined;
    let unsubscribe: (() => void) | undefined;
    let disposed = false;

    const apply = (): void => {
        const { preferences, app } = store.getState();
        const next: Inputs = {
            mode: preferences.selectedMode,
            winnableOnly: preferences.winnableOnly,
            visible: app.documentVisible,
        };
        const previous = last;
        last = next;
        if (next.visible) {
            if (
                previous?.visible !== true ||
                previous.mode !== next.mode ||
                previous.winnableOnly !== next.winnableOnly
            ) {
                dealService.prefetch({ mode: next.mode, winnableOnly: next.winnableOnly });
            }
        } else if (previous?.visible !== false) {
            dealService.pause();
        }
    };

    const cancel = scheduler.schedule(() => {
        if (disposed) return;
        apply();
        unsubscribe = store.subscribe(apply);
    });

    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            cancel();
            unsubscribe?.();
        },
    };
}
