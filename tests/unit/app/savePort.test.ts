import { describe, expect, it, vi } from 'vitest';
import { createSavePort } from '../../../src/app/savePort';

describe('createSavePort', () => {
    it('does nothing before connect', () => {
        const port = createSavePort();

        expect(() => {
            port.flush();
            port.cancel();
        }).not.toThrow();
    });

    it('forwards flush and cancel to the connected writer', () => {
        const writer = { flush: vi.fn(), flushQuietly: vi.fn(), cancel: vi.fn() };
        const port = createSavePort();

        port.connect(writer);
        port.flush();
        port.cancel();

        expect(writer.flush).toHaveBeenCalledTimes(1);
        expect(writer.cancel).toHaveBeenCalledTimes(1);
    });

    it('forwards flushQuietly to the connected writer', () => {
        const writer = { flush: vi.fn(), flushQuietly: vi.fn(), cancel: vi.fn() };
        const port = createSavePort();
        port.flushQuietly();
        port.connect(writer);
        port.flushQuietly();

        expect(writer.flushQuietly).toHaveBeenCalledTimes(1);
        expect(writer.flush).not.toHaveBeenCalled();
    });

    it('forwards to the latest connected writer only', () => {
        const first = { flush: vi.fn(), flushQuietly: vi.fn(), cancel: vi.fn() };
        const second = { flush: vi.fn(), flushQuietly: vi.fn(), cancel: vi.fn() };
        const port = createSavePort();

        port.connect(first);
        port.connect(second);
        port.flush();

        expect(first.flush).not.toHaveBeenCalled();
        expect(second.flush).toHaveBeenCalledTimes(1);
    });
});
