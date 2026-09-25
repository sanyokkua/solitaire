import { describe, expect, it } from 'vitest';
import { dealingEnded, dealingProgressed, setRoute } from '../../../../src/app/appSlice';
import { createAppStore } from '../../../../src/app/store';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { GameState, Mode } from '../../../../src/domain/types';
import type { DealService } from '../../../../src/features/deal/dealService';
import { busySet, cleared, installed } from '../../../../src/features/game/gameSlice';
import { play, restart, startGame } from '../../../../src/features/game/gameThunks';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { won } from '../../../../src/features/stats/statsSlice';
import { fakeDealService } from '../../../fixtures/dealService';

/** A store on the Home route with a fake deal service; `game` is installed first when given. */
function setup(game: GameState | null = null, dailyKey: string | null = null) {
    const dealService = fakeDealService();
    const store = createAppStore({ deps: { now: () => 1000, delay: () => Promise.resolve(), dealService } });
    if (game !== null) store.dispatch(installed({ state: game, dailyKey }));
    return { store, dealService };
}

type Env = ReturnType<typeof setup>;

/** The fake deal service the store was built with, which the tests settle by hand. */
const fakeOf = ({ dealService }: Env) => dealService;

/** A game that has had an accepted command and is still being played. */
const startedGame = (seed: number, mode: Mode): GameState => ({ ...dealFromSeed(seed, mode), started: true });

const current = ({ store }: Env): GameState => {
    const game = store.getState().game.current;
    if (game === null) throw new Error('no game in play');
    return game;
};

/** Gives `mode` a streak of `wins` wins. */
function giveStreak({ store }: Pick<Env, 'store'>, mode: Mode, wins: number): void {
    for (let i = 0; i < wins; i++) store.dispatch(won({ mode, elapsedMs: 1000, score: 100 }));
}

const streakOf = ({ store }: Pick<Env, 'store'>, mode: Mode): number => store.getState().stats.modes[mode].streak;
const bestStreakOf = ({ store }: Env, mode: Mode): number => store.getState().stats.modes[mode].bestStreak;

describe('startGame', () => {
    it('installs the delivered deal as a fresh current game', async () => {
        const env = setup(startedGame(1, 'draw1'));
        const dealt = dealFromSeed(7, 'draw3');
        const epoch = env.store.getState().game.epoch;

        const started = env.store.dispatch(startGame({ mode: 'draw3' }));
        fakeOf(env).resolve(0, dealt);
        await started;

        const { game, app } = env.store.getState();
        expect(game.current).toBe(dealt);
        expect(game.history).toEqual([]);
        expect(game.future).toEqual([]);
        expect(game.current?.undos).toBe(0);
        expect(game.counted).toBe(false);
        expect(game.busy).toBe(false);
        expect(game.epoch).toBe(epoch + 1);
        expect(app.dealing).toBeNull();
    });

    it('lets a newer start win and does not clear the newer start dealing progress', async () => {
        const env = setup();
        const fake = fakeOf(env);
        const vegas = dealFromSeed(9, 'vegas');

        const first = env.store.dispatch(startGame({ mode: 'draw1' }));
        const second = env.store.dispatch(startGame({ mode: 'vegas' }));
        fake.progress(1, { overlay: true, attempt: 2 });

        await first;

        expect(env.store.getState().game.current).toBeNull();
        expect(env.store.getState().app.dealing).toEqual({ overlay: true, attempt: 2 });

        fake.resolve(1, vegas);
        await second;

        expect(env.store.getState().game.current).toBe(vegas);
        expect(env.store.getState().app.dealing).toBeNull();
    });

    it('lets a newer start win even when the older deal had already resolved', async () => {
        const env = setup();
        const fake = fakeOf(env);
        const vegas = dealFromSeed(9, 'vegas');

        const first = env.store.dispatch(startGame({ mode: 'draw3' }));
        fake.resolve(0, dealFromSeed(7, 'draw3'));
        const second = env.store.dispatch(startGame({ mode: 'vegas' }));
        fake.resolve(1, vegas);
        await Promise.all([first, second]);

        expect(env.store.getState().game.current).toBe(vegas);
        expect(env.store.getState().app.dealing).toBeNull();
    });

    it('exposes the dealing progress while waiting and clears it once the game is installed', async () => {
        const env = setup();
        const fake = fakeOf(env);

        const started = env.store.dispatch(startGame({ mode: 'draw1' }));
        expect(env.store.getState().app.dealing).toBeNull();
        fake.progress(0, { overlay: false, attempt: 1 });
        expect(env.store.getState().app.dealing).toEqual({ overlay: false, attempt: 1 });
        fake.progress(0, { overlay: true, attempt: 4 });
        expect(env.store.getState().app.dealing).toEqual({ overlay: true, attempt: 4 });

        fake.resolve(0, dealFromSeed(3, 'draw1'));
        await started;

        expect(env.store.getState().app.dealing).toBeNull();
    });

    it('reads Winnable deals only from the preferences when it starts and forwards it', async () => {
        const env = setup();
        const fake = fakeOf(env);

        void env.store.dispatch(startGame({ mode: 'draw1' }));
        env.store.dispatch(preferenceSet({ key: 'winnableOnly', value: false }));
        void env.store.dispatch(startGame({ mode: 'draw3' }));

        expect(fake.requests.map(({ request }) => request)).toEqual([
            { mode: 'draw1', winnableOnly: true },
            { mode: 'draw3', winnableOnly: false },
        ]);
        await Promise.resolve();
    });

    it('changes nothing when the request is cancelled, and clears the dealing progress', async () => {
        const env = setup(startedGame(1, 'draw1'));
        giveStreak(env, 'draw1', 2);
        const before = env.store.getState();

        const started = env.store.dispatch(startGame({ mode: 'draw3' }));
        fakeOf(env).progress(0, { overlay: true, attempt: 1 });
        fakeOf(env).cancel(0);
        await started;

        const after = env.store.getState();
        expect(after.game).toBe(before.game);
        expect(after.stats).toBe(before.stats);
        expect(after.app.dealing).toBeNull();
    });

    it('changes nothing when another game was installed while it was dealing', async () => {
        const env = setup(startedGame(1, 'draw1'));
        giveStreak(env, 'draw1', 2);

        const started = env.store.dispatch(startGame({ mode: 'draw3' }));
        fakeOf(env).progress(0, { overlay: true, attempt: 1 });
        const other = startedGame(5, 'vegas');
        env.store.dispatch(installed({ state: other, dailyKey: null }));
        const between = env.store.getState();
        fakeOf(env).resolve(0, dealFromSeed(7, 'draw3'));
        await started;

        const after = env.store.getState();
        expect(after.game).toBe(between.game);
        expect(after.game.current).toBe(other);
        expect(after.stats).toBe(between.stats);
        expect(streakOf(env, 'draw1')).toBe(2);
        expect(after.app.dealing).toBeNull();
    });

    it('changes nothing when the game was cleared or restarted while it was dealing', async () => {
        const env = setup(startedGame(1, 'draw1'));
        const restarted = dealFromSeed(1, 'draw1');

        const first = env.store.dispatch(startGame({ mode: 'draw3' }));
        env.store.dispatch(restart());
        fakeOf(env).resolve(0, dealFromSeed(7, 'draw3'));
        await first;
        expect(current(env)).toEqual(restarted);

        const second = env.store.dispatch(startGame({ mode: 'draw3' }));
        env.store.dispatch(cleared());
        fakeOf(env).resolve(1, dealFromSeed(7, 'draw3'));
        await second;
        expect(env.store.getState().game.current).toBeNull();
        expect(env.store.getState().app.dealing).toBeNull();
    });

    it('drops progress reported after the game was cleared while it was dealing', async () => {
        const env = setup(startedGame(1, 'draw1'));

        const started = env.store.dispatch(startGame({ mode: 'draw3' }));
        fakeOf(env).progress(0, { overlay: false, attempt: 1 });
        expect(env.store.getState().app.dealing).toEqual({ overlay: false, attempt: 1 });
        env.store.dispatch(cleared());
        env.store.dispatch(dealingEnded());
        fakeOf(env).progress(0, { overlay: true, attempt: 3 });

        expect(env.store.getState().app.dealing).toBeNull();
        fakeOf(env).resolve(0, dealFromSeed(7, 'draw3'));
        await started;
        expect(env.store.getState().game.current).toBeNull();
        expect(env.store.getState().app.dealing).toBeNull();
    });

    it('sets the daily key of a Daily deal and leaves it null for every other mode', async () => {
        const env = setup();
        const fake = fakeOf(env);

        const daily = env.store.dispatch(startGame({ mode: 'daily' }));
        fake.resolve(0, dealFromSeed(11, 'daily'), '2026-05-03');
        await daily;
        expect(env.store.getState().game.dailyKey).toBe('2026-05-03');

        const other = env.store.dispatch(startGame({ mode: 'draw3' }));
        fake.resolve(1, dealFromSeed(12, 'draw3'));
        await other;
        expect(env.store.getState().game.dailyKey).toBeNull();
    });

    it('counts the new game afresh even when the replaced game was counted', async () => {
        const env = setup(startedGame(1, 'draw1'));
        env.store.dispatch(setRoute('game'));
        await env.store.dispatch(play({ type: 'draw' }));
        expect(env.store.getState().game.counted).toBe(true);

        const started = env.store.dispatch(startGame({ mode: 'draw1' }));
        fakeOf(env).resolve(0, dealFromSeed(2, 'draw1'));
        await started;

        expect(env.store.getState().game.counted).toBe(false);
    });

    it('propagates a rejection and still clears the dealing progress', async () => {
        const failing: DealService = { ...fakeDealService(), deal: () => Promise.reject(new Error('no entropy')) };
        const store = createAppStore({ deps: { dealService: failing } });
        store.dispatch(installed({ state: startedGame(1, 'draw1'), dailyKey: null }));
        const env = { store };
        env.store.dispatch(dealingProgressed({ overlay: true, attempt: 1 }));
        giveStreak(env, 'draw1', 2);

        await expect(env.store.dispatch(startGame({ mode: 'draw1' }))).rejects.toThrow('no entropy');

        expect(env.store.getState().app.dealing).toBeNull();
        expect(streakOf(env, 'draw1')).toBe(2);
    });
});

describe('the streak of a replaced game', () => {
    it('is broken by a restart, and the best streak is kept', () => {
        const env = setup(startedGame(1, 'draw1'));
        giveStreak(env, 'draw1', 3);

        env.store.dispatch(restart());

        expect(streakOf(env, 'draw1')).toBe(0);
        expect(bestStreakOf(env, 'draw1')).toBe(3);
    });

    it('belongs to the replaced game mode: a started Vegas game replaced by Draw 3 loses the Vegas streak only', async () => {
        const env = setup(startedGame(1, 'vegas'));
        giveStreak(env, 'vegas', 2);
        giveStreak(env, 'draw3', 2);

        const started = env.store.dispatch(startGame({ mode: 'draw3' }));
        fakeOf(env).resolve(0, dealFromSeed(4, 'draw3'));
        await started;

        expect(streakOf(env, 'vegas')).toBe(0);
        expect(bestStreakOf(env, 'vegas')).toBe(2);
        expect(streakOf(env, 'draw3')).toBe(2);
    });

    it('is kept when the player goes Home', () => {
        const env = setup(startedGame(1, 'draw1'));
        env.store.dispatch(setRoute('game'));
        giveStreak(env, 'draw1', 3);
        const before = env.store.getState().stats;

        env.store.dispatch(setRoute('home'));

        expect(env.store.getState().stats).toBe(before);
        expect(streakOf(env, 'draw1')).toBe(3);
    });

    it('is kept when an unstarted game is replaced', async () => {
        const env = setup(dealFromSeed(1, 'draw1'));
        giveStreak(env, 'draw1', 3);

        const started = env.store.dispatch(startGame({ mode: 'draw1' }));
        fakeOf(env).resolve(0, dealFromSeed(2, 'draw1'));
        await started;
        expect(streakOf(env, 'draw1')).toBe(3);

        env.store.dispatch(restart());
        expect(streakOf(env, 'draw1')).toBe(3);
    });

    it('is kept when a won game is replaced', async () => {
        const env = setup({ ...startedGame(1, 'draw1'), status: 'won' });
        giveStreak(env, 'draw1', 3);

        const started = env.store.dispatch(startGame({ mode: 'draw1' }));
        fakeOf(env).resolve(0, dealFromSeed(2, 'draw1'));
        await started;
        expect(streakOf(env, 'draw1')).toBe(3);

        env.store.dispatch(installed({ state: { ...startedGame(3, 'draw1'), status: 'won' }, dailyKey: null }));
        env.store.dispatch(restart());
        expect(streakOf(env, 'draw1')).toBe(3);
    });

    it('is not touched when nothing is started because there is no game', () => {
        const env = setup();
        giveStreak(env, 'draw1', 3);
        const before = env.store.getState();

        env.store.dispatch(restart());

        expect(env.store.getState()).toBe(before);
    });
});

describe('restart', () => {
    it('gives the identical layout, seed, verdict and attempts with nothing played', async () => {
        const original: GameState = { ...dealFromSeed(21, 'draw3', { verdict: 'win', attempts: 5 }) };
        const env = setup(original, '2026-05-03');
        env.store.dispatch(setRoute('game'));
        await env.store.dispatch(play({ type: 'draw' }));
        await env.store.dispatch(play({ type: 'draw' }));
        expect(current(env).moves).toBe(2);
        const epoch = env.store.getState().game.epoch;

        env.store.dispatch(restart());

        const { game } = env.store.getState();
        expect(game.current).toEqual(original);
        expect(game.current?.verdict).toBe('win');
        expect(game.current?.attempts).toBe(5);
        expect(game.current?.moves).toBe(0);
        expect(game.current?.elapsedMs).toBe(0);
        expect(game.current?.undos).toBe(0);
        expect(game.current?.started).toBe(false);
        expect(game.history).toEqual([]);
        expect(game.future).toEqual([]);
        expect(game.dailyKey).toBe('2026-05-03');
        expect(game.counted).toBe(false);
        expect(game.epoch).toBe(epoch + 1);
        expect(fakeOf(env).requests).toEqual([]);
    });

    it('ignores the changed settings and the selected mode', () => {
        const original = startedGame(21, 'draw1');
        const env = setup(original);

        env.store.dispatch(preferenceSet({ key: 'winnableOnly', value: false }));
        env.store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));
        env.store.dispatch(restart());

        expect(current(env)).toEqual(dealFromSeed(21, 'draw1'));
        expect(current(env).mode).toBe('draw1');
        expect(fakeOf(env).requests).toEqual([]);
    });

    it('does nothing without a game', () => {
        const env = setup();

        env.store.dispatch(restart());

        expect(env.store.getState().game.current).toBeNull();
        expect(env.store.getState().game.epoch).toBe(0);
    });

    it('is allowed while busy and clears busy through the install', () => {
        const env = setup(startedGame(1, 'draw1'));
        env.store.dispatch(busySet(true));
        const epoch = env.store.getState().game.epoch;

        env.store.dispatch(restart());

        expect(env.store.getState().game.busy).toBe(false);
        expect(env.store.getState().game.epoch).toBe(epoch + 1);
    });
});

describe('changing the selected mode mid-game', () => {
    it('leaves the current game with its own draw count and scoring', () => {
        const env = setup(dealFromSeed(1, 'draw1'));

        env.store.dispatch(preferenceSet({ key: 'selectedMode', value: 'vegas' }));

        expect(env.store.getState().preferences.selectedMode).toBe('vegas');
        expect(current(env).mode).toBe('draw1');
        expect(current(env).draw).toBe(1);
        expect(current(env).scoring).toBe('standard');
    });
});
