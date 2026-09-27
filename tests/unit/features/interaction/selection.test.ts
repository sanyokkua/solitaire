import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRoute } from '../../../../src/app/appSlice';
import { createAppStore, type AppStore } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import type { Command, GameState, PileRef } from '../../../../src/domain/types';
import { cleared, installed } from '../../../../src/features/game/gameSlice';
import { play, redo, restart, undo } from '../../../../src/features/game/gameThunks';
import { selectCard } from '../../../../src/features/interaction/interactionThunks';
import {
    selectLegalTargets,
    selectSelectedGroup,
    selectSelection,
} from '../../../../src/features/interaction/selectors';
import { createPersistenceWriter } from '../../../../src/features/persistence/persistenceWriter';
import { createStorageGateway, type StorageGateway } from '../../../../src/features/persistence/storageGateway';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { memoryStorage } from '../../../fixtures/storage';
import { faceDown, faceUp, makeState, tableauOf } from '../../../fixtures/states';

const col = (index: 0 | 1 | 2 | 3 | 4 | 5 | 6): PileRef => ({ pile: 'tableau', col: index });
const WASTE: PileRef = { pile: 'waste' };
const STOCK: PileRef = { pile: 'stock' };

const NINE_OF_CLUBS = cardId(2, 9);
const EIGHT_OF_HEARTS = cardId(0, 8);
const TEN_OF_HEARTS = cardId(0, 10);

/**
 * Column 0: a face-down card under the 9 of clubs and the 8 of hearts (a run of two). Column 1: the 10 of hearts,
 * which the run may go onto. Column 2: the 9 and 8 of spades, which are not a run. The waste holds two cards.
 */
function position(): GameState {
    return makeState({
        tableau: tableauOf(
            [...faceDown(cardId(1, 4)), ...faceUp(NINE_OF_CLUBS, EIGHT_OF_HEARTS)],
            faceUp(TEN_OF_HEARTS),
            faceUp(cardId(3, 9), cardId(3, 8)),
        ),
        stock: [cardId(2, 11)],
        waste: [cardId(0, 2), cardId(1, 3)],
    });
}

const RUN_TO_COL_1: Command = { type: 'move', from: col(0), index: 1, to: col(1) };

function setup(store: AppStore = createStore()): AppStore {
    store.dispatch(installed({ state: position(), dailyKey: null }));
    store.dispatch(setRoute('game'));
    return store;
}

function createStore(gateway?: StorageGateway): AppStore {
    const store = createAppStore({
        deps: {
            now: () => Date.now(),
            delay: () => Promise.resolve(),
            dealService: fakeDealService(),
            ...(gateway === undefined ? {} : { gateway }),
        },
    });
    store.dispatch(preferenceSet({ key: 'autoSafe', value: false }));
    return store;
}

/** A store with the run selected. */
function selected(): AppStore {
    const store = setup();
    store.dispatch(selectCard(col(0), 1));
    return store;
}

describe('selectCard', () => {
    it('selects a movable run, naming its column and index', () => {
        const store = setup();
        store.dispatch(selectCard(col(0), 1));
        expect(selectSelection(store.getState())).toEqual({ from: col(0), index: 1 });
    });

    it('selects the top of the waste', () => {
        const store = setup();
        store.dispatch(selectCard(WASTE, 1));
        expect(selectSelection(store.getState())).toEqual({ from: WASTE, index: 1 });
    });

    it.each([
        ['a face-down card', col(0), 0],
        ['a card in the stock', STOCK, 0],
        ['a waste card that is not on top', WASTE, 0],
        ['a tableau card that starts no run', col(2), 0],
        ['a card that is not there', col(5), 0],
    ])('refuses %s and leaves nothing selected', (_name, from, index) => {
        const store = setup();
        store.dispatch(selectCard(from, index));
        expect(selectSelection(store.getState())).toBeNull();
    });

    it.each([
        ['a face-down card', col(0), 0],
        ['a card in the stock', STOCK, 0],
        ['a waste card that is not on top', WASTE, 0],
        ['a tableau card that starts no run', col(2), 0],
    ])('clears an existing selection when it refuses %s', (_name, from, index) => {
        const store = selected();
        store.dispatch(selectCard(from, index));
        expect(selectSelection(store.getState())).toBeNull();
    });

    it('replaces the old selection with a new one', () => {
        const store = selected();
        store.dispatch(selectCard(col(2), 1));
        expect(selectSelection(store.getState())).toEqual({ from: col(2), index: 1 });
    });

    it('clears the selection when there is no game', () => {
        const store = selected();
        store.dispatch(cleared());
        store.dispatch(selectCard(col(0), 1));
        expect(selectSelection(store.getState())).toBeNull();
    });
});

describe('the selection is cleared', () => {
    it('by an accepted move', async () => {
        const store = selected();
        const result = await store.dispatch(play(RUN_TO_COL_1));
        expect(result.accepted).toBe(true);
        expect(selectSelection(store.getState())).toBeNull();
    });

    it('by undo', async () => {
        const store = setup();
        await store.dispatch(play(RUN_TO_COL_1));
        store.dispatch(selectCard(col(1), 1));
        expect(selectSelection(store.getState())).not.toBeNull();
        store.dispatch(undo());
        expect(selectSelection(store.getState())).toBeNull();
    });

    it('by redo', async () => {
        const store = setup();
        await store.dispatch(play(RUN_TO_COL_1));
        store.dispatch(undo());
        store.dispatch(selectCard(col(0), 1));
        expect(selectSelection(store.getState())).not.toBeNull();
        store.dispatch(redo());
        expect(selectSelection(store.getState())).toBeNull();
    });

    it('by restart', () => {
        const store = selected();
        store.dispatch(restart());
        expect(selectSelection(store.getState())).toBeNull();
    });

    it('by clearing the game', () => {
        const store = selected();
        store.dispatch(cleared());
        expect(selectSelection(store.getState())).toBeNull();
    });

    it('by installing a new game', () => {
        const store = selected();
        store.dispatch(installed({ state: position(), dailyKey: null }));
        expect(selectSelection(store.getState())).toBeNull();
    });

    it('but not by a refused command', async () => {
        const store = selected();
        const result = await store.dispatch(play({ type: 'move', from: col(0), index: 1, to: col(2) }));
        expect(result.accepted).toBe(false);
        expect(selectSelection(store.getState())).toEqual({ from: col(0), index: 1 });
    });
});

describe('the derived selectors', () => {
    it('give the selected run and where it can go', () => {
        const store = selected();
        expect(selectSelectedGroup(store.getState())).toEqual([NINE_OF_CLUBS, EIGHT_OF_HEARTS]);
        expect(selectLegalTargets(store.getState())).toEqual([col(1)]);
    });

    it('are undefined without a selection', () => {
        const store = setup();
        expect(selectSelectedGroup(store.getState())).toBeUndefined();
        expect(selectLegalTargets(store.getState())).toBeUndefined();
    });

    it('are undefined when the selected card no longer starts a run', () => {
        const store = selected();
        store.dispatch(cleared());
        store.dispatch({ type: 'interaction/selectionSet', payload: { from: col(0), index: 1 } });
        expect(selectSelectedGroup(store.getState())).toBeUndefined();
        expect(selectLegalTargets(store.getState())).toBeUndefined();
    });

    it('return the same arrays until the selection or the position changes', () => {
        const store = selected();
        const group = selectSelectedGroup(store.getState());
        const targets = selectLegalTargets(store.getState());
        store.dispatch(setRoute('home'));
        expect(selectSelectedGroup(store.getState())).toBe(group);
        expect(selectLegalTargets(store.getState())).toBe(targets);
    });
});

describe('persistence', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not write when only the selection changes', async () => {
        const inner = createStorageGateway(memoryStorage());
        let writes = 0;
        const gateway: StorageGateway = {
            ...inner,
            write: (key, value) => {
                writes += 1;
                return inner.write(key, value);
            },
        };
        const store = setup(createStore(gateway));
        const writer = createPersistenceWriter(store, gateway, { now: () => Date.now() });
        await store.dispatch(play(RUN_TO_COL_1));
        vi.advanceTimersByTime(10_000);
        expect(writes).toBe(1);

        store.dispatch(selectCard(col(1), 1));
        vi.advanceTimersByTime(10_000);
        store.dispatch(selectCard(WASTE, 1));
        vi.advanceTimersByTime(10_000);
        store.dispatch(selectCard(STOCK, 0));
        vi.advanceTimersByTime(10_000);

        expect(writes).toBe(1);
        expect(vi.getTimerCount()).toBe(0);
        writer.cancel();
    });
});
