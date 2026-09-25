import type { UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { selectClockEligible } from './clock';
import { accrued } from './gameSlice';

/** How often play time is accrued while the game runs. */
const TICK_MS = 250;

/**
 * The store as the ticker sees it: structurally, so this module needs no runtime import of the store. The real store
 * from `createAppStore` satisfies it.
 */
export interface ClockTickerStore {
    getState(): RootState;
    subscribe(listener: () => void): () => void;
    dispatch(action: UnknownAction): unknown;
}

/** The timing the ticker relies on; tests replace any part. */
export interface ClockTimers {
    /** A monotonic millisecond reading; only differences between readings mean anything. */
    readonly now: () => number;
    readonly setInterval: (callback: () => void, ms: number) => unknown;
    readonly clearInterval: (handle: unknown) => void;
}

export interface ClockTicker {
    /** Stops the interval and stops listening to the store; calling it again does nothing. */
    dispose(): void;
}

/** The timers at call time, so a test that installs fake timers after this module loaded still controls them. */
function globalTimers(): ClockTimers {
    return {
        now: () => performance.now(),
        setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
        clearInterval: (handle) => {
            globalThis.clearInterval(handle as ReturnType<typeof setInterval>);
        },
    };
}

/**
 * Drives the play clock (D12) by dispatching `accrued` with the current reading and whether the clock is eligible.
 * It ticks once when created, every 250 ms while it runs, and again whenever eligibility changes (route, sheet,
 * document visibility, start or win), so the anchor is set or cleared at the moment play starts or stops rather than up
 * to a tick later. `accrued` never changes eligibility, so the store listener cannot loop.
 *
 * `now` is `performance.now` by default, which is monotonic, so wall-clock changes do nothing.
 */
export function createClockTicker(store: ClockTickerStore, timers: Partial<ClockTimers> = {}): ClockTicker {
    const { now, setInterval, clearInterval } = { ...globalTimers(), ...timers };

    function tick(): void {
        store.dispatch(accrued({ atMs: now(), eligible: selectClockEligible(store.getState()) }));
    }

    let lastEligible = selectClockEligible(store.getState());
    tick();
    const interval = setInterval(tick, TICK_MS);
    const unsubscribe = store.subscribe(() => {
        const eligible = selectClockEligible(store.getState());
        if (eligible === lastEligible) return;
        lastEligible = eligible;
        // The state has already changed, so play that stopped is settled first as if still eligible: otherwise up to a
        // tick of play before the pause would be dropped when the anchor clears. A won game was settled by its command.
        if (!eligible && store.getState().game.current?.status === 'playing') {
            store.dispatch(accrued({ atMs: now(), eligible: true }));
        }
        tick();
    });

    let disposed = false;
    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            clearInterval(interval);
            unsubscribe();
        },
    };
}
