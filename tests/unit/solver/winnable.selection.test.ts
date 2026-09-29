// covers: KS-DEAL-03, KS-DEAL-05, KS-DEAL-11
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GradingModule from '../../../src/solver/grading';
import type { Grade } from '../../../src/domain/types';
import { gradeDeal } from '../../../src/solver/grading';
import { findWinnable, type Outcome, type Selection } from '../../../src/solver/winnable';
import { corpusSeeds } from '../../fixtures/solverCorpus';

// Which grade a seed gets is scripted, so that selection is tested apart from grading itself.
vi.mock('../../../src/solver/grading', async (importOriginal) => ({
    ...(await importOriginal<typeof GradingModule>()),
    gradeDeal: vi.fn(),
}));

const BUDGET = 5000;
const [W1 = 0, W2 = 0, W3 = 0] = corpusSeeds('win');
const [LOSS = 0] = corpusSeeds('loss');
const [UNKNOWN = 0] = corpusSeeds('unknown');

/** Scripted grades: `grades.set(seed, grade)` chains. */
const grades = new Map<number, Grade>();

beforeEach(() => {
    grades.clear();
    vi.mocked(gradeDeal).mockReset();
    vi.mocked(gradeDeal).mockImplementation((deal) => ({ grade: grades.get(deal.seed) ?? 'medium', score: 0 }));
});

function select(seeds: readonly number[], target: Selection['target'], gradeLimit = Number.POSITIVE_INFINITY) {
    const attempts: number[] = [];
    const result = findWinnable(seeds, BUDGET, 'draw1', {
        selection: { target, gradeLimit },
        onAttempt: (attempt) => attempts.push(attempt),
    });
    return { result, attempts };
}

describe('findWinnable with a target grade', () => {
    it('takes the first proven deal for Any, with its own grade and no spares', () => {
        grades.set(W1, 'hard');
        const { result, attempts } = select([LOSS, W1, W2], 'any');
        expect(result).toEqual({ seed: W1, verdict: 'win', attempts: 2, grade: 'hard', spares: [] });
        expect(attempts).toEqual([1, 2]);
        expect(gradeDeal).toHaveBeenCalledTimes(1);
    });

    it('takes the first proven deal of the requested grade, and keeps the others it graded as spares', () => {
        grades.set(W1, 'easy').set(W2, 'hard').set(W3, 'medium');
        const { result, attempts } = select([W1, LOSS, W2, W3], 'hard');
        expect(result).toEqual({
            seed: W2,
            verdict: 'win',
            attempts: 3,
            grade: 'hard',
            spares: [{ seed: W1, grade: 'easy' }],
        });
        expect(attempts).toEqual([1, 2, 3]);
    });

    it('deals the closest grade found when none matches, labelled with its own grade', () => {
        grades.set(W1, 'easy').set(W2, 'medium');
        const { result } = select([W1, LOSS, W2], 'hard');
        expect(result).toEqual({
            seed: W2,
            verdict: 'win',
            attempts: 3,
            grade: 'medium',
            spares: [{ seed: W1, grade: 'easy' }],
        });
    });

    it('prefers the earlier of two equally close grades', () => {
        grades.set(W1, 'hard').set(W2, 'easy');
        const { result } = select([W1, UNKNOWN, W2], 'medium');
        expect(result).toEqual({
            seed: W1,
            verdict: 'win',
            attempts: 3,
            grade: 'hard',
            spares: [{ seed: W2, grade: 'easy' }],
        });
    });

    it('stops after grading gradeLimit proven deals and settles for the closest', () => {
        grades.set(W1, 'easy').set(W2, 'easy').set(W3, 'hard');
        const { result, attempts } = select([W1, W2, W3], 'hard', 2);
        expect(result).toEqual({
            seed: W1,
            verdict: 'win',
            attempts: 2,
            grade: 'easy',
            spares: [{ seed: W2, grade: 'easy' }],
        });
        expect(attempts).toEqual([1, 2]);
        expect(gradeDeal).toHaveBeenCalledTimes(2);
    });

    it('falls back to the last seed as random when nothing is proven, and grades nothing', () => {
        const { result, attempts } = select([LOSS, UNKNOWN], 'easy');
        expect(result).toEqual({ seed: UNKNOWN, verdict: 'random', attempts: 2, grade: undefined, spares: [] });
        expect(attempts).toEqual([1, 2]);
        expect(gradeDeal).not.toHaveBeenCalled();
    });

    it('is deterministic', () => {
        grades.set(W1, 'easy').set(W2, 'medium');
        expect(select([W1, LOSS, W2], 'hard').result).toEqual(select([W1, LOSS, W2], 'hard').result);
    });
});

describe('findWinnable with known verdicts', () => {
    it('reports each seed it searched, once, with its verdict and grade', () => {
        grades.set(W1, 'hard');
        const outcomes: Outcome[] = [];
        findWinnable([LOSS, UNKNOWN, W1, W2], BUDGET, 'draw1', { onOutcome: (outcome) => outcomes.push(outcome) });
        expect(outcomes).toEqual([
            { seed: LOSS, verdict: 'loss', grade: undefined },
            { seed: UNKNOWN, verdict: 'unknown', grade: undefined },
            { seed: W1, verdict: 'win', grade: 'hard' },
        ]);
    });

    it('takes a known win and its grade as they are, without searching or grading the seed', () => {
        const outcomes: Outcome[] = [];
        const result = findWinnable([W1, W2], BUDGET, 'draw1', {
            selection: { target: 'hard', gradeLimit: Number.POSITIVE_INFINITY },
            known: [
                { seed: W1, verdict: 'win', grade: 'easy' },
                { seed: W2, verdict: 'win', grade: 'hard' },
            ],
            onOutcome: (outcome) => outcomes.push(outcome),
        });
        expect(result).toEqual({
            seed: W2,
            verdict: 'win',
            attempts: 2,
            grade: 'hard',
            spares: [{ seed: W1, grade: 'easy' }],
        });
        expect(outcomes).toEqual([]);
        expect(gradeDeal).not.toHaveBeenCalled();
    });

    it('skips a seed that is known not to be proven, and still counts it as an attempt', () => {
        const attempts: number[] = [];
        const result = findWinnable([W1, W2], BUDGET, 'draw1', {
            known: [{ seed: W1, verdict: 'unknown', grade: undefined }],
            onAttempt: (attempt) => attempts.push(attempt),
        });
        expect(result).toMatchObject({ seed: W2, verdict: 'win', attempts: 2 });
        expect(attempts).toEqual([1, 2]);
    });

    it('selects exactly what it selects without them: they only save work', () => {
        grades.set(W1, 'easy').set(W2, 'medium').set(W3, 'hard');
        const seeds = [LOSS, W1, UNKNOWN, W2, W3];
        const selection = { target: 'hard', gradeLimit: 2 } as const;
        const outcomes: Outcome[] = [];
        const fresh = findWinnable(seeds, BUDGET, 'draw1', {
            selection,
            onOutcome: (outcome) => outcomes.push(outcome),
        });
        const again = findWinnable(seeds, BUDGET, 'draw1', { selection, known: outcomes });
        expect(again).toEqual(fresh);
    });
});
