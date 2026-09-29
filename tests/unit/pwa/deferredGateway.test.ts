// covers: KS-PWA-03
import { describe, expect, it, vi } from 'vitest';
import { createDeferredPwaGateway } from '../../../src/pwa/deferredGateway';
import type { PwaGateway } from '../../../src/pwa/pwaGateway';

function fakeWindow() {
    let onLoad: () => void = () => undefined;
    return {
        win: {
            addEventListener: vi.fn((_type: string, listener: () => void) => {
                onLoad = listener;
            }),
        },
        load: () => {
            onLoad();
        },
    };
}

function fakeRegister() {
    const listeners: (() => void)[] = [];
    const applyUpdate = vi.fn(() => Promise.resolve());
    const gateway: PwaGateway = { onUpdateReady: (callback) => listeners.push(callback), applyUpdate };
    return { register: vi.fn(() => gateway), listeners, applyUpdate };
}

describe('createDeferredPwaGateway', () => {
    it('registers only after the load event, never before', () => {
        const { win, load } = fakeWindow();
        const { register } = fakeRegister();

        createDeferredPwaGateway(win, { readyState: 'loading' }, register);
        expect(win.addEventListener).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
        expect(register).not.toHaveBeenCalled();

        load();
        expect(register).toHaveBeenCalledOnce();
    });

    it('registers at once when the document is already complete', () => {
        const { win } = fakeWindow();
        const { register } = fakeRegister();

        createDeferredPwaGateway(win, { readyState: 'complete' }, register);

        expect(register).toHaveBeenCalledOnce();
        expect(win.addEventListener).not.toHaveBeenCalled();
    });

    it('forwards update-ready listeners added before and after registration, and applyUpdate', async () => {
        const { win, load } = fakeWindow();
        const { register, listeners, applyUpdate } = fakeRegister();
        const gateway = createDeferredPwaGateway(win, { readyState: 'loading' }, register);
        const early = vi.fn();
        const late = vi.fn();

        gateway.onUpdateReady(early);
        await gateway.applyUpdate();
        expect(applyUpdate).not.toHaveBeenCalled();

        load();
        gateway.onUpdateReady(late);
        listeners.forEach((listener) => {
            listener();
        });
        await gateway.applyUpdate();

        expect(early).toHaveBeenCalledOnce();
        expect(late).toHaveBeenCalledOnce();
        expect(applyUpdate).toHaveBeenCalledOnce();
    });
});
