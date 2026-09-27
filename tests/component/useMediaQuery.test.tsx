import { render, screen } from '@testing-library/react';
import { useMediaQuery } from '../../src/ui/useMediaQuery';
import { controllableMatchMedia, restoreMatchMedia, type ControllableMatchMedia } from '../support/matchMedia';

const COARSE = '(pointer: coarse)';
let media: ControllableMatchMedia;

function Probe({ query = COARSE }: { query?: string }) {
    return <div data-testid="m">{String(useMediaQuery(query))}</div>;
}

beforeEach(() => {
    media = controllableMatchMedia();
});

afterEach(() => {
    restoreMatchMedia();
});

describe('useMediaQuery', () => {
    it('reports the initial match', () => {
        media.set(COARSE, true);

        render(<Probe />);

        expect(screen.getByTestId('m')).toHaveTextContent('true');
    });

    it('re-renders with the new value on a live change', () => {
        render(<Probe />);
        expect(screen.getByTestId('m')).toHaveTextContent('false');

        media.set(COARSE, true);
        expect(screen.getByTestId('m')).toHaveTextContent('true');

        media.set(COARSE, false);
        expect(screen.getByTestId('m')).toHaveTextContent('false');
    });

    it('reports false when matchMedia is missing', () => {
        Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });

        render(<Probe />);

        expect(screen.getByTestId('m')).toHaveTextContent('false');
    });

    it('removes its listener on unmount', () => {
        const { unmount } = render(<Probe />);
        expect(media.listenerCount(COARSE)).toBe(1);

        unmount();

        expect(media.listenerCount(COARSE)).toBe(0);
    });
});
