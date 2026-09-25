import { describe, expect, it } from 'vitest';
import { cardId } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import type { GameState } from '../../../../src/domain/types';
import {
    busySet,
    cleared,
    committed,
    countedSet,
    gameReducer,
    installed,
    redone,
    replaced,
    selectCanFinish,
    selectCanRedo,
    selectCanUndo,
    selectDisplayedScore,
    selectResumable,
    undone,
    type GameSliceState,
} from '../../../../src/features/game/gameSlice';
import { faceDown, faceUp, foundationsOf, makeState, tableauOf } from '../../../fixtures/states';

const initial: GameSliceState = gameReducer(undefined, { type: 'init' });

function withGame(state: GameState, dailyKey: string | null = null): GameSliceState {
    return gameReducer(initial, installed({ state, dailyKey }));
}

/** The fresh deal with one accepted draw applied, so the game has started. */
function drawn(): GameState {
    const { state } = applyCommand(dealFromSeed(1, 'draw1'), { type: 'draw' });
    return state;
}

/** A game with one committed step, so undo is available. */
function withStep(): GameSliceState {
    const before = dealFromSeed(1, 'draw1');
    return gameReducer(withGame(before), committed(drawn()));
}

describe('initial state', () => {
    it('holds no game and no runtime flags', () => {
        expect(initial).toEqual({
            current: null,
            history: [],
            future: [],
            dailyKey: null,
            counted: false,
            busy: false,
            epoch: 0,
            clock: { anchorMs: null },
        });
    });

    it('ignores committed, replaced, undone and redone while no game is installed', () => {
        const next = makeState();

        expect(gameReducer(initial, committed(next))).toEqual(initial);
        expect(gameReducer(initial, replaced(next))).toEqual(initial);
        expect(gameReducer(initial, undone())).toEqual(initial);
        expect(gameReducer(initial, redone())).toEqual(initial);
    });
});

describe('selectResumable', () => {
    it('is false without a game and for a fresh deal', () => {
        expect(selectResumable({ game: initial })).toBe(false);
        expect(selectResumable({ game: withGame(dealFromSeed(1, 'draw1')) })).toBe(false);
    });

    it('is true after an accepted draw', () => {
        const game = withStep();

        expect(game.current?.started).toBe(true);
        expect(selectResumable({ game })).toBe(true);
    });

    it('is false once the game is won', () => {
        expect(selectResumable({ game: withGame(makeState({ started: true, status: 'won' })) })).toBe(false);
    });
});

describe('undone and redone', () => {
    it('are ignored while busy', () => {
        const busyWithUndo = gameReducer(withStep(), busySet(true));
        const busyWithRedo = gameReducer(gameReducer(withStep(), undone()), busySet(true));

        expect(gameReducer(busyWithUndo, undone())).toEqual(busyWithUndo);
        expect(gameReducer(busyWithRedo, redone())).toEqual(busyWithRedo);
    });

    it('work once busy is cleared, and an undo adds a charge without rewinding time', () => {
        const stepped = gameReducer(withStep(), busySet(true));
        const idle = gameReducer(stepped, busySet(false));

        const back = gameReducer(idle, undone());
        expect(back.current?.undos).toBe(1);
        expect(back.history).toHaveLength(0);
        expect(back.future).toHaveLength(1);

        const forward = gameReducer(back, redone());
        expect(forward.current?.undos).toBe(1);
        expect(forward.history).toHaveLength(1);
        expect(forward.future).toHaveLength(0);
    });

    it('do nothing on an empty stack', () => {
        const game = withGame(dealFromSeed(1, 'draw1'));

        expect(gameReducer(game, undone())).toEqual(game);
        expect(gameReducer(game, redone())).toEqual(game);
    });
});

describe('committed and replaced', () => {
    it('committed starts an undo step and drops redo steps', () => {
        const undoneOnce = gameReducer(withStep(), undone());
        expect(undoneOnce.future).toHaveLength(1);

        const next = makeState({ seed: 9 });
        const game = gameReducer(undoneOnce, committed(next));

        expect(game.current).toEqual(next);
        expect(game.history).toHaveLength(1);
        expect(game.future).toEqual([]);
    });

    it('replaced updates the position in play and keeps the stacks', () => {
        const stepped = withStep();
        const next = makeState({ seed: 9 });

        const game = gameReducer(stepped, replaced(next));

        expect(game.current).toEqual(next);
        expect(game.history).toEqual(stepped.history);
        expect(game.future).toEqual(stepped.future);
    });
});

describe('installed and cleared', () => {
    it('installed resets history, future, undos, counted, the clock anchor and bumps the epoch', () => {
        const dirty: GameSliceState = {
            ...gameReducer(gameReducer(withStep(), undone()), busySet(true)),
            counted: true,
            clock: { anchorMs: 1_234 },
            epoch: 4,
            dailyKey: '2026-01-01',
        };
        expect(dirty.future).toHaveLength(1);

        const fresh = dealFromSeed(2, 'daily');
        const game = gameReducer(dirty, installed({ state: fresh, dailyKey: '2026-09-24' }));

        expect(game.current).toEqual(fresh);
        expect(game.current?.undos).toBe(0);
        expect(game.history).toEqual([]);
        expect(game.future).toEqual([]);
        expect(game.dailyKey).toBe('2026-09-24');
        expect(game.counted).toBe(false);
        expect(game.busy).toBe(false);
        expect(game.clock.anchorMs).toBeNull();
        expect(game.epoch).toBe(5);
    });

    it('installed with no Daily key clears the previous one', () => {
        const game = gameReducer(
            withGame(makeState(), '2026-09-24'),
            installed({ state: makeState(), dailyKey: null }),
        );

        expect(game.dailyKey).toBeNull();
    });

    it('cleared nulls the game, empties the stacks and bumps the epoch', () => {
        const dirty: GameSliceState = {
            ...gameReducer(gameReducer(withStep(), busySet(true)), countedSet(true)),
            clock: { anchorMs: 10 },
            dailyKey: '2026-09-24',
        };

        const game = gameReducer(dirty, cleared());

        expect(game).toEqual({ ...initial, epoch: dirty.epoch + 1 });
    });
});

describe('selectDisplayedScore', () => {
    it('applies the time and undo charges in Standard', () => {
        const game = withGame(makeState({ score: 50, elapsedMs: 25_000, undos: 3 }));

        // 50 less 4 for two full ten-second intervals and 6 for three undos.
        expect(selectDisplayedScore({ game })).toBe(40);
    });

    it('ignores the charges in Vegas', () => {
        const game = withGame(makeState({ mode: 'vegas', scoring: 'vegas', score: 50, elapsedMs: 50_000, undos: 3 }));

        expect(selectDisplayedScore({ game })).toBe(50);
    });

    it('is zero without a game', () => {
        expect(selectDisplayedScore({ game: initial })).toBe(0);
    });
});

describe('selectCanUndo and selectCanRedo', () => {
    it('are false without a game or a step', () => {
        expect(selectCanUndo({ game: initial })).toBe(false);
        expect(selectCanRedo({ game: initial })).toBe(false);
        expect(selectCanUndo({ game: withGame(makeState()) })).toBe(false);
        expect(selectCanRedo({ game: withGame(makeState()) })).toBe(false);
    });

    it('follow the stacks', () => {
        const stepped = withStep();
        expect(selectCanUndo({ game: stepped })).toBe(true);
        expect(selectCanRedo({ game: stepped })).toBe(false);

        const back = gameReducer(stepped, undone());
        expect(selectCanUndo({ game: back })).toBe(false);
        expect(selectCanRedo({ game: back })).toBe(true);
    });

    it('are false while busy', () => {
        const busy = gameReducer(withStep(), busySet(true));
        const back = gameReducer(gameReducer(withStep(), undone()), busySet(true));

        expect(selectCanUndo({ game: busy })).toBe(false);
        expect(selectCanRedo({ game: back })).toBe(false);
    });

    it('are false once the game is won', () => {
        const won: GameSliceState = {
            ...withStep(),
            current: makeState({ started: true, status: 'won' }),
            future: [makeState()],
        };

        expect(selectCanUndo({ game: won })).toBe(false);
        expect(selectCanRedo({ game: won })).toBe(false);
    });
});

describe('selectCanFinish', () => {
    const finishable = makeState({
        foundations: foundationsOf(12, 13, 13, 13),
        tableau: tableauOf(faceUp(cardId(0, 13))),
        started: true,
    });

    it('is false without a game', () => {
        expect(selectCanFinish({ game: initial })).toBe(false);
    });

    it('is false while a face-down tableau card remains', () => {
        const blocked = makeState({
            foundations: foundationsOf(11, 13, 13, 13),
            tableau: tableauOf([...faceDown(cardId(0, 13)), ...faceUp(cardId(0, 12))]),
            started: true,
        });

        expect(selectCanFinish({ game: withGame(blocked) })).toBe(false);
    });

    it('is true for an all-face-up position that plays out', () => {
        expect(selectCanFinish({ game: withGame(finishable) })).toBe(true);
    });

    it('is false while busy', () => {
        expect(selectCanFinish({ game: gameReducer(withGame(finishable), busySet(true)) })).toBe(false);
    });

    it('is false when the game is won', () => {
        expect(selectCanFinish({ game: withGame({ ...finishable, status: 'won' }) })).toBe(false);
    });
});
