import { describe, expect, it } from 'vitest';
import { cardId } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import type { Command, GameState } from '../../../../src/domain/types';
import { canRedo, canUndo, commit, redo, replace, undo, type Session } from '../../../../src/features/game/history';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';
import { deepFreeze, makeState } from '../../../fixtures/states';

const DRAW: Command = { type: 'draw' };

function start(current: GameState): Session {
    return { current, history: [], future: [] };
}

/** Applies a command that must be accepted, returning the resulting state. */
function play(state: GameState, command: Command): GameState {
    const { state: next } = applyCommand(state, command);
    expect(next).not.toBe(state);
    return next;
}

/** A small position where the ace of hearts on the waste can go to its foundation for points. */
function aceOnWaste(partial: Partial<GameState> = {}): GameState {
    return makeState({ waste: [cardId(0, 1)], ...partial });
}

const SEND_ACE: Command = { type: 'autoFoundation', from: { pile: 'waste' } };

describe('commit and undo', () => {
    it('restores the pre-move piles, score, moves and passes', () => {
        const before = aceOnWaste({ score: 5, moves: 3, passes: 2 });
        const after = play(before, SEND_ACE);
        expect(after.score).not.toBe(before.score);

        const restored = undo(commit(start(before), after)).current;

        expect(restored.tableau).toEqual(before.tableau);
        expect(restored.stock).toEqual(before.stock);
        expect(restored.waste).toEqual(before.waste);
        expect(restored.foundations).toEqual(before.foundations);
        expect(restored.score).toBe(before.score);
        expect(restored.moves).toBe(before.moves);
        expect(restored.passes).toBe(before.passes);
    });

    it('pushes the undone position onto the future and leaves the history shorter', () => {
        const before = aceOnWaste();
        const after = play(before, SEND_ACE);
        const undone = undo(commit(start(before), after));
        expect(undone.history).toEqual([]);
        expect(undone.future).toEqual([after]);
    });

    it('does not rewind time or charges', () => {
        const first = aceOnWaste({ elapsedMs: 0, started: false });
        const second = play(first, SEND_ACE);
        const third = { ...play(dealFromSeed(1, 'draw1'), DRAW), elapsedMs: 40_000, started: true };
        const session = commit(commit(start(first), second), third);

        const once = undo(session);
        const twice = undo(once);

        expect(twice.current.elapsedMs).toBe(40_000);
        expect(twice.current.started).toBe(true);
        expect(twice.current.undos).toBe(2);
        expect(twice.current.moves).toBe(first.moves);
        expect(twice.history).toEqual([]);
    });
});

describe('redo', () => {
    it('restores the undone move and keeps the charge', () => {
        const before = aceOnWaste();
        const after = { ...play(before, SEND_ACE), elapsedMs: 12_000 };
        const undone = undo(commit(start(before), after));

        const redone = redo(undone);

        expect(redone.current).toEqual({ ...after, undos: 1 });
        expect(redone.future).toEqual([]);
        expect(redone.history).toEqual([undone.current]);
    });

    it('takes elapsed time and started from the outgoing position', () => {
        const before = aceOnWaste();
        const after = play(before, SEND_ACE);
        const undone = undo(commit(start(before), after));
        const later = { ...undone, current: { ...undone.current, elapsedMs: 90_000, started: true } };

        expect(redo(later).current.elapsedMs).toBe(90_000);
        expect(redo(later).current.started).toBe(true);
    });

    it('is cleared by a new move after undoing twice', () => {
        const a = dealFromSeed(1, 'draw1');
        const b = play(a, DRAW);
        const c = play(b, DRAW);
        const undone = undo(undo(commit(commit(start(a), b), c)));
        expect(canRedo(undone)).toBe(true);
        expect(undone.future).toHaveLength(2);

        const moved = commit(undone, play(undone.current, DRAW));

        expect(moved.future).toEqual([]);
        expect(canRedo(moved)).toBe(false);
        expect(moved.history).toHaveLength(1);
    });

    it('walks every undone step back in order', () => {
        const a = dealFromSeed(1, 'draw1');
        const b = play(a, DRAW);
        const c = play(b, DRAW);
        const undone = undo(undo(commit(commit(start(a), b), c)));

        const redone = redo(redo(undone));

        expect(redone.current.waste).toEqual(c.waste);
        expect(redone.current.moves).toBe(c.moves);
        expect(redone.history).toHaveLength(2);
        expect(redone.current.undos).toBe(2);
    });
});

describe('replace', () => {
    it('keeps a single undo step for a chain of updates', () => {
        const before = aceOnWaste();
        const moved = play(before, SEND_ACE);
        const chained1 = { ...moved, score: moved.score + 15 };
        const chained2 = { ...chained1, score: chained1.score + 15 };

        const session = replace(replace(commit(start(before), moved), chained1), chained2);

        expect(session.current).toBe(chained2);
        expect(session.history).toEqual([before]);
        const undone = undo(session);
        expect(undone.current.score).toBe(before.score);
        expect(undone.current.waste).toEqual(before.waste);
        expect(undone.history).toEqual([]);
    });

    it('leaves the history and the future untouched', () => {
        const a = dealFromSeed(1, 'draw1');
        const b = play(a, DRAW);
        const undone = undo(commit(start(a), b));
        const replaced = replace(undone, { ...undone.current, score: 99 });
        expect(replaced.history).toBe(undone.history);
        expect(replaced.future).toBe(undone.future);
    });
});

describe('guards', () => {
    it('undo and redo return the same session when their stacks are empty', () => {
        const session = start(dealFromSeed(1, 'draw1'));
        expect(canUndo(session)).toBe(false);
        expect(canRedo(session)).toBe(false);
        expect(undo(session)).toBe(session);
        expect(redo(session)).toBe(session);
    });

    it('undo and redo return the same session once the game is won', () => {
        const won = makeState({ status: 'won' });
        const session: Session = { current: won, history: [makeState()], future: [makeState()] };
        expect(canUndo(session)).toBe(false);
        expect(canRedo(session)).toBe(false);
        expect(undo(session)).toBe(session);
        expect(redo(session)).toBe(session);
    });

    it('canUndo and canRedo are true when a step is available', () => {
        const a = dealFromSeed(1, 'draw1');
        const committed = commit(start(a), play(a, DRAW));
        expect(canUndo(committed)).toBe(true);
        expect(canRedo(committed)).toBe(false);
        expect(canRedo(undo(committed))).toBe(true);
        expect(canUndo(undo(committed))).toBe(false);
    });

    it('undo is unavailable after the winning line ends the game', () => {
        const deal = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode);
        let session = start(deal);
        for (const command of parseLine(WINNING_LINE.line)) {
            session = commit(session, play(session.current, command));
        }
        expect(session.current.status).toBe('won');
        expect(session.history).toHaveLength(WINNING_LINE.moves);
        expect(canUndo(session)).toBe(false);
        expect(undo(session)).toBe(session);
    });
});

describe('unlimited history', () => {
    it('reaches the deal after 250 accepted commands', () => {
        const deal = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode);
        // The first half of the line, then draws (Draw 1 recycles without limit), so every command is accepted.
        const line = parseLine(WINNING_LINE.line).slice(0, 60);
        let session = start(deal);
        for (const command of line) {
            session = commit(session, play(session.current, command));
        }
        while (session.history.length < 250) {
            session = commit(session, play(session.current, DRAW));
        }
        expect(session.history.length).toBeGreaterThanOrEqual(250);
        expect(session.current.status).toBe('playing');

        const total = session.history.length;
        for (let step = 1; step <= total; step += 1) {
            const next = undo(session);
            expect(next).not.toBe(session);
            expect(next.current.undos).toBe(step);
            session = next;
        }

        expect(canUndo(session)).toBe(false);
        expect(session.future).toHaveLength(total);
        expect(session.current).toEqual({ ...deal, undos: total, started: true, elapsedMs: 0 });
    });
});

describe('purity', () => {
    it('never mutates a deep-frozen session', () => {
        const a = dealFromSeed(1, 'draw1');
        const b = play(a, DRAW);
        const c = play(b, DRAW);
        const session = deepFreeze(commit(deepFreeze(commit(deepFreeze(start(a)), b)), c));
        const snapshot = structuredClone(session);

        const undoneOnce = undo(session);
        const undone = undo(deepFreeze(undoneOnce));
        const redone = redo(deepFreeze(undone));
        const replaced = replace(deepFreeze(redone), { ...redone.current, score: 7 });
        const committed = commit(deepFreeze(undone), play(undone.current, DRAW));

        expect(session).toEqual(snapshot);
        expect(undone.history).toEqual([]);
        expect(undone.future).toHaveLength(2);
        expect(redone.history).toHaveLength(1);
        expect(redone.future).toHaveLength(1);
        expect(replaced.current.score).toBe(7);
        expect(replaced.history).toBe(redone.history);
        expect(committed.future).toEqual([]);
        expect(committed.history).toHaveLength(1);
    });
});
