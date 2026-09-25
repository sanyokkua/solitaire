import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noticeRaised, setRoute, sheetOpened } from '../../../../src/app/appSlice';
import { createAppStore, type AppStoreOptions } from '../../../../src/app/store';
import { cardId } from '../../../../src/domain/cards';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { Command } from '../../../../src/domain/types';
import { installed, selectResumable } from '../../../../src/features/game/gameSlice';
import { play, startGame } from '../../../../src/features/game/gameThunks';
import { writeFailed } from '../../../../src/features/persistence/persistenceSlice';
import { createPersistenceWriter } from '../../../../src/features/persistence/persistenceWriter';
import { resetAllLocalData, resetStatistics } from '../../../../src/features/persistence/resetThunks';
import { BACKUP_KEY, STORAGE_KEY } from '../../../../src/features/persistence/recordCodec';
import { createStorageGateway, type StorageGateway } from '../../../../src/features/persistence/storageGateway';
import { defaultPreferences, preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { dailyCompleted, played, statsReducer, won } from '../../../../src/features/stats/statsSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';
import { faceUp, makeState, tableauOf } from '../../../fixtures/states';
import { memoryStorage } from '../../../fixtures/storage';

const MOVES: readonly Command[] = parseLine(WINNING_LINE.line);
const FRESH_STATS = statsReducer(undefined, { type: '@@init' });

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

interface Env {
    readonly store: ReturnType<typeof createAppStore>;
    readonly storage: ReturnType<typeof memoryStorage>;
    readonly dealService: ReturnType<typeof fakeDealService>;
    readonly writer: ReturnType<typeof createPersistenceWriter>;
}

/**
 * A store over an in-memory storage, with a real writer; `preloadedState` models what the loader hands over and
 * `wrap` replaces the gateway the store and the writer share.
 */
function setup(
    preloadedState: AppStoreOptions['preloadedState'] = {},
    wrap: (gateway: StorageGateway) => StorageGateway = (gateway) => gateway,
    delay: (ms: number) => Promise<void> = () => Promise.resolve(),
): Env {
    const storage = memoryStorage();
    const gateway = wrap(createStorageGateway(storage));
    const dealService = fakeDealService();
    const store = createAppStore({ preloadedState, deps: { now: () => Date.now(), delay, dealService, gateway } });
    const writer = createPersistenceWriter(store, gateway, { now: () => Date.now() });
    return { store, storage, dealService, writer };
}

/** Statistics for several modes plus Daily dates, through the real reducers. */
function seedStats(store: Env['store']): void {
    store.dispatch(played('draw1'));
    store.dispatch(won({ mode: 'draw1', elapsedMs: 90_000, score: 700 }));
    store.dispatch(played('draw3'));
    store.dispatch(played('vegas'));
    store.dispatch(played('daily'));
    store.dispatch(won({ mode: 'daily', elapsedMs: 60_000, score: 500 }));
    store.dispatch(dailyCompleted('2026-02-01'));
    store.dispatch(dailyCompleted('2026-02-02'));
}

/** A started game with one move played, on the Game route, with custom preferences. */
async function startPlaying(store: Env['store']): Promise<void> {
    store.dispatch(preferenceSet({ key: 'autoSafe', value: false }));
    store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
    store.dispatch(preferenceSet({ key: 'locale', value: 'uk' }));
    store.dispatch(installed({ state: dealFromSeed(WINNING_LINE.seed, 'draw1'), dailyKey: null }));
    store.dispatch(setRoute('game'));
    const cmd = MOVES[0];
    if (cmd === undefined) throw new Error('no such move');
    await store.dispatch(play(cmd));
}

describe('resetStatistics', () => {
    it('clears every mode and the Daily record, leaving the game and the settings alone', async () => {
        const { store } = setup();
        seedStats(store);
        await startPlaying(store);
        const { game, preferences } = store.getState();
        expect(store.getState().stats).not.toEqual(FRESH_STATS);
        expect(game.counted).toBe(true);

        store.dispatch(resetStatistics());

        const after = store.getState();
        expect(after.stats).toEqual(FRESH_STATS);
        expect(after.game.counted).toBe(false);
        expect({ ...after.game, counted: true }).toEqual(game);
        expect(after.game.current).toBe(game.current);
        expect(after.preferences).toBe(preferences);
        expect(after.app.route).toBe('game');
    });

    it('does nothing to the storage keys by itself', () => {
        const { store, storage } = setup();
        storage.setItem(STORAGE_KEY, 'stored');

        store.dispatch(resetStatistics());

        expect(storage.getItem(STORAGE_KEY)).toBe('stored');
    });
});

describe('resetAllLocalData', () => {
    it('during a game removes both keys, restores the defaults and never brings the record back', async () => {
        const env = setup();
        const { store, storage, writer } = env;
        seedStats(store);
        await startPlaying(store);
        vi.advanceTimersByTime(300);
        expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
        storage.setItem(BACKUP_KEY, 'an unreadable record');
        // A change whose debounced save is still waiting when the reset happens.
        store.dispatch(preferenceSet({ key: 'cardBack', value: 'coral' }));
        const epoch = store.getState().game.epoch;

        store.dispatch(resetAllLocalData(writer, ['uk-UA']));

        const state = store.getState();
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
        expect(state.preferences).toEqual(defaultPreferences('uk'));
        expect(state.stats).toEqual(FRESH_STATS);
        expect(state.game.current).toBeNull();
        expect(selectResumable(state)).toBe(false);
        expect(state.game.epoch).toBeGreaterThan(epoch);
        expect(state.app.route).toBe('home');

        vi.advanceTimersByTime(60_000);
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
        expect(storage.length).toBe(0);
    });

    it('uses English when no language is supported', () => {
        const { store, writer } = setup();
        store.dispatch(preferenceSet({ key: 'locale', value: 'uk' }));

        store.dispatch(resetAllLocalData(writer, ['fr-FR']));

        expect(store.getState().preferences.locale).toBe('en');
    });

    it('ends a deal in flight: late progress and its result change nothing', async () => {
        const { store, dealService, writer } = setup();
        const started = store.dispatch(startGame({ mode: 'draw3' }));
        dealService.progress(0, { overlay: true, attempt: 2 });
        expect(store.getState().app.dealing).toEqual({ overlay: true, attempt: 2 });

        store.dispatch(resetAllLocalData(writer, []));
        expect(store.getState().app.dealing).toBeNull();
        dealService.progress(0, { overlay: true, attempt: 3 });
        dealService.resolve(0, dealFromSeed(WINNING_LINE.seed, 'draw3'));
        await started;

        expect(store.getState().app.dealing).toBeNull();
        expect(store.getState().game.current).toBeNull();
        expect(store.getState().app.route).toBe('home');
    });

    it('stops a safe-card chain that is waiting on its delay', async () => {
        let open: () => void = () => undefined;
        const held = new Promise<void>((resolve) => {
            open = resolve;
        });
        const { store, storage, writer } = setup({}, undefined, () => held);
        store.dispatch(preferenceSet({ key: 'autoSafe', value: true }));
        const position = makeState({
            tableau: tableauOf([], [], faceUp(cardId(0, 1)), faceUp(cardId(3, 1))),
            stock: [cardId(2, 9)],
        });
        store.dispatch(installed({ state: position, dailyKey: null }));
        store.dispatch(setRoute('game'));
        const playing = store.dispatch(play({ type: 'draw' }));
        expect(store.getState().game.busy).toBe(true);

        store.dispatch(resetAllLocalData(writer, []));
        open();
        await playing;

        const { game } = store.getState();
        expect(game.current).toBeNull();
        expect(game.busy).toBe(false);
        expect(game.history).toEqual([]);
        vi.advanceTimersByTime(60_000);
        expect(storage.length).toBe(0);
    });

    it('goes Home with no sheet open', () => {
        const { store, writer } = setup();
        store.dispatch(setRoute('game'));
        store.dispatch(sheetOpened('settings'));

        store.dispatch(resetAllLocalData(writer, []));

        expect(store.getState().app.route).toBe('home');
        expect(store.getState().app.sheet).toBeNull();
    });

    it('dismisses the storage notices, leaves read-only and clears the error, so the next change is saved', () => {
        const { store, storage, writer } = setup({
            persistence: { readOnly: true, lastError: 'read' },
        });
        store.dispatch(noticeRaised('storage-read'));
        store.dispatch(noticeRaised('storage-read-only'));
        store.dispatch(noticeRaised('storage-write'));
        store.dispatch(writeFailed());
        // Nothing is saved while read-only.
        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        vi.advanceTimersByTime(1000);
        expect(storage.getItem(STORAGE_KEY)).toBeNull();

        store.dispatch(resetAllLocalData(writer, []));

        expect(store.getState().persistence).toEqual({ readOnly: false, lastError: null });
        expect(store.getState().app.notices).toEqual([]);
        expect(storage.getItem(STORAGE_KEY)).toBeNull();

        store.dispatch(preferenceSet({ key: 'theme', value: 'light' }));
        vi.advanceTimersByTime(300);
        expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it('writes nothing until the player changes something', () => {
        const { store, storage, writer } = setup();
        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        vi.advanceTimersByTime(300);
        expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

        store.dispatch(resetAllLocalData(writer, []));
        vi.advanceTimersByTime(10_000);
        expect(storage.getItem(STORAGE_KEY)).toBeNull();

        store.dispatch(preferenceSet({ key: 'nightCards', value: true }));
        vi.advanceTimersByTime(300);
        expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it('still removes both keys and completes the reset when the first remove fails, and saves the next change', () => {
        const removed: string[] = [];
        const { store, storage, writer } = setup({}, (gateway) => ({
            ...gateway,
            remove: (key) => {
                removed.push(key);
                return key === STORAGE_KEY ? { ok: false, error: new Error('blocked') } : gateway.remove(key);
            },
        }));
        seedStats(store);
        store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        storage.setItem(BACKUP_KEY, 'an unreadable record');

        expect(() => {
            store.dispatch(resetAllLocalData(writer, []));
        }).not.toThrow();

        expect(removed).toEqual([STORAGE_KEY, BACKUP_KEY]);
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
        expect(store.getState().stats).toEqual(FRESH_STATS);
        expect(store.getState().preferences).toEqual(defaultPreferences('en'));

        store.dispatch(preferenceSet({ key: 'nightCards', value: true }));
        vi.advanceTimersByTime(300);
        expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });
});
