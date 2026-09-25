import type {
    DealOutcome,
    DealProgress,
    DealRequest,
    DealService,
    HintOutcome,
} from '../../src/features/deal/dealService';
import type { GameState } from '../../src/domain/types';

/** One `deal()` call the fake received, in call order. */
export interface RecordedDeal {
    readonly request: DealRequest;
    readonly onProgress: ((progress: DealProgress) => void) | undefined;
}

/** A deal service whose requests stay pending until the test settles them, a newer deal or `dispose()` cancels them. */
export interface FakeDealService extends DealService {
    readonly requests: RecordedDeal[];
    /** Settles request `index` as dealt; `dayKey` is carried only when given. Throws if it already settled. */
    readonly resolve: (index: number, state: GameState, dayKey?: string) => void;
    /** Settles request `index` as cancelled. Throws if it already settled. */
    readonly cancel: (index: number) => void;
    /** Reports progress to request `index`'s callback, if it gave one. */
    readonly progress: (index: number, progress: DealProgress) => void;
    /** Whether `dispose()` was called. */
    disposed: boolean;
}

/**
 * Creates a fake deal service: `deal` records the request and waits, `hint` answers `none`, `dispose` is noted. Like
 * the real service, a new `deal()` and `dispose()` settle every request still pending as `cancelled`, and settling a
 * request that has already settled throws.
 */
export function fakeDealService(): FakeDealService {
    const requests: RecordedDeal[] = [];
    /** Each request's settle function, or `undefined` once it has settled. */
    const pending: (((outcome: DealOutcome) => void) | undefined)[] = [];

    function settle(index: number, outcome: DealOutcome): void {
        const resolve = pending[index];
        if (resolve === undefined) {
            throw new Error(`Deal request ${String(index)} does not exist or has already settled`);
        }
        pending[index] = undefined;
        resolve(outcome);
    }

    function cancelPending(): void {
        pending.forEach((resolve, index) => {
            if (resolve !== undefined) settle(index, { status: 'cancelled' });
        });
    }

    const fake: FakeDealService = {
        requests,
        disposed: false,
        deal: (request, onProgress) => {
            cancelPending();
            requests.push({ request, onProgress });
            return new Promise<DealOutcome>((resolve) => {
                pending.push(resolve);
            });
        },
        hint: () => Promise.resolve<HintOutcome>({ status: 'none' }),
        dispose: () => {
            cancelPending();
            fake.disposed = true;
        },
        resolve: (index, state, dayKey) => {
            settle(index, { status: 'dealt', state, ...(dayKey === undefined ? {} : { dayKey }) });
        },
        cancel: (index) => {
            settle(index, { status: 'cancelled' });
        },
        progress: (index, progress) => {
            const recorded = requests[index];
            if (recorded === undefined) throw new Error(`No deal request at index ${String(index)}`);
            recorded.onProgress?.(progress);
        },
    };
    return fake;
}
