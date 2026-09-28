/** One recorded `Element.animate` call. */
export interface AnimateCall {
    readonly el: Element;
    readonly keyframes: readonly Keyframe[];
    readonly options: KeyframeAnimationOptions;
    /** Whether the animation this call returned was cancelled. */
    cancelled: boolean;
}

/** What `stubElementAnimate` returns. */
export interface AnimateStub {
    /** Every call, in the order made. */
    readonly calls: AnimateCall[];
    /** Removes the stub again. */
    restore(): void;
}

/**
 * jsdom has no Web Animations API, so this installs a recording `animate` on `Element.prototype`; the animation it
 * returns only knows `cancel`. Call `restore` in `afterEach`.
 */
export function stubElementAnimate(): AnimateStub {
    const calls: AnimateCall[] = [];
    const animate = function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation {
        const call: AnimateCall = { el: this, keyframes, options, cancelled: false };
        calls.push(call);
        return {
            cancel: () => {
                call.cancelled = true;
            },
        } as unknown as Animation;
    };
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, writable: true, value: animate });
    return {
        calls,
        restore: () => {
            Reflect.deleteProperty(Element.prototype, 'animate');
        },
    };
}
