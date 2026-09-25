import { describe, expect, it } from 'vitest';
import { setRoute, systemMotionChanged } from '../../../../src/app/appSlice';
import { createAppStore, type AppStore } from '../../../../src/app/store';
import { finishPlan } from '../../../../src/domain/assist';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import { displayedScore } from '../../../../src/domain/scoring';
import type { Command, GameState } from '../../../../src/domain/types';
import { busySet, installed } from '../../../../src/features/game/gameSlice';
import { finish } from '../../../../src/features/game/gameThunks';
import { fakeDealService } from '../../../fixtures/dealService';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';

/**
 * The first position on the recorded winning line whose tableau is entirely face up, so a finish plan exists. Built
 * through the engine, so the position is one a player could really reach.
 */
function allFaceUp(): GameState {
    let state = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode);
    for (const cmd of parseLine(WINNING_LINE.line)) {
        if (finishPlan(state) !== undefined) return state;
        state = applyCommand(state, cmd).state;
    }
    throw new Error('the winning line never reaches an all-face-up position');
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

function setup(game: GameState | null = allFaceUp(), hooks: DelayHooks = {}) {
    const delays: number[] = [];
    const busyDuring: boolean[] = [];
    // The store needs the stub and the stub needs the store; it only runs once a thunk has been dispatched.
    const ref: { store: AppStore | undefined } = { store: undefined };
    const delay = (ms: number): Promise<void> => {
        delays.push(ms);
        busyDuring.push(storeOf(ref).getState().game.busy);
        return hooks.onCall?.(ms, delays.length) ?? Promise.resolve();
    };
    const store = createAppStore({ deps: { now: () => 1000, delay, dealService: fakeDealService() } });
    ref.store = store;
    if (game !== null) store.dispatch(installed({ state: game, dailyKey: null }));
    store.dispatch(setRoute('game'));
    return { store, delays, busyDuring };
}

type Env = ReturnType<typeof setup>;

const current = ({ store }: Env): GameState => {
    const game = store.getState().game.current;
    if (game === null) throw new Error('no game in play');
    return game;
};

/** The finish plan of the position the test started from. */
function planOf(state: GameState): { readonly state: GameState; readonly commands: readonly Command[] } {
    const plan = finishPlan(state);
    if (plan === undefined) throw new Error('the position has no finish plan');
    return plan;
}

/** A promise the test resolves by hand. */
function gate(): { promise: Promise<void>; open: () => void } {
    let open: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { promise, open };
}

describe('the position under test', () => {
    it('has every tableau card face up and a plan of several commands', () => {
        const state = allFaceUp();
        expect(state.tableau.every((cards) => cards.every((card) => card.up))).toBe(true);
        expect(planOf(state).commands.length).toBeGreaterThan(1);
    });
});

describe('finish', () => {
    it('wins the game, scoring every draw the plan made', async () => {
        const start = allFaceUp();
        const env = setup(start);

        await env.store.dispatch(finish());

        expect(current(env).status).toBe('won');
        expect(displayedScore(current(env))).toBe(displayedScore(planOf(start).state));
        expect(env.store.getState().game.busy).toBe(false);
    });

    it('is one undo step', async () => {
        const start = allFaceUp();
        const env = setup(start);

        await env.store.dispatch(finish());

        expect(env.store.getState().game.history).toEqual([start]);
    });

    it('waits 75 ms before every command of the plan', async () => {
        const start = allFaceUp();
        const env = setup(start);

        await env.store.dispatch(finish());

        expect(env.delays).toEqual(planOf(start).commands.map(() => 75));
    });

    it('is busy while it runs', async () => {
        const start = allFaceUp();
        const env = setup(start);

        const running = env.store.dispatch(finish());
        expect(env.store.getState().game.busy).toBe(true);
        await running;

        expect(env.busyDuring.every(Boolean)).toBe(true);
        expect(env.store.getState().game.busy).toBe(false);
    });

    it('records the win and the played game once', async () => {
        const env = setup();

        await env.store.dispatch(finish());

        const { draw1 } = env.store.getState().stats.modes;
        expect(draw1.played).toBe(1);
        expect(draw1.won).toBe(1);
    });

    it('waits 0 ms before every command while motion is reduced', async () => {
        const start = allFaceUp();
        const env = setup(start);
        env.store.dispatch(systemMotionChanged(true));

        await env.store.dispatch(finish());

        expect(env.delays).toEqual(planOf(start).commands.map(() => 0));
        expect(current(env).status).toBe('won');
    });
});

describe('finish when it is unavailable', () => {
    it('changes nothing while a card is still face down', async () => {
        const env = setup(dealFromSeed(1, 'draw1'));
        const before = env.store.getState();

        const pending = env.store.dispatch(finish());
        expect(env.store.getState().game.busy).toBe(false);
        await pending;

        expect(env.delays).toEqual([]);
        expect(env.store.getState().game).toBe(before.game);
        expect(env.store.getState().stats).toBe(before.stats);
    });

    it('changes nothing without a game', async () => {
        const env = setup(null);
        const before = env.store.getState();

        await env.store.dispatch(finish());

        expect(env.delays).toEqual([]);
        expect(env.store.getState().game).toBe(before.game);
    });

    it('changes nothing once the game is won', async () => {
        const env = setup(planOf(allFaceUp()).state);
        const before = env.store.getState().game;

        await env.store.dispatch(finish());

        expect(env.delays).toEqual([]);
        expect(env.store.getState().game).toBe(before);
    });

    it('is ignored while a sequence is already running', async () => {
        const held = gate();
        const start = allFaceUp();
        const env = setup(start, { onCall: (_ms, call) => (call === 1 ? held.promise : undefined) });

        const running = env.store.dispatch(finish());
        const midFinish = env.store.getState().game;
        await env.store.dispatch(finish());
        expect(env.store.getState().game).toBe(midFinish);
        expect(env.delays).toEqual([75]);

        held.open();
        await running;
        expect(env.delays).toHaveLength(planOf(start).commands.length);
        expect(current(env).status).toBe('won');
    });

    it('is ignored while busy for another reason', async () => {
        const env = setup();
        env.store.dispatch(busySet(true));
        const before = env.store.getState().game;

        await env.store.dispatch(finish());

        expect(env.delays).toEqual([]);
        expect(env.store.getState().game).toBe(before);
    });
});

describe('a running finish stops', () => {
    it('when a new game is installed, leaving that game untouched', async () => {
        const held = gate();
        const env = setup(allFaceUp(), { onCall: (_ms, call) => (call === 2 ? held.promise : undefined) });
        const other = dealFromSeed(99, 'draw1');

        const running = env.store.dispatch(finish());
        await Promise.resolve();
        env.store.dispatch(installed({ state: other, dailyKey: null }));
        expect(env.store.getState().game.busy).toBe(false);
        held.open();
        await running;

        expect(env.store.getState().game.current).toBe(other);
        expect(env.store.getState().game.history).toEqual([]);
        expect(env.store.getState().game.busy).toBe(false);
        expect(env.delays).toEqual([75, 75]);
    });

    it('without clearing the busy flag of a newer sequence', async () => {
        const held = gate();
        const env = setup(allFaceUp(), { onCall: (_ms, call) => (call === 1 ? held.promise : undefined) });

        const running = env.store.dispatch(finish());
        env.store.dispatch(installed({ state: dealFromSeed(99, 'draw1'), dailyKey: null }));
        env.store.dispatch(busySet(true));
        held.open();
        await running;

        expect(env.store.getState().game.busy).toBe(true);
    });
});

describe('a failing step', () => {
    it('rejects the finish and leaves busy cleared', async () => {
        const env = setup(allFaceUp(), {
            onCall: (_ms, call) => (call === 2 ? Promise.reject(new Error('timer failed')) : undefined),
        });

        await expect(env.store.dispatch(finish())).rejects.toThrow('timer failed');

        expect(env.store.getState().game.busy).toBe(false);
        expect(env.store.getState().game.history).toHaveLength(1);
    });
});
