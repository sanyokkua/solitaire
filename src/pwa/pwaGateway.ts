/** The subset of `registerSW` (vite-plugin-pwa) the gateway relies on. */
export type RegisterServiceWorker = (options: { onNeedRefresh: () => void }) => (reloadPage?: boolean) => Promise<void>;

export interface PwaGateway {
    /** Calls `callback` whenever a new service worker is waiting to take over. */
    onUpdateReady(callback: () => void): void;
    /** Activates the waiting service worker and reloads the page. */
    applyUpdate(): Promise<void>;
}

export function createPwaGateway(register: RegisterServiceWorker): PwaGateway {
    const listeners = new Set<() => void>();
    const updateSW = register({
        onNeedRefresh: () => {
            listeners.forEach((listener) => {
                listener();
            });
        },
    });
    return {
        onUpdateReady(callback) {
            listeners.add(callback);
        },
        applyUpdate: () => updateSW(true),
    };
}
