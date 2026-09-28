import { describe, expect, it, vi } from 'vitest';
import { createInstallGateway } from '../../../src/pwa/installGateway';

function fakeWindow() {
    const target = new EventTarget();
    const win = {
        addEventListener: target.addEventListener.bind(target),
    } as Pick<Window, 'addEventListener'>;
    const offer = (outcome: 'accepted' | 'dismissed') => {
        const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
            prompt: vi.fn(() => Promise.resolve()),
            userChoice: Promise.resolve({ outcome }),
        });
        target.dispatchEvent(event);
        return event;
    };
    return { win, offer, install: () => target.dispatchEvent(new Event('appinstalled')) };
}

describe('createInstallGateway', () => {
    it('prevents the default mini-infobar and reports availability', () => {
        const { win, offer } = fakeWindow();
        const gateway = createInstallGateway(win);
        const callback = vi.fn();
        gateway.onAvailabilityChange(callback);
        const event = offer('accepted');
        expect(event.defaultPrevented).toBe(true);
        expect(callback).toHaveBeenCalledExactlyOnceWith(true);
    });

    it.each(['accepted', 'dismissed'] as const)('prompt() shows the stored event and resolves %s', async (outcome) => {
        const { win, offer } = fakeWindow();
        const gateway = createInstallGateway(win);
        const event = offer(outcome);
        await expect(gateway.prompt()).resolves.toBe(outcome);
        expect(event.prompt).toHaveBeenCalledTimes(1);
        await expect(gateway.prompt()).resolves.toBe('unavailable');
    });

    it('prompt() is unavailable when no event was captured', async () => {
        const { win } = fakeWindow();
        await expect(createInstallGateway(win).prompt()).resolves.toBe('unavailable');
    });

    it('appinstalled clears the availability', async () => {
        const { win, offer, install } = fakeWindow();
        const gateway = createInstallGateway(win);
        const callback = vi.fn();
        gateway.onAvailabilityChange(callback);
        offer('accepted');
        install();
        expect(callback).toHaveBeenLastCalledWith(false);
        await expect(gateway.prompt()).resolves.toBe('unavailable');
    });
});
