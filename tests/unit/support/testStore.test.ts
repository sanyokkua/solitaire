import { describe, expect, it } from 'vitest';
import type { ThunkExtra } from '../../../src/app/thunkExtra';
import { testStore } from '../../support/testStore';

/** Reads the store's live `ThunkExtra` back out by dispatching a thunk that returns it. */
function extraOf(store: ReturnType<typeof testStore>): ThunkExtra {
    return store.dispatch((_dispatch, _getState, extra) => extra);
}

describe('testStore', () => {
    it('merges deps overrides over the defaults', () => {
        const store = testStore({ deps: { now: () => 42 } });

        const extra = extraOf(store);

        expect(extra.now()).toBe(42);
        expect(extra.dealService).toBeDefined();
    });

    it('respects a caller-supplied preferences override', () => {
        const store = testStore({ preloadedState: { preferences: { locale: 'uk' } } });

        expect(store.getState().preferences.locale).toBe('uk');
        expect(store.getState().preferences.tapMode).toBe('smart');
    });
});
