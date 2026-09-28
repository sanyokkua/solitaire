import { utcDayKey } from '../deal/daily';

/** Pure UTC day-key arithmetic over `YYYY-MM-DD` strings; no local time and no clock. */

const DAY_MS = 86_400_000;

const parseDayKey = (key: string): number => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

const formatDayKey = (ms: number): string => utcDayKey(new Date(ms));

/** The UTC day before `key`. */
export const previousDayKey = (key: string): string => formatDayKey(parseDayKey(key) - DAY_MS);

/** The UTC day after `key`. */
export const nextDayKey = (key: string): string => formatDayKey(parseDayKey(key) + DAY_MS);

/**
 * The number of consecutive days ending at `sorted[index]`, over a sorted, unique, ascending list;
 * 0 when `index` is outside the list.
 */
export const runLengthEndingAt = (sorted: readonly string[], index: number): number => {
    if (index < 0 || index >= sorted.length) {
        return 0;
    }
    let length = 1;
    for (let i = index; i > 0; i -= 1) {
        if (previousDayKey(sorted[i] ?? '') !== sorted[i - 1]) {
            break;
        }
        length += 1;
    }
    return length;
};

/** The length of the maximal consecutive-day run that contains `key`; 0 when `key` is absent. */
export const runContaining = (sorted: readonly string[], key: string): number => {
    const index = sorted.indexOf(key);
    if (index === -1) {
        return 0;
    }
    let end = index;
    while (end + 1 < sorted.length && nextDayKey(sorted[end] ?? '') === sorted[end + 1]) {
        end += 1;
    }
    return runLengthEndingAt(sorted, end);
};
