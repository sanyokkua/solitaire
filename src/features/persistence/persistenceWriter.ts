import { noticeRaised } from '../../app/appSlice';
import type { RootState } from '../../app/store';
import type { GameState } from '../../domain/types';
import { globalTimers, type SubscribableStore } from '../shared/timers';
import { writeFailed, writeSucceeded } from './persistenceSlice';
import { STORAGE_KEY, encodeRecord } from './recordCodec';
import type { StorageGateway } from './storageGateway';

/** How long after the last change a save waits, so a burst of moves is written once. */
const DEBOUNCE_MS = 250;
/** The shortest time between two saves that only differ in `elapsedMs`. */
const CLOCK_INTERVAL_MS = 5000;

/** The store as the writer sees it: structurally, so this module needs no runtime import of the store. */
export type WriterStore = SubscribableStore<RootState>;

/** The timing the writer relies on; tests replace any part. */
export type WriterTimers = Pick<ReturnType<typeof globalTimers>, 'setTimeout' | 'clearTimeout' | 'now'>;

export interface PersistenceWriter {
    /** Saves now if a save is waiting or the last one failed (called when the page is hidden or unloaded). */
    flush(): void;
    /** `flush()` for the update flow: a failed write changes no state and raises no notice, since the caller is about to reload. */
    flushQuietly(): void;
    /** Drops any waiting save and forgets what was last written, so the next change is always written (reset-all). */
    cancel(): void;
    /** `cancel()`, then stops listening to the store. */
    dispose(): void;
}

/** The parts of the state the record is made of; `game.current` is compared separately. */
interface Snapshot {
    readonly preferences: RootState['preferences'];
    readonly stats: RootState['stats'];
    readonly history: RootState['game']['history'];
    readonly future: RootState['game']['future'];
    readonly dailyKey: RootState['game']['dailyKey'];
    readonly counted: RootState['game']['counted'];
    readonly current: GameState | null;
}

function snapshotOf({ preferences, stats, game }: RootState): Snapshot {
    const { history, future, dailyKey, counted, current } = game;
    return { preferences, stats, history, future, dailyKey, counted, current };
}

/** Whether two positions differ in nothing but `elapsedMs`; `accrued` spreads, so unchanged parts keep their reference. */
function onlyElapsedDiffers(before: GameState, after: GameState): boolean {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
        if (key === 'elapsedMs') continue;
        if (before[key as keyof GameState] !== after[key as keyof GameState]) return false;
    }
    return true;
}

type Change = 'none' | 'clock' | 'full';

/** What changed between two snapshots: nothing, only the running clock, or anything else that is saved. */
function changeBetween(before: Snapshot, after: Snapshot): Change {
    if (
        before.preferences !== after.preferences ||
        before.stats !== after.stats ||
        before.history !== after.history ||
        before.future !== after.future ||
        before.dailyKey !== after.dailyKey ||
        before.counted !== after.counted
    ) {
        return 'full';
    }
    if (before.current === after.current) return 'none';
    if (before.current === null || after.current === null) return 'full';
    return onlyElapsedDiffers(before.current, after.current) ? 'clock' : 'full';
}

/**
 * Keeps the device record up to date (D13). It listens to the store and compares, by reference, everything the record
 * holds; `game.busy`, `epoch`, `clock`, `app` and `persistence` are not part of it, so the writer's own dispatches
 * never cause a save.
 *
 * - Any change is written 250 ms after the last one (a burst of moves is one write).
 * - A change that is only `elapsedMs` (the running clock) is written at most every 5 s, and never delays or replaces a
 *   save that is already waiting.
 * - While `persistence.readOnly` is set nothing is scheduled or written, and the flag is checked again at write time.
 * - A record that encodes to the string already written is not written again (and counts as a success if the last save failed).
 * - A failed write dispatches `writeFailed` and raises `storage-write` once; the notice is armed again only after a
 *   write succeeds, so a dismissed notice does not return. The next change (or `flush`) tries again.
 *
 * `flush()` is for leaving the page, `flushQuietly()` for the update flow (a failed write is silent), `cancel()` for reset-all, `dispose()` for tearing the writer down.
 */
export function createPersistenceWriter(
    store: WriterStore,
    gateway: StorageGateway,
    timers: Partial<WriterTimers> = {},
): PersistenceWriter {
    const fallback = globalTimers();
    const { setTimeout, clearTimeout, now } = { ...fallback, ...timers };

    let previous = snapshotOf(store.getState());
    let timer: unknown = null;
    let lastWritten: string | null = null;
    // Saves closer than 5 s to this reading are throttled; starting it at creation spares a resumed game an
    // immediate write that would change nothing.
    let lastAttemptAt = now();
    let lastFailed = false;
    let noticeRaisedSinceSuccess = false;

    function clearPending(): void {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    }

    function schedule(delayMs: number): void {
        timer = setTimeout(() => {
            timer = null;
            write();
        }, delayMs);
    }

    function recordSuccess(): void {
        lastFailed = false;
        noticeRaisedSinceSuccess = false;
        store.dispatch(writeSucceeded());
    }

    function write(quiet = false): void {
        const state = store.getState();
        if (state.persistence.readOnly) return;
        const encoded = encodeRecord({ preferences: state.preferences, stats: state.stats, game: state.game });
        if (encoded === lastWritten) {
            // Storage already holds exactly this record, so an earlier failed save no longer matters: count it as a save.
            if (lastFailed) recordSuccess();
            return;
        }
        lastAttemptAt = now();
        if (gateway.write(STORAGE_KEY, encoded).ok) {
            lastWritten = encoded;
            recordSuccess();
            return;
        }
        if (quiet) return;
        lastFailed = true;
        store.dispatch(writeFailed());
        if (!noticeRaisedSinceSuccess) {
            noticeRaisedSinceSuccess = true;
            store.dispatch(noticeRaised('storage-write'));
        }
    }

    function onChange(): void {
        const next = snapshotOf(store.getState());
        const change = changeBetween(previous, next);
        previous = next;
        if (change === 'none' || store.getState().persistence.readOnly) return;
        if (change === 'full') {
            clearPending();
            schedule(DEBOUNCE_MS);
        } else if (timer === null) {
            schedule(Math.max(0, lastAttemptAt + CLOCK_INTERVAL_MS - now()));
        }
    }

    const unsubscribe = store.subscribe(onChange);

    function cancel(): void {
        clearPending();
        lastWritten = null;
        lastFailed = false;
        noticeRaisedSinceSuccess = false;
    }

    return {
        flush: () => {
            if (timer === null && !lastFailed) return;
            clearPending();
            write();
        },
        flushQuietly: () => {
            if (timer === null && !lastFailed) return;
            clearPending();
            write(true);
        },
        cancel,
        dispose: () => {
            cancel();
            unsubscribe();
        },
    };
}
