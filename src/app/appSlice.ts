import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DealProgress } from '../features/deal/dealService';

export type Route = 'home' | 'game';

/** The sheets that can be open over the board; at most one at a time. */
export type SheetId = 'settings' | 'help' | 'stats' | 'newDeal' | 'paused' | 'win' | 'dealCode' | 'about';

/** The storage notices the shell can show. */
export type NoticeId = 'storage-read' | 'storage-read-only' | 'storage-write';

export interface AppState {
    route: Route;
    sheet: SheetId | null;
    /** Raised notices, each `id` at most once. */
    notices: { id: NoticeId }[];
    documentVisible: boolean;
    /** The device's `prefers-reduced-motion: reduce` request; combine with Animations via `selectReducedMotion`. */
    systemReducedMotion: boolean;
    /** The progress of the deal in flight, or `null` when none is. */
    dealing: DealProgress | null;
}

const initialState: AppState = {
    route: 'home',
    sheet: null,
    notices: [],
    documentVisible: true,
    systemReducedMotion: false,
    dealing: null,
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
} = appSlice.actions;
export const appReducer = appSlice.reducer;

export function selectRoute(state: { readonly app: AppState }): Route {
    return state.app.route;
}
