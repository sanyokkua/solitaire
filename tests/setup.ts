import '@testing-library/jest-dom/vitest';

type MediaListener = (event: MediaQueryListEvent) => void;

/** A query-aware `matchMedia` result: nothing matches, and listeners are really registered and removed. */
function stubMediaQueryList(query: string): MediaQueryList {
    const listeners = new Set<MediaListener>();
    const list = {
        matches: false,
        media: query,
        onchange: null,
        addListener: (listener: MediaListener) => {
            listeners.add(listener);
        },
        removeListener: (listener: MediaListener) => {
            listeners.delete(listener);
        },
        addEventListener: (_type: string, listener: MediaListener) => {
            listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: MediaListener) => {
            listeners.delete(listener);
        },
        dispatchEvent: (event: Event) => {
            listeners.forEach((listener) => {
                listener(event as MediaQueryListEvent);
            });
            return true;
        },
    };
    return list as unknown as MediaQueryList;
}

// Test files that declare `// @vitest-environment node` have no `window`, so the DOM-only stub is skipped for them.
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => stubMediaQueryList(query),
    });

    // jsdom has no `ResizeObserver`. This stub never reports a size, so `Board` shows its empty panel; it is writable and
    // configurable, so tests that need real entries (or none) replace it with `vi.stubGlobal('ResizeObserver', ...)`.
    Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: class InertResizeObserver {
            observe = (): void => undefined;
            unobserve = (): void => undefined;
            disconnect = (): void => undefined;
        },
    });
}
