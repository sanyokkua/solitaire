import type { PwaGateway } from './pwaGateway';

/**
 * An update gateway that exists at once but registers the service worker only after the page has loaded, so
 * registration never delays the first render (PERF-03). `register` is called on `load`, or immediately when the
 * document is already `complete`; until then `applyUpdate` has nothing to apply and resolves.
 */
export function createDeferredPwaGateway(
    win: Pick<Window, 'addEventListener'>,
    doc: Pick<Document, 'readyState'>,
    register: () => PwaGateway,
): PwaGateway {
    const listeners = new Set<() => void>();
    let gateway: PwaGateway | null = null;
    const start = (): void => {
        gateway = register();
        listeners.forEach((listener) => {
            gateway?.onUpdateReady(listener);
        });
    };
    if (doc.readyState === 'complete') start();
    else win.addEventListener('load', start, { once: true });

    return {
        onUpdateReady(callback) {
            listeners.add(callback);
            gateway?.onUpdateReady(callback);
        },
        applyUpdate: () => gateway?.applyUpdate() ?? Promise.resolve(),
    };
}
