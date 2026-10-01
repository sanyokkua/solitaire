// covers: KS-INP-05, KS-INP-06

import { describe, expect, it } from 'vitest';
import { FOUNDATION_DISPLAY_ORDER } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { GameState, PileRef, Suit, TableauCol } from '../../../../src/domain/types';
import { columnSteps, positions, type Layout } from '../../../../src/ui/board/layout';
import { landingAreas, nextLanding, pickLargestOverlap, pileAt, type Rect } from '../../../../src/ui/board/landing';
import { pileKey } from '../../../../src/ui/board/locate';
import { measure, type Metrics } from '../../../../src/ui/board/metrics';
import { worstColumnState } from '../../../fixtures/boardPositions';
import { faceDown, faceUp, foundationsOf, makeState, tableauOf } from '../../../fixtures/states';
import { BASELINES, DEVICE_CONFIGS, boardSizeFor, type Pointer, type ScreenSpec } from '../../../fixtures/viewports';

const EPSILON = 1e-9;
const TALL = measure({ width: 1180, height: 1000 }, { coarse: false });
/** A short board: a long column's area would run past the bottom edge. */
const SHORT = measure({ width: 1180, height: 560 }, { coarse: false });
const WIDE = measure({ width: 700, height: 280 }, { coarse: true });
const SUITS: readonly Suit[] = [0, 1, 2, 3];
const COLUMNS: readonly TableauCol[] = [0, 1, 2, 3, 4, 5, 6];

/** The item at `index`, failing the test when there is none. */
function nth<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (item === undefined) {
        throw new Error(`no item at index ${String(index)}`);
    }
    return item;
}

function area(areas: ReadonlyMap<string, Rect>, ref: PileRef): Rect {
    const rect = areas.get(pileKey(ref));
    if (rect === undefined) {
        throw new Error(`no area for ${pileKey(ref)}`);
    }
    return rect;
}

function build(state: GameState, metrics: Metrics, stockRight = false): { layout: Layout; areas: Map<string, Rect> } {
    const layout = positions(state, metrics, { stockRight });
    return { layout, areas: new Map(landingAreas(layout, metrics, state)) };
}

/** A state with a face-down card under `up` face-up ones in column 0, and nothing else in the tableau. */
function columnState(up: number): GameState {
    return makeState({ tableau: tableauOf([...faceDown(50), ...faceUp(...Array.from({ length: up }, (_, i) => i))]) });
}

function intersection(a: Rect, b: Rect): number {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return Math.max(0, w) * Math.max(0, h);
}

describe('pileAt', () => {
    const { areas } = build(makeState({ tableau: tableauOf([...faceDown(50), ...faceUp(0, 1, 2)]) }), TALL);
    const centre = (rect: Rect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

    it('names the pile whose area holds the point', () => {
        for (const ref of [
            { pile: 'stock' },
            { pile: 'waste' },
            { pile: 'foundation', suit: 3 },
            { pile: 'tableau', col: 0 },
            { pile: 'tableau', col: 6 },
        ] as const) {
            expect(pileAt(areas, centre(area(areas, ref)))).toEqual(ref);
        }
    });

    it('reaches the empty part of a column below its last card', () => {
        const rect = area(areas, { pile: 'tableau', col: 2 });
        expect(pileAt(areas, { x: rect.x + 1, y: rect.y + rect.h - 1 })).toEqual({ pile: 'tableau', col: 2 });
    });

    it('takes the left and top edges in and the right and bottom edges out', () => {
        const rect = area(areas, { pile: 'foundation', suit: 0 });
        expect(pileAt(areas, { x: rect.x, y: rect.y })).toEqual({ pile: 'foundation', suit: 0 });
        expect(pileAt(areas, { x: rect.x + rect.w, y: rect.y + 1 })).toBeUndefined();
        expect(pileAt(areas, { x: rect.x + 1, y: rect.y + rect.h })).toBeUndefined();
    });

    it('is undefined over the gap between piles and outside the board', () => {
        const left = area(areas, { pile: 'tableau', col: 0 });
        const right = area(areas, { pile: 'tableau', col: 1 });
        expect(pileAt(areas, { x: (left.x + left.w + right.x) / 2, y: left.y + 5 })).toBeUndefined();
        expect(pileAt(areas, { x: -10, y: -10 })).toBeUndefined();
        expect(pileAt(new Map(), { x: 5, y: 5 })).toBeUndefined();
    });
});

describe('landingAreas', () => {
    it('gives 13 areas: four foundations, seven columns, the stock and the waste', () => {
        const { areas } = build(makeState(), TALL);
        expect(areas.size).toBe(13);
    });

    it('makes each foundation area equal to its slot', () => {
        const { layout, areas } = build(makeState(), TALL);
        for (const suit of SUITS) {
            const slot = nth(layout.slots.foundations, FOUNDATION_DISPLAY_ORDER.indexOf(suit));
            expect(area(areas, { pile: 'foundation', suit })).toEqual({ x: slot.x, y: slot.y, w: TALL.cw, h: TALL.ch });
        }
    });

    it('makes the stock area its slot and the waste area its anchor', () => {
        const { layout, areas } = build(makeState(), TALL);
        expect(area(areas, { pile: 'stock' })).toEqual({ ...layout.slots.stock, w: TALL.cw, h: TALL.ch });
        expect(area(areas, { pile: 'waste' })).toEqual({ ...layout.slots.waste, w: TALL.cw, h: TALL.ch });
    });

    it('ends a 5-card column 1.2 card heights below where a sixth card would go', () => {
        const state = makeState({ tableau: tableauOf(faceUp(0, 1, 2, 3, 4)) });
        const six = makeState({ tableau: tableauOf(faceUp(0, 1, 2, 3, 4, 5)) });
        const sixthY = positions(six, TALL, { stockRight: false }).cards.get(5)?.y ?? Number.NaN;
        const rect = area(build(state, TALL).areas, { pile: 'tableau', col: 0 });
        expect(rect.y).toBe(TALL.tabY);
        expect(rect.y + rect.h).toBeCloseTo(sixthY + 1.2 * TALL.ch, 9);
        expect(rect.w).toBe(TALL.cw);
    });

    it('starts a column at the top of the tableau and at its own x', () => {
        const { layout, areas } = build(columnState(3), TALL);
        for (const col of COLUMNS) {
            const rect = area(areas, { pile: 'tableau', col });
            expect(rect.x).toBe(nth(layout.slots.tableau, col).x);
            expect(rect.y).toBe(TALL.tabY);
        }
    });

    it('gives an empty column its slot top and a height of 1.2 card heights', () => {
        const { layout, areas } = build(makeState(), TALL);
        const slot = nth(layout.slots.tableau, 3);
        expect(area(areas, { pile: 'tableau', col: 3 })).toEqual({
            x: slot.x,
            y: slot.y,
            w: TALL.cw,
            h: 1.2 * TALL.ch,
        });
    });

    it('clips a long column to the bottom edge of the board', () => {
        const state = worstColumnState();
        const { areas } = build(state, SHORT);
        const rect = area(areas, { pile: 'tableau', col: 6 });
        expect(rect.y + rect.h).toBeCloseTo(SHORT.height, 9);
        const unclipped =
            nextLanding(positions(state, SHORT, { stockRight: false }), SHORT, state, 6).y + 1.2 * SHORT.ch;
        expect(unclipped).toBeGreaterThan(SHORT.height);
    });

    it('mirrors with the slots when the stock is on the right', () => {
        const state = makeState({ tableau: tableauOf(faceUp(0, 1)) });
        for (const metrics of [TALL, WIDE]) {
            const { layout, areas } = build(state, metrics, true);
            expect(area(areas, { pile: 'stock' })).toMatchObject(layout.slots.stock);
            expect(area(areas, { pile: 'waste' })).toMatchObject(layout.slots.waste);
            for (const suit of SUITS) {
                expect(area(areas, { pile: 'foundation', suit })).toMatchObject(
                    nth(layout.slots.foundations, FOUNDATION_DISPLAY_ORDER.indexOf(suit)),
                );
            }
            for (const col of COLUMNS) {
                expect(area(areas, { pile: 'tableau', col }).x).toBe(nth(layout.slots.tableau, col).x);
            }
            const plain = build(state, metrics, false);
            expect(area(areas, { pile: 'stock' }).x).not.toBe(area(plain.areas, { pile: 'stock' }).x);
        }
    });
});

describe('nextLanding', () => {
    it('is the slot of an empty column', () => {
        const state = makeState();
        const layout = positions(state, TALL, { stockRight: false });
        expect(nextLanding(layout, TALL, state, 2)).toEqual(nth(layout.slots.tableau, 2));
    });

    it('is where the next card would be placed on a non-empty column', () => {
        const state = columnState(4);
        const layout = positions(state, TALL, { stockRight: false });
        const column = nth(state.tableau, 0);
        const steps = columnSteps([...column, { id: 51, up: true }], TALL);
        const expected = TALL.tabY + steps.down + 4 * steps.up;
        const landing = nextLanding(layout, TALL, state, 0);
        expect(landing.x).toBe(nth(layout.slots.tableau, 0).x);
        expect(landing.y).toBeCloseTo(expected, 9);
        const grown = makeState({ tableau: tableauOf([...column, ...faceUp(51)]) });
        const placed = positions(grown, TALL, { stockRight: false }).cards.get(51);
        expect(placed?.y).toBeCloseTo(expected, 9);
    });
});

describe('pickLargestOverlap', () => {
    const areas = new Map<string, Rect>([
        ['tableau:0', { x: 0, y: 0, w: 100, h: 100 }],
        ['tableau:1', { x: 100, y: 0, w: 100, h: 100 }],
        ['tableau:2', { x: 300, y: 0, w: 100, h: 100 }],
    ]);
    const t = (col: TableauCol): PileRef => ({ pile: 'tableau', col });

    it('picks the target with the largest overlap', () => {
        const dragged: Rect = { x: 60, y: 0, w: 100, h: 100 };
        expect(pickLargestOverlap(dragged, areas, [t(0), t(1)])).toEqual(t(1));
        expect(pickLargestOverlap(dragged, areas, [t(1), t(0)])).toEqual(t(1));
    });

    it('returns undefined when every overlap is zero, touching edges included', () => {
        expect(pickLargestOverlap({ x: 200, y: 0, w: 100, h: 100 }, areas, [t(0), t(1), t(2)])).toBeUndefined();
        expect(pickLargestOverlap({ x: 0, y: 0, w: 100, h: 100 }, areas, [])).toBeUndefined();
    });

    it('resolves a tie to the earlier target', () => {
        const dragged: Rect = { x: 50, y: 0, w: 100, h: 100 };
        expect(pickLargestOverlap(dragged, areas, [t(0), t(1)])).toEqual(t(0));
        expect(pickLargestOverlap(dragged, areas, [t(1), t(0)])).toEqual(t(1));
    });

    it('skips targets that have no area and considers only the given targets', () => {
        const dragged: Rect = { x: 0, y: 0, w: 100, h: 100 };
        expect(pickLargestOverlap(dragged, areas, [{ pile: 'stock' }, t(1)])).toBeUndefined();
        expect(pickLargestOverlap(dragged, areas, [t(1), t(0)])).toEqual(t(0));
    });
});

describe('landing areas on every supported board size', () => {
    const screens: readonly (ScreenSpec & { readonly label: string })[] = [...DEVICE_CONFIGS, ...BASELINES];
    const pointers: readonly Pointer[] = ['coarse', 'fine'];
    const positionsToCheck: readonly (readonly [string, GameState])[] = [
        ['worst column', worstColumnState()],
        ['fresh deal', dealFromSeed(12345, 'draw1')],
        ['fresh draw 3 deal', dealFromSeed(777, 'draw3')],
        ['foundations and empty columns', makeState({ foundations: foundationsOf(3, 2, 1, 4) })],
    ];

    it.each(screens.map((screen) => [screen.label, screen] as const))(
        '%s keeps every area inside the board and column areas apart',
        (_name, screen) => {
            for (const pointer of pointers) {
                const size = boardSizeFor(screen, pointer);
                const metrics = measure(size, { coarse: pointer === 'coarse' });
                for (const stockRight of [false, true]) {
                    for (const [label, state] of positionsToCheck) {
                        const context = `${label} ${pointer} stockRight=${String(stockRight)}`;
                        const { areas } = build(state, metrics, stockRight);
                        for (const [key, rect] of areas) {
                            expect(rect.w, `${context} ${key}`).toBeGreaterThan(0);
                            expect(rect.h, `${context} ${key}`).toBeGreaterThanOrEqual(0);
                            expect(rect.x, `${context} ${key} left`).toBeGreaterThanOrEqual(-EPSILON);
                            expect(rect.y, `${context} ${key} top`).toBeGreaterThanOrEqual(-EPSILON);
                            expect(rect.x + rect.w, `${context} ${key} right`).toBeLessThanOrEqual(
                                size.width + EPSILON,
                            );
                            expect(rect.y + rect.h, `${context} ${key} bottom`).toBeLessThanOrEqual(
                                size.height + EPSILON,
                            );
                        }
                        for (const a of COLUMNS) {
                            for (const b of COLUMNS) {
                                if (a < b) {
                                    expect(
                                        intersection(
                                            area(areas, { pile: 'tableau', col: a }),
                                            area(areas, { pile: 'tableau', col: b }),
                                        ),
                                        `${context} columns ${String(a)} and ${String(b)}`,
                                    ).toBeLessThan(EPSILON);
                                }
                            }
                        }
                    }
                }
            }
        },
    );
});
