import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useAppDispatch, useAppStore } from '../../app/hooks';
import { selectReducedMotion } from '../../app/selectors';
import type { AppDispatch, RootState } from '../../app/store';
import { suitOf } from '../../domain/cards';
import { canDrop, groupAt } from '../../domain/rules';
import { bestTarget } from '../../domain/smartTap';
import type { CardId, GameState, PileRef } from '../../domain/types';
import { play } from '../../features/game/gameThunks';
import { announced, selectionCleared, type Selection } from '../../features/interaction/interactionSlice';
import { selectCard } from '../../features/interaction/interactionThunks';
import { selectInputEnabled, selectLegalTargets, selectSelection } from '../../features/interaction/selectors';
import { selectPreference } from '../../features/preferences/preferencesSlice';
import { SHAKE_CLEAR_MS } from './constants';
import { pileKey } from './landing';
import type { CardHit, Hit } from './pointerController';

const SHAKE_CLASS = 'is-shake';

/** The pile a tap on `hit` lands on: a card's own pile, a slot's pile, a column's area; none for empty space. */
function pileOf(hit: Hit): PileRef | undefined {
    switch (hit.kind) {
        case 'card':
            return hit.from;
        case 'slot':
            return hit.ref;
        case 'column':
            return { pile: 'tableau', col: hit.col };
        case 'stock':
        case 'none':
            return undefined;
    }
}

/** The foundation a double-tapped card goes home to: its suit's, when it is a lone card that fits there. */
function doubleTapHome(current: GameState, hit: CardHit): PileRef | undefined {
    const group = groupAt(current, hit.from, hit.index);
    const lowest = group?.[0];
    if (group === undefined || lowest === undefined) return undefined;
    const home: PileRef = { pile: 'foundation', suit: suitOf(lowest) };
    return canDrop(current, group, home) ? home : undefined;
}

const isSelected = (selection: Selection | null, hit: CardHit): boolean =>
    selection !== null && pileKey(selection.from) === pileKey(hit.from) && selection.index === hit.index;

/**
 * A tap under Select and place, or with a card already picked up in either mode (D11): a fitting double-tap sends the
 * card home; a tap on a legal target places the selection (placing wins over re-selecting); another movable card
 * becomes the selection; the selected card or anywhere else clears it; with nothing selected a movable card is picked.
 */
function selectAndPlace(state: RootState, dispatch: AppDispatch, current: GameState, hit: Hit, double: boolean): void {
    if (double && hit.kind === 'card' && hit.movable) {
        const to = doubleTapHome(current, hit);
        if (to !== undefined) {
            void dispatch(play({ type: 'move', from: hit.from, index: hit.index, to }));
            return;
        }
    }
    const selection = selectSelection(state);
    const target = pileOf(hit);
    if (selection !== null && target !== undefined) {
        const key = pileKey(target);
        if (selectLegalTargets(state)?.some((legal) => pileKey(legal) === key) === true) {
            void dispatch(play({ type: 'move', from: selection.from, index: selection.index, to: target }));
            return;
        }
    }
    if (hit.kind === 'card' && hit.movable && !isSelected(selection, hit)) {
        dispatch(selectCard(hit.from, hit.index));
    } else if (selection !== null) {
        dispatch(selectionCleared());
    }
}

/** What the board's input paths do: `activate` is a tap or Enter/Space, `pickUp` is Shift+Enter/Space. */
export interface BoardActions {
    readonly activate: (hit: Hit, double?: boolean) => void;
    readonly pickUp: (hit: Hit) => void;
}

/**
 * The functions every input path shares (D11). `activate(hit, double)` turns a tap, or a keyboard Enter or Space, into
 * a command, a selection change or a shake. Both are stable and read the store when called, so the pointer listeners,
 * bound once per board element, always act on the position in play; both do nothing while the input gate is closed. A
 * stock hit draws. With a card already picked up, in either tap mode, `selectAndPlace` decides. In smart mode with
 * nothing selected a tap on a movable card plays its `bestTarget`, or, when nothing accepts it, announces the refusal
 * and shakes the run (only the announcement under reduced motion); the second tap of a double tap is always ignored
 * there, since its first tap has already acted. Under Select and place `selectAndPlace` decides as well.
 * `pickUp(hit)` is the keyboard's Shift+Enter or Shift+Space, whatever the tap mode: on a movable card it selects the
 * run, or clears the selection when that card is already the selection; on anything else it does nothing.
 */
export function useBoardActions(boardRef: RefObject<HTMLDivElement | null>): BoardActions {
    const store = useAppStore();
    const dispatch = useAppDispatch();
    const timers = useRef(new Map<HTMLElement, number>());

    const shake = useCallback(
        (ids: readonly CardId[]): void => {
            const board = boardRef.current;
            if (board === null) return;
            for (const id of ids) {
                const el = board.querySelector<HTMLElement>(`[data-card-id='${String(id)}']`);
                if (el === null) continue;
                window.clearTimeout(timers.current.get(el));
                el.classList.remove(SHAKE_CLASS);
                void el.getBoundingClientRect(); // a reflow, so the animation restarts when the card is refused again
                el.classList.add(SHAKE_CLASS);
                timers.current.set(
                    el,
                    window.setTimeout(() => {
                        el.classList.remove(SHAKE_CLASS);
                        timers.current.delete(el);
                    }, SHAKE_CLEAR_MS),
                );
            }
        },
        [boardRef],
    );

    useEffect(() => {
        const pending = timers.current;
        return () => {
            for (const [el, timer] of pending) {
                window.clearTimeout(timer);
                el.classList.remove(SHAKE_CLASS);
            }
            pending.clear();
        };
    }, []);

    const activate = useCallback(
        (hit: Hit, double = false): void => {
            const state = store.getState();
            if (!selectInputEnabled(state)) return;
            if (hit.kind === 'stock' || (hit.kind === 'card' && hit.from.pile === 'stock')) {
                void dispatch(play({ type: 'draw' }));
                return;
            }
            const current = state.game.current;
            if (current === null) return;
            const smart = selectPreference(state, 'tapMode') === 'smart';
            if (double && smart) return;
            if (!smart || selectSelection(state) !== null) {
                selectAndPlace(state, dispatch, current, hit, double);
                return;
            }
            if (hit.kind !== 'card' || !hit.movable) return;
            const to = bestTarget(current, hit.from, hit.index);
            if (to !== undefined) {
                void dispatch(play({ type: 'move', from: hit.from, index: hit.index, to }));
                return;
            }
            dispatch(announced([{ type: 'refused', reason: 'illegal-target' }]));
            if (!selectReducedMotion(state)) shake(groupAt(current, hit.from, hit.index) ?? []);
        },
        [store, dispatch, shake],
    );

    const pickUp = useCallback(
        (hit: Hit): void => {
            const state = store.getState();
            if (!selectInputEnabled(state) || hit.kind !== 'card' || !hit.movable) return;
            if (isSelected(selectSelection(state), hit)) {
                dispatch(selectionCleared());
            } else {
                dispatch(selectCard(hit.from, hit.index));
            }
        },
        [store, dispatch],
    );

    return useMemo(() => ({ activate, pickUp }), [activate, pickUp]);
}
