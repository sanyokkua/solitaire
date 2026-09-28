import '@testing-library/jest-dom/vitest';
import { createMediaQueryList } from './support/mediaQueryList';

// Test files that declare `// @vitest-environment node` have no `window`, so the DOM-only stub is skipped for them.
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        // Nothing matches; listeners are really registered and removed.
        value: (query: string) => createMediaQueryList(query),
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
