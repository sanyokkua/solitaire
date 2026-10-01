// covers: KS-DEAL-04, KS-DEAL-10
import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../src/domain/deal';
import { handleRequest, type SolverRequest, type SolverResponse } from '../../../src/solver/protocol';
import { solverHint } from '../../../src/solver/hint';
import { gradeDeal } from '../../../src/solver/grading';
import { findWinnable, type Outcome } from '../../../src/solver/winnable';
import { corpusSeeds, MIDGAME_POSITIONS, midgameState } from '../../fixtures/solverCorpus';

const BUDGET = 3000;
const [WIN_SEED = 0, OTHER_WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');
const MIDGAME = MIDGAME_POSITIONS.find((entry) => entry.budget === BUDGET);

/** Posts `request` to `handleRequest` and returns every message it posted, in order. */
function run(request: SolverRequest): SolverResponse[] {
    const posted: SolverResponse[] = [];
    handleRequest(request, (response) => posted.push(response));
    return posted;
}

/** The same messages with the request id zeroed, to compare replies to different requests. */
function withoutId(responses: readonly SolverResponse[]): unknown[] {
    return responses.map((response) => ({ ...response, id: 0 }));
}

function hintRequest(id: number, state = midgameState(MIDGAME ?? { seed: 0, k: 0, budget: 0 })): SolverRequest {
    return { id, type: 'hint', state, budget: BUDGET };
}

describe('handleRequest findWinnable', () => {
    const request: SolverRequest = {
        id: 7,
        type: 'findWinnable',
        seeds: [LOSS_SEED, WIN_SEED],
        budget: BUDGET,
        mode: 'draw1',
    };

    it('posts progress as each attempt starts, then one reply, all with the request id', () => {
        const posted = run(request);
        const outcomes: Outcome[] = [];
        const direct = findWinnable([LOSS_SEED, WIN_SEED], BUDGET, 'draw1', {
            onOutcome: (outcome) => outcomes.push(outcome),
        });
        expect(posted).toEqual([
            { id: 7, type: 'progress', attempt: 1 },
            { id: 7, type: 'outcome', outcome: outcomes[0] },
            { id: 7, type: 'progress', attempt: 2 },
            { id: 7, type: 'outcome', outcome: outcomes[1] },
            { id: 7, type: 'findWinnable', ...direct },
        ]);
        expect(direct).toMatchObject({ seed: WIN_SEED, verdict: 'win', attempts: 2 });
    });

    it('honours the selection of the request, and replies with the grade and the spares', () => {
        // Ask for a grade the first win does not have, so the search must go on to the next win.
        const first = gradeDeal(dealFromSeed(WIN_SEED, 'draw1')).grade;
        const selection = { target: first === 'hard' ? 'easy' : 'hard', gradeLimit: 2 } as const;
        const seeds = [LOSS_SEED, WIN_SEED, OTHER_WIN_SEED];
        const posted = run({ id: 8, type: 'findWinnable', seeds, budget: BUDGET, mode: 'draw1', selection });
        const direct = findWinnable(seeds, BUDGET, 'draw1', { selection });
        expect(posted.at(-1)).toEqual({ id: 8, type: 'findWinnable', ...direct });
        expect(direct.attempts).toBe(3);
        expect(direct.spares.length + 1).toBe(2);
        expect(findWinnable(seeds, BUDGET, 'draw1').attempts).toBe(2);
    });

    it('posts an outcome for each seed it searched, after that attempt starts, and none for a known seed', () => {
        const seeds = [LOSS_SEED, WIN_SEED];
        const fresh = run({ id: 9, type: 'findWinnable', seeds, budget: BUDGET, mode: 'draw1' });
        expect(fresh.map((message) => message.type)).toEqual([
            'progress',
            'outcome',
            'progress',
            'outcome',
            'findWinnable',
        ]);
        const known = fresh.flatMap((message) => (message.type === 'outcome' ? [message.outcome] : []));
        expect(known).toHaveLength(2);

        const again = run({ id: 9, type: 'findWinnable', seeds, budget: BUDGET, mode: 'draw1', known });
        expect(again.map((message) => message.type)).toEqual(['progress', 'progress', 'findWinnable']);
        expect(again.at(-1)).toEqual(fresh.at(-1));
    });

    it('posts no progress for an attempt that is not tried', () => {
        const posted = run({
            id: 1,
            type: 'findWinnable',
            seeds: [WIN_SEED, LOSS_SEED],
            budget: BUDGET,
            mode: 'draw1',
        });
        expect(posted.filter((message) => message.type === 'progress')).toEqual([
            { id: 1, type: 'progress', attempt: 1 },
        ]);
        expect(posted.filter((message) => message.type === 'findWinnable')).toHaveLength(1);
    });
});

describe('handleRequest hint', () => {
    it('posts exactly one hint reply with the request id, equal to solverHint', () => {
        expect(MIDGAME).toBeDefined();
        const request = hintRequest(3);
        const posted = run(request);
        expect(request.type).toBe('hint');
        if (request.type !== 'hint') {
            return;
        }
        const expected = solverHint(request.state, BUDGET);
        expect(expected).toBeDefined();
        expect(posted).toEqual([{ id: 3, type: 'hint', hint: expected }]);
    });

    it('replies with an absent hint for a Draw 3 state', () => {
        const posted = run({ id: 4, type: 'hint', state: dealFromSeed(WIN_SEED, 'draw3'), budget: BUDGET });
        expect(posted).toHaveLength(1);
        expect(posted[0]).toEqual({ id: 4, type: 'hint', hint: undefined });
        expect(posted[0]).toHaveProperty('hint');
    });
});

describe('handleRequest independence', () => {
    it('gives the same replies for a structured-clone of the request', () => {
        const findRequest: SolverRequest = {
            id: 2,
            type: 'findWinnable',
            seeds: [LOSS_SEED, WIN_SEED],
            budget: BUDGET,
            mode: 'draw1',
        };
        expect(run(structuredClone(findRequest))).toEqual(run(findRequest));
        const hint = hintRequest(5);
        expect(run(structuredClone(hint))).toEqual(run(hint));
    });

    it('gives replies that differ only in id when a request is posted twice with another between', () => {
        const first = run(hintRequest(1));
        run({ id: 2, type: 'findWinnable', seeds: [LOSS_SEED, WIN_SEED], budget: BUDGET, mode: 'draw1' });
        const second = run(hintRequest(3));
        expect(first[0]?.id).toBe(1);
        expect(second[0]?.id).toBe(3);
        expect(withoutId(second)).toEqual(withoutId(first));

        const find = (id: number) =>
            run({ id, type: 'findWinnable', seeds: [LOSS_SEED, WIN_SEED], budget: BUDGET, mode: 'draw1' });
        const a = find(10);
        run(hintRequest(11));
        const b = find(12);
        expect(withoutId(b)).toEqual(withoutId(a));
    });
});

describe('handleRequest in Draw 3 and Vegas', () => {
    it('deals a findWinnable request in its mode, posting progress then the direct result', () => {
        const seeds = [1, 10, 8];
        const posted = run({ id: 3, type: 'findWinnable', seeds, budget: 5000, mode: 'draw3' });
        const outcomes: Outcome[] = [];
        const direct = findWinnable(seeds, 5000, 'draw3', { onOutcome: (outcome) => outcomes.push(outcome) });
        expect(direct).toMatchObject({ seed: 8, verdict: 'win', attempts: 3 });
        expect(posted).toEqual([
            { id: 3, type: 'progress', attempt: 1 },
            { id: 3, type: 'outcome', outcome: outcomes[0] },
            { id: 3, type: 'progress', attempt: 2 },
            { id: 3, type: 'outcome', outcome: outcomes[1] },
            { id: 3, type: 'progress', attempt: 3 },
            { id: 3, type: 'outcome', outcome: outcomes[2] },
            { id: 3, type: 'findWinnable', ...direct },
        ]);
    });

    it('answers a hint request by the search that fits the position own mode', () => {
        for (const state of [dealFromSeed(8, 'draw3'), dealFromSeed(21, 'vegas')]) {
            const posted = run({ id: 5, type: 'hint', state, budget: BUDGET });
            expect(posted).toEqual([{ id: 5, type: 'hint', hint: solverHint(state, BUDGET) }]);
            expect(solverHint(state, BUDGET)).toBeDefined();
        }
    });
});
