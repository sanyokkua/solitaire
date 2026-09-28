import { describe, expect, it, vi } from 'vitest';
import { noticeRaised } from '../../../../src/app/appSlice';
import type { AppStore } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import type { Command, GameState } from '../../../../src/domain/types';
import type { HintOutcome } from '../../../../src/features/deal/dealService';
import { installed } from '../../../../src/features/game/gameSlice';
import { play, redo, undo } from '../../../../src/features/game/gameThunks';
import { restart } from '../../../../src/features/game/sessionThunks';
import type { Announcement } from '../../../../src/features/interaction/announcements';
import { HINT_DURATION_MS, requestHint } from '../../../../src/features/interaction/interactionThunks';
import { selectAnnouncement, selectHint, selectPendingHint } from '../../../../src/features/interaction/selectors';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService, type FakeDealService } from '../../../fixtures/dealService';
import { faceUp, makeState, tableauOf } from '../../../fixtures/states';
import { testStore } from '../../../support/testStore';

const ACE_OF_SPADES = cardId(3, 1);
const TO_FOUNDATION: Command = {
    type: 'move',
    from: { pile: 'tableau', col: 0 },
    index: 0,
    to: { pile: 'foundation', suit: 3 },
};

/** A position with a productive move (the ace home) and a card to draw, so it is not a dead end. */
function movable(): GameState {
    return makeState({ tableau: tableauOf(faceUp(ACE_OF_SPADES)), stock: [cardId(2, 9)] });
}

/** A hint the solver would give for `movable()`. */
const SOLVER_OUTCOME: HintOutcome = {
    status: 'hint',
    source: 'solver',
    hint: { kind: 'move', command: TO_FOUNDATION, cards: [ACE_OF_SPADES] },
};

interface Setup {
    readonly store: AppStore;
    readonly service: FakeDealService;
    /** The millisecond argument of every `delay` call, in order. */
    readonly delays: number[];
    /** Resolves `delay` call number `index`. */
    readonly elapse: (index: number) => void;
}

/** A store whose `delay` waits until the test elapses it, so a hint's 2.2 s stays on show until told otherwise. */
function setup(game: GameState | null = movable()): Setup {
    const service = fakeDealService();
    const delays: number[] = [];
    const timers: (() => void)[] = [];
    const store = testStore({
        deps: {
            now: () => 1000,
            dealService: service,
            delay: (ms) => {
                delays.push(ms);
                return new Promise<void>((resolve) => timers.push(resolve));
            },
        },
    });
    if (game !== null) store.dispatch(installed({ state: game, dailyKey: null }));
    return {
        store,
        service,
        delays,
        elapse: (index) => {
            timers[index]?.();
        },
    };
}

const itemsOf = (store: AppStore): Announcement[] => selectAnnouncement(store.getState()).items.map(({ item }) => item);

/** Waits until the thunk has shown a hint and is waiting for its timer. */
async function shown(delays: number[]): Promise<void> {
    await vi.waitFor(() => {
        expect(delays.length).toBeGreaterThan(0);
    });
}

describe('requestHint sources', () => {
    it('shows the solver hint: its cards and its target', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;

        const done = store.dispatch(requestHint());
        await shown(delays);

        expect(selectHint(store.getState())).toEqual({
            id: 1,
            kind: 'move',
            cards: [ACE_OF_SPADES],
            target: { pile: 'foundation', suit: 3 },
        });
        expect(service.hintRequests).toEqual([store.getState().game.current]);
        elapse(0);
        await done;
    });

    it('shows a heuristic hint the same way', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = { status: 'hint', source: 'heuristic', hint: { kind: 'draw' } };

        const done = store.dispatch(requestHint());
        await shown(delays);

        expect(selectHint(store.getState())).toMatchObject({ kind: 'draw', cards: [], target: 'stock' });
        elapse(0);
        await done;
    });

    it('names the stock for a recycle', async () => {
        const { store, service, delays, elapse } = setup(makeState({ waste: [ACE_OF_SPADES, cardId(2, 9)] }));
        service.hintOutcome = { status: 'hint', source: 'heuristic', hint: { kind: 'recycle' } };

        const done = store.dispatch(requestHint());
        await shown(delays);

        expect(selectHint(store.getState())).toMatchObject({ kind: 'recycle', cards: [], target: 'stock' });
        elapse(0);
        await done;
    });

    it.each<[string, HintOutcome]>([
        ['none', { status: 'none' }],
        ['cancelled', { status: 'cancelled' }],
    ])('drops a %s answer: no hint, no announcement', async (_name, outcome) => {
        const { store, service, delays } = setup();
        service.hintOutcome = outcome;

        await store.dispatch(requestHint());

        expect(selectHint(store.getState())).toBeNull();
        expect(selectPendingHint(store.getState())).toBeNull();
        expect(itemsOf(store)).toEqual([]);
        expect(delays).toEqual([]);
    });

    it('announces the hint that was shown', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;

        const done = store.dispatch(requestHint());
        await shown(delays);

        expect(itemsOf(store)).toEqual([
            { type: 'hinted', kind: 'move', cards: [ACE_OF_SPADES], target: { pile: 'foundation', suit: 3 } },
        ]);
        elapse(0);
        await done;
    });

    it('does nothing without a game, or for a won game', async () => {
        const none = setup(null);
        await none.store.dispatch(requestHint());
        const won = setup(makeState({ status: 'won' }));
        await won.store.dispatch(requestHint());

        expect(none.service.hintRequests).toEqual([]);
        expect(won.service.hintRequests).toEqual([]);
        expect(itemsOf(won.store)).toEqual([]);
    });
});

describe('requestHint at a dead end', () => {
    it('raises the notice, announces it, and asks for and shows no hint', async () => {
        const { store, service } = setup(makeState({ stock: [cardId(2, 9)] }));
        service.hintOutcome = SOLVER_OUTCOME;

        await store.dispatch(requestHint());

        expect(store.getState().app.notices).toEqual([{ id: 'dead-end' }]);
        expect(itemsOf(store)).toEqual([{ type: 'deadEnd' }]);
        expect(selectHint(store.getState())).toBeNull();
        expect(service.hintRequests).toEqual([]);
    });

    it('announces again on every request, though the notice is raised once', async () => {
        const { store } = setup(makeState({ stock: [cardId(2, 9)] }));

        await store.dispatch(requestHint());
        await store.dispatch(requestHint());

        expect(itemsOf(store)).toEqual([{ type: 'deadEnd' }, { type: 'deadEnd' }]);
        expect(store.getState().app.notices).toEqual([{ id: 'dead-end' }]);
    });
});

describe('a hint that arrives late', () => {
    it('is dropped after a move was played while it was pending', async () => {
        const { store, service } = setup();
        service.deferHints = true;
        const done = store.dispatch(requestHint());
        expect(selectPendingHint(store.getState())).not.toBeNull();

        await store.dispatch(play(TO_FOUNDATION));
        service.resolveHint(0, SOLVER_OUTCOME);
        await done;

        expect(selectHint(store.getState())).toBeNull();
        expect(selectPendingHint(store.getState())).toBeNull();
        expect(itemsOf(store).some(({ type }) => type === 'hinted')).toBe(false);
    });

    it('is dropped after an undo while it was pending', async () => {
        const { store, service } = setup(
            makeState({ tableau: tableauOf(faceUp(ACE_OF_SPADES)), stock: [cardId(2, 9)] }),
        );
        await store.dispatch(play({ type: 'draw' }));
        service.deferHints = true;
        const done = store.dispatch(requestHint());

        store.dispatch(undo());
        service.resolveHint(0, SOLVER_OUTCOME);
        await done;

        expect(selectHint(store.getState())).toBeNull();
    });

    it('is dropped after a redo while it was pending', async () => {
        const { store, service } = setup();
        await store.dispatch(play({ type: 'draw' }));
        store.dispatch(undo());
        service.deferHints = true;
        const done = store.dispatch(requestHint());

        store.dispatch(redo());
        service.resolveHint(0, SOLVER_OUTCOME);
        await done;

        expect(selectHint(store.getState())).toBeNull();
    });

    it('is dropped after a restart while it was pending', async () => {
        const { store, service } = setup();
        service.deferHints = true;
        const done = store.dispatch(requestHint());

        store.dispatch(restart());
        service.resolveHint(0, SOLVER_OUTCOME);
        await done;

        expect(selectHint(store.getState())).toBeNull();
        expect(selectPendingHint(store.getState())).toBeNull();
    });
});

describe('the hint on show', () => {
    it('clears itself after 2,200 ms of the injected delay', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;

        const done = store.dispatch(requestHint());
        await shown(delays);
        expect(delays).toEqual([HINT_DURATION_MS]);
        expect(HINT_DURATION_MS).toBe(2200);
        expect(selectHint(store.getState())).not.toBeNull();

        elapse(0);
        await done;

        expect(selectHint(store.getState())).toBeNull();
    });

    it('is not cleared by the timer of an older hint', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;
        const first = store.dispatch(requestHint());
        await shown(delays);
        const second = store.dispatch(requestHint());
        await vi.waitFor(() => {
            expect(delays).toHaveLength(2);
        });
        expect(selectHint(store.getState())?.id).toBe(2);

        elapse(0);
        await first;
        expect(selectHint(store.getState())?.id).toBe(2);

        elapse(1);
        await second;
        expect(selectHint(store.getState())).toBeNull();
    });

    it.each<[string, (store: AppStore) => Promise<void>, (store: AppStore) => Promise<unknown>]>([
        ['a move', () => Promise.resolve(), (store) => store.dispatch(play(TO_FOUNDATION))],
        [
            'an undo',
            (store) => store.dispatch(play({ type: 'draw' })).then(() => undefined),
            (store) => {
                store.dispatch(undo());
                return Promise.resolve();
            },
        ],
        [
            'a redo',
            async (store) => {
                await store.dispatch(play({ type: 'draw' }));
                store.dispatch(undo());
            },
            (store) => {
                store.dispatch(redo());
                return Promise.resolve();
            },
        ],
    ])('is cleared by %s', async (_name, prepare, change) => {
        const { store, service, delays } = setup();
        await prepare(store);
        service.hintOutcome = SOLVER_OUTCOME;
        const done = store.dispatch(requestHint());
        await shown(delays);
        expect(selectHint(store.getState())).not.toBeNull();

        await change(store);

        expect(selectHint(store.getState())).toBeNull();
        void done;
    });

    it('is cleared when a setting changes', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;
        const done = store.dispatch(requestHint());
        await shown(delays);

        store.dispatch(preferenceSet({ key: 'fourColor', value: true }));

        expect(selectHint(store.getState())).toBeNull();
        elapse(0);
        await done;
    });

    it('is cleared when a new game is installed', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;
        const done = store.dispatch(requestHint());
        await shown(delays);

        store.dispatch(installed({ state: movable(), dailyKey: null }));

        expect(selectHint(store.getState())).toBeNull();
        elapse(0);
        await done;
    });
});

describe('requests in flight', () => {
    it('does not ask again for the same game and position while one is pending', async () => {
        const { store, service } = setup();
        service.deferHints = true;

        const first = store.dispatch(requestHint());
        const second = store.dispatch(requestHint());
        await second;

        expect(service.hintRequests).toHaveLength(1);
        service.resolveHint(0, { status: 'none' });
        await first;
        expect(selectPendingHint(store.getState())).toBeNull();
    });

    it('asks again once the answer has landed', async () => {
        const { store, service } = setup();

        await store.dispatch(requestHint());
        await store.dispatch(requestHint());

        expect(service.hintRequests).toHaveLength(2);
    });

    it('records the request by game and position', () => {
        const { store, service } = setup();
        service.deferHints = true;

        void store.dispatch(requestHint());

        const { epoch } = store.getState().game;
        expect(selectPendingHint(store.getState())).toEqual({ epoch, key: expect.any(String) as string });
    });
});

describe('a hint costs nothing', () => {
    it('leaves the game, its score and moves, and the statistics untouched', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;
        const { game, stats } = store.getState();

        const done = store.dispatch(requestHint());
        await shown(delays);
        elapse(0);
        await done;

        const after = store.getState();
        expect(after.game).toBe(game);
        expect(after.game.current).toBe(game.current);
        expect(after.stats).toBe(stats);
    });

    it('raises no notice when a hint is shown', async () => {
        const { store, service, delays, elapse } = setup();
        service.hintOutcome = SOLVER_OUTCOME;

        const done = store.dispatch(requestHint());
        await shown(delays);
        elapse(0);
        await done;

        expect(store.getState().app.notices).toEqual([]);
        expect(noticeRaised('dead-end').type).toBe('app/noticeRaised');
    });
});
