import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { CATALOGS, type Locale } from './catalog';
import { createTranslator, type Translate } from './translate';

/** The narrow slice of state `useTranslate` reads: just the active locale. */
interface LocaleState {
    readonly preferences: { readonly locale: Locale };
}

/**
 * Returns `t`, memoised so it changes only when the active locale changes. The only React-aware i18n module (D1);
 * every other `src/i18n` file is a plain function of its inputs.
 */
export function useTranslate(): Translate {
    const locale = useSelector((state: LocaleState) => state.preferences.locale);
    return useMemo(() => createTranslator(locale, CATALOGS[locale].catalog, CATALOGS.en.catalog), [locale]);
}
