import { describe, expect, it } from 'vitest';
import { nextDayKey, previousDayKey, runContaining, runLengthEndingAt } from '../../../../src/features/stats/dayKeys';

describe('previousDayKey', () => {
    it('steps back within a month', () => {
        expect(previousDayKey('2026-05-15')).toBe('2026-05-14');
    });

    it('crosses month boundaries', () => {
        expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
        expect(previousDayKey('2026-05-01')).toBe('2026-04-30');
    });

    it('crosses year boundaries', () => {
        expect(previousDayKey('2027-01-01')).toBe('2026-12-31');
    });

    it('honours leap years', () => {
        expect(previousDayKey('2028-03-01')).toBe('2028-02-29');
        expect(previousDayKey('2028-02-29')).toBe('2028-02-28');
        expect(previousDayKey('2027-03-01')).toBe('2027-02-28');
    });
});

describe('incomplete day keys', () => {
    it('reads a missing month and day as 1 January', () => {
        expect(previousDayKey('2026')).toBe('2025-12-31');
        expect(nextDayKey('2026')).toBe('2026-01-02');
    });

    it('reads a missing day as the first of the month', () => {
        expect(previousDayKey('2026-05')).toBe('2026-04-30');
        expect(nextDayKey('2026-05')).toBe('2026-05-02');
    });
});

describe('nextDayKey', () => {
    it('steps forward within a month', () => {
        expect(nextDayKey('2026-05-15')).toBe('2026-05-16');
    });

    it('crosses month boundaries', () => {
        expect(nextDayKey('2026-04-30')).toBe('2026-05-01');
        expect(nextDayKey('2026-02-28')).toBe('2026-03-01');
    });

    it('crosses year boundaries', () => {
        expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
    });

    it('honours leap years', () => {
        expect(nextDayKey('2028-02-28')).toBe('2028-02-29');
        expect(nextDayKey('2028-02-29')).toBe('2028-03-01');
        expect(nextDayKey('2027-02-28')).toBe('2027-03-01');
    });

    it('is the inverse of previousDayKey', () => {
        expect(previousDayKey(nextDayKey('2028-02-29'))).toBe('2028-02-29');
    });
});

describe('runLengthEndingAt', () => {
    const list = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-10', '2026-05-11'];

    it('counts the consecutive days up to and including the index', () => {
        expect(runLengthEndingAt(list, 0)).toBe(1);
        expect(runLengthEndingAt(list, 2)).toBe(3);
        expect(runLengthEndingAt(list, 3)).toBe(1);
        expect(runLengthEndingAt(list, 4)).toBe(2);
    });

    it('stops counting at a gap, including a gap of one day across a month boundary', () => {
        expect(runLengthEndingAt(['2026-04-29', '2026-05-01'], 1)).toBe(1);
        expect(runLengthEndingAt(['2026-04-29', '2026-04-30', '2026-05-01'], 2)).toBe(3);
    });

    it('is 0 for an index outside the list', () => {
        expect(runLengthEndingAt(list, -1)).toBe(0);
        expect(runLengthEndingAt(list, 5)).toBe(0);
        expect(runLengthEndingAt([], 0)).toBe(0);
    });
});

describe('runContaining', () => {
    const list = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-10', '2026-05-11'];

    it('measures the whole run around the key, not just the part before it', () => {
        expect(runContaining(list, '2026-05-01')).toBe(3);
        expect(runContaining(list, '2026-05-02')).toBe(3);
        expect(runContaining(list, '2026-05-03')).toBe(3);
        expect(runContaining(list, '2026-05-10')).toBe(2);
    });

    it('measures a run that starts at the first entry and ends at the last', () => {
        expect(runContaining(['2026-05-01', '2026-05-02'], '2026-05-01')).toBe(2);
        expect(runContaining(['2026-05-01'], '2026-05-01')).toBe(1);
    });

    it('does not join entries that are two or more days apart', () => {
        expect(runContaining(['2026-05-01', '2026-05-03', '2026-05-04'], '2026-05-01')).toBe(1);
        expect(runContaining(['2026-05-01', '2026-05-03', '2026-05-04'], '2026-05-04')).toBe(2);
    });

    it('is 0 for an absent key', () => {
        expect(runContaining(list, '2026-05-04')).toBe(0);
        expect(runContaining([], '2026-05-04')).toBe(0);
    });

    it('spans month, year and leap-day boundaries', () => {
        expect(runContaining(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-02-28')).toBe(3);
        expect(runContaining(['2026-12-31', '2027-01-01'], '2026-12-31')).toBe(2);
        expect(runContaining(['2027-02-28', '2027-03-01'], '2027-02-28')).toBe(2);
        expect(runContaining(['2028-02-28', '2028-03-01'], '2028-02-28')).toBe(1);
    });
});
