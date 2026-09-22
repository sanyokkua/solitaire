import { configureStore } from '@reduxjs/toolkit';
import { appReducer } from './appSlice';

export function createAppStore() {
    return configureStore({
        reducer: {
            app: appReducer,
        },
    });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
