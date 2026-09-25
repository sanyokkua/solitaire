import type { NoticeId } from '../../app/appSlice';
import type { RootState } from '../../app/store';
import { initialGameState } from '../game/gameSlice';
import { resolveLocale } from '../preferences/locale';
import { defaultPreferences } from '../preferences/preferencesSlice';
import { BACKUP_KEY, STORAGE_KEY, decodeRecord } from './recordCodec';
import type { PersistenceState } from './persistenceSlice';
import type { StorageGateway } from './storageGateway';

/** What the loader hands the store setup: the state to start from and the notices to raise. */
export interface LoadedState {
    /** The slices to start the store with; the rest start at their own defaults. */
    readonly preloadedState: Partial<RootState>;
    /** The notices to raise after the store is created, in order. Never both `storage-read` and `storage-read-only`. */
    readonly notices: NoticeId[];
}

/** The unreadable record is safe: the backup key is free or already holds this exact string (written when free). */
function backedUp(gateway: StorageGateway, raw: string): boolean {
    const existing = gateway.read(BACKUP_KEY);
    if (!existing.ok) return false;
    if (existing.value === raw) return true;
    if (existing.value !== null) return false;
    return gateway.write(BACKUP_KEY, raw).ok;
}

/** The start-up state after a failed read; read-only stops the writer, otherwise saving proceeds normally. */
function withReadError(preferences: RootState['preferences'], readOnly: boolean): LoadedState {
    const persistence: PersistenceState = { readOnly, lastError: 'read' };
    return {
        preloadedState: { preferences, persistence },
        notices: [readOnly ? 'storage-read-only' : 'storage-read'],
    };
}

/**
 * Reads the device record before the store exists (D3 and D13), so the first render already shows Continue. It returns
 * the `preloadedState` fragment and the storage notices to raise once the store is up; it never throws and never
 * touches the main record. The only write it may make is one copy of an unreadable record to `BACKUP_KEY`.
 *
 * - No record: defaults, no notice. Language defaults come from `languages`.
 * - A valid record: its preferences, statistics and, if it holds one, the resumable game. `app` is not preloaded, so
 *   the route stays `home`.
 * - A `malformed`, `invalid` or `future` record: defaults, and the raw string is kept in `BACKUP_KEY` first. If that
 *   key is empty or already holds the identical string the copy counts as made (`storage-read`); if it holds a
 *   different string, cannot be read or written, saving is switched off (`readOnly`, `storage-read-only`), so nothing
 *   readable is ever overwritten.
 * - Storage that cannot be read at all: what is stored is unknown, so it must not be overwritten; defaults and
 *   `readOnly` as above.
 */
export function loadInitialState(gateway: StorageGateway, languages: readonly string[]): LoadedState {
    const preferences = defaultPreferences(resolveLocale(languages));
    const stored = gateway.read(STORAGE_KEY);
    if (!stored.ok) return withReadError(preferences, true);

    if (stored.value === null) return { preloadedState: { preferences }, notices: [] };

    const decoded = decodeRecord(stored.value);
    if (decoded.ok) {
        const { record } = decoded;
        const { session } = record;
        return {
            preloadedState: {
                preferences: record.preferences,
                stats: record.stats,
                ...(session === null
                    ? {}
                    : {
                          game: {
                              ...initialGameState,
                              current: session.current,
                              history: session.history,
                              future: session.future,
                              dailyKey: session.dailyKey,
                              counted: session.counted,
                          },
                      }),
            },
            notices: [],
        };
    }
    return withReadError(preferences, !backedUp(gateway, stored.value));
}
