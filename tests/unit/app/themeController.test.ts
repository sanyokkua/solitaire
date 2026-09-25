import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemMotionChanged } from '../../../src/app/appSlice';
import { createAppStore } from '../../../src/app/store';
import { createThemeController } from '../../../src/app/themeController';
import { preferenceSet } from '../../../src/features/preferences/preferencesSlice';

const DARK_QUERY = '(prefers-color-scheme: dark)';

type MediaListener = (event: { matches: boolean }) => void;

/** A controllable `matchMedia` result that records its listeners and can fire a `change` event. */
interface FakeQuery {
    matches: boolean;
    readonly listeners: Set<MediaListener>;
    change(matches: boolean): void;
}

function fakeQuery(matches: boolean): FakeQuery {
    const listeners = new Set<MediaListener>();
    const query: FakeQuery = {
        matches,
        listeners,
        change: (next) => {
            query.matches = next;
            listeners.forEach((listener) => {
                listener({ matches: next });
            });
        },
    };
    return query;
}

/** A `matchMedia` with one fake per query string; only the dark-scheme query is of interest to the controller. */
function fakeMatchMedia(dark: FakeQuery) {
    const other = fakeQuery(false);
    const queries = new Map<string, FakeQuery>([[DARK_QUERY, dark]]);
    return vi.fn((query: string) => {
        const fake = queries.get(query) ?? other;
        return {
            get matches() {
                return fake.matches;
            },
            media: query,
            addEventListener: (_type: string, listener: MediaListener) => {
                fake.listeners.add(listener);
            },
            removeEventListener: (_type: string, listener: MediaListener) => {
                fake.listeners.delete(listener);
            },
        } as unknown as MediaQueryList;
    });
}

let root: HTMLElement;

beforeEach(() => {
    root = document.createElement('div');
});

afterEach(() => {
    vi.restoreAllMocks();
});

function setup(deviceDark: boolean) {
    const store = createAppStore();
    const dark = fakeQuery(deviceDark);
    const matchMedia = fakeMatchMedia(dark);
    const controller = createThemeController(store, root, matchMedia);
    return { store, dark, matchMedia, controller };
}

describe('createThemeController', () => {
    it('writes the default appearance before anything changes', () => {
        setup(false);

        expect(root.getAttribute('data-theme')).toBe('light');
        expect(root.getAttribute('data-night-cards')).toBe('false');
        expect(root.getAttribute('data-four-color')).toBe('false');
        expect(root.getAttribute('data-back')).toBe('harbour');
        expect(root.getAttribute('data-motion')).toBe('on');
    });

    it('applies Dark regardless of the device', () => {
        const { store } = setup(false);

        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));

        expect(root.getAttribute('data-theme')).toBe('dark');
    });

    it('applies Light regardless of the device', () => {
        const { store } = setup(true);
        expect(root.getAttribute('data-theme')).toBe('dark');

        store.dispatch(preferenceSet({ key: 'theme', value: 'light' }));

        expect(root.getAttribute('data-theme')).toBe('light');
    });

    it('lets System follow the device live without touching the store', () => {
        const { store, dark } = setup(false);
        const before = store.getState();
        expect(root.getAttribute('data-theme')).toBe('light');

        dark.change(true);
        expect(root.getAttribute('data-theme')).toBe('dark');

        dark.change(false);
        expect(root.getAttribute('data-theme')).toBe('light');
        expect(store.getState()).toBe(before);
    });

    it('ignores the device once a fixed theme is chosen', () => {
        const { store, dark } = setup(false);
        store.dispatch(preferenceSet({ key: 'theme', value: 'light' }));

        dark.change(true);

        expect(root.getAttribute('data-theme')).toBe('light');
    });

    it('applies the night-card, four-colour and card-back preferences', () => {
        const { store } = setup(false);

        store.dispatch(preferenceSet({ key: 'nightCards', value: true }));
        store.dispatch(preferenceSet({ key: 'fourColor', value: true }));
        store.dispatch(preferenceSet({ key: 'cardBack', value: 'coral' }));

        expect(root.getAttribute('data-night-cards')).toBe('true');
        expect(root.getAttribute('data-four-color')).toBe('true');
        expect(root.getAttribute('data-back')).toBe('coral');

        store.dispatch(preferenceSet({ key: 'nightCards', value: false }));
        expect(root.getAttribute('data-night-cards')).toBe('false');
    });

    it('turns motion off with the Animations preference and back on again', () => {
        const { store } = setup(false);

        store.dispatch(preferenceSet({ key: 'animations', value: false }));
        expect(root.getAttribute('data-motion')).toBe('off');

        store.dispatch(preferenceSet({ key: 'animations', value: true }));
        expect(root.getAttribute('data-motion')).toBe('on');
    });

    it('turns motion off when the device requests reduced motion and on when it stops, without a reload', () => {
        const { store } = setup(false);

        store.dispatch(systemMotionChanged(true));
        expect(root.getAttribute('data-motion')).toBe('off');

        store.dispatch(systemMotionChanged(false));
        expect(root.getAttribute('data-motion')).toBe('on');
    });

    it('writes an attribute only when its value changes', () => {
        const { store } = setup(false);
        const setAttribute = vi.spyOn(root, 'setAttribute');

        store.dispatch(preferenceSet({ key: 'tapMode', value: 'select' }));
        expect(setAttribute).not.toHaveBeenCalled();

        store.dispatch(preferenceSet({ key: 'cardBack', value: 'sky' }));
        expect(setAttribute).toHaveBeenCalledTimes(1);
        expect(setAttribute).toHaveBeenCalledWith('data-back', 'sky');
    });

    it('resolves System to light and does not throw without matchMedia', () => {
        const store = createAppStore();

        const controller = createThemeController(store, root, undefined);

        expect(root.getAttribute('data-theme')).toBe('light');
        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        expect(root.getAttribute('data-theme')).toBe('dark');
        expect(() => {
            controller.dispose();
        }).not.toThrow();
    });

    it('tolerates a media query without addEventListener', () => {
        const store = createAppStore();
        const matchMedia = vi.fn(() => ({ matches: true, media: DARK_QUERY }) as unknown as MediaQueryList);

        const controller = createThemeController(store, root, matchMedia);

        expect(root.getAttribute('data-theme')).toBe('dark');
        expect(() => {
            controller.dispose();
        }).not.toThrow();
    });

    it('subscribes to the dark query and removes the listener and the store subscription on dispose', () => {
        const { store, dark, matchMedia, controller } = setup(false);
        expect(matchMedia).toHaveBeenCalledWith(DARK_QUERY);
        expect(dark.listeners.size).toBe(1);

        controller.dispose();

        expect(dark.listeners.size).toBe(0);
        store.dispatch(preferenceSet({ key: 'cardBack', value: 'navy' }));
        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        dark.change(true);
        expect(root.getAttribute('data-back')).toBe('harbour');
        expect(root.getAttribute('data-theme')).toBe('light');
    });
});
