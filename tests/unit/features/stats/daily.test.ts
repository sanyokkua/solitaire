import { describe, expect, it } from 'vitest';
import {
    dailyCompleted,
    played,
    selectDailyStreak,
    statsReducer,
    statsReset,
    type StatsState,
} from '../../../../src/features/stats/statsSlice';
import { nextDayKey } from '../../../../src/features/stats/dayKeys';

function deepFreeze<T>(value: T): T {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}

const initial = (): StatsState => statsReducer(undefined, { type: '@@init' });

const complete = (state: StatsState, ...keys: string[]): StatsState =>
    keys.reduce((acc, key) => statsReducer(acc, dailyCompleted(key)), state);

const streak = (state: StatsState, today: string): number => selectDailyStreak({ stats: state }, today);

describe('dailyCompleted', () => {
    it('builds the streak from consecutive days', () => {
        const state = complete(initial(), '2026-05-01', '2026-05-02', '2026-05-03');
        expect(streak(state, '2026-05-03')).toBe(3);
        expect(state.daily.bestStreak).toBe(3);
    });

    it('records winning the same day twice once', () => {
        const state = complete(initial(), '2026-05-01', '2026-05-02', '2026-05-02');
        expect(state.daily.completed).toEqual(['2026-05-01', '2026-05-02']);
        expect(streak(state, '2026-05-02')).toBe(2);
        expect(state.daily.bestStreak).toBe(2);
    });

    it('ends the streak after a missed day but keeps the best', () => {
        const state = complete(initial(), '2026-05-01', '2026-05-02', '2026-05-03');
        expect(streak(state, '2026-05-05')).toBe(0);
        expect(state.daily.bestStreak).toBe(3);
        const later = complete(state, '2026-05-05');
        expect(streak(later, '2026-05-05')).toBe(1);
        expect(later.daily.bestStreak).toBe(3);
    });

    it('keeps the streak when yesterday is the newest completed day', () => {
        const state = complete(initial(), '2026-05-01', '2026-05-02', '2026-05-03');
        expect(streak(state, '2026-05-04')).toBe(3);
    });

    it('is 0 with nothing completed', () => {
        expect(streak(initial(), '2026-05-04')).toBe(0);
    });

    it('is 0 (and does not throw) when the newest completed day is after today', () => {
        const state = complete(initial(), '2026-05-10', '2026-05-11');
        expect(streak(state, '2026-05-01')).toBe(0);
    });

    it('ignores completed days after today when counting the streak', () => {
        const state = complete(initial(), '2026-05-09', '2026-05-10', '2026-05-11');
        expect(streak(state, '2026-05-10')).toBe(2);
        expect(streak(state, '2026-05-11')).toBe(3);
    });

    it('sorts a late finish into place', () => {
        const state = complete(initial(), '2026-05-03', '2026-05-01');
        expect(state.daily.completed).toEqual(['2026-05-01', '2026-05-03']);
    });

    it('merges two runs when a late finish fills the gap', () => {
        const apart = complete(initial(), '2026-05-01', '2026-05-02', '2026-05-04', '2026-05-05');
        expect(apart.daily.bestStreak).toBe(2);
        const merged = complete(apart, '2026-05-03');
        expect(merged.daily.completed).toEqual(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']);
        expect(merged.daily.bestStreak).toBe(5);
        expect(streak(merged, '2026-05-05')).toBe(5);
    });

    it('counts a late finish before the newest day toward the best streak', () => {
        const state = complete(initial(), '2026-05-10', '2026-05-02', '2026-05-01');
        expect(state.daily.bestStreak).toBe(2);
        expect(streak(state, '2026-05-10')).toBe(1);
    });

    it('treats the leap day as part of a run', () => {
        const state = complete(initial(), '2028-02-28', '2028-02-29', '2028-03-01');
        expect(streak(state, '2028-03-01')).toBe(3);
        expect(state.daily.bestStreak).toBe(3);
    });

    it('runs across a year boundary', () => {
        const state = complete(initial(), '2026-12-31', '2027-01-01');
        expect(streak(state, '2027-01-01')).toBe(2);
    });

    it('joins 2027-02-28 and 2027-03-01 (2027 has no leap day)', () => {
        const state = complete(initial(), '2027-02-28', '2027-03-01');
        expect(streak(state, '2027-03-01')).toBe(2);
        expect(state.daily.bestStreak).toBe(2);
    });

    it('does not join 2028-02-28 and 2028-03-01 (the leap day is missing)', () => {
        const state = complete(initial(), '2028-02-28', '2028-03-01');
        expect(streak(state, '2028-03-01')).toBe(1);
        expect(state.daily.bestStreak).toBe(1);
    });

    it('keeps the newest 400 dates, ascending, and preserves the best streak from before trimming', () => {
        let key = '2026-01-01';
        const keys = [key];
        for (let i = 1; i < 401; i += 1) {
            key = nextDayKey(key);
            keys.push(key);
        }
        const state = complete(initial(), ...keys);
        expect(state.daily.completed).toHaveLength(400);
        expect(state.daily.completed[0]).toBe(keys[1]);
        expect(state.daily.completed[399]).toBe(keys[400]);
        expect([...state.daily.completed].sort()).toEqual(state.daily.completed);
        expect(state.daily.bestStreak).toBe(401);
        expect(streak(state, keys[400] ?? '')).toBe(400);
    });

    it('does not touch the Daily played/won counters', () => {
        const state = complete(statsReducer(initial(), played('daily')), '2026-05-01');
        expect(state.modes.daily.played).toBe(1);
        expect(state.modes.daily.won).toBe(0);
        expect(state.modes.daily.streak).toBe(0);
    });

    it('does not mutate a frozen input', () => {
        const frozen = deepFreeze(complete(initial(), '2026-05-01', '2026-05-03'));
        const next = statsReducer(frozen, dailyCompleted('2026-05-02'));
        expect(next.daily.completed).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
        expect(frozen.daily.completed).toEqual(['2026-05-01', '2026-05-03']);
        expect(statsReducer(frozen, dailyCompleted('2026-05-01'))).toBe(frozen);
    });

    it('is cleared by statsReset', () => {
        const state = statsReducer(complete(initial(), '2026-05-01', '2026-05-02'), statsReset());
        expect(state.daily).toEqual({ completed: [], bestStreak: 0 });
    });
});
