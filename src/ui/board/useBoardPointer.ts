import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useAppSelector, useAppDispatch, useAppStore } from '../../app/hooks';
import type { PileRef } from '../../domain/types';
import { play } from '../../features/game/gameThunks';
import { hintCleared, selectionCleared } from '../../features/interaction/interactionSlice';
import { selectCard } from '../../features/interaction/interactionThunks';
import { selectInputEnabled, selectLegalTargets, selectSelectedGroup } from '../../features/interaction/selectors';
import { cardElement } from './dom';
import { landingAreas, pickLargestOverlap, pileAt, type Rect } from './landing';
import { pileKey } from './locate';
import type { BoardPiles, Layout, Point } from './layout';
import type { Metrics } from './metrics';
import {
    initialPointerState,
    step,
    type CardHit,
    type Effect,
    type Hit,
    type Input,
    type PointerKind,
    type PointerState,
} from './pointerController';
import { selectCardLocations } from './selectors';

interface BoardPointerInput {
    /** The `div.board` the listeners attach to; `null` until the first size arrives. */
    readonly boardRef: RefObject<HTMLDivElement | null>;
    /** This render's layout and metrics, `null` until the board has a size. */
    readonly layout: Layout | null;
    readonly metrics: Metrics | null;
    /** The five piles the layout was made from, `null` while there is no game. */
    readonly piles: BoardPiles | null;
    /** What a tap does (`useBoardActions`): the hook only recognises the tap and resolves its `Hit`. */
    readonly activate: (hit: Hit, double: boolean) => void;
}

/** A drag in progress: the picked-up run and everything its drop needs, fixed when the drag started. */
interface Drag {
    readonly els: readonly HTMLElement[];
    readonly from: PileRef;
    readonly index: number;
    /** Where the run's first card sat on the board when it was picked up. */
    readonly origin: Point;
    readonly areas: ReadonlyMap<string, Rect>;
    readonly targets: readonly PileRef[];
}

const DRAG_CLASS = 'is-dragging';
const DRAG_PROPS = ['--dx', '--dy', '--k'] as const;

const POINTER_KINDS: Readonly<Record<string, PointerKind>> = { mouse: 'mouse', touch: 'touch', pen: 'pen' };

function clearDrag(drag: Drag): void {
    for (const el of drag.els) {
        el.classList.remove(DRAG_CLASS);
        for (const name of DRAG_PROPS) {
            el.style.removeProperty(name);
        }
    }
}

/** The legal target the dragged run, offset by (`dx`, `dy`) from where it was picked up, overlaps most. */
function dropTarget(drag: Drag, metrics: Metrics, dx: number, dy: number): PileRef | undefined {
    return pickLargestOverlap(
        { x: drag.origin.x + dx, y: drag.origin.y + dy, w: metrics.cw, h: metrics.ch },
        drag.areas,
        drag.targets,
    );
}

function tryPointerCapture(action: 'set' | 'release', board: HTMLElement, pointerId: number): void {
    try {
        if (action === 'set') board.setPointerCapture(pointerId);
        else board.releasePointerCapture(pointerId);
    } catch {
        // The pointer is already gone (or capture is unsupported); the drag still works from the board's own events.
    }
}

/**
 * Drives the mouse, touch and pen drag of the table (D3, D4): delegated pointer listeners on the board element feed the
 * pointer controller, whose effects are applied here. A press on a card or a pile resolves to a `Hit`; the press is
 * captured so the drag keeps receiving events outside the board. A drag past the threshold picks the run up
 * (`selectCard`, so the ghosts show), adds `is-dragging` and a `--k` stacking key to its cards, and writes `--dx` and
 * `--dy` straight on those elements each frame: no React state is touched per pointer frame. A release plays the move to
 * the legal target with the largest overlap, or lets the offset glide back; either way the selection the drag made is
 * cleared. The `click` a browser sends after a drag is swallowed. Escape (only while dragging), `pointercancel`, a lost
 * capture, a resize and a closing input gate cancel the drag. A `tap` effect goes to `activate` (`useBoardActions`), the function pointer and keyboard share.
 *
 * The listeners bind once per board element and read the latest layout, metrics and piles through a ref. Global
 * shortcuts (7.3) must not handle Escape a second time while this hook is dragging.
 */
export function useBoardPointer({ boardRef, layout, metrics, piles, activate }: BoardPointerInput): void {
    const store = useAppStore();
    const dispatch = useAppDispatch();
    const enabled = useAppSelector(selectInputEnabled);
    const active = layout !== null && metrics !== null;
    const latest = useRef({ layout, metrics, piles });
    const feedRef = useRef<((input: Input) => void) | null>(null);
    const markDragRef = useRef<(() => void) | null>(null);

    useLayoutEffect(() => {
        latest.current = { layout, metrics, piles };
    });

    // React rewrites a card's whole `class` when its `is-selected` flips, which drops the `is-dragging` this hook added
    // by hand; putting it back after each commit, before paint, keeps the dragged run lifted.
    useLayoutEffect(() => {
        markDragRef.current?.();
    });

    useEffect(() => {
        const board = boardRef.current;
        if (!active || board === null) return undefined;

        let state: PointerState = initialPointerState;
        let drag: Drag | null = null;

        const cardHit = (target: EventTarget | null): CardHit | undefined => {
            const el = target instanceof Element ? target.closest<HTMLElement>('[data-card-id]') : null;
            const id = Number(el?.dataset.cardId);
            const location = el === null ? undefined : selectCardLocations(store.getState())?.get(id);
            return location === undefined ? undefined : { kind: 'card', id, ...location };
        };

        const hitAt = (event: PointerEvent): Hit => {
            const card = cardHit(event.target);
            if (card !== undefined) return card;
            const { layout: current, metrics: measured, piles: pilesNow } = latest.current;
            if (current === null || measured === null || pilesNow === null) return { kind: 'none' };
            const rect = board.getBoundingClientRect();
            const ref = pileAt(landingAreas(current, measured, pilesNow), {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            });
            if (ref === undefined) return { kind: 'none' };
            if (ref.pile === 'stock') return { kind: 'stock' };
            return ref.pile === 'tableau' ? { kind: 'column', col: ref.col } : { kind: 'slot', ref };
        };

        const markDrag = (): void => {
            drag?.els.forEach((el) => {
                el.classList.add(DRAG_CLASS);
            });
        };
        markDragRef.current = markDrag;

        const startDrag = ({ from, index }: CardHit): void => {
            dispatch(selectCard(from, index));
            const group = selectSelectedGroup(store.getState());
            const targets = selectLegalTargets(store.getState());
            const { layout: current, metrics: measured, piles: pilesNow } = latest.current;
            const origin = group?.[0] === undefined ? undefined : current?.cards.get(group[0]);
            if (
                group === undefined ||
                targets === undefined ||
                origin === undefined ||
                current === null ||
                measured === null ||
                pilesNow === null
            ) {
                dispatch(selectionCleared());
                feed({ type: 'cancel' });
                return;
            }
            const els = group.flatMap((id) => {
                const el = cardElement(board, id);
                return el === null ? [] : [el];
            });
            els.forEach((el, k) => {
                el.style.setProperty('--k', String(k));
            });
            drag = { els, from, index, origin, areas: landingAreas(current, measured, pilesNow), targets };
            markDrag();
        };

        const endDrag = (): Drag | null => {
            const ended = drag;
            drag = null;
            if (ended !== null) {
                clearDrag(ended);
                dispatch(selectionCleared());
            }
            return ended;
        };

        const apply = (effect: Effect): void => {
            switch (effect.type) {
                case 'tap':
                    activate(effect.hit, effect.double);
                    return;
                case 'dragStart':
                    startDrag(effect.card);
                    return;
                case 'dragMove': {
                    if (drag === null) return;
                    for (const el of drag.els) {
                        el.style.setProperty('--dx', `${String(effect.dx)}px`);
                        el.style.setProperty('--dy', `${String(effect.dy)}px`);
                    }
                    const { metrics: measured } = latest.current;
                    const winner = measured === null ? undefined : dropTarget(drag, measured, effect.dx, effect.dy);
                    const winnerKey = winner === undefined ? undefined : pileKey(winner);
                    for (const ghost of board.querySelectorAll<HTMLElement>('.ghost[data-ghost]')) {
                        ghost.classList.toggle('is-hot', ghost.dataset.ghost === winnerKey);
                    }
                    return;
                }
                case 'drop': {
                    const { metrics: measured } = latest.current;
                    const ended = endDrag();
                    if (ended === null || measured === null) return;
                    const to = dropTarget(ended, measured, effect.dx, effect.dy);
                    if (to !== undefined)
                        void dispatch(play({ type: 'move', from: ended.from, index: ended.index, to }));
                    return;
                }
                case 'cancel':
                    endDrag();
                    return;
            }
        };

        function feed(input: Input): void {
            const result = step(state, input);
            state = result.state;
            result.effects.forEach(apply);
        }
        feedRef.current = feed;

        const onDown = (event: PointerEvent): void => {
            if (!selectInputEnabled(store.getState())) return;
            if (store.getState().interaction.hint !== null) dispatch(hintCleared());
            const kind = POINTER_KINDS[event.pointerType] ?? 'mouse';
            feed({
                type: 'down',
                pointerId: event.pointerId,
                kind,
                button: event.button,
                x: event.clientX,
                y: event.clientY,
                t: event.timeStamp,
                hit: hitAt(event),
            });
            if (state.phase === 'pressed' && state.pointerId === event.pointerId) {
                tryPointerCapture('set', board, event.pointerId);
            }
        };
        const onMove = (event: PointerEvent): void => {
            feed({ type: 'move', pointerId: event.pointerId, x: event.clientX, y: event.clientY });
        };
        const onUp = (event: PointerEvent): void => {
            const owned = state.phase !== 'idle' && state.pointerId === event.pointerId;
            feed({
                type: 'up',
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                t: event.timeStamp,
                hit: { kind: 'none' },
            });
            if (owned) tryPointerCapture('release', board, event.pointerId);
        };
        const onAbort = (): void => {
            feed({ type: 'cancel' });
        };
        const onClick = (event: MouseEvent): void => {
            if (!state.suppressClick) return;
            event.stopPropagation();
            event.preventDefault();
        };
        const onContextMenu = (event: Event): void => {
            event.preventDefault();
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape' || state.phase !== 'dragging') return;
            event.preventDefault();
            feed({ type: 'escape' });
        };

        board.addEventListener('pointerdown', onDown);
        board.addEventListener('pointermove', onMove);
        board.addEventListener('pointerup', onUp);
        board.addEventListener('pointercancel', onAbort);
        board.addEventListener('lostpointercapture', onAbort);
        board.addEventListener('click', onClick, true);
        board.addEventListener('contextmenu', onContextMenu);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            feed({ type: 'cancel' });
            feedRef.current = null;
            markDragRef.current = null;
            board.removeEventListener('pointerdown', onDown);
            board.removeEventListener('pointermove', onMove);
            board.removeEventListener('pointerup', onUp);
            board.removeEventListener('pointercancel', onAbort);
            board.removeEventListener('lostpointercapture', onAbort);
            board.removeEventListener('click', onClick, true);
            board.removeEventListener('contextmenu', onContextMenu);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [boardRef, active, store, dispatch, activate]);

    // A drag's coordinates belong to one layout: a new size or pointer type ends it.
    useEffect(() => {
        feedRef.current?.({ type: 'resize' });
    }, [metrics]);

    // A drag's source, index and targets belong to one position: any change to the piles (undo, redo, another command)
    // ends it. A drop's own move plays after the drag has ended, so it never cancels itself.
    useEffect(() => {
        feedRef.current?.({ type: 'cancel' });
    }, [piles]);

    useEffect(() => {
        if (!enabled) feedRef.current?.({ type: 'gateClosed' });
    }, [enabled]);
}
