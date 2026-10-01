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
 * A deal service that creates the real one (and so its solver workers) on first use, so a store that never deals,
 * hints or prefetches never starts a worker. `prefetch` creates it like `deal` and `hint`; `pause` only reaches one
 * that exists, since a service that was never created has nothing to pause. `dispose` disposes the real service only
 * if it was created, then forgets it. `now` feeds
 * `createDealService`'s own clock (D8), so the Daily deal it selects reads whatever `now` resolves to at call time,
 * not at the moment this lazy wrapper was built. `create` is the seam tests use to count and observe creation.
 */
function lazyDealService(now: () => Date, create: (options: { now: () => Date }) => DealService): DealService {
    let created: DealService | undefined;
    const service = (): DealService => (created ??= create({ now }));
    return {
        deal: (request, onProgress) => service().deal(request, onProgress),
        hint: (state) => service().hint(state),
        prefetch: (choice) => {
            service().prefetch(choice);
        },
        pause: () => {
            created?.pause();
        },
        dispose: () => {
            created?.dispose();
            created = undefined;
        },
    };
}

/**
 * The one place the thunk dependencies are assembled (D15), used by `createAppStore` and `startApp`. The production
 * defaults are `performance.now`, a `setTimeout` delay, `today: () => new Date()`, a gateway over the browser's local
 * storage, an unconnected save port, an inert PWA port and `navigator.languages`; every override wins over its
 * default. Unless `dealService` is overridden, the default one is a lazy service whose clock reads the final, merged
 * `today` at call time (D8), so an injected `today` drives the Daily deal date and is not shadowed by a captured one.
 * `create` builds the real deal service on first use and defaults to `createDealService`; it is a second parameter,
 * not an override, so it is the seam tests use to observe creation and never part of the store's options.
 */
export function assembleThunkExtra(
    supplied: Partial<ThunkExtra> = {},
    create: (options: { now: () => Date }) => DealService = createDealService,
): ThunkExtra {
    const extra: ThunkExtra = {
        now: performance.now.bind(performance),
        delay: (ms) =>
            new Promise<void>((resolve) => {
                setTimeout(resolve, ms);
            }),
        today: () => new Date(),
        gateway: createStorageGateway(),
        saver: createSavePort(),
        pwa: inertPwaPort(),
        languages: () => navigator.languages,
        ...supplied,
        dealService: supplied.dealService ?? lazyDealService(() => extra.today(), create),
    };
    return extra;
}
