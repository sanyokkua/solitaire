import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export type Route = 'home' | 'game';

export interface AppState {
    route: Route;
}

const initialState: AppState = {
    route: 'home',
};

const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setRoute: (state, action: PayloadAction<Route>) => {
            state.route = action.payload;
        },
    },
});

export const { setRoute } = appSlice.actions;
export const appReducer = appSlice.reducer;

export function selectRoute(state: RootState): Route {
    return state.app.route;
}
