import type { CardId, PileRef, TableauCol } from '../../domain/types';

/** The kind of pointing device behind an event; touch and pen share one drag threshold. */
export type PointerKind = 'mouse' | 'touch' | 'pen';

/** What the binder found under the pointer, resolved before the event reaches the controller. */
export type Hit =
    | {
          readonly kind: 'card';
          readonly id: CardId;
          readonly from: PileRef;
          readonly index: number;
          readonly movable: boolean;
      }
    | { readonly kind: 'slot'; readonly ref: PileRef }
    | { readonly kind: 'stock' }
    | { readonly kind: 'column'; readonly col: TableauCol }
    | { readonly kind: 'none' };

/** A hit on a card. */
export type CardHit = Extract<Hit, { kind: 'card' }>;

/** Plain-data input events; `t` is a millisecond timestamp supplied by the caller. */
export type Input =
    | {
          readonly type: 'down';
          readonly pointerId: number;
          readonly kind: PointerKind;
          readonly button: number;
          readonly x: number;
          readonly y: number;
          readonly t: number;
          readonly hit: Hit;
      }
    | { readonly type: 'move'; readonly pointerId: number; readonly x: number; readonly y: number }
    | {
          readonly type: 'up';
          readonly pointerId: number;
          readonly x: number;
          readonly y: number;
          readonly t: number;
          readonly hit: Hit;
      }
    | { readonly type: 'cancel' }
    | { readonly type: 'escape' }
    | { readonly type: 'resize' }
    | { readonly type: 'gateClosed' };

/** What the binder must do in response to an input. */
export type Effect =
    | { readonly type: 'tap'; readonly hit: Hit; readonly double: boolean }
    | { readonly type: 'dragStart'; readonly card: CardHit }
    | { readonly type: 'dragMove'; readonly dx: number; readonly dy: number }
    | { readonly type: 'drop'; readonly dx: number; readonly dy: number }
    | { readonly type: 'cancel' };

/** The previous tap on a card, kept to recognise a double-tap. */
export interface LastTap {
    /** The tapped card. */
    readonly id: CardId;
    /** The release timestamp of that tap. */
    readonly t: number;
}

interface Carried {
    /** The last tap on a card, or `null` once a tap landed elsewhere. */
    readonly lastTap: LastTap | null;
    /** True after a drag ended or was cancelled, until the next `down`; the binder swallows the click that follows. */
    readonly suppressClick: boolean;
}

interface Press extends Carried {
    readonly pointerId: number;
    readonly x: number;
    readonly y: number;
}

/** The controller's state: nothing pressed, a press that may still be a tap, or a drag in progress. */
export type PointerState =
    | (Carried & { readonly phase: 'idle' })
    | (Press & { readonly phase: 'pressed'; readonly kind: PointerKind; readonly hit: Hit })
    | (Press & { readonly phase: 'dragging' });

/** The result of one step: the next state and the effects for the binder to apply, in order. */
export interface StepResult {
    readonly state: PointerState;
    readonly effects: readonly Effect[];
}

/** Distance in pixels a mouse must move, strictly, from the press point before a drag starts. */
export const MOUSE_DRAG_THRESHOLD = 5;
/** Distance in pixels touch or pen must move, strictly, from the press point before a drag starts. */
export const TOUCH_DRAG_THRESHOLD = 9;
/** Two taps on the same card strictly less than this many milliseconds apart are a double-tap. */
export const DOUBLE_TAP_MS = 320;

/** The state before any pointer activity. */
export const initialPointerState: PointerState = { phase: 'idle', lastTap: null, suppressClick: false };

const NO_EFFECTS: readonly Effect[] = [];

function dragThreshold(kind: PointerKind): number {
    return kind === 'mouse' ? MOUSE_DRAG_THRESHOLD : TOUCH_DRAG_THRESHOLD;
}

/** Only a movable card outside the stock can be picked up; every other target only taps. */
function isDraggable(hit: Hit): hit is CardHit {
    return hit.kind === 'card' && hit.movable && hit.from.pile !== 'stock';
}

function idle(previous: Carried, suppressClick: boolean): PointerState {
    return { phase: 'idle', lastTap: previous.lastTap, suppressClick };
}

function onDown(state: PointerState, input: Extract<Input, { type: 'down' }>): StepResult {
    if (state.phase !== 'idle' || (input.kind === 'mouse' && input.button !== 0)) {
        return { state, effects: NO_EFFECTS };
    }
    return {
        state: {
            phase: 'pressed',
            pointerId: input.pointerId,
            kind: input.kind,
            x: input.x,
            y: input.y,
            hit: input.hit,
            lastTap: state.lastTap,
            suppressClick: false,
        },
        effects: NO_EFFECTS,
    };
}

function onMove(state: PointerState, input: Extract<Input, { type: 'move' }>): StepResult {
    if (state.phase === 'idle' || state.pointerId !== input.pointerId) {
        return { state, effects: NO_EFFECTS };
    }
    const dx = input.x - state.x;
    const dy = input.y - state.y;
    if (state.phase === 'dragging') {
        return { state, effects: [{ type: 'dragMove', dx, dy }] };
    }
    if (!isDraggable(state.hit) || Math.hypot(dx, dy) <= dragThreshold(state.kind)) {
        return { state, effects: NO_EFFECTS };
    }
    return {
        state: {
            phase: 'dragging',
            pointerId: state.pointerId,
            x: state.x,
            y: state.y,
            lastTap: state.lastTap,
            suppressClick: state.suppressClick,
        },
        effects: [
            { type: 'dragStart', card: state.hit },
            { type: 'dragMove', dx, dy },
        ],
    };
}

function onUp(state: PointerState, input: Extract<Input, { type: 'up' }>): StepResult {
    if (state.phase === 'idle' || state.pointerId !== input.pointerId) {
        return { state, effects: NO_EFFECTS };
    }
    if (state.phase === 'dragging') {
        return { state: idle(state, true), effects: [{ type: 'drop', dx: input.x - state.x, dy: input.y - state.y }] };
    }
    // A tap acts on what was pressed, not on what the release resolved to.
    const { hit } = state;
    if (hit.kind !== 'card') {
        return {
            state: { phase: 'idle', lastTap: null, suppressClick: false },
            effects: [{ type: 'tap', hit, double: false }],
        };
    }
    const double = state.lastTap?.id === hit.id && input.t - state.lastTap.t < DOUBLE_TAP_MS;
    return {
        state: { phase: 'idle', lastTap: { id: hit.id, t: input.t }, suppressClick: false },
        effects: [{ type: 'tap', hit, double }],
    };
}

function onAbort(state: PointerState): StepResult {
    switch (state.phase) {
        case 'idle':
            return { state, effects: NO_EFFECTS };
        case 'pressed':
            return { state: idle(state, state.suppressClick), effects: NO_EFFECTS };
        case 'dragging':
            return { state: idle(state, true), effects: [{ type: 'cancel' }] };
    }
}

/**
 * Advances the pointer state machine by one input. Pure: it never mutates `state` and reads no clock, so every
 * timestamp comes from the inputs.
 *
 * A press starts on `down` in idle (primary mouse button only) and is bound to that `pointerId`; events from any other
 * pointer are ignored. A press whose target is a movable card outside the stock becomes a drag once the pointer is
 * strictly more than 5 px (mouse) or 9 px (touch, pen) from the press point; every other press can only tap. A release
 * before a drag starts is a tap on the pressed target, marked `double` when the previous tap was on the same card less
 * than 320 ms earlier. A release after a drag starts is a `drop` with no tap, and sets `suppressClick` until the next
 * `down`. `cancel`, `escape`, `resize` and `gateClosed` end a drag with a `cancel` effect, drop a plain press silently,
 * and leave an idle controller alone.
 */
export function step(state: PointerState, input: Input): StepResult {
    switch (input.type) {
        case 'down':
            return onDown(state, input);
        case 'move':
            return onMove(state, input);
        case 'up':
            return onUp(state, input);
        case 'cancel':
        case 'escape':
        case 'resize':
        case 'gateClosed':
            return onAbort(state);
    }
}
