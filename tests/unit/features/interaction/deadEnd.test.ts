import { describe, expect, it } from 'vitest';
import { noticeDismissed } from '../../../../src/app/appSlice';
import { createAppStore, type AppStore } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import type { Command, GameState } from '../../../../src/domain/types';
import { installed, replaced } from '../../../../src/features/game/gameSlice';
import { finish, play, redo, restart, undo } from '../../../../src/features/game/gameThunks';
import type { Announcement } from '../../../../src/features/interaction/announcements';
import { checkDeadEnd } from '../../../../src/features/interaction/interactionThunks';
import { selectAnnouncement } from '../../../../src/features/interaction/selectors';
import { fakeDealService } from '../../../fixtures/dealService';
import { allFaceUp } from '../../../fixtures/deals';
import { faceUp, makeState, tableauOf, vegasAtLimit } from '../../../fixtures/states';

const DRAW: Command = { type: 'draw' };
const ACE_HOME: Command = {
    type: 'move',
    from: { pile: 'tableau', col: 0 },
    index: 0,
    to: { pile: 'foundation', suit: 3 },
};

/** One ace on a column: sending it home leaves nothing to play, a dead end. */
const oneAce = (): GameState => makeState({ tableau: tableauOf(faceUp(cardId(3, 1))) });

/** A dead end already: a stock card that plays nowhere. Drawing it leaves another dead end. */
const stuckStock = (): GameState => makeState({ stock: [cardId(2, 9)] });

/** `delay` may run a hook before it settles; it runs on the first call only. */
function setup(game: GameState | null, onFirstDelay?: (store: AppStore) => void): AppStore {
    let called = false;
    const holder: { store?: AppStore } = {};
    const store = createAppStore({
        deps: {
            now: () => 1000,
            dealService: fakeDealService(),
            delay: () => {
                if (!called && holder.store !== undefined) {
                    called = true;
                    onFirstDelay?.(holder.store);
                }
                return Promise.resolve();
            },
        },
    });
    holder.store = store;
    if (game !== null) store.dispatch(installed({ state: game, dailyKey: null }));
    return store;
}

const itemsOf = (store: AppStore): Announcement[] => selectAnnouncement(store.getState()).items.map(({ item }) => item);
const deadEnds = (store: AppStore): number => itemsOf(store).filter(({ type }) => type === 'deadEnd').length;
const notices = (store: AppStore): string[] => store.getState().app.notices.map(({ id }) => id);

describe('the dead end is reported once per position', () => {
    it('raises the notice and announces it the first time a move leaves one', async () => {
        const store = setup(oneAce());

        await store.dispatch(play(ACE_HOME));

        expect(notices(store)).toEqual(['dead-end']);
        expect(itemsOf(store).map(({ type }) => type)).toEqual(['moved', 'deadEnd']);
        expect(store.getState().interaction.deadEndSeen).toHaveLength(1);
    });

    it('says nothing when the move leaves something to play', async () => {
        const store = setup(makeState({ tableau: tableauOf(faceUp(cardId(3, 1))), stock: [cardId(3, 2)] }));

        await store.dispatch(play(ACE_HOME));

        expect(notices(store)).toEqual([]);
        expect(deadEnds(store)).toBe(0);
    });

    it('does not report the same position again after undo and the same move', async () => {
        const store = setup(oneAce());
        await store.dispatch(play(ACE_HOME));
        store.dispatch(noticeDismissed('dead-end'));

        store.dispatch(undo());
        await store.dispatch(play(ACE_HOME));

        expect(deadEnds(store)).toBe(1);
        expect(notices(store)).toEqual([]);
    });

    it('does not check after undo or redo', async () => {
        const store = setup(stuckStock());
        await store.dispatch(play(DRAW));
        store.dispatch(noticeDismissed('dead-end'));
        expect(deadEnds(store)).toBe(1);

        store.dispatch(undo());
        store.dispatch(redo());

        // The start position is a dead end that was never reported; undoing into it must not report it.
        expect(deadEnds(store)).toBe(1);
        expect(notices(store)).toEqual([]);
        expect(store.getState().interaction.deadEndSeen).toHaveLength(1);
    });

    it('forgets on restart and reports the same dead end again', async () => {
        const store = setup(oneAce());
        await store.dispatch(play(ACE_HOME));
        store.dispatch(noticeDismissed('dead-end'));

        store.dispatch(restart());
        expect(store.getState().interaction.deadEndSeen).toEqual([]);

        // A restart replays the deal, which this hand-built position cannot be dealt from: install it again instead.
        store.dispatch(installed({ state: oneAce(), dailyKey: null }));
        await store.dispatch(play(ACE_HOME));

        expect(deadEnds(store)).toBe(2);
        expect(notices(store)).toEqual(['dead-end']);
    });

    it('checkDeadEnd ignores a missing or a won game', () => {
        const none = setup(null);
        const won = setup(makeState({ status: 'won' }));

        none.dispatch(checkDeadEnd());
        won.dispatch(checkDeadEnd());

        expect(itemsOf(none)).toEqual([]);
        expect(itemsOf(won)).toEqual([]);
    });
});

describe('a refused recycle', () => {
    it('raises no-redeals and announces the refusal, and no dead end', async () => {
        const store = setup(vegasAtLimit({ waste: [cardId(0, 1)], started: true }));

        await store.dispatch(play(DRAW));

        expect(notices(store)).toEqual(['no-redeals']);
        expect(itemsOf(store)).toEqual([{ type: 'refused', reason: 'pass-limit' }]);
    });

    it('raises nothing for another refusal', async () => {
        const store = setup(oneAce());

        await store.dispatch(
            play({ type: 'move', from: { pile: 'tableau', col: 3 }, index: 0, to: { pile: 'foundation', suit: 0 } }),
        );

        expect(notices(store)).toEqual([]);
    });
});

describe('finish', () => {
    it('checks once when it ends in a dead end', async () => {
        // The position is replaced under the sequence, so its first step is refused and the sequence stops there.
        const store = setup(allFaceUp(), (live) => {
            live.dispatch(replaced(stuckStock()));
        });

        await store.dispatch(finish());

        expect(deadEnds(store)).toBe(1);
        expect(notices(store)).toEqual(['dead-end']);
    });

    it('checks nothing when it wins', async () => {
        const store = setup(allFaceUp());

        await store.dispatch(finish());

        expect(deadEnds(store)).toBe(0);
        expect(notices(store)).toEqual([]);
    });

    it('does not check when the game was replaced mid-sequence', async () => {
        const store = setup(allFaceUp(), (live) => {
            live.dispatch(installed({ state: stuckStock(), dailyKey: null }));
        });

        await store.dispatch(finish());

        expect(deadEnds(store)).toBe(0);
        expect(notices(store)).toEqual([]);
    });
});
