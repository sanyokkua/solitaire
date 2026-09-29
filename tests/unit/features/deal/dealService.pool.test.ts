// @vitest-environment node
// covers: KS-DEAL-11, KS-DEAL-12
import '@vitest/web-worker';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { Grade } from '../../../../src/domain/types';
import { GRADE_LIMIT, MAX_ATTEMPTS, winnableBudget } from '../../../../src/features/deal/budgets';
import { createDealService, type DealService } from '../../../../src/features/deal/dealService';
import type { SolverRequest } from '../../../../src/solver/protocol';
import type { Outcome, Spare } from '../../../../src/solver/winnable';
import {
    mulberry32SeedSource,
    recordingFactory,
    scriptedSeedSource,
    stubAt,
    stubFactory,
    type StubWorker,
    type WorkerLog,
} from '../../../fixtures/workers';

type FindRequest = Extract<SolverRequest, { type: 'findWinnable' }>;

const HUGE_MS = 60_000;
const HINT_TIMEOUT_MS = 150;
const FIXED = 1;
/** A seed whose Draw 3 deal proves winnable, and grades Easy, at once within its budget (found by scanning from 1). */
const QUICK_EASY_DRAW3_SEED = 8;

const DRAW1 = { mode: 'draw1', winnableOnly: true } as const;

const services: DealService[] = [];

afterEach(() => {
    vi.useRealTimers();
    for (const service of services.splice(0)) {
        service.dispose();
    }
});

/** A service on stub workers (the pool's and the player's are told apart by creation order), with timers that never fire. */
function stubbedService(seedSource = mulberry32SeedSource(FIXED)): {
    readonly service: DealService;
    readonly stubs: StubWorker[];
} {
    const factory = stubFactory();
    const service = createDealService({
        createWorker: factory.create,
        seedSource,
        overlayDelayMs: HUGE_MS,
        hintTimeoutMs: HUGE_MS,
    });
    services.push(service);
    return { service, stubs: factory.stubs };
}

/** Lets pending replies, and the pool's and service's reactions to them, run. */
async function settle(): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

function findRequests(stub: StubWorker): FindRequest[] {
    return stub.requests.filter((request): request is FindRequest => request.type === 'findWinnable');
}

function lastFind(stub: StubWorker): FindRequest {
    const request = findRequests(stub).at(-1);
    if (request === undefined) {
        throw new Error('no findWinnable request reached the stub');
    }
    return request;
}

/** Answers the latest `findWinnable` request posted to `stub` with a proven deal. */
async function replyWin(
    stub: StubWorker,
    seed: number,
    grade: Grade,
    { attempts = 3, spares = [] }: { readonly attempts?: number; readonly spares?: readonly Spare[] } = {},
): Promise<void> {
    stub.reply({ id: lastFind(stub).id, type: 'findWinnable', seed, verdict: 'win', attempts, grade, spares });
    await settle();
}

describe('deal service: serving from the pool', () => {
    it('serves a matching request at once, with its recorded verdict, attempts and grade, no progress and no worker request', async () => {
        const { service, stubs } = stubbedService();
        const onProgress = vi.fn();

        service.prefetch(DRAW1);
        const pool = stubAt(stubs, 0);
        expect(lastFind(pool)).toMatchObject({
            mode: 'draw1',
            budget: winnableBudget('draw1'),
            selection: { target: 'easy', gradeLimit: GRADE_LIMIT },
        });
        await replyWin(pool, 101, 'medium', { attempts: 3, spares: [{ seed: 102, grade: 'easy' }] });

        vi.useFakeTimers();
        const medium = await service.deal({ ...DRAW1, target: 'medium' }, onProgress);
        const easy = await service.deal({ ...DRAW1, target: 'easy' }, onProgress);
        await vi.advanceTimersByTimeAsync(HUGE_MS * 2);

        expect(medium).toEqual({
            status: 'dealt',
            state: dealFromSeed(101, 'draw1', { verdict: 'win', attempts: 3, grade: 'medium' }),
        });
        expect(easy).toEqual({
            status: 'dealt',
            state: dealFromSeed(102, 'draw1', { verdict: 'win', attempts: 1, grade: 'easy' }),
        });
        expect(onProgress).not.toHaveBeenCalled();
        // Only the pool's worker exists: no player search ran for either deal.
        expect(stubs).toHaveLength(1);
    });

    it('delivers a pooled deal once, and searches the next request of that grade', async () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        await replyWin(stubAt(stubs, 0), 101, 'hard');

        const first = await service.deal({ ...DRAW1, target: 'hard' });
        const second = service.deal({ ...DRAW1, target: 'hard' });

        expect(first).toMatchObject({ status: 'dealt', state: { seed: 101, grade: 'hard' } });
        expect(lastFind(stubAt(stubs, 1))).toMatchObject({ mode: 'draw1', selection: { target: 'hard' } });
        service.dispose();
        expect(await second).toEqual({ status: 'cancelled' });
    });

    it('never serves a pooled deal of another grade, nor one of another mode', async () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        await replyWin(stubAt(stubs, 0), 101, 'easy');

        void service.deal({ ...DRAW1, target: 'hard' });
        void service.deal({ mode: 'draw3', winnableOnly: true, target: 'easy' });

        // Each newer search replaces the player's busy worker; the pool's worker is the first stub.
        const searched = stubs.slice(1).flatMap(findRequests);
        expect(searched.map((request) => [request.mode, request.selection?.target])).toEqual([
            ['draw1', 'hard'],
            ['draw3', 'easy'],
        ]);
    });

    it('uses no pooled deal for Daily or with the switch off', async () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        await replyWin(stubAt(stubs, 0), 101, 'easy');

        const off = await service.deal({ mode: 'draw1', winnableOnly: false, target: 'easy' });
        void service.deal({ mode: 'daily', winnableOnly: true, target: 'any' });

        expect(off).toMatchObject({ status: 'dealt', state: { verdict: 'random' } });
        expect(off.status === 'dealt' && off.state.seed).not.toBe(101);
        expect(lastFind(stubAt(stubs, 1)).mode).toBe('daily');
        // The Easy deal is still pooled.
        expect(await service.deal({ ...DRAW1, target: 'easy' })).toMatchObject({ state: { seed: 101 } });
    });
});

describe('deal service: a live search with the cache and the pool', () => {
    it('sends the verdicts a cancelled search established, and pools the spares of the search that settles', async () => {
        // Both requests draw the same 40 seeds, so the restarted search can reuse what the first one found.
        const seeds = Array.from({ length: MAX_ATTEMPTS }, (_, index) => 1000 + index);
        const { service, stubs } = stubbedService(scriptedSeedSource([...seeds, ...seeds]));
        const [lossSeed = 0, winSeed = 0] = seeds;
        const searched: Outcome[] = [
            { seed: lossSeed, verdict: 'loss', grade: undefined },
            { seed: winSeed, verdict: 'win', grade: 'easy' },
        ];

        const first = service.deal({ ...DRAW1, target: 'hard' });
        const firstWorker = stubAt(stubs, 0);
        expect(lastFind(firstWorker).known).toEqual([]);
        for (const outcome of searched) {
            firstWorker.reply({ id: lastFind(firstWorker).id, type: 'outcome', outcome });
        }
        const second = service.deal({ ...DRAW1, target: 'hard' });
        expect(await first).toEqual({ status: 'cancelled' });

        const secondWorker = stubAt(stubs, 1);
        expect(lastFind(secondWorker)).toMatchObject({ seeds, known: searched });
        await replyWin(secondWorker, 1005, 'hard', { attempts: 6, spares: [{ seed: winSeed, grade: 'easy' }] });
        expect(await second).toEqual({
            status: 'dealt',
            state: dealFromSeed(1005, 'draw1', { verdict: 'win', attempts: 6, grade: 'hard' }),
        });

        // The spare is served at once, with attempts 1, and no new search starts.
        expect(await service.deal({ ...DRAW1, target: 'easy' })).toEqual({
            status: 'dealt',
            state: dealFromSeed(winSeed, 'draw1', { verdict: 'win', attempts: 1, grade: 'easy' }),
        });
        expect(findRequests(secondWorker)).toHaveLength(1);
        expect(stubs).toHaveLength(2);
    });

    it('pools no spare of a Daily search', async () => {
        const { service, stubs } = stubbedService();

        const daily = service.deal({ mode: 'daily', winnableOnly: true, target: 'any' });
        await replyWin(stubAt(stubs, 0), 7, 'medium', { spares: [{ seed: 8, grade: 'easy' }] });
        await daily;
        const next = service.deal({ ...DRAW1, target: 'easy' });

        expect(findRequests(stubAt(stubs, 0))).toHaveLength(2);
        service.dispose();
        expect(await next).toEqual({ status: 'cancelled' });
    });
});

describe('deal service: the pool is never cancelled by the player', () => {
    it('pauses filling while a player deal is pending, without cancelling the fill in flight', async () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        const pool = stubAt(stubs, 0);

        const deal = service.deal({ ...DRAW1, target: 'any' });
        const player = stubAt(stubs, 1);
        expect(pool.terminated).toBe(false);

        // The fill in flight still lands, but no new one starts while the deal is pending.
        await replyWin(pool, 101, 'easy');
        expect(findRequests(pool)).toHaveLength(1);

        await replyWin(player, 202, 'medium', { attempts: 2 });
        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(202, 'draw1', { verdict: 'win', attempts: 2, grade: 'medium' }),
        });
        expect(findRequests(pool)).toHaveLength(2);
        expect(pool.terminated).toBe(false);
    });

    it('never cancels the pool for a newer deal, and a superseded search does not end the pause of a newer one', async () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        const pool = stubAt(stubs, 0);

        const first = service.deal({ ...DRAW1, target: 'hard' });
        const second = service.deal({ ...DRAW1, target: 'hard' });
        expect(await first).toEqual({ status: 'cancelled' });
        expect(pool.terminated).toBe(false);

        // The newer deal is still pending, so the pool stays paused after its fill lands.
        await replyWin(pool, 101, 'easy');
        expect(findRequests(pool)).toHaveLength(1);

        // A deal dealt on the input thread supersedes the pending one and ends the pause.
        const off = await service.deal({ mode: 'draw3', winnableOnly: false, target: 'any' });
        expect(off.status).toBe('dealt');
        expect(await second).toEqual({ status: 'cancelled' });
        expect(pool.terminated).toBe(false);
        expect(findRequests(pool)).toHaveLength(2);
    });

    it('ends the pause when a pooled deal supersedes a pending search', async () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        const pool = stubAt(stubs, 0);
        await replyWin(pool, 101, 'easy');
        await replyWin(pool, 102, 'medium');
        await replyWin(pool, 103, 'hard');
        const fills = findRequests(pool).length;

        const pending = service.deal({ mode: 'vegas', winnableOnly: true, target: 'any' });
        await replyWin(pool, 104, 'easy');
        expect(findRequests(pool)).toHaveLength(fills);

        expect(await service.deal({ ...DRAW1, target: 'medium' })).toMatchObject({ state: { seed: 102 } });
        expect(await pending).toEqual({ status: 'cancelled' });
        expect(findRequests(pool)).toHaveLength(fills + 1);
    });

    it('sends a player hint at once to the player worker while a fill is in flight, and leaves the fill alone', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const service = createDealService({
            createWorker: factory.create,
            seedSource: mulberry32SeedSource(FIXED),
            hintTimeoutMs: HINT_TIMEOUT_MS,
        });
        services.push(service);
        service.prefetch(DRAW1);
        const pool = stubAt(factory.stubs, 0);
        const state = dealFromSeed(1, 'draw1');

        const answered = service.hint(state);
        const player = stubAt(factory.stubs, 1);
        const [request] = player.requests;
        expect(request).toMatchObject({ type: 'hint', state });
        await vi.advanceTimersByTimeAsync(HINT_TIMEOUT_MS - 1);
        player.reply({ id: player.idOf(0), type: 'hint', hint: { kind: 'draw' } });

        expect(await answered).toEqual({ status: 'hint', source: 'solver', hint: { kind: 'draw' } });
        expect(pool.requests.map((posted) => posted.type)).toEqual(['findWinnable']);
        expect(pool.terminated).toBe(false);
    });
});

describe('deal service: prefetch, pause and dispose', () => {
    it('fills nothing for Daily or with the switch off', () => {
        const { service, stubs } = stubbedService();

        service.prefetch({ mode: 'daily', winnableOnly: true });
        service.prefetch({ mode: 'vegas', winnableOnly: false });

        expect(stubs).toHaveLength(0);
    });

    it('starts no new fill after pause, and fills again after prefetch', async () => {
        const { service, stubs } = stubbedService();
        service.pause();
        service.prefetch({ mode: 'draw3', winnableOnly: true });
        const pool = stubAt(stubs, 0);
        expect(lastFind(pool).mode).toBe('draw3');

        service.pause();
        await replyWin(pool, 101, 'easy');
        expect(findRequests(pool)).toHaveLength(1);

        service.prefetch({ mode: 'vegas', winnableOnly: true });
        expect(findRequests(pool)).toHaveLength(2);
        expect(lastFind(pool).mode).toBe('vegas');
    });

    it('terminates the pool worker on dispose, and ignores prefetch and pause afterwards', () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        const pool = stubAt(stubs, 0);

        service.dispose();

        expect(pool.terminated).toBe(true);
        expect(() => {
            service.prefetch(DRAW1);
            service.pause();
        }).not.toThrow();
        expect(stubs).toHaveLength(1);
    });
});

describe('deal service: a failed pool worker', () => {
    it('affects neither the player deals nor the hints, and the next fill starts a new pool worker', async () => {
        const { service, stubs } = stubbedService();
        service.prefetch(DRAW1);
        const failed = stubAt(stubs, 0);
        await replyWin(failed, 101, 'easy');
        failed.emit('error');
        await settle();
        expect(failed.terminated).toBe(true);

        // What was pooled is still served, and the refill it triggers starts a new pool worker.
        expect(await service.deal({ ...DRAW1, target: 'easy' })).toMatchObject({ state: { seed: 101 } });
        const pool = stubAt(stubs, 1);
        expect(lastFind(pool).mode).toBe('draw1');

        const deal = service.deal({ ...DRAW1, target: 'hard' });
        const player = stubAt(stubs, 2);
        const duringDeal = service.hint(dealFromSeed(1, 'draw1'));
        await replyWin(player, 202, 'hard');

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(202, 'draw1', { verdict: 'win', attempts: 3, grade: 'hard' }),
        });
        expect(await duringDeal).toMatchObject({ status: 'hint', source: 'heuristic' });
        const hint = service.hint(dealFromSeed(1, 'draw1'));
        player.reply({ id: player.idOf(player.requests.length - 1), type: 'hint', hint: { kind: 'draw' } });
        expect(await hint).toEqual({ status: 'hint', source: 'solver', hint: { kind: 'draw' } });
        expect(pool.terminated).toBe(false);
        expect(stubs).toHaveLength(3);
    });
});

describe('deal service: the player and pool threads answer alike', () => {
    it('posts the same Draw 3 request to both threads and receives the same answer', async () => {
        const factory = recordingFactory();
        // Every seed either thread draws is the same quick Easy win, so a player's search for Easy and the pool's first
        // fill (for Easy, its emptiest grade) post the same seeds, budget and selection; there are seeds to spare for the
        // refills that follow.
        const service = createDealService({
            createWorker: factory.create,
            seedSource: scriptedSeedSource(Array.from({ length: MAX_ATTEMPTS * 10 }, () => QUICK_EASY_DRAW3_SEED)),
            overlayDelayMs: HUGE_MS,
        });
        services.push(service);

        // The player's search runs first and pauses the pool; the pool's first fill starts once it settles.
        const outcome = await service.deal({ mode: 'draw3', winnableOnly: true, target: 'easy' });
        service.prefetch({ mode: 'draw3', winnableOnly: true });
        await vi.waitFor(() => {
            expect(factory.logs[1]?.replies.some((reply) => reply.type === 'findWinnable')).toBe(true);
        });

        const [player, pool] = factory.logs;
        const request = (log: WorkerLog | undefined) => {
            const found = log?.posted.find((posted): posted is FindRequest => posted.type === 'findWinnable');
            if (found === undefined) {
                throw new Error('the thread was never asked');
            }
            const { seeds, budget, mode, selection } = found;
            return { seeds, budget, mode, selection };
        };
        const answer = (log: WorkerLog | undefined) => {
            const found = log?.replies.find((reply) => reply.type === 'findWinnable');
            if (found === undefined) {
                throw new Error('the thread never answered');
            }
            return { ...found, id: 0 };
        };
        expect(request(pool)).toEqual(request(player));
        expect(answer(pool)).toEqual(answer(player));
        expect(answer(player)).toMatchObject({ seed: QUICK_EASY_DRAW3_SEED, verdict: 'win', grade: 'easy' });
        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(QUICK_EASY_DRAW3_SEED, 'draw3', { verdict: 'win', attempts: 1, grade: 'easy' }),
        });
    });
});
