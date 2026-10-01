import { act } from '@testing-library/react';
import { createMatchMedia, type MediaQueryListOptions } from './mediaQueryList';

/** The descriptor `tests/setup.ts` installed, captured before any test file replaces it. */
const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function install(value: ((query: string) => unknown) | undefined): void {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value });
}

/** Makes exactly the queries in `matching` match; nothing else does, and no listener ever fires. */
export function stubMatchMedia(matching: readonly string[]): void {
    install(createMatchMedia(Object.fromEntries(matching.map((query) => [query, true]))).matchMedia);
}

export interface ControllableMatchMedia {
    /** Sets whether `query` matches and fires its registered listeners inside `act`. */
    set(query: string, matches: boolean): void;
    /** How many `change` listeners are registered for `query`. */
    listenerCount(query: string): number;
}

/**
 * Installs a `matchMedia` with one live fake per query. Only the queries in `initial` match (when true) until the test
 * calls `set`; `options.withoutEventListener` gives lists that have no `addEventListener`.
 */
export function controllableMatchMedia(
    initial: Readonly<Record<string, boolean>> = {},
    options: MediaQueryListOptions = {},
): ControllableMatchMedia {
    const fake = createMatchMedia(initial, options);
    install(fake.matchMedia);
    return {
        set(query, matches) {
            act(() => {
                fake.set(query, matches);
            });
        },
        listenerCount: (query) => fake.listenerCount(query),
    };
}

/** Removes `window.matchMedia`, as an environment without it; `restoreMatchMedia` puts the setup one back. */
export function removeMatchMedia(): void {
    install(undefined);
}

/** Puts back the `matchMedia` that `tests/setup.ts` installed; call it in `afterEach`. */
export function restoreMatchMedia(): void {
    if (originalDescriptor) Object.defineProperty(window, 'matchMedia', originalDescriptor);
    else Reflect.deleteProperty(window, 'matchMedia');
}
