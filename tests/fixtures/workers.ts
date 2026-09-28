/**
 * Shared worker doubles and seed sources for the solver client and deal service tests: `StubWorker`, a worker that
 * never replies on its own (tests script its events), `stubFactory` and `stubAt` to create and read stubs,
 * `realFactory` to start the real solver module in-process, and two `SeedSource`s, `scriptedSeedSource` and
 * `mulberry32SeedSource`, that make "fresh" seeds deterministic. A test that uses `realFactory` imports
 * `@vitest/web-worker` first and runs in the node environment (see tests/README.md).
 */
import { mulberry32, type SeedSource } from '../../src/domain/prng';
import type { WorkerLike } from '../../src/features/deal/solverClient';
import type { SolverRequest, SolverResponse } from '../../src/solver/protocol';

/** A worker that never replies on its own: records what it is asked, and lets a test script events. */
export class StubWorker implements WorkerLike {
    readonly requests: SolverRequest[] = [];
    terminated = false;
    postError: Error | undefined;
    private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

    postMessage = (message: unknown): void => {
        if (this.postError !== undefined) {
            throw this.postError;
        }
        this.requests.push(message as SolverRequest);
    };

    terminate = (): void => {
        this.terminated = true;
    };

    addEventListener = (type: string, listener: (event: unknown) => void): void => {
        const set = this.listeners.get(type) ?? new Set<(event: unknown) => void>();
        set.add(listener);
        this.listeners.set(type, set);
    };

    /** Delivers `event` to every listener registered for `type`, as the worker would. */
    emit(type: string, event: unknown = {}): void {
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
    }

    /** Delivers a worker reply. */
    reply(response: SolverResponse): void {
        this.emit('message', { data: response });
    }

    /** The id of the `index`-th request posted to this stub. */
    idOf(index: number): number {
        const request = this.requests[index];
        if (request === undefined) {
            throw new Error(`no request #${String(index)} was posted`);
        }
        return request.id;
    }
}

/** A factory for stubs that counts creations and keeps every stub it made. */
export function stubFactory(): { readonly create: () => WorkerLike; readonly stubs: StubWorker[] } {
    const stubs: StubWorker[] = [];
    return {
        stubs,
        create: () => {
            const stub = new StubWorker();
            stubs.push(stub);
            return stub;
        },
    };
}

/** The `index`-th stub, or a failure that names it. */
export function stubAt(stubs: readonly StubWorker[], index: number): StubWorker {
    const stub = stubs[index];
    if (stub === undefined) {
        throw new Error(`stub #${String(index)} was never created`);
    }
    return stub;
}

/** A factory that starts the real worker module in-process, counts starts, and keeps every worker. */
export function realFactory(): { readonly create: () => WorkerLike; readonly workers: Worker[] } {
    const workers: Worker[] = [];
    return {
        workers,
        create: () => {
            const worker = new Worker(new URL('../../src/solver/solver.worker.ts', import.meta.url), {
                type: 'module',
            });
            workers.push(worker);
            return worker;
        },
    };
}

/** A `SeedSource` that hands out `seeds` in order, one per drawn value; it throws when they run out. */
export function scriptedSeedSource(seeds: readonly number[]): SeedSource {
    let next = 0;
    return {
        getRandomValues: (array) => {
            const seed = seeds[next++];
            if (seed === undefined) {
                throw new Error(`the scripted seed source has no seed #${String(next)}`);
            }
            array[0] = seed;
            return array;
        },
    };
}

/** A `SeedSource` whose values are the `mulberry32(fixed)` stream scaled to 32 bits, so a test can reproduce them. */
export function mulberry32SeedSource(fixed: number): SeedSource {
    const random = mulberry32(fixed);
    return {
        getRandomValues: (array) => {
            for (let index = 0; index < array.length; index++) {
                array[index] = Math.floor(random() * 4294967296);
            }
            return array;
        },
    };
}
