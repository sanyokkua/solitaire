import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { preferenceSet } from '../../src/features/preferences/preferencesSlice';
import { useTranslate } from '../../src/i18n/useTranslate';
import { renderWithStore } from '../support/renderWithStore';

function Greeting() {
    const t = useTranslate();
    return <p>{t('home.deal')}</p>;
}

describe('useTranslate', () => {
    it('renders text in the store locale and re-renders when it changes', () => {
        const { getByText, store } = renderWithStore(<Greeting />);
        expect(getByText('Deal cards')).toBeInTheDocument();

        act(() => {
            store.dispatch(preferenceSet({ key: 'locale', value: 'uk' }));
        });

        expect(getByText('Роздати карти')).toBeInTheDocument();
    });
});
