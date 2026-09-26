import { act, render, screen } from '@testing-library/react';
import { useMediaQuery } from '../../src/ui/useMediaQuery';

type Listener = (event: MediaQueryListEvent) => void;

interface FakeQuery {
    matches: boolean;
    readonly listeners: Set<Listener>;
}

const COARSE = '(pointer: coarse)';
const queries = new Map<string, FakeQuery>();
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function fakeQuery(query: string): FakeQuery {
    let fake = queries.get(query);
    if (!fake) {
        fake = { matches: false, listeners: new Set() };
        queries.set(query, fake);
    }
    return fake;
}

function installMatchMedia(): void {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => {
            const fake = fakeQuery(query);
            return {
                get matches() {
                    return fake.matches;
                },
                media: query,
                addEventListener: (_type: string, listener: Listener) => {
                    fake.listeners.add(listener);
                },
                removeEventListener: (_type: string, listener: Listener) => {
                    fake.listeners.delete(listener);
                },
            };
        },
    });
}

function change(query: string, matches: boolean): void {
    const fake = fakeQuery(query);
    fake.matches = matches;
    act(() => {
        fake.listeners.forEach((listener) => {
            listener({ matches } as MediaQueryListEvent);
        });
    });
}

function Probe({ query = COARSE }: { query?: string }) {
    return <div data-testid="m">{String(useMediaQuery(query))}</div>;
}

beforeEach(() => {
    queries.clear();
    installMatchMedia();
});

afterEach(() => {
    if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    else Reflect.deleteProperty(window, 'matchMedia');
});

describe('useMediaQuery', () => {
    it('reports the initial match', () => {
        fakeQuery(COARSE).matches = true;

        render(<Probe />);

        expect(screen.getByTestId('m')).toHaveTextContent('true');
    });

    it('re-renders with the new value on a live change', () => {
        render(<Probe />);
        expect(screen.getByTestId('m')).toHaveTextContent('false');

        change(COARSE, true);
        expect(screen.getByTestId('m')).toHaveTextContent('true');

        change(COARSE, false);
        expect(screen.getByTestId('m')).toHaveTextContent('false');
    });

    it('reports false when matchMedia is missing', () => {
        Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });

        render(<Probe />);

        expect(screen.getByTestId('m')).toHaveTextContent('false');
    });

    it('removes its listener on unmount', () => {
        const { unmount } = render(<Probe />);
        expect(fakeQuery(COARSE).listeners.size).toBe(1);

        unmount();

        expect(fakeQuery(COARSE).listeners.size).toBe(0);
    });
});
