// covers: KS-DEAL-02, KS-DEAL-09, KS-DEAL-11
import { describe, expect, it } from 'vitest';
import { setRoute } from '../../../../src/app/appSlice';
import { dealFromSeed } from '../../../../src/domain/deal';
import { encodeDealCode } from '../../../../src/domain/dealCode';
import type { GameState, Mode } from '../../../../src/domain/types';
import { installed } from '../../../../src/features/game/gameSlice';
import { play } from '../../../../src/features/game/gameThunks';
import { playDealCode, startGame } from '../../../../src/features/game/sessionThunks';
import { won } from '../../../../src/features/stats/statsSlice';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';
import { fakeDealService } from '../../../fixtures/dealService';
import { testStore } from '../../../support/testStore';

/** A store on the Home route with a fake deal service; `game` is installed first when given. */
function setup(game: GameState | null = null) {
    const dealService = fakeDealService();
    const store = testStore({ deps: { now: () => 1000, dealService } });
    if (game !== null) store.dispatch(installed({ state: game, dailyKey: null }));
    return { store, dealService };
}

/** A game that has had an accepted command and is still being played. */
const startedGame = (seed: number, mode: Mode): GameState => ({ ...dealFromSeed(seed, mode), started: true });

const current = ({ store }: Pick<ReturnType<typeof setup>, 'store'>): GameState => {
    const game = store.getState().game.current;
    if (game === null) throw new Error('no game in play');
    return game;
};

describe('playDealCode', () => {
    it('installs exactly dealFromSeed(seed, mode) as a random deal with no Daily date, and shows Game', () => {
        const { store } = setup();
        const code = encodeDealCode(42, 'draw3');

        const result = store.dispatch(playDealCode(code));

        expect(result).toEqual({ ok: true });
        expect(store.getState().app.route).toBe('game');
        expect(store.getState().game.dailyKey).toBeNull();
        const installedState = current({ store });
        expect(installedState).toEqual(dealFromSeed(42, 'draw3', { verdict: 'random', attempts: 1, grade: null }));
        expect(installedState.grade).toBeNull();
    });

    it('gives no grade even when a graded game was in play, because a code carries no provenance', () => {
        const graded = dealFromSeed(42, 'draw3', { verdict: 'win', attempts: 2, grade: 'hard' });
        const { store } = setup({ ...graded, started: true });

        store.dispatch(playDealCode(encodeDealCode(42, 'draw3')));

        expect(current({ store }).grade).toBeNull();
        expect(current({ store }).verdict).toBe('random');
    });

    it('is deterministic: the same code twice gives the same tableau and stock', () => {
        const { store } = setup();
        const code = encodeDealCode(7, 'vegas');

        store.dispatch(playDealCode(code));
        const first = current({ store });
        store.dispatch(playDealCode(code));
        const second = current({ store });

        expect(second.tableau).toEqual(first.tableau);
        expect(second.stock).toEqual(first.stock);
    });

    it('an invalid code changes no state and reports invalid', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        const before = store.getState();

        const result = store.dispatch(playDealCode('hello'));

        expect(result).toEqual({ ok: false });
        expect(store.getState()).toBe(before);
    });

    it('discards an in-flight start and ends its dealing progress', async () => {
        const { store, dealService } = setup();
        const startedPromise = store.dispatch(startGame({ mode: 'draw3' }));
        dealService.progress(0, { overlay: true, attempt: 2 });
        expect(store.getState().app.dealing).not.toBeNull();

        const result = store.dispatch(playDealCode(encodeDealCode(5, 'draw1')));
        expect(result).toEqual({ ok: true });
        expect(store.getState().app.dealing).toBeNull();

        dealService.resolve(0, dealFromSeed(9, 'draw3'));
        await startedPromise;

        expect(store.getState().app.dealing).toBeNull();
        expect(current({ store }).seed).toBe(5);
    });

    it('breaks the streak of an unfinished started game', () => {
        const { store } = setup(startedGame(1, 'draw1'));
        store.dispatch(won({ mode: 'draw1', elapsedMs: 1000, score: 100 }));
        expect(store.getState().stats.modes.draw1.streak).toBe(1);

        store.dispatch(playDealCode(encodeDealCode(2, 'draw1')));

        expect(store.getState().stats.modes.draw1.streak).toBe(0);
    });

    it('a Daily code never records a Daily completion on win', async () => {
        const { store } = setup();
        store.dispatch(setRoute('game'));

        const result = store.dispatch(playDealCode(encodeDealCode(WINNING_LINE.seed, 'daily')));
        expect(result).toEqual({ ok: true });
        expect(store.getState().game.dailyKey).toBeNull();

        for (const cmd of parseLine(WINNING_LINE.line)) {
            await store.dispatch(play(cmd));
        }

        expect(current({ store }).status).toBe('won');
        expect(store.getState().stats.daily.completed).toEqual([]);
    });
});
