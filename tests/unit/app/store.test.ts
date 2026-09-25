import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../../../src/app/store';
import { appReducer, selectRoute, setRoute } from '../../../src/app/appSlice';
import { dealFromSeed } from '../../../src/domain/deal';
import type { GameState } from '../../../src/domain/types';
import { committed, gameReducer, installed, type GameSliceState } from '../../../src/features/game/gameSlice';
import { defaultPreferences, preferenceSet } from '../../../src/features/preferences/preferencesSlice';
import { statsReducer } from '../../../src/features/stats/statsSlice';
import { fakeDealService } from '../../fixtures/dealService';
import { makeState } from '../../fixtures/states';

describe('application store', () => {
    it('starts at the home route', () => {
        const store = createAppStore();

        expect(selectRoute(store.getState())).toBe('home');
    });

    it('transitions to the game route on setRoute', () => {
        const store = createAppStore();

        store.dispatch(setRoute('game'));

        expect(store.getState().app.route).toBe('game');
    });

    it('reads the route from real store state via the selector', () => {
        const store = createAppStore();

        store.dispatch(setRoute('game'));

        expect(selectRoute(store.getState())).toBe('game');
    });

    it('creates isolated stores whose state does not leak between instances', () => {
        const first = createAppStore();
        const second = createAppStore();

        first.dispatch(setRoute('game'));

        expect(selectRoute(first.getState())).toBe('game');
        expect(selectRoute(second.getState())).toBe('home');
    });

    it('exposes the preferences and stats slices at their initial state', () => {
        const state = createAppStore().getState();

        expect(state.preferences).toEqual(defaultPreferences('en'));
        expect(state.stats).toEqual(statsReducer(undefined, { type: 'init' }));
        expect(state.app.sheet).toBeNull();
    });

    it('honours a preloaded state and starts omitted slices at their defaults', () => {
        const store = createAppStore({
            preloadedState: {
                preferences: { ...defaultPreferences('en'), autoSafe: true },
                app: appReducer(undefined, setRoute('game')),
            },
        });

        expect(store.getState().preferences.autoSafe).toBe(true);
        expect(selectRoute(store.getState())).toBe('game');
        expect(store.getState().stats).toEqual(statsReducer(undefined, { type: 'init' }));
    });

    it('keeps bare stores isolated from a preloaded one', () => {
        const preloaded = createAppStore({
            preloadedState: { preferences: { ...defaultPreferences('en'), autoSafe: true } },
        });
        const bare = createAppStore();

        bare.dispatch(setRoute('game'));
        preloaded.dispatch(preferenceSet({ key: 'autoSafe', value: false }));

        expect(selectRoute(bare.getState())).toBe('game');
        expect(selectRoute(preloaded.getState())).toBe('home');
        expect(bare.getState().preferences.autoSafe).toBe(false);
        expect(preloaded.getState().preferences.autoSafe).toBe(false);

        bare.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        expect(preloaded.getState().preferences.autoSafe).toBe(false);
    });

    it('starts the game slice at its initial state and honours a preloaded game', () => {
        expect(createAppStore().getState().game).toEqual(gameReducer(undefined, { type: 'init' }));

        const game: GameSliceState = gameReducer(
            undefined,
            installed({ state: makeState({ seed: 7 }), dailyKey: null }),
        );
        const store = createAppStore({ preloadedState: { game } });

        expect(store.getState().game).toEqual(game);
        expect(store.getState().game.epoch).toBe(1);
    });
});

describe('thunk dependencies', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('hands injected dependencies to thunks', () => {
        const dealService = fakeDealService();
        const today = () => new Date(Date.UTC(2026, 8, 24));
        const store = createAppStore({ deps: { dealService, now: () => 42, today } });

        const extra = store.dispatch((_dispatch, _getState, injected) => injected);

        expect(extra.dealService).toBe(dealService);
        expect(extra.now()).toBe(42);
        expect(extra.today).toBe(today);
        expect(typeof extra.delay).toBe('function');
    });

    it('keeps the default for every dependency that is not injected', () => {
        const store = createAppStore({ deps: { now: () => 42 } });

        const extra = store.dispatch((_dispatch, _getState, injected) => injected);

        expect(extra.now()).toBe(42);
        expect(extra.today()).toBeInstanceOf(Date);
        expect(typeof extra.dealService.deal).toBe('function');
    });

    it('defaults to the real clock, timer and date on a bare store', async () => {
        const store = createAppStore();

        const extra = store.dispatch((_dispatch, _getState, injected) => injected);

        expect(typeof extra.now()).toBe('number');
        expect(extra.today()).toBeInstanceOf(Date);
        await expect(extra.delay(0)).resolves.toBeUndefined();
        expect(() => {
            extra.dealService.dispose();
        }).not.toThrow();
    });

    it('lets a thunk drive the injected deal service', () => {
        const dealService = fakeDealService();
        const store = createAppStore({ deps: { dealService } });

        void store.dispatch((_dispatch, _getState, extra) =>
            extra.dealService.deal({ mode: 'draw3', winnableOnly: false }),
        );

        expect(dealService.requests).toHaveLength(1);
        expect(dealService.requests[0]?.request).toEqual({ mode: 'draw3', winnableOnly: false });
    });
});

describe('game history and the development state checks', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const base = dealFromSeed(1, 'draw1');

    function preloaded(history: GameState[]) {
        const game: GameSliceState = {
            ...gameReducer(undefined, installed({ state: base, dailyKey: null })),
            history,
        };
        return createAppStore({ preloadedState: { game } });
    }

    it('does not run the serializable check over the undo history', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const unserializable: GameState = Object.assign({}, base, { hook: () => undefined });
        const store = preloaded([unserializable]);

        store.dispatch(committed({ ...base, moves: 1 }));

        expect(error).not.toHaveBeenCalled();
    });

    it('does not run the immutable check over the undo history', () => {
        const snapshot: { -readonly [K in keyof GameState]: GameState[K] } = { ...base };
        const store = preloaded([snapshot]);
        // The store took its first look at the state when it was created; changing a snapshot afterwards is the kind
        // of change the immutable check would throw for if it walked the history.
        snapshot.moves = 99;

        expect(() => store.dispatch(committed({ ...base, moves: 1 }))).not.toThrow();
    });
});
