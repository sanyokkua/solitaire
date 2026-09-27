import { FOUNDATION_DISPLAY_ORDER, TABLEAU_COLS } from '../../domain/cards';
import type { PileRef } from '../../domain/types';
import type { BoardPiles } from './layout';

const STOCK: PileRef = { pile: 'stock' };
const WASTE: PileRef = { pile: 'waste' };
const FOUNDATIONS: readonly PileRef[] = FOUNDATION_DISPLAY_ORDER.map((suit): PileRef => ({ pile: 'foundation', suit }));
const COLUMNS: readonly PileRef[] = TABLEAU_COLS.map((col): PileRef => ({ pile: 'tableau', col }));

const DEFAULT_ORDER: readonly PileRef[] = [STOCK, WASTE, ...FOUNDATIONS, ...COLUMNS];
const MIRRORED_ORDER: readonly PileRef[] = [...FOUNDATIONS, WASTE, STOCK, ...COLUMNS];

const KEY_TAB = 'Tab';
const KEY_RIGHT = 'ArrowRight';
const KEY_LEFT = 'ArrowLeft';
const KEY_DOWN = 'ArrowDown';
const KEY_UP = 'ArrowUp';
const KEY_ESCAPE = 'Escape';
const KEY_ENTER = 'Enter';
const KEY_SPACE = ' ';
const KEY_SPACE_LEGACY = 'Spacebar';

/**
 * The 13 piles in the order Tab visits them. The default is the stacked top row (stock, waste, four foundations in
 * `FOUNDATION_DISPLAY_ORDER`) then the columns; with the stock on the right the top row reads left to right as the
 * foundations, the waste, the stock.
 */
export function pileOrder(stockRight: boolean): readonly PileRef[] {
    return stockRight ? MIRRORED_ORDER : DEFAULT_ORDER;
}

/** Where keyboard focus rests: a pile and the card index in it, or `null` for the pile itself. */
export interface FocusTarget {
    readonly from: PileRef;
    /** The card index in the pile; `null` is the stock, or an empty foundation or column. */
    readonly index: number | null;
}

function samePile(a: PileRef, b: PileRef): boolean {
    if (a.pile !== b.pile) {
        return false;
    }
    if (a.pile === 'foundation' && b.pile === 'foundation') {
        return a.suit === b.suit;
    }
    if (a.pile === 'tableau' && b.pile === 'tableau') {
        return a.col === b.col;
    }
    return true;
}

/** The last card index of a pile of `length` cards, or `null` when it is empty. */
function topIndex(length: number): number | null {
    return length === 0 ? null : length - 1;
}

/** A pile's default stop: the stock itself, otherwise the top card; an empty waste has none. */
export function defaultStop(from: PileRef, piles: BoardPiles): FocusTarget | undefined {
    switch (from.pile) {
        case 'stock':
            return { from, index: null };
        case 'waste':
            return piles.waste.length === 0 ? undefined : { from, index: piles.waste.length - 1 };
        case 'foundation':
            return { from, index: topIndex(piles.foundations[from.suit].length) };
        case 'tableau':
            return { from, index: topIndex(piles.tableau[from.col].length) };
    }
}

/** Steps `direction` piles from `current`, skipping an empty waste; `undefined` past either end. */
function stepPile(
    current: FocusTarget,
    direction: 1 | -1,
    piles: BoardPiles,
    stockRight: boolean,
): FocusTarget | undefined {
    const order = pileOrder(stockRight);
    let position = order.findIndex((ref) => samePile(ref, current.from)) + direction;
    for (let ref = order[position]; ref; ref = order[position]) {
        const stop = defaultStop(ref, piles);
        if (stop) {
            return stop;
        }
        position += direction;
    }
    return undefined;
}

/** Moves within a column between face-up cards, clamped at the topmost face-up and the last card. */
function stepCard(current: FocusTarget, direction: 1 | -1, piles: BoardPiles): FocusTarget | undefined {
    if (current.from.pile !== 'tableau' || current.index === null) {
        return undefined;
    }
    const cards = piles.tableau[current.from.col];
    const topmostFaceUp = cards.findIndex((card) => card.up);
    if (topmostFaceUp === -1) {
        return undefined;
    }
    const index = Math.min(cards.length - 1, Math.max(topmostFaceUp, current.index + direction));
    return { from: current.from, index };
}

/**
 * Where focus goes for a navigation key: Tab and Shift+Tab, Left and Right step between piles (an empty waste is
 * skipped, an empty foundation or column is a stop) and Up and Down step between the face-up cards of a column. The
 * result for another pile is that pile's default stop; `undefined` means the key does not move focus (past either end,
 * a clamped move off a column, or a key that is not navigation).
 */
export function moveFocus(
    current: FocusTarget,
    key: string,
    shift: boolean,
    piles: BoardPiles,
    stockRight: boolean,
): FocusTarget | undefined {
    switch (key) {
        case KEY_TAB:
            return stepPile(current, shift ? -1 : 1, piles, stockRight);
        case KEY_RIGHT:
            return stepPile(current, 1, piles, stockRight);
        case KEY_LEFT:
            return stepPile(current, -1, piles, stockRight);
        case KEY_DOWN:
            return stepCard(current, 1, piles);
        case KEY_UP:
            return stepCard(current, -1, piles);
        default:
            return undefined;
    }
}

/** What a key press means on the Game screen; the binders map each to a command. */
export type KeyAction =
    'undo' | 'redo' | 'hint' | 'finish' | 'draw' | 'escape' | 'newDeal' | 'pause' | 'activate' | 'pickUp';

/** The parts of a keyboard event the shortcut mapping reads. */
export interface KeyEventLike {
    readonly key: string;
    /** The physical key (`KeyH`), which names the letter when the layout types a non-Latin character. */
    readonly code?: string;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly target?: { readonly tagName: string; readonly isContentEditable?: boolean } | null;
}

/** Where focus is: on a board card or pile, on another control such as a toolbar button, or nowhere. */
export interface KeyContext {
    readonly focus: 'board' | 'other' | 'none';
}

const TEXT_FIELD_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const LETTER_ACTIONS: Readonly<Record<string, KeyAction>> = { h: 'hint', a: 'finish', n: 'newDeal', p: 'pause' };

function isTextField(target: KeyEventLike['target']): boolean {
    return target != null && (TEXT_FIELD_TAGS.has(target.tagName.toUpperCase()) || target.isContentEditable === true);
}

const ASCII_LETTER = /^[a-zA-Z]$/;
const LETTER_CODE = /^Key([A-Z])$/;
/** A key value that is one letter of some alphabet: the only kind that the physical key may stand in for. */
const ANY_LETTER = /^\p{L}$/u;

/**
 * The lowercase letter a key event stands for, independent of the keyboard layout: a Latin letter typed is taken as it
 * is (so AZERTY and Dvorak follow their labels), and when the layout types a letter of another alphabet (Ukrainian `р`) the
 * physical key (`KeyH`) decides. Punctuation, dead keys and named keys never borrow the physical key. `undefined` when
 * the event is neither.
 */
function letterOf(event: KeyEventLike): string | undefined {
    if (ASCII_LETTER.test(event.key)) {
        return event.key.toLowerCase();
    }
    return ANY_LETTER.test(event.key) ? LETTER_CODE.exec(event.code ?? '')?.[1]?.toLowerCase() : undefined;
}

function modifiedAction(letter: string | undefined, shift: boolean): KeyAction | undefined {
    if (letter === 'z') {
        return shift ? 'redo' : 'undo';
    }
    return letter === 'y' ? 'redo' : undefined;
}

function activationAction(
    shift: boolean,
    focus: KeyContext['focus'],
    drawsWhenNothingFocused: boolean,
): KeyAction | undefined {
    if (focus === 'board') {
        return shift ? 'pickUp' : 'activate';
    }
    return !shift && drawsWhenNothingFocused && focus === 'none' ? 'draw' : undefined;
}

/**
 * The shortcut a key event stands for, or `undefined` when it is not one. Ctrl and Command are alike; Alt and text
 * fields never trigger shortcuts. The letter shortcuts (H, A, N, P, Ctrl or Command with Z and Y) go by `letterOf`. Enter acts only on a board-focused card or pile; Space also draws when nothing
 * has focus, and Shift with either picks up the focused card.
 */
export function keyToAction(event: KeyEventLike, ctx: KeyContext): KeyAction | undefined {
    if (isTextField(event.target) || event.altKey) {
        return undefined;
    }
    if (event.ctrlKey || event.metaKey) {
        return modifiedAction(letterOf(event), event.shiftKey);
    }
    switch (event.key) {
        case KEY_ESCAPE:
            return 'escape';
        case KEY_ENTER:
            return activationAction(event.shiftKey, ctx.focus, false);
        case KEY_SPACE:
        case KEY_SPACE_LEGACY:
            return activationAction(event.shiftKey, ctx.focus, true);
        default: {
            const letter = letterOf(event);
            return event.shiftKey || letter === undefined ? undefined : LETTER_ACTIONS[letter];
        }
    }
}
