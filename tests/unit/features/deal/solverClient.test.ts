// @vitest-environment node
// covers: KS-DEAL-04, KS-DEAL-10
import '@vitest/web-worker';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { createSolverClient, type SolverClient, type WorkerLike } from '../../../../src/features/deal/solverClient';
import { solverHint } from '../../../../src/solver/hint';
import { findWinnable } from '../../../../src/solver/winnable';
import { corpusSeeds, MIDGAME_POSITIONS, midgameState } from '../../../fixtures/solverCorpus';
import { realFactory, stubAt, stubFactory } from '../../../fixtures/workers';

const FIND_BUDGET = 5000;
const HINT_BUDGET = 3000;
const HINT_TIMEOUT_MS = 150;

const [WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');
const STATE = dealFromSeed(WIN_SEED, 'draw1');

const clients: SolverClient[] = [];

/** Tracks `client` so `afterEach` disposes it, whatever the test did. */
function track(client: SolverClient): SolverClient {
    clients.push(client);
    return client;
}

afterEach(() => {
    vi.useRealTimers();
    for (const client of clients.splice(0)) {
        client.dispose();
    }
});

function midgameAtHintBudget(): ReturnType<typeof midgameState> {
    const entry = MIDGAME_POSITIONS.find((position) => position.budget === HINT_BUDGET);
    if (entry === undefined) {
        throw new Error('no midgame position pinned at the hint budget');
    }
    return midgameState(entry);
}

describe('solver client with the real worker', () => {
    it('starts no worker before the first request, and reuses the idle one afterwards', async () => {
        const factory = realFactory();
        const client = track(createSolverClient(factory.create));
        expect(factory.workers).toHaveLength(0);

        await client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        expect(factory.workers).toHaveLength(1);

        await client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        expect(factory.workers).toHaveLength(1);
    });

    it('resolves findWinnable ok with the direct result through the default factory', async () => {
        const client = track(createSolverClient());
        const seeds = [LOSS_SEED, WIN_SEED];

        const outcome = await client.findWinnable(seeds, FIND_BUDGET, 'draw1');

        expect(outcome).toEqual({ status: 'ok', result: findWinnable(seeds, FIND_BUDGET, 'draw1') });
    });

    it('deals the seeds in the mode it is given', async () => {
        const client = track(createSolverClient());
        const seeds = [1, 10, 8];

        const outcome = await client.findWinnable(seeds, FIND_BUDGET, 'draw3');

        expect(outcome).toMatchObject({ status: 'ok', result: { seed: 8, verdict: 'win', attempts: 3 } });
        expect(outcome).toEqual({ status: 'ok', result: findWinnable(seeds, FIND_BUDGET, 'draw3') });
    });

    it('posts the mode with the seeds and the budget', () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'vegas');

        expect(stubAt(factory.stubs, 0).requests).toEqual([
            {
                id: expect.any(Number) as number,
                type: 'findWinnable',
                seeds: [WIN_SEED],
                budget: FIND_BUDGET,
                mode: 'vegas',
            },
        ]);
    });

    it('posts the selection it is given and resolves with the grade and spares the worker replies', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));
        const selection = { target: 'hard', gradeLimit: 3 } as const;

        const deal = client.findWinnable([WIN_SEED, LOSS_SEED], FIND_BUDGET, 'draw3', { selection });

        const stub = stubAt(factory.stubs, 0);
        expect(stub.requests[0]).toMatchObject({ type: 'findWinnable', mode: 'draw3', selection });
        const spares = [{ seed: LOSS_SEED, grade: 'easy' }] as const;
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 2,
            grade: 'hard',
            spares,
        });
        expect(await deal).toEqual({
            status: 'ok',
            result: { seed: WIN_SEED, verdict: 'win', attempts: 2, grade: 'hard', spares },
        });
    });

    it('posts the known verdicts and hands each outcome the worker reports to onOutcome, for the pending deal only', () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));
        const known = [{ seed: LOSS_SEED, verdict: 'loss', grade: undefined }] as const;
        const outcomes: unknown[] = [];

        void client.findWinnable([LOSS_SEED, WIN_SEED], FIND_BUDGET, 'draw1', {
            known,
            onOutcome: (outcome) => outcomes.push(outcome),
        });

        const stub = stubAt(factory.stubs, 0);
        expect(stub.requests[0]).toMatchObject({ type: 'findWinnable', known });
        stub.reply({ id: stub.idOf(0), type: 'outcome', outcome: { seed: WIN_SEED, verdict: 'win', grade: 'easy' } });
        stub.reply({ id: stub.idOf(0) + 1, type: 'outcome', outcome: { seed: 5, verdict: 'loss', grade: undefined } });
        expect(outcomes).toEqual([{ seed: WIN_SEED, verdict: 'win', grade: 'easy' }]);
    });

    it('reports progress in order for the pending deal', async () => {
        const client = track(createSolverClient(realFactory().create));
        const attempts: number[] = [];

        const outcome = await client.findWinnable([LOSS_SEED, WIN_SEED], FIND_BUDGET, 'draw1', {
            onProgress: (attempt) => {
                attempts.push(attempt);
            },
        });

        expect(outcome.status).toBe('ok');
        expect(attempts).toEqual([1, 2]);
    });

    it('cancels a pending deal when a second is started, and starts exactly one new worker', async () => {
        const factory = realFactory();
        const client = track(createSolverClient(factory.create));
        const seeds = [LOSS_SEED, WIN_SEED];
        let second: ReturnType<SolverClient['findWinnable']> | undefined;
        const onFirstProgress = vi.fn(() => {
            // The in-process worker runs on this thread and posts synchronously, so this runs mid-search: the first
            // request is certainly pending and its worker busy. Starting the second here rather than back to back
            // also lets the first worker finish loading, which the polyfill needs before a second one may load.
            second ??= client.findWinnable(seeds, FIND_BUDGET, 'draw1');
        });

        const first = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1', { onProgress: onFirstProgress });

        expect(await first).toEqual({ status: 'cancelled' });
        expect(await second).toEqual({ status: 'ok', result: findWinnable(seeds, FIND_BUDGET, 'draw1') });
        expect(onFirstProgress).toHaveBeenCalledExactlyOnceWith(1);
        expect(factory.workers).toHaveLength(2);
    });

    it('cancels the first of two back-to-back hints and answers only the second', async () => {
        const factory = realFactory();
        const client = track(createSolverClient(factory.create));
        const state = midgameAtHintBudget();

        const first = client.hint(state, HINT_BUDGET, 60_000);
        const second = client.hint(state, HINT_BUDGET, 60_000);

        expect(await first).toEqual({ status: 'cancelled' });
        expect(await second).toEqual({ status: 'ok', hint: solverHint(state, HINT_BUDGET) });
        expect(factory.workers).toHaveLength(1);
    });

    it('answers a hint busy at once while a deal is pending, and the deal still resolves ok', async () => {
        const factory = realFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const hint = await client.hint(STATE, HINT_BUDGET, 60_000);

        expect(hint).toEqual({ status: 'busy' });
        expect(await deal).toEqual({ status: 'ok', result: findWinnable([WIN_SEED], FIND_BUDGET, 'draw1') });
        expect(factory.workers).toHaveLength(1);
    });

    it('neither starts a worker nor posts anything for a hint refused as busy', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        await client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);

        expect(factory.stubs).toHaveLength(1);
        expect(stub.requests.map((request) => request.type)).toEqual(['findWinnable']);
    });

    it('terminates the worker on dispose() and settles anything pending as cancelled', async () => {
        const factory = realFactory();
        const client = track(createSolverClient(factory.create));
        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const worker = factory.workers[0];
        if (worker === undefined) {
            throw new Error('the deal did not start a worker');
        }
        const terminate = vi.spyOn(worker, 'terminate');

        client.dispose();

        expect(await deal).toEqual({ status: 'cancelled' });
        expect(terminate).toHaveBeenCalledTimes(1);
        client.dispose();
        expect(terminate).toHaveBeenCalledTimes(1);
    });
});

describe('solver client with a silent stub', () => {
    it('resolves a hint as timeout after timeoutMs without terminating the worker', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const hint = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);
        const stub = stubAt(factory.stubs, 0);
        await vi.advanceTimersByTimeAsync(HINT_TIMEOUT_MS - 1);
        expect(stub.requests).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);

        expect(await hint).toEqual({ status: 'timeout' });
        expect(stub.terminated).toBe(false);
    });

    it('ignores a later reply for a timed-out hint', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));
        const settled = vi.fn();

        const hint = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS).then(settled);
        const stub = stubAt(factory.stubs, 0);
        await vi.advanceTimersByTimeAsync(HINT_TIMEOUT_MS);
        await hint;
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: { kind: 'draw' } });
        await vi.advanceTimersByTimeAsync(HINT_TIMEOUT_MS * 2);

        expect(settled).toHaveBeenCalledTimes(1);
        expect(settled).toHaveBeenCalledWith({ status: 'timeout' });
        expect(stub.terminated).toBe(false);
    });

    it('does not fire the timeout of a hint that was answered in time', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const hint = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: { kind: 'recycle' } });

        expect(await hint).toEqual({ status: 'ok', hint: { kind: 'recycle' } });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('resolves an undefined suggestion as ok', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const hint = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: undefined });

        expect(await hint).toEqual({ status: 'ok', hint: undefined });
    });

    it('terminates a still-busy worker when a deal follows a timed-out hint, and uses a fresh one', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const hint = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);
        await vi.advanceTimersByTimeAsync(HINT_TIMEOUT_MS);
        expect(await hint).toEqual({ status: 'timeout' });
        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');

        expect(factory.stubs).toHaveLength(2);
        expect(stubAt(factory.stubs, 0).terminated).toBe(true);
        expect(stubAt(factory.stubs, 1).requests.map((request) => request.type)).toEqual(['findWinnable']);
    });

    it('keeps the worker for a deal once the timed-out hint has been answered', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const hint = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);
        const stub = stubAt(factory.stubs, 0);
        await vi.advanceTimersByTimeAsync(HINT_TIMEOUT_MS);
        await hint;
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: undefined });
        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');

        expect(factory.stubs).toHaveLength(1);
        expect(stub.terminated).toBe(false);
        expect(stub.requests.map((request) => request.type)).toEqual(['hint', 'findWinnable']);
    });

    it('queues a newer hint on the same worker and drops the replaced hint reply', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const first = client.hint(STATE, HINT_BUDGET, 60_000);
        const second = client.hint(STATE, HINT_BUDGET, 60_000);
        const stub = stubAt(factory.stubs, 0);

        expect(await first).toEqual({ status: 'cancelled' });
        expect(factory.stubs).toHaveLength(1);
        expect(stub.terminated).toBe(false);
        expect(stub.requests).toHaveLength(2);
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: { kind: 'draw' } });
        stub.reply({ id: stub.idOf(1), type: 'hint', hint: { kind: 'recycle' } });
        expect(await second).toEqual({ status: 'ok', hint: { kind: 'recycle' } });
    });

    it('settles only pending hints as cancelled on cancelHints(), clearing their timers and keeping the worker', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const hint = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);
        const stub = stubAt(factory.stubs, 0);
        expect(vi.getTimerCount()).toBe(1);
        client.cancelHints();

        expect(await hint).toEqual({ status: 'cancelled' });
        expect(vi.getTimerCount()).toBe(0);
        expect(stub.terminated).toBe(false);
        // The late reply is dropped by id, and the worker is still the one used next.
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: { kind: 'draw' } });
        const next = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);
        expect(factory.stubs).toHaveLength(1);
        stub.reply({ id: stub.idOf(1), type: 'hint', hint: { kind: 'recycle' } });
        expect(await next).toEqual({ status: 'ok', hint: { kind: 'recycle' } });
    });

    it('leaves a pending deal untouched on cancelHints()', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        client.cancelHints();
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 1,
            grade: 'easy',
            spares: [],
        });

        expect(await deal).toEqual({
            status: 'ok',
            result: { seed: WIN_SEED, verdict: 'win', attempts: 1, grade: 'easy', spares: [] },
        });
        expect(stub.terminated).toBe(false);
    });

    it('does nothing on cancelHints() when nothing is pending, and starts no worker', () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        client.cancelHints();

        expect(factory.stubs).toHaveLength(0);
    });

    it('numbers requests with increasing ids', () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        void client.hint(STATE, HINT_BUDGET, 60_000);
        void client.hint(STATE, HINT_BUDGET, 60_000);
        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const ids = stubAt(factory.stubs, 0).requests.map((request) => request.id);

        expect(ids).toHaveLength(2);
        expect(ids[1]).toBeGreaterThan(ids[0] ?? Infinity);
        const deal = stubAt(factory.stubs, 1).requests[0];
        expect(deal?.id).toBeGreaterThan(ids[1] ?? Infinity);
    });

    it('keeps an idle worker on cancel()', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 1,
            grade: 'easy',
            spares: [],
        });
        await deal;
        client.cancel();
        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');

        expect(stub.terminated).toBe(false);
        expect(factory.stubs).toHaveLength(1);
        expect(stub.requests).toHaveLength(2);
    });

    it('terminates a busy worker on cancel(), settles the request as cancelled and starts fresh next time', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        client.cancel();

        expect(await deal).toEqual({ status: 'cancelled' });
        expect(stub.terminated).toBe(true);
        expect(factory.stubs).toHaveLength(1);
        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        expect(factory.stubs).toHaveLength(2);
    });

    it('drops progress and replies that arrive for a cancelled request', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));
        const onProgress = vi.fn();

        const first = client.findWinnable([LOSS_SEED, WIN_SEED], FIND_BUDGET, 'draw1', { onProgress });
        const stub = stubAt(factory.stubs, 0);
        const firstId = stub.idOf(0);
        stub.reply({ id: firstId, type: 'progress', attempt: 1 });
        expect(onProgress).toHaveBeenCalledExactlyOnceWith(1);

        const second = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        expect(await first).toEqual({ status: 'cancelled' });
        stub.reply({ id: firstId, type: 'progress', attempt: 2 });
        stub.reply({
            id: firstId,
            type: 'findWinnable',
            seed: LOSS_SEED,
            verdict: 'random',
            attempts: 2,
            grade: undefined,
            spares: [],
        });
        expect(onProgress).toHaveBeenCalledTimes(1);

        const fresh = stubAt(factory.stubs, 1);
        fresh.reply({
            id: fresh.idOf(0),
            type: 'findWinnable',
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 1,
            grade: 'easy',
            spares: [],
        });
        expect(await second).toEqual({
            status: 'ok',
            result: { seed: WIN_SEED, verdict: 'win', attempts: 1, grade: 'easy', spares: [] },
        });
    });

    it('passes progress to the pending deal in the order it arrives', () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));
        const attempts: number[] = [];

        void client.findWinnable([LOSS_SEED, WIN_SEED], FIND_BUDGET, 'draw1', {
            onProgress: (attempt) => {
                attempts.push(attempt);
            },
        });
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: stub.idOf(0), type: 'progress', attempt: 1 });
        stub.reply({ id: stub.idOf(0), type: 'progress', attempt: 2 });

        expect(attempts).toEqual([1, 2]);
    });

    it('settles a reply of the wrong kind for a pending request as failed', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: undefined });

        expect(await deal).toEqual({ status: 'failed' });
        expect(stub.terminated).toBe(true);
    });
});

describe('solver client failures', () => {
    it('settles a pending deal as failed on an error event and uses a fresh worker next', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        stub.emit('error', { message: 'boom' });

        expect(await deal).toEqual({ status: 'failed' });
        expect(stub.terminated).toBe(true);
        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        expect(factory.stubs).toHaveLength(2);
        expect(stubAt(factory.stubs, 1).requests).toHaveLength(1);
    });

    it('settles a pending hint as failed on an error event', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const hint = client.hint(STATE, HINT_BUDGET, 60_000);
        stubAt(factory.stubs, 0).emit('error', { message: 'boom' });

        expect(await hint).toEqual({ status: 'failed' });
    });

    it('settles pending requests as failed on a messageerror event', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        stubAt(factory.stubs, 0).emit('messageerror');
        expect(await deal).toEqual({ status: 'failed' });

        const hint = client.hint(STATE, HINT_BUDGET, 60_000);
        stubAt(factory.stubs, 1).emit('messageerror');
        expect(await hint).toEqual({ status: 'failed' });
        expect(factory.stubs).toHaveLength(2);
    });

    describe.each<{ readonly label: string; readonly data: unknown }>([
        { label: 'null', data: null },
        { label: 'a string', data: 'not a reply' },
        { label: 'an object with a non-numeric id', data: { id: '1', type: 'hint', hint: undefined } },
        { label: 'an object with an unknown type', data: { id: 1, type: 'unknown' } },
    ])('for a malformed reply that is $label', ({ data }) => {
        it('settles a pending deal as failed and terminates the worker', async () => {
            const factory = stubFactory();
            const client = track(createSolverClient(factory.create));

            const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
            const stub = stubAt(factory.stubs, 0);
            stub.emit('message', { data });

            expect(await deal).toEqual({ status: 'failed' });
            expect(stub.terminated).toBe(true);
        });

        it('settles a pending hint as failed and terminates the worker', async () => {
            const factory = stubFactory();
            const client = track(createSolverClient(factory.create));

            const hint = client.hint(STATE, HINT_BUDGET, 60_000);
            const stub = stubAt(factory.stubs, 0);
            stub.emit('message', { data });

            expect(await hint).toEqual({ status: 'failed' });
            expect(stub.terminated).toBe(true);
        });
    });

    it('still drops a well-formed reply for an unknown id without failing anything', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: 9999, type: 'hint', hint: undefined });
        stub.reply({ id: 9999, type: 'progress', attempt: 1 });
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 1,
            grade: 'easy',
            spares: [],
        });

        expect(await deal).toEqual({
            status: 'ok',
            result: { seed: WIN_SEED, verdict: 'win', attempts: 1, grade: 'easy', spares: [] },
        });
        expect(stub.terminated).toBe(false);
    });

    it('ignores events from a worker it already discarded', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        void client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const first = stubAt(factory.stubs, 0);
        const second = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        first.emit('error', { message: 'late' });
        const fresh = stubAt(factory.stubs, 1);
        fresh.reply({
            id: fresh.idOf(0),
            type: 'findWinnable',
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 1,
            grade: 'easy',
            spares: [],
        });

        expect(await second).toEqual({
            status: 'ok',
            result: { seed: WIN_SEED, verdict: 'win', attempts: 1, grade: 'easy', spares: [] },
        });
        expect(fresh.terminated).toBe(false);
    });

    it('settles both request kinds as failed when the factory throws, and tries again next time', async () => {
        const create = vi.fn<() => WorkerLike>(() => {
            throw new Error('no workers here');
        });
        const client = track(createSolverClient(create));

        expect(await client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1')).toEqual({ status: 'failed' });
        expect(await client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS)).toEqual({ status: 'failed' });
        expect(create).toHaveBeenCalledTimes(2);
    });

    it('settles a request as failed, and discards the worker, when postMessage throws', async () => {
        const factory = stubFactory();
        const client = track(createSolverClient(factory.create));

        const deal = client.findWinnable([WIN_SEED], FIND_BUDGET, 'draw1');
        const stub = stubAt(factory.stubs, 0);
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: WIN_SEED,
            verdict: 'win',
            attempts: 1,
            grade: 'easy',
            spares: [],
        });
        await deal;
        stub.postError = new Error('cannot clone');
        const failed = client.hint(STATE, HINT_BUDGET, HINT_TIMEOUT_MS);

        expect(await failed).toEqual({ status: 'failed' });
        expect(stub.terminated).toBe(true);
    });
});
