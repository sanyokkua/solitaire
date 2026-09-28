import type { GameState } from '../../domain/types';

/**
 * The undoable part of a game: the position in play plus every earlier position (`history`, oldest first) and every
 * undone position that redo can restore (`future`, the next redo last). Both stacks are unbounded in memory.
 */
export interface Session {
    readonly current: GameState;
    readonly history: readonly GameState[];
    readonly future: readonly GameState[];
}

/**
 * Restores `snapshot`'s position while keeping the fields that never rewind. `elapsedMs` and `started` always come
 * from `outgoing`; `undos` comes from `outgoing` plus `undoCharge`. The piles, score, moves and passes are the
 * snapshot's own.
 */
function restore(snapshot: GameState, outgoing: GameState, undoCharge: 0 | 1): GameState {
    return {
        ...snapshot,
        elapsedMs: outgoing.elapsedMs,
        started: outgoing.started,
        undos: outgoing.undos + undoCharge,
    };
}

/**
 * Starts a new undo step: the position in play joins the history, `next` becomes the position in play and every redo
 * step is discarded.
 */
export function commit(session: Session, next: GameState): Session {
    return { current: next, history: [...session.history, session.current], future: [] };
}

/**
 * Updates the position in play inside the current undo step, such as a safe-card send that belongs to the move that
 * caused it. The history and the redo steps stay as they were.
 */
export function replace(session: Session, next: GameState): Session {
    return { ...session, current: next };
}

/** Whether undo would change anything: there is a step to undo and the game is not won. */
export function canUndo(session: Session): boolean {
    return session.history.length > 0 && session.current.status !== 'won';
}

/** Whether redo would change anything: there is a step to redo and the game is not won. */
export function canRedo(session: Session): boolean {
    return session.future.length > 0 && session.current.status !== 'won';
}

/**
 * Restores the position before the last undo step and adds one undo charge. Elapsed time and the started flag are not
 * rewound. The position that was in play becomes the next redo step. Returns the same session when there is nothing
 * to undo or the game is won.
 */
export function undo(session: Session): Session {
    const previous = session.history.at(-1);
    if (previous === undefined || session.current.status === 'won') return session;
    return {
        current: restore(previous, session.current, 1),
        history: session.history.slice(0, -1),
        future: [...session.future, session.current],
    };
}

/**
 * Re-applies the most recently undone step. Elapsed time, the started flag and the undo charges stay as they are, so
 * redo never refunds a charge. The position that was in play rejoins the history. Returns the same session when there
 * is nothing to redo or the game is won.
 */
export function redo(session: Session): Session {
    const next = session.future.at(-1);
    if (next === undefined || session.current.status === 'won') return session;
    return {
        current: restore(next, session.current, 0),
        history: [...session.history, session.current],
        future: session.future.slice(0, -1),
    };
}
