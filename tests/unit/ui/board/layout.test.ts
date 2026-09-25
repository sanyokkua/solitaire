import { describe, expect, it } from 'vitest';
import { FOUNDATION_DISPLAY_ORDER } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { CardId, Column, GameState } from '../../../../src/domain/types';
import { positions, type BoardPiles, type Layout, type Placement } from '../../../../src/ui/board/layout';
import { measure, type Metrics } from '../../../../src/ui/board/metrics';
import { faceDown, faceUp, foundationsOf, makeState, tableauOf } from '../../../fixtures/states';

const DEFAULT = { stockRight: false };
const MIRRORED = { stockRight: true };
/** A tall desktop board: a short column never needs compressing. */
const TALL = measure({ width: 1180, height: 1000 }, { coarse: false });
const TALL_COARSE = measure({ width: 1180, height: 1000 }, { coarse: true });
/** The standard desktop board, where a worst-case column no longer fits at its normal steps. */
const DESKTOP = measure({ width: 1180, height: 690 }, { coarse: false });
/** A board whose worst-case column fits once its face-down cards squeeze, but before its face-up cards need to. */
const SQUEEZE_DOWN = measure({ width: 1180, height: 887 }, { coarse: false });
const EPSILON = 1e-9;

function cardAt(layout: Layout, id: CardId): Placement {
    const placement = layout.cards.get(id);
    if (placement === undefined) {
        throw new Error(`no placement for card ${String(id)}`);
    }
    return placement;
}

/** The item at `index`, failing the test when there is none. */
function nth<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (item === undefined) {
        throw new Error(`no item at index ${String(index)}`);
    }
    return item;
}

function buriedFlags(layout: Layout, cardIds: readonly CardId[]): boolean[] {
    return cardIds.map((id) => cardAt(layout, id).buried);
}

function ids(from: number, count: number): CardId[] {
    return Array.from({ length: count }, (_, i) => from + i);
}

/** A worst-case column: 6 face-down cards under 13 face-up ones. */
function worstColumn(): Column {
    return [...faceDown(...ids(0, 6)), ...faceUp(...ids(6, 13))];
}

/** The tableau y of every card of column 0 under `metrics`. */
function columnYs(metrics: Metrics, column: Column): number[] {
    const layout = positions(makeState({ tableau: tableauOf(column) }), metrics, DEFAULT);
    return column.map((card) => cardAt(layout, card.id).y);
}

/** The step from each card of a column to the next. */
function steps(ys: readonly number[]): number[] {
    return ys.slice(1).map((y, i) => y - (ys[i] ?? 0));
}

describe('positions column compression', () => {
    it('does not compress a short column on a tall board', () => {
        const column = [...faceDown(0, 1, 2), ...faceUp(3, 4)];
        const [d1, d2, toFirstUp, toLastUp] = steps(columnYs(TALL, column));
        expect(d1).toBeCloseTo(0.11 * TALL.ch, 9);
        expect(d2).toBeCloseTo(0.11 * TALL.ch, 9);
        expect(toFirstUp).toBeCloseTo(0.11 * TALL.ch, 9);
        expect(toLastUp).toBeCloseTo(0.27 * TALL.ch, 9);
    });

    it('steps face-up cards by 0.30 of the card height with a coarse pointer', () => {
        const column = [...faceDown(0, 1, 2), ...faceUp(3, 4)];
        const ys = columnYs(TALL_COARSE, column);
        expect(steps(ys)[3]).toBeCloseTo(0.3 * TALL_COARSE.ch, 9);
        expect(steps(ys)[0]).toBeCloseTo(0.11 * TALL_COARSE.ch, 9);
    });

    it('starts the first card of a column at the tableau top', () => {
        expect(columnYs(TALL, faceUp(0, 1))[0]).toBe(TALL.tabY);
    });

    it('squeezes face-down cards first, keeping the face-up step normal while that suffices', () => {
        const ys = columnYs(SQUEEZE_DOWN, worstColumn());
        const [down, , , , , , up] = steps(ys);
        expect(down).toBeLessThan(0.11 * SQUEEZE_DOWN.ch);
        expect(down).toBeGreaterThanOrEqual(0.04 * SQUEEZE_DOWN.ch - EPSILON);
        expect(up).toBeCloseTo(0.27 * SQUEEZE_DOWN.ch, 9);
        expect(nth(ys, ys.length - 1) + SQUEEZE_DOWN.ch).toBeLessThanOrEqual(SQUEEZE_DOWN.bottom + EPSILON);
    });

    it('shrinks face-up steps only after face-down steps reach 0.04 of the card height', () => {
        const ys = columnYs(DESKTOP, worstColumn());
        const [down, , , , , , up] = steps(ys);
        expect(down).toBeCloseTo(0.04 * DESKTOP.ch, 9);
        expect(up).toBeLessThan(0.27 * DESKTOP.ch);
        expect(up).toBeGreaterThan(0);
        expect(nth(ys, ys.length - 1) + DESKTOP.ch).toBeLessThanOrEqual(DESKTOP.bottom + EPSILON);
    });

    it('keeps every card of a worst-case column inside a coarse board', () => {
        const board = measure({ width: 390, height: 660 }, { coarse: true });
        for (const y of columnYs(board, worstColumn())) {
            expect(y).toBeGreaterThanOrEqual(board.tabY);
            expect(y + board.ch).toBeLessThanOrEqual(board.bottom + EPSILON);
        }
    });
});

describe('positions top row', () => {
    const columnX = (metrics: Metrics, column: number) => metrics.ox + column * (metrics.cw + metrics.gap);

    it('puts the stock in column 0, the waste in column 1 and the foundations in columns 3 to 6', () => {
        const state = makeState({ stock: [40], waste: [41], foundations: foundationsOf(1, 1, 1, 1) });
        const layout = positions(state, TALL, DEFAULT);
        expect(layout.slots.stock).toEqual({ x: columnX(TALL, 0), y: TALL.top });
        expect(cardAt(layout, 40).x).toBe(columnX(TALL, 0));
        expect(cardAt(layout, 41).x).toBe(columnX(TALL, 1));
        expect(layout.slots.foundations.map((slot) => slot.x)).toEqual([3, 4, 5, 6].map((c) => columnX(TALL, c)));
        expect(layout.slots.foundations.every((slot) => slot.y === TALL.top)).toBe(true);
        expect(layout.slots.tableau.map((slot) => slot.x)).toEqual([0, 1, 2, 3, 4, 5, 6].map((c) => columnX(TALL, c)));
    });

    it('lists the foundation slots as hearts, clubs, diamonds, spades and places each suit in its slot', () => {
        expect(FOUNDATION_DISPLAY_ORDER).toEqual([0, 2, 1, 3]);
        const state = makeState({ foundations: foundationsOf(1, 1, 1, 1) });
        const layout = positions(state, TALL, DEFAULT);
        FOUNDATION_DISPLAY_ORDER.forEach((suit, slot) => {
            const card = nth(state.foundations[suit], 0);
            expect(cardAt(layout, card).x).toBe(nth(layout.slots.foundations, slot).x);
            expect(cardAt(layout, card).y).toBe(nth(layout.slots.foundations, slot).y);
        });
    });

    it('mirrors the top row with Stock on the right and leaves the tableau where it is', () => {
        const state = makeState({
            stock: [40],
            waste: [41],
            foundations: foundationsOf(1, 1, 1, 1),
            tableau: tableauOf(faceUp(2)),
        });
        const plain = positions(state, TALL, DEFAULT);
        const mirrored = positions(state, TALL, MIRRORED);
        expect(mirrored.slots.stock.x).toBe(columnX(TALL, 6));
        expect(cardAt(mirrored, 40).x).toBe(columnX(TALL, 6));
        expect(cardAt(mirrored, 41).x).toBe(columnX(TALL, 5));
        expect(mirrored.slots.foundations.map((slot) => slot.x)).toEqual([0, 1, 2, 3].map((c) => columnX(TALL, c)));
        expect(mirrored.slots.tableau).toEqual(plain.slots.tableau);
        expect(cardAt(mirrored, 2)).toEqual(cardAt(plain, 2));
    });

    it('fans the waste leftward when mirrored', () => {
        const state = makeState({ draw: 3, waste: [10, 11, 12] });
        const layout = positions(state, TALL, MIRRORED);
        const xs = [10, 11, 12].map((id) => cardAt(layout, id).x);
        expect(nth(xs, 1) - nth(xs, 0)).toBeCloseTo(-0.24 * TALL.cw, 9);
        expect(nth(xs, 2) - nth(xs, 1)).toBeCloseTo(-0.24 * TALL.cw, 9);
    });
});

describe('positions waste fan', () => {
    it('fans the top three waste cards at 0, 1 and 2 steps in Draw 3, the lower cards sharing the first position', () => {
        const state = makeState({ draw: 3, mode: 'draw3', waste: [10, 11, 12, 13, 14] });
        const layout = positions(state, TALL, DEFAULT);
        const base = cardAt(layout, 12).x;
        expect(cardAt(layout, 10).x).toBe(base);
        expect(cardAt(layout, 11).x).toBe(base);
        expect(cardAt(layout, 13).x - base).toBeCloseTo(0.24 * TALL.cw, 9);
        expect(cardAt(layout, 14).x - base).toBeCloseTo(2 * 0.24 * TALL.cw, 9);
        expect(cardAt(layout, 14).x).toBeGreaterThan(cardAt(layout, 13).x);
        for (const id of [10, 11, 12, 13, 14]) {
            expect(cardAt(layout, id).y).toBe(TALL.top);
        }
    });

    it('fans a Draw 3 waste of two cards from its first position', () => {
        const layout = positions(makeState({ draw: 3, waste: [10, 11] }), TALL, DEFAULT);
        expect(cardAt(layout, 11).x - cardAt(layout, 10).x).toBeCloseTo(0.24 * TALL.cw, 9);
    });

    it('does not fan in Draw 1', () => {
        const layout = positions(makeState({ waste: [10, 11, 12, 13] }), TALL, DEFAULT);
        const first = cardAt(layout, 10);
        for (const id of [11, 12, 13]) {
            expect(cardAt(layout, id).x).toBe(first.x);
            expect(cardAt(layout, id).y).toBe(first.y);
        }
    });
});

describe('positions stacking, buried cards and anchors', () => {
    /** Every pile holds cards, with no card in two piles. */
    const LAYERED = makeState({
        stock: [45, 46],
        waste: [47, 48],
        foundations: foundationsOf(2, 2, 2, 2),
        tableau: tableauOf(faceUp(30, 31)),
    });

    it('buries every stock card but the top one', () => {
        const layout = positions(makeState({ stock: ids(28, 24) }), TALL, DEFAULT);
        const buried = ids(28, 24).filter((id) => cardAt(layout, id).buried);
        expect(buried).toHaveLength(23);
        expect(cardAt(layout, 51).buried).toBe(false);
    });

    it('buries the waste cards beneath the visible fan', () => {
        const layout = positions(makeState({ draw: 3, waste: [10, 11, 12, 13, 14] }), TALL, DEFAULT);
        expect(buriedFlags(layout, [10, 11])).toEqual([true, true]);
        expect(buriedFlags(layout, [12, 13, 14])).toEqual([false, false, false]);
        const draw1 = positions(makeState({ waste: [10, 11, 12] }), TALL, DEFAULT);
        expect(buriedFlags(draw1, [10, 11, 12])).toEqual([true, true, false]);
    });

    it('buries every foundation card but the top one', () => {
        const state = makeState({ foundations: foundationsOf(3, 1, 0, 2) });
        const layout = positions(state, TALL, DEFAULT);
        const [hearts, diamonds, , spades] = state.foundations;
        expect(buriedFlags(layout, hearts)).toEqual([true, true, false]);
        expect(buriedFlags(layout, diamonds)).toEqual([false]);
        expect(buriedFlags(layout, spades)).toEqual([true, false]);
    });

    it('never buries a tableau card', () => {
        const layout = positions(makeState({ tableau: tableauOf(worstColumn()) }), TALL, DEFAULT);
        expect(worstColumn().every((card) => !cardAt(layout, card.id).buried)).toBe(true);
    });

    it('layers the piles in bands: stock, waste, foundation slots, tableau', () => {
        const layout = positions(LAYERED, TALL, DEFAULT);
        expect([45, 46].map((id) => cardAt(layout, id).z)).toEqual([10, 11]);
        expect([47, 48].map((id) => cardAt(layout, id).z)).toEqual([100, 101]);
        expect([30, 31].map((id) => cardAt(layout, id).z)).toEqual([300, 301]);
        FOUNDATION_DISPLAY_ORDER.forEach((suit, slot) => {
            const pile = LAYERED.foundations[suit];
            expect(pile.map((id) => cardAt(layout, id).z)).toEqual([200 + slot * 20, 201 + slot * 20]);
        });
    });

    it('puts every tableau card above every stock, waste and foundation card', () => {
        const layout = positions(LAYERED, TALL, DEFAULT);
        const tableauIds = new Set([30, 31]);
        const tableauZ = [...tableauIds].map((id) => cardAt(layout, id).z);
        const otherZ = [...layout.cards].filter(([id]) => !tableauIds.has(id)).map(([, placement]) => placement.z);
        expect(otherZ.length).toBeGreaterThan(0);
        expect(Math.min(...tableauZ)).toBeGreaterThan(Math.max(...otherZ));
    });

    it('puts the tableau at or below the tableau top and the column slots on it', () => {
        const state = dealFromSeed(11, 'draw1');
        const layout = positions(state, DESKTOP, DEFAULT);
        for (const card of state.tableau.flat()) {
            expect(cardAt(layout, card.id).y).toBeGreaterThanOrEqual(DESKTOP.tabY);
        }
        expect(layout.slots.tableau.every((slot) => slot.y === DESKTOP.tabY)).toBe(true);
        expect(layout.slots.tableau).toHaveLength(7);
        expect(DESKTOP.tabY).toBeGreaterThan(DESKTOP.top + DESKTOP.ch);
    });

    it('lists the fresh deal row by row', () => {
        const state = dealFromSeed(3, 'draw1');
        const layout = positions(state, TALL, DEFAULT);
        const order = layout.dealOrder;
        const firstOf = (row: number, fromCol: number): CardId[] =>
            state.tableau.slice(fromCol).map((column) => nth(column, row).id);
        expect(order).toHaveLength(28);
        expect(order.slice(0, 7)).toEqual(firstOf(0, 0));
        expect(order.slice(7, 13)).toEqual(firstOf(1, 1));
        expect(order.slice(13, 18)).toEqual(firstOf(2, 2));
        expect(order.at(-1)).toBe(nth(nth(state.tableau, 6), 6).id);
        expect(new Set(order)).toEqual(new Set(state.tableau.flat().map((card) => card.id)));
    });

    it('anchors the stock count badge at the stock top right corner', () => {
        const layout = positions(makeState({ stock: [40] }), TALL, DEFAULT);
        expect(layout.badge).toEqual({ x: layout.slots.stock.x + TALL.cw - 20, y: layout.slots.stock.y - 6 });
        const mirrored = positions(makeState({ stock: [40] }), TALL, MIRRORED);
        expect(mirrored.badge).toEqual({ x: mirrored.slots.stock.x + TALL.cw - 20, y: mirrored.slots.stock.y - 6 });
    });

    it('flags stock face down, waste and foundation face up, and tableau by its own flag', () => {
        const state = makeState({
            stock: [40],
            waste: [41],
            foundations: foundationsOf(1, 0, 0, 0),
            tableau: tableauOf([...faceDown(30), ...faceUp(31)]),
        });
        const layout = positions(state, TALL, DEFAULT);
        expect(cardAt(layout, 40).faceUp).toBe(false);
        expect(cardAt(layout, 41).faceUp).toBe(true);
        expect(cardAt(layout, nth(state.foundations[0], 0)).faceUp).toBe(true);
        expect(cardAt(layout, 30).faceUp).toBe(false);
        expect(cardAt(layout, 31).faceUp).toBe(true);
    });

    it('places all 52 cards of a fresh deal', () => {
        const layout = positions(dealFromSeed(5, 'draw1'), TALL, DEFAULT);
        expect(layout.cards.size).toBe(52);
    });
});

describe('positions purity', () => {
    const state: GameState = dealFromSeed(9, 'draw3');

    it('gives equal output for a GameState and a subset holding only its board piles', () => {
        const piles: BoardPiles = {
            tableau: state.tableau,
            stock: state.stock,
            waste: state.waste,
            foundations: state.foundations,
            draw: state.draw,
        };
        expect(positions(piles, DESKTOP, DEFAULT)).toEqual(positions(state, DESKTOP, DEFAULT));
    });

    it('ignores score, moves and elapsed time', () => {
        const changed = { ...state, score: 999, moves: 42, elapsedMs: 123_456 };
        expect(positions(changed, DESKTOP, MIRRORED)).toEqual(positions(state, DESKTOP, MIRRORED));
    });

    it('gives the same placements on every call', () => {
        expect(positions(state, DESKTOP, DEFAULT)).toEqual(positions(state, DESKTOP, DEFAULT));
    });
});
