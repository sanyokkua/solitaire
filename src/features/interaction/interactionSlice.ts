import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CardId, Mode, PileRef } from '../../domain/types';
import { preferenceSet, preferencesReset } from '../preferences/preferencesSlice';
import { cleared, committed, installed, redone, replaced, undone } from '../game/gameSlice';
import type { Announcement } from './announcements';

/**
 * The outcome of a just-won game (D4): the mode, the final score (Vegas: the bank) already including `timeBonus`,
 * the elapsed time, the move count, the Standard time bonus (0 under Vegas), and whether it is a new best time for
 * the mode (its first win, or strictly faster than the previous best).
 */
export interface WinSummary {
    readonly mode: Mode;
    readonly score: number;
    readonly elapsedMs: number;
    readonly moves: number;
    readonly timeBonus: number;
    readonly newBestTime: boolean;
}

/** The card the player has picked up: the pile it is in and its index there (the run starts at that card). */
export interface Selection {
    readonly from: PileRef;
    readonly index: number;
}

/** The hint being shown: what to move and where, or the stock for a draw or recycle. `id` tells one hint from the next. */
export interface HintView {
    readonly id: number;
    readonly kind: 'move' | 'draw' | 'recycle';
    /** The cards the move carries, lowest first; empty for a draw or recycle. */
    readonly cards: readonly CardId[];
    readonly target: PileRef | 'stock';
}

/** The hint request in flight, by the game it was asked in and the position it was asked about. */
export interface PendingHint {
    readonly epoch: number;
    readonly key: string;
}

/**
 * The player's interaction with the table (D1): runtime-only, never persisted, and kept apart from `game` so nothing
 * in it can reach the saved record. `selection` is data, not a group: the group and its legal targets are derived from
 * the position in play by the selectors, so a selection can never go stale, only stop applying.
 */
export interface InteractionState {
    readonly selection: Selection | null;
    /** The hint on show, or `null`. Cleared when the position, the game or a setting changes. */
    readonly hint: HintView | null;
    /** The id of the last hint shown, so ids only grow and a stale timer can never clear a newer hint. */
    readonly lastHintId: number;
    /** The hint request in flight, so an identical request is not asked twice; cleared with the hint. */
    readonly pendingHint: PendingHint | null;
    /** The position keys whose dead end was already reported in this game; emptied when a game is installed or cleared. */
    readonly deadEndSeen: readonly string[];
    readonly announcement: AnnouncementLog;
    /** The just-won game's outcome, or `null`. Runtime-only, and cleared when a game is installed or cleared. */
    readonly win: WinSummary | null;
}

/** One announcement with its running number `n`, so a listener can tell which ones it has already spoken. */
export interface NumberedAnnouncement {
    readonly n: number;
    readonly item: Announcement;
}

/**
 * The announcement log (D6): `seq` counts batches, `items` is the latest {@link ANNOUNCEMENT_LOG_LIMIT} announcements
 * with strictly increasing `n`. Later batches never overwrite earlier ones, so a batch of several items is never lost.
 */
export interface AnnouncementLog {
    readonly seq: number;
    readonly items: readonly NumberedAnnouncement[];
}

/** How many announcements the log keeps; older ones have long since been spoken. */
export const ANNOUNCEMENT_LOG_LIMIT = 20;

export const initialInteractionState: InteractionState = {
    selection: null,
    hint: null,
    lastHintId: 0,
    pendingHint: null,
    deadEndSeen: [],
    announcement: { seq: 0, items: [] },
    win: null,
};

const interactionSlice = createSlice({
    name: 'interaction',
    initialState: initialInteractionState,
    reducers: {
        /** Records the picked-up card; `selectCard` checks it against the position first, a reducer cannot see the game. */
        selectionSet: (state, action: PayloadAction<Selection>) => ({ ...state, selection: action.payload }),
        selectionCleared: (state) => (state.selection === null ? state : { ...state, selection: null }),
        /** Shows a hint. `requestHint` in the thunk takes the id from `selectNextHintId`, so ids only grow. */
        hintSet: (state, action: PayloadAction<HintView>) => ({
            ...state,
            hint: action.payload,
            lastHintId: Math.max(state.lastHintId, action.payload.id),
        }),
        /** Clears the hint; given an `id`, only that hint, so a timer that outlived its hint leaves a newer one alone. */
        hintCleared: (state, action: PayloadAction<number | undefined>) =>
            state.hint === null || (action.payload !== undefined && state.hint.id !== action.payload)
                ? state
                : { ...state, hint: null },
        pendingHintSet: (state, action: PayloadAction<PendingHint | null>) => ({
            ...state,
            pendingHint: action.payload,
        }),
        /** Remembers that the dead end at `key` was reported; the position is not reported again in this game. */
        deadEndRecorded: (state, action: PayloadAction<string>) =>
            state.deadEndSeen.includes(action.payload)
                ? state
                : { ...state, deadEndSeen: [...state.deadEndSeen, action.payload] },
        /**
         * Appends a batch to the announcement log and bumps `seq` once; an empty batch changes nothing. Numbering
         * continues from the last item and is never reused. No game action resets the log: an install must not drop
         * an announcement (a win) that has not been spoken yet.
         */
        announced: (state, action: PayloadAction<readonly Announcement[]>) => {
            if (action.payload.length === 0) return state;
            const { seq, items } = state.announcement;
            let n = items.at(-1)?.n ?? 0;
            const added = action.payload.map((item) => ({ n: (n += 1), item }));
            return {
                ...state,
                announcement: { seq: seq + 1, items: [...items, ...added].slice(-ANNOUNCEMENT_LOG_LIMIT) },
            };
        },
        /** Records a just-won game's outcome (D4); dispatched from `commitCommand` right after `won`. */
        winRecorded: (state, action: PayloadAction<WinSummary>) => ({ ...state, win: action.payload }),
    },
    extraReducers: (builder) => {
        // Any change of the position, or a new or missing game, ends the pick-up and drops the hint and its request.
        builder.addMatcher(
            (action) =>
                [committed, replaced, undone, redone, installed, cleared].some((creator) => creator.match(action)),
            (state) =>
                state.selection === null && state.hint === null && state.pendingHint === null
                    ? state
                    : { ...state, selection: null, hint: null, pendingHint: null },
        );
        // A new or missing game also forgets which dead ends were reported, and clears the win summary.
        builder.addMatcher(
            (action) => installed.match(action) || cleared.match(action),
            (state) =>
                state.deadEndSeen.length === 0 && state.win === null ? state : { ...state, deadEndSeen: [], win: null },
        );
        // A changed setting (language, motion, ...) ends the hint on show; its request may still land.
        builder.addMatcher(
            (action) => preferenceSet.match(action) || preferencesReset.match(action),
            (state) => (state.hint === null ? state : { ...state, hint: null }),
        );
    },
});

export const {
    selectionSet,
    selectionCleared,
    hintSet,
    hintCleared,
    pendingHintSet,
    deadEndRecorded,
    announced,
    winRecorded,
} = interactionSlice.actions;
export const interactionReducer = interactionSlice.reducer;
