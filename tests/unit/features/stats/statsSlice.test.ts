import { describe, expect, it } from 'vitest';
import type { Mode } from '../../../../src/domain/types';
import {
    played,
    selectModeStats,
    selectWinRate,
    statsReducer,
    statsReset,
    streakBroken,
    won,
    type StatsState,
} from '../../../../src/features/stats/statsSlice';

const MODES: readonly Mode[] = ['draw1', 'draw3', 'vegas', 'daily'];

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

const reduce = (state: StatsState, ...actions: Parameters<typeof statsReducer>[1][]): StatsState =>
    actions.reduce(statsReducer, state);

describe('statsSlice initial state', () => {
    it('starts every mode at zero with no bests and an empty Daily block', () => {
        const state = initial();
        for (const mode of MODES) {
            expect(state.modes[mode]).toEqual({
                played: 0,
                won: 0,
                streak: 0,
                bestStreak: 0,
                bestTimeMs: null,
                bestScore: null,
            });
        }
        expect(state.daily).toEqual({ completed: [], bestStreak: 0 });
    });
});

describe('played', () => {
    it('adds one played game to the named mode only', () => {
        const state = reduce(initial(), played('vegas'), played('vegas'));
        expect(state.modes.vegas.played).toBe(2);
        expect(state.modes.draw1.played).toBe(0);
    });
});

describe('won', () => {
    it('records the first win of a mode', () => {
        const state = reduce(initial(), played('draw1'), won({ mode: 'draw1', elapsedMs: 120_000, score: 3000 }));
        expect(state.modes.draw1).toEqual({
            played: 1,
            won: 1,
            streak: 1,
            bestStreak: 1,
            bestTimeMs: 120_000,
            bestScore: 3000,
        });
    });

    it('keeps the records after a slower, lower win while the streak grows', () => {
        const state = reduce(
            initial(),
            played('draw1'),
            won({ mode: 'draw1', elapsedMs: 120_000, score: 3000 }),
            played('draw1'),
            won({ mode: 'draw1', elapsedMs: 300_000, score: 1000 }),
        );
        expect(state.modes.draw1).toEqual({
            played: 2,
            won: 2,
            streak: 2,
            bestStreak: 2,
            bestTimeMs: 120_000,
            bestScore: 3000,
        });
    });

    it('replaces the records after a faster, higher win', () => {
        const state = reduce(
            initial(),
            won({ mode: 'draw3', elapsedMs: 300_000, score: 1000 }),
            won({ mode: 'draw3', elapsedMs: 90_000, score: 4000 }),
        );
        expect(state.modes.draw3.bestTimeMs).toBe(90_000);
        expect(state.modes.draw3.bestScore).toBe(4000);
    });

    it('tracks the best time and the best score independently', () => {
        const state = reduce(
            initial(),
            won({ mode: 'draw1', elapsedMs: 200_000, score: 3000 }),
            won({ mode: 'draw1', elapsedMs: 100_000, score: 1000 }),
        );
        expect(state.modes.draw1.bestTimeMs).toBe(100_000);
        expect(state.modes.draw1.bestScore).toBe(3000);
    });

    it('keeps the highest Vegas bank, negatives included', () => {
        const up = reduce(
            initial(),
            won({ mode: 'vegas', elapsedMs: 1, score: -40 }),
            won({ mode: 'vegas', elapsedMs: 1, score: -27 }),
        );
        expect(up.modes.vegas.bestScore).toBe(-27);
        const down = reduce(
            initial(),
            won({ mode: 'vegas', elapsedMs: 1, score: -27 }),
            won({ mode: 'vegas', elapsedMs: 1, score: -40 }),
        );
        expect(down.modes.vegas.bestScore).toBe(-27);
    });

    it('does not change the played count', () => {
        const state = reduce(initial(), played('draw1'), won({ mode: 'draw1', elapsedMs: 1, score: 1 }));
        expect(state.modes.draw1.played).toBe(1);
        expect(reduce(initial(), won({ mode: 'draw1', elapsedMs: 1, score: 1 })).modes.draw1.played).toBe(0);
    });

    it('raises bestStreak only when the streak exceeds it', () => {
        const state = reduce(
            initial(),
            won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
            won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
            won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
            streakBroken('draw1'),
            won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
        );
        expect(state.modes.draw1.streak).toBe(1);
        expect(state.modes.draw1.bestStreak).toBe(3);
    });
});

describe('streakBroken', () => {
    it('zeroes only the named mode and keeps its best streak', () => {
        const state = reduce(
            initial(),
            won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
            won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
            won({ mode: 'vegas', elapsedMs: 1, score: 1 }),
            streakBroken('draw1'),
        );
        expect(state.modes.draw1.streak).toBe(0);
        expect(state.modes.draw1.bestStreak).toBe(2);
        expect(state.modes.vegas.streak).toBe(1);
        expect(state.modes.vegas.bestStreak).toBe(1);
    });
});

describe('statsReset', () => {
    it('empties every mode and the Daily block', () => {
        const populated = MODES.flatMap((mode) => [played(mode), won({ mode, elapsedMs: 5, score: 5 })]);
        const filled = reduce(initial(), ...populated);
        expect(filled).not.toEqual(initial());
        expect(reduce(filled, statsReset())).toEqual(initial());
    });

    it('shares no references with a previous state', () => {
        const before = deepFreeze(reduce(initial(), played('draw1')));
        const after = statsReducer(before, statsReset());
        expect(after.modes).not.toBe(before.modes);
        expect(after.daily).not.toBe(before.daily);
        expect(after.daily.completed).not.toBe(before.daily.completed);
        for (const mode of MODES) {
            expect(after.modes[mode]).not.toBe(before.modes[mode]);
        }
        const again = statsReducer(after, statsReset());
        expect(again.modes.draw1).not.toBe(after.modes.draw1);
    });
});

describe('immutability', () => {
    it('does not mutate a deep-frozen input', () => {
        const frozen = deepFreeze(initial());
        expect(() =>
            reduce(
                frozen,
                played('draw1'),
                won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
                streakBroken('draw1'),
                statsReset(),
            ),
        ).not.toThrow();
        expect(frozen).toEqual(initial());
    });
});

describe('selectors', () => {
    it('selectModeStats returns the mode record', () => {
        const stats = reduce(initial(), played('draw3'), played('draw3'));
        expect(selectModeStats({ stats }, 'draw3')).toBe(stats.modes.draw3);
        expect(selectModeStats({ stats }, 'draw3').played).toBe(2);
    });

    it('selectWinRate is 0 with no games and won over played otherwise', () => {
        const none = initial();
        expect(selectWinRate({ stats: none }, 'draw1')).toBe(0);
        const half = reduce(
            initial(),
            played('draw1'),
            played('draw1'),
            won({ mode: 'draw1', elapsedMs: 1, score: 1 }),
        );
        expect(selectWinRate({ stats: half }, 'draw1')).toBe(0.5);
    });
});
