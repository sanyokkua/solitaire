// covers: KS-PER-02, KS-PER-03, KS-PER-06
import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import type { Command, GameState, Grade } from '../../../../src/domain/types';
import { commit, undo, type Session } from '../../../../src/features/game/history';
import { decodeSession, encodeSession } from '../../../../src/features/persistence/sessionCodec';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';
import { V1_RECORD } from '../../../fixtures/storage';

type Loose = Record<string, unknown>;

const child = (parent: unknown, ...path: (string | number)[]): Loose => {
    let node = parent;
    for (const key of path) node = (node as Record<string | number, unknown>)[key];
    return node as Loose;
};

/** The stored session of the pinned version 1 record: 3 undo steps and 1 redo step. */
const v1Session = (): Loose => child(JSON.parse(V1_RECORD), 'session');

/** A session of `count` winning-line moves and then one undo, for a deal graded `grade`. */
function graded(grade: Grade | null, count = 6): Session {
    const first = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode, { verdict: 'win', attempts: 2, grade });
    let session: Session = { current: first, history: [], future: [] };
    const commands: readonly Command[] = parseLine(WINNING_LINE.line).slice(0, count);
    for (const [i, command] of commands.entries()) {
        session = commit(session, { ...applyCommand(session.current, command).state, elapsedMs: 1000 * (i + 1) });
    }
    return undo(session);
}

const stored = (session: Session): Loose => {
    const encoded = encodeSession({ ...session, dailyKey: null, counted: true });
    if (encoded === undefined) throw new Error('expected a resumable game');
    return JSON.parse(JSON.stringify(encoded)) as Loose;
};

const allStates = (session: { current: GameState; history: readonly GameState[]; future: readonly GameState[] }) => [
    session.current,
    ...session.history,
    ...session.future,
];

describe('a version 1 session', () => {
    it('decodes, its game and every step reading no grade', () => {
        const session = decodeSession(v1Session(), 1);

        expect(session).not.toBeNull();
        if (session === null) return;
        expect(session.history).toHaveLength(3);
        expect(session.future).toHaveLength(1);
        expect(session.current.moves).toBe(3);
        expect(session.current.undos).toBe(1);
        expect(allStates(session).map((state) => state.grade)).toEqual([null, null, null, null, null]);
    });

    it('keeps every other field of the game as stored', () => {
        const raw = v1Session();
        const session = decodeSession(raw, 1);
        if (session === null) throw new Error('expected a decoded session');
        expect({ ...session.current, grade: undefined }).toEqual({ ...child(raw, 'current'), grade: undefined });
    });

    it('is not a version 2 session, which needs its grade key', () => {
        expect(decodeSession(v1Session(), 2)).toBeNull();
    });

    it.each(['medium', null])('is invalid when its game carries a grade key of %j', (grade) => {
        const raw = v1Session();
        child(raw, 'current').grade = grade;
        expect(decodeSession(raw, 1)).toBeNull();
    });

    it('is invalid with an extra key on the game, whatever its value', () => {
        const raw = v1Session();
        child(raw, 'current').extra = 1;
        expect(decodeSession(raw, 1)).toBeNull();
    });

    it('is invalid when a step carries a grade key', () => {
        const raw = v1Session();
        child(raw, 'history', 0).grade = null;
        expect(decodeSession(raw, 1)).toBeNull();
    });

    it('is invalid when its game is unreadable, as it would be after the upgrade', () => {
        const raw = v1Session();
        const stock = child(raw, 'current').stock as number[];
        stock[0] = stock.at(1) ?? -1;
        expect(decodeSession(raw, 1)).toBeNull();
    });
});

describe('a version 2 session', () => {
    it('writes the grade of the game right after the attempts, and none on a step', () => {
        const raw = stored(graded('medium'));

        expect(Object.keys(child(raw, 'current')).slice(4, 8)).toEqual(['verdict', 'attempts', 'grade', 'tableau']);
        expect(Object.keys(child(raw, 'current'))).toHaveLength(18);
        expect(Object.keys(child(raw, 'history', 0))).not.toContain('grade');
        expect(Object.keys(child(raw, 'future', 0))).not.toContain('grade');
    });

    it('round trips a graded game, the game and every step keeping grade medium', () => {
        const session = graded('medium');
        const decoded = decodeSession(stored(session), 2);

        expect(decoded).not.toBeNull();
        if (decoded === null) return;
        expect(decoded.current).toEqual(session.current);
        expect(decoded.history).toEqual(session.history);
        expect(decoded.future).toEqual(session.future);
        expect(allStates(decoded).every((state) => state.grade === 'medium')).toBe(true);
    });

    it('round trips an ungraded game as null', () => {
        const decoded = decodeSession(stored(graded(null)), 2);
        if (decoded === null) throw new Error('expected a decoded session');
        expect(allStates(decoded).every((state) => state.grade === null)).toBe(true);
    });

    it('is invalid without the grade key on the game', () => {
        const raw = stored(graded('medium'));
        delete child(raw, 'current').grade;
        expect(decodeSession(raw, 2)).toBeNull();
    });

    it('is invalid when a step carries a grade key', () => {
        const historyStep = stored(graded('medium'));
        child(historyStep, 'history', 0).grade = 'medium';
        expect(decodeSession(historyStep, 2)).toBeNull();

        const futureStep = stored(graded('medium'));
        child(futureStep, 'future', 0).grade = null;
        expect(decodeSession(futureStep, 2)).toBeNull();
    });

    it.each(['expert', 1, true])('is invalid with the unknown grade %j', (grade) => {
        const raw = stored(graded('medium'));
        child(raw, 'current').grade = grade;
        expect(decodeSession(raw, 2)).toBeNull();
    });

    it('is invalid with a grade on a game that was not proven winnable', () => {
        const raw = stored(graded('medium'));
        child(raw, 'current').verdict = 'random';
        expect(decodeSession(raw, 2)).toBeNull();
    });
});
