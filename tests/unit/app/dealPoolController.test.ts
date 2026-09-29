import { afterEach, describe, expect, it, vi } from 'vitest';
import { visibilityChanged } from '../../../src/app/appSlice';
import {
    createDealPoolController,
    defaultIdleScheduler,
    type IdleScheduler,
} from '../../../src/app/dealPoolController';
import { createAppStore } from '../../../src/app/store';
import { preferenceSet } from '../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../fixtures/dealService';

/** A scheduler whose idle signal the test fires by hand; it records whether the pending call was cancelled. */
function manualScheduler() {
    let pending: (() => void) | undefined;
    let cancelled = false;
    const scheduler: IdleScheduler = {
        schedule: (callback) => {
            pending = callback;
            return () => {
                cancelled = true;
                pending = undefined;
            };
        },
    };
    return {
        scheduler,
        idle: () => {
            const callback = pending;
            pending = undefined;
            callback?.();
        },
        cancelled: () => cancelled,
    };
}

function setup() {
    const store = createAppStore();
    const service = fakeDealService();
    const idle = manualScheduler();
    const controller = createDealPoolController(store, service, idle.scheduler);
    return { store, service, idle, controller };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('createDealPoolController', () => {
    it('starts nothing before the idle signal, then fills for the current choice', () => {
        const { store, service, idle } = setup();
        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'draw3' }));
        expect(service.prefetches).toEqual([]);
        expect(service.pauses).toBe(0);

        idle.idle();

        expect(service.prefetches).toEqual([{ mode: 'draw3', winnableOnly: true }]);
    });

    it('changing the mode moves the filling; returning to a kept mode fills it again', () => {
        const { store, service, idle } = setup();
        idle.idle();

        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));
        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'draw1' }));

        expect(service.prefetches).toEqual([
            { mode: 'draw1', winnableOnly: true },
            { mode: 'vegas', winnableOnly: true },
            { mode: 'draw1', winnableOnly: true },
        ]);
    });

    it('passes Daily or the switch off to the service, which then fills nothing', () => {
        const { store, service, idle } = setup();
        idle.idle();

        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'daily' }));
        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'draw1' }));
        store.dispatch(preferenceSet({ key: 'winnableOnly', value: false }));

        expect(service.prefetches.slice(1)).toEqual([
            { mode: 'daily', winnableOnly: true },
            { mode: 'draw1', winnableOnly: true },
            { mode: 'draw1', winnableOnly: false },
        ]);
    });

    it('does not start a fill for a difficulty change or any other store update', () => {
        const { store, service, idle } = setup();
        idle.idle();

        store.dispatch(preferenceSet({ key: 'difficulty', value: 'hard' }));
        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));

        expect(service.prefetches).toHaveLength(1);
        expect(service.pauses).toBe(0);
    });

    it('pauses while the page is hidden and resumes with the current choice when it is visible again', () => {
        const { store, service, idle } = setup();
        idle.idle();

        store.dispatch(visibilityChanged(false));
        expect(service.pauses).toBe(1);
        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));
        expect(service.prefetches).toHaveLength(1);
        expect(service.pauses).toBe(1);

        store.dispatch(visibilityChanged(true));

        expect(service.prefetches).toEqual([
            { mode: 'draw1', winnableOnly: true },
            { mode: 'vegas', winnableOnly: true },
        ]);
    });

    it('pauses rather than fills when the page is hidden at the idle signal', () => {
        const { store, service, idle } = setup();
        store.dispatch(visibilityChanged(false));

        idle.idle();

        expect(service.prefetches).toEqual([]);
        expect(service.pauses).toBe(1);
    });

    it('disposed before the idle signal, cancels it and never calls the service', () => {
        const { store, service, idle, controller } = setup();

        controller.dispose();
        controller.dispose();
        idle.idle();
        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));

        expect(idle.cancelled()).toBe(true);
        expect(service.prefetches).toEqual([]);
        expect(service.pauses).toBe(0);
    });

    it('disposed after the idle signal, stops following the store', () => {
        const { store, service, idle, controller } = setup();
        idle.idle();

        controller.dispose();
        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));
        store.dispatch(visibilityChanged(false));

        expect(service.prefetches).toHaveLength(1);
        expect(service.pauses).toBe(0);
    });
});

describe('defaultIdleScheduler', () => {
    it('waits for requestIdleCallback with a 2 s timeout where it exists, and cancels through cancelIdleCallback', () => {
        const requestIdleCallback = vi.fn<(callback: IdleRequestCallback, options?: IdleRequestOptions) => number>(
            () => 7,
        );
        const cancelIdleCallback = vi.fn();
        vi.stubGlobal('requestIdleCallback', requestIdleCallback);
        vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);
        const callback = vi.fn();

        const cancel = defaultIdleScheduler.schedule(callback);

        expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
        expect(callback).not.toHaveBeenCalled();
        requestIdleCallback.mock.calls[0]?.[0]({ didTimeout: false, timeRemaining: () => 10 });
        expect(callback).toHaveBeenCalledOnce();
        cancel();
        expect(cancelIdleCallback).toHaveBeenCalledWith(7);
    });

    it('falls back to a 2 s timer where requestIdleCallback is absent', () => {
        vi.useFakeTimers();
        vi.stubGlobal('requestIdleCallback', undefined);
        const callback = vi.fn();

        defaultIdleScheduler.schedule(callback);
        vi.advanceTimersByTime(1999);
        expect(callback).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledOnce();

        const cancelled = vi.fn();
        const cancel = defaultIdleScheduler.schedule(cancelled);
        cancel();
        vi.advanceTimersByTime(2000);
        expect(cancelled).not.toHaveBeenCalled();
    });
});
