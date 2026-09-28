import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemMotionChanged } from '../../../src/app/appSlice';
import { createAppStore } from '../../../src/app/store';
import { createThemeController } from '../../../src/app/themeController';
import { preferenceSet } from '../../../src/features/preferences/preferencesSlice';
import { createMatchMedia } from '../../support/mediaQueryList';

const DARK_QUERY = '(prefers-color-scheme: dark)';

let root: HTMLElement;

beforeEach(() => {
    root = document.createElement('div');
});

afterEach(() => {
    vi.restoreAllMocks();
});

function setup(deviceDark: boolean) {
    const store = createAppStore();
    const dark = createMatchMedia({ [DARK_QUERY]: deviceDark });
    const matchMedia = vi.fn(dark.matchMedia);
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

        dark.set(DARK_QUERY, true);
        expect(root.getAttribute('data-theme')).toBe('dark');

        dark.set(DARK_QUERY, false);
        expect(root.getAttribute('data-theme')).toBe('light');
        expect(store.getState()).toBe(before);
    });

    it('ignores the device once a fixed theme is chosen', () => {
        const { store, dark } = setup(false);
        store.dispatch(preferenceSet({ key: 'theme', value: 'light' }));

        dark.set(DARK_QUERY, true);

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
        const matchMedia = createMatchMedia({ [DARK_QUERY]: true }, { withoutEventListener: true }).matchMedia;

        const controller = createThemeController(store, root, matchMedia);

        expect(root.getAttribute('data-theme')).toBe('dark');
        expect(() => {
            controller.dispose();
        }).not.toThrow();
    });

    it('subscribes to the dark query and removes the listener and the store subscription on dispose', () => {
        const { store, dark, matchMedia, controller } = setup(false);
        expect(matchMedia).toHaveBeenCalledWith(DARK_QUERY);
        expect(dark.listenerCount(DARK_QUERY)).toBe(1);

        controller.dispose();

        expect(dark.listenerCount(DARK_QUERY)).toBe(0);
        store.dispatch(preferenceSet({ key: 'cardBack', value: 'navy' }));
        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        dark.set(DARK_QUERY, true);
        expect(root.getAttribute('data-back')).toBe('harbour');
        expect(root.getAttribute('data-theme')).toBe('light');
    });
});
