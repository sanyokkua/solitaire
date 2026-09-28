import { createSlice } from '@reduxjs/toolkit';

/**
 * What the shell needs to know about saving (D3, D13). `readOnly` is set when the stored data could not be kept safe
 * (an unreadable record with no free backup, or storage that cannot be read), so the writer never writes.
 * `lastError` is the latest storage problem: a read at start-up or a failed write.
 */
export interface PersistenceState {
    readonly readOnly: boolean;
    readonly lastError: 'read' | 'write' | null;
}

export const initialPersistenceState: PersistenceState = { readOnly: false, lastError: null };

const persistenceSlice = createSlice({
    name: 'persistence',
    initialState: initialPersistenceState,
    reducers: {
        readOnlyEntered: (state) => ({ ...state, readOnly: true }),
        writeFailed: (state) => ({ ...state, lastError: 'write' }),
        /** A later write worked: only a write error clears; a start-up read error stays. */
        writeSucceeded: (state) => (state.lastError === 'write' ? { ...state, lastError: null } : state),
        /** Reset-all: the stored data is gone, so saving is possible again and no storage problem is outstanding. */
        persistenceReset: () => initialPersistenceState,
    },
});

export const { readOnlyEntered, writeFailed, writeSucceeded, persistenceReset } = persistenceSlice.actions;
export const persistenceReducer = persistenceSlice.reducer;
