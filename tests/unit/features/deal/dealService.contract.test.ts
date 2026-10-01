import { describe, expect, it, vi } from 'vitest';
import {
    createDealService,
    type DealProgress,
    type DealRequest,
    type HintOutcome,
} from '../../../../src/features/deal/dealService';
import type { SolverRequest } from '../../../../src/solver/protocol';
import { fakeDealService } from '../../../fixtures/dealService';
import { makeState } from '../../../fixtures/states';
import { mulberry32SeedSource, stubFactory, type StubWorker } from '../../../fixtures/workers';
import {
    dealServiceContract,
    DAY_KEY,
    DEAL_SEED,
    expectedHintOutcome,
    settledState,
    SETTLED_GRADE,
    SOLVER_HINT,
    type DealHarness,
} from './dealServiceContract';

const HUGE_MS = 60_000;

/** The real service on stub workers, on a fixed clock, with an overlay and hint timeout that never fire. */
function realHarness(): DealHarness {
    vi.useFakeTimers();
    const factory = stubFactory();
    const service = createDealService({
        createWorker: factory.create,
        now: () => new Date(`${DAY_KEY}T12:00:00Z`),
        seedSource: mulberry32SeedSource(1),
        overlayDelayMs: HUGE_MS,
        hintTimeoutMs: HUGE_MS,
    });

    /** Every request of `type` posted to any stub, in posting order; a cancelled deal's worker is replaced by a new stub. */
    function posted<T extends SolverRequest['type']>(
        type: T,
    ): { readonly stub: StubWorker; readonly request: Extract<SolverRequest, { type: T }> }[] {
        return factory.stubs.flatMap((stub) =>
            stub.requests.flatMap((request) =>
                request.type === type ? [{ stub, request: request as Extract<SolverRequest, { type: T }> }] : [],
            ),
        );
    }

    function entry<T extends SolverRequest['type']>(type: T, index: number) {
        const found = posted(type)[index];
        if (found === undefined) {
            throw new Error(`no ${type} request #${String(index)} reached a worker`);
        }
        return found;
    }

    return {
        service,
        settleDeal: (index, { mode, winnableOnly }) => {
            // Only a switch-off deal is answered by the service itself; every other request waits for the worker.
            if (mode !== 'daily' && !winnableOnly) return;
            const { stub, request } = entry('findWinnable', index);
            stub.reply({
                id: request.id,
                type: 'findWinnable',
                seed: DEAL_SEED,
                verdict: 'win',
                attempts: 1,
                grade: SETTLED_GRADE,
                spares: [],
            });
        },
        progress: (index, attempt) => {
            const { stub, request } = entry('findWinnable', index);
            stub.reply({ id: request.id, type: 'progress', attempt });
        },
        settleHint: (index, source) => {
            const { stub, request } = entry('hint', index);
            stub.reply({ id: request.id, type: 'hint', hint: source === 'solver' ? SOLVER_HINT : undefined });
        },
        dispose: () => {
            service.dispose();
            vi.useRealTimers();
        },
    };
}

/** The fake, settled through its index-based API; a hint stays pending unless the position is already won. */
function fakeHarness(): DealHarness {
    const fake = fakeDealService();
    return {
        service: {
            deal: fake.deal,
            prefetch: fake.prefetch,
            pause: fake.pause,
            dispose: fake.dispose,
            hint: (state) => {
                fake.deferHints = state.status !== 'won';
                return fake.hint(state);
            },
        },
        settleDeal: (index, { mode }) => {
            fake.resolve(index, settledState(mode), mode === 'daily' ? DAY_KEY : undefined);
        },
        progress: (index, attempt) => {
            fake.progress(index, { overlay: false, attempt });
        },
        settleHint: (index, source, state) => {
            fake.resolveHint(index, expectedHintOutcome(source, state));
        },
        dispose: () => {
            fake.dispose();
        },
    };
}

dealServiceContract('the real service on a stub worker', realHarness, { cancelsHints: true });
// The fake settles a pending hint only on command: it does not yet cancel one for a newer hint, a deal or dispose().
dealServiceContract('fakeDealService', fakeHarness, { cancelsHints: false });

const REQUEST: DealRequest = { mode: 'draw3', winnableOnly: false, target: 'any' };

describe('fakeDealService beyond the contract', () => {
    it('records requests and settles them by index', async () => {
        const service = fakeDealService();
        const state = makeState({ seed: 3 });
        const first = service.deal(REQUEST);
        const second = service.deal({ mode: 'daily', winnableOnly: true, target: 'any' });
        await expect(first).resolves.toEqual({ status: 'cancelled' });

        service.resolve(1, state, '2026-09-24');

        await expect(second).resolves.toEqual({ status: 'dealt', state, dayKey: '2026-09-24' });
        expect(service.requests.map((recorded) => recorded.request.mode)).toEqual(['draw3', 'daily']);
    });

    it('settles a request as cancelled on command', async () => {
        const service = fakeDealService();
        const pending = service.deal(REQUEST);

        service.cancel(0);

        await expect(pending).resolves.toEqual({ status: 'cancelled' });
    });

    it('omits dayKey unless one is given', async () => {
        const service = fakeDealService();
        const outcome = service.deal(REQUEST);

        service.resolve(0, makeState());

        expect(await outcome).not.toHaveProperty('dayKey');
    });

    it('records that it was disposed', () => {
        const service = fakeDealService();
        expect(service.disposed).toBe(false);

        service.dispose();

        expect(service.disposed).toBe(true);
    });

    it('throws when a request is settled twice or does not exist', () => {
        const service = fakeDealService();
        void service.deal(REQUEST);
        service.resolve(0, makeState());

        expect(() => {
            service.resolve(0, makeState());
        }).toThrow();
        expect(() => {
            service.cancel(0);
        }).toThrow();
        expect(() => {
            service.cancel(5);
        }).toThrow();
    });

    it('reports progress to the request that asked for it', () => {
        const service = fakeDealService();
        const seen: number[] = [];
        void service.deal(REQUEST, (progress: DealProgress) => seen.push(progress.attempt));

        service.progress(0, { overlay: true, attempt: 4 });

        expect(seen).toEqual([4]);
    });

    it('records every prefetch choice and counts the pauses', () => {
        const service = fakeDealService();

        service.prefetch({ mode: 'draw3', winnableOnly: true });
        service.pause();
        service.prefetch({ mode: 'daily', winnableOnly: false });
        service.pause();

        expect(service.prefetches).toEqual([
            { mode: 'draw3', winnableOnly: true },
            { mode: 'daily', winnableOnly: false },
        ]);
        expect(service.pauses).toBe(2);
    });

    it('answers a hint with none', async () => {
        await expect(fakeDealService().hint(makeState())).resolves.toEqual({ status: 'none' });
    });

    it('answers a hint with the configured outcome and records the state asked about', async () => {
        const service = fakeDealService();
        const state = makeState({ seed: 9 });
        const outcome: HintOutcome = { status: 'hint', source: 'heuristic', hint: { kind: 'draw' } };
        service.hintOutcome = outcome;

        await expect(service.hint(state)).resolves.toBe(outcome);

        expect(service.hintRequests).toEqual([state]);
    });

    it('holds a hint pending while deferred and settles it on command', async () => {
        const service = fakeDealService();
        service.deferHints = true;
        const first = service.hint(makeState({ seed: 1 }));
        const second = service.hint(makeState({ seed: 2 }));

        service.resolveHint(1, { status: 'cancelled' });
        service.resolveHint(0);

        await expect(second).resolves.toEqual({ status: 'cancelled' });
        await expect(first).resolves.toEqual({ status: 'none' });
        expect(service.hintRequests.map((state) => state.seed)).toEqual([1, 2]);
        expect(() => {
            service.resolveHint(0);
        }).toThrow();
        expect(() => {
            service.resolveHint(7);
        }).toThrow();
    });
});
