// covers: KS-GEN-11

import { screen } from '@testing-library/react';
import { BuildStamp } from '../../src/ui/components/BuildStamp';
import { renderWithStore } from '../support/renderWithStore';

describe('BuildStamp', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows the build number and UTC time with an accessible name that matches the text', () => {
        renderWithStore(<BuildStamp />);

        const stamp = screen.getByText('App build: Build 57 · 2026-09-28 14:03 UTC');
        expect(stamp).toHaveAccessibleName('App build: Build 57 · 2026-09-28 14:03 UTC');
    });

    it('shows the development label with the time when there is no build number', () => {
        vi.stubGlobal('__APP_BUILD__', { number: null, time: '2026-09-28 14:03 UTC' });

        renderWithStore(<BuildStamp />);

        expect(screen.getByText('App build: Development build · 2026-09-28 14:03 UTC')).toBeInTheDocument();
    });

    it('changes only the surrounding words in Ukrainian; number and time read as in English', () => {
        renderWithStore(<BuildStamp />, { preloadedState: { preferences: { locale: 'uk' } } });

        expect(screen.getByText('Збірка: № 57 · 2026-09-28 14:03 UTC')).toBeInTheDocument();
    });

    it('translates the development label in Ukrainian', () => {
        vi.stubGlobal('__APP_BUILD__', { number: null, time: '2026-09-28 14:03 UTC' });

        renderWithStore(<BuildStamp />, { preloadedState: { preferences: { locale: 'uk' } } });

        expect(screen.getByText('Збірка: Тестова збірка · 2026-09-28 14:03 UTC')).toBeInTheDocument();
    });
});
