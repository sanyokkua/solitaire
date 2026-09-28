/**
 * Storage doubles for the persistence tests: `memoryStorage`, a full in-memory `Storage` with an optional character
 * quota and a `failWrites` switch a test can flip mid-test, and `throwingStorage`, whose every member throws.
 */

/** An in-memory `Storage` whose `failWrites` can be switched at any time. */
export type MemoryStorage = Storage & { failWrites: boolean };

export interface MemoryStorageOptions {
    /** The most characters (keys plus values) the storage may hold; a write beyond it throws `QuotaExceededError`. */
    readonly quota?: number;
    /** Every `setItem` throws `QuotaExceededError` while this is true. */
    readonly failWrites?: boolean;
}

function quotaExceeded(): DOMException {
    return new DOMException('The quota has been exceeded.', 'QuotaExceededError');
}

export function memoryStorage({ quota, failWrites = false }: MemoryStorageOptions = {}): MemoryStorage {
    const items = new Map<string, string>();
    const size = (): number => [...items].reduce((total, [key, value]) => total + key.length + value.length, 0);

    return {
        failWrites,
        get length(): number {
            return items.size;
        },
        key: (index) => [...items.keys()][index] ?? null,
        getItem: (key) => items.get(key) ?? null,
        setItem(key, value) {
            if (this.failWrites) throw quotaExceeded();
            if (quota !== undefined) {
                const replaced = items.has(key) ? key.length + (items.get(key) ?? '').length : 0;
                if (size() - replaced + key.length + value.length > quota) throw quotaExceeded();
            }
            items.set(key, value);
        },
        removeItem: (key) => {
            items.delete(key);
        },
        clear: () => {
            items.clear();
        },
    };
}

/** A `Storage` in which every property access and call throws, as a browser with storage blocked does. */
export function throwingStorage(): Storage {
    const fail = (): never => {
        throw new DOMException('Storage is not available.', 'SecurityError');
    };
    return {
        get length(): number {
            return fail();
        },
        key: fail,
        getItem: fail,
        setItem: fail,
        removeItem: fail,
        clear: fail,
    };
}
