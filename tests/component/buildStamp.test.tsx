import { screen } from '@testing-library/react';
import { BuildStamp } from '../../src/ui/components/BuildStamp';
import { renderWithStore } from '../support/renderWithStore';

describe('BuildStamp', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the injected build timestamp as text with an accessible name', () => {
        vi.stubGlobal('__APP_BUILD_TIMESTAMP__', '2026-09-22T10:00:00Z');

        renderWithStore(<BuildStamp />);

        const stamp = screen.getByText(/2026-09-22T10:00:00Z/);
        expect(stamp).toHaveAccessibleName();
    });

    it('renders the development placeholder when no build timestamp was supplied', () => {
        renderWithStore(<BuildStamp />);

        expect(screen.getByText(/dev version/i)).toBeInTheDocument();
    });

    it('renders a translated accessible name in Ukrainian', () => {
        vi.stubGlobal('__APP_BUILD_TIMESTAMP__', '2026-09-22T10:00:00Z');

        renderWithStore(<BuildStamp />, { preloadedState: { preferences: { locale: 'uk' } } });

        expect(screen.getByText(/Збірка: 2026-09-22T10:00:00Z/)).toBeInTheDocument();
    });
});
