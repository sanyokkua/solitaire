import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Mode } from '../../domain/types';
import { previousDayKey, runContaining, runLengthEndingAt } from './dayKeys';

export interface ModeStats {
    readonly played: number;
    readonly won: number;
    readonly streak: number;
    readonly bestStreak: number;
    /** The fastest win in milliseconds, or null before the first win. */
    readonly bestTimeMs: number | null;
    /** The highest final displayed score (for Vegas, the bank; may be negative), or null before the first win. */
    readonly bestScore: number | null;
}

export interface StatsState {
    readonly modes: Record<Mode, ModeStats>;
    readonly daily: { readonly completed: readonly string[]; readonly bestStreak: number };
}

export interface WinRecord {
    readonly mode: Mode;
    readonly elapsedMs: number;
    readonly score: number;
}

/** How many completed Daily dates are kept; the stored best streak outlives the trimmed ones. */
export const MAX_DAILY_COMPLETED = 400;

const emptyModeStats = (): ModeStats => ({
    played: 0,
    won: 0,
    streak: 0,
    bestStreak: 0,
    bestTimeMs: null,
    bestScore: null,
});

/** A fresh state on every call, so a reset never shares references with an earlier state. */
const createInitialState = (): StatsState => ({
    modes: { draw1: emptyModeStats(), draw3: emptyModeStats(), vegas: emptyModeStats(), daily: emptyModeStats() },
    daily: { completed: [], bestStreak: 0 },
});

const statsSlice = createSlice({
    name: 'stats',
    initialState: createInitialState,
    reducers: {
        played: (state, action: PayloadAction<Mode>) => {
            state.modes[action.payload].played += 1;
        },
        won: (state, action: PayloadAction<WinRecord>) => {
            const { mode, elapsedMs, score } = action.payload;
            const stats = state.modes[mode];
            stats.won += 1;
            stats.streak += 1;
            stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
            stats.bestTimeMs = stats.bestTimeMs === null ? elapsedMs : Math.min(stats.bestTimeMs, elapsedMs);
            stats.bestScore = stats.bestScore === null ? score : Math.max(stats.bestScore, score);
        },
        streakBroken: (state, action: PayloadAction<Mode>) => {
            state.modes[action.payload].streak = 0;
        },
        dailyCompleted: (state, action: PayloadAction<string>) => {
            const dayKey = action.payload;
            const completed = state.daily.completed;
            if (completed.includes(dayKey)) {
                return;
            }
            const insertAt = completed.findIndex((existing) => existing > dayKey);
            completed.splice(insertAt === -1 ? completed.length : insertAt, 0, dayKey);
            state.daily.bestStreak = Math.max(state.daily.bestStreak, runContaining(completed, dayKey));
            if (completed.length > MAX_DAILY_COMPLETED) {
                completed.splice(0, completed.length - MAX_DAILY_COMPLETED);
            }
        },
        statsReset: () => createInitialState(),
    },
});

export const { played, won, streakBroken, dailyCompleted, statsReset } = statsSlice.actions;
export const statsReducer = statsSlice.reducer;

export const selectModeStats = (state: { readonly stats: StatsState }, mode: Mode): ModeStats =>
    state.stats.modes[mode];

/** Wins as a share of games played; 0 before the first game. */
export const winRateOf = (modeStats: ModeStats): number =>
    modeStats.played === 0 ? 0 : modeStats.won / modeStats.played;

export const selectWinRate = (state: { readonly stats: StatsState }, mode: Mode): number =>
    winRateOf(selectModeStats(state, mode));

/**
 * The current Daily streak: the run of consecutive completed days ending today, or else yesterday; otherwise 0. Dates
 * after today (a device clock that was ahead) never hide it.
 */
export const selectDailyStreak = (state: { readonly stats: StatsState }, todayKey: string): number => {
    const { completed } = state.stats.daily;
    const today = completed.indexOf(todayKey);
    return runLengthEndingAt(completed, today === -1 ? completed.indexOf(previousDayKey(todayKey)) : today);
};

/** The overall record across the four modes; see {@link selectOverallStats}. */
export interface OverallStats {
    readonly played: number;
    readonly won: number;
    /** A whole percent rounded to the nearest integer; `null` while `played` is 0. */
    readonly winRate: number | null;
    readonly streak: number;
    readonly bestStreak: number;
}

/**
 * The overall record across Draw 1, Draw 3, Vegas and Daily (D8): summed played/won, a rounded whole-percent win
 * rate (`null` before any game is played), and the largest current and best streaks among the four modes. The
 * Daily date-streak (`state.stats.daily`) is a separate concept and is not folded in here.
 */
export const selectOverallStats = createSelector(
    [(state: { readonly stats: StatsState }) => state.stats.modes],
    (modeRecords): OverallStats => {
        const modes = Object.values(modeRecords);
        const played = modes.reduce((sum, mode) => sum + mode.played, 0);
        const won = modes.reduce((sum, mode) => sum + mode.won, 0);
        return {
            played,
            won,
            winRate: played === 0 ? null : Math.round((won / played) * 100),
            streak: Math.max(...modes.map((mode) => mode.streak)),
            bestStreak: Math.max(...modes.map((mode) => mode.bestStreak)),
        };
    },
);
