import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../../../../src/app/store';
import { applyCommand } from '../../../../src/domain/engine';
import * as finishModule from '../../../../src/domain/finish';
import type { finishPlan as FinishPlanFn } from '../../../../src/domain/finish';
import type { GameState } from '../../../../src/domain/types';
import { accrued, committed, installed, selectCanFinish } from '../../../../src/features/game/gameSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { allFaceUp } from '../../../fixtures/deals';

vi.mock('../../../../src/domain/finish', async (importActual) => {
    const actual = await importActual<{ finishPlan: typeof FinishPlanFn }>();
    return { ...actual, finishPlan: vi.fn(actual.finishPlan) };
});

const finishPlan = vi.mocked(finishModule.finishPlan);

/** A store holding `game`, with the finish plan spy cleared so only the calls the test causes are counted. */
function storeWith(game: GameState) {
    const store = createAppStore({
        deps: { now: () => 1000, delay: () => Promise.resolve(), dealService: fakeDealService() },
    });
    store.dispatch(installed({ state: game, dailyKey: null }));
    finishPlan.mockClear();
    return store;
}

beforeEach(() => {
    finishPlan.mockClear();
});

describe('selectCanFinish stability', () => {
    it('does not plan again while the clock ticks and the piles are unchanged', () => {
        const store = storeWith(allFaceUp());
        expect(selectCanFinish(store.getState())).toBe(true);
        expect(finishPlan).toHaveBeenCalledTimes(1);

        for (let tick = 1; tick <= 20; tick++) {
            store.dispatch(accrued({ atMs: 1000 + tick * 250, eligible: true }));
        }
        expect(selectCanFinish(store.getState())).toBe(true);
        expect(finishPlan).toHaveBeenCalledTimes(1);
    });

    it('plans again after a move changes the piles', () => {
        const start = allFaceUp();
        const first = finishModule.finishPlan(start)?.commands[0];
        if (first === undefined) throw new Error('the position has no finish plan');
        const store = storeWith(start);
        expect(selectCanFinish(store.getState())).toBe(true);
        expect(finishPlan).toHaveBeenCalledTimes(1);

        store.dispatch(committed(applyCommand(start, first).state));
        selectCanFinish(store.getState());
        expect(finishPlan).toHaveBeenCalledTimes(2);
    });
});
