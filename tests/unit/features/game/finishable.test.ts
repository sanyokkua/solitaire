import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import { finishPlan } from '../../../../src/domain/finish';
import type { GameState } from '../../../../src/domain/types';
import { accrued, committed, installed, selectCanFinish } from '../../../../src/features/game/gameSlice';
import { WINNING_LINE, allFaceUp } from '../../../fixtures/deals';
import { testStore } from '../../../support/testStore';

/** A store holding `game`. */
function storeWith(game: GameState) {
    const store = testStore({ deps: { now: () => 1000 } });
    store.dispatch(installed({ state: game, dailyKey: null }));
    return store;
}

/** `game` with every command of its finish plan applied: the won position. */
function played(game: GameState): GameState {
    const plan = finishPlan(game);
    if (plan === undefined) throw new Error('the position has no finish plan');
    return plan.commands.reduce((state, cmd) => applyCommand(state, cmd).state, game);
}

describe('selectCanFinish stability', () => {
    it('stays available while the clock ticks and the piles are unchanged', () => {
        const store = storeWith(allFaceUp());
        expect(selectCanFinish(store.getState())).toBe(true);

        for (let tick = 1; tick <= 20; tick++) {
            store.dispatch(accrued({ atMs: 1000 + tick * 250, eligible: true }));
            expect(selectCanFinish(store.getState())).toBe(true);
        }
        expect(store.getState().game.current?.elapsedMs).toBeGreaterThan(allFaceUp().elapsedMs);
    });

    it('stays unavailable while the clock ticks on a position that cannot be finished', () => {
        const store = storeWith(dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode));
        expect(selectCanFinish(store.getState())).toBe(false);

        for (let tick = 1; tick <= 20; tick++) {
            store.dispatch(accrued({ atMs: 1000 + tick * 250, eligible: true }));
            expect(selectCanFinish(store.getState())).toBe(false);
        }
    });

    it('changes after a move that changes the piles', () => {
        const start = allFaceUp();
        const store = storeWith(start);
        expect(selectCanFinish(store.getState())).toBe(true);

        store.dispatch(committed(played(start)));

        expect(store.getState().game.current?.status).toBe('won');
        expect(selectCanFinish(store.getState())).toBe(false);
    });
});
