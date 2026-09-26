import { useState, useSyncExternalStore } from 'react';
import type { BoardSize } from './metrics';

/** A size change smaller than this many px, on both axes, is ignored. */
const MIN_CHANGE = 1;

interface SizeStore {
    /** Callback ref: observes the element, or stops observing when React passes `null` on unmount. */
    readonly attach: (el: Element | null) => void;
    readonly subscribe: (listener: () => void) => () => void;
    readonly getSnapshot: () => BoardSize | null;
}

/**
 * A `ResizeObserver`-fed external store for one element. The snapshot is `null` until the first entry arrives, and
 * stays `null` without `ResizeObserver`. It is replaced by a new object only for a real change, so
 * `useSyncExternalStore` keeps a stable identity between changes.
 */
function createSizeStore(): SizeStore {
    let snapshot: BoardSize | null = null;
    let observer: ResizeObserver | null = null;
    const listeners = new Set<() => void>();

    const accept = (width: number, height: number): void => {
        // Drift is measured from the last accepted size, so a slow sub-pixel creep still lands once it adds up.
        if (
            snapshot &&
            Math.abs(width - snapshot.width) < MIN_CHANGE &&
            Math.abs(height - snapshot.height) < MIN_CHANGE
        ) {
            return;
        }
        snapshot = { width, height };
        listeners.forEach((listener) => {
            listener();
        });
    };

    const attach = (el: Element | null): void => {
        observer?.disconnect();
        observer = null;
        if (el === null || typeof ResizeObserver === 'undefined') return;
        observer = new ResizeObserver((entries) => {
            // `contentRect` (not `getBoundingClientRect`) so tests can inject a size and CSS transforms are ignored.
            entries.forEach((entry) => {
                accept(entry.contentRect.width, entry.contentRect.height);
            });
        });
        observer.observe(el);
    };

    return {
        attach,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => snapshot,
    };
}

/**
 * The content size of the element the returned `ref` is attached to, or `null` until it is first measured (and
 * always `null` without `ResizeObserver`). The new size renders synchronously with the observer callback.
 */
export function useBoardSize(): { ref: (el: Element | null) => void; size: BoardSize | null } {
    const [store] = useState(createSizeStore);
    const size = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
    return { ref: store.attach, size };
}
