import { act } from '@testing-library/react';
import type { BoardSize } from '../../src/ui/board/metrics';

type Callback = (entries: ResizeObserverEntry[]) => void;

/**
 * A recording `ResizeObserver` whose entries the test injects with `trigger`. A test empties `instances` in
 * `beforeEach` and installs the class with `vi.stubGlobal('ResizeObserver', FakeResizeObserver)`.
 */
export class FakeResizeObserver {
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
