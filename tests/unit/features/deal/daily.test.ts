import { afterEach, describe, expect, it } from 'vitest';
import { decodeDealCode, encodeDealCode } from '../../../../src/domain/dealCode';
import { DAILY_V1, dailySeed, dailySeeds, utcDayKey } from '../../../../src/features/deal/daily';
import { createDealService } from '../../../../src/features/deal/dealService';
import { findWinnable } from '../../../../src/solver/winnable';
import { DAILY_GOLDEN } from '../../../fixtures/dailyGolden';
import { stubAt, stubFactory } from '../../../fixtures/workers';

const originalTz = process.env.TZ;

afterEach(() => {
    if (originalTz === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTz;
    }
});

/**
 * What the real deal service does for a Daily request at `instant`: the day key, the local calendar day, the seeds the
 * service hands the worker, and the deal code of the game it delivers when the worker fails (the first candidate).
 */
async function dailyDealAt(instant: Date): Promise<{
    key: string;
    localDay: number;
    requestedSeeds: readonly number[];
    dealCode: string;
}> {
    const factory = stubFactory();
    const service = createDealService({ createWorker: factory.create, now: () => instant });
    try {
        const deal = service.deal({ mode: 'daily', winnableOnly: false });
        const stub = stubAt(factory.stubs, 0);
        stub.emit('error');
        const outcome = await deal;
        if (outcome.status !== 'dealt') {
            throw new Error('the Daily deal was not delivered');
        }
        const request = stub.requests[0];
        if (request?.type !== 'findWinnable') {
            throw new Error('the service did not post a findWinnable request');
        }
        return {
            key: utcDayKey(instant),
            localDay: instant.getDate(),
            requestedSeeds: request.seeds,
            dealCode: encodeDealCode(outcome.state.seed, 'daily'),
        };
    } finally {
        service.dispose();
    }
}

describe('utcDayKey', () => {
    it('reads the UTC calendar date at the day boundary', () => {
        expect(utcDayKey(new Date('2026-09-24T23:59:59.999Z'))).toBe('2026-09-24');
        expect(utcDayKey(new Date('2026-09-25T00:00:00.000Z'))).toBe('2026-09-25');
    });

    it('zero-pads the month and the day', () => {
        expect(utcDayKey(new Date('2027-01-05T12:00:00.000Z'))).toBe('2027-01-05');
    });

    it('gives one key and one Daily deal for one instant whatever the time zone', async () => {
        const instant = new Date('2026-09-24T12:00:00.000Z');
        // Node re-reads TZ whenever process.env.TZ is assigned.
        process.env.TZ = 'Pacific/Kiritimati';
        const kiritimati = await dailyDealAt(instant);
        process.env.TZ = 'Pacific/Pago_Pago';
        const pagoPago = await dailyDealAt(instant);

        expect(kiritimati.localDay).not.toBe(pagoPago.localDay);
        expect(kiritimati.key).toBe('2026-09-24');
        expect(pagoPago.key).toBe(kiritimati.key);
        expect(kiritimati.requestedSeeds).toEqual(dailySeeds('2026-09-24'));
        expect(pagoPago.requestedSeeds).toEqual(kiritimati.requestedSeeds);
        expect(kiritimati.dealCode).toBe(encodeDealCode(dailySeed('2026-09-24', 1), 'daily'));
        expect(pagoPago.dealCode).toBe(kiritimati.dealCode);
    });

    it('gives one key for two instants of a UTC day whose local dates differ', () => {
        process.env.TZ = 'Pacific/Kiritimati';
        const early = new Date('2026-09-24T00:00:00.000Z');
        const late = new Date('2026-09-24T23:59:59.999Z');

        expect(early.getDate()).not.toBe(late.getDate());
        expect(utcDayKey(early)).toBe('2026-09-24');
        expect(utcDayKey(late)).toBe('2026-09-24');
    });
});

describe('dailySeed and dailySeeds', () => {
    it('applies the daily v1 formula', () => {
        expect(dailySeed('2026-09-24', 1)).toBe((20260924 * 131 + 7919) >>> 0);
    });

    it('lists the attempts 1 to 40 as distinct seeds', () => {
        const seeds = dailySeeds('2026-09-24');

        expect(seeds).toHaveLength(DAILY_V1.maxAttempts);
        expect(seeds).toHaveLength(40);
        expect(new Set(seeds).size).toBe(40);
        expect(seeds[0]).toBe(dailySeed('2026-09-24', 1));
        expect(seeds[39]).toBe(dailySeed('2026-09-24', 40));
    });

    it('shares no seed between two consecutive days', () => {
        const days: readonly (readonly [string, string])[] = [
            ['2026-09-24', '2026-09-25'],
            ['2026-12-31', '2027-01-01'],
            ['2027-02-28', '2027-03-01'],
        ];
        for (const [first, second] of days) {
            const other = new Set(dailySeeds(second));
            expect(dailySeeds(first).filter((seed) => other.has(seed))).toEqual([]);
        }
    });
});

describe('Daily v1 golden dates', () => {
    it.each(DAILY_GOLDEN)(
        'picks the pinned seed for $day',
        ({ day, seed, attempts }) => {
            expect(findWinnable(dailySeeds(day), DAILY_V1.budget)).toEqual({ seed, verdict: 'win', attempts });
            expect(decodeDealCode(encodeDealCode(seed, 'daily'))).toEqual({ seed, mode: 'daily' });
        },
        30_000,
    );
});
