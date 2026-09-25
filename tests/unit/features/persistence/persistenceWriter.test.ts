import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noticeDismissed, setRoute } from '../../../../src/app/appSlice';
import { createAppStore } from '../../../../src/app/store';
import { dealFromSeed } from '../../../../src/domain/deal';
import type { Command } from '../../../../src/domain/types';
import { accrued, installed } from '../../../../src/features/game/gameSlice';
import { play } from '../../../../src/features/game/gameThunks';
import { readOnlyEntered } from '../../../../src/features/persistence/persistenceSlice';
import { createPersistenceWriter } from '../../../../src/features/persistence/persistenceWriter';
import { STORAGE_KEY, decodeRecord } from '../../../../src/features/persistence/recordCodec';
import { createStorageGateway, type StorageGateway } from '../../../../src/features/persistence/storageGateway';
import { preferenceSet } from '../../../../src/features/preferences/preferencesSlice';
import { fakeDealService } from '../../../fixtures/dealService';
import { WINNING_LINE, parseLine } from '../../../fixtures/deals';
import { memoryStorage } from '../../../fixtures/storage';

const MOVES: readonly Command[] = parseLine(WINNING_LINE.line);

interface Env {
    readonly store: ReturnType<typeof createAppStore>;
    readonly storage: ReturnType<typeof memoryStorage>;
    /** The time (fake `Date.now()`) of every write attempt, successful or not. */
    readonly attempts: number[];
    readonly writer: ReturnType<typeof createPersistenceWriter>;
}

/**
 * A store on the Game route with a started-game-ready Draw 1 deal, over an in-memory storage whose write attempts are
 * listed. Every clock is the fake `Date.now()`. `prepare` runs before the writer exists, so its dispatches are not seen.
 */
function setup(prepare: (store: Env['store']) => void = () => undefined): Env {
    const storage = memoryStorage();
    const inner = createStorageGateway(storage);
    const attempts: number[] = [];
    const gateway: StorageGateway = {
        ...inner,
        write: (key, value) => {
            attempts.push(Date.now());
            return inner.write(key, value);
        },
    };
    const store = createAppStore({
        deps: { now: () => Date.now(), delay: () => Promise.resolve(), dealService: fakeDealService(), gateway },
    });
    store.dispatch(preferenceSet({ key: 'autoSafe', value: false }));
    store.dispatch(installed({ state: dealFromSeed(WINNING_LINE.seed, 'draw1'), dailyKey: null }));
    store.dispatch(setRoute('game'));
    prepare(store);
    const writer = createPersistenceWriter(store, gateway, { now: () => Date.now() });
    return { store, storage, attempts, writer };
}

/** The move count of the game in the stored record, or `null` when no game is stored. */
function storedMoves(storage: Storage): number | null {
    const decoded = decodeRecord(storage.getItem(STORAGE_KEY));
    if (!decoded.ok) throw new Error('expected a readable stored record');
    return decoded.record.session?.current.moves ?? null;
}

async function move(env: Env, index: number): Promise<void> {
    const cmd = MOVES[index];
    if (cmd === undefined) throw new Error('no such move');
    await env.store.dispatch(play(cmd));
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('persistence writer: saving on change', () => {
    it('saves a burst of moves once, 250 ms after the last one', async () => {
        const env = setup();
        for (let index = 0; index < 5; index++) {
            await move(env, index);
            vi.advanceTimersByTime(20);
        }
        vi.advanceTimersByTime(229);
        expect(env.attempts).toHaveLength(0);

        vi.advanceTimersByTime(1);
        expect(env.attempts).toHaveLength(1);
        expect(storedMoves(env.storage)).toBe(5);

        vi.advanceTimersByTime(10_000);
        expect(env.attempts).toHaveLength(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not write for changes that are not part of the record', () => {
        const env = setup();
        env.store.dispatch(setRoute('home'));
        env.store.dispatch(noticeDismissed('storage-write'));
        vi.advanceTimersByTime(10_000);
        expect(env.attempts).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('saves a preference change', () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        vi.advanceTimersByTime(250);
        expect(env.attempts).toHaveLength(1);
        const decoded = decodeRecord(env.storage.getItem(STORAGE_KEY));
        expect(decoded.ok && decoded.record.preferences.theme).toBe('dark');
    });

    it('does not rewrite a record that encodes to the same string, until cancel forgets it', () => {
        const env = setup();
        const redeal = (): void => {
            env.store.dispatch(installed({ state: dealFromSeed(WINNING_LINE.seed, 'draw1'), dailyKey: null }));
            vi.advanceTimersByTime(250);
        };

        redeal();
        expect(env.attempts).toHaveLength(1);
        redeal();
        expect(env.attempts).toHaveLength(1);

        env.writer.cancel();
        redeal();
        expect(env.attempts).toHaveLength(2);
    });
});

describe('persistence writer: the clock', () => {
    it('writes a change that is only elapsed time at most once every 5 seconds', async () => {
        const env = setup();
        await move(env, 0);
        vi.advanceTimersByTime(250);
        expect(env.attempts).toHaveLength(1);
        const firstWriteAt = env.attempts[0] ?? 0;

        for (let second = 1; second <= 12; second++) {
            vi.advanceTimersByTime(1000);
            env.store.dispatch(accrued({ atMs: Date.now(), eligible: true }));
        }

        expect(env.attempts.map((at) => at - firstWriteAt)).toEqual([0, 5000, 10_000]);
        // The last save ran at second 10, before that second's tick was accrued: nine seconds of play.
        const decoded = decodeRecord(env.storage.getItem(STORAGE_KEY));
        expect(decoded.ok && decoded.record.session?.current.elapsedMs).toBe(9000);
        expect(env.store.getState().game.current?.elapsedMs).toBe(12_000);
    });

    it('still saves a move at 250 ms when a clock tick arrives in between', async () => {
        const env = setup();
        await move(env, 0);
        vi.advanceTimersByTime(200);
        env.store.dispatch(accrued({ atMs: Date.now(), eligible: true }));
        expect(env.attempts).toHaveLength(0);

        vi.advanceTimersByTime(49);
        expect(env.attempts).toHaveLength(0);
        vi.advanceTimersByTime(1);
        expect(env.attempts).toHaveLength(1);
        expect(storedMoves(env.storage)).toBe(1);
    });

    it('flush saves a pending clock-only change at once', async () => {
        const env = setup();
        await move(env, 0);
        vi.advanceTimersByTime(250);
        vi.advanceTimersByTime(1000);
        env.store.dispatch(accrued({ atMs: Date.now(), eligible: true }));
        expect(env.attempts).toHaveLength(1);

        env.writer.flush();
        expect(env.attempts).toHaveLength(2);
        const decoded = decodeRecord(env.storage.getItem(STORAGE_KEY));
        expect(decoded.ok && decoded.record.session?.current.elapsedMs).toBe(1000);
        vi.advanceTimersByTime(20_000);
        expect(env.attempts).toHaveLength(2);
    });

    it('lets a real change override a pending clock write', async () => {
        const env = setup();
        await move(env, 0);
        vi.advanceTimersByTime(250);
        vi.advanceTimersByTime(1000);
        env.store.dispatch(accrued({ atMs: Date.now(), eligible: true }));

        await move(env, 1);
        vi.advanceTimersByTime(250);

        expect(env.attempts).toHaveLength(2);
        expect(storedMoves(env.storage)).toBe(2);
        vi.advanceTimersByTime(20_000);
        expect(env.attempts).toHaveLength(2);
    });
});

describe('persistence writer: flush, cancel and dispose', () => {
    it('flush saves at once what is pending', async () => {
        const env = setup();
        await move(env, 0);
        vi.advanceTimersByTime(50);
        env.writer.flush();

        expect(env.attempts).toHaveLength(1);
        expect(storedMoves(env.storage)).toBe(1);
        vi.advanceTimersByTime(10_000);
        expect(env.attempts).toHaveLength(1);
    });

    it('flush with nothing pending writes nothing', async () => {
        const env = setup();
        env.writer.flush();
        expect(env.attempts).toHaveLength(0);

        await move(env, 0);
        vi.advanceTimersByTime(250);
        env.writer.flush();
        expect(env.attempts).toHaveLength(1);
    });

    it('cancel drops a pending write, and later changes save again', async () => {
        const env = setup();
        await move(env, 0);
        env.writer.cancel();
        vi.advanceTimersByTime(10_000);
        env.writer.flush();
        expect(env.attempts).toHaveLength(0);
        expect(env.storage.getItem(STORAGE_KEY)).toBeNull();

        await move(env, 1);
        vi.advanceTimersByTime(250);
        expect(storedMoves(env.storage)).toBe(2);
    });

    it('dispose stops all writing', async () => {
        const env = setup();
        await move(env, 0);
        env.writer.dispose();
        expect(vi.getTimerCount()).toBe(0);

        await move(env, 1);
        env.store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(10_000);
        env.writer.flush();
        expect(env.attempts).toHaveLength(0);
    });
});

describe('persistence writer: read-only', () => {
    it('writes nothing while the session is read-only', async () => {
        const env = setup((store) => {
            store.dispatch(readOnlyEntered());
        });
        await move(env, 0);
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(10_000);
        env.writer.flush();
        expect(env.attempts).toHaveLength(0);
        expect(env.storage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('drops a pending write when the session turns read-only before it runs', async () => {
        const env = setup();
        await move(env, 0);
        env.store.dispatch(readOnlyEntered());
        vi.advanceTimersByTime(10_000);
        env.writer.flush();
        expect(env.attempts).toHaveLength(0);
    });
});

describe('persistence writer: a failed save', () => {
    it('keeps the game playable, raises one notice until a save works, then re-arms', async () => {
        const env = setup();
        env.storage.failWrites = true;

        await move(env, 0);
        vi.advanceTimersByTime(250);
        expect(env.store.getState().game.current?.moves).toBe(1);
        expect(env.store.getState().persistence.lastError).toBe('write');
        expect(env.store.getState().app.notices).toEqual([{ id: 'storage-write' }]);

        env.store.dispatch(noticeDismissed('storage-write'));
        await move(env, 1);
        vi.advanceTimersByTime(250);
        expect(env.attempts).toHaveLength(2);
        expect(env.store.getState().game.current?.moves).toBe(2);
        expect(env.store.getState().app.notices).toEqual([]);

        env.storage.failWrites = false;
        await move(env, 2);
        vi.advanceTimersByTime(250);
        expect(env.store.getState().persistence.lastError).toBeNull();
        expect(storedMoves(env.storage)).toBe(3);

        env.storage.failWrites = true;
        await move(env, 3);
        vi.advanceTimersByTime(250);
        expect(env.store.getState().persistence.lastError).toBe('write');
        expect(env.store.getState().app.notices).toEqual([{ id: 'storage-write' }]);
    });

    it('counts a skipped identical record as a success after a failed save', () => {
        const env = setup();
        env.store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        vi.advanceTimersByTime(250);
        expect(env.attempts).toHaveLength(1);

        env.storage.failWrites = true;
        env.store.dispatch(preferenceSet({ key: 'theme', value: 'light' }));
        vi.advanceTimersByTime(250);
        expect(env.attempts).toHaveLength(2);
        expect(env.store.getState().persistence.lastError).toBe('write');

        env.store.dispatch(preferenceSet({ key: 'theme', value: 'dark' }));
        vi.advanceTimersByTime(250);
        expect(env.attempts).toHaveLength(2);
        expect(env.store.getState().persistence.lastError).toBeNull();

        env.store.dispatch(preferenceSet({ key: 'theme', value: 'light' }));
        vi.advanceTimersByTime(250);
        expect(env.store.getState().app.notices).toEqual([{ id: 'storage-write' }]);
    });

    it('flush retries a failed save even with nothing new pending', async () => {
        const env = setup();
        env.storage.failWrites = true;
        await move(env, 0);
        vi.advanceTimersByTime(250);
        expect(env.storage.getItem(STORAGE_KEY)).toBeNull();

        env.storage.failWrites = false;
        env.writer.flush();
        expect(storedMoves(env.storage)).toBe(1);
        expect(env.store.getState().persistence.lastError).toBeNull();
    });
});
