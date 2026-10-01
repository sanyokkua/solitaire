// covers: KS-I18N-01
import { describe, expect, it } from 'vitest';
import { createLocaleController, type LocaleControllerStore } from '../../../src/i18n/localeController';
import type { Locale } from '../../../src/i18n/catalog';

function fakeStore(initial: Locale): { store: LocaleControllerStore; setLocale: (locale: Locale) => void } {
    let locale = initial;
    const listeners = new Set<() => void>();
    const store: LocaleControllerStore = {
        getState: () => ({ preferences: { locale } }),
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
    return {
        store,
        setLocale: (next) => {
            locale = next;
            listeners.forEach((listener) => {
                listener();
            });
        },
    };
}

describe('createLocaleController', () => {
    it('sets lang and title at construction', () => {
        const root = document.createElement('html');
        const { store } = fakeStore('en');

        createLocaleController(store, root);

        expect(root.lang).toBe('en');
        expect(document.title).toBe('Solitaire');
    });

    it('updates lang and title on a locale change', () => {
        const root = document.createElement('html');
        const { store, setLocale } = fakeStore('en');
        createLocaleController(store, root);

        setLocale('uk');

        expect(root.lang).toBe('uk');
        expect(document.title).toBe('Пасьянс');
    });

    it('does nothing after dispose', () => {
        const root = document.createElement('html');
        const { store, setLocale } = fakeStore('en');
        const controller = createLocaleController(store, root);

        controller.dispose();
        setLocale('uk');

        expect(root.lang).toBe('en');
        expect(document.title).toBe('Solitaire');
    });

    it('is idempotent to dispose twice', () => {
        const root = document.createElement('html');
        const { store } = fakeStore('en');
        const controller = createLocaleController(store, root);

        expect(() => {
            controller.dispose();
            controller.dispose();
        }).not.toThrow();
    });
});
