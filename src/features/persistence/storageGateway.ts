/** The outcome of a storage call: the value, or the error the browser raised. Storage failures are never thrown. */
export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * The only door to browser storage. It moves strings under caller-supplied keys and knows nothing about what they
 * hold. Every call returns a result: an unavailable, blocked or full storage is `{ ok: false, error }`.
 */
export interface StorageGateway {
    /** The stored string, or `null` when the key is absent. */
    read(key: string): StorageResult<string | null>;
    write(key: string, value: string): StorageResult<void>;
    remove(key: string): StorageResult<void>;
}

/** The browser's local storage, or `null` outside a browser or when reaching it throws (e.g. Safari private mode). */
function defaultStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function attempt<T>(storage: Storage | null, action: (storage: Storage) => T): StorageResult<T> {
    if (storage === null) return { ok: false, error: new Error('Browser storage is unavailable') };
    try {
        return { ok: true, value: action(storage) };
    } catch (error) {
        return { ok: false, error };
    }
}

/** A gateway over `storage`; with no argument it uses the browser's local storage, if there is one. */
export function createStorageGateway(storage: Storage | null = defaultStorage()): StorageGateway {
    return {
        read: (key) => attempt(storage, (target) => target.getItem(key)),
        write: (key, value) =>
            attempt(storage, (target) => {
                target.setItem(key, value);
            }),
        remove: (key) =>
            attempt(storage, (target) => {
                target.removeItem(key);
            }),
    };
}
