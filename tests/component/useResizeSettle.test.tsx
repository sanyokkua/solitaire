import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import type { BoardSize } from '../../src/ui/board/metrics';
import { useResizeSettle } from '../../src/ui/board/useResizeSettle';

interface ProbeProps {
    readonly size: BoardSize | null;
    readonly mounted?: boolean;
}

function Probe({ size, mounted = true }: ProbeProps) {
    const boardRef = useRef<HTMLDivElement>(null);
    useResizeSettle(boardRef, size);
    return mounted ? <div ref={boardRef} data-testid="board" /> : null;
}

const SMALL: BoardSize = { width: 640, height: 480 };
const LARGE: BoardSize = { width: 800, height: 600 };

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function flag(): string | null {
    return screen.getByTestId('board').getAttribute('data-resizing');
}

function runFrames(): void {
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) callback(0);
}

beforeEach(() => {
    frames = new Map();
    nextFrame = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        frames.delete(id);
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('useResizeSettle', () => {
    it('flags the first size and clears the flag one frame later', () => {
        render(<Probe size={SMALL} />);

        expect(flag()).toBe('true');

        runFrames();

        expect(flag()).toBeNull();
    });

    it('flags each real size change again', () => {
        const { rerender } = render(<Probe size={SMALL} />);
        runFrames();

        rerender(<Probe size={LARGE} />);

        expect(flag()).toBe('true');

        runFrames();

        expect(flag()).toBeNull();
    });

    it('does not flag again while the size is unchanged', () => {
        const { rerender } = render(<Probe size={SMALL} />);
        runFrames();

        rerender(<Probe size={SMALL} />);

        expect(flag()).toBeNull();
        expect(frames.size).toBe(0);
    });

    it('cancels the pending frame when the size changes, so an old frame clears nothing late', () => {
        const { rerender } = render(<Probe size={SMALL} />);
        const [firstFrame] = [...frames.keys()];

        rerender(<Probe size={LARGE} />);

        expect(frames.has(firstFrame ?? -1)).toBe(false);
        expect(frames.size).toBe(1);
        expect(flag()).toBe('true');

        runFrames();

        expect(flag()).toBeNull();
    });

    it('cancels the pending frame on unmount', () => {
        const { unmount } = render(<Probe size={SMALL} />);

        expect(frames.size).toBe(1);

        unmount();

        expect(frames.size).toBe(0);
    });

    it('does nothing while the board element is not mounted', () => {
        expect(() => {
            render(<Probe size={null} mounted={false} />);
        }).not.toThrow();

        expect(frames.size).toBe(0);
    });
});
