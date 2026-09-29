import { afterEach, describe, expect, it } from 'vitest';
import type { Grade } from '../../../../src/domain/types';
import { GRADE_LIMIT, MAX_ATTEMPTS, winnableBudget } from '../../../../src/features/deal/budgets';
import { createDealPool, POOL_PER_GRADE, type DealPool } from '../../../../src/features/deal/dealPool';
import { createSolverClient } from '../../../../src/features/deal/solverClient';
import type { SolverRequest } from '../../../../src/solver/protocol';
import type { Spare } from '../../../../src/solver/winnable';
import { scriptedSeedSource, stubAt, stubFactory, type StubWorker } from '../../../fixtures/workers';

type FindRequest = Extract<SolverRequest, { type: 'findWinnable' }>;

const pools: DealPool[] = [];

afterEach(() => {
    for (const pool of pools.splice(0)) {
        pool.dispose();
    }
});

/** A pool over its own client and a stub worker factory; fresh seeds are 1, 2, 3, … in order. */
function setup(): { readonly pool: DealPool; readonly stubs: StubWorker[] } {
    const factory = stubFactory();
    const seeds = Array.from({ length: 40 * MAX_ATTEMPTS }, (_, index) => index + 1);
    const pool = createDealPool({
        client: createSolverClient(factory.create),
        seedSource: scriptedSeedSource(seeds),
    });
    pools.push(pool);
    return { pool, stubs: factory.stubs };
}

/** Lets the client's reply, and the pool's reaction to it, run. */
async function settle(): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

function requestsOf(stubs: readonly StubWorker[]): FindRequest[] {
    return stubs.flatMap((stub) => stub.requests).filter((request) => request.type === 'findWinnable');
}

function lastRequest(stubs: readonly StubWorker[]): FindRequest {
    const request = requestsOf(stubs).at(-1);
    if (request === undefined) {
        throw new Error('no fill was requested');
    }
    return request;
}

/** Answers the latest request posted to `stub` with a proven deal. */
async function replyWin(
    stub: StubWorker,
    seed: number,
    grade: Grade,
    { attempts = 3, spares = [] }: { readonly attempts?: number; readonly spares?: readonly Spare[] } = {},
): Promise<void> {
    stub.reply({
        id: stub.idOf(stub.requests.length - 1),
        type: 'findWinnable',
        seed,
        verdict: 'win',
        attempts,
        grade,
        spares,
    });
    await settle();
}

async function replyRandom(stub: StubWorker, seed: number): Promise<void> {
    stub.reply({
        id: stub.idOf(stub.requests.length - 1),
        type: 'findWinnable',
        seed,
        verdict: 'random',
        attempts: MAX_ATTEMPTS,
        grade: undefined,
        spares: [],
    });
    await settle();
}

const spare = (seed: number, grade: Grade): Spare => ({ seed, grade });

describe('deal pool filling', () => {
    it('starts no worker until a choice it can fill is set', () => {
        const { pool, stubs } = setup();
        pool.resume();
        pool.setBusy(false);

        expect(stubs).toHaveLength(0);
        expect(pool.take('draw1', 'any')).toBeUndefined();
        expect(stubs).toHaveLength(0);
    });

    it('fills only the current mode, with fresh seeds, the mode budget and the emptiest grade', () => {
        const { pool, stubs } = setup();
        pool.setChoice({ mode: 'vegas', winnableOnly: true });

        expect(requestsOf(stubs)).toEqual([
            {
                id: expect.any(Number) as number,
                type: 'findWinnable',
                seeds: Array.from({ length: MAX_ATTEMPTS }, (_, index) => index + 1),
                budget: winnableBudget('vegas'),
                mode: 'vegas',
                selection: { target: 'easy', gradeLimit: GRADE_LIMIT },
            },
        ]);
    });

    it('pools the selected deal and its spares, then asks for the grade that holds fewest deals', async () => {
        const { pool, stubs } = setup();
        pool.setChoice({ mode: 'draw1', winnableOnly: true });

        await replyWin(stubAt(stubs, 0), 100, 'easy', { attempts: 7, spares: [spare(101, 'medium')] });

        // easy 1, medium 1, hard 0: hard is emptiest.
        expect(lastRequest(stubs).selection).toEqual({ target: 'hard', gradeLimit: GRADE_LIMIT });
        await replyWin(stubAt(stubs, 0), 102, 'hard');
        // One of each: ties go easy first, and each fill draws new seeds.
        expect(lastRequest(stubs).selection?.target).toBe('easy');
        expect(lastRequest(stubs).seeds[0]).toBe(2 * MAX_ATTEMPTS + 1);

        expect(pool.take('draw1', 'easy')).toEqual({ seed: 100, grade: 'easy', attempts: 7 });
        expect(pool.take('draw1', 'medium')).toEqual({ seed: 101, grade: 'medium', attempts: 1 });
        expect(pool.take('draw1', 'hard')).toEqual({ seed: 102, grade: 'hard', attempts: 3 });
    });

    it('stops once every grade of the current mode holds its cap', async () => {
        const { pool, stubs } = setup();
        pool.deposit('draw1', [spare(1, 'easy'), spare(2, 'easy'), spare(3, 'medium'), spare(4, 'medium')]);
        pool.deposit('draw1', [spare(5, 'hard')]);
        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        expect(lastRequest(stubs).selection?.target).toBe('hard');

        await replyWin(stubAt(stubs, 0), 6, 'hard');

        expect(requestsOf(stubs)).toHaveLength(1);
    });

    it('moves the next fill to a newly chosen mode and pools a fill in flight under its own mode', async () => {
        const { pool, stubs } = setup();
        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        pool.setChoice({ mode: 'vegas', winnableOnly: true });
        // The Draw 1 fill in flight is not cancelled by the change.
        expect(requestsOf(stubs)).toHaveLength(1);
        expect(stubAt(stubs, 0).terminated).toBe(false);

        await replyWin(stubAt(stubs, 0), 100, 'easy');

        expect(lastRequest(stubs)).toMatchObject({ mode: 'vegas', budget: winnableBudget('vegas') });
        expect(pool.take('vegas', 'easy')).toBeUndefined();
        expect(pool.take('draw1', 'easy')).toEqual({ seed: 100, grade: 'easy', attempts: 3 });
    });

    it('never pools a random result, and a fill that pools nothing starts no other', async () => {
        const { pool, stubs } = setup();
        pool.setChoice({ mode: 'draw3', winnableOnly: true });

        await replyRandom(stubAt(stubs, 0), 40);

        expect(pool.take('draw3', 'any')).toBeUndefined();
        // The take above is a trigger: one new fill, no more.
        expect(requestsOf(stubs)).toHaveLength(2);
    });

    it('ends the loop when a proven deal and its spares all fall in full buckets', async () => {
        const { pool, stubs } = setup();
        pool.deposit('draw1', [spare(1, 'easy'), spare(2, 'easy')]);
        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        expect(lastRequest(stubs).selection?.target).toBe('medium');

        await replyWin(stubAt(stubs, 0), 3, 'easy', { spares: [spare(4, 'easy')] });

        expect(requestsOf(stubs)).toHaveLength(1);
        expect(pool.take('draw1', 'medium')).toBeUndefined();
    });

    it('refills a grade after a pooled deal is used', async () => {
        const { pool, stubs } = setup();
        pool.deposit('draw1', [spare(1, 'easy'), spare(2, 'easy'), spare(3, 'medium'), spare(4, 'medium')]);
        pool.deposit('draw1', [spare(5, 'hard'), spare(6, 'hard')]);
        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        expect(stubs).toHaveLength(0);

        expect(pool.take('draw1', 'medium')).toEqual({ seed: 3, grade: 'medium', attempts: 1 });

        expect(lastRequest(stubs)).toMatchObject({ mode: 'draw1', selection: { target: 'medium' } });
        await replyWin(stubAt(stubs, 0), 7, 'medium');
        expect(requestsOf(stubs)).toHaveLength(1);
        expect(pool.take('draw1', 'medium')).toEqual({ seed: 4, grade: 'medium', attempts: 1 });
        expect(pool.take('draw1', 'medium')).toEqual({ seed: 7, grade: 'medium', attempts: 3 });
    });

    it('fills nothing for Daily or with the switch off, and keeps the deals already pooled', async () => {
        const { pool, stubs } = setup();
        pool.setChoice({ mode: 'daily', winnableOnly: true });
        pool.setChoice({ mode: 'draw1', winnableOnly: false });
        pool.setChoice(undefined);
        expect(stubs).toHaveLength(0);

        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        await replyWin(stubAt(stubs, 0), 100, 'easy');
        expect(requestsOf(stubs)).toHaveLength(2);
        pool.setChoice({ mode: 'draw1', winnableOnly: false });
        await replyWin(stubAt(stubs, 0), 101, 'medium');

        expect(requestsOf(stubs)).toHaveLength(2);
        expect(pool.take('draw1', 'easy')).toEqual({ seed: 100, grade: 'easy', attempts: 3 });
        expect(pool.take('draw1', 'medium')).toEqual({ seed: 101, grade: 'medium', attempts: 3 });
        expect(requestsOf(stubs)).toHaveLength(2);
    });
});

describe('deal pool buckets', () => {
    it('never holds more than its cap per grade and drops the spares that do not fit', () => {
        const { pool } = setup();
        pool.deposit('draw1', [spare(1, 'easy'), spare(2, 'easy'), spare(3, 'easy'), spare(4, 'hard')]);

        expect(POOL_PER_GRADE).toBe(2);
        expect(pool.take('draw1', 'easy')).toEqual({ seed: 1, grade: 'easy', attempts: 1 });
        expect(pool.take('draw1', 'easy')).toEqual({ seed: 2, grade: 'easy', attempts: 1 });
        expect(pool.take('draw1', 'easy')).toBeUndefined();
        expect(pool.take('draw1', 'hard')).toEqual({ seed: 4, grade: 'hard', attempts: 1 });
    });

    it('serves the oldest first, each deal once, and any grade oldest first for any', () => {
        const { pool } = setup();
        pool.deposit('draw3', [spare(1, 'medium'), spare(2, 'easy')]);
        pool.deposit('draw3', [spare(3, 'medium'), spare(4, 'hard')]);

        expect(pool.take('draw3', 'any')).toEqual({ seed: 1, grade: 'medium', attempts: 1 });
        expect(pool.take('draw3', 'any')).toEqual({ seed: 2, grade: 'easy', attempts: 1 });
        expect(pool.take('draw3', 'medium')).toEqual({ seed: 3, grade: 'medium', attempts: 1 });
        expect(pool.take('draw3', 'medium')).toBeUndefined();
        expect(pool.take('draw3', 'any')).toEqual({ seed: 4, grade: 'hard', attempts: 1 });
        expect(pool.take('draw3', 'any')).toBeUndefined();
    });

    it('never serves another grade, or another mode, for a request', () => {
        const { pool } = setup();
        pool.deposit('draw1', [spare(1, 'easy')]);
        pool.deposit('vegas', [spare(2, 'hard')]);

        expect(pool.take('draw1', 'hard')).toBeUndefined();
        expect(pool.take('draw1', 'medium')).toBeUndefined();
        expect(pool.take('draw3', 'any')).toBeUndefined();
        expect(pool.take('vegas', 'easy')).toBeUndefined();
        expect(pool.take('draw1', 'easy')).toEqual({ seed: 1, grade: 'easy', attempts: 1 });
    });
});

describe('deal pool control', () => {
    it('pause stops new fills but keeps the fill in flight, and resume restarts filling', async () => {
        const { pool, stubs } = setup();
        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        pool.pause();
        expect(stubAt(stubs, 0).terminated).toBe(false);

        await replyWin(stubAt(stubs, 0), 100, 'easy');
        expect(requestsOf(stubs)).toHaveLength(1);
        expect(pool.take('draw1', 'easy')).toEqual({ seed: 100, grade: 'easy', attempts: 3 });
        pool.setChoice({ mode: 'draw3', winnableOnly: true });
        expect(requestsOf(stubs)).toHaveLength(1);

        pool.resume();
        expect(requestsOf(stubs)).toHaveLength(2);
        expect(lastRequest(stubs).mode).toBe('draw3');
    });

    it('a pending player deal stops new fills without cancelling the one in flight', async () => {
        const { pool, stubs } = setup();
        pool.setBusy(true);
        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        expect(stubs).toHaveLength(0);

        pool.setBusy(false);
        expect(requestsOf(stubs)).toHaveLength(1);
        pool.setBusy(true);
        expect(stubAt(stubs, 0).terminated).toBe(false);
        await replyWin(stubAt(stubs, 0), 100, 'easy');
        expect(requestsOf(stubs)).toHaveLength(1);
        expect(pool.take('draw1', 'any')).toEqual({ seed: 100, grade: 'easy', attempts: 3 });
        expect(requestsOf(stubs)).toHaveLength(1);

        pool.setBusy(false);
        expect(requestsOf(stubs)).toHaveLength(2);
    });

    it('a failed fill empties nothing already pooled, and the next fill starts a new worker', async () => {
        const { pool, stubs } = setup();
        pool.setChoice({ mode: 'draw1', winnableOnly: true });
        await replyWin(stubAt(stubs, 0), 100, 'easy');
        expect(requestsOf(stubs)).toHaveLength(2);

        stubAt(stubs, 0).emit('error');
        await settle();

        expect(stubAt(stubs, 0).terminated).toBe(true);
        expect(stubs).toHaveLength(1);
        expect(pool.take('draw1', 'easy')).toEqual({ seed: 100, grade: 'easy', attempts: 3 });
        expect(stubs).toHaveLength(2);
        expect(stubAt(stubs, 1).requests).toHaveLength(1);
    });

    it('dispose ends the fill in flight and ignores every later call', async () => {
        const { pool, stubs } = setup();
        pool.deposit('draw1', [spare(1, 'easy')]);
        pool.setChoice({ mode: 'draw1', winnableOnly: true });

        pool.dispose();

        expect(stubAt(stubs, 0).terminated).toBe(true);
        await settle();
        pool.deposit('draw1', [spare(2, 'medium')]);
        pool.setChoice({ mode: 'draw3', winnableOnly: true });
        pool.resume();
        pool.setBusy(false);
        expect(pool.take('draw1', 'any')).toBeUndefined();
        expect(stubs).toHaveLength(1);
        expect(requestsOf(stubs)).toHaveLength(1);
        pool.dispose();
    });
});
