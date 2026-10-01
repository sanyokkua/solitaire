// covers: KS-PWA-03
import { describe, expect, it, vi } from 'vitest';
import { createPwaGateway, type RegisterServiceWorker } from '../../../src/pwa/pwaGateway';

function fakeRegister() {
    const updateSW = vi.fn(() => Promise.resolve());
    let needRefresh: () => void = () => undefined;
    const register: RegisterServiceWorker = (options) => {
        needRefresh = options.onNeedRefresh;
        return updateSW;
    };
    return {
        register,
        updateSW,
        fireNeedRefresh: () => {
            needRefresh();
        },
    };
}

describe('createPwaGateway', () => {
    it('notifies listeners when a new worker is waiting', () => {
        const { register, fireNeedRefresh } = fakeRegister();
        const gateway = createPwaGateway(register);
        const callback = vi.fn();
        gateway.onUpdateReady(callback);
        expect(callback).not.toHaveBeenCalled();
        fireNeedRefresh();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('applyUpdate activates the waiting worker with updateSW(true)', async () => {
        const { register, updateSW } = fakeRegister();
        await createPwaGateway(register).applyUpdate();
        expect(updateSW).toHaveBeenCalledExactlyOnceWith(true);
    });
});
