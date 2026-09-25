import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import type { GameState } from '../../../../src/domain/types';
import { setRoute, sheetOpened, sheetClosed, visibilityChanged } from '../../../../src/app/appSlice';
import type { AppState } from '../../../../src/app/appSlice';
import { createAppStore } from '../../../../src/app/store';
import { selectClockEligible } from '../../../../src/features/game/clock';
import {
    accrued,
    busySet,
    committed,
    gameReducer,
    installed,
    type GameSliceState,
} from '../../../../src/features/game/gameSlice';
import { makeState } from '../../../fixtures/states';

const initialGame: GameSliceState = gameReducer(undefined, { type: 'init' });

/** The fresh deal with one accepted draw applied, so the game has started. */
function startedState(): GameState {
    return applyCommand(dealFromSeed(1, 'draw1'), { type: 'draw' }).state;
}

function appState(partial: Partial<AppState> = {}): AppState {
    return {
        route: 'game',
        sheet: null,
        notices: [],
        documentVisible: true,
        systemReducedMotion: false,
        dealing: null,
        ...partial,
    };
}

function root(game: GameState | null, app: Partial<AppState> = {}): { app: AppState; game: GameSliceState } {
    return {
        app: appState(app),
        game: game === null ? initialGame : gameReducer(initialGame, installed({ state: game, dailyKey: null })),
    };
}

describe('selectClockEligible', () => {
    it('is true for a started, playing game on the Game route with no sheet and a visible document', () => {
        expect(selectClockEligible(root(startedState()))).toBe(true);
    });

    it.each([
        ['the route is Home', startedState(), { route: 'home' as const }],
        ['a sheet is open', startedState(), { sheet: 'settings' as const }],
        ['the document is hidden', startedState(), { documentVisible: false }],
        ['the game has not started', dealFromSeed(1, 'draw1'), {}],
        ['the game is won', makeState({ started: true, status: 'won' }), {}],
    ])('is false when %s', (_name, game, app) => {
        expect(selectClockEligible(root(game, app))).toBe(false);
    });

    it('is false without a game', () => {
        expect(selectClockEligible(root(null))).toBe(false);
    });

    it('does not depend on busy', () => {
        const state = root(startedState());

        expect(selectClockEligible({ ...state, game: gameReducer(state.game, busySet(true)) })).toBe(true);
    });
});

describe('accrued through the store', () => {
    /** A store with `state` installed and the Game route shown, plus a helper that accrues at a given time. */
    function setup(state: GameState) {
        const store = createAppStore();
        store.dispatch(installed({ state, dailyKey: null }));
        store.dispatch(setRoute('game'));
        return {
            store,
            accrueAt: (atMs: number) => {
                store.dispatch(accrued({ atMs, eligible: selectClockEligible(store.getState()) }));
            },
            elapsed: () => store.getState().game.current?.elapsedMs,
            anchor: () => store.getState().game.clock.anchorMs,
        };
    }

    it('only sets the anchor on the first accrual, then adds the interval', () => {
        const { accrueAt, elapsed, anchor } = setup(startedState());

        accrueAt(10_000);
        expect(elapsed()).toBe(0);
        expect(anchor()).toBe(10_000);

        accrueAt(10_250);
        expect(elapsed()).toBe(250);
        expect(anchor()).toBe(10_250);
    });

    it('keeps elapsedMs a whole number on a fractional clock, carrying the remainder forward', () => {
        const { accrueAt, elapsed, anchor } = setup(startedState());

        accrueAt(1000.4);
        accrueAt(1250.7);
        expect(elapsed()).toBe(250);
        expect(anchor()).toBeCloseTo(1250.4);

        accrueAt(1500.1);
        expect(elapsed()).toBe(499);
        accrueAt(1500.4);
        expect(elapsed()).toBe(500);
        expect(Number.isInteger(elapsed())).toBe(true);
    });

    it('never loses time to rounding: many small steps add up to the whole interval', () => {
        const { accrueAt, elapsed } = setup(startedState());

        accrueAt(0.5);
        for (let i = 1; i <= 100; i++) accrueAt(0.5 + i * 10.3);

        expect(elapsed()).toBe(Math.floor(100 * 10.3));
    });

    it('adds at most one second for a long gap between measurements', () => {
        const { accrueAt, elapsed, anchor } = setup(startedState());

        accrueAt(0);
        accrueAt(5 * 60_000);

        expect(elapsed()).toBe(1000);
        expect(anchor()).toBe(5 * 60_000);
    });

    it('never adds a negative interval when the reading goes backwards', () => {
        const { accrueAt, elapsed, anchor } = setup(startedState());

        accrueAt(1000);
        accrueAt(500);

        expect(elapsed()).toBe(0);
        expect(anchor()).toBe(500);
    });

    it('does not count the time spent on Home', () => {
        const { store, accrueAt, elapsed, anchor } = setup(startedState());
        accrueAt(0);
        accrueAt(250);

        store.dispatch(setRoute('home'));
        accrueAt(500);
        expect(anchor()).toBeNull();
        accrueAt(30_250);
        store.dispatch(setRoute('game'));
        accrueAt(30_500);
        expect(elapsed()).toBe(250);
        expect(anchor()).toBe(30_500);

        accrueAt(30_750);
        expect(elapsed()).toBe(500);
    });

    it('does not count the time an open sheet covers the board', () => {
        const { store, accrueAt, elapsed } = setup(startedState());
        accrueAt(0);
        accrueAt(250);

        store.dispatch(sheetOpened('settings'));
        accrueAt(500);
        accrueAt(10_250);
        store.dispatch(sheetClosed());
        accrueAt(10_500);

        expect(elapsed()).toBe(250);
    });

    it('does not count the time the document is hidden', () => {
        const { store, accrueAt, elapsed } = setup(startedState());
        accrueAt(0);
        accrueAt(250);

        store.dispatch(visibilityChanged(false));
        accrueAt(500);
        accrueAt(60_250);
        store.dispatch(visibilityChanged(true));
        accrueAt(60_500);

        expect(elapsed()).toBe(250);
    });

    it('never accrues on a won game', () => {
        const { accrueAt, elapsed, anchor } = setup(makeState({ started: true, status: 'won', elapsedMs: 4000 }));

        accrueAt(0);
        accrueAt(250);

        expect(elapsed()).toBe(4000);
        expect(anchor()).toBeNull();
    });

    it('never accrues on a game that has not started', () => {
        const { accrueAt, elapsed, anchor } = setup(dealFromSeed(1, 'draw1'));

        accrueAt(0);
        accrueAt(20_000);

        expect(elapsed()).toBe(0);
        expect(anchor()).toBeNull();
    });

    it('leaves the history and future snapshots untouched', () => {
        const before = dealFromSeed(1, 'draw1');
        const store = createAppStore();
        store.dispatch(installed({ state: before, dailyKey: null }));
        store.dispatch(committed(startedState()));
        store.dispatch(setRoute('game'));
        const historyBefore = store.getState().game.history;
        const futureBefore = store.getState().game.future;
        const snapshotBefore = historyBefore[0];

        store.dispatch(accrued({ atMs: 0, eligible: true }));
        store.dispatch(accrued({ atMs: 400, eligible: true }));

        const { game } = store.getState();
        expect(game.current?.elapsedMs).toBe(400);
        expect(game.history).toBe(historyBefore);
        expect(game.history[0]).toBe(snapshotBefore);
        expect(game.future).toBe(futureBefore);
        expect(game.history[0]?.elapsedMs).toBe(0);
    });

    it('leaves the state equal and the anchor null when there is no game', () => {
        const store = createAppStore();
        const before = store.getState().game;

        store.dispatch(accrued({ atMs: 100, eligible: true }));

        expect(store.getState().game).toBe(before);
        expect(store.getState().game.clock.anchorMs).toBeNull();
    });

    it('clears a stale anchor when the game is gone', () => {
        const state = gameReducer({ ...initialGame, clock: { anchorMs: 50 } }, accrued({ atMs: 100, eligible: true }));

        expect(state.clock.anchorMs).toBeNull();
        expect(state.current).toBeNull();
    });
});
