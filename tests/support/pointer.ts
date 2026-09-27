import { act } from '@testing-library/react';

/** The three pointer-capture methods jsdom lacks, as recording stubs. */
export interface PointerCaptureStub {
    readonly setPointerCapture: ReturnType<typeof vi.fn<(pointerId: number) => void>>;
    readonly releasePointerCapture: ReturnType<typeof vi.fn<(pointerId: number) => void>>;
    /** Removes the stubs again. */
    restore(): void;
}

const CAPTURE_METHODS = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const;

/**
 * jsdom implements no pointer capture, so this installs the methods on `Element.prototype`. With `throws`, both
 * `setPointerCapture` and `releasePointerCapture` throw the `InvalidStateError` a browser raises for an unknown pointer.
 * Call `restore` in `afterEach`.
 */
export function stubPointerCapture({ throws = false }: { readonly throws?: boolean } = {}): PointerCaptureStub {
    const fail = (): never => {
        throw new DOMException('no such pointer', 'InvalidStateError');
    };
    const setPointerCapture = vi.fn<(pointerId: number) => void>(throws ? fail : () => undefined);
    const releasePointerCapture = vi.fn<(pointerId: number) => void>(throws ? fail : () => undefined);
    const stubs = { setPointerCapture, releasePointerCapture, hasPointerCapture: () => false };
    for (const name of CAPTURE_METHODS) {
        Object.defineProperty(Element.prototype, name, { configurable: true, writable: true, value: stubs[name] });
    }
    return {
        setPointerCapture,
        releasePointerCapture,
        restore: () => {
            for (const name of CAPTURE_METHODS) {
                Reflect.deleteProperty(Element.prototype, name);
            }
        },
    };
}

export interface PointerInit {
    readonly clientX?: number;
    readonly clientY?: number;
    readonly pointerId?: number;
    readonly pointerType?: 'mouse' | 'touch' | 'pen';
    readonly button?: number;
    /** The event's `timeStamp` in ms; jsdom cannot set it through the constructor, so it is defined on the event. */
    readonly timeStamp?: number;
}

/**
 * Dispatches a pointer event on `target` inside `act` and returns whether it was left un-prevented (the value of
 * `dispatchEvent`). It bubbles and is cancelable, like a real one. A `PointerEvent` when the environment has one, else
 * a `MouseEvent` with `pointerId` and `pointerType` defined on it.
 */
export function firePointer(target: Element, type: string, init: PointerInit = {}): boolean {
    const { pointerId = 1, pointerType = 'mouse', timeStamp, ...mouse } = init;
    const options = { bubbles: true, cancelable: true, button: 0, ...mouse };
    const event =
        typeof PointerEvent === 'function'
            ? new PointerEvent(type, { ...options, pointerId, pointerType })
            : Object.defineProperties(new MouseEvent(type, options), {
                  pointerId: { value: pointerId },
                  pointerType: { value: pointerType },
              });
    if (timeStamp !== undefined) {
        Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    }
    let result = true;
    act(() => {
        result = target.dispatchEvent(event);
    });
    return result;
}
