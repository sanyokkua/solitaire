import { describe, expect, it, vi } from 'vitest';
import { setRoute, systemMotionChanged } from '../../../../src/app/appSlice';
import { createAppStore, type AppStore } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import { nextSafeMove } from '../../../../src/domain/assist';
import type { Command, GameState } from '../../../../src/domain/types';
import { busySet, installed } from '../../../../src/features/game/gameSlice';
import { play, redo, undo } from '../../../../src/features/game/gameThunks';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { faceUp, foundationsOf, makeState, tableauOf } from '../../../fixtures/states';

const DRAW: Command = { type: 'draw' };
const ACE_HEARTS = cardId(0, 1);
const ACE_SPADES = cardId(3, 1);
const NINE_CLUBS = cardId(2, 9);

/** A position whose next draw is legal and which already exposes two safe cards: the Aces of hearts and spades. */
function twoSafeCards(partial: Partial<GameState> = {}): GameState {
    return makeState({
        tableau: tableauOf([], [], faceUp(ACE_HEARTS), faceUp(ACE_SPADES)),
        stock: [NINE_CLUBS],
        ...partial,
    });
}

/** A delay stub's view: every requested duration, and what the test does with each call. */
interface DelayHooks {
    /** Called with the duration and the 1-based call number; return a promise to hold that delay open. */
    readonly onCall?: (ms: number, call: number) => Promise<void> | undefined;
}

function storeOf(ref: { store: AppStore | undefined }): AppStore {
    if (ref.store === undefined) throw new Error('the delay ran before the store existed');
    return ref.store;
}

function setup(game: GameState | null = twoSafeCards(), hooks: DelayHooks = {}) {
    const delays: number[] = [];
    const busyDuring: boolean[] = [];
    const foundedAtDelay: number[] = [];
    // The store needs the stub and the stub needs the store; it only runs once a thunk has been dispatched.
    const ref: { store: AppStore | undefined } = { store: undefined };
    const delay = (ms: number): Promise<void> => {
        const { game: slice } = storeOf(ref).getState();
        delays.push(ms);
        busyDuring.push(slice.busy);
        foundedAtDelay.push(slice.current?.foundations.reduce((sum, pile) => sum + pile.length, 0) ?? 0);
        return hooks.onCall?.(ms, delays.length) ?? Promise.resolve();
    };
    const store = createAppStore({ deps: { now: () => 1000, delay, dealService: fakeDealService() } });
    ref.store = store;
    if (game !== null) store.dispatch(installed({ state: game, dailyKey: null }));
    store.dispatch(setRoute('game'));
    return { store, delays, busyDuring, foundedAtDelay };
}

type Env = ReturnType<typeof setup>;

const current = ({ store }: Env): GameState => {
    const game = store.getState().game.current;
    if (game === null) throw new Error('no game in play');
    return game;
};

const foundationSizes = (env: Env): number[] => current(env).foundations.map((pile) => pile.length);

/** A promise the test resolves by hand. */
function gate(): { promise: Promise<void>; open: () => void } {
    let open: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { promise, open };
}

describe('the position under test', () => {
    it('exposes two safe cards, one after the other', () => {
        const state = twoSafeCards();
        expect(nextSafeMove(state)).toEqual({ type: 'autoFoundation', from: { pile: 'tableau', col: 2 } });
    });
});

describe('play: safe cards chain', () => {
    it('follows a move one by one, inside one undo step', async () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));
        const before = current(env);

        await env.store.dispatch(play(DRAW));

        expect(env.delays).toEqual([160, 160]);
        expect(foundationSizes(env)).toEqual([1, 0, 0, 1]);
        expect(current(env).tableau[2]).toEqual([]);
        expect(current(env).tableau[3]).toEqual([]);
        expect(env.store.getState().game.history).toEqual([before]);
        expect(env.store.getState().game.busy).toBe(false);

        env.store.dispatch(undo());

        const { tableau, stock, waste, foundations } = current(env);
        expect({ tableau, stock, waste, foundations }).toEqual({
            tableau: before.tableau,
            stock: before.stock,
            waste: before.waste,
            foundations: before.foundations,
        });
        expect(foundationSizes(env)).toEqual([0, 0, 0, 0]);
        expect(env.store.getState().game.history).toEqual([]);
    });

    it('is busy while it runs and free afterwards', async () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        await env.store.dispatch(play(DRAW));

        expect(env.busyDuring).toEqual([true, true]);
        expect(env.store.getState().game.busy).toBe(false);
    });

    it('counts each send as it happens', async () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        await env.store.dispatch(play(DRAW));

        expect(env.foundedAtDelay).toEqual([0, 1]);
        expect(env.store.getState().stats.modes.draw1.played).toBe(1);
    });

    it('does not chain, wait or set busy when the setting is off', async () => {
        const env = setup();

        const pending = env.store.dispatch(play(DRAW));
        expect(env.store.getState().game.busy).toBe(false);
        await pending;

        expect(env.delays).toEqual([]);
        expect(foundationSizes(env)).toEqual([0, 0, 0, 0]);
        expect(current(env).moves).toBe(1);
    });

    it('does not wait or set busy when no card is safe', async () => {
        const env = setup(makeState({ stock: [NINE_CLUBS], tableau: tableauOf(faceUp(cardId(0, 5))) }));
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        const pending = env.store.dispatch(play(DRAW));
        expect(env.store.getState().game.busy).toBe(false);
        await pending;

        expect(env.delays).toEqual([]);
    });

    it('starts nothing for a command the engine refuses', async () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        await env.store.dispatch(play({ type: 'autoFoundation', from: { pile: 'waste' } }));

        expect(env.delays).toEqual([]);
        expect(foundationSizes(env)).toEqual([0, 0, 0, 0]);
        expect(env.store.getState().game.history).toEqual([]);
    });

    it('is ignored while a chain is already running', async () => {
        const held = gate();
        const env = setup(twoSafeCards(), { onCall: (_ms, call) => (call === 1 ? held.promise : undefined) });
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        const running = env.store.dispatch(play(DRAW));
        const stateMidChain = env.store.getState().game;
        await env.store.dispatch(play(DRAW));
        expect(env.store.getState().game).toBe(stateMidChain);

        held.open();
        await running;
        expect(foundationSizes(env)).toEqual([1, 0, 0, 1]);
    });
});

describe('the chain never starts by itself', () => {
    it('does not move cards when the setting is switched on', () => {
        const env = setup();
        const before = env.store.getState().game;

        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        expect(env.store.getState().game).toBe(before);
        expect(env.delays).toEqual([]);
        expect(foundationSizes(env)).toEqual([0, 0, 0, 0]);
    });

    it('does not start after undo or redo', () => {
        const env = setup();
        void env.store.dispatch(play(DRAW));
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));
        env.store.dispatch(undo());
        expect(env.store.getState().game.busy).toBe(false);
        env.store.dispatch(redo());

        expect(current(env).waste).toEqual([NINE_CLUBS]);
        expect(env.delays).toEqual([]);
        expect(env.store.getState().game.busy).toBe(false);
        expect(foundationSizes(env)).toEqual([0, 0, 0, 0]);
    });
});

describe('reduced motion', () => {
    it('applies the sends without spacing when Animations is off', async () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));
        env.store.dispatch(preferenceSet({ key: 'animations', value: false }));

        await env.store.dispatch(play(DRAW));

        expect(env.delays).toEqual([0, 0]);
        expect(foundationSizes(env)).toEqual([1, 0, 0, 1]);
    });

    it('applies the sends without spacing when the device asks for reduced motion', async () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));
        env.store.dispatch(systemMotionChanged(true));

        await env.store.dispatch(play(DRAW));

        expect(env.delays).toEqual([0, 0]);
        expect(foundationSizes(env)).toEqual([1, 0, 0, 1]);
    });
});

describe('a running chain stops', () => {
    it('when a new game is installed, applying nothing to either game', async () => {
        const held = gate();
        const env = setup(twoSafeCards(), { onCall: (_ms, call) => (call === 1 ? held.promise : undefined) });
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));
        const other = twoSafeCards({ seed: 99 });

        const running = env.store.dispatch(play(DRAW));
        expect(env.store.getState().game.busy).toBe(true);
        env.store.dispatch(installed({ state: other, dailyKey: null }));
        expect(env.store.getState().game.busy).toBe(false);
        held.open();
        await running;

        expect(env.store.getState().game.current).toBe(other);
        expect(env.store.getState().game.history).toEqual([]);
        expect(env.store.getState().game.busy).toBe(false);
        expect(env.delays).toEqual([160]);
    });

    it('without clearing the busy flag of a newer sequence', async () => {
        const held = gate();
        const env = setup(twoSafeCards(), { onCall: (_ms, call) => (call === 1 ? held.promise : undefined) });
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        const running = env.store.dispatch(play(DRAW));
        env.store.dispatch(installed({ state: twoSafeCards({ seed: 99 }), dailyKey: null }));
        env.store.dispatch(busySet(true));
        held.open();
        await running;

        expect(env.store.getState().game.busy).toBe(true);
    });

    it('at its next step when the setting is switched off', async () => {
        const held = gate();
        const env = setup(twoSafeCards(), { onCall: (_ms, call) => (call === 2 ? held.promise : undefined) });
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        const running = env.store.dispatch(play(DRAW));
        // The first send is applied while the second waits on its delay.
        await vi.waitFor(() => {
            expect(env.delays).toHaveLength(2);
        });
        expect(foundationSizes(env)).toEqual([1, 0, 0, 0]);
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: false }));
        held.open();
        await running;

        expect(foundationSizes(env)).toEqual([1, 0, 0, 0]);
        expect(env.delays).toEqual([160, 160]);
        expect(env.store.getState().game.busy).toBe(false);
        expect(env.store.getState().game.history).toHaveLength(1);
    });

    it('when its last send wins the game, recording the win once', async () => {
        const queen = cardId(3, 12);
        const king = cardId(3, 13);
        const nearlyWon = makeState({
            foundations: foundationsOf(13, 13, 13, 11),
            tableau: tableauOf(faceUp(king, queen)),
            started: true,
            moves: 100,
        });
        const env = setup(nearlyWon);
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        await env.store.dispatch(play({ type: 'autoFoundation', from: { pile: 'tableau', col: 0 } }));

        expect(current(env).status).toBe('won');
        expect(env.delays).toEqual([160]);
        expect(env.store.getState().stats.modes.draw1.won).toBe(1);
        expect(env.store.getState().game.history).toHaveLength(1);
        expect(env.store.getState().game.busy).toBe(false);
    });
});

describe('a failing step', () => {
    it('rejects the play and leaves busy cleared', async () => {
        const env = setup(twoSafeCards(), {
            onCall: (_ms, call) => (call === 2 ? Promise.reject(new Error('timer failed')) : undefined),
        });
        env.store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        await expect(env.store.dispatch(play(DRAW))).rejects.toThrow('timer failed');

        expect(env.store.getState().game.busy).toBe(false);
        expect(foundationSizes(env)).toEqual([1, 0, 0, 0]);
    });
});
