import { describe, expect, it } from 'vitest';
import { setRoute } from '../../../../src/app/appSlice';
import { createAppStore, type AppStore } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { Command, GameEvent, GameState } from '../../../../src/domain/types';
import { accrued, installed } from '../../../../src/features/game/gameSlice';
import { finish, play, redo, undo } from '../../../../src/features/game/gameThunks';
import { announcementsOf, type Announcement } from '../../../../src/features/interaction/announcements';
import { ANNOUNCEMENT_LOG_LIMIT, announced } from '../../../../src/features/interaction/interactionSlice';
import { selectAnnouncement } from '../../../../src/features/interaction/selectors';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { allFaceUp } from '../../../fixtures/deals';
import { faceUp, foundationsOf, makeState, tableauOf, vegasAtLimit } from '../../../fixtures/states';

const DRAW: Command = { type: 'draw' };

function setup(game: GameState | null = dealFromSeed(1, 'draw1')): AppStore {
    const store = createAppStore({
        deps: { now: () => 1000, delay: () => Promise.resolve(), dealService: fakeDealService() },
    });
    if (game !== null) store.dispatch(installed({ state: game, dailyKey: null }));
    store.dispatch(setRoute('game'));
    return store;
}

/** What the announcer would read: the descriptors in the log, without their numbers. */
function itemsOf(store: AppStore): Announcement[] {
    return selectAnnouncement(store.getState()).items.map(({ item }) => item);
}

const foundationCount = (state: GameState): number => state.foundations.reduce((sum, pile) => sum + pile.length, 0);

describe('announcementsOf', () => {
    it('maps each engine event to its descriptor, in order, and ignores a flip', () => {
        const events: GameEvent[] = [
            { type: 'moved', cards: [cardId(0, 1)], from: { pile: 'waste' }, to: { pile: 'foundation', suit: 0 } },
            { type: 'flipped', card: cardId(1, 4) },
            { type: 'drew', count: 3 },
            { type: 'recycled', pass: 2 },
            { type: 'rejected', reason: 'pass-limit' },
            { type: 'won' },
        ];

        expect(announcementsOf(events)).toEqual([
            { type: 'moved', cards: [cardId(0, 1)], from: { pile: 'waste' }, to: { pile: 'foundation', suit: 0 } },
            { type: 'drew', count: 3 },
            { type: 'recycled' },
            { type: 'refused', reason: 'pass-limit' },
            { type: 'won' },
        ]);
    });

    it('gives nothing for no events or only a flip', () => {
        expect(announcementsOf([])).toEqual([]);
        expect(announcementsOf([{ type: 'flipped', card: cardId(1, 4) }])).toEqual([]);
    });
});

describe('the announcement log', () => {
    it('starts empty', () => {
        expect(selectAnnouncement(setup().getState())).toEqual({ seq: 0, items: [] });
    });

    it('numbers items across batches and bumps seq once per batch', () => {
        const store = setup();

        store.dispatch(announced([{ type: 'undone' }, { type: 'redone' }]));
        store.dispatch(announced([{ type: 'won' }]));

        expect(selectAnnouncement(store.getState())).toEqual({
            seq: 2,
            items: [
                { n: 1, item: { type: 'undone' } },
                { n: 2, item: { type: 'redone' } },
                { n: 3, item: { type: 'won' } },
            ],
        });
    });

    it('ignores an empty batch', () => {
        const store = setup();
        store.dispatch(announced([{ type: 'won' }]));
        const before = store.getState().interaction;

        store.dispatch(announced([]));

        expect(store.getState().interaction).toBe(before);
    });

    it('keeps only the latest 20 items and never reuses a number', () => {
        const store = setup();
        for (let i = 0; i < 25; i += 1) store.dispatch(announced([{ type: 'drew', count: i }]));

        const { seq, items } = selectAnnouncement(store.getState());

        expect(seq).toBe(25);
        expect(items).toHaveLength(ANNOUNCEMENT_LOG_LIMIT);
        expect(items[0]).toEqual({ n: 6, item: { type: 'drew', count: 5 } });
        expect(items.at(-1)).toEqual({ n: 25, item: { type: 'drew', count: 24 } });

        store.dispatch(announced([{ type: 'won' }]));
        expect(selectAnnouncement(store.getState()).items.at(-1)?.n).toBe(26);
    });

    it('survives a new game being installed and is not touched by clock ticks', () => {
        const store = setup();
        store.dispatch(announced([{ type: 'won' }]));
        const before = selectAnnouncement(store.getState());

        store.dispatch(accrued({ atMs: 2000, eligible: true }));
        store.dispatch(accrued({ atMs: 3000, eligible: true }));
        expect(selectAnnouncement(store.getState())).toBe(before);

        store.dispatch(installed({ state: dealFromSeed(2, 'draw1'), dailyKey: null }));
        expect(selectAnnouncement(store.getState())).toBe(before);
    });
});

describe('play announces', () => {
    it('a move, with its cards and both piles', async () => {
        const store = setup(
            makeState({ tableau: tableauOf(faceUp(cardId(3, 1))), waste: [cardId(0, 5)], stock: [cardId(2, 9)] }),
        );

        await store.dispatch(
            play({ type: 'move', from: { pile: 'tableau', col: 0 }, index: 0, to: { pile: 'foundation', suit: 3 } }),
        );

        expect(itemsOf(store)).toEqual([
            {
                type: 'moved',
                cards: [cardId(3, 1)],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'foundation', suit: 3 },
            },
            // The position this move leaves has nothing left to play, which play reports as its own batch.
            { type: 'deadEnd' },
        ]);
        expect(selectAnnouncement(store.getState()).seq).toBe(2);
    });

    it('a draw', async () => {
        const store = setup();

        await store.dispatch(play(DRAW));

        expect(itemsOf(store)).toEqual([{ type: 'drew', count: 1 }]);
    });

    it('a recycle', async () => {
        const store = setup(makeState({ waste: [cardId(0, 5), cardId(1, 5)] }));

        await store.dispatch(play(DRAW));

        // Two waste cards that play on nothing: recycling leaves a dead end, reported after the recycle.
        expect(itemsOf(store)).toEqual([{ type: 'recycled' }, { type: 'deadEnd' }]);
    });

    it('a refusal, with its reason', async () => {
        const store = setup(vegasAtLimit({ waste: [cardId(0, 1)], started: true }));

        await store.dispatch(play(DRAW));

        expect(itemsOf(store)).toEqual([{ type: 'refused', reason: 'pass-limit' }]);
    });

    it('nothing for an ignored play', async () => {
        const store = setup(null);

        await store.dispatch(play(DRAW));

        expect(selectAnnouncement(store.getState())).toEqual({ seq: 0, items: [] });
    });

    it('a winning move, then the win', async () => {
        const store = setup(
            makeState({ foundations: foundationsOf(13, 13, 13, 12), tableau: tableauOf(faceUp(cardId(3, 13))) }),
        );

        await store.dispatch(
            play({ type: 'move', from: { pile: 'tableau', col: 0 }, index: 0, to: { pile: 'foundation', suit: 3 } }),
        );

        expect(itemsOf(store).map(({ type }) => type)).toEqual(['moved', 'won']);
        expect(selectAnnouncement(store.getState()).seq).toBe(1);
    });
});

describe('undo and redo announce', () => {
    it('undone and redone, one batch each', async () => {
        const store = setup();
        await store.dispatch(play(DRAW));

        store.dispatch(undo());
        store.dispatch(redo());

        expect(itemsOf(store)).toEqual([{ type: 'drew', count: 1 }, { type: 'undone' }, { type: 'redone' }]);
        expect(selectAnnouncement(store.getState()).seq).toBe(3);
    });

    it('nothing when there is nothing to undo or redo', () => {
        const store = setup();

        store.dispatch(undo());
        store.dispatch(redo());

        expect(selectAnnouncement(store.getState())).toEqual({ seq: 0, items: [] });
    });
});

describe('a safe-card chain announces', () => {
    it('one sentHome after the player move, and nothing per step', async () => {
        const store = setup(
            makeState({
                tableau: tableauOf([], [], faceUp(cardId(0, 1)), faceUp(cardId(3, 1)), faceUp(cardId(1, 1))),
                stock: [cardId(2, 9)],
            }),
        );
        store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));

        await store.dispatch(play(DRAW));

        expect(itemsOf(store)).toEqual([
            { type: 'drew', count: 1 },
            { type: 'sentHome', count: 3 },
            // Nothing is left to play afterwards; the dead end is reported once the chain has ended.
            { type: 'deadEnd' },
        ]);
        expect(selectAnnouncement(store.getState()).seq).toBe(3);
    });

    it('no sentHome when the setting is off', async () => {
        const store = setup(makeState({ tableau: tableauOf([], [], faceUp(cardId(0, 1))), stock: [cardId(2, 9)] }));

        await store.dispatch(play(DRAW));

        expect(itemsOf(store)).toEqual([{ type: 'drew', count: 1 }]);
    });
});

describe('finish announces', () => {
    it('one sentHome with the count and then the win, and nothing per step', async () => {
        const start = allFaceUp();
        const store = setup(start);

        await store.dispatch(finish());

        expect(itemsOf(store)).toEqual([{ type: 'sentHome', count: 52 - foundationCount(start) }, { type: 'won' }]);
        expect(selectAnnouncement(store.getState()).seq).toBe(1);
    });

    it('sends more than a few cards home in that one summary', () => {
        expect(52 - foundationCount(allFaceUp())).toBeGreaterThanOrEqual(20);
    });

    it('nothing when it is ignored', async () => {
        const store = setup(dealFromSeed(1, 'draw1'));

        await store.dispatch(finish());

        expect(selectAnnouncement(store.getState()).seq).toBe(0);
    });

    it('nothing when the game is replaced while it runs', async () => {
        let release: () => void = () => undefined;
        let calls = 0;
        const store = createAppStore({
            deps: {
                now: () => 1000,
                delay: () => {
                    calls += 1;
                    return calls === 2
                        ? new Promise<void>((resolve) => {
                              release = resolve;
                          })
                        : Promise.resolve();
                },
                dealService: fakeDealService(),
            },
        });
        store.dispatch(installed({ state: allFaceUp(), dailyKey: null }));
        store.dispatch(setRoute('game'));

        const running = store.dispatch(finish());
        await Promise.resolve();
        store.dispatch(installed({ state: dealFromSeed(99, 'draw1'), dailyKey: null }));
        release();
        await running;

        expect(selectAnnouncement(store.getState())).toEqual({ seq: 0, items: [] });
    });
});
