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

/**
 * A version 1 record exactly as the version 1 encoder wrote it (twelve preferences, no `difficulty`): non-default
 * preferences, non-zero statistics with Daily completions, and a started Draw 1 game from the winning-line deal with
 * three undo steps, one redo step, `counted: true` and one undo charge. It is pinned as a string so the upgrade is
 * tested against real old data, not against the current encoder.
 */
export const V1_RECORD =
    '{"version":1,"preferences":{"theme":"dark","nightCards":true,"fourColor":true,"cardBack":"coral","tapMode":"select","highlight":false,"autoSafe":true,"stockRight":true,"animations":false,"locale":"uk","winnableOnly":false,"selectedMode":"draw3"},"stats":{"modes":{"draw1":{"played":12,"won":5,"streak":2,"bestStreak":3,"bestTimeMs":91500,"bestScore":745},"draw3":{"played":4,"won":1,"streak":0,"bestStreak":1,"bestTimeMs":150000,"bestScore":320},"vegas":{"played":3,"won":1,"streak":1,"bestStreak":1,"bestTimeMs":120000,"bestScore":-27.5},"daily":{"played":2,"won":2,"streak":2,"bestStreak":2,"bestTimeMs":200000,"bestScore":500}},"daily":{"completed":["2026-01-30","2026-01-31","2026-02-01"],"bestStreak":3}},"session":{"current":{"seed":49,"mode":"draw1","draw":1,"scoring":"standard","verdict":"random","attempts":1,"tableau":[[{"id":1,"up":true}],[{"id":36,"up":false},{"id":25,"up":true}],[{"id":45,"up":false},{"id":39,"up":false},{"id":43,"up":true},{"id":3,"up":true}],[{"id":21,"up":false},{"id":2,"up":false},{"id":12,"up":true}],[{"id":40,"up":false},{"id":42,"up":false},{"id":26,"up":false},{"id":17,"up":false},{"id":32,"up":true}],[{"id":47,"up":false},{"id":18,"up":false},{"id":4,"up":false},{"id":48,"up":false},{"id":6,"up":false},{"id":34,"up":true}],[{"id":16,"up":false},{"id":33,"up":false},{"id":11,"up":false},{"id":44,"up":false},{"id":8,"up":false},{"id":23,"up":false},{"id":15,"up":true}]],"stock":[50,35,29,20,41,10,14,37,31,13,46,22,27,28,7,0,49,51,9,24,5,38],"waste":[19,30],"foundations":[[],[],[],[]],"score":5,"moves":3,"passes":1,"elapsedMs":2800,"undos":1,"started":true,"status":"playing"},"history":[{"tableau":[[{"id":1,"up":true}],[{"id":36,"up":false},{"id":25,"up":true}],[{"id":45,"up":false},{"id":39,"up":false},{"id":43,"up":true}],[{"id":21,"up":false},{"id":2,"up":false},{"id":12,"up":false},{"id":3,"up":true}],[{"id":40,"up":false},{"id":42,"up":false},{"id":26,"up":false},{"id":17,"up":false},{"id":32,"up":true}],[{"id":47,"up":false},{"id":18,"up":false},{"id":4,"up":false},{"id":48,"up":false},{"id":6,"up":false},{"id":34,"up":true}],[{"id":16,"up":false},{"id":33,"up":false},{"id":11,"up":false},{"id":44,"up":false},{"id":8,"up":false},{"id":23,"up":false},{"id":15,"up":true}]],"stock":[50,35,29,20,41,10,14,37,31,13,46,22,27,28,7,0,49,51,9,24,5,38,30,19],"waste":[],"foundations":[[],[],[],[]],"score":0,"moves":0,"passes":1,"elapsedMs":0,"undos":0,"started":false},{"tableau":[[{"id":1,"up":true}],[{"id":36,"up":false},{"id":25,"up":true}],[{"id":45,"up":false},{"id":39,"up":false},{"id":43,"up":true},{"id":3,"up":true}],[{"id":21,"up":false},{"id":2,"up":false},{"id":12,"up":true}],[{"id":40,"up":false},{"id":42,"up":false},{"id":26,"up":false},{"id":17,"up":false},{"id":32,"up":true}],[{"id":47,"up":false},{"id":18,"up":false},{"id":4,"up":false},{"id":48,"up":false},{"id":6,"up":false},{"id":34,"up":true}],[{"id":16,"up":false},{"id":33,"up":false},{"id":11,"up":false},{"id":44,"up":false},{"id":8,"up":false},{"id":23,"up":false},{"id":15,"up":true}]],"stock":[50,35,29,20,41,10,14,37,31,13,46,22,27,28,7,0,49,51,9,24,5,38,30,19],"waste":[],"foundations":[[],[],[],[]],"score":5,"moves":1,"passes":1,"elapsedMs":700,"undos":0,"started":true},{"tableau":[[{"id":1,"up":true}],[{"id":36,"up":false},{"id":25,"up":true}],[{"id":45,"up":false},{"id":39,"up":false},{"id":43,"up":true},{"id":3,"up":true}],[{"id":21,"up":false},{"id":2,"up":false},{"id":12,"up":true}],[{"id":40,"up":false},{"id":42,"up":false},{"id":26,"up":false},{"id":17,"up":false},{"id":32,"up":true}],[{"id":47,"up":false},{"id":18,"up":false},{"id":4,"up":false},{"id":48,"up":false},{"id":6,"up":false},{"id":34,"up":true}],[{"id":16,"up":false},{"id":33,"up":false},{"id":11,"up":false},{"id":44,"up":false},{"id":8,"up":false},{"id":23,"up":false},{"id":15,"up":true}]],"stock":[50,35,29,20,41,10,14,37,31,13,46,22,27,28,7,0,49,51,9,24,5,38,30],"waste":[19],"foundations":[[],[],[],[]],"score":5,"moves":2,"passes":1,"elapsedMs":1400,"undos":0,"started":true}],"future":[{"tableau":[[{"id":1,"up":true}],[{"id":36,"up":false},{"id":25,"up":true}],[{"id":45,"up":false},{"id":39,"up":false},{"id":43,"up":true},{"id":3,"up":true}],[{"id":21,"up":false},{"id":2,"up":false},{"id":12,"up":true}],[{"id":40,"up":false},{"id":42,"up":false},{"id":26,"up":false},{"id":17,"up":false},{"id":32,"up":true}],[{"id":47,"up":false},{"id":18,"up":false},{"id":4,"up":false},{"id":48,"up":false},{"id":6,"up":false},{"id":34,"up":true}],[{"id":16,"up":false},{"id":33,"up":false},{"id":11,"up":false},{"id":44,"up":false},{"id":8,"up":false},{"id":23,"up":false},{"id":15,"up":true}]],"stock":[50,35,29,20,41,10,14,37,31,13,46,22,27,28,7,0,49,51,9,24,5],"waste":[19,30,38],"foundations":[[],[],[],[]],"score":5,"moves":4,"passes":1,"elapsedMs":2800,"undos":0,"started":true}],"dailyKey":null,"counted":true}}';
