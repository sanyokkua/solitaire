import { act } from '@testing-library/react';

type Listener = (event: MediaQueryListEvent) => void;

/** The descriptor `tests/setup.ts` installed, captured before any test file replaces it. */
const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function install(value: (query: string) => unknown): void {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value });
}

/** Makes exactly the queries in `matching` match; nothing else does, and no listener ever fires. */
export function stubMatchMedia(matching: readonly string[]): void {
    install((query) => ({
        matches: matching.includes(query),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    }));
}

export interface ControllableMatchMedia {
    /** Sets whether `query` matches and fires its registered listeners inside `act`. */
    set(query: string, matches: boolean): void;
    /** How many `change` listeners are registered for `query`. */
    listenerCount(query: string): number;
}

/** Installs a `matchMedia` with one live fake per query; nothing matches until the test calls `set`. */
export function controllableMatchMedia(): ControllableMatchMedia {
    const fakes = new Map<string, { matches: boolean; readonly listeners: Set<Listener> }>();
    const fakeFor = (query: string) => {
        let fake = fakes.get(query);
        if (!fake) {
            fake = { matches: false, listeners: new Set() };
            fakes.set(query, fake);
        }
        return fake;
    };
    install((query) => {
        const fake = fakeFor(query);
        return {
            get matches() {
                return fake.matches;
            },
            media: query,
            addEventListener: (_type: string, listener: Listener) => {
                fake.listeners.add(listener);
            },
            removeEventListener: (_type: string, listener: Listener) => {
                fake.listeners.delete(listener);
            },
        };
    });
    return {
        set(query, matches) {
            const fake = fakeFor(query);
            fake.matches = matches;
            act(() => {
                fake.listeners.forEach((listener) => {
                    listener({ matches } as MediaQueryListEvent);
                });
            });
        },
        listenerCount: (query) => fakeFor(query).listeners.size,
    };
}

/** Puts back the `matchMedia` that `tests/setup.ts` installed; call it in `afterEach`. */
export function restoreMatchMedia(): void {
    if (originalDescriptor) Object.defineProperty(window, 'matchMedia', originalDescriptor);
    else Reflect.deleteProperty(window, 'matchMedia');
}
