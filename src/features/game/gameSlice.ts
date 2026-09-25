import { createSelector, createSlice, isDraft, original, type Draft, type PayloadAction } from '@reduxjs/toolkit';
import { finishPlan } from '../../domain/assist';
import { displayedScore } from '../../domain/scoring';
import type { GameState } from '../../domain/types';
import { canRedo, canUndo, commit, redo, replace, undo, type Session } from './history';

/**
 * The game session (D7). `current` is the position in play, `history` and `future` are the undo and redo stacks (see
 * `history.ts`), `dailyKey` is the UTC day a Daily deal was selected for, and `counted` says whether this game's
 * outcome has been added to the statistics.
 *
 * `busy`, `epoch` and `clock` are runtime-only and are never persisted: `busy` is set while a safe-card chain or
 * finish is running, `epoch` is bumped whenever a game is installed or cleared so a sequence started for an
 * earlier game can tell it is stale, and `clock.anchorMs` is the injected-clock reading play time was last accrued at
 * (`null` while the clock is not running).
 */
export interface GameSliceState {
    readonly current: GameState | null;
    readonly history: readonly GameState[];
    readonly future: readonly GameState[];
    readonly dailyKey: string | null;
    readonly counted: boolean;
    readonly busy: boolean;
    readonly epoch: number;
    readonly clock: { readonly anchorMs: number | null };
}

export const initialGameState: GameSliceState = {
    current: null,
    history: [],
    future: [],
    dailyKey: null,
    counted: false,
    busy: false,
    epoch: 0,
    clock: { anchorMs: null },
};

/** The slice's plain state behind an Immer draft, so reads never wrap the unbounded history in proxies. */
function plainOf(state: Draft<GameSliceState>): GameSliceState {
    return (isDraft(state) ? original(state) : undefined) ?? state;
}

/**
 * Runs a pure history function over the slice's session; without a game in play the state is returned as it is. The
 * step reads the plain state under an Immer draft, so an unbounded history is not wrapped in proxies one snapshot at a
 * time.
 */
function withSession(state: Draft<GameSliceState>, step: (session: Session) => Session): GameSliceState {
    const plain = plainOf(state);
    if (plain.current === null) return plain;
    const { current, history, future } = step({ current: plain.current, history: plain.history, future: plain.future });
    return { ...plain, current, history, future };
}

/** The most play time one accrual step may add, so a device that suspends while the page counts as visible adds no more. */
const MAX_ACCRUAL_STEP_MS = 1000;

const gameSlice = createSlice({
    name: 'game',
    initialState: initialGameState,
    reducers: {
        /** Installs a freshly dealt (or restored) game: empty history, no clock anchor, and a new epoch. */
        installed: (state, action: PayloadAction<{ state: GameState; dailyKey: string | null }>) => ({
            ...state,
            current: action.payload.state,
            history: [],
            future: [],
            dailyKey: action.payload.dailyKey,
            counted: false,
            busy: false,
            clock: { anchorMs: null },
            epoch: state.epoch + 1,
        }),
        /** Starts a new undo step with `next` as the position in play. */
        committed: (state, action: PayloadAction<GameState>) =>
            withSession(state, (session) => commit(session, action.payload)),
        /** Updates the position in play inside the current undo step. */
        replaced: (state, action: PayloadAction<GameState>) =>
            withSession(state, (session) => replace(session, action.payload)),
        /** Undoes one step; ignored while a safe-card chain or finish is running. */
        undone: (state) => (state.busy ? state : withSession(state, undo)),
        /** Redoes one step; ignored while a safe-card chain or finish is running. */
        redone: (state) => (state.busy ? state : withSession(state, redo)),
        /**
         * Settles play time at the injected-clock reading `atMs`. While `eligible` and an anchor is set, the whole
         * milliseconds since the anchor (at most one second, so a suspended device adds no more; a reading that goes backwards adds none)
         * join `elapsedMs`, which therefore stays an integer even on a fractional clock. The anchor moves forward by
         * exactly what was added, so the sub-millisecond remainder carries into the next step; a gap over the cap
         * or a reading that went backwards moves it to `atMs`. When not eligible the anchor becomes `null`, so the first
         * accrual after resuming only sets it and the gap is never counted. The undo and redo stacks are left
         * untouched.
         */
        accrued: (state, action: PayloadAction<{ atMs: number; eligible: boolean }>) => {
            const { atMs, eligible } = action.payload;
            const plain = plainOf(state);
            const { current, clock } = plain;
            if (current === null) return clock.anchorMs === null ? plain : { ...plain, clock: { anchorMs: null } };
            if (!eligible) return clock.anchorMs === null ? plain : { ...plain, clock: { anchorMs: null } };
            if (clock.anchorMs === null) return { ...plain, clock: { anchorMs: atMs } };
            const gap = atMs - clock.anchorMs;
            const step = gap < 0 ? 0 : Math.min(Math.floor(gap), MAX_ACCRUAL_STEP_MS);
            const anchorMs = gap < 0 || gap > MAX_ACCRUAL_STEP_MS ? atMs : clock.anchorMs + step;
            if (step === 0 && anchorMs === clock.anchorMs) return plain;
            return {
                ...plain,
                current: step === 0 ? current : { ...current, elapsedMs: current.elapsedMs + step },
                clock: { anchorMs },
            };
        },
        busySet: (state, action: PayloadAction<boolean>) => ({ ...state, busy: action.payload }),
        countedSet: (state, action: PayloadAction<boolean>) => ({ ...state, counted: action.payload }),
        /** Drops the game and everything that belongs to it; bumps the epoch so pending sequences go stale. */
        cleared: (state) => ({
            ...initialGameState,
            epoch: state.epoch + 1,
        }),
    },
});

export const { installed, committed, replaced, undone, redone, accrued, busySet, countedSet, cleared } =
    gameSlice.actions;
export const gameReducer = gameSlice.reducer;

/** The structural slice of the store the game selectors read, so this module needs no store import. */
interface GameRoot {
    readonly game: GameSliceState;
}

/** Whether undo would change anything: no safe-card chain or finish is running, a game is in play, not won, and there is a step to undo. */
export function selectCanUndo({ game }: GameRoot): boolean {
    return !game.busy && game.current !== null && canUndo({ ...game, current: game.current });
}

/** Whether redo would change anything: no safe-card chain or finish is running, a game is in play, not won, and there is a step to redo. */
export function selectCanRedo({ game }: GameRoot): boolean {
    return !game.busy && game.current !== null && canRedo({ ...game, current: game.current });
}

/** Whether Home offers Continue: a game that has had an accepted command and is not over. */
export function selectResumable({ game }: GameRoot): boolean {
    return game.current !== null && game.current.started && game.current.status === 'playing';
}

/** The score on show: the stored score less the time and undo charges (Standard only), plus the win bonus. */
export function selectDisplayedScore({ game }: GameRoot): number {
    return game.current === null ? 0 : displayedScore(game.current);
}

/** Whether the position in play can be finished automatically; computed once per position, not per call. */
const selectFinishable = createSelector(
    [({ game }: GameRoot) => game.current],
    (current) => current?.status === 'playing' && finishPlan(current) !== undefined,
);

/** Whether Finish is offered: no safe-card chain or finish is running and the position can be played out automatically. */
export function selectCanFinish(state: GameRoot): boolean {
    return !state.game.busy && selectFinishable(state);
}
