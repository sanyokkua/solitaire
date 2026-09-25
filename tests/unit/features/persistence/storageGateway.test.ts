import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorageGateway, type StorageResult } from '../../../../src/features/persistence/storageGateway';
import { memoryStorage, throwingStorage } from '../../../fixtures/storage';

function failed(result: StorageResult<unknown>): boolean {
    return !result.ok && result.error !== undefined;
}

describe('storage gateway over a working storage', () => {
    it('reads back what it wrote, per key', () => {
        const storage = memoryStorage();
        const gateway = createStorageGateway(storage);

        expect(gateway.write('a', '1')).toEqual({ ok: true, value: undefined });
        expect(gateway.write('b', '2')).toEqual({ ok: true, value: undefined });

        expect(gateway.read('a')).toEqual({ ok: true, value: '1' });
        expect(gateway.read('b')).toEqual({ ok: true, value: '2' });
        expect(storage.getItem('a')).toBe('1');
    });

    it('reads a missing key as ok with a null value', () => {
        expect(createStorageGateway(memoryStorage()).read('missing')).toEqual({ ok: true, value: null });
    });

    it('removes one key and leaves the others', () => {
        const gateway = createStorageGateway(memoryStorage());
        gateway.write('a', '1');
        gateway.write('b', '2');

        expect(gateway.remove('a')).toEqual({ ok: true, value: undefined });

        expect(gateway.read('a')).toEqual({ ok: true, value: null });
        expect(gateway.read('b')).toEqual({ ok: true, value: '2' });
    });

    it('overwrites an existing value', () => {
        const gateway = createStorageGateway(memoryStorage());
        gateway.write('a', '1');
        gateway.write('a', '2');

        expect(gateway.read('a')).toEqual({ ok: true, value: '2' });
    });
});

describe('storage gateway failures are results, never exceptions', () => {
    it('fails every call when there is no storage', () => {
        const gateway = createStorageGateway(null);

        expect(failed(gateway.read('a'))).toBe(true);
        expect(failed(gateway.write('a', '1'))).toBe(true);
        expect(failed(gateway.remove('a'))).toBe(true);
    });

    it('fails every call when the storage throws', () => {
        const gateway = createStorageGateway(throwingStorage());

        expect(failed(gateway.read('a'))).toBe(true);
        expect(failed(gateway.write('a', '1'))).toBe(true);
        expect(failed(gateway.remove('a'))).toBe(true);
    });

    it('reports the underlying error', () => {
        const result = createStorageGateway(throwingStorage()).read('a');

        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toBeInstanceOf(DOMException);
    });

    it('reports a quota error on write, and keeps the earlier value', () => {
        const gateway = createStorageGateway(memoryStorage({ quota: 4 }));
        expect(gateway.write('a', '1')).toEqual({ ok: true, value: undefined });

        const result = gateway.write('a', 'far too long');

        expect(result.ok).toBe(false);
        expect(!result.ok && (result.error as DOMException).name).toBe('QuotaExceededError');
        expect(gateway.read('a')).toEqual({ ok: true, value: '1' });
    });

    it('reports failed writes while the switch is on and recovers when it is turned off', () => {
        const storage = memoryStorage({ failWrites: true });
        const gateway = createStorageGateway(storage);

        expect(failed(gateway.write('a', '1'))).toBe(true);

        storage.failWrites = false;

        expect(gateway.write('a', '1')).toEqual({ ok: true, value: undefined });
    });
});

describe('the default storage', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('is unavailable, not thrown, when reading window.localStorage throws', () => {
        vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        const gateway = createStorageGateway();

        expect(failed(gateway.read('a'))).toBe(true);
        expect(failed(gateway.write('a', '1'))).toBe(true);
        expect(failed(gateway.remove('a'))).toBe(true);
    });

    it('is unavailable outside a browser', () => {
        vi.stubGlobal('window', undefined);
        const gateway = createStorageGateway();

        expect(failed(gateway.read('a'))).toBe(true);
        expect(failed(gateway.write('a', '1'))).toBe(true);
        expect(failed(gateway.remove('a'))).toBe(true);
    });
});
