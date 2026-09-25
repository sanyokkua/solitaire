import { describe, expect, it } from 'vitest';
import { hasExactKeys, isDayKey, isRecord } from '../../../../src/features/persistence/sessionCodec';

describe('isDayKey', () => {
    it.each(['2026-02-01', '2024-02-29', '2000-02-29', '0000-01-01', '9999-12-31'])('accepts %s', (key) => {
        expect(isDayKey(key)).toBe(true);
    });

    it.each([
        '2026-02-30',
        '2026-02-29',
        '1900-02-29',
        '2026-13-01',
        '2026-00-10',
        '2026-01-00',
        '2026-2-3',
        '20260201',
    ])('rejects %s', (key) => {
        expect(isDayKey(key)).toBe(false);
    });

    it.each([null, undefined, 20260201, {}, []])('rejects the non-string %j', (value) => {
        expect(isDayKey(value)).toBe(false);
    });
});

describe('hasExactKeys', () => {
    it('requires every required key and allows the optional ones', () => {
        expect(hasExactKeys({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
        expect(hasExactKeys({ a: 1 }, ['a', 'b'])).toBe(false);
        expect(hasExactKeys({ a: 1, c: 3 }, ['a'], ['c'])).toBe(true);
        expect(hasExactKeys({ a: 1 }, ['a'], ['c'])).toBe(true);
    });

    it('rejects an unknown key', () => {
        expect(hasExactKeys({ a: 1, z: 2 }, ['a'], ['c'])).toBe(false);
    });

    it('does not count inherited properties', () => {
        expect(hasExactKeys(Object.create({ a: 1 }) as Record<string, unknown>, ['a'])).toBe(false);
    });
});

describe('isRecord', () => {
    it('accepts plain objects only', () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord(null)).toBe(false);
        expect(isRecord([])).toBe(false);
        expect(isRecord('x')).toBe(false);
    });
});
