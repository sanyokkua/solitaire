// @vitest-environment node
import '@vitest/web-worker';
import { afterEach, describe, expect, it } from 'vitest';
import { solverHint } from '../../../src/solver/hint';
import type { SolverRequest, SolverResponse } from '../../../src/solver/protocol';
import { findWinnable } from '../../../src/solver/winnable';
import { corpusSeeds, MIDGAME_POSITIONS, midgameState } from '../../fixtures/solverCorpus';

const FIND_BUDGET = 5000;
const HINT_BUDGET = 3000;
const REQUEST_ID = 7;
/** Long enough for a reply to arrive if the polyfill's `terminate()` had not detached the listeners. */
const SILENCE_MS = 200;

const [WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');

const workers: Worker[] = [];

/** Starts the real worker module in-process; `afterEach` terminates it. */
function startWorker(): Worker {
    const worker = new Worker(new URL('../../../src/solver/solver.worker.ts', import.meta.url), { type: 'module' });
    workers.push(worker);
    return worker;
}

/** Posts `request` and resolves with every message the worker posts for it, ending at the final (non-progress) reply. */
function roundTrip(worker: Worker, request: SolverRequest): Promise<SolverResponse[]> {
    return new Promise((resolve, reject) => {
        const messages: SolverResponse[] = [];
        worker.addEventListener('message', (event: MessageEvent<SolverResponse>) => {
            messages.push(event.data);
            if (event.data.type !== 'progress') {
                resolve(messages);
            }
        });
        worker.addEventListener('error', (event) => {
            reject(new Error(event.message));
        });
        worker.postMessage(request);
    });
}

afterEach(() => {
    for (const worker of workers.splice(0)) {
        worker.terminate();
    }
});

describe('solver.worker round-trip', () => {
    it('answers a findWinnable request with progress messages, then a reply equal to the direct result', async () => {
        const seeds = [LOSS_SEED, WIN_SEED];
        const messages = await roundTrip(startWorker(), {
            id: REQUEST_ID,
            type: 'findWinnable',
            seeds,
            budget: FIND_BUDGET,
        });
        const direct = findWinnable(seeds, FIND_BUDGET);

        expect(direct.attempts).toBe(2);
        expect(messages).toEqual([
            { id: REQUEST_ID, type: 'progress', attempt: 1 },
            { id: REQUEST_ID, type: 'progress', attempt: 2 },
            { id: REQUEST_ID, type: 'findWinnable', ...direct },
        ]);
    });

    it('answers a hint request with the same id and the solver hint', async () => {
        const entry = MIDGAME_POSITIONS.find((position) => position.budget === HINT_BUDGET);
        if (entry === undefined) {
            throw new Error('no midgame position pinned at the hint budget');
        }
        const state = midgameState(entry);
        const messages = await roundTrip(startWorker(), { id: REQUEST_ID, type: 'hint', state, budget: HINT_BUDGET });
        const hint = solverHint(state, HINT_BUDGET);

        expect(hint).toBeDefined();
        expect(messages).toEqual([{ id: REQUEST_ID, type: 'hint', hint }]);
    });

    it('posts nothing for a request sent after terminate()', async () => {
        const worker = startWorker();
        const received: unknown[] = [];
        worker.addEventListener('message', (event: MessageEvent<unknown>) => {
            received.push(event.data);
        });

        worker.terminate();
        worker.postMessage({ id: REQUEST_ID, type: 'findWinnable', seeds: [WIN_SEED], budget: FIND_BUDGET });
        await new Promise((resolve) => setTimeout(resolve, SILENCE_MS));

        expect(received).toEqual([]);
    });
});
