import { describe, expect, it } from 'vitest';
import {
    defaultPreferences,
    preferencesReducer,
    preferencesReset,
    preferenceSet,
    selectPreference,
    selectPreferences,
    type Preferences,
} from '../../../../src/features/preferences/preferencesSlice';

const changes = [
    { key: 'theme', value: 'dark' },
    { key: 'nightCards', value: true },
    { key: 'fourColor', value: true },
    { key: 'cardBack', value: 'coral' },
    { key: 'tapMode', value: 'select' },
    { key: 'highlight', value: false },
    { key: 'autoSafe', value: true },
    { key: 'stockRight', value: true },
    { key: 'animations', value: false },
    { key: 'locale', value: 'uk' },
    { key: 'winnableOnly', value: false },
    { key: 'selectedMode', value: 'vegas' },
] as const;

describe('defaultPreferences (specification section 6)', () => {
    it('holds the specified defaults', () => {
        expect(defaultPreferences('en')).toEqual({
            theme: 'system',
            nightCards: false,
            fourColor: false,
            cardBack: 'harbour',
            tapMode: 'smart',
            highlight: true,
            autoSafe: false,
            stockRight: false,
            animations: true,
            locale: 'en',
            winnableOnly: true,
            selectedMode: 'draw1',
        });
    });

    it('takes the given locale', () => {
        expect(defaultPreferences('uk').locale).toBe('uk');
    });
});

describe('preferencesReducer', () => {
    it('starts from the English defaults', () => {
        expect(preferencesReducer(undefined, { type: 'unknown' })).toEqual(defaultPreferences('en'));
    });

    it('covers every preference key in the setter table', () => {
        expect(changes.map((c) => c.key).sort()).toEqual(Object.keys(defaultPreferences('en')).sort());
    });

    it.each(changes)('preferenceSet($key) changes only that key', (change) => {
        const before = defaultPreferences('en');
        const after = preferencesReducer(before, preferenceSet(change));
        expect(after).toEqual({ ...before, [change.key]: change.value });
    });

    it('preferencesReset restores the defaults with the given locale', () => {
        let state = defaultPreferences('en');
        for (const change of changes) {
            state = preferencesReducer(state, preferenceSet(change));
        }
        expect(state).not.toEqual(defaultPreferences('uk'));
        expect(preferencesReducer(state, preferencesReset('uk'))).toEqual(defaultPreferences('uk'));
    });

    it('does not mutate a frozen input state', () => {
        const before = Object.freeze(defaultPreferences('en'));
        const after = preferencesReducer(before, preferenceSet({ key: 'cardBack', value: 'coral' }));
        expect(after.cardBack).toBe('coral');
        expect(before.cardBack).toBe('harbour');
        expect(preferencesReducer(before, preferencesReset('uk')).locale).toBe('uk');
        expect(before.locale).toBe('en');
    });

    it('rejects a mismatched key and value at compile time', () => {
        // @ts-expect-error a boolean is not a Theme
        preferenceSet({ key: 'theme', value: true });
        // @ts-expect-error a Theme is not a boolean
        preferenceSet({ key: 'nightCards', value: 'dark' });
    });
});

describe('selectors', () => {
    const preferences: Preferences = { ...defaultPreferences('uk'), theme: 'dark' };

    it('selectPreferences returns the slice', () => {
        expect(selectPreferences({ preferences })).toBe(preferences);
    });

    it('selectPreference returns a single value', () => {
        expect(selectPreference({ preferences }, 'theme')).toBe('dark');
        expect(selectPreference({ preferences }, 'locale')).toBe('uk');
        expect(selectPreference({ preferences }, 'animations')).toBe(true);
    });
});
