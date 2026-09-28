import type { UnknownAction } from '@reduxjs/toolkit';

/**
 * A store as a listener needs it: structurally, so this module needs no runtime import of the store. The real store
 * from `createAppStore` satisfies it for any `State`.
 */
export interface SubscribableStore<State> {
    getState(): State;
    subscribe(listener: () => void): () => void;
    dispatch(action: UnknownAction): unknown;
}

/** Every timer primitive a ticker or a writer might need, read at call time so fake timers installed later still apply. */
export interface GlobalTimers {
    /** A monotonic millisecond reading; only differences between readings mean anything. */
    readonly now: () => number;
    readonly setTimeout: (callback: () => void, ms: number) => unknown;
    readonly clearTimeout: (handle: unknown) => void;
    readonly setInterval: (callback: () => void, ms: number) => unknown;
    readonly clearInterval: (handle: unknown) => void;
}

/** The real timers, looked up at call time so a test that installs fake timers after this module loaded still controls them. */
export function globalTimers(): GlobalTimers {
    return {
        now: () => performance.now(),
        setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
        clearTimeout: (handle) => {
            globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
        },
        setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
        clearInterval: (handle) => {
            globalThis.clearInterval(handle as ReturnType<typeof setInterval>);
        },
    };
}
