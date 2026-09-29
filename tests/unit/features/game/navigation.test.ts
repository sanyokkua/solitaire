// covers: KS-DEAL-08, KS-SCO-06, KS-SCO-07
import { describe, expect, it } from 'vitest';
import { dealingEnded, dealingProgressed, setRoute, sheetOpened } from '../../../../src/app/appSlice';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { GameState, Mode } from '../../../../src/domain/types';
import { busySet, installed } from '../../../../src/features/game/gameSlice';
import {
    canPause,
    closeSheet,
    dealNewGame,
    goHome,
    pause,
    requestNewDeal,
    restartDeal,
    resume,
} from '../../../../src/features/game/navigationThunks';
import { selectClockEligible } from '../../../../src/features/game/clock';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { testStore } from '../../../support/testStore';

/** A store on the Home route with a fake deal service; `game` is installed first when given. */
function setup(game: GameState | null = null) {
    const dealService = fakeDealService();
    const store = testStore({ deps: { now: () => 1000, dealService } });
    if (game !== null) store.dispatch(installed({ state: game, dailyKey: null }));
    return { store, dealService };
}

type Env = ReturnType<typeof setup>;

/** A game that has had an accepted command and is still being played. */
const startedGame = (seed: number, mode: Mode): GameState => ({ ...dealFromSeed(seed, mode), started: true });

const current = ({ store }: Env): GameState => {
    const game = store.getState().game.current;
    if (game === null) throw new Error('no game in play');
    return game;
};

describe('requestNewDeal', () => {
    it('opens the New deal options for a started, unwon game', () => {
        const { store } = setup(startedGame(1, 'draw1'));

        void store.dispatch(requestNewDeal());

        expect(store.getState().app.sheet).toBe('newDeal');
        expect(store.getState().game.current).toEqual(startedGame(1, 'draw1'));
    });

    it('deals the current mode at once for an unstarted game', async () => {
        const env = setup(dealFromSeed(1, 'draw3'));
        const { store, dealService } = env;

        const requested = store.dispatch(requestNewDeal());
        dealService.resolve(0, dealFromSeed(2, 'draw3'));
        await requested;

        expect(store.getState().app.sheet).toBeNull();
        expect(store.getState().app.route).toBe('game');
        expect(current(env).mode).toBe('draw3');
    });

    it('deals the current mode at once for a won game', async () => {
        const env = setup({ ...startedGame(1, 'vegas'), status: 'won' });
        const { store, dealService } = env;

        const requested = store.dispatch(requestNewDeal());
        dealService.resolve(0, dealFromSeed(2, 'vegas'));
        await requested;

        expect(current(env).mode).toBe('vegas');
    });

    it('deals the selected mode when there is no game', async () => {
        const env = setup();
        const { store, dealService } = env;
        store.dispatch(preferenceSet({ key: 'selectedMode', value: 'draw3' }));

        const requested = store.dispatch(requestNewDeal());
        dealService.resolve(0, dealFromSeed(9, 'draw3'));
        await requested;

        expect(current(env).mode).toBe('draw3');
    });

    it('does nothing while a safe-card chain or finish is running', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(busySet(true));

        void store.dispatch(requestNewDeal());

        expect(store.getState().app.sheet).toBeNull();
        expect(store.getState().app.route).toBe('home');
        expect(store.getState().game.current).toEqual(startedGame(1, 'draw1'));
    });

    it('does nothing while a deal is already being prepared', async () => {
        const { store, dealService } = setup();

        const first = store.dispatch(requestNewDeal());
        dealService.progress(0, { overlay: true, attempt: 1 });
        expect(store.getState().app.dealing).not.toBeNull();

        void store.dispatch(requestNewDeal());
        expect(store.getState().app.sheet).toBeNull();

        dealService.resolve(0, dealFromSeed(1, 'draw1'));
        await first;
    });

    it('the clock is not eligible to accrue while the New deal options are open', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(setRoute('game'));
        expect(selectClockEligible(store.getState())).toBe(true);

        void store.dispatch(requestNewDeal());

        expect(selectClockEligible(store.getState())).toBe(false);
    });
});

describe('dealNewGame', () => {
    it('closes any open sheet, including win, and starts the requested mode', async () => {
        const env = setup(startedGame(1, 'vegas'));
        const { store, dealService } = env;
        store.dispatch(sheetOpened('win'));

        const dealt = store.dispatch(dealNewGame('draw1'));
        dealService.resolve(0, dealFromSeed(5, 'draw1'));
        await dealt;

        expect(store.getState().app.sheet).toBeNull();
        expect(store.getState().app.route).toBe('game');
        expect(current(env).mode).toBe('draw1');
    });
});

describe('restartDeal', () => {
    it('closes the sheet and reinstalls the same seed', () => {
        const env = setup(startedGame(7, 'draw1'));
        const { store } = env;
        store.dispatch(sheetOpened('newDeal'));

        store.dispatch(restartDeal());

        expect(store.getState().app.sheet).toBeNull();
        expect(current(env).seed).toBe(7);
        expect(current(env).started).toBe(false);
    });
});

describe('goHome', () => {
    it('keeps the game resumable and closes any open sheet, including win', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(sheetOpened('win'));

        store.dispatch(goHome());

        expect(store.getState().app.route).toBe('home');
        expect(store.getState().app.sheet).toBeNull();
        expect(store.getState().game.current).toEqual(startedGame(1, 'draw1'));
    });
});

describe('pause', () => {
    it('opens the Paused sheet for a started, unwon game on the Game route', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(setRoute('game'));

        store.dispatch(pause());

        expect(store.getState().app.sheet).toBe('paused');
    });

    it('is refused on Home', () => {
        const { store } = setup(startedGame(1, 'draw1'));

        store.dispatch(pause());

        expect(store.getState().app.sheet).toBeNull();
    });

    it('is refused without a game', () => {
        const { store } = setup();
        store.dispatch(setRoute('game'));

        store.dispatch(pause());

        expect(store.getState().app.sheet).toBeNull();
    });

    it('is refused on a won game', () => {
        const { store } = setup({ ...startedGame(1, 'draw1'), status: 'won' });
        store.dispatch(setRoute('game'));

        store.dispatch(pause());

        expect(store.getState().app.sheet).toBeNull();
    });

    it('does nothing while a safe-card chain or finish is running', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(setRoute('game'));
        store.dispatch(busySet(true));

        store.dispatch(pause());

        expect(store.getState().app.sheet).toBeNull();
    });

    it('does nothing while a deal is being prepared', async () => {
        // An unstarted game deals at once on request, so a deal is genuinely in flight to pause against.
        const { store, dealService } = setup(dealFromSeed(1, 'draw1'));
        store.dispatch(setRoute('game'));
        const requested = store.dispatch(requestNewDeal());
        dealService.progress(0, { overlay: true, attempt: 1 });
        expect(store.getState().app.dealing).not.toBeNull();

        store.dispatch(pause());

        expect(store.getState().app.sheet).not.toBe('paused');
        dealService.resolve(0, dealFromSeed(2, 'draw1'));
        await requested;
    });
});

describe('canPause', () => {
    it('holds for a started, unwon game on the Game route', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(setRoute('game'));

        expect(canPause(store.getState())).toBe(true);
    });

    it('fails off the Game route, without a game and for a won game', () => {
        const home = setup(startedGame(1, 'draw1'));
        expect(canPause(home.store.getState())).toBe(false);

        const none = setup();
        none.store.dispatch(setRoute('game'));
        expect(canPause(none.store.getState())).toBe(false);

        const won = setup({ ...startedGame(1, 'draw1'), status: 'won' });
        won.store.dispatch(setRoute('game'));
        expect(canPause(won.store.getState())).toBe(false);
    });

    it('fails while a safe-card chain or finish is running', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(setRoute('game'));
        store.dispatch(busySet(true));

        expect(canPause(store.getState())).toBe(false);
    });

    it('fails while the dealing overlay is showing and holds again once dealing ends', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(setRoute('game'));
        store.dispatch(dealingProgressed({ overlay: true, attempt: 1 }));

        expect(canPause(store.getState())).toBe(false);

        store.dispatch(dealingEnded());

        expect(canPause(store.getState())).toBe(true);
    });
});

describe('resume', () => {
    it('closes the Paused sheet', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(sheetOpened('paused'));

        store.dispatch(resume());

        expect(store.getState().app.sheet).toBeNull();
    });
});

describe('closeSheet', () => {
    it('closes any sheet except win', () => {
        const { store } = setup();
        store.dispatch(sheetOpened('settings'));

        store.dispatch(closeSheet());

        expect(store.getState().app.sheet).toBeNull();
    });

    it('never closes win', () => {
        const { store } = setup();
        store.dispatch(sheetOpened('win'));

        store.dispatch(closeSheet());

        expect(store.getState().app.sheet).toBe('win');
    });
});
