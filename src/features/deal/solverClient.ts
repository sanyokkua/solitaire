/**
 * The solver worker client (D8): one lazily started worker, request ids, and the rules for which request wins. Reaches
 * `src/solver` through the worker URL and the message protocol's types only, so no solver code loads on the input
 * thread. Every method resolves with a discriminated result and none ever rejects.
 */
import type { GameState } from '../../domain/types';
import type { SolverHint } from '../../solver/hint';
import type { SolverRequest, SolverResponse } from '../../solver/protocol';
import type { WinnableResult } from '../../solver/winnable';

/** The narrow worker surface the client uses; tests supply stubs that implement it. */
export type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener'>;

/** How a `findWinnable` request ended: the selection, or why there is none. Deals have no `timeout` or `busy`. */
export type FindWinnableOutcome =
    { readonly status: 'ok'; readonly result: WinnableResult } | { readonly status: 'cancelled' | 'failed' };

/**
 * How a `hint` request ended. `ok` carries the solver's suggestion, `undefined` when it offers none; `timeout` means
 * the reply did not arrive in time; `busy` means a deal was pending, so nothing was sent.
 */
export type HintOutcome =
    | { readonly status: 'ok'; readonly hint: SolverHint | undefined }
    | { readonly status: 'cancelled' | 'timeout' | 'busy' | 'failed' };

export interface SolverClient {
    /**
     * Cancels every pending request, then asks the worker to try `seeds` in order at `budget` nodes each. `onProgress`
     * receives the attempt number as each attempt starts, in order, until the request settles. No timeout.
     */
    readonly findWinnable: (
        seeds: readonly number[],
        budget: number,
        onProgress?: (attempt: number) => void,
    ) => Promise<FindWinnableOutcome>;
    /**
     * Asks the worker for the solver's hint for `state`. Resolves `busy` at once while a deal is pending, `cancelled`
     * when a newer hint or a deal replaces it, and `timeout` after `timeoutMs` (the worker is left running).
     */
    readonly hint: (state: GameState, budget: number, timeoutMs: number) => Promise<HintOutcome>;
    /** Settles only the pending hints as `cancelled`; a pending deal and the worker are left alone. */
    readonly cancelHints: () => void;
    /** Settles every pending request as `cancelled`; a busy worker is terminated, an idle one is kept. */
    readonly cancel: () => void;
    /** `cancel()`, then terminates any remaining worker. Safe to call again. */
    readonly dispose: () => void;
}

interface PendingDeal {
    readonly kind: 'deal';
    readonly resolve: (outcome: FindWinnableOutcome) => void;
    readonly onProgress: ((attempt: number) => void) | undefined;
}

interface PendingHint {
    readonly kind: 'hint';
    readonly resolve: (outcome: HintOutcome) => void;
    readonly timer: ReturnType<typeof setTimeout>;
}

type Pending = PendingDeal | PendingHint;

/** Every reply type; typed as a record so adding a `SolverResponse` variant without listing it fails to compile. */
const RESPONSE_TYPES: Readonly<Record<SolverResponse['type'], true>> = {
    findWinnable: true,
    hint: true,
    progress: true,
};

/** Whether `data` has the envelope of a worker reply: an object with a numeric `id` and a known `type`. */
function isSolverResponse(data: unknown): data is SolverResponse {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    const { id, type } = data as { readonly id?: unknown; readonly type?: unknown };
    return typeof id === 'number' && typeof type === 'string' && Object.hasOwn(RESPONSE_TYPES, type);
}

/** Vite detects this exact `new Worker(new URL(...), { type: 'module' })` form and bundles the worker. */
function defaultCreateWorker(): WorkerLike {
    return new Worker(new URL('../../solver/solver.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Creates a client that starts its worker on the first request. `createWorker` is a seam for tests; the default
 * starts the real module worker.
 */
export function createSolverClient(createWorker: () => WorkerLike = defaultCreateWorker): SolverClient {
    let worker: WorkerLike | undefined;
    let nextId = 1;
    const pending = new Map<number, Pending>();
    /**
     * Ids posted to the current worker whose final reply has not arrived. It is tracked per posted request, not per
     * pending promise, because a timed-out or replaced hint no longer has a promise yet still occupies the worker.
     */
    const inFlight = new Set<number>();

    function discardWorker(): void {
        const discarded = worker;
        worker = undefined;
        inFlight.clear();
        discarded?.terminate();
    }

    function settleAll(status: 'cancelled' | 'failed'): void {
        const entries = [...pending.values()];
        pending.clear();
        for (const entry of entries) {
            if (entry.kind === 'hint') {
                clearTimeout(entry.timer);
            }
            entry.resolve({ status });
        }
    }

    /** Settles pending hints only: the worker keeps running and each late reply is dropped by id. */
    function cancelHints(): void {
        for (const [id, entry] of [...pending]) {
            if (entry.kind === 'hint') {
                pending.delete(id);
                clearTimeout(entry.timer);
                entry.resolve({ status: 'cancelled' });
            }
        }
    }

    /** The worker, its `error` and `messageerror` events and unreadable replies all end here: nothing is trusted afterwards. */
    function fail(): void {
        settleAll('failed');
        discardWorker();
    }

    function cancel(): void {
        settleAll('cancelled');
        // A running search cannot read new messages, so terminating is the only way to stop it at once.
        if (inFlight.size > 0) {
            discardWorker();
        }
    }

    function onResponse(response: SolverResponse): void {
        const entry = pending.get(response.id);
        if (response.type === 'progress') {
            if (entry?.kind === 'deal') {
                entry.onProgress?.(response.attempt);
            }
            return;
        }
        inFlight.delete(response.id);
        // A reply whose request was cancelled, replaced or timed out is dropped.
        if (entry === undefined) {
            return;
        }
        if (response.type === 'findWinnable' && entry.kind === 'deal') {
            pending.delete(response.id);
            const { seed, verdict, attempts } = response;
            entry.resolve({ status: 'ok', result: { seed, verdict, attempts } });
        } else if (response.type === 'hint' && entry.kind === 'hint') {
            pending.delete(response.id);
            clearTimeout(entry.timer);
            entry.resolve({ status: 'ok', hint: response.hint });
        } else {
            fail();
        }
    }

    function start(): WorkerLike {
        if (worker !== undefined) {
            return worker;
        }
        const created = createWorker();
        // Events from a worker that has since been discarded must not touch the current one.
        created.addEventListener('message', (event: MessageEvent) => {
            if (worker === created) {
                const data: unknown = event.data;
                if (isSolverResponse(data)) {
                    onResponse(data);
                } else {
                    fail();
                }
            }
        });
        for (const type of ['error', 'messageerror'] as const) {
            created.addEventListener(type, () => {
                if (worker === created) {
                    fail();
                }
            });
        }
        worker = created;
        return created;
    }

    /** Posts an already registered request; a worker that cannot be started or posted to fails every pending request. */
    function dispatch(request: SolverRequest): void {
        try {
            const target = start();
            inFlight.add(request.id);
            target.postMessage(request);
        } catch {
            fail();
        }
    }

    function findWinnable(
        seeds: readonly number[],
        budget: number,
        onProgress?: (attempt: number) => void,
    ): Promise<FindWinnableOutcome> {
        cancel();
        return new Promise((resolve) => {
            const id = nextId++;
            pending.set(id, { kind: 'deal', resolve, onProgress });
            dispatch({ id, type: 'findWinnable', seeds, budget });
        });
    }

    function hint(state: GameState, budget: number, timeoutMs: number): Promise<HintOutcome> {
        if ([...pending.values()].some((entry) => entry.kind === 'deal')) {
            return Promise.resolve({ status: 'busy' });
        }
        // Only the older hint is replaced; its late reply is dropped by id and the worker is not restarted, so the new
        // hint queues behind the old solve. Only a deal terminates a worker.
        cancelHints();
        return new Promise((resolve) => {
            const id = nextId++;
            const timer = setTimeout(() => {
                // The worker is left alone: a hint solve is short and its late reply is ignored (D8).
                pending.delete(id);
                resolve({ status: 'timeout' });
            }, timeoutMs);
            pending.set(id, { kind: 'hint', resolve, timer });
            dispatch({ id, type: 'hint', state, budget });
        });
    }

    function dispose(): void {
        cancel();
        discardWorker();
    }

    return { findWinnable, hint, cancel, cancelHints, dispose };
}
