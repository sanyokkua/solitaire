import { describe, expect, it } from 'vitest';
import { setRoute } from '../../../../src/app/appSlice';
import { createAppStore } from '../../../../src/app/store';
import { dealFromSeed } from '../../../../src/domain/deal';
import { gameReducer, initialGameState, installed } from '../../../../src/features/game/gameSlice';
import { continueGame } from '../../../../src/features/game/gameThunks';
import { fakeDealService } from '../../../fixtures/dealService';
import { playedGame } from '../../../fixtures/games';

function storeWith(game = initialGameState) {
    const dealService = fakeDealService();
    return { store: createAppStore({ preloadedState: { game }, deps: { dealService } }), dealService };
}

describe('continueGame', () => {
    it('routes to Game for a started, unwon game and changes nothing else', () => {
        const { store, dealService } = storeWith(playedGame());
        const before = store.getState();
        expect(before.app.route).toBe('home');

        store.dispatch(continueGame());

        const after = store.getState();
        expect(after.app.route).toBe('game');
        expect(after.game).toBe(before.game);
        expect(after.game.epoch).toBe(before.game.epoch);
        expect(after.stats).toBe(before.stats);
        expect(after.preferences).toBe(before.preferences);
        expect(after.app.dealing).toBeNull();
        expect(dealService.requests).toEqual([]);
    });

    it('does nothing without a game', () => {
        const { store } = storeWith();
        const before = store.getState();

        store.dispatch(continueGame());

        expect(store.getState()).toBe(before);
    });

    it('does nothing for an unstarted game', () => {
        const { store } = storeWith(
            gameReducer(undefined, installed({ state: dealFromSeed(1, 'draw1'), dailyKey: null })),
        );
        const before = store.getState();

        store.dispatch(continueGame());

        expect(store.getState()).toBe(before);
        expect(store.getState().app.route).toBe('home');
    });

    it('does nothing for a won game', () => {
        const { store } = storeWith(
            gameReducer(
                undefined,
                installed({ state: { ...dealFromSeed(1, 'draw1'), started: true, status: 'won' }, dailyKey: null }),
            ),
        );
        const before = store.getState();

        store.dispatch(continueGame());

        expect(store.getState()).toBe(before);
    });

    it('leaves the route alone when already on Game', () => {
        const { store } = storeWith(playedGame());
        store.dispatch(setRoute('game'));

        store.dispatch(continueGame());

        expect(store.getState().app.route).toBe('game');
    });
});
