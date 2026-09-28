import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, RefObject } from 'react';
import { useAppSelector } from '../../app/hooks';
import type { CardId, PileRef } from '../../domain/types';
import { selectEpoch } from '../../features/game/gameSlice';
import { pileKey, type CardLocation } from './locate';
import type { BoardPiles } from './layout';
import { defaultStop, keyToAction, moveFocus, pileOrder, type FocusTarget } from './keyboardController';
import type { BoardActions } from './useBoardActions';
import type { Hit } from './pointerController';
import { selectCardLocations } from './selectors';

interface BoardKeyboardInput extends BoardActions {
    /** The `div.board` the handlers are spread on; `null` until the first size arrives. */
    readonly boardRef: RefObject<HTMLDivElement | null>;
    /** The five piles in play, `null` while there is no game. */
    readonly piles: BoardPiles | null;
    /** Whether the stock is on the right, which mirrors the Tab order. */
    readonly stockRight: boolean;
}

export interface BoardKeyboard {
    /** Where keyboard focus rests; exactly one element on the board is the tab stop for it. */
    readonly target: FocusTarget;
    /** Spread on the `div.board`: React's `onKeyDown` and `onFocus` bubble from every card and slot inside it. */
    readonly handlers: {
        readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
        readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void;
    };
}

/**
 * The last place focus rested: a pile and, when it was on a card, that card, so the position survives a move. It
 * belongs to one game epoch: card ids are reused by the next deal, so an anchor from an earlier game is ignored.
 */
interface Anchor {
    readonly pile: PileRef;
    readonly cardId: CardId | null;
    readonly epoch: number;
}

/** The card focus last rested on in each pile (by `pileKey`) during one game epoch. */
interface Remembered {
    epoch: number;
    cards: Map<string, CardId>;
}

const STOCK: PileRef = { pile: 'stock' };
const STOCK_TARGET: FocusTarget = { from: STOCK, index: null };
const NAVIGATION_KEYS: ReadonlySet<string> = new Set(['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/** The tab stop of the element at (`from`, `index`), where `index` is `null` for a pile's own slot. */
export function tabIndexOf(target: FocusTarget, from: PileRef, index: number | null): 0 | -1 {
    return target.index === index && pileKey(target.from) === pileKey(from) ? 0 : -1;
}

/** The id of the card at `index` in a pile, or `undefined` when there is none. */
function cardAt(piles: BoardPiles, from: PileRef, index: number): CardId | undefined {
    switch (from.pile) {
        case 'stock':
            return piles.stock[index];
        case 'waste':
            return piles.waste[index];
        case 'foundation':
            return piles.foundations[from.suit][index];
        case 'tableau':
            return piles.tableau[from.col][index]?.id;
    }
}

/** The element a focus target names: a card by its pile and index, or a pile's slot. */
function stopElement(board: HTMLElement, target: FocusTarget): HTMLElement | null {
    const key = pileKey(target.from);
    return board.querySelector<HTMLElement>(
        target.index === null
            ? `.slot[data-pile='${key}']`
            : `.card[data-pile='${key}'][data-index='${String(target.index)}']`,
    );
}

/**
 * The same `Hit` a pointer press on the target would produce, for the shared `activate` and `pickUp`; a card is
 * movable as `selectCardLocations` says, like a pointer press.
 */
function hitOf(target: FocusTarget, piles: BoardPiles, locations: ReadonlyMap<CardId, CardLocation> | null): Hit {
    const { from, index } = target;
    if (from.pile === 'stock') return { kind: 'stock' };
    if (index !== null) {
        const id = cardAt(piles, from, index);
        return id === undefined
            ? { kind: 'none' }
            : { kind: 'card', id, from, index, movable: locations?.get(id)?.movable === true };
    }
    if (from.pile === 'tableau') return { kind: 'column', col: from.col };
    return { kind: 'slot', ref: from };
}

/**
 * Keyboard focus of the table (D3, D6): one roving tab stop, moved by Tab, Shift+Tab and the arrow keys through
 * `moveFocus`, and Enter or Space acting as a tap on it (`activate`), Shift+Enter or Shift+Space as a pick-up
 * (`pickUp`); a held key acts once, its auto-repeat is prevented and dropped, while the navigation keys keep repeating.
 * The position is an anchor (a pile and the card focus last rested on), so it follows a card that moves and,
 * when that card can no longer be picked up, falls back to the stop of the pile it is in now (the top card; an empty waste has none, so
 * the stock). Focus itself is moved by calling `focus()` on the persistent card and slot elements. A pile remembers the
 * card focus last rested on in it, which Tab and the horizontal arrows return to. Tab and Shift+Tab are left alone at
 * either end of the board so the browser moves on to the next control; arrow keys are always taken, so the page never
 * scrolls. Keys with Ctrl, Command or Alt are left to the global shortcuts. A new game (a new `selectEpoch`) resets the
 * position to the stock and forgets every remembered card, since the next deal reuses the card ids.
 */
export function useBoardKeyboard({ boardRef, piles, stockRight, activate, pickUp }: BoardKeyboardInput): BoardKeyboard {
    const locations = useAppSelector(selectCardLocations);
    const epoch = useAppSelector(selectEpoch);
    const [saved, setAnchor] = useState<Anchor>({ pile: STOCK, cardId: null, epoch });
    const anchor: Anchor = saved.epoch === epoch ? saved : { pile: STOCK, cardId: null, epoch };
    const remembered = useRef<Remembered>({ epoch, cards: new Map() });
    /** Whether the previous run of the focus-restore effect below left focus resting inside the board. */
    const hadBoardFocus = useRef(false);

    const target = useMemo((): FocusTarget => {
        const location = anchor.cardId === null ? undefined : locations?.get(anchor.cardId);
        if (location?.movable === true) return { from: location.from, index: location.index };
        const pile = location?.from ?? anchor.pile;
        return (piles === null ? undefined : defaultStop(pile, piles)) ?? STOCK_TARGET;
    }, [anchor.pile, anchor.cardId, locations, piles]);

    // The focused card may have stopped being a tab stop (undo, or a card placed on it): follow the target instead.
    // A placed card can also leave its slot with no tab index at all (an empty foundation or column that just
    // received one), which the browser reacts to by blurring straight to <body> before this effect runs; when that
    // just happened to focus that was inside the board a moment ago, reclaim it the same way. A deliberate move to
    // another real control (e.g. a toolbar button) is left alone, since that is never <body>.
    useLayoutEffect(() => {
        const board = boardRef.current;
        if (board === null) return;
        const active = document.activeElement;
        const insideBoard = active instanceof HTMLElement && active !== board && board.contains(active);
        const lostToBody = !insideBoard && hadBoardFocus.current && active === document.body;
        if (insideBoard || lostToBody) {
            const el = stopElement(board, target);
            if (el !== null && el !== active) el.focus();
        }
        const after = document.activeElement;
        hadBoardFocus.current = after instanceof HTMLElement && after !== board && board.contains(after);
    });

    /** Another pile's stop is its remembered card when that is still in it and can be picked up. */
    const withMemory = (next: FocusTarget): FocusTarget => {
        const key = pileKey(next.from);
        const id = remembered.current.epoch === epoch ? remembered.current.cards.get(key) : undefined;
        const location = id === undefined ? undefined : locations?.get(id);
        return location?.movable === true && pileKey(location.from) === key
            ? { from: location.from, index: location.index }
            : next;
    };

    const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key !== 'Tab') event.preventDefault();
        const board = boardRef.current;
        if (board === null || piles === null) return;
        const moved = moveFocus(target, event.key, event.shiftKey, piles, stockRight);
        if (moved === undefined) return;
        const next = pileKey(moved.from) === pileKey(target.from) ? moved : withMemory(moved);
        const el = stopElement(board, next);
        if (el === null) return;
        event.preventDefault();
        el.focus();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (NAVIGATION_KEYS.has(event.key)) {
            navigate(event);
            return;
        }
        const action = keyToAction(
            {
                key: event.key,
                code: event.code,
                ctrlKey: false,
                metaKey: false,
                shiftKey: event.shiftKey,
                altKey: false,
                target: event.target instanceof Element ? event.target : null,
            },
            { focus: 'board' },
        );
        if ((action !== 'activate' && action !== 'pickUp') || piles === null) return;
        event.preventDefault();
        if (event.repeat) return;
        const hit = hitOf(target, piles, locations);
        if (action === 'activate') activate(hit);
        else pickUp(hit);
    };

    const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
        if (!(event.target instanceof HTMLElement)) return;
        const card = event.target.closest<HTMLElement>('[data-card-id]');
        if (card !== null) {
            const id = Number(card.dataset.cardId);
            const location = locations?.get(id);
            if (location?.movable !== true) return;
            if (remembered.current.epoch !== epoch) remembered.current = { epoch, cards: new Map() };
            remembered.current.cards.set(pileKey(location.from), id);
            setAnchor({ pile: location.from, cardId: id, epoch });
            return;
        }
        const key = event.target.closest<HTMLElement>('.slot')?.dataset.pile;
        const pile = pileOrder(stockRight).find((ref) => pileKey(ref) === key);
        if (pile !== undefined) setAnchor({ pile, cardId: null, epoch });
    };

    return { target, handlers: { onKeyDown, onFocus } };
}
