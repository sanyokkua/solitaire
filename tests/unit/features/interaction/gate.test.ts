import { describe, expect, it } from 'vitest';
import { dealingProgressed, setRoute, sheetOpened } from '../../../../src/app/appSlice';
import { createAppStore, type AppStore } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import type { GameState } from '../../../../src/domain/types';
import { busySet, cleared, installed } from '../../../../src/features/game/gameSlice';
import { selectInputEnabled } from '../../../../src/features/interaction/selectors';
import { fakeDealService } from '../../../fixtures/dealService';
import { faceUp, makeState, tableauOf } from '../../../fixtures/states';

/** A playable position: one face-up card in column 0. */
const playing = (): GameState => makeState({ tableau: tableauOf(faceUp(cardId(0, 5))) });

/** A store on the Game route with a game in play, so each test closes the gate by exactly one condition. */
function openStore(): AppStore {
    const store = createAppStore({ deps: { dealService: fakeDealService() } });
    store.dispatch(installed({ state: playing(), dailyKey: null }));
    store.dispatch(setRoute('game'));
    return store;
}

describe('selectInputEnabled', () => {
    it('is open on the Game route with a game in play and nothing else going on', () => {
        expect(selectInputEnabled(openStore().getState())).toBe(true);
    });

    it('is open for a fresh, unstarted game', () => {
        const store = openStore();
        store.dispatch(installed({ state: makeState({ started: false }), dailyKey: null }));
        expect(selectInputEnabled(store.getState())).toBe(true);
    });

    it('is closed while a deal is being prepared', () => {
        const store = openStore();
        store.dispatch(dealingProgressed({ overlay: false, attempt: 1 }));
        expect(selectInputEnabled(store.getState())).toBe(false);
    });

    it('is closed while a sheet is open', () => {
        const store = openStore();
        store.dispatch(sheetOpened('settings'));
        expect(selectInputEnabled(store.getState())).toBe(false);
    });

    it('is closed after a win, and stays closed until a new game is installed', () => {
        const store = openStore();
        store.dispatch(installed({ state: makeState({ status: 'won' }), dailyKey: null }));
        expect(selectInputEnabled(store.getState())).toBe(false);
        store.dispatch(installed({ state: playing(), dailyKey: null }));
        expect(selectInputEnabled(store.getState())).toBe(true);
    });

    it('is closed while a safe-card chain or Finish is running', () => {
        const store = openStore();
        store.dispatch(busySet(true));
        expect(selectInputEnabled(store.getState())).toBe(false);
    });

    it('is closed when there is no game', () => {
        const store = openStore();
        store.dispatch(cleared());
        expect(selectInputEnabled(store.getState())).toBe(false);
    });

    it('is closed away from the Game route', () => {
        const store = openStore();
        store.dispatch(setRoute('home'));
        expect(selectInputEnabled(store.getState())).toBe(false);
    });
});
