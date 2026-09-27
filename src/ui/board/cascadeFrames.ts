import { FOUNDATION_DISPLAY_ORDER, cardId, type Rank } from '../../domain/cards';
import type { CardId } from '../../domain/types';
import type { Point } from './layout';
import type { BoardSize } from './metrics';

/** Downward acceleration added to the vertical velocity every frame, in px per frame squared. */
const GRAVITY = 0.5;
/** The share of vertical speed kept, reversed, when a card hits the bottom edge. */
const BOUNCE = 0.72;
/** The most frames one card's path holds. */
const MAX_FRAMES = 180;
/** How far past a side edge a card must be, beyond its own width, before its path ends, in px. */
const SIDE_MARGIN = 20;
/** The slowest sideways speed in px per frame. */
const VX_BASE = 2.5;
/** The range added to the slowest sideways speed by one random draw, in px per frame. */
const VX_SPREAD = 3;
/** The slowest upward launch speed in px per frame. */
const VY_BASE = 1;
/** The range added to the slowest upward launch speed by one random draw, in px per frame. */
const VY_SPREAD = 5;
/** The highest rank, where the cascade starts. */
const KING: Rank = 13;

/** The size of one card in px. */
interface CardSize {
    readonly cw: number;
    readonly ch: number;
}

/** One card's flight: its top left position on each frame, in px. */
export interface CascadePath {
    readonly id: CardId;
    readonly frames: readonly Point[];
}

/** The 52 cards in flying order: kings first, down to aces, each rank in the foundation order (hearts, clubs, diamonds, spades). */
export function cascadeOrder(): readonly CardId[] {
    const order: CardId[] = [];
    for (let rank = KING; rank >= 1; rank--) {
        for (const suit of FOUNDATION_DISPLAY_ORDER) {
            order.push(cardId(suit, rank));
        }
    }
    return order;
}

/** One card's path: launched sideways and up from `start`, pulled down by gravity, bouncing off the bottom edge, ending beyond a side. */
function flight(start: Point, size: BoardSize, card: CardSize, rng: () => number): Point[] {
    let { x, y } = start;
    const vx = (rng() * VX_SPREAD + VX_BASE) * (rng() < 0.5 ? -1 : 1);
    let vy = -(rng() * VY_SPREAD + VY_BASE);
    const floor = size.height - card.ch;
    const frames: Point[] = [];
    for (let t = 0; t < MAX_FRAMES; t++) {
        vy += GRAVITY;
        x += vx;
        y += vy;
        if (y > floor) {
            y = floor;
            vy *= -BOUNCE;
        }
        frames.push({ x, y });
        if (x < -card.cw - SIDE_MARGIN || x > size.width + SIDE_MARGIN) {
            break;
        }
    }
    return frames;
}

/**
 * The win cascade's paths, one per card in `cascadeOrder()`; a card without an entry in `starts` (its top left
 * position on the board) is left out. A path depends only on its start, the board size, the card size and the draws
 * from `rng`, so a fixed `rng` gives fixed paths.
 */
export function cascadeFrames(
    starts: ReadonlyMap<CardId, Point>,
    size: BoardSize,
    card: CardSize,
    rng: () => number,
): CascadePath[] {
    const paths: CascadePath[] = [];
    for (const id of cascadeOrder()) {
        const start = starts.get(id);
        if (start !== undefined) {
            paths.push({ id, frames: flight(start, size, card, rng) });
        }
    }
    return paths;
}
