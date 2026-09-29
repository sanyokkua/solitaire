import { describe, expect, it } from 'vitest';
import { setRoute } from '../../../../src/app/appSlice';
import { cardId } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import { winBonus } from '../../../../src/domain/scoring';
import type { Command, GameState } from '../../../../src/domain/types';
import { installed } from '../../../../src/features/game/gameSlice';
import { play } from '../../../../src/features/game/gameThunks';
import { restart } from '../../../../src/features/game/sessionThunks';
import { selectWinSummary } from '../../../../src/features/interaction/selectors';
import { encodeRecord } from '../../../../src/features/persistence/recordCodec';
import { won } from '../../../../src/features/stats/statsSlice';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';
import { faceUp, foundationsOf, makeState, tableauOf } from '../../../fixtures/states';
import { testStore } from '../../../support/testStore';

/** A one-move-from-winning Standard position: the last king (of hearts) waits on the tableau. */
function almostWon(overrides: Partial<GameState> = {}): GameState {
    return makeState({
        foundations: foundationsOf(12, 13, 13, 13),
        tableau: tableauOf(faceUp(cardId(0, 13))),
        started: true,
        ...overrides,
    });
}

/** A one-move-from-winning Vegas position, otherwise the same shape. */
function almostWonVegas(overrides: Partial<GameState> = {}): GameState {
    return almostWon({ mode: 'vegas', scoring: 'vegas', draw: 3, ...overrides });
}

const SEND_HOME: Command = { type: 'autoFoundation', from: { pile: 'tableau', col: 0 } };

/** A store on the Game route with `game` installed; `now` is fixed, so the clock adds no time by itself. */
function setup(game: GameState) {
    const store = testStore({ deps: { now: () => 1000 } });
    store.dispatch(installed({ state: game, dailyKey: null }));
    store.dispatch(setRoute('game'));
    return store;
}

describe('win summary', () => {
    it('is recorded as a new best on the first win', async () => {
        const store = setup(almostWon({ elapsedMs: 5000, moves: 40 }));

        await store.dispatch(play(SEND_HOME));

        const summary = selectWinSummary(store.getState());
        expect(summary).not.toBeNull();
        expect(summary?.mode).toBe('draw1');
        expect(summary?.elapsedMs).toBe(5000);
        // autoFoundation is not a counted move; the summary's `moves` is the position's own count.
        expect(summary?.moves).toBe(40);
        expect(summary?.newBestTime).toBe(true);
    });

    it('the score already includes the time bonus, matching the value statistics records as the mode best', async () => {
        // Over 30 whole seconds, so the Standard win bonus applies.
        const store = setup(almostWon({ elapsedMs: 45_000, moves: 10, score: 400 }));

        await store.dispatch(play(SEND_HOME));

        const summary = selectWinSummary(store.getState());
        const bestScore = store.getState().stats.modes.draw1.bestScore;
        expect(summary?.timeBonus).toBe(winBonus(45_000, 'standard'));
        expect(summary?.timeBonus).toBeGreaterThan(0);
        expect(summary?.score).toBe(bestScore);
    });

    it('a slower win than the mode best is not a new best', async () => {
        const store = setup(almostWon({ elapsedMs: 2000 }));
        store.dispatch(won({ mode: 'draw1', elapsedMs: 1000, score: 100 }));

        await store.dispatch(play(SEND_HOME));

        expect(selectWinSummary(store.getState())?.newBestTime).toBe(false);
    });

    it('a strictly faster win than the mode best is a new best', async () => {
        const store = setup(almostWon({ elapsedMs: 500 }));
        store.dispatch(won({ mode: 'draw1', elapsedMs: 1000, score: 100 }));

        await store.dispatch(play(SEND_HOME));

        expect(selectWinSummary(store.getState())?.newBestTime).toBe(true);
    });

    it('an equal time is not a new best', async () => {
        const store = setup(almostWon({ elapsedMs: 1000 }));
        store.dispatch(won({ mode: 'draw1', elapsedMs: 1000, score: 100 }));

        await store.dispatch(play(SEND_HOME));

        expect(selectWinSummary(store.getState())?.newBestTime).toBe(false);
    });

    it('has a Standard time bonus over 30 seconds, and none under Vegas', async () => {
        const standard = setup(almostWon({ elapsedMs: 45_000 }));
        await standard.dispatch(play(SEND_HOME));
        expect(selectWinSummary(standard.getState())?.timeBonus).toBeGreaterThan(0);

        const vegas = setup(almostWonVegas({ elapsedMs: 45_000 }));
        await vegas.dispatch(play(SEND_HOME));
        expect(selectWinSummary(vegas.getState())?.timeBonus).toBe(0);
    });

    it('records the grade the game was dealt with', async () => {
        const store = setup(almostWon({ mode: 'draw3', draw: 3, verdict: 'win', grade: 'hard' }));

        await store.dispatch(play(SEND_HOME));

        expect(selectWinSummary(store.getState())?.grade).toBe('hard');
    });

    it('records no grade for an ungraded game', async () => {
        const store = setup(almostWon());

        await store.dispatch(play(SEND_HOME));

        expect(selectWinSummary(store.getState())?.grade).toBeNull();
    });

    it('keeps the grade after a restart, through a whole won game', async () => {
        const graded = dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode, {
            verdict: 'win',
            attempts: 1,
            grade: 'medium',
        });
        const store = setup(graded);
        store.dispatch(restart());
        expect(store.getState().game.current?.grade).toBe('medium');

        for (const command of parseLine(WINNING_LINE.line)) await store.dispatch(play(command));

        expect(store.getState().game.current?.status).toBe('won');
        expect(selectWinSummary(store.getState())?.grade).toBe('medium');
    });

    it('is cleared by a new deal', async () => {
        const store = setup(almostWon());
        await store.dispatch(play(SEND_HOME));
        expect(selectWinSummary(store.getState())).not.toBeNull();

        store.dispatch(installed({ state: almostWon({ mode: 'draw3' }), dailyKey: null }));

        expect(selectWinSummary(store.getState())).toBeNull();
    });

    it('is never in the encoded record', async () => {
        const store = setup(almostWon());
        await store.dispatch(play(SEND_HOME));
        expect(selectWinSummary(store.getState())).not.toBeNull();

        const { preferences, stats, game } = store.getState();
        const encoded = encodeRecord({ preferences, stats, game });

        expect(encoded).not.toContain('timeBonus');
        expect(encoded).not.toContain('newBestTime');
    });
});
