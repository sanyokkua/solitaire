import { describe, expect, it } from 'vitest';
import { setRoute } from '../../../../src/app/appSlice';
import { createAppStore } from '../../../../src/app/store';
import { dealFromSeed } from '../../../../src/domain/deal';
import { displayedScore } from '../../../../src/domain/scoring';
import type { Command, GameState } from '../../../../src/domain/types';
import { busySet, countedSet, installed } from '../../../../src/features/game/gameSlice';
import { play, redo, undo } from '../../../../src/features/game/gameThunks';
import { statsReset } from '../../../../src/features/stats/statsSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';

const DRAW: Command = { type: 'draw' };
/** Refused on a fresh deal: the waste is empty. */
const ILLEGAL: Command = { type: 'autoFoundation', from: { pile: 'waste' } };

/** A store on the Game route whose clock is a mutable reading the test advances by hand. */
function setup(game: GameState | null = dealFromSeed(1, 'draw1'), dailyKey: string | null = null) {
    const clock = { ms: 1000 };
    const store = createAppStore({
        deps: { now: () => clock.ms, delay: () => Promise.resolve(), dealService: fakeDealService() },
    });
    if (game !== null) store.dispatch(installed({ state: game, dailyKey }));
    store.dispatch(setRoute('game'));
    return { store, clock };
}

type Setup = ReturnType<typeof setup>;

/** Plays every command of `line`, advancing the clock by `gapMs` before each one after the first, and `lastGapMs` before the last. */
async function playLine(
    { store, clock }: Setup,
    commands: readonly Command[],
    gapMs: number,
    lastGapMs: number = gapMs,
): Promise<void> {
    for (const [index, cmd] of commands.entries()) {
        if (index > 0) clock.ms += index === commands.length - 1 ? lastGapMs : gapMs;
        await store.dispatch(play(cmd));
    }
}

const current = ({ store }: Setup): GameState => {
    const game = store.getState().game.current;
    if (game === null) throw new Error('no game in play');
    return game;
};

describe('play', () => {
    it('adds exactly one undo step for a legal move', async () => {
        const env = setup();
        const before = current(env);

        await env.store.dispatch(play(DRAW));

        const { game } = env.store.getState();
        expect(game.history).toEqual([before]);
        expect(game.future).toEqual([]);
        expect(current(env).moves).toBe(before.moves + 1);
        expect(current(env).stock.length).toBe(before.stock.length - 1);
    });

    it('changes nothing for an illegal command', async () => {
        const env = setup();
        const gameBefore = env.store.getState().game;
        const statsBefore = env.store.getState().stats;
        env.clock.ms += 20_000;

        await env.store.dispatch(play(ILLEGAL));

        const { game, stats } = env.store.getState();
        expect(game.current).toBe(gameBefore.current);
        expect(game.history).toBe(gameBefore.history);
        expect(game.future).toBe(gameBefore.future);
        expect(game.counted).toBe(false);
        expect(game.clock.anchorMs).toBeNull();
        expect(stats).toBe(statsBefore);
    });

    it('leaves the history, the counters and the stats alone for an illegal command in a started game', async () => {
        const env = setup();
        await env.store.dispatch(play(DRAW));
        const before = env.store.getState();
        env.clock.ms += 400;

        await env.store.dispatch(play(ILLEGAL));

        const after = env.store.getState();
        expect(after.game.history).toBe(before.game.history);
        expect(after.game.future).toBe(before.game.future);
        expect(after.game.counted).toBe(true);
        expect(after.stats).toBe(before.stats);
        expect(current(env).moves).toBe(1);
        expect(current(env).elapsedMs).toBe(400);
    });
});

describe('play: counting a game', () => {
    it('counts the first accepted draw as played exactly once', async () => {
        const env = setup();

        await env.store.dispatch(play(ILLEGAL));
        expect(env.store.getState().stats.modes.draw1.played).toBe(0);

        await env.store.dispatch(play(DRAW));
        expect(env.store.getState().stats.modes.draw1.played).toBe(1);
        expect(env.store.getState().game.counted).toBe(true);

        await env.store.dispatch(play(DRAW));
        expect(env.store.getState().stats.modes.draw1.played).toBe(1);
    });

    it('does not count again on undo and redo', async () => {
        const env = setup();
        await env.store.dispatch(play(DRAW));

        env.store.dispatch(undo());
        env.store.dispatch(redo());

        expect(env.store.getState().stats.modes.draw1.played).toBe(1);
        expect(env.store.getState().game.counted).toBe(true);
    });

    it('counts a reset mid-game again on the next accepted command, so won never exceeds played', async () => {
        const env = setup(dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode));
        const [first = DRAW, ...rest] = parseLine(WINNING_LINE.line);
        await env.store.dispatch(play(first));
        expect(env.store.getState().stats.modes.draw1.played).toBe(1);

        env.store.dispatch(statsReset());
        env.store.dispatch(countedSet(false));
        expect(env.store.getState().stats.modes.draw1.played).toBe(0);

        await playLine(env, rest, 250);

        const { draw1 } = env.store.getState().stats.modes;
        expect(current(env).status).toBe('won');
        expect(draw1.played).toBe(1);
        expect(draw1.won).toBe(1);
        expect(draw1.won).toBeLessThanOrEqual(draw1.played);
    });
});

describe('play: the clock', () => {
    it('counts play time only from the first accepted command', async () => {
        const env = setup();
        env.clock.ms += 20_000;

        await env.store.dispatch(play(DRAW));

        expect(current(env).elapsedMs).toBe(0);
        expect(env.store.getState().game.clock.anchorMs).toBe(env.clock.ms);
    });

    it('settles the time since the last measurement before the next command', async () => {
        const env = setup();
        await env.store.dispatch(play(DRAW));
        env.clock.ms += 400;

        await env.store.dispatch(play(DRAW));

        expect(current(env).elapsedMs).toBe(400);
    });

    it('caps a long gap at one second', async () => {
        const env = setup();
        await env.store.dispatch(play(DRAW));
        env.clock.ms += 60_000;

        await env.store.dispatch(play(DRAW));

        expect(current(env).elapsedMs).toBe(1000);
    });

    it('settles the clock on undo and redo and keeps the elapsed time', async () => {
        const env = setup();
        await env.store.dispatch(play(DRAW));
        env.clock.ms += 400;
        await env.store.dispatch(play(DRAW));
        env.clock.ms += 300;

        env.store.dispatch(undo());
        expect(current(env).elapsedMs).toBe(700);
        expect(current(env).moves).toBe(1);

        env.clock.ms += 100;
        env.store.dispatch(redo());
        expect(current(env).elapsedMs).toBe(800);
        expect(current(env).moves).toBe(2);
    });

    it('ignores undo and redo when there is nothing to undo or redo', () => {
        const env = setup();
        const before = env.store.getState().game;
        env.clock.ms += 400;

        env.store.dispatch(undo());
        env.store.dispatch(redo());

        expect(env.store.getState().game).toBe(before);
    });
});

describe('play: winning', () => {
    const commands = parseLine(WINNING_LINE.line);
    // 115 gaps of 250 ms, then a 200 ms sub-tick remainder before the winning command.
    const SETTLED_MS = 115 * 250 + 200;

    it('records the win with the settled time, including the last remainder', async () => {
        const env = setup(dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode));

        await playLine(env, commands, 250, 200);

        const game = current(env);
        const { draw1 } = env.store.getState().stats.modes;
        expect(game.status).toBe('won');
        expect(game.elapsedMs).toBe(SETTLED_MS);
        expect(draw1.played).toBe(1);
        expect(draw1.won).toBe(1);
        expect(draw1.streak).toBe(1);
        expect(draw1.bestTimeMs).toBe(game.elapsedMs);
        expect(draw1.bestScore).toBe(displayedScore(game));
    });

    it('records the completed day for a Daily win with a day key', async () => {
        const daily = { ...dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode), mode: 'daily' as const };
        const env = setup(daily, '2026-09-25');

        await playLine(env, commands, 250, 200);

        const { stats } = env.store.getState();
        expect(current(env).status).toBe('won');
        expect(stats.daily.completed).toEqual(['2026-09-25']);
        expect(stats.modes.daily.played).toBe(1);
        expect(stats.modes.daily.won).toBe(1);
    });

    it('records no day for a Daily win without a day key, but still counts the mode', async () => {
        const daily = { ...dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode), mode: 'daily' as const };
        const env = setup(daily, null);

        await playLine(env, commands, 250, 200);

        const { stats } = env.store.getState();
        expect(current(env).status).toBe('won');
        expect(stats.daily.completed).toEqual([]);
        expect(stats.modes.daily.played).toBe(1);
        expect(stats.modes.daily.won).toBe(1);
    });

    it('ignores commands after a win', async () => {
        const env = setup(dealFromSeed(WINNING_LINE.seed, WINNING_LINE.mode));
        await playLine(env, commands, 250, 200);
        const before = env.store.getState();
        env.clock.ms += 5000;

        await env.store.dispatch(play(DRAW));
        await env.store.dispatch(play(ILLEGAL));

        const after = env.store.getState();
        expect(after.game).toBe(before.game);
        expect(after.stats).toBe(before.stats);
        expect(after.game.history).toHaveLength(commands.length);
    });
});

describe('play: ignored', () => {
    it('does nothing while busy', async () => {
        const env = setup();
        env.store.dispatch(busySet(true));
        const before = env.store.getState();

        await env.store.dispatch(play(DRAW));

        expect(env.store.getState().game).toBe(before.game);
        expect(env.store.getState().stats).toBe(before.stats);
    });

    it('does nothing without a game', async () => {
        const env = setup(null);
        const before = env.store.getState();

        await env.store.dispatch(play(DRAW));
        env.store.dispatch(undo());
        env.store.dispatch(redo());

        expect(env.store.getState()).toBe(before);
    });
});
