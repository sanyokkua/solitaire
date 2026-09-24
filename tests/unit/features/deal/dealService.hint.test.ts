// @vitest-environment node
import '@vitest/web-worker';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hint as heuristicHint } from '../../../../src/domain/assist';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { GameState } from '../../../../src/domain/types';
import { createDealService, HINT_BUDGET, type DealService } from '../../../../src/features/deal/dealService';
import type { WorkerLike } from '../../../../src/features/deal/solverClient';
import { solverHint } from '../../../../src/solver/hint';
import { corpusSeeds, MIDGAME_POSITIONS, midgameState } from '../../../fixtures/solverCorpus';
import { foundationsOf, makeState } from '../../../fixtures/states';
import { realFactory, stubAt, stubFactory } from '../../../fixtures/workers';

const HUGE_TIMEOUT_MS = 60_000;
const HINT_TIMEOUT_MS = 150;

const [WIN_SEED = 0] = corpusSeeds('win');
const [LOSS_SEED = 0] = corpusSeeds('loss');

const services: DealService[] = [];

/** Tracks `service` so `afterEach` disposes it, whatever the test did. */
function track(service: DealService): DealService {
    services.push(service);
    return service;
}

afterEach(() => {
    vi.useRealTimers();
    for (const service of services.splice(0)) {
        service.dispose();
    }
});

function midgameAtHintBudget(): GameState {
    const entry = MIDGAME_POSITIONS.find((position) => position.budget === HINT_BUDGET);
    if (entry === undefined) {
        throw new Error('no midgame position pinned at the hint budget');
    }
    return midgameState(entry);
}

/** The domain heuristic's answer for `state`, which the tests require to exist. */
function heuristicFor(state: GameState): NonNullable<ReturnType<typeof heuristicHint>> {
    const hint = heuristicHint(state);
    if (hint === undefined) {
        throw new Error('the position has no heuristic hint');
    }
    return hint;
}

describe('deal service hints from the solver', () => {
    it('answers a mid-line Draw 1 position with the solver suggestion, marked as coming from the solver', async () => {
        const state = midgameAtHintBudget();
        const expected = solverHint(state, HINT_BUDGET);
        expect(expected).toBeDefined();
        const service = track(
            createDealService({ createWorker: realFactory().create, hintTimeoutMs: HUGE_TIMEOUT_MS }),
        );

        const outcome = await service.hint(state);

        expect(outcome).toEqual({ status: 'hint', source: 'solver', hint: expected });
    });

    it('asks the solver for a Daily position too, since it deals one card with no pass limit', async () => {
        const state = { ...midgameAtHintBudget(), mode: 'daily' } satisfies GameState;
        const expected = solverHint(state, HINT_BUDGET);
        expect(expected).toBeDefined();
        const service = track(
            createDealService({ createWorker: realFactory().create, hintTimeoutMs: HUGE_TIMEOUT_MS }),
        );

        expect(await service.hint(state)).toEqual({ status: 'hint', source: 'solver', hint: expected });
    });

    it('answers two hints in a row with the first cancelled and only the second answered', async () => {
        const state = midgameAtHintBudget();
        const factory = realFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));

        const first = service.hint(state);
        const second = service.hint(state);

        expect(await first).toEqual({ status: 'cancelled' });
        expect(await second).toEqual({ status: 'hint', source: 'solver', hint: solverHint(state, HINT_BUDGET) });
        expect(factory.workers).toHaveLength(1);
    });
});

describe('deal service hints from the heuristic', () => {
    it.each<{ readonly label: string; readonly mode: 'draw3' | 'vegas' }>([
        { label: 'Draw 3', mode: 'draw3' },
        { label: 'Vegas', mode: 'vegas' },
    ])('answers a $label position with the heuristic and never starts a worker', async ({ mode }) => {
        const state = dealFromSeed(WIN_SEED, mode);
        const createWorker = vi.fn<() => WorkerLike>(realFactory().create);
        const service = track(createDealService({ createWorker }));

        const outcome = await service.hint(state);

        expect(outcome).toEqual({ status: 'hint', source: 'heuristic', hint: heuristicFor(state) });
        expect(createWorker).not.toHaveBeenCalled();
    });

    it('answers a Draw 1 position the solver proves lost with the heuristic', async () => {
        const state = dealFromSeed(LOSS_SEED, 'draw1');
        const service = track(
            createDealService({ createWorker: realFactory().create, hintTimeoutMs: HUGE_TIMEOUT_MS }),
        );

        const outcome = await service.hint(state);

        expect(outcome).toEqual({ status: 'hint', source: 'heuristic', hint: heuristicFor(state) });
    });

    it('answers the heuristic when the solver replies with no suggestion', async () => {
        const state = dealFromSeed(WIN_SEED, 'draw1');
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));

        const outcome = service.hint(state);
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: undefined });

        expect(await outcome).toEqual({ status: 'hint', source: 'heuristic', hint: heuristicFor(state) });
    });

    it('answers the heuristic after hintTimeoutMs when the solver stays silent, leaving the worker running', async () => {
        vi.useFakeTimers();
        const state = dealFromSeed(WIN_SEED, 'draw1');
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HINT_TIMEOUT_MS }));
        const settled = vi.fn();

        const outcome = service.hint(state).then(settled);
        await vi.advanceTimersByTimeAsync(HINT_TIMEOUT_MS - 1);
        expect(settled).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await outcome;

        expect(settled).toHaveBeenCalledExactlyOnceWith({
            status: 'hint',
            source: 'heuristic',
            hint: heuristicFor(state),
        });
        expect(stubAt(factory.stubs, 0).terminated).toBe(false);
    });

    it('waits 150 ms for the solver by default', async () => {
        vi.useFakeTimers();
        const state = dealFromSeed(WIN_SEED, 'draw1');
        const service = track(createDealService({ createWorker: stubFactory().create }));
        const settled = vi.fn();

        void service.hint(state).then(settled);
        await vi.advanceTimersByTimeAsync(149);
        expect(settled).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        expect(settled).toHaveBeenCalledTimes(1);
    });

    it('answers the heuristic when the worker fails', async () => {
        const state = dealFromSeed(WIN_SEED, 'draw1');
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));

        const outcome = service.hint(state);
        stubAt(factory.stubs, 0).emit('error');

        expect(await outcome).toEqual({ status: 'hint', source: 'heuristic', hint: heuristicFor(state) });
    });

    it('answers the heuristic when the worker cannot be started at all', async () => {
        const state = dealFromSeed(WIN_SEED, 'draw1');
        const createWorker = vi.fn<() => WorkerLike>(() => {
            throw new Error('workers are unavailable');
        });
        const service = track(createDealService({ createWorker, hintTimeoutMs: HUGE_TIMEOUT_MS }));

        expect(await service.hint(state)).toEqual({ status: 'hint', source: 'heuristic', hint: heuristicFor(state) });
    });
});

describe('deal service hints for positions without a suggestion', () => {
    it('answers none for a won position without asking the solver', async () => {
        const createWorker = vi.fn<() => WorkerLike>(realFactory().create);
        const service = track(createDealService({ createWorker }));
        const won = makeState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' });

        expect(await service.hint(won)).toEqual({ status: 'none' });
        expect(createWorker).not.toHaveBeenCalled();
    });

    it('answers none when neither the solver nor the heuristic offers a move', async () => {
        const service = track(
            createDealService({ createWorker: realFactory().create, hintTimeoutMs: HUGE_TIMEOUT_MS }),
        );
        const empty = makeState();
        expect(heuristicHint(empty)).toBeUndefined();

        expect(await service.hint(empty)).toEqual({ status: 'none' });
    });
});

describe('deal service: a newer request wins over a hint', () => {
    it('answers the heuristic for a hint asked during a pending deal, and the deal still resolves dealt', async () => {
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));
        const state = dealFromSeed(WIN_SEED, 'draw1');

        const deal = service.deal({ mode: 'draw1', winnableOnly: true });
        const stub = stubAt(factory.stubs, 0);
        const outcome = await service.hint(state);

        expect(outcome).toEqual({ status: 'hint', source: 'heuristic', hint: heuristicFor(state) });
        expect(stub.requests.map((request) => request.type)).toEqual(['findWinnable']);
        expect(stub.terminated).toBe(false);
        stub.reply({ id: stub.idOf(0), type: 'findWinnable', seed: WIN_SEED, verdict: 'win', attempts: 1 });
        expect(await deal).toEqual({
            status: 'dealt',
            state: dealFromSeed(WIN_SEED, 'draw1', { verdict: 'win', attempts: 1 }),
        });
    });

    it('cancels a pending hint when a deal follows it', async () => {
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));

        const hint = service.hint(dealFromSeed(WIN_SEED, 'draw1'));
        const deal = await service.deal({ mode: 'draw3', winnableOnly: false });

        expect(await hint).toEqual({ status: 'cancelled' });
        expect(deal.status).toBe('dealt');
    });

    it('cancels a hint the client already answered when a deal is requested in the same tick', async () => {
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));

        const hint = service.hint(dealFromSeed(WIN_SEED, 'draw1'));
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: { kind: 'draw' } });
        const deal = await service.deal({ mode: 'draw3', winnableOnly: false });

        expect(await hint).toEqual({ status: 'cancelled' });
        expect(deal.status).toBe('dealt');
    });

    it('cancels an older pending solver hint when a newer heuristic-only hint replaces it', async () => {
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));
        const drawThree = dealFromSeed(WIN_SEED, 'draw3');

        const older = service.hint(dealFromSeed(WIN_SEED, 'draw1'));
        const newer = await service.hint(drawThree);
        const stub = stubAt(factory.stubs, 0);
        stub.reply({ id: stub.idOf(0), type: 'hint', hint: { kind: 'draw' } });

        expect(newer).toEqual({ status: 'hint', source: 'heuristic', hint: heuristicFor(drawThree) });
        expect(await older).toEqual({ status: 'cancelled' });
    });

    it.each<{ readonly label: string; readonly newer: () => GameState }>([
        { label: 'Draw 3', newer: () => dealFromSeed(WIN_SEED, 'draw3') },
        { label: 'Vegas', newer: () => dealFromSeed(WIN_SEED, 'vegas') },
        { label: 'won', newer: () => makeState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' }) },
    ])('cancels a silent pending solver hint at once when a $label hint replaces it', async ({ newer }) => {
        const factory = stubFactory();
        const service = track(createDealService({ createWorker: factory.create, hintTimeoutMs: HUGE_TIMEOUT_MS }));

        const older = service.hint(dealFromSeed(WIN_SEED, 'draw1'));
        void service.hint(newer());

        expect(await older).toEqual({ status: 'cancelled' });
        expect(stubAt(factory.stubs, 0).terminated).toBe(false);
    });

    it('cancels a pending hint when the service is disposed', async () => {
        const service = track(
            createDealService({ createWorker: stubFactory().create, hintTimeoutMs: HUGE_TIMEOUT_MS }),
        );

        const hint = service.hint(dealFromSeed(WIN_SEED, 'draw1'));
        service.dispose();

        expect(await hint).toEqual({ status: 'cancelled' });
    });
});
