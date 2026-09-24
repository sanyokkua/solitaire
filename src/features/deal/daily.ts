/**
 * Daily deal v1: the UTC day key and the candidate seeds for one day. Daily v1 is pinned; any change to the key, the
 * formula, the budget or the attempt cap is a new version, because it would change past and future Daily deals.
 */

/** The pinned selection parameters: nodes searched per candidate and the number of candidates tried. */
export const DAILY_V1 = { budget: 20_000, maxAttempts: 40 } as const;

/** The UTC calendar date of `date` as `YYYY-MM-DD`, so every time zone shares one Daily deal per UTC day. */
export function utcDayKey(date: Date): string {
    const year = String(date.getUTCFullYear()).padStart(4, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** The candidate seed for `attempt` (1-based) on `dayKey`: `(YYYYMMDD * 131 + attempt * 7919) >>> 0`. */
export function dailySeed(dayKey: string, attempt: number): number {
    const yyyymmdd = Number(dayKey.replaceAll('-', ''));
    return (yyyymmdd * 131 + attempt * 7919) >>> 0;
}

/** Every candidate seed for `dayKey`, in attempt order (attempts 1 to `DAILY_V1.maxAttempts`). */
export function dailySeeds(dayKey: string): readonly number[] {
    return Array.from({ length: DAILY_V1.maxAttempts }, (_, index) => dailySeed(dayKey, index + 1));
}
