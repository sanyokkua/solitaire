// @vitest-environment node
// covers: KS-DEAL-02, KS-DEAL-03, KS-DEAL-04, KS-DEAL-05, KS-DEAL-06, KS-DEAL-07, KS-DEAL-10, KS-DEAL-11
import '@vitest/web-worker';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRADES, dealFromSeed } from '../../../../src/domain/deal';
import { decodeDealCode, encodeDealCode } from '../../../../src/domain/dealCode';
import { cryptoSeed } from '../../../../src/domain/prng';
import type { Grade, Mode } from '../../../../src/domain/types';
import { dailySeed } from '../../../../src/features/deal/daily';
import {
    DRAW3_WINNABLE_BUDGET,
    GRADE_LIMIT,
    MAX_ATTEMPTS,
    VEGAS_WINNABLE_BUDGET,
    WINNABLE_BUDGET,
} from '../../../../src/features/deal/budgets';
import { createDealService, type DealProgress, type DealService } from '../../../../src/features/deal/dealService';
import type { WorkerLike } from '../../../../src/features/deal/solverClient';
import type { SolverResponse } from '../../../../src/solver/protocol';
import { findWinnable } from '../../../../src/solver/winnable';
import { DAILY_GOLDEN } from '../../../fixtures/dailyGolden';
import { corpusSeeds } from '../../../fixtures/solverCorpus';
import {
    mulberry32SeedSource,
    realFactory,
    recordingFactory,
    scriptedSeedSource,
    stubAt,
    stubFactory,
} from '../../../fixtures/workers';

/** Chosen so the first batch of seeds needs 2 attempts and the next batch 4: selection is not trivially the first seed. */
const FIXED = 1;
/** A source of fresh seeds whose candidates hold no Easy deal within the grade limit (found by trying sources 1 to 12; most find every grade). */
const NO_EASY_FIXED = 4;
const HUGE_DELAY_MS = 60_000;
const OVERLAY_DELAY_MS = 160;

const [WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');
const [UNKNOWN_SEED = 0] = corpusSeeds('unknown');
/** A seed whose Draw 3 and Vegas deals both prove winnable within their budgets (found by scanning seeds from 1). */
const QUICK_WIN_SEED = 3;

const services: DealService[] = [];

/** Tracks `service` so `afterEach` disposes it, whatever the test did. */
function track(service: DealService): DealService {
    services.push(service);
    return service;
}

afterEach(() => {
    vi.useRealTimers();
    for (const service of services.splice(0)) {
        service.dispose();
    }
});

/** The first `count` seeds `mulberry32SeedSource(fixed)` hands out: what the service draws, reproduced by the test. */
function drawnSeeds(fixed: number, count: number): number[] {
    const source = mulberry32SeedSource(fixed);
    return Array.from({ length: count }, () => cryptoSeed(source));
}

/** The next unclaimed seeds, ignoring the first `skip`. */
function seedsAfter(fixed: number, skip: number, count: number): number[] {
    return drawnSeeds(fixed, skip + count).slice(skip);
}

function dailyGoldenFor(day: string): (typeof DAILY_GOLDEN)[number] {
    const entry = DAILY_GOLDEN.find((golden) => golden.day === day);
    if (entry === undefined) {
        throw new Error(`no golden entry for ${day}`);
    }
    return entry;
}

/** A noon-UTC instant on `day` (`YYYY-MM-DD`). */
function noonUtc(day: string): Date {
    return new Date(`${day}T12:00:00Z`);
}

describe('deal service: provenance per mode', () => {
    it('deals a winnable Draw 1 game from the seed the selection picked, with its verdict and attempts', async () => {
        const seeds = drawnSeeds(FIXED, MAX_ATTEMPTS);
        const expected = findWinnable(seeds, WINNABLE_BUDGET, 'draw1');
        expect(expected.attempts).toBeGreaterThan(1);
        expect(expected.grade).toBeDefined();
        const service = track(
            createDealService({
                createWorker: realFactory().create,
                seedSource: mulberry32SeedSource(FIXED),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );

        const outcome = await service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });

        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(expected.seed, 'draw1', {
                verdict: 'win',
                attempts: expected.attempts,
                grade: expected.grade ?? null,
            }),
        });
        expect(outcome).not.toHaveProperty('dayKey');
    });

    it('deals a state whose deal code reproduces the same layout without the solver', async () => {
        const service = track(
            createDealService({
                createWorker: realFactory().create,
                seedSource: mulberry32SeedSource(FIXED),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );

        const outcome = await service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });

        if (outcome.status !== 'dealt') {
            throw new Error('the deal was not delivered');
        }
        const decoded = decodeDealCode(encodeDealCode(outcome.state.seed, 'draw1'));
        if (decoded === null) {
            throw new Error('the deal code did not decode');
        }
        const replayed = dealFromSeed(decoded.seed, decoded.mode);
        expect(decoded).toEqual({ mode: 'draw1', seed: outcome.state.seed });
        expect(replayed.tableau).toEqual(outcome.state.tableau);
        expect(replayed.stock).toEqual(outcome.state.stock);
    });

    it('passes a worker result through with its own verdict and attempts, even a random one', async () => {
        const factory = stubFactory();
        const service = track(
            createDealService({ createWorker: factory.create, seedSource: mulberry32SeedSource(FIXED) }),
        );
        const seeds = drawnSeeds(FIXED, MAX_ATTEMPTS);
        const lastSeed = seeds[MAX_ATTEMPTS - 1] ?? 0;

        const deal = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });
        const stub = stubAt(factory.stubs, 0);
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: lastSeed,
            verdict: 'random',
            attempts: MAX_ATTEMPTS,
            grade: undefined,
            spares: [],
        });

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(lastSeed, 'draw1', { verdict: 'random', attempts: MAX_ATTEMPTS }),
        });
    });

    it('records the grade the worker reports, with the spares left to the caller', async () => {
        const factory = stubFactory();
        const service = track(
            createDealService({ createWorker: factory.create, seedSource: mulberry32SeedSource(FIXED) }),
        );
        const [seed = 0, spare = 0] = drawnSeeds(FIXED, 2);

        const deal = service.deal({ mode: 'draw1', winnableOnly: true, target: 'medium' });
        const stub = stubAt(factory.stubs, 0);
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed,
            verdict: 'win',
            attempts: 2,
            grade: 'hard',
            spares: [{ seed: spare, grade: 'easy' }],
        });

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(seed, 'draw1', { verdict: 'win', attempts: 2, grade: 'hard' }),
        });
    });

    it.each<{ readonly label: string; readonly mode: Mode }>([
        { label: 'Draw 1', mode: 'draw1' },
        { label: 'Draw 3', mode: 'draw3' },
        { label: 'Vegas', mode: 'vegas' },
    ])(
        'deals $label with the switch off once, random and ungraded, on the input thread without starting a worker',
        async ({ mode }) => {
            const createWorker = vi.fn<() => WorkerLike>(realFactory().create);
            const service = track(createDealService({ createWorker, seedSource: mulberry32SeedSource(FIXED) }));
            const onProgress = vi.fn();
            const [firstSeed = 0] = drawnSeeds(FIXED, 1);

            // The requested grade is ignored: nothing is searched, so nothing is graded.
            const outcome = await service.deal({ mode, winnableOnly: false, target: 'hard' }, onProgress);

            expect(outcome).toEqual({
                status: 'dealt',
                state: dealFromSeed(firstSeed, mode, { verdict: 'random', attempts: 1 }),
            });
            if (outcome.status === 'dealt') {
                expect(outcome.state.grade).toBeNull();
            }
            expect(outcome).not.toHaveProperty('dayKey');
            expect(createWorker).not.toHaveBeenCalled();
            expect(onProgress).not.toHaveBeenCalled();
        },
    );

    it.each<{ readonly label: string; readonly mode: 'draw3' | 'vegas'; readonly budget: number }>([
        { label: 'Draw 3', mode: 'draw3', budget: DRAW3_WINNABLE_BUDGET },
        { label: 'Vegas', mode: 'vegas', budget: VEGAS_WINNABLE_BUDGET },
    ])(
        'searches $label with the switch on on the worker: `MAX_ATTEMPTS` fresh seeds, the mode budget and the requested grade',
        ({ mode, budget }) => {
            const factory = stubFactory();
            const service = track(
                createDealService({ createWorker: factory.create, seedSource: mulberry32SeedSource(FIXED) }),
            );

            void service.deal({ mode, winnableOnly: true, target: 'easy' });

            const request = stubAt(factory.stubs, 0).requests[0];
            expect(request).toMatchObject({
                type: 'findWinnable',
                seeds: drawnSeeds(FIXED, MAX_ATTEMPTS),
                budget,
                mode,
                selection: { target: 'easy', gradeLimit: GRADE_LIMIT },
            });
        },
    );

    it.each<{ readonly label: string; readonly mode: 'draw3' | 'vegas'; readonly budget: number }>([
        { label: 'Draw 3', mode: 'draw3', budget: DRAW3_WINNABLE_BUDGET },
        { label: 'Vegas', mode: 'vegas', budget: VEGAS_WINNABLE_BUDGET },
    ])(
        'deals the winnable $label game the real search selected, with its verdict, attempts and grade',
        async ({ mode, budget }) => {
            // Every candidate is the same seed, one the mode's search proves at once, so the real search stays quick.
            const selection = { target: 'any', gradeLimit: GRADE_LIMIT } as const;
            const expected = findWinnable([QUICK_WIN_SEED], budget, mode, { selection });
            const service = track(
                createDealService({
                    createWorker: realFactory().create,
                    seedSource: scriptedSeedSource(Array.from({ length: MAX_ATTEMPTS }, () => QUICK_WIN_SEED)),
                    overlayDelayMs: HUGE_DELAY_MS,
                }),
            );

            const outcome = await service.deal({ mode, winnableOnly: true, target: 'any' });

            expect(expected).toMatchObject({ seed: QUICK_WIN_SEED, verdict: 'win', attempts: 1 });
            expect(expected.grade).toBeDefined();
            expect(outcome).toEqual({
                status: 'dealt',
                state: dealFromSeed(QUICK_WIN_SEED, mode, {
                    verdict: 'win',
                    attempts: 1,
                    grade: expected.grade ?? null,
                }),
            });
        },
    );

    it('deals the closest grade, labelled with its own, when the requested grade is not found', async () => {
        const seeds = drawnSeeds(NO_EASY_FIXED, MAX_ATTEMPTS);
        const selectionFor = (target: Grade) => ({ target, gradeLimit: GRADE_LIMIT });
        const missed = GRADES.find(
            (target) =>
                findWinnable(seeds, WINNABLE_BUDGET, 'draw1', { selection: selectionFor(target) }).grade !== target,
        );
        if (missed === undefined) {
            throw new Error('every grade is found in the NO_EASY_FIXED seeds; pick a source where one is missing');
        }
        const expected = findWinnable(seeds, WINNABLE_BUDGET, 'draw1', { selection: selectionFor(missed) });
        const service = track(
            createDealService({
                createWorker: realFactory().create,
                seedSource: mulberry32SeedSource(NO_EASY_FIXED),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );

        const outcome = await service.deal({ mode: 'draw1', winnableOnly: true, target: missed });

        expect(expected.verdict).toBe('win');
        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(expected.seed, 'draw1', {
                verdict: 'win',
                attempts: expected.attempts,
                grade: expected.grade ?? null,
            }),
        });
        if (outcome.status === 'dealt') {
            expect(outcome.state.grade).not.toBe(missed);
            expect(outcome.state.grade).toBe(expected.grade);
        }
    });

    it.each([
        { winnableOnly: false, target: 'any', day: '2026-09-24' },
        { winnableOnly: true, target: 'any', day: '2026-09-24' },
        { winnableOnly: false, target: 'any', day: '2026-03-31' },
        { winnableOnly: true, target: 'easy', day: '2026-09-24' },
    ] as const)(
        'deals the Daily v1 selection for $day whatever the switch or the Difficulty says (winnableOnly: $winnableOnly, target: $target)',
        async ({ winnableOnly, target, day }) => {
            const golden = dailyGoldenFor(day);
            const service = track(
                createDealService({
                    createWorker: realFactory().create,
                    now: () => noonUtc(day),
                    seedSource: mulberry32SeedSource(FIXED),
                    overlayDelayMs: HUGE_DELAY_MS,
                }),
            );

            const outcome = await service.deal({ mode: 'daily', winnableOnly, target });

            expect(outcome).toEqual({
                status: 'dealt',
                state: dealFromSeed(golden.seed, 'daily', {
                    verdict: 'win',
                    attempts: golden.attempts,
                    grade: golden.grade,
                }),
                dayKey: day,
            });
        },
    );

    it('takes the Daily day from the UTC date of `now`', async () => {
        const service = track(
            createDealService({
                createWorker: realFactory().create,
                now: () => new Date('2027-01-01T00:00:00.000Z'),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );
        const golden = dailyGoldenFor('2027-01-01');

        const outcome = await service.deal({ mode: 'daily', winnableOnly: false, target: 'any' });

        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(golden.seed, 'daily', {
                verdict: 'win',
                attempts: golden.attempts,
                grade: golden.grade,
            }),
            dayKey: '2027-01-01',
        });
    });
});

describe('deal service: the verdict cache', () => {
    it('answers a second Daily request in a session from the cache, searching none of its candidates again', async () => {
        const day = '2026-09-24';
        const golden = dailyGoldenFor(day);
        const factory = recordingFactory();
        const service = track(
            createDealService({ createWorker: factory.create, now: () => noonUtc(day), overlayDelayMs: HUGE_DELAY_MS }),
        );
        const request = { mode: 'daily', winnableOnly: true, target: 'any' } as const;
        const expected = {
            status: 'dealt',
            state: dealFromSeed(golden.seed, 'daily', {
                verdict: 'win',
                attempts: golden.attempts,
                grade: golden.grade,
            }),
            dayKey: day,
        };
        const outcomesIn = (replies: readonly SolverResponse[]) =>
            replies.flatMap((reply) => (reply.type === 'outcome' ? [reply.outcome] : []));

        expect(await service.deal(request)).toEqual(expected);
        const [log] = factory.logs;
        if (log === undefined) {
            throw new Error('no worker was started');
        }
        const searched = outcomesIn(log.replies);
        expect(searched).toHaveLength(golden.attempts);
        const repliesBefore = log.replies.length;

        expect(await service.deal(request)).toEqual(expected);
        expect(factory.logs).toHaveLength(1);
        expect(log.posted.at(-1)).toMatchObject({ type: 'findWinnable', known: searched });
        expect(outcomesIn(log.replies.slice(repliesBefore))).toEqual([]);
    });
});

describe('deal service: progress', () => {
    it('reports each attempt in order with the overlay still off for a fast deal', async () => {
        const seeds = [LOSS_SEED, UNKNOWN_SEED, WIN_SEED, ...Array.from({ length: MAX_ATTEMPTS - 3 }, () => WIN_SEED)];
        const service = track(
            createDealService({
                createWorker: realFactory().create,
                seedSource: scriptedSeedSource(seeds),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );
        const reports: DealProgress[] = [];

        const outcome = await service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, (progress) => {
            reports.push(progress);
        });

        expect(reports).toEqual([
            { overlay: false, attempt: 1 },
            { overlay: false, attempt: 2 },
            { overlay: false, attempt: 3 },
        ]);
        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(WIN_SEED, 'draw1', {
                verdict: 'win',
                attempts: 3,
                grade: findWinnable([WIN_SEED], WINNABLE_BUDGET, 'draw1').grade ?? null,
            }),
        });
    });
});

describe('deal service: overlay timing (silent stub, fake timers)', () => {
    /** A service on silent stubs with a fixed seed source and the default overlay delay. */
    function stubbedService() {
        vi.useFakeTimers();
        const factory = stubFactory();
        const service = track(
            createDealService({
                createWorker: factory.create,
                seedSource: mulberry32SeedSource(FIXED),
                overlayDelayMs: OVERLAY_DELAY_MS,
            }),
        );
        return { factory, service };
    }

    it('asks for the overlay only once the request has been pending for the overlay delay', async () => {
        const { service } = stubbedService();
        const onProgress = vi.fn();

        void service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, onProgress);
        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS - 1);
        expect(onProgress).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(onProgress).toHaveBeenCalledExactlyOnceWith({ overlay: true, attempt: 1 });
    });

    it('reports the attempt the worker names, before and after the overlay shows', async () => {
        const { factory, service } = stubbedService();
        const onProgress = vi.fn();
        void service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, onProgress);
        const stub = stubAt(factory.stubs, 0);

        await vi.advanceTimersByTimeAsync(50);
        stub.reply({ id: stub.idOf(0), type: 'progress', attempt: 2 });
        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS);
        stub.reply({ id: stub.idOf(0), type: 'progress', attempt: 3 });

        expect(onProgress.mock.calls).toEqual([
            [{ overlay: false, attempt: 2 }],
            [{ overlay: true, attempt: 2 }],
            [{ overlay: true, attempt: 3 }],
        ]);
    });

    it('never shows the overlay for a deal delivered sooner, and reports nothing after it settles', async () => {
        const { factory, service } = stubbedService();
        const onProgress = vi.fn();
        const seeds = drawnSeeds(FIXED, MAX_ATTEMPTS);
        const deal = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, onProgress);
        const stub = stubAt(factory.stubs, 0);

        await vi.advanceTimersByTimeAsync(100);
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: seeds[0] ?? 0,
            verdict: 'win',
            attempts: 1,
            grade: 'easy',
            spares: [],
        });

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(seeds[0] ?? 0, 'draw1', { verdict: 'win', attempts: 1, grade: 'easy' }),
        });
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS * 2);
        stub.reply({ id: stub.idOf(0), type: 'progress', attempt: 2 });
        expect(onProgress).not.toHaveBeenCalled();
    });

    it('reports nothing after dispose, and leaves no timer running', async () => {
        const { service } = stubbedService();
        const onProgress = vi.fn();
        const deal = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, onProgress);

        await vi.advanceTimersByTimeAsync(100);
        service.dispose();

        expect(await deal).toEqual({ status: 'cancelled' });
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS * 2);
        expect(onProgress).not.toHaveBeenCalled();
    });

    it('reports nothing for a deal a newer deal superseded, and times the newer one from its own start', async () => {
        const { factory, service } = stubbedService();
        const firstProgress = vi.fn();
        const secondProgress = vi.fn();

        const first = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, firstProgress);
        await vi.advanceTimersByTimeAsync(100);
        const second = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, secondProgress);
        expect(await first).toEqual({ status: 'cancelled' });

        await vi.advanceTimersByTimeAsync(100);
        expect(firstProgress).not.toHaveBeenCalled();
        expect(secondProgress).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS - 100);
        expect(firstProgress).not.toHaveBeenCalled();
        expect(secondProgress).toHaveBeenCalledExactlyOnceWith({ overlay: true, attempt: 1 });
        expect(factory.stubs).toHaveLength(2);
        service.dispose();
        expect(await second).toEqual({ status: 'cancelled' });
    });

    it('reports nothing for a verified deal cancelled by a deal dealt on the input thread', async () => {
        const { service } = stubbedService();
        const onProgress = vi.fn();

        const first = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, onProgress);
        await vi.advanceTimersByTimeAsync(100);
        await service.deal({ mode: 'draw3', winnableOnly: false, target: 'any' });

        expect(await first).toEqual({ status: 'cancelled' });
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS * 2);
        expect(onProgress).not.toHaveBeenCalled();
    });
});

describe('deal service: a newer request wins', () => {
    it('cancels the first of two deals and delivers only the second', async () => {
        const factory = realFactory();
        const service = track(
            createDealService({
                createWorker: factory.create,
                seedSource: mulberry32SeedSource(FIXED),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );
        let second: ReturnType<DealService['deal']> | undefined;
        const onFirstProgress = vi.fn(() => {
            // The in-process worker posts synchronously mid-search, so the first deal is certainly pending here. Starting
            // the second from here also lets the first worker finish loading, which the polyfill needs (see the client
            // test of the same name).
            second ??= service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });
        });

        const first = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, onFirstProgress);

        expect(await first).toEqual({ status: 'cancelled' });
        const expected = findWinnable(seedsAfter(FIXED, MAX_ATTEMPTS, MAX_ATTEMPTS), WINNABLE_BUDGET, 'draw1');
        expect(await second).toEqual({
            status: 'dealt',
            state: dealFromSeed(expected.seed, 'draw1', {
                verdict: expected.verdict,
                attempts: expected.attempts,
                grade: expected.grade ?? null,
            }),
        });
        expect(onFirstProgress).toHaveBeenCalledExactlyOnceWith({ overlay: false, attempt: 1 });
        expect(factory.workers).toHaveLength(2);
    });

    it('cancels a pending verified deal when a Draw 3 deal is dealt on the input thread', async () => {
        const factory = realFactory();
        const service = track(
            createDealService({
                createWorker: factory.create,
                seedSource: mulberry32SeedSource(FIXED),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );
        let second: ReturnType<DealService['deal']> | undefined;
        const onFirstProgress = vi.fn(() => {
            second ??= service.deal({ mode: 'draw3', winnableOnly: false, target: 'any' });
        });

        const first = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' }, onFirstProgress);

        expect(await first).toEqual({ status: 'cancelled' });
        const [drawThreeSeed = 0] = seedsAfter(FIXED, MAX_ATTEMPTS, 1);
        expect(await second).toEqual({
            status: 'dealt',
            state: dealFromSeed(drawThreeSeed, 'draw3', { verdict: 'random', attempts: 1 }),
        });
        expect(onFirstProgress).toHaveBeenCalledTimes(1);
        expect(factory.workers).toHaveLength(1);
    });
});

describe('deal service: fallback when the background thread fails', () => {
    it('deals a random Draw 1 game from the first fresh seed when the worker errors', async () => {
        const factory = stubFactory();
        const service = track(
            createDealService({ createWorker: factory.create, seedSource: mulberry32SeedSource(FIXED) }),
        );
        const [firstSeed = 0] = drawnSeeds(FIXED, 1);

        const deal = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });
        stubAt(factory.stubs, 0).emit('error');

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(firstSeed, 'draw1', { verdict: 'random', attempts: 1 }),
        });
    });

    it.each<Mode>(['draw1', 'draw3', 'vegas'])(
        'deals a random, ungraded %s game from the first fresh seed when the worker errors, whatever grade was asked',
        async (mode) => {
            const factory = stubFactory();
            const service = track(
                createDealService({ createWorker: factory.create, seedSource: mulberry32SeedSource(FIXED) }),
            );
            const [firstSeed = 0] = drawnSeeds(FIXED, 1);

            const deal = service.deal({ mode, winnableOnly: true, target: 'hard' });
            stubAt(factory.stubs, 0).emit('error');

            const outcome = await deal;
            expect(outcome).toEqual({
                status: 'dealt',
                state: dealFromSeed(firstSeed, mode, { verdict: 'random', attempts: 1 }),
            });
            if (outcome.status === 'dealt') {
                expect(outcome.state).toMatchObject({ verdict: 'random', attempts: 1, grade: null });
            }
        },
    );

    it('deals the first Daily candidate, random, when the worker errors', async () => {
        const factory = stubFactory();
        const day = '2026-09-24';
        const service = track(createDealService({ createWorker: factory.create, now: () => noonUtc(day) }));

        const deal = service.deal({ mode: 'daily', winnableOnly: false, target: 'any' });
        stubAt(factory.stubs, 0).emit('error');

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(dailySeed(day, 1), 'daily', { verdict: 'random', attempts: 1 }),
            dayKey: day,
        });
    });

    it('deals the same fallbacks when the worker cannot be started at all', async () => {
        const createWorker = vi.fn<() => WorkerLike>(() => {
            throw new Error('workers are unavailable');
        });
        const day = '2026-09-24';
        const service = track(
            createDealService({ createWorker, now: () => noonUtc(day), seedSource: mulberry32SeedSource(FIXED) }),
        );
        const [firstSeed = 0] = drawnSeeds(FIXED, 1);

        const draw1 = await service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });
        const daily = await service.deal({ mode: 'daily', winnableOnly: true, target: 'any' });

        expect(draw1).toEqual({
            status: 'dealt',
            state: dealFromSeed(firstSeed, 'draw1', { verdict: 'random', attempts: 1 }),
        });
        expect(daily).toEqual({
            status: 'dealt',
            state: dealFromSeed(dailySeed(day, 1), 'daily', { verdict: 'random', attempts: 1 }),
            dayKey: day,
        });
        expect(createWorker).toHaveBeenCalledTimes(2);
    });

    it('starts a new worker for the next request after a failure, and clears the overlay timer', async () => {
        vi.useFakeTimers();
        const factory = stubFactory();
        const service = track(
            createDealService({
                createWorker: factory.create,
                seedSource: mulberry32SeedSource(FIXED),
                overlayDelayMs: OVERLAY_DELAY_MS,
            }),
        );

        const failed = service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });
        stubAt(factory.stubs, 0).emit('error');
        await failed;
        expect(vi.getTimerCount()).toBe(0);

        void service.deal({ mode: 'draw1', winnableOnly: true, target: 'any' });

        expect(factory.stubs).toHaveLength(2);
    });
});
