import { FOUNDATION_DISPLAY_ORDER, SUITS, TABLEAU_COLS } from '../../domain/cards';
import type { PileRef, TableauCol } from '../../domain/types';
import { columnSteps, type BoardPiles, type Layout, type Point } from './layout';
import type { Metrics } from './metrics';

/** An axis-aligned rectangle on the board in px: top left corner and size. */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** How far below the next landing position a column's area reaches, as a multiple of the card height. */
const COLUMN_REACH = 1.2;

/** The key of a pile in the landing-area map. */
export function pileKey(ref: PileRef): string {
    switch (ref.pile) {
        case 'stock':
        case 'waste':
            return ref.pile;
        case 'foundation':
            return `foundation:${String(ref.suit)}`;
        case 'tableau':
            return `tableau:${String(ref.col)}`;
    }
}

/**
 * Where the next card would land on tableau column `col`: the column's slot when it is empty, otherwise just below its
 * last card. The column is measured with one more face-up card, so a squeezed column reports the squeezed position.
 */
export function nextLanding(layout: Layout, metrics: Metrics, piles: BoardPiles, col: TableauCol): Point {
    const slot = layout.slots.tableau[col] ?? { x: 0, y: metrics.tabY };
    const column = piles.tableau[col];
    if (column.length === 0) {
        return slot;
    }
    const steps = columnSteps([...column, { id: -1, up: true }], metrics);
    const y = column.reduce((sum, card) => sum + (card.up ? steps.up : steps.down), metrics.tabY);
    return { x: slot.x, y };
}

/**
 * The landing rectangle of every pile, by `pileKey`. A foundation, the stock and the waste land on their slot (the
 * waste on its anchor). A column has the card width and spans from the top of the tableau to 1.2 card heights below its
 * next landing position, clipped to the board's bottom edge, so the empty part below its last card counts for it.
 */
export function landingAreas(layout: Layout, metrics: Metrics, piles: BoardPiles): ReadonlyMap<string, Rect> {
    const areas = new Map<string, Rect>();
    const slotRect = (at: Point): Rect => ({ x: at.x, y: at.y, w: metrics.cw, h: metrics.ch });

    areas.set(pileKey({ pile: 'stock' }), slotRect(layout.slots.stock));
    areas.set(pileKey({ pile: 'waste' }), slotRect(layout.slots.waste));
    for (const suit of SUITS) {
        const slot = layout.slots.foundations[FOUNDATION_DISPLAY_ORDER.indexOf(suit)];
        if (slot !== undefined) {
            areas.set(pileKey({ pile: 'foundation', suit }), slotRect(slot));
        }
    }
    for (const col of TABLEAU_COLS) {
        const next = nextLanding(layout, metrics, piles, col);
        const reach = next.y - metrics.tabY + COLUMN_REACH * metrics.ch;
        areas.set(pileKey({ pile: 'tableau', col }), {
            x: next.x,
            y: metrics.tabY,
            w: metrics.cw,
            h: Math.max(0, Math.min(reach, metrics.height - metrics.tabY)),
        });
    }
    return areas;
}

/**
 * Chooses the target whose landing area the dragged rectangle overlaps most; `undefined` when every overlap is zero.
 * A target with no area is skipped. A tie goes to the earlier target in `targets`, so callers pass them in the order of
 * the legal targets, lowest-numbered first.
 */
export function pickLargestOverlap(
    dragged: Rect,
    areas: ReadonlyMap<string, Rect>,
    targets: readonly PileRef[],
): PileRef | undefined {
    let best: PileRef | undefined;
    let bestOverlap = 0;
    for (const target of targets) {
        const area = areas.get(pileKey(target));
        if (area === undefined) {
            continue;
        }
        const width = Math.min(dragged.x + dragged.w, area.x + area.w) - Math.max(dragged.x, area.x);
        const height = Math.min(dragged.y + dragged.h, area.y + area.h) - Math.max(dragged.y, area.y);
        const overlap = Math.max(0, width) * Math.max(0, height);
        if (overlap > bestOverlap) {
            bestOverlap = overlap;
            best = target;
        }
    }
    return best;
}

/** Whether the point is inside the rectangle: the left and top edges belong to it, the right and bottom edges do not. */
function contains(rect: Rect, point: Point): boolean {
    return point.x >= rect.x && point.x < rect.x + rect.w && point.y >= rect.y && point.y < rect.y + rect.h;
}

/**
 * The pile whose landing area holds the board-space `point`, or `undefined` over the gaps and outside every pile. It is
 * how a press outside any card finds the stock, an empty column or a slot; a point in two areas (foundations overlap on
 * a short wide board) goes to the first in the fixed order stock, waste, foundations by suit, columns left to right.
 */
export function pileAt(areas: ReadonlyMap<string, Rect>, point: Point): PileRef | undefined {
    const stock: PileRef = { pile: 'stock' };
    const waste: PileRef = { pile: 'waste' };
    const piles: PileRef[] = [
        stock,
        waste,
        ...SUITS.map((suit): PileRef => ({ pile: 'foundation', suit })),
        ...TABLEAU_COLS.map((col): PileRef => ({ pile: 'tableau', col })),
    ];
    return piles.find((ref) => {
        const area = areas.get(pileKey(ref));
        return area !== undefined && contains(area, point);
    });
}
