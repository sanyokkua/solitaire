import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { useBoardSize } from '../../src/ui/board/useBoardSize';
import type { BoardSize } from '../../src/ui/board/metrics';

type Callback = (entries: ResizeObserverEntry[]) => void;

/** A recording `ResizeObserver` whose entries the test injects with `trigger`. */
class FakeResizeObserver {
    static readonly instances: FakeResizeObserver[] = [];
    readonly observe = vi.fn<(target: Element) => void>();
    readonly disconnect = vi.fn<() => void>();

    constructor(private readonly callback: Callback) {
        FakeResizeObserver.instances.push(this);
    }

    trigger(size: BoardSize): void {
        const entry = { contentRect: { width: size.width, height: size.height } } as ResizeObserverEntry;
        act(() => {
            this.callback([entry]);
        });
    }
}

const seen: (BoardSize | null)[] = [];

function Probe() {
    const { ref, size } = useBoardSize();
    seen.push(size);
    return (
        <div ref={ref} data-testid="p">
            {size ? `${String(size.width)}x${String(size.height)}` : 'none'}
        </div>
    );
}

beforeEach(() => {
    FakeResizeObserver.instances.length = 0;
    seen.length = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function observer(): FakeResizeObserver {
    const [first] = FakeResizeObserver.instances;
    if (!first) throw new Error('no ResizeObserver was created');
    return first;
}

describe('useBoardSize', () => {
    it('reports no size before the first entry', () => {
        render(<Probe />);

        expect(screen.getByTestId('p')).toHaveTextContent('none');
        expect(observer().observe).toHaveBeenCalledWith(screen.getByTestId('p'));
    });

    it('reports the injected contentRect', () => {
        render(<Probe />);

        observer().trigger({ width: 640, height: 480 });

        expect(screen.getByTestId('p')).toHaveTextContent('640x480');
    });

    it('ignores a sub-pixel change and applies a change of a pixel or more', () => {
        render(<Probe />);
        observer().trigger({ width: 640, height: 480 });
        const before = seen.at(-1);
        const renders = seen.length;

        observer().trigger({ width: 640.4, height: 479.7 });

        expect(screen.getByTestId('p')).toHaveTextContent('640x480');
        expect(seen).toHaveLength(renders);
        expect(seen.at(-1)).toBe(before);

        observer().trigger({ width: 641, height: 480 });

        expect(screen.getByTestId('p')).toHaveTextContent('641x480');
        expect(seen.at(-1)).not.toBe(before);
    });

    it('applies a height-only change of a pixel or more', () => {
        render(<Probe />);
        observer().trigger({ width: 640, height: 480 });

        observer().trigger({ width: 640, height: 481 });

        expect(screen.getByTestId('p')).toHaveTextContent('640x481');
    });

    it('measures drift from the last accepted size, not the last entry', () => {
        render(<Probe />);
        observer().trigger({ width: 640, height: 480 });

        observer().trigger({ width: 640.6, height: 480 });
        observer().trigger({ width: 641.2, height: 480 });

        expect(screen.getByTestId('p')).toHaveTextContent('641.2x480');
    });

    it('disconnects the observer on unmount', () => {
        const { unmount } = render(<Probe />);
        const created = observer();
        expect(created.disconnect).not.toHaveBeenCalled();

        unmount();

        expect(created.disconnect).toHaveBeenCalled();
    });

    it('keeps exactly one live observer under StrictMode', () => {
        const { unmount } = render(
            <StrictMode>
                <Probe />
            </StrictMode>,
        );
        const live = FakeResizeObserver.instances.filter((o) => o.disconnect.mock.calls.length === 0);
        expect(live).toHaveLength(1);

        live[0]?.trigger({ width: 640, height: 480 });
        expect(screen.getByTestId('p')).toHaveTextContent('640x480');

        unmount();

        expect(FakeResizeObserver.instances.every((o) => o.disconnect.mock.calls.length > 0)).toBe(true);
    });

    it('reports no size when ResizeObserver is undefined', () => {
        vi.stubGlobal('ResizeObserver', undefined);

        render(<Probe />);

        expect(screen.getByTestId('p')).toHaveTextContent('none');
        expect(FakeResizeObserver.instances).toHaveLength(0);
    });
});
