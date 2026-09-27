import { describe, expect, it } from 'vitest';
import {
    initialPointerState,
    step,
    type Effect,
    type Hit,
    type Input,
    type PointerKind,
    type PointerState,
} from '../../../../src/ui/board/pointerController';
import { deepFreeze } from '../../../fixtures/states';

const CARD_A: Hit = { kind: 'card', id: 10, from: { pile: 'tableau', col: 2 }, index: 3, movable: true };
const CARD_B: Hit = { kind: 'card', id: 11, from: { pile: 'tableau', col: 3 }, index: 0, movable: true };
const LOCKED: Hit = { kind: 'card', id: 12, from: { pile: 'tableau', col: 4 }, index: 0, movable: false };
const STOCK_CARD: Hit = { kind: 'card', id: 13, from: { pile: 'stock' }, index: 5, movable: false };
const STOCK: Hit = { kind: 'stock' };
const SLOT: Hit = { kind: 'slot', ref: { pile: 'waste' } };
const NONE: Hit = { kind: 'none' };

const down = (hit: Hit, kind: PointerKind = 'mouse', extra: Partial<Extract<Input, { type: 'down' }>> = {}): Input => ({
    type: 'down',
    pointerId: 1,
    kind,
    button: 0,
    x: 100,
    y: 200,
    t: 1000,
    hit,
    ...extra,
});
/** A move to `dx`, `dy` away from the default press point (100, 200). */
const move = (dx: number, dy = 0, pointerId = 1): Input => ({ type: 'move', pointerId, x: 100 + dx, y: 200 + dy });
const up = (hit: Hit, dx = 0, t = 1050, pointerId = 1): Input => ({
    type: 'up',
    pointerId,
    x: 100 + dx,
    y: 200,
    t,
    hit,
});

/** Folds the inputs through `step`, collecting every effect in order. */
function run(inputs: readonly Input[], from: PointerState = initialPointerState) {
    let state = from;
    const effects: Effect[] = [];
    for (const input of inputs) {
        const result = step(state, input);
        state = result.state;
        effects.push(...result.effects);
    }
    return { state, effects };
}

const types = (effects: readonly Effect[]) => effects.map((effect) => effect.type);

describe('drag threshold', () => {
    it.each([
        ['mouse', 4, 6],
        ['touch', 8, 10],
        ['pen', 8, 10],
    ] as const)('%s: no drag at %i px, a drag at %i px', (kind, below, above) => {
        expect(types(run([down(CARD_A, kind), move(below)]).effects)).toEqual([]);
        expect(run([down(CARD_A, kind), move(below)]).state.phase).toBe('pressed');
        const started = run([down(CARD_A, kind), move(above)]);
        expect(types(started.effects)).toEqual(['dragStart', 'dragMove']);
        expect(started.state.phase).toBe('dragging');
    });

    it.each([
        ['mouse', 5],
        ['touch', 9],
        ['pen', 9],
    ] as const)('%s: exactly %i px is not a drag', (kind, exact) => {
        expect(run([down(CARD_A, kind), move(exact)]).effects).toEqual([]);
    });

    it('measures the distance from the press point, not along one axis', () => {
        expect(types(run([down(CARD_A), move(4, 4)]).effects)).toEqual(['dragStart', 'dragMove']);
        expect(run([down(CARD_A), move(3, 4)]).effects).toEqual([]);
    });

    it('starts the drag with the pressed card and the current offset', () => {
        const { effects } = run([down(CARD_A), move(3), move(6, 2)]);
        expect(effects).toEqual([
            { type: 'dragStart', card: CARD_A },
            { type: 'dragMove', dx: 6, dy: 2 },
        ]);
    });

    it('reports absolute offsets from the press point on later moves', () => {
        const { effects } = run([down(CARD_A), move(10), move(20, 5), move(15, -5)]);
        expect(effects.slice(2)).toEqual([
            { type: 'dragMove', dx: 20, dy: 5 },
            { type: 'dragMove', dx: 15, dy: -5 },
        ]);
    });

    it('ignores moves when nothing is pressed', () => {
        expect(run([move(50)])).toEqual({ state: initialPointerState, effects: [] });
    });
});

describe('tap and drop', () => {
    it('taps the pressed target when released before the threshold', () => {
        const { effects, state } = run([down(CARD_A), move(4), up(CARD_A, 4)]);
        expect(effects).toEqual([{ type: 'tap', hit: CARD_A, double: false }]);
        expect(state.phase).toBe('idle');
        expect(state.suppressClick).toBe(false);
    });

    it('taps the pressed target even when the release resolves elsewhere', () => {
        expect(run([down(CARD_A), up(NONE)]).effects).toEqual([{ type: 'tap', hit: CARD_A, double: false }]);
    });

    it('taps non-card targets', () => {
        expect(run([down(STOCK), up(STOCK)]).effects).toEqual([{ type: 'tap', hit: STOCK, double: false }]);
        expect(run([down(SLOT), up(SLOT)]).effects).toEqual([{ type: 'tap', hit: SLOT, double: false }]);
        expect(run([down(NONE), up(NONE)]).effects).toEqual([{ type: 'tap', hit: NONE, double: false }]);
    });

    it('drops with the offset at release and no tap after a drag', () => {
        const { effects, state } = run([down(CARD_A), move(30, 10), up(CARD_A, 25)]);
        expect(types(effects)).toEqual(['dragStart', 'dragMove', 'drop']);
        expect(effects[2]).toEqual({ type: 'drop', dx: 25, dy: 0 });
        expect(state.phase).toBe('idle');
        expect(state.suppressClick).toBe(true);
    });

    it('drops with no tap even when released back on the origin', () => {
        const { effects } = run([down(CARD_A), move(30), up(CARD_A, 0)]);
        expect(types(effects)).not.toContain('tap');
        expect(effects.at(-1)).toEqual({ type: 'drop', dx: 0, dy: 0 });
    });

    it('clears suppressClick on the next down', () => {
        const dropped = run([down(CARD_A), move(30), up(CARD_A, 30)]).state;
        expect(dropped.suppressClick).toBe(true);
        expect(step(dropped, down(CARD_B, 'mouse', { pointerId: 2 })).state.suppressClick).toBe(false);
    });
});

describe('what can be dragged', () => {
    it('lets a press on the stock pile only tap', () => {
        const { effects } = run([down(STOCK), move(80), up(STOCK, 80)]);
        expect(effects).toEqual([{ type: 'tap', hit: STOCK, double: false }]);
    });

    it('lets a press on a stock card only tap', () => {
        const { effects } = run([down(STOCK_CARD), move(80), up(STOCK_CARD, 80)]);
        expect(effects).toEqual([{ type: 'tap', hit: STOCK_CARD, double: false }]);
    });

    it('lets a press on a non-movable card only tap', () => {
        const { effects } = run([down(LOCKED), move(80), up(LOCKED, 80)]);
        expect(effects).toEqual([{ type: 'tap', hit: LOCKED, double: false }]);
    });

    it('lets a press on a slot or empty space only tap', () => {
        expect(types(run([down(SLOT), move(80), up(SLOT, 80)]).effects)).toEqual(['tap']);
        expect(types(run([down(NONE), move(80), up(NONE, 80)]).effects)).toEqual(['tap']);
    });
});

describe('double-tap', () => {
    const tapAt = (hit: Hit, pressT: number, upT: number, pointerId = 1): Input[] => [
        down(hit, 'mouse', { pointerId, t: pressT }),
        up(hit, 0, upT, pointerId),
    ];

    it('marks a tap 319 ms after a tap on the same card as double', () => {
        const { effects } = run([...tapAt(CARD_A, 1000, 1050), ...tapAt(CARD_A, 1300, 1369)]);
        expect(effects.map((effect) => effect.type === 'tap' && effect.double)).toEqual([false, true]);
    });

    it.each([320, 321])('does not mark a tap %i ms later as double', (gap) => {
        const { effects } = run([...tapAt(CARD_A, 1000, 1050), ...tapAt(CARD_A, 1100, 1050 + gap)]);
        expect(effects.map((effect) => effect.type === 'tap' && effect.double)).toEqual([false, false]);
    });

    it('does not mark a tap on a different card as double', () => {
        const { effects } = run([...tapAt(CARD_A, 1000, 1050), ...tapAt(CARD_B, 1100, 1150)]);
        expect(effects.map((effect) => effect.type === 'tap' && effect.double)).toEqual([false, false]);
    });

    it('does not mark a tap after an intervening non-card tap as double', () => {
        const { effects } = run([
            ...tapAt(CARD_A, 1000, 1050),
            ...tapAt(NONE, 1060, 1070),
            ...tapAt(CARD_A, 1080, 1090),
        ]);
        expect(effects.map((effect) => effect.type === 'tap' && effect.double)).toEqual([false, false, false]);
    });

    it('keeps the window open after a double, as the mockup does', () => {
        const { effects } = run([
            ...tapAt(CARD_A, 1000, 1050),
            ...tapAt(CARD_A, 1100, 1150),
            ...tapAt(CARD_A, 1200, 1250),
        ]);
        expect(effects.map((effect) => effect.type === 'tap' && effect.double)).toEqual([false, true, true]);
    });

    it('records the tap on a non-movable card too', () => {
        const { effects } = run([...tapAt(LOCKED, 1000, 1050), ...tapAt(LOCKED, 1100, 1150)]);
        expect(effects.map((effect) => effect.type === 'tap' && effect.double)).toEqual([false, true]);
    });
});

describe('ignored input', () => {
    it('ignores a non-primary mouse button', () => {
        const result = run([down(CARD_A, 'mouse', { button: 2 }), move(50), up(CARD_A, 50)]);
        expect(result).toEqual({ state: initialPointerState, effects: [] });
        expect(step(initialPointerState, down(CARD_A, 'mouse', { button: 1 })).state.phase).toBe('idle');
    });

    it('treats a touch or pen press with any button value as a press', () => {
        expect(step(initialPointerState, down(CARD_A, 'touch', { button: 0 })).state.phase).toBe('pressed');
        expect(step(initialPointerState, down(CARD_A, 'pen', { button: 0 })).state.phase).toBe('pressed');
    });

    it('ignores a second pointer while pressed or dragging', () => {
        const pressed = run([down(CARD_A)]).state;
        expect(step(pressed, down(CARD_B, 'touch', { pointerId: 2 }))).toEqual({ state: pressed, effects: [] });
        expect(step(pressed, move(80, 0, 2))).toEqual({ state: pressed, effects: [] });
        expect(step(pressed, up(CARD_A, 0, 1100, 2))).toEqual({ state: pressed, effects: [] });

        const dragging = run([down(CARD_A), move(30)]).state;
        expect(step(dragging, down(CARD_B, 'touch', { pointerId: 2 }))).toEqual({ state: dragging, effects: [] });
        expect(step(dragging, move(80, 0, 2))).toEqual({ state: dragging, effects: [] });
        expect(step(dragging, up(CARD_A, 40, 1100, 2))).toEqual({ state: dragging, effects: [] });
    });

    it('ignores a release with no press', () => {
        expect(run([up(CARD_A)])).toEqual({ state: initialPointerState, effects: [] });
    });
});

describe('cancelling', () => {
    const cancelling: readonly Input[] = [
        { type: 'cancel' },
        { type: 'escape' },
        { type: 'resize' },
        { type: 'gateClosed' },
    ];

    it.each(cancelling)('$type ends a drag with exactly one cancel effect and suppresses the click', (input) => {
        const dragging = run([down(CARD_A), move(30)]).state;
        const result = step(dragging, input);
        expect(result.effects).toEqual([{ type: 'cancel' }]);
        expect(result.state.phase).toBe('idle');
        expect(result.state.suppressClick).toBe(true);
        // The release that follows is ignored: no drop, no tap.
        expect(run([up(CARD_A, 30)], result.state).effects).toEqual([]);
    });

    it.each(cancelling)('$type while merely pressed yields nothing and returns to idle', (input) => {
        const pressed = run([down(CARD_A)]).state;
        const result = step(pressed, input);
        expect(result.effects).toEqual([]);
        expect(result.state.phase).toBe('idle');
        expect(run([up(CARD_A)], result.state).effects).toEqual([]);
    });

    it.each(cancelling)('$type while idle changes nothing', (input) => {
        expect(step(initialPointerState, input)).toEqual({ state: initialPointerState, effects: [] });
    });
});

describe('purity', () => {
    it('does not mutate the previous state', () => {
        const inputs: readonly Input[] = [
            down(CARD_A),
            move(3),
            move(30),
            move(40),
            up(CARD_A, 40),
            down(CARD_A, 'mouse', { pointerId: 2 }),
            up(CARD_A, 0, 1100, 2),
            down(CARD_A, 'mouse', { pointerId: 3 }),
            move(30, 0, 3),
            { type: 'escape' },
        ];
        let state = deepFreeze(initialPointerState);
        for (const input of inputs) {
            state = deepFreeze(step(state, deepFreeze(input)).state);
        }
        expect(state.phase).toBe('idle');
    });
});
