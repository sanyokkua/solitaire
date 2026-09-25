import { createDealService, type DealService } from '../features/deal/dealService';
import { createStorageGateway, type StorageGateway } from '../features/persistence/storageGateway';

/**
 * What every thunk may reach besides the store: the deal service, a monotonic clock, a timer, the calendar date and
 * the storage gateway.
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
}

/**
 * A deal service that creates the real one (and so its solver worker) on first use, so a store that never deals
 * never starts a worker. `dispose` disposes the real service only if it was created, then forgets it.
 */
function lazyDealService(): DealService {
    let created: DealService | undefined;
    const service = (): DealService => (created ??= createDealService());
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
 * The production dependencies: a lazy deal service, `performance.now`, a `setTimeout` delay, `new Date()` and a
 * gateway over the browser's local storage.
 */
export function defaultThunkExtra(): ThunkExtra {
    return {
        dealService: lazyDealService(),
        now: performance.now.bind(performance),
        delay: (ms) =>
            new Promise<void>((resolve) => {
                setTimeout(resolve, ms);
            }),
        today: () => new Date(),
        gateway: createStorageGateway(),
    };
}
