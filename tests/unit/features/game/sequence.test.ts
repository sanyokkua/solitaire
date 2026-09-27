import { describe, expect, it } from 'vitest';
import { setRoute } from '../../../../src/app/appSlice';
import { createAppStore, type AppStore } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { Command, GameState } from '../../../../src/domain/types';
import { busySet, installed } from '../../../../src/features/game/gameSlice';
import { finish, play } from '../../../../src/features/game/gameThunks';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { allFaceUp } from '../../../fixtures/deals';
import { faceUp, makeState, tableauOf } from '../../../fixtures/states';

/**
 * The two timed sequences, the safe-card chain (started by `play`) and `finish`, share one runner. What the runner
 * owns, and these tests pin for both, is what happens when the game is replaced under a sequence that is waiting on
 * its delay, and when a step throws.
 */

/** A position whose next draw is legal and which already exposes two safe cards: the Aces of hearts and spades. */
function twoSafeCards(partial: Partial<GameState> = {}): GameState {
    return makeState({
        tableau: tableauOf([], [], faceUp(cardId(0, 1)), faceUp(cardId(3, 1))),
        stock: [cardId(2, 9)],
        ...partial,
    });
}

interface Env {
    readonly store: AppStore;
    /** How many times the injected clock was read: once per command that reaches `commitCommand`. */
    readonly clockReads: () => number;
}

interface Hooks {
    /** Called with the 1-based delay call number; return a promise to hold that delay open. */
    readonly onDelay?: (call: number) => Promise<void> | undefined;
    /** Called with the 1-based clock reading number; throw to make that reading fail. */
    readonly onNow?: (read: number) => void;
}

function setup(game: GameState, hooks: Hooks): Env {
    let delays = 0;
    let reads = 0;
    const store = createAppStore({
        deps: {
            now: () => {
                reads += 1;
                hooks.onNow?.(reads);
                return 1000;
            },
            delay: () => {
                delays += 1;
                return hooks.onDelay?.(delays) ?? Promise.resolve();
            },
            dealService: fakeDealService(),
        },
    });
    store.dispatch(installed({ state: game, dailyKey: null }));
    store.dispatch(setRoute('game'));
    return { store, clockReads: () => reads };
}

/** A promise the test resolves by hand. */
function gate(): { promise: Promise<void>; open: () => void } {
    let open: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { promise, open };
}

/** What one sequence needs from a test: a starting position, how to start it, and the first delay call it waits on. */
interface Sequence {
    readonly name: string;
    readonly start: () => GameState;
    readonly prepare: (store: AppStore) => void;
    readonly run: (store: AppStore) => Promise<void>;
    /** The delay call that is the first wait after the sequence's first commit (there is one for both). */
    readonly heldCall: number;
    /** The clock reading that belongs to a step after the first commit. */
    readonly failingRead: number;
}

const DRAW: Command = { type: 'draw' };

const SEQUENCES: readonly Sequence[] = [
    {
        name: 'the safe-card chain',
        start: twoSafeCards,
        prepare: (store) => store.dispatch(preferenceSet({ key: 'autoSafe', value: true })),
        run: async (store) => {
            await store.dispatch(play(DRAW));
        },
        heldCall: 1,
        failingRead: 2,
    },
    {
        name: 'finish',
        start: allFaceUp,
        prepare: () => undefined,
        run: (store) => store.dispatch(finish()),
        heldCall: 2,
        failingRead: 2,
    },
];

describe.each(SEQUENCES)('$name', (sequence) => {
    describe('when the game is replaced mid-sequence', () => {
        it('stops without committing to the new game and leaves the new game busy flag alone', async () => {
            const held = gate();
            const env = setup(sequence.start(), {
                onDelay: (call) => (call === sequence.heldCall ? held.promise : undefined),
            });
            sequence.prepare(env.store);
            const other = dealFromSeed(99, 'draw1');

            const running = sequence.run(env.store);
            // The chain waits at once; finish commits its first step and then waits on the second delay.
            await Promise.resolve();
            expect(env.store.getState().game.busy).toBe(true);
            env.store.dispatch(installed({ state: other, dailyKey: null }));
            env.store.dispatch(busySet(true));
            const readsBefore = env.clockReads();
            held.open();
            await running;

            expect(env.store.getState().game.current).toBe(other);
            expect(env.store.getState().game.history).toEqual([]);
            expect(env.store.getState().game.busy).toBe(true);
            expect(env.clockReads()).toBe(readsBefore);
        });
    });

    describe('when a step throws', () => {
        it('clears busy and rejects to the caller', async () => {
            const env = setup(sequence.start(), {
                onNow: (read) => {
                    if (read === sequence.failingRead) throw new Error('clock failed');
                },
            });
            sequence.prepare(env.store);

            await expect(sequence.run(env.store)).rejects.toThrow('clock failed');

            expect(env.store.getState().game.busy).toBe(false);
            expect(env.store.getState().game.history).toHaveLength(1);
        });
    });
});
