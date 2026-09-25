import { FOUNDATION_DISPLAY_ORDER } from '../../domain/cards';
import type { CardId, Column, GameState } from '../../domain/types';
import { FACE_DOWN_STEP, FACE_UP_STEP, FACE_UP_STEP_COARSE, MIN_FACE_DOWN_STEP, type Metrics } from './metrics';

/** Stacking order of the first stock card; later stock cards sit above it. */
export const STOCK_Z = 10;
/** Stacking order of the first waste card. */
export const WASTE_Z = 100;
/** Stacking order of the first card of the first foundation slot. */
export const FOUNDATION_Z = 200;
/** Stacking order reserved per foundation slot, so a taller pile never rises above the next slot's cards. */
export const FOUNDATION_SLOT_Z = 20;
/** Stacking order of the first tableau card, above every stock, waste and foundation card. */
export const TABLEAU_Z = 300;
/** Stacking order of the stock count badge, above every card. */
export const BADGE_Z = 400;
/** Horizontal step of the Draw 3 waste fan, as a fraction of the card width. */
export const FAN_STEP = 0.24;
/** How many waste cards a Draw 3 fan shows. */
const FAN_SIZE = 3;
/** Distance of the stock count badge from the right edge of the stock, in px. */
export const BADGE_INSET_X = 20;
/** Distance of the stock count badge above the top edge of the stock in the stacked geometry, in px. */
export const BADGE_RISE = 6;
/** Number of tableau columns. */
const COLUMNS = 7;

/** The parts of a game position the geometry depends on; a `GameState` satisfies it. */
export type BoardPiles = Pick<GameState, 'tableau' | 'stock' | 'waste' | 'foundations' | 'draw'>;

/** A point on the board in px. */
export interface Point {
    x: number;
    y: number;
}

/** Where and how one card is drawn. */
export interface Placement {
    /** Left edge in px. */
    x: number;
    /** Top edge in px. */
    y: number;
    /** Stacking order; higher is nearer the viewer. */
    z: number;
    /** Whether the face shows. */
    faceUp: boolean;
    /** Whether another card of the same stacked pile hides it; never true for a tableau card. */
    buried: boolean;
}

/** The whole table: every card, the empty-pile slots, the stock badge and the deal order. */
export interface Layout {
    /** One placement per card in the piles, by card id. */
    cards: ReadonlyMap<CardId, Placement>;
    slots: {
        stock: Point;
        /** In `FOUNDATION_DISPLAY_ORDER`: hearts, clubs, diamonds, spades. */
        foundations: readonly [Point, Point, Point, Point];
        /** The seven tableau columns, left to right. */
        tableau: readonly Point[];
    };
    /** Top left of the stock count badge. */
    badge: Point;
    /** Tableau cards of a fresh deal in dealing order: row by row, left to right. */
    dealOrder: readonly CardId[];
}

/** Grid columns of the stacked top row. */
interface TopRow {
    stock: number;
    waste: number;
    foundations: readonly [number, number, number, number];
    /** 1 fans the waste rightward, -1 leftward. */
    fanDirection: 1 | -1;
}

const DEFAULT_TOP_ROW: TopRow = { stock: 0, waste: 1, foundations: [3, 4, 5, 6], fanDirection: 1 };
const MIRRORED_TOP_ROW: TopRow = { stock: 6, waste: 5, foundations: [0, 1, 2, 3], fanDirection: -1 };

/** The vertical steps of one tableau column: from a face-down card and from a face-up card. */
interface ColumnSteps {
    down: number;
    up: number;
}

/**
 * The steps of a column. Face-down cards squeeze first, down to their minimum, and face-up cards shrink only when
 * that still does not fit the board.
 */
function columnSteps(column: Column, metrics: Metrics): ColumnSteps {
    const faceDownCount = column.filter((card) => !card.up).length;
    const upSteps = Math.max(0, column.length - faceDownCount - 1);
    let down = metrics.ch * FACE_DOWN_STEP;
    let up = metrics.ch * (metrics.coarse ? FACE_UP_STEP_COARSE : FACE_UP_STEP);
    const available = Math.max(0, metrics.bottom - metrics.tabY - metrics.ch);
    if (faceDownCount * down + upSteps * up > available) {
        down = Math.max(
            metrics.ch * MIN_FACE_DOWN_STEP,
            faceDownCount > 0 ? (available - upSteps * up) / faceDownCount : down,
        );
        if (faceDownCount * down + upSteps * up > available && upSteps > 0) {
            up = Math.max(0, (available - faceDownCount * down) / upSteps);
        }
    }
    return { down, up };
}

/** The tableau cards of a fresh deal in dealing order: the first card of each column, then the second, and so on. */
function dealOrderOf(tableau: BoardPiles['tableau']): CardId[] {
    const order: CardId[] = [];
    for (let row = 0; row < COLUMNS; row++) {
        for (let col = row; col < COLUMNS; col++) {
            const card = tableau[col]?.[row];
            if (card !== undefined) {
                order.push(card.id);
            }
        }
    }
    return order;
}

/**
 * Computes where every card, empty-pile slot and the stock badge goes in the stacked table. It depends only on the
 * piles, the metrics and the mirror option, so the same inputs always give the same layout.
 */
export function positions(piles: BoardPiles, metrics: Metrics, options: { readonly stockRight: boolean }): Layout {
    const row = options.stockRight ? MIRRORED_TOP_ROW : DEFAULT_TOP_ROW;
    const columnX = (col: number) => metrics.ox + col * (metrics.cw + metrics.gap);
    const topPoint = (col: number): Point => ({ x: columnX(col), y: metrics.top });
    const stock = topPoint(row.stock);
    const waste = topPoint(row.waste);
    const [f0, f1, f2, f3] = row.foundations;
    const foundationSlots = [topPoint(f0), topPoint(f1), topPoint(f2), topPoint(f3)] as const;
    const cards = new Map<CardId, Placement>();

    piles.stock.forEach((id, i) => {
        cards.set(id, { x: stock.x, y: stock.y, z: STOCK_Z + i, faceUp: false, buried: i < piles.stock.length - 1 });
    });

    const fanned = piles.draw === 3 ? Math.min(FAN_SIZE, piles.waste.length) : 1;
    piles.waste.forEach((id, i) => {
        const fanIndex = i - (piles.waste.length - fanned);
        const offset = Math.max(fanIndex, 0) * metrics.cw * FAN_STEP * row.fanDirection;
        cards.set(id, { x: waste.x + offset, y: waste.y, z: WASTE_Z + i, faceUp: true, buried: fanIndex < 0 });
    });

    piles.foundations.forEach((pile, suit) => {
        const slot = FOUNDATION_DISPLAY_ORDER.findIndex((s) => s === suit);
        const at = foundationSlots[slot];
        if (at === undefined) {
            return;
        }
        pile.forEach((id, i) => {
            cards.set(id, {
                x: at.x,
                y: at.y,
                z: FOUNDATION_Z + i + slot * FOUNDATION_SLOT_Z,
                faceUp: true,
                buried: i < pile.length - 1,
            });
        });
    });

    piles.tableau.forEach((column, col) => {
        const steps = columnSteps(column, metrics);
        let y = metrics.tabY;
        column.forEach((card, i) => {
            cards.set(card.id, { x: columnX(col), y, z: TABLEAU_Z + i, faceUp: card.up, buried: false });
            y += card.up ? steps.up : steps.down;
        });
    });

    return {
        cards,
        slots: {
            stock,
            foundations: foundationSlots,
            tableau: Array.from({ length: COLUMNS }, (_, col): Point => ({ x: columnX(col), y: metrics.tabY })),
        },
        badge: { x: stock.x + metrics.cw - BADGE_INSET_X, y: stock.y - BADGE_RISE },
        dealOrder: dealOrderOf(piles.tableau),
    };
}
