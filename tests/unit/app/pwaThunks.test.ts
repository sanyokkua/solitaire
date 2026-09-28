import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installableChanged } from '../../../src/app/appSlice';
import { applyUpdate, installApp } from '../../../src/app/pwaThunks';
import { createSavePort } from '../../../src/app/savePort';
import { dealFromSeed } from '../../../src/domain/deal';
import { installed } from '../../../src/features/game/gameSlice';
import { play } from '../../../src/features/game/gameThunks';
import { createPersistenceWriter } from '../../../src/features/persistence/persistenceWriter';
import { STORAGE_KEY } from '../../../src/features/persistence/recordCodec';
import { createStorageGateway } from '../../../src/features/persistence/storageGateway';
import { preferenceSet } from '../../../src/features/preferences/preferencesSlice';
import { WINNING_LINE, parseLine } from '../../fixtures/deals';
import { memoryStorage } from '../../fixtures/storage';
import { testStore } from '../../support/testStore';

function setup(
    overrides: {
        flush?: () => void;
        promptInstall?: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
        readOnly?: boolean;
    } = {},
) {
    const calls: string[] = [];
    const flushQuietly = vi.fn(() => {
        calls.push('flush');
        overrides.flush?.();
    });
    const applyUpdateOnPwa = vi.fn(() => {
        calls.push('applyUpdate');
        return Promise.resolve();
    });
    const promptInstall = vi.fn(overrides.promptInstall ?? (() => Promise.resolve('accepted' as const)));
    const store = testStore({
        preloadedState: overrides.readOnly === true ? { persistence: { readOnly: true, lastError: 'read' } } : {},
        deps: {
            saver: { flush: () => undefined, flushQuietly, cancel: () => undefined },
            pwa: { applyUpdate: applyUpdateOnPwa, promptInstall },
        },
    });
    return { store, calls, flushQuietly, applyUpdateOnPwa, promptInstall };
}

describe('applyUpdate', () => {
    it('flushes the pending save before applying the update', async () => {
        const { store, calls } = setup();

        await store.dispatch(applyUpdate());

        expect(calls).toEqual(['flush', 'applyUpdate']);
    });

    it('still applies when persistence is read-only and the flush writes nothing', async () => {
        const { store, calls } = setup({ readOnly: true });
        expect(store.getState().persistence.readOnly).toBe(true);

        await store.dispatch(applyUpdate());

        expect(calls).toEqual(['flush', 'applyUpdate']);
    });

    it('still applies when the flush throws', async () => {
        const { store, applyUpdateOnPwa } = setup({
            flush: () => {
                throw new Error('quota');
            },
        });

        await store.dispatch(applyUpdate());

        expect(applyUpdateOnPwa).toHaveBeenCalledOnce();
    });
});

describe('installApp', () => {
    it('clears installable only after the prompt resolves', async () => {
        let resolve: (outcome: 'dismissed') => void = () => undefined;
        const { store, promptInstall } = setup({
            promptInstall: () =>
                new Promise((done) => {
                    resolve = done;
                }),
        });
        store.dispatch(installableChanged(true));

        const pending = store.dispatch(installApp());
        expect(promptInstall).toHaveBeenCalledOnce();
        expect(store.getState().app.installable).toBe(true);

        resolve('dismissed');
        await pending;
        expect(store.getState().app.installable).toBe(false);
    });

    it('clears installable and does not throw when the prompt rejects', async () => {
        const { store } = setup({ promptInstall: () => Promise.reject(new Error('prompt failed')) });
        store.dispatch(installableChanged(true));

        await expect(store.dispatch(installApp())).resolves.toBeUndefined();

        expect(store.getState().app.installable).toBe(false);
    });
});

describe('applyUpdate with the real writer over a storage that fails (PW "Updates apply only when the player chooses")', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    /** A real store, saver and writer over an in-memory storage, with one move played and its save still pending. */
    async function pending(readOnly = false) {
        const storage = memoryStorage();
        const gateway = createStorageGateway(storage);
        const saver = createSavePort();
        const applyOnPwa = vi.fn(() => Promise.resolve());
        const store = testStore({
            preloadedState: readOnly ? { persistence: { readOnly: true, lastError: 'read' } } : {},
            deps: {
                now: () => Date.now(),
                gateway,
                saver,
                pwa: { applyUpdate: applyOnPwa, promptInstall: () => Promise.resolve('unavailable' as const) },
            },
        });
        store.dispatch(preferenceSet({ key: 'autoSafe', value: false }));
        store.dispatch(installed({ state: dealFromSeed(WINNING_LINE.seed, 'draw1'), dailyKey: null }));
        const writer = createPersistenceWriter(store, gateway, { now: () => Date.now() });
        saver.connect(writer);
        const first = parseLine(WINNING_LINE.line)[0];
        if (first === undefined) throw new Error('no move');
        await store.dispatch(play(first));
        return { store, storage, applyOnPwa, writer };
    }

    it('proceeds when saving is read-only: nothing is written and the update still applies', async () => {
        const { store, storage, applyOnPwa, writer } = await pending(true);

        await store.dispatch(applyUpdate());

        expect(applyOnPwa).toHaveBeenCalledOnce();
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
        expect(store.getState().app.notices).toEqual([]);
        writer.dispose();
    });

    it('adds no warning when the save requested at Update fails for the first time', async () => {
        const { store, storage, applyOnPwa, writer } = await pending();
        storage.failWrites = true;
        expect(store.getState().persistence.lastError).toBeNull();

        await store.dispatch(applyUpdate());

        expect(applyOnPwa).toHaveBeenCalledOnce();
        expect(store.getState().persistence.lastError).toBeNull();
        expect(store.getState().app.notices).toEqual([]);
        writer.dispose();
    });

    it('saves the game at Update when the storage works', async () => {
        const { store, storage, applyOnPwa, writer } = await pending();

        await store.dispatch(applyUpdate());

        expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
        expect(applyOnPwa).toHaveBeenCalledOnce();
        expect(store.getState().app.notices).toEqual([]);
        writer.dispose();
    });
});
