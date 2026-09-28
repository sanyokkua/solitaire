import type { CascadePath } from './cascadeFrames';
import { cardElement } from './dom';

/** The gap between two cards' starts, in ms. */
const STAGGER_MS = 70;
/** How long one frame of a path lasts, in ms. */
const FRAME_MS = 16;
/** The stacking order of the first flying card; each later card sits one above, over every resting card. */
const CASCADE_Z_BASE = 2000;

export interface CascadePlayback {
    /** Stops every animation and gives the cards' stacking back; calling it again does nothing. */
    cancel(): void;
}

/**
 * Plays the win cascade on the persistent card elements of `boardEl`: one Web Animation per path, animating only
 * `transform` (absolute `translate()` of the card's top left position, over the card's own `--x` / `--y` one), each
 * starting `STAGGER_MS` after the one before and holding its last frame (`fill: 'forwards'`), so the cards stay
 * where they end until `cancel`. Each flying card is lifted above the resting ones for the flight; `cancel` restores
 * a card's stacking only while it is still the lifted value, so a re-render that gave the card a new one is kept.
 * A path whose card is not on the board is skipped.
 */
export function playCascade(boardEl: HTMLElement, paths: readonly CascadePath[]): CascadePlayback {
    const flights: {
        readonly animation: Animation;
        readonly el: HTMLElement;
        readonly lifted: string;
        readonly resting: string;
    }[] = [];
    paths.forEach(({ id, frames }, index) => {
        const el = cardElement(boardEl, id);
        if (el === null) return;
        const resting = el.style.zIndex;
        const lifted = String(CASCADE_Z_BASE + index);
        el.style.zIndex = lifted;
        const animation = el.animate(
            frames.map((point) => ({ transform: `translate(${String(point.x)}px, ${String(point.y)}px)` })),
            { duration: frames.length * FRAME_MS, delay: index * STAGGER_MS, fill: 'forwards', easing: 'linear' },
        );
        flights.push({ animation, el, lifted, resting });
    });
    let cancelled = false;
    return {
        cancel() {
            if (cancelled) return;
            cancelled = true;
            for (const { animation, el, lifted, resting } of flights) {
                animation.cancel();
                if (el.style.zIndex === lifted) el.style.zIndex = resting;
            }
        },
    };
}
