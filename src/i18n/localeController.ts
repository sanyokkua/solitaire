import { CATALOGS, type Locale } from './catalog';
import { createTranslator } from './translate';

/** The narrow shape `createLocaleController` reads: a store's current state and a way to be told about changes. */
export interface LocaleControllerStore {
    getState(): { readonly preferences: { readonly locale: Locale } };
    subscribe(listener: () => void): () => void;
}

/** The running controller: `dispose()` stops it following the store. */
export interface LocaleController {
    dispose(): void;
}

/**
 * Sets `root.lang` and `document.title` to the active locale's code and app-title message, at construction and on
 * every store change where the locale differs from the one last applied (LO "The document follows the active
 * language"). Follows `themeController`'s shape.
 */
export function createLocaleController(store: LocaleControllerStore, root: HTMLElement): LocaleController {
    let lastLocale: Locale | undefined;

    const apply = (): void => {
        const locale = store.getState().preferences.locale;
        if (locale === lastLocale) return;
        lastLocale = locale;
        if (root.lang !== locale) root.lang = locale;
        const t = createTranslator(locale, CATALOGS[locale].catalog, CATALOGS.en.catalog);
        document.title = t('app.title');
    };

    apply();
    const unsubscribe = store.subscribe(apply);

    let disposed = false;
    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            unsubscribe();
        },
    };
}
