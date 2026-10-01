// covers: KS-INP-08

import { describe, expect, it } from 'vitest';
import type { PileRef } from '../../../../src/domain/types';
import {
    type FocusTarget,
    type KeyEventLike,
    moveFocus,
    keyToAction,
    pileOrder,
} from '../../../../src/ui/board/keyboardController';
import { faceDown, faceUp, foundationsOf, makeState, tableauOf } from '../../../fixtures/states';

const STOCK: PileRef = { pile: 'stock' };
const WASTE: PileRef = { pile: 'waste' };
const foundation = (suit: 0 | 1 | 2 | 3): PileRef => ({ pile: 'foundation', suit });
const column = (col: 0 | 1 | 2 | 3 | 4 | 5 | 6): PileRef => ({ pile: 'tableau', col });
/** The pile at `index` of an order; throws when out of range so tests stay free of assertions. */
function pileAt(order: readonly PileRef[], index: number): PileRef {
    const ref = order[index];
    if (!ref) {
        throw new Error(`no pile at ${String(index)}`);
    }
    return ref;
}
const at = (from: PileRef, index: number | null = null): FocusTarget => ({ from, index });

const HEARTS = foundation(0);
const CLUBS = foundation(2);
const DIAMONDS = foundation(1);
const SPADES = foundation(3);

const DEFAULT_ORDER: PileRef[] = [
    STOCK,
    WASTE,
    HEARTS,
    CLUBS,
    DIAMONDS,
    SPADES,
    column(0),
    column(1),
    column(2),
    column(3),
    column(4),
    column(5),
    column(6),
];
const MIRRORED_ORDER: PileRef[] = [
    HEARTS,
    CLUBS,
    DIAMONDS,
    SPADES,
    WASTE,
    STOCK,
    column(0),
    column(1),
    column(2),
    column(3),
    column(4),
    column(5),
    column(6),
];

describe('pileOrder', () => {
    it('lists stock, waste, foundations (hearts, clubs, diamonds, spades), then the columns', () => {
        expect(pileOrder(false)).toEqual(DEFAULT_ORDER);
    });

    it('mirrors the top row when the stock is on the right', () => {
        expect(pileOrder(true)).toEqual(MIRRORED_ORDER);
    });
});

describe('moveFocus between piles', () => {
    const full = makeState({
        stock: [1, 2],
        waste: [3, 4, 5],
        foundations: foundationsOf(2, 0, 1, 0),
        tableau: tableauOf(faceUp(10), faceUp(11, 12)),
    });

    it('steps Tab through the default order and Shift+Tab back', () => {
        for (let i = 0; i < DEFAULT_ORDER.length - 1; i++) {
            const here = at(pileAt(DEFAULT_ORDER, i));
            expect(moveFocus(here, 'Tab', false, full, false)?.from).toEqual(pileAt(DEFAULT_ORDER, i + 1));
            const there = at(pileAt(DEFAULT_ORDER, i + 1));
            expect(moveFocus(there, 'Tab', true, full, false)?.from).toEqual(pileAt(DEFAULT_ORDER, i));
        }
    });

    it('steps through the mirrored order', () => {
        for (let i = 0; i < MIRRORED_ORDER.length - 1; i++) {
            const here = at(pileAt(MIRRORED_ORDER, i));
            expect(moveFocus(here, 'Tab', false, full, true)?.from).toEqual(pileAt(MIRRORED_ORDER, i + 1));
            const there = at(pileAt(MIRRORED_ORDER, i + 1));
            expect(moveFocus(there, 'Tab', true, full, true)?.from).toEqual(pileAt(MIRRORED_ORDER, i));
        }
    });

    it('returns undefined past either end, in both orders', () => {
        for (const mirrored of [false, true]) {
            const order = pileOrder(mirrored);
            const first = pileAt(order, 0);
            const last = pileAt(order, order.length - 1);
            expect(moveFocus(at(last, 0), 'Tab', false, full, mirrored)).toBeUndefined();
            expect(moveFocus(at(last, 0), 'ArrowRight', false, full, mirrored)).toBeUndefined();
            expect(moveFocus(at(first), 'Tab', true, full, mirrored)).toBeUndefined();
            expect(moveFocus(at(first), 'ArrowLeft', false, full, mirrored)).toBeUndefined();
        }
    });

    it('goes from the stock to the waste when the waste holds cards', () => {
        expect(moveFocus(at(STOCK), 'Tab', false, full, false)).toEqual(at(WASTE, 2));
    });

    it('skips an empty waste in both directions', () => {
        const state = makeState({ stock: [1], foundations: foundationsOf(1, 0, 0, 0) });
        expect(moveFocus(at(STOCK), 'Tab', false, state, false)).toEqual(at(HEARTS, 0));
        expect(moveFocus(at(HEARTS, 0), 'Tab', true, state, false)).toEqual(at(STOCK));
        expect(moveFocus(at(SPADES), 'ArrowRight', false, state, true)).toEqual(at(STOCK));
        expect(moveFocus(at(STOCK), 'ArrowLeft', false, state, true)).toEqual(at(SPADES));
    });

    it('stops on an empty foundation and an empty column with index null', () => {
        const state = makeState({ waste: [3], tableau: tableauOf([], faceUp(11)) });
        expect(moveFocus(at(WASTE, 0), 'Tab', false, state, false)).toEqual(at(HEARTS));
        expect(moveFocus(at(SPADES), 'Tab', false, state, false)).toEqual(at(column(0)));
    });

    it('moves between piles with Left and Right', () => {
        expect(moveFocus(at(WASTE, 2), 'ArrowRight', false, full, false)).toEqual(at(HEARTS, 1));
        expect(moveFocus(at(HEARTS, 1), 'ArrowLeft', false, full, false)).toEqual(at(WASTE, 2));
    });

    it('goes from the leftmost foundation to the next foundation when the stock is on the right', () => {
        expect(moveFocus(at(HEARTS, 1), 'ArrowRight', false, full, true)).toEqual(at(CLUBS, 0));
    });

    it('lands on each pile default stop', () => {
        expect(moveFocus(at(STOCK), 'ArrowRight', false, full, false)).toEqual(at(WASTE, 2));
        expect(moveFocus(at(WASTE, 2), 'ArrowRight', false, full, false)).toEqual(at(HEARTS, 1));
        expect(moveFocus(at(DIAMONDS), 'ArrowRight', false, full, false)).toEqual(at(SPADES));
        expect(moveFocus(at(SPADES), 'ArrowRight', false, full, false)).toEqual(at(column(0), 0));
        expect(moveFocus(at(column(0), 0), 'ArrowRight', false, full, false)).toEqual(at(column(1), 1));
        expect(moveFocus(at(column(1), 1), 'ArrowRight', false, full, false)).toEqual(at(column(2)));
    });

    it('lands on the stock with index null, even when it is empty', () => {
        const state = makeState({ waste: [3] });
        expect(moveFocus(at(WASTE, 0), 'ArrowLeft', false, state, false)).toEqual(at(STOCK));
    });

    it('ignores other keys', () => {
        expect(moveFocus(at(STOCK), 'Enter', false, full, false)).toBeUndefined();
        expect(moveFocus(at(STOCK), 'a', false, full, false)).toBeUndefined();
    });
});

describe('moveFocus within a column', () => {
    // three face-down cards (indices 0-2) and three face-up cards (indices 3-5)
    const state = makeState({ tableau: tableauOf(faceDown(1, 2, 3).concat(faceUp(4, 5, 6)), faceDown(7), []) });
    const col0 = column(0);

    it('moves Up and Down between face-up cards', () => {
        expect(moveFocus(at(col0, 5), 'ArrowUp', false, state, false)).toEqual(at(col0, 4));
        expect(moveFocus(at(col0, 4), 'ArrowUp', false, state, false)).toEqual(at(col0, 3));
        expect(moveFocus(at(col0, 3), 'ArrowDown', false, state, false)).toEqual(at(col0, 4));
    });

    it('stays on the topmost face-up card and on the last card', () => {
        expect(moveFocus(at(col0, 3), 'ArrowUp', false, state, false)).toEqual(at(col0, 3));
        expect(moveFocus(at(col0, 5), 'ArrowDown', false, state, false)).toEqual(at(col0, 5));
    });

    it('never returns a face-down card', () => {
        for (const key of ['ArrowUp', 'ArrowDown']) {
            for (let index = 0; index < 6; index++) {
                const target = moveFocus(at(col0, index), key, false, state, false);
                expect(target?.index).toBeGreaterThanOrEqual(3);
            }
        }
    });

    it('returns undefined for an empty or all face-down column, or a null index', () => {
        expect(moveFocus(at(column(1), 0), 'ArrowUp', false, state, false)).toBeUndefined();
        expect(moveFocus(at(column(2)), 'ArrowDown', false, state, false)).toBeUndefined();
        expect(moveFocus(at(col0), 'ArrowDown', false, state, false)).toBeUndefined();
    });

    it('returns undefined for Up and Down outside a column', () => {
        const other = makeState({ stock: [1], waste: [2, 3], foundations: foundationsOf(2, 0, 0, 0) });
        for (const key of ['ArrowUp', 'ArrowDown']) {
            expect(moveFocus(at(STOCK), key, false, other, false)).toBeUndefined();
            expect(moveFocus(at(WASTE, 1), key, false, other, false)).toBeUndefined();
            expect(moveFocus(at(HEARTS, 1), key, false, other, false)).toBeUndefined();
        }
    });
});

function key(k: string, extra: Partial<KeyEventLike> = {}): KeyEventLike {
    return { key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra };
}
const BOARD = { focus: 'board' } as const;
const OTHER = { focus: 'other' } as const;
const NONE = { focus: 'none' } as const;

describe('keyToAction', () => {
    it('maps Ctrl+Z and Cmd+Z to undo', () => {
        expect(keyToAction(key('z', { ctrlKey: true }), NONE)).toBe('undo');
        expect(keyToAction(key('Z', { ctrlKey: true }), NONE)).toBe('undo');
        expect(keyToAction(key('z', { metaKey: true }), BOARD)).toBe('undo');
    });

    it('maps Ctrl+Y, Cmd+Y and Ctrl+Shift+Z to redo', () => {
        expect(keyToAction(key('y', { ctrlKey: true }), NONE)).toBe('redo');
        expect(keyToAction(key('Y', { metaKey: true }), NONE)).toBe('redo');
        expect(keyToAction(key('Z', { ctrlKey: true, shiftKey: true }), NONE)).toBe('redo');
        expect(keyToAction(key('z', { metaKey: true, shiftKey: true }), NONE)).toBe('redo');
    });

    it('maps the plain letter shortcuts, case-insensitively', () => {
        expect(keyToAction(key('h'), NONE)).toBe('hint');
        expect(keyToAction(key('H'), NONE)).toBe('hint');
        expect(keyToAction(key('a'), NONE)).toBe('finish');
        expect(keyToAction(key('n'), NONE)).toBe('newDeal');
        expect(keyToAction(key('p'), NONE)).toBe('pause');
    });

    it('follows the physical key when the layout types a non-Latin letter', () => {
        expect(keyToAction(key('р', { code: 'KeyH' }), NONE)).toBe('hint');
        expect(keyToAction(key('ф', { code: 'KeyA' }), NONE)).toBe('finish');
        expect(keyToAction(key('я', { code: 'KeyZ', ctrlKey: true }), NONE)).toBe('undo');
        expect(keyToAction(key('Я', { code: 'KeyZ', ctrlKey: true, shiftKey: true }), NONE)).toBe('redo');
        expect(keyToAction(key('н', { code: 'KeyY', ctrlKey: true }), NONE)).toBe('redo');
    });

    it('lets a Latin letter win over a different physical key, so AZERTY and Dvorak follow their labels', () => {
        expect(keyToAction(key('h', { code: 'KeyD' }), NONE)).toBe('hint');
        expect(keyToAction(key('z', { code: 'KeyW', ctrlKey: true }), NONE)).toBe('undo');
    });

    it('does not let the physical key stand in for punctuation, dead keys or named keys', () => {
        expect(keyToAction(key(';', { code: 'KeyZ', ctrlKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('Dead', { code: 'KeyH' }), NONE)).toBeUndefined();
        expect(keyToAction(key('Process', { code: 'KeyH' }), NONE)).toBeUndefined();
        expect(keyToAction(key('Unidentified', { code: 'KeyA' }), NONE)).toBeUndefined();
        expect(keyToAction(key('1', { code: 'KeyH' }), NONE)).toBeUndefined();
        expect(keyToAction(key('р', { code: 'KeyH' }), NONE)).toBe('hint');
    });

    it('ignores a code that is not a letter key', () => {
        expect(keyToAction(key('р', { code: 'Digit1' }), NONE)).toBeUndefined();
        expect(keyToAction(key('р', { code: 'Numpad1' }), NONE)).toBeUndefined();
        expect(keyToAction(key('я', { code: 'Digit1', ctrlKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('р'), NONE)).toBeUndefined();
    });

    it('maps Escape', () => {
        expect(keyToAction(key('Escape'), NONE)).toBe('escape');
        expect(keyToAction(key('Escape'), BOARD)).toBe('escape');
    });

    it('maps Space by focus', () => {
        expect(keyToAction(key(' '), BOARD)).toBe('activate');
        expect(keyToAction(key(' '), NONE)).toBe('draw');
        expect(keyToAction(key(' '), OTHER)).toBeUndefined();
        expect(keyToAction(key('Spacebar'), NONE)).toBe('draw');
    });

    it('maps Enter only on the board', () => {
        expect(keyToAction(key('Enter'), BOARD)).toBe('activate');
        expect(keyToAction(key('Enter'), NONE)).toBeUndefined();
        expect(keyToAction(key('Enter'), OTHER)).toBeUndefined();
    });

    it('maps Shift+Enter and Shift+Space to pickUp only on the board', () => {
        expect(keyToAction(key('Enter', { shiftKey: true }), BOARD)).toBe('pickUp');
        expect(keyToAction(key(' ', { shiftKey: true }), BOARD)).toBe('pickUp');
        expect(keyToAction(key('Enter', { shiftKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key(' ', { shiftKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key(' ', { shiftKey: true }), OTHER)).toBeUndefined();
    });

    it('ignores other Ctrl or Cmd combinations and Alt combinations', () => {
        expect(keyToAction(key('h', { ctrlKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('a', { ctrlKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('n', { metaKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('Enter', { ctrlKey: true }), BOARD)).toBeUndefined();
        expect(keyToAction(key('h', { altKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('z', { ctrlKey: true, altKey: true }), NONE)).toBeUndefined();
    });

    it('ignores shifted letters and unknown keys', () => {
        expect(keyToAction(key('H', { shiftKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('a', { shiftKey: true }), NONE)).toBeUndefined();
        expect(keyToAction(key('x'), NONE)).toBeUndefined();
        expect(keyToAction(key('Tab'), NONE)).toBeUndefined();
    });

    it('ignores events aimed at text fields', () => {
        expect(keyToAction(key('h', { target: { tagName: 'INPUT' } }), NONE)).toBeUndefined();
        expect(keyToAction(key('z', { ctrlKey: true, target: { tagName: 'textarea' } }), NONE)).toBeUndefined();
        expect(keyToAction(key(' ', { target: { tagName: 'Select' } }), NONE)).toBeUndefined();
        expect(keyToAction(key('h', { target: { tagName: 'DIV', isContentEditable: true } }), NONE)).toBeUndefined();
        expect(keyToAction(key('h', { target: { tagName: 'DIV' } }), NONE)).toBe('hint');
        expect(keyToAction(key('h', { target: null }), NONE)).toBe('hint');
    });
});
