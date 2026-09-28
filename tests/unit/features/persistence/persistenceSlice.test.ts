import { describe, expect, it } from 'vitest';
import {
    initialPersistenceState,
    persistenceReducer,
    persistenceReset,
    readOnlyEntered,
    writeFailed,
    writeSucceeded,
    type PersistenceState,
} from '../../../../src/features/persistence/persistenceSlice';

describe('persistence slice', () => {
    it('starts writable with no error', () => {
        expect(persistenceReducer(undefined, { type: '@@init' })).toEqual({ readOnly: false, lastError: null });
        expect(initialPersistenceState).toEqual({ readOnly: false, lastError: null });
    });

    it('enters read-only and keeps the last error', () => {
        const state: PersistenceState = { readOnly: false, lastError: 'read' };

        expect(persistenceReducer(state, readOnlyEntered())).toEqual({ readOnly: true, lastError: 'read' });
        expect(persistenceReducer(initialPersistenceState, readOnlyEntered())).toEqual({
            readOnly: true,
            lastError: null,
        });
    });

    it('records a failed write', () => {
        expect(persistenceReducer(initialPersistenceState, writeFailed())).toEqual({
            readOnly: false,
            lastError: 'write',
        });
    });

    it('clears a write error when a later write succeeds', () => {
        const failed = persistenceReducer({ readOnly: false, lastError: null }, writeFailed());

        expect(persistenceReducer(failed, writeSucceeded())).toEqual({ readOnly: false, lastError: null });
    });

    it('keeps a read error when a write succeeds', () => {
        const state: PersistenceState = { readOnly: false, lastError: 'read' };

        expect(persistenceReducer(state, writeSucceeded())).toEqual({ readOnly: false, lastError: 'read' });
    });

    it('does not leave read-only when a write succeeds', () => {
        const state: PersistenceState = { readOnly: true, lastError: 'write' };

        expect(persistenceReducer(state, writeSucceeded())).toEqual({ readOnly: true, lastError: null });
    });

    it('resets to writable with no error', () => {
        expect(persistenceReducer({ readOnly: true, lastError: 'read' }, persistenceReset())).toEqual(
            initialPersistenceState,
        );
        expect(persistenceReducer({ readOnly: false, lastError: 'write' }, persistenceReset())).toEqual(
            initialPersistenceState,
        );
    });
});
