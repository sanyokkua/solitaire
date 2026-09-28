import { describe, expect, it } from 'vitest';
import { DECK_SIZE, FOUNDATION_DISPLAY_ORDER, cardId, rankOf } from '../../../../src/domain/cards';
import { mulberry32 } from '../../../../src/domain/prng';
import type { CardId } from '../../../../src/domain/types';
import { cascadeFrames, cascadeOrder, type CascadePath } from '../../../../src/ui/board/cascadeFrames';
import type { Point } from '../../../../src/ui/board/layout';

const SIZE = { width: 900, height: 700 };
const CARD = { cw: 90, ch: 126 };
const MAX_FRAMES = 180;

/** The path at `index`; the test fails if there is none. */
function pathAt(paths: readonly CascadePath[], index: number): CascadePath {
    const path = paths[index];
    if (path === undefined) {
        throw new Error(`no path at ${String(index)}`);
    }
    return path;
}

/** Every card starts on a foundation-like point near the top of the board. */
function starts(): Map<CardId, Point> {
    const map = new Map<CardId, Point>();
    for (let id = 0; id < DECK_SIZE; id++) {
        map.set(id, { x: 300 + (id % 4) * 100, y: 20 });
    }
    return map;
}

describe('cascadeOrder', () => {
    it('holds all 52 cards once', () => {
        const order = cascadeOrder();
        expect(order).toHaveLength(DECK_SIZE);
        expect(new Set(order).size).toBe(DECK_SIZE);
    });

    it('starts with the King of hearts and ends with the Ace of spades', () => {
        const order = cascadeOrder();
        expect(order[0]).toBe(cardId(0, 13));
        expect(order[DECK_SIZE - 1]).toBe(cardId(3, 1));
    });

    it('runs rank blocks from King down to Ace, hearts, clubs, diamonds, spades within each block', () => {
        const order = cascadeOrder();
        for (let block = 0; block < 13; block++) {
            const slice = order.slice(block * 4, block * 4 + 4);
            expect(slice.map(rankOf)).toEqual([13 - block, 13 - block, 13 - block, 13 - block]);
            expect(slice).toEqual(FOUNDATION_DISPLAY_ORDER.map((suit) => cardId(suit, (13 - block) as 1)));
        }
    });

    it('lists hearts, clubs, diamonds, spades as suits 0, 2, 1, 3', () => {
        const suits = cascadeOrder()
            .slice(0, 4)
            .map((id) => Math.floor(id / 13));
        expect(suits).toEqual([0, 2, 1, 3]);
    });
});

describe('cascadeFrames', () => {
    it('gives one path per card, in cascade order', () => {
        const paths = cascadeFrames(starts(), SIZE, CARD, mulberry32(1));
        expect(paths.map((path) => path.id)).toEqual(cascadeOrder());
    });

    it('gives identical frames for the same seed and different frames for another seed', () => {
        const first = cascadeFrames(starts(), SIZE, CARD, mulberry32(7));
        const again = cascadeFrames(starts(), SIZE, CARD, mulberry32(7));
        const other = cascadeFrames(starts(), SIZE, CARD, mulberry32(8));
        expect(again).toEqual(first);
        expect(other).not.toEqual(first);
    });

    it('keeps every frame on or above the bottom edge', () => {
        for (const seed of [1, 2, 3]) {
            for (const path of cascadeFrames(starts(), SIZE, CARD, mulberry32(seed))) {
                for (const frame of path.frames) {
                    expect(frame.y).toBeLessThanOrEqual(SIZE.height - CARD.ch);
                }
            }
        }
    });

    it('has at most 180 frames per card', () => {
        for (const path of cascadeFrames(starts(), SIZE, CARD, mulberry32(4))) {
            expect(path.frames.length).toBeGreaterThan(0);
            expect(path.frames.length).toBeLessThanOrEqual(MAX_FRAMES);
        }
    });

    it('stops with the first frame beyond a side', () => {
        const near = new Map<CardId, Point>([[cardId(0, 13), { x: 850, y: 20 }]]);
        // rng() = 0.9: vx = 5.2 to the right, so the card leaves through the right side.
        const frames = pathAt(
            cascadeFrames(near, SIZE, CARD, () => 0.9),
            0,
        ).frames;
        const beyond = (frame: Point): boolean => frame.x < -CARD.cw - 20 || frame.x > SIZE.width + 20;
        expect(frames.length).toBeLessThan(MAX_FRAMES);
        expect(frames.slice(0, -1).some(beyond)).toBe(false);
        expect(frames.slice(-1).every(beyond)).toBe(true);
    });

    it('takes the first step one velocity away from the start, up and sideways', () => {
        const from = starts();
        const first = pathAt(
            cascadeFrames(from, SIZE, CARD, () => 0),
            0,
        ).frames[0];
        const start = from.get(cardId(0, 13));
        expect(first).toBeDefined();
        expect(start).toBeDefined();
        // rng() = 0: vx = 2.5 to the left (a draw below 0.5 flips the sign)
        expect(first?.x).toBeCloseTo((start?.x ?? 0) - 2.5);
        // vy = -1, then gravity 0.5 is added before the step
        expect(first?.y).toBeCloseTo((start?.y ?? 0) - 1 + 0.5);
    });

    it('bounces off the bottom edge and never goes below it', () => {
        const low = new Map<CardId, Point>([[cardId(0, 13), { x: 400, y: SIZE.height - CARD.ch - 1 }]]);
        const path = pathAt(cascadeFrames(low, SIZE, CARD, mulberry32(9)), 0);
        expect(path.frames.some((frame) => frame.y === SIZE.height - CARD.ch)).toBe(true);
    });

    it('skips a card with no start', () => {
        const from = starts();
        from.delete(cardId(0, 13));
        const paths = cascadeFrames(from, SIZE, CARD, mulberry32(1));
        expect(paths).toHaveLength(DECK_SIZE - 1);
        expect(pathAt(paths, 0).id).toBe(cardId(2, 13));
    });
});
