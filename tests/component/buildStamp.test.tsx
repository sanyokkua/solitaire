import { render, screen } from '@testing-library/react';
import { BuildStamp } from '../../src/ui/components/BuildStamp';

describe('BuildStamp', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the injected build timestamp as text with an accessible name', () => {
        vi.stubGlobal('__APP_BUILD_TIMESTAMP__', '2026-09-22T10:00:00Z');

        render(<BuildStamp />);

        const stamp = screen.getByText(/2026-09-22T10:00:00Z/);
        expect(stamp).toHaveAccessibleName();
    });

    it('renders the development placeholder when no build timestamp was supplied', () => {
        render(<BuildStamp />);

        expect(screen.getByText(/dev version/i)).toBeInTheDocument();
    });
});
