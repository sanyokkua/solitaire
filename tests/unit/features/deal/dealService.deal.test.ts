// @vitest-environment node
import '@vitest/web-worker';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { decodeDealCode, encodeDealCode } from '../../../../src/domain/dealCode';
import { cryptoSeed } from '../../../../src/domain/prng';
import type { Mode } from '../../../../src/domain/types';
import { dailySeed } from '../../../../src/features/deal/daily';
import {
    createDealService,
    MAX_ATTEMPTS,
    WINNABLE_BUDGET,
    type DealProgress,
    type DealService,
} from '../../../../src/features/deal/dealService';
import type { WorkerLike } from '../../../../src/features/deal/solverClient';
import { findWinnable } from '../../../../src/solver/winnable';
import { DAILY_GOLDEN } from '../../../fixtures/dailyGolden';
import { corpusSeeds } from '../../../fixtures/solverCorpus';
import { mulberry32SeedSource, realFactory, scriptedSeedSource, stubAt, stubFactory } from '../../../fixtures/workers';

/** Chosen so the first 40 seeds need 2 attempts and the next 40 need 4: selection is not trivially the first seed. */
const FIXED = 1;
const HUGE_DELAY_MS = 60_000;
const OVERLAY_DELAY_MS = 160;

const [WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');
const [UNKNOWN_SEED = 0] = corpusSeeds('unknown');

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
        const expected = findWinnable(seeds, WINNABLE_BUDGET);
        expect(expected.attempts).toBeGreaterThan(1);
        const service = track(
            createDealService({
                createWorker: realFactory().create,
                seedSource: mulberry32SeedSource(FIXED),
                overlayDelayMs: HUGE_DELAY_MS,
            }),
        );

        const outcome = await service.deal({ mode: 'draw1', winnableOnly: true });

        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(expected.seed, 'draw1', { verdict: 'win', attempts: expected.attempts }),
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

        const outcome = await service.deal({ mode: 'draw1', winnableOnly: true });

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

        const deal = service.deal({ mode: 'draw1', winnableOnly: true });
        const stub = stubAt(factory.stubs, 0);
        stub.reply({
            id: stub.idOf(0),
            type: 'findWinnable',
            seed: lastSeed,
            verdict: 'random',
            attempts: MAX_ATTEMPTS,
        });

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(lastSeed, 'draw1', { verdict: 'random', attempts: MAX_ATTEMPTS }),
        });
    });

    it.each<{ readonly label: string; readonly mode: Mode; readonly winnableOnly: boolean }>([
        { label: 'Draw 3 with the switch on', mode: 'draw3', winnableOnly: true },
        { label: 'Vegas with the switch on', mode: 'vegas', winnableOnly: true },
        { label: 'Draw 1 with the switch off', mode: 'draw1', winnableOnly: false },
    ])('deals $label once, random, on the input thread without starting a worker', async ({ mode, winnableOnly }) => {
        const createWorker = vi.fn<() => WorkerLike>(realFactory().create);
        const service = track(createDealService({ createWorker, seedSource: mulberry32SeedSource(FIXED) }));
        const onProgress = vi.fn();
        const [firstSeed = 0] = drawnSeeds(FIXED, 1);

        const outcome = await service.deal({ mode, winnableOnly }, onProgress);

        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(firstSeed, mode, { verdict: 'random', attempts: 1 }),
        });
        expect(outcome).not.toHaveProperty('dayKey');
        expect(createWorker).not.toHaveBeenCalled();
        expect(onProgress).not.toHaveBeenCalled();
    });

    it.each([
        { winnableOnly: false, day: '2026-09-24' },
        { winnableOnly: true, day: '2026-09-24' },
        { winnableOnly: false, day: '2026-03-31' },
    ])(
        'deals the Daily v1 selection for $day whatever the switch says (winnableOnly: $winnableOnly)',
        async ({ winnableOnly, day }) => {
            const golden = dailyGoldenFor(day);
            const service = track(
                createDealService({
                    createWorker: realFactory().create,
                    now: () => noonUtc(day),
                    seedSource: mulberry32SeedSource(FIXED),
                    overlayDelayMs: HUGE_DELAY_MS,
                }),
            );

            const outcome = await service.deal({ mode: 'daily', winnableOnly });

            expect(outcome).toEqual({
                status: 'dealt',
                state: dealFromSeed(golden.seed, 'daily', { verdict: 'win', attempts: golden.attempts }),
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

        const outcome = await service.deal({ mode: 'daily', winnableOnly: false });

        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(golden.seed, 'daily', { verdict: 'win', attempts: golden.attempts }),
            dayKey: '2027-01-01',
        });
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

        const outcome = await service.deal({ mode: 'draw1', winnableOnly: true }, (progress) => {
            reports.push(progress);
        });

        expect(reports).toEqual([
            { overlay: false, attempt: 1 },
            { overlay: false, attempt: 2 },
            { overlay: false, attempt: 3 },
        ]);
        expect(outcome).toEqual({
            status: 'dealt',
            state: dealFromSeed(WIN_SEED, 'draw1', { verdict: 'win', attempts: 3 }),
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

        void service.deal({ mode: 'draw1', winnableOnly: true }, onProgress);
        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS - 1);
        expect(onProgress).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(onProgress).toHaveBeenCalledExactlyOnceWith({ overlay: true, attempt: 1 });
    });

    it('reports the attempt the worker names, before and after the overlay shows', async () => {
        const { factory, service } = stubbedService();
        const onProgress = vi.fn();
        void service.deal({ mode: 'draw1', winnableOnly: true }, onProgress);
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
        const deal = service.deal({ mode: 'draw1', winnableOnly: true }, onProgress);
        const stub = stubAt(factory.stubs, 0);

        await vi.advanceTimersByTimeAsync(100);
        stub.reply({ id: stub.idOf(0), type: 'findWinnable', seed: seeds[0] ?? 0, verdict: 'win', attempts: 1 });

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(seeds[0] ?? 0, 'draw1', { verdict: 'win', attempts: 1 }),
        });
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS * 2);
        stub.reply({ id: stub.idOf(0), type: 'progress', attempt: 2 });
        expect(onProgress).not.toHaveBeenCalled();
    });

    it('reports nothing after dispose, and leaves no timer running', async () => {
        const { service } = stubbedService();
        const onProgress = vi.fn();
        const deal = service.deal({ mode: 'draw1', winnableOnly: true }, onProgress);

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

        const first = service.deal({ mode: 'draw1', winnableOnly: true }, firstProgress);
        await vi.advanceTimersByTimeAsync(100);
        const second = service.deal({ mode: 'draw1', winnableOnly: true }, secondProgress);
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

        const first = service.deal({ mode: 'draw1', winnableOnly: true }, onProgress);
        await vi.advanceTimersByTimeAsync(100);
        await service.deal({ mode: 'draw3', winnableOnly: true });

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
            second ??= service.deal({ mode: 'draw1', winnableOnly: true });
        });

        const first = service.deal({ mode: 'draw1', winnableOnly: true }, onFirstProgress);

        expect(await first).toEqual({ status: 'cancelled' });
        const expected = findWinnable(seedsAfter(FIXED, MAX_ATTEMPTS, MAX_ATTEMPTS), WINNABLE_BUDGET);
        expect(await second).toEqual({
            status: 'dealt',
            state: dealFromSeed(expected.seed, 'draw1', { verdict: expected.verdict, attempts: expected.attempts }),
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
            second ??= service.deal({ mode: 'draw3', winnableOnly: true });
        });

        const first = service.deal({ mode: 'draw1', winnableOnly: true }, onFirstProgress);

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

        const deal = service.deal({ mode: 'draw1', winnableOnly: true });
        stubAt(factory.stubs, 0).emit('error');

        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(firstSeed, 'draw1', { verdict: 'random', attempts: 1 }),
        });
    });

    it('deals the first Daily candidate, random, when the worker errors', async () => {
        const factory = stubFactory();
        const day = '2026-09-24';
        const service = track(createDealService({ createWorker: factory.create, now: () => noonUtc(day) }));

        const deal = service.deal({ mode: 'daily', winnableOnly: false });
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

        const draw1 = await service.deal({ mode: 'draw1', winnableOnly: true });
        const daily = await service.deal({ mode: 'daily', winnableOnly: true });

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

        const failed = service.deal({ mode: 'draw1', winnableOnly: true });
        stubAt(factory.stubs, 0).emit('error');
        await failed;
        expect(vi.getTimerCount()).toBe(0);

        void service.deal({ mode: 'draw1', winnableOnly: true });

        expect(factory.stubs).toHaveLength(2);
    });
});
