import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Mode } from '../../domain/types';
import type { Locale } from './locale';

export type Theme = 'light' | 'dark' | 'system';
export type CardBack = 'harbour' | 'navy' | 'sky' | 'coral';
export type TapMode = 'smart' | 'select';

export interface Preferences {
    readonly theme: Theme;
    readonly nightCards: boolean;
    readonly fourColor: boolean;
    readonly cardBack: CardBack;
    readonly tapMode: TapMode;
    readonly highlight: boolean;
    readonly autoSafe: boolean;
    readonly stockRight: boolean;
    readonly animations: boolean;
    readonly locale: Locale;
    readonly winnableOnly: boolean;
    readonly selectedMode: Mode;
}

/** One key with a value of that key's own type, so a mismatched pair fails typechecking. */
export type PreferenceChange = {
    [K in keyof Preferences]: { readonly key: K; readonly value: Preferences[K] };
}[keyof Preferences];

/** The defaults of specification section 6; only the language depends on the browser. */
export function defaultPreferences(locale: Locale): Preferences {
    return {
        theme: 'system',
        nightCards: false,
        fourColor: false,
        cardBack: 'harbour',
        tapMode: 'smart',
        highlight: true,
        autoSafe: false,
        stockRight: false,
        animations: true,
        locale,
        winnableOnly: true,
        selectedMode: 'draw1',
    };
}

const preferencesSlice = createSlice({
    name: 'preferences',
    initialState: defaultPreferences('en'),
    reducers: {
        preferenceSet: (state, action: PayloadAction<PreferenceChange>) => ({
            ...state,
            [action.payload.key]: action.payload.value,
        }),
        preferencesReset: (_state, action: PayloadAction<Locale>) => defaultPreferences(action.payload),
    },
});

export const { preferenceSet, preferencesReset } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;

export const selectPreferences = (state: { readonly preferences: Preferences }): Preferences => state.preferences;

export const selectPreference = <K extends keyof Preferences>(
    state: { readonly preferences: Preferences },
    key: K,
): Preferences[K] => state.preferences[key];
