import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DealProgress } from '../features/deal/dealService';

export type Route = 'home' | 'game';

/** The sheets that can be open over the board; at most one at a time. */
export type SheetId = 'settings' | 'help' | 'stats' | 'newDeal' | 'paused' | 'win' | 'dealCode' | 'about';

/**
 * The notices the shell can show: the storage ones, the two table messages (a dead end, a refused redeal), and the
 * action notices `code-copied` (transient) and `update-ready` (persistent, with Update and Later).
 */
export type NoticeId =
    'storage-read' | 'storage-read-only' | 'storage-write' | 'dead-end' | 'no-redeals' | 'code-copied' | 'update-ready';

export interface AppState {
    readonly route: Route;
    readonly sheet: SheetId | null;
    /** Raised notices, each `id` at most once. */
    readonly notices: readonly { readonly id: NoticeId }[];
    readonly documentVisible: boolean;
    /** The device's `prefers-reduced-motion: reduce` request; combine with Animations via `selectReducedMotion`. */
    readonly systemReducedMotion: boolean;
    /** The progress of the deal in flight, or `null` when none is. */
    readonly dealing: DealProgress | null;
    /** Whether the browser currently offers to install the app; the Install link on Home shows only then. */
    readonly installable: boolean;
    /** Whether the player chose Later on the update notice: it is not raised again for the rest of the session. */
    readonly updateDeferred: boolean;
}

const initialState: AppState = {
    route: 'home',
    sheet: null,
    notices: [],
    documentVisible: true,
    systemReducedMotion: false,
    dealing: null,
    installable: false,
    updateDeferred: false,
};

const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setRoute: (state, action: PayloadAction<Route>) => {
            state.route = action.payload;
        },
        sheetOpened: (state, action: PayloadAction<SheetId>) => {
            state.sheet = action.payload;
        },
        sheetClosed: (state) => {
            state.sheet = null;
        },
        noticeRaised: (state, action: PayloadAction<NoticeId>) => {
            if (action.payload === 'update-ready' && state.updateDeferred) return;
            if (!state.notices.some((notice) => notice.id === action.payload)) {
                state.notices.push({ id: action.payload });
            }
        },
        noticeDismissed: (state, action: PayloadAction<NoticeId>) => {
            const index = state.notices.findIndex((notice) => notice.id === action.payload);
            if (index >= 0) {
                state.notices.splice(index, 1);
            }
        },
        updateDeferred: (state) => {
            state.updateDeferred = true;
            state.notices = state.notices.filter((notice) => notice.id !== 'update-ready');
        },
        visibilityChanged: (state, action: PayloadAction<boolean>) => {
            state.documentVisible = action.payload;
        },
        systemMotionChanged: (state, action: PayloadAction<boolean>) => {
            state.systemReducedMotion = action.payload;
        },
        dealingProgressed: (state, action: PayloadAction<DealProgress>) => {
            state.dealing = action.payload;
        },
        dealingEnded: (state) => {
            state.dealing = null;
        },
        installableChanged: (state, action: PayloadAction<boolean>) => {
            state.installable = action.payload;
        },
    },
});

export const {
    setRoute,
    sheetOpened,
    sheetClosed,
    noticeRaised,
    noticeDismissed,
    visibilityChanged,
    systemMotionChanged,
    dealingProgressed,
    dealingEnded,
    installableChanged,
    updateDeferred,
} = appSlice.actions;
export const appReducer = appSlice.reducer;
