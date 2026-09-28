import { describe, expect, it } from 'vitest';
import {
    played,
    selectOverallStats,
    statsReducer,
    streakBroken,
    won,
    type StatsState,
} from '../../../../src/features/stats/statsSlice';

const initial = (): StatsState => statsReducer(undefined, { type: '@@init' });

describe('selectOverallStats', () => {
    it('returns the same reference when called again with the same stats, even from a new root object', () => {
        const state = statsReducer(initial(), played('draw1'));

        expect(selectOverallStats({ stats: state })).toBe(selectOverallStats({ stats: state }));
    });

    it('sums played and won across modes and reports a whole-percent win rate', () => {
        let state = initial();
        state = statsReducer(state, played('draw1'));
        state = statsReducer(state, played('draw1'));
        state = statsReducer(state, played('draw1'));
        state = statsReducer(state, won({ mode: 'draw1', elapsedMs: 1_000, score: 100 }));
        state = statsReducer(state, won({ mode: 'draw1', elapsedMs: 2_000, score: 90 }));
        state = statsReducer(state, played('vegas'));

        const overall = selectOverallStats({ stats: state });

        expect(overall.played).toBe(4);
        expect(overall.won).toBe(2);
        expect(overall.winRate).toBe(50);
    });

    it('rounds the win rate to the nearest whole percent', () => {
        let state = initial();
        state = statsReducer(state, played('draw3'));
        state = statsReducer(state, played('draw3'));
        state = statsReducer(state, played('draw3'));
        state = statsReducer(state, won({ mode: 'draw3', elapsedMs: 1_000, score: 10 }));

        expect(selectOverallStats({ stats: state }).winRate).toBe(33);
    });

    it('has no games and no win rate before anything is played', () => {
        const overall = selectOverallStats({ stats: initial() });

        expect(overall.played).toBe(0);
        expect(overall.won).toBe(0);
        expect(overall.winRate).toBeNull();
        expect(overall.streak).toBe(0);
        expect(overall.bestStreak).toBe(0);
    });

    it('takes the largest current streak and the largest best streak among the modes', () => {
        let state = initial();
        // Draw 1: two wins (streak 2), then a broken streak, leaving bestStreak 2 and current streak 0.
        state = statsReducer(state, won({ mode: 'draw1', elapsedMs: 1_000, score: 10 }));
        state = statsReducer(state, won({ mode: 'draw1', elapsedMs: 1_000, score: 10 }));
        state = statsReducer(state, streakBroken('draw1'));
        // Draw 3: four wins in a row, current and best streak both 4.
        state = statsReducer(state, won({ mode: 'draw3', elapsedMs: 1_000, score: 10 }));
        state = statsReducer(state, won({ mode: 'draw3', elapsedMs: 1_000, score: 10 }));
        state = statsReducer(state, won({ mode: 'draw3', elapsedMs: 1_000, score: 10 }));
        state = statsReducer(state, won({ mode: 'draw3', elapsedMs: 1_000, score: 10 }));

        const overall = selectOverallStats({ stats: state });

        expect(overall.streak).toBe(4);
        expect(overall.bestStreak).toBe(4);
    });

    it('keeps the Draw 1 best streak of 5 as the overall best even though its current streak dropped', () => {
        let state = initial();
        for (let i = 0; i < 5; i += 1) {
            state = statsReducer(state, won({ mode: 'draw1', elapsedMs: 1_000, score: 10 }));
        }
        state = statsReducer(state, streakBroken('draw1'));
        state = statsReducer(state, won({ mode: 'draw1', elapsedMs: 1_000, score: 10 }));
        state = statsReducer(state, won({ mode: 'draw1', elapsedMs: 1_000, score: 10 }));

        const overall = selectOverallStats({ stats: state });

        expect(overall.streak).toBe(2);
        expect(overall.bestStreak).toBe(5);
    });
});
