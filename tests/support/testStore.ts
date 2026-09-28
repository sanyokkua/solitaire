import type { RootState } from '../../src/app/store';
import { createAppStore, type AppStore } from '../../src/app/store';
import type { ThunkExtra } from '../../src/app/thunkExtra';
import { defaultPreferences, type Preferences } from '../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../fixtures/dealService';

export interface TestStoreOptions {
    /**
     * State to start from; missing slices start at their defaults. `preferences` merges over
     * `defaultPreferences('en')`, so it may be given partially, unlike the other slices.
     */
    readonly preloadedState?: Omit<Partial<RootState>, 'preferences'> & { readonly preferences?: Partial<Preferences> };
    /** Replacements for the thunk dependencies; unset fields keep this helper's own defaults. */
    readonly deps?: Partial<ThunkExtra>;
}

/**
 * A store for tests: a fake deal service, a fixed `now`, an instant `delay`, a no-op `saver` and `languages` fixed
 * at `['en-US']`, in place of the real worker, timers and browser, and `preferences.locale` fixed at `'en'` unless
 * `preloadedState.preferences` overrides it. Every other `ThunkExtra` field (`gateway`, `today`) and every other
 * slice keep `createAppStore`'s own defaults unless given.
 */
export function testStore({ preloadedState, deps }: TestStoreOptions = {}): AppStore {
    return createAppStore({
        preloadedState: {
            ...preloadedState,
            preferences: { ...defaultPreferences('en'), ...preloadedState?.preferences },
        },
        deps: {
            dealService: fakeDealService(),
            now: () => 1_000,
            delay: () => Promise.resolve(),
            saver: { flush: () => undefined, flushQuietly: () => undefined, cancel: () => undefined },
            languages: () => ['en-US'],
            ...deps,
        },
    });
}
