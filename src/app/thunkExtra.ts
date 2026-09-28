import { createDealService, type DealService } from '../features/deal/dealService';
import { createStorageGateway, type StorageGateway } from '../features/persistence/storageGateway';
import { createSavePort, type SavePort } from './savePort';

/** What a thunk may ask of the PWA layer: apply the waiting update, or show the browser's install prompt (D8). */
export interface PwaPort {
    applyUpdate(): Promise<void>;
    promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/** The port used where no service worker is registered (tests, dev): it changes nothing and offers no install. */
export function inertPwaPort(): PwaPort {
    return { applyUpdate: () => Promise.resolve(), promptInstall: () => Promise.resolve('unavailable') };
}

/**
 * What every thunk may reach besides the store: the deal service, a monotonic clock, a timer, the calendar date, the
 * storage gateway, the save port, the PWA port and the browser's preferred languages.
 * The store passes it as the thunk `extraArgument`; tests replace any part through `createAppStore({ deps })`.
 */
export interface ThunkExtra {
    readonly dealService: DealService;
    /** A monotonic millisecond reading for play-time accrual; only differences between readings mean anything. */
    readonly now: () => number;
    /** Resolves after `ms` milliseconds. */
    readonly delay: (ms: number) => Promise<void>;
    /** The current date, from which the UTC Daily key is derived. */
    readonly today: () => Date;
    /** The only door to browser storage; tests inject one over `memoryStorage()`. */
    readonly gateway: StorageGateway;
    /** Flushes or cancels the pending save on demand, without a component reaching the writer directly (D8). */
    readonly saver: SavePort;
    /** The service-worker update and install prompt; inert unless `main.tsx` supplies the real gateways. */
    readonly pwa: PwaPort;
    /** The browser's preferred languages, most preferred first; read by `resetAllLocalData` to choose the first-run language. */
    readonly languages: () => readonly string[];
}

/**
 * A deal service that creates the real one (and so its solver worker) on first use, so a store that never deals
 * never starts a worker. `dispose` disposes the real service only if it was created, then forgets it. `now` feeds
 * `createDealService`'s own clock (D8), so the Daily deal it selects reads whatever `now` resolves to at call time,
 * not at the moment this lazy wrapper was built. Exported so `createAppStore`/`startApp` can rebuild the default deal
 * service against their own final, merged `today`, without duplicating the lazy-creation logic.
 */
export function lazyDealService(now: () => Date): DealService {
    let created: DealService | undefined;
    const service = (): DealService => (created ??= createDealService({ now }));
    return {
        deal: (request, onProgress) => service().deal(request, onProgress),
        hint: (state) => service().hint(state),
        dispose: () => {
            created?.dispose();
            created = undefined;
        },
    };
}

/**
 * The production dependencies: a lazy deal service (its clock is `today`), `performance.now`, a `setTimeout` delay,
 * `today: () => new Date()` and a gateway over the browser's local storage. `createAppStore`/`startApp` replace the
 * deal service's clock with one that lazily reads their own final, merged `today` (D8) whenever the caller does not
 * inject a `dealService` of its own; called alone, this default deal service simply reads the real date.
 */
export function defaultThunkExtra(): ThunkExtra {
    const today = (): Date => new Date();
    return {
        dealService: lazyDealService(today),
        now: performance.now.bind(performance),
        delay: (ms) =>
            new Promise<void>((resolve) => {
                setTimeout(resolve, ms);
            }),
        today,
        gateway: createStorageGateway(),
        saver: createSavePort(),
        pwa: inertPwaPort(),
        languages: () => navigator.languages,
    };
}
