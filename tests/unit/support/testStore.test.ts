import { describe, expect, it } from 'vitest';
import type { ThunkExtra } from '../../../src/app/thunkExtra';
import type { FakeDealService } from '../../fixtures/dealService';
import { testStore } from '../../support/testStore';

/** Reads the store's live `ThunkExtra` back out by dispatching a thunk that returns it. */
function extraOf(store: ReturnType<typeof testStore>): ThunkExtra {
    return store.dispatch((_dispatch, _getState, extra) => extra);
}

describe('testStore', () => {
    it('defaults to a fake deal service', () => {
        const extra = extraOf(testStore());

        void extra.dealService.deal({ mode: 'draw1', winnableOnly: false }, undefined);

        expect((extra.dealService as FakeDealService).requests).toHaveLength(1);
    });

    it('defaults to a fixed clock', () => {
        const extra = extraOf(testStore());

        expect(extra.now()).toBe(extra.now());
    });

    it('defaults to an instant delay', async () => {
        const extra = extraOf(testStore());
        let resolved = false;

        void extra.delay(1_000).then(() => {
            resolved = true;
        });
        await Promise.resolve();

        expect(resolved).toBe(true);
    });

    it('merges deps overrides over the defaults', () => {
        const store = testStore({ deps: { now: () => 42 } });

        const extra = extraOf(store);

        expect(extra.now()).toBe(42);
        expect(extra.dealService).toBeDefined();
    });

    it('preloads preferences.locale as en by default', () => {
        const store = testStore();

        expect(store.getState().preferences.locale).toBe('en');
    });

    it('respects a caller-supplied preferences override', () => {
        const store = testStore({ preloadedState: { preferences: { locale: 'uk' } } });

        expect(store.getState().preferences.locale).toBe('uk');
        expect(store.getState().preferences.tapMode).toBe('smart');
    });
});
