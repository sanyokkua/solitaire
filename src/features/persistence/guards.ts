import { utcDayKey } from '../deal/daily';

/** The shape checks the record and session codecs share when they decode untrusted storage. */

/** A plain, non-null, non-array object: the shape every key check assumes it can read. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether `value` has every key in `required` and no key outside `required` and `optional`. Unknown keys fail. */
export function hasExactKeys(
    value: Record<string, unknown>,
    required: readonly string[],
    optional: readonly string[] = [],
): boolean {
    const keys = Object.keys(value);
    return (
        required.every((key) => Object.hasOwn(value, key)) &&
        keys.every((key) => required.includes(key) || optional.includes(key))
    );
}

/** A real UTC calendar date written as `YYYY-MM-DD`; `2026-02-30` and `2026-13-01` are not dates. */
export function isDayKey(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    // `setUTCFullYear` rather than `Date.UTC`, which would read the years 0 to 99 as 1900 to 1999.
    const date = new Date(0);
    date.setUTCFullYear(year ?? 0, (month ?? 1) - 1, day ?? 1);
    return utcDayKey(date) === value;
}
