import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { preferenceSet } from '../../src/features/preferences/preferencesSlice';
import { startApp, type StartAppDeps } from '../../src/app/lifecycle';
import { selectResumable } from '../../src/features/game/gameSlice';
import { STORAGE_KEY, decodeRecord, encodeRecord } from '../../src/features/persistence/recordCodec';
import { createStorageGateway } from '../../src/features/persistence/storageGateway';
import { defaultPreferences } from '../../src/features/preferences/preferencesSlice';
import { statsReducer } from '../../src/features/stats/statsSlice';
import { fakeDealService } from '../fixtures/dealService';
import { playedGame } from '../fixtures/games';
import { memoryStorage, type MemoryStorage } from '../fixtures/storage';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** A `matchMedia` result the test can flip: it records its listeners and can fire a `change` event. */
type MediaListener = (event: { matches: boolean }) => void;

interface FakeMediaQuery {
    matches: boolean;
    readonly addEventListener: Mock<(type: string, listener: MediaListener) => void>;
    readonly removeEventListener: Mock<(type: string, listener: MediaListener) => void>;
    change(matches: boolean): void;
}

function fakeMediaQuery(matches: boolean): FakeMediaQuery {
    const listeners = new Set<MediaListener>();
    const query: FakeMediaQuery = {
        matches,
        addEventListener: vi.fn((_type: string, listener: MediaListener) => {
            listeners.add(listener);
        }),
        removeEventListener: vi.fn((_type: string, listener: MediaListener) => {
            listeners.delete(listener);
        }),
        change: (next) => {
            query.matches = next;
            listeners.forEach((listener) => {
                listener({ matches: next });
            });
        },
    };
    return query;
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/** Replaces `window.matchMedia` (or removes it); `afterEach` puts the setup file's stub back. */
function installMatchMedia(query: FakeMediaQuery | undefined): Mock<() => FakeMediaQuery | undefined> {
    const matchMedia = vi.fn(() => query);
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: query === undefined ? undefined : matchMedia,
    });
    return matchMedia;
}

/** Makes `document.visibilityState` read `state`; `afterEach` removes the override. */
function stubVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

function fireVisibilityChange(state: DocumentVisibilityState): void {
    stubVisibility(state);
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
    });
}

interface Started {
    readonly app: ReturnType<typeof startApp>;
    readonly root: HTMLElement;
    readonly storage: MemoryStorage;
    readonly setInterval: ReturnType<typeof vi.fn>;
    readonly clearInterval: ReturnType<typeof vi.fn>;
}

const started: Started[] = [];

/** Starts the app over an in-memory storage and inert timers; `afterEach` disposes it. */
function start(storage: MemoryStorage = memoryStorage(), overrides: StartAppDeps = {}): Started {
    const root = document.createElement('div');
    document.body.append(root);
    const setInterval = vi.fn(() => 'ticker-handle');
    const clearInterval = vi.fn();
    let app: ReturnType<typeof startApp> | undefined;
    act(() => {
        app = startApp(root, {
            extra: { gateway: createStorageGateway(storage), dealService: fakeDealService(), ...overrides.extra },
            ticker: { setInterval, clearInterval, ...overrides.ticker },
            ...(overrides.writer === undefined ? {} : { writer: overrides.writer }),
        });
    });
    if (app === undefined) throw new Error('startApp did not return');
    const result: Started = { app, root, storage, setInterval, clearInterval };
    started.push(result);
    return result;
}

function storedRecord(storage: MemoryStorage) {
    const raw = storage.getItem(STORAGE_KEY);
    return raw === null ? null : decodeRecord(raw);
}

beforeEach(() => {
    installMatchMedia(fakeMediaQuery(false));
});

afterEach(() => {
    act(() => {
        started.splice(0).forEach(({ app, root }) => {
            app.dispose();
            root.remove();
        });
    });
    Reflect.deleteProperty(document, 'visibilityState');
    if (originalMatchMedia === undefined) Reflect.deleteProperty(window, 'matchMedia');
    else Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    vi.restoreAllMocks();
});

describe('application lifecycle wiring', () => {
    it('starts with documentVisible following document.visibilityState', () => {
        stubVisibility('hidden');
        const hidden = start();
        expect(hidden.app.store.getState().app.documentVisible).toBe(false);

        stubVisibility('visible');
        const visible = start();
        expect(visible.app.store.getState().app.documentVisible).toBe(true);
    });

    it('flushes a pending write and tracks visibility when the document becomes hidden', () => {
        const { app, storage } = start();
        act(() => {
            app.store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        });
        expect(storage.getItem(STORAGE_KEY)).toBeNull();

        fireVisibilityChange('hidden');

        expect(app.store.getState().app.documentVisible).toBe(false);
        const stored = storedRecord(storage);
        expect(stored?.ok && stored.record.preferences.theme).toBe('dark');

        fireVisibilityChange('visible');
        expect(app.store.getState().app.documentVisible).toBe(true);
    });

    it('flushes a pending write on pagehide', () => {
        const { app, storage } = start();
        act(() => {
            app.store.dispatch(preferenceSet({ key: 'cardBack', value: 'coral' }));
        });
        expect(storage.getItem(STORAGE_KEY)).toBeNull();

        act(() => {
            window.dispatchEvent(new Event('pagehide'));
        });

        const stored = storedRecord(storage);
        expect(stored?.ok && stored.record.preferences.cardBack).toBe('coral');
    });

    it('follows the reduced-motion media query, honours its initial value and copes with none', () => {
        const query = fakeMediaQuery(true);
        const matchMedia = installMatchMedia(query);
        const { app } = start();
        expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
        expect(app.store.getState().app.systemReducedMotion).toBe(true);

        act(() => {
            query.change(false);
        });
        expect(app.store.getState().app.systemReducedMotion).toBe(false);
        act(() => {
            query.change(true);
        });
        expect(app.store.getState().app.systemReducedMotion).toBe(true);

        installMatchMedia(undefined);
        const bare = start();
        expect(bare.app.store.getState().app.systemReducedMotion).toBe(false);
        expect(bare.root.querySelector('button')).not.toBeNull();
    });

    it('removes every listener and timer on dispose and writes nothing afterwards', () => {
        const query = fakeMediaQuery(false);
        installMatchMedia(query);
        const documentAdd = vi.spyOn(document, 'addEventListener');
        const documentRemove = vi.spyOn(document, 'removeEventListener');
        const windowAdd = vi.spyOn(window, 'addEventListener');
        const windowRemove = vi.spyOn(window, 'removeEventListener');
        const { app, storage, root, setInterval, clearInterval } = start();
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 250);

        act(() => {
            app.dispose();
        });

        const visibilityListener = documentAdd.mock.calls.find(([type]) => type === 'visibilitychange')?.[1];
        const pageHideListener = windowAdd.mock.calls.find(([type]) => type === 'pagehide')?.[1];
        const changeListener = query.addEventListener.mock.calls[0]?.[1];
        expect(visibilityListener).toBeTypeOf('function');
        expect(pageHideListener).toBeTypeOf('function');
        expect(changeListener).toBeTypeOf('function');
        expect(documentRemove).toHaveBeenCalledWith('visibilitychange', visibilityListener);
        expect(windowRemove).toHaveBeenCalledWith('pagehide', pageHideListener);
        expect(query.removeEventListener).toHaveBeenCalledWith('change', changeListener);
        expect(clearInterval).toHaveBeenCalledWith('ticker-handle');
        expect(root.childElementCount).toBe(0);

        app.store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        fireVisibilityChange('hidden');
        act(() => {
            window.dispatchEvent(new Event('pagehide'));
            query.change(true);
        });
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
        expect(app.store.getState().app.documentVisible).toBe(true);
        expect(app.store.getState().app.systemReducedMotion).toBe(false);

        expect(() => {
            act(() => {
                app.dispose();
            });
        }).not.toThrow();
    });

    it('disposes the deal service on dispose', () => {
        const dealService = fakeDealService();
        const { app } = start(memoryStorage(), { extra: { dealService } });
        expect(dealService.disposed).toBe(false);

        act(() => {
            app.dispose();
        });

        expect(dealService.disposed).toBe(true);
    });

    it('accrues the ticker from the store clock when no ticker clock is given', () => {
        const now = vi.fn(() => 5000);

        start(memoryStorage(), { extra: { now } });

        expect(now).toHaveBeenCalled();
    });

    it('raises the loader notices and starts on Home with a saved game resumable', () => {
        const corrupt = memoryStorage();
        corrupt.setItem(STORAGE_KEY, 'not json');
        const broken = start(corrupt);
        expect(broken.app.store.getState().app.notices).toEqual([{ id: 'storage-read' }]);

        const saved = memoryStorage();
        saved.setItem(
            STORAGE_KEY,
            encodeRecord({
                preferences: defaultPreferences('en'),
                stats: statsReducer(undefined, { type: '@@init' }),
                game: playedGame(),
            }),
        );
        const resumed = start(saved);
        const state = resumed.app.store.getState();
        expect(state.app.route).toBe('home');
        expect(selectResumable(state)).toBe(true);
        expect(state.app.notices).toEqual([]);
    });

    it('renders the Home screen into the root', async () => {
        const { root } = start();

        expect(await screen.findByRole('button', { name: /deal cards/i })).toBeInTheDocument();
        expect(root).toContainElement(screen.getByRole('button', { name: /deal cards/i }));
    });
});
