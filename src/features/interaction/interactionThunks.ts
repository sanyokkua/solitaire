import { noticeRaised } from '../../app/appSlice';
import type { AppThunk } from '../../app/appThunk';
import { advise, isDeadEnd } from '../../domain/deadEnd';
import { positionKey } from '../../domain/position';
import { groupAt } from '../../domain/rules';
import type { PileRef } from '../../domain/types';
import type { SolverHint } from '../../solver/hint';
import {
    announced,
    deadEndRecorded,
    hintCleared,
    hintSet,
    pendingHintSet,
    selectionCleared,
    selectionSet,
} from './interactionSlice';
import type { HintView } from './interactionSlice';
import { selectNextHintId } from './selectors';

/** How long a hint stays on show before it clears itself. */
export const HINT_DURATION_MS = 2200;

/**
 * Picks up the card at `index` of `from` (D1). Only a card the rules let the player move can be picked up: the top of
 * the waste or a foundation, or a face-up run in a column; the stock and face-down cards cannot. Anything else, or no
 * game, clears the current selection instead, so every input path (press, drag start, keyboard pick-up) ends with the
 * same selection. It reads the game and never imports the game thunks.
 */
export function selectCard(from: PileRef, index: number): AppThunk {
    return (dispatch, getState) => {
        const { current } = getState().game;
        if (current !== null && groupAt(current, from, index) !== undefined) {
            dispatch(selectionSet({ from, index }));
        } else {
            dispatch(selectionCleared());
        }
    };
}

/** The view of a hint, without its id: a move names its cards and target pile, a draw or recycle names the stock. */
function hintViewOf(hint: SolverHint): Omit<HintView, 'id'> {
    return hint.kind === 'move'
        ? { kind: 'move', cards: hint.cards, target: hint.command.to }
        : { kind: hint.kind, cards: [], target: 'stock' };
}

/**
 * Tells the player the position is a dead end (D8): raises the `dead-end` notice (which raises it once) and announces
 * `deadEnd`. Does not touch the reported positions; callers decide whether the report is once per position.
 */
function reportDeadEnd(): AppThunk {
    return (dispatch) => {
        dispatch(noticeRaised('dead-end'));
        dispatch(announced([{ type: 'deadEnd' }]));
    };
}

/**
 * Checks the settled position for a dead end (D8) and reports it once per position in the game: the first time a
 * position is a dead end, its key is remembered, the `dead-end` notice is raised and `deadEnd` is announced; the same
 * position later in the game (undo and replay) is silent. Does nothing without a game or when it is won. The game
 * thunks call it after a player command and after Finish, never after undo or redo.
 */
export function checkDeadEnd(): AppThunk {
    return (dispatch, getState) => {
        const { current } = getState().game;
        if (current === null || current.status === 'won' || !isDeadEnd(current)) return;

        const key = positionKey(current);
        if (getState().interaction.deadEndSeen.includes(key)) return;
        dispatch(deadEndRecorded(key));
        dispatch(reportDeadEnd());
    };
}

/**
 * Shows a hint for the position in play (D7); it costs no score and no move and never changes the game. Ignored with
 * no game, when the game is won or while a chain or finish is running. A dead end is reported, on every request, and
 * shows no hint. Otherwise it asks the deal service (the solver's first line move where it applies, else the
 * heuristic) about the position and drops the answer when there is none, when the request was cancelled, or when the
 * game or position changed while it was pending. The kept answer is shown, announced as `hinted` and cleared after
 * `HINT_DURATION_MS` unless a newer hint or the position got there first. A request for the same game and position as
 * the one in flight returns at once without asking again. The promise settles when the hint has cleared or was dropped.
 */
export function requestHint(): AppThunk<Promise<void>> {
    return async (dispatch, getState, { dealService, delay }) => {
        const { current, busy, epoch } = getState().game;
        if (current === null || current.status === 'won' || busy) return;

        const advice = advise(current);
        if (advice === undefined) return;
        if (advice.kind === 'dead-end') {
            dispatch(reportDeadEnd());
            return;
        }

        const request = { epoch, key: positionKey(current) };
        const inFlight = getState().interaction.pendingHint;
        if (inFlight?.epoch === request.epoch && inFlight.key === request.key) return;
        dispatch(pendingHintSet(request));

        let outcome;
        try {
            outcome = await dealService.hint(current);
        } finally {
            // A reset while pending already cleared the request; only clear the one that is still ours.
            if (getState().interaction.pendingHint === request) dispatch(pendingHintSet(null));
        }
        const now = getState();
        if (
            outcome.status !== 'hint' ||
            now.game.epoch !== request.epoch ||
            now.game.current === null ||
            positionKey(now.game.current) !== request.key
        ) {
            return;
        }

        const view = hintViewOf(outcome.hint);
        const id = selectNextHintId(now);
        dispatch(hintSet({ id, ...view }));
        dispatch(announced([{ type: 'hinted', kind: view.kind, cards: view.cards, target: view.target }]));

        await delay(HINT_DURATION_MS);
        dispatch(hintCleared(id));
    };
}
