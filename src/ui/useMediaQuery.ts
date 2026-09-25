import { useCallback, useSyncExternalStore } from 'react';

/** Whether `query` currently matches, following live changes; `false` where `matchMedia` is missing. */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (listener: () => void) => {
            if (typeof window.matchMedia !== 'function') return () => undefined;
            const list = window.matchMedia(query);
            list.addEventListener('change', listener);
            return () => {
                list.removeEventListener('change', listener);
            };
        },
        [query],
    );
    const getSnapshot = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
