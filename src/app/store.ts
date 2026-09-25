import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { gameReducer } from '../features/game/gameSlice';
import { persistenceReducer } from '../features/persistence/persistenceSlice';
import { preferencesReducer } from '../features/preferences/preferencesSlice';
import { statsReducer } from '../features/stats/statsSlice';
import { appReducer } from './appSlice';
import { defaultThunkExtra, type ThunkExtra } from './thunkExtra';

const rootReducer = combineReducers({
    app: appReducer,
    preferences: preferencesReducer,
    stats: statsReducer,
    game: gameReducer,
    persistence: persistenceReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** The undo and redo stacks are unbounded; the dev-only state checks would walk every snapshot on every dispatch. */
const UNBOUNDED_PATHS = ['game.history', 'game.future'];

export interface AppStoreOptions {
    /** State to start from, e.g. the loaded persistent record; missing slices start at their defaults. */
    preloadedState?: Partial<RootState>;
    /** Replacements for the thunk dependencies (deal service, clock, timer, date); the rest keep their defaults. */
    deps?: Partial<ThunkExtra>;
}

export function createAppStore(options: AppStoreOptions = {}) {
    const extra: ThunkExtra = { ...defaultThunkExtra(), ...options.deps };
    return configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                thunk: { extraArgument: extra },
                serializableCheck: { ignoredPaths: UNBOUNDED_PATHS },
                immutableCheck: { ignoredPaths: UNBOUNDED_PATHS },
            }),
        ...(options.preloadedState === undefined ? {} : { preloadedState: options.preloadedState }),
    });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
