import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../../../src/app/store';
import { dealFromSeed } from '../../../../src/domain/deal';
import { applyCommand } from '../../../../src/domain/engine';
import {
    accrued,
    committed,
    countedSet,
    gameReducer,
    installed,
    selectResumable,
    undone,
    type GameSliceState,
} from '../../../../src/features/game/gameSlice';
import { loadInitialState } from '../../../../src/features/persistence/persistenceLoader';
import { initialPersistenceState } from '../../../../src/features/persistence/persistenceSlice';
import { BACKUP_KEY, STORAGE_KEY, encodeRecord } from '../../../../src/features/persistence/recordCodec';
import { createStorageGateway, type StorageGateway } from '../../../../src/features/persistence/storageGateway';
import { defaultPreferences, type Preferences } from '../../../../src/features/preferences/preferencesSlice';
import { statsReducer, type StatsState } from '../../../../src/features/stats/statsSlice';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';
import { memoryStorage, throwingStorage, type MemoryStorage } from '../../../fixtures/storage';

const NO_LANGUAGES: readonly string[] = [];

const preferences: Preferences = {
    ...defaultPreferences('uk'),
    theme: 'dark',
    cardBack: 'coral',
    selectedMode: 'daily',
    winnableOnly: false,
};

const stats: StatsState = {
    modes: {
        ...statsReducer(undefined, { type: '@@init' }).modes,
        draw1: { played: 12, won: 5, streak: 2, bestStreak: 3, bestTimeMs: 91_500, bestScore: 745 },
    },
    daily: { completed: ['2026-01-31', '2026-02-01'], bestStreak: 2 },
};

/** A started Daily game with four moves played and one undone, built by the real reducers. */
function midGame(): GameSliceState {
    let game = gameReducer(
        undefined,
        installed({ state: dealFromSeed(WINNING_LINE.seed, 'daily'), dailyKey: '2026-02-01' }),
    );
    let now = 1000;
    game = gameReducer(game, accrued({ atMs: now, eligible: true }));
    for (const command of parseLine(WINNING_LINE.line).slice(0, 4)) {
        if (game.current === null) throw new Error('expected a game in play');
        game = gameReducer(game, committed(applyCommand(game.current, command).state));
        now += 700;
        game = gameReducer(game, accrued({ atMs: now, eligible: true }));
    }
    return gameReducer(gameReducer(game, countedSet(true)), undone());
}

const validRaw = (game: GameSliceState = midGame()): string => encodeRecord({ preferences, stats, game });

const corruptRaw = '{"version":1,';
const invalidRaw = (): string => {
    const record = JSON.parse(validRaw()) as { session: { current: { stock: number[] } } };
    const { stock } = record.session.current;
    stock[0] = stock[1] ?? 0;
    return JSON.stringify(record);
};
const futureRaw = JSON.stringify({ version: 2, anything: true });

function seeded(entries: Record<string, string>): MemoryStorage {
    const storage = memoryStorage();
    for (const [key, value] of Object.entries(entries)) storage.setItem(key, value);
    return storage;
}

/** A gateway over `storage` that also lists every write and removal made through it. */
function spied(storage: Storage): { gateway: StorageGateway; writes: string[]; removals: string[] } {
    const inner = createStorageGateway(storage);
    const writes: string[] = [];
    const removals: string[] = [];
    const gateway: StorageGateway = {
        read: (key) => inner.read(key),
        write: (key, value) => {
            writes.push(key);
            return inner.write(key, value);
        },
        remove: (key) => {
            removals.push(key);
            return inner.remove(key);
        },
    };
    return { gateway, writes, removals };
}

describe('loadInitialState', () => {
    describe('first run', () => {
        it('starts with the defaults and no notice, choosing the language from the browser', () => {
            const { gateway, writes } = spied(memoryStorage());

            const { preloadedState, notices } = loadInitialState(gateway, ['uk-UA', 'en']);

            expect(notices).toEqual([]);
            expect(preloadedState.preferences).toEqual(defaultPreferences('uk'));
            expect(preloadedState.game).toBeUndefined();
            expect(writes).toEqual([]);
            const store = createAppStore({ preloadedState });
            expect(store.getState().persistence).toEqual(initialPersistenceState);
            expect(store.getState().stats).toEqual(statsReducer(undefined, { type: '@@init' }));
        });

        it('falls back to English when no browser language is supported', () => {
            const { preloadedState } = loadInitialState(createStorageGateway(memoryStorage()), ['fr-FR']);

            expect(preloadedState.preferences).toEqual(defaultPreferences('en'));
        });
    });

    describe('a valid record', () => {
        it('preloads the preferences, statistics and resumable game, and stays on the home route', () => {
            const game = midGame();
            const storage = seeded({ [STORAGE_KEY]: validRaw(game) });

            const { preloadedState, notices } = loadInitialState(createStorageGateway(storage), ['en']);
            const store = createAppStore({ preloadedState });

            expect(notices).toEqual([]);
            const state = store.getState();
            expect(state.app.route).toBe('home');
            expect(state.preferences).toEqual(preferences);
            expect(state.stats).toEqual(stats);
            expect(selectResumable(state)).toBe(true);
            expect(state.game.current).toEqual(game.current);
            expect(state.game.history).toEqual(game.history);
            expect(state.game.future).toEqual(game.future);
            expect(state.game.history.length).toBeGreaterThan(1);
            expect(state.game.future).toHaveLength(1);
            expect(state.game.dailyKey).toBe('2026-02-01');
            expect(state.game.counted).toBe(true);
            expect(state.game.busy).toBe(false);
            expect(state.game.epoch).toBe(0);
            expect(state.game.clock.anchorMs).toBeNull();
            expect(state.persistence).toEqual(initialPersistenceState);
            expect(storage.getItem(BACKUP_KEY)).toBeNull();
        });

        it('preloads the preferences and statistics of a record without a game', () => {
            const raw = validRaw(gameReducer(undefined, { type: '@@init' }));
            const storage = seeded({ [STORAGE_KEY]: raw });

            const { preloadedState, notices } = loadInitialState(createStorageGateway(storage), NO_LANGUAGES);
            const state = createAppStore({ preloadedState }).getState();

            expect(notices).toEqual([]);
            expect(state.preferences).toEqual(preferences);
            expect(state.stats).toEqual(stats);
            expect(state.game.current).toBeNull();
            expect(selectResumable(state)).toBe(false);
        });
    });

    describe.each([
        ['corrupt JSON', () => corruptRaw],
        ['a version-2 record', () => futureRaw],
        ['an invalid record', invalidRaw],
    ])('%s', (_name, makeRaw) => {
        it('starts with the defaults, backs the raw string up and raises the read notice', () => {
            const raw = makeRaw();
            const storage = seeded({ [STORAGE_KEY]: raw });
            const { gateway, writes, removals } = spied(storage);

            const { preloadedState, notices } = loadInitialState(gateway, ['uk']);
            const state = createAppStore({ preloadedState }).getState();

            expect(notices).toEqual(['storage-read']);
            expect(state.preferences).toEqual(defaultPreferences('uk'));
            expect(state.stats).toEqual(statsReducer(undefined, { type: '@@init' }));
            expect(state.game.current).toBeNull();
            expect(state.persistence).toEqual({ readOnly: false, lastError: 'read' });
            expect(storage.getItem(BACKUP_KEY)).toBe(raw);
            expect(storage.getItem(STORAGE_KEY)).toBe(raw);
            expect(writes).toEqual([BACKUP_KEY]);
            expect(removals).toEqual([]);
        });

        it('blocks saving when the backup key holds a different string', () => {
            const storage = seeded({ [STORAGE_KEY]: makeRaw(), [BACKUP_KEY]: 'an older unreadable record' });
            const { gateway, writes } = spied(storage);

            const { preloadedState, notices } = loadInitialState(gateway, NO_LANGUAGES);

            expect(notices).toEqual(['storage-read-only']);
            expect(preloadedState.persistence).toEqual({ readOnly: true, lastError: 'read' });
            expect(preloadedState.preferences).toEqual(defaultPreferences('en'));
            expect(storage.getItem(BACKUP_KEY)).toBe('an older unreadable record');
            expect(writes).toEqual([]);
        });

        it('does not treat a backup already holding the same string as occupied, and does not rewrite it', () => {
            const raw = makeRaw();
            const storage = seeded({ [STORAGE_KEY]: raw, [BACKUP_KEY]: raw });
            const { gateway, writes } = spied(storage);
            storage.failWrites = true;

            const { preloadedState, notices } = loadInitialState(gateway, NO_LANGUAGES);

            expect(notices).toEqual(['storage-read']);
            expect(preloadedState.persistence).toEqual({ readOnly: false, lastError: 'read' });
            expect(writes).toEqual([]);
        });

        it('blocks saving when the backup cannot be written', () => {
            const raw = makeRaw();
            const storage = seeded({ [STORAGE_KEY]: raw });
            storage.failWrites = true;

            const { preloadedState, notices } = loadInitialState(createStorageGateway(storage), NO_LANGUAGES);

            expect(notices).toEqual(['storage-read-only']);
            expect(preloadedState.persistence).toEqual({ readOnly: true, lastError: 'read' });
            expect(storage.getItem(BACKUP_KEY)).toBeNull();
            expect(storage.getItem(STORAGE_KEY)).toBe(raw);
        });
    });

    it('blocks saving when the backup key cannot be read', () => {
        const storage = seeded({ [STORAGE_KEY]: corruptRaw });
        const inner = createStorageGateway(storage);
        const gateway: StorageGateway = {
            ...inner,
            read: (key) => (key === BACKUP_KEY ? { ok: false, error: new Error('unreadable') } : inner.read(key)),
        };

        const { preloadedState, notices } = loadInitialState(gateway, NO_LANGUAGES);

        expect(notices).toEqual(['storage-read-only']);
        expect(preloadedState.persistence).toEqual({ readOnly: true, lastError: 'read' });
        expect(storage.getItem(BACKUP_KEY)).toBeNull();
    });

    describe.each([
        ['storage that throws', () => createStorageGateway(throwingStorage())],
        ['no storage', () => createStorageGateway(null)],
    ])('with %s', (_name, makeGateway) => {
        it('starts with the defaults and never overwrites what may be stored', () => {
            const { preloadedState, notices } = loadInitialState(makeGateway(), ['uk']);

            expect(notices).toEqual(['storage-read-only']);
            expect(preloadedState.preferences).toEqual(defaultPreferences('uk'));
            expect(preloadedState.persistence).toEqual({ readOnly: true, lastError: 'read' });
            expect(preloadedState.game).toBeUndefined();
        });
    });

    it('never writes the main record, whatever it holds', () => {
        for (const raw of [validRaw(), corruptRaw, futureRaw, invalidRaw()]) {
            const { gateway, writes, removals } = spied(seeded({ [STORAGE_KEY]: raw }));

            loadInitialState(gateway, NO_LANGUAGES);

            expect(writes.filter((key) => key !== BACKUP_KEY)).toEqual([]);
            expect(removals).toEqual([]);
        }
    });
});
