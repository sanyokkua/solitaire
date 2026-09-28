import type { PersistenceWriter } from '../features/persistence/persistenceWriter';

/** What a thunk may do to the pending save: write it now, or drop it without writing (D8). */
export interface SavePort {
    flush(): void;
    /** Like `flush`, but a write that fails raises no warning and records no error (the update flow, D7). */
    flushQuietly(): void;
    cancel(): void;
}

/** A save port that forwards to a real writer once connected; does nothing before that. */
export interface ConnectableSavePort extends SavePort {
    /** Connects the port to the writer that now exists; `startApp` calls this once the writer is created. */
    connect(writer: Pick<PersistenceWriter, 'flush' | 'flushQuietly' | 'cancel'>): void;
}

export function createSavePort(): ConnectableSavePort {
    let target: Pick<PersistenceWriter, 'flush' | 'flushQuietly' | 'cancel'> | null = null;
    return {
        flush: () => target?.flush(),
        flushQuietly: () => target?.flushQuietly(),
        cancel: () => target?.cancel(),
        connect: (writer) => {
            target = writer;
        },
    };
}
