import { useEffect } from 'react';
import { noticeDismissed, type NoticeId } from '../../app/appSlice';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectNotices } from '../../app/selectors';
import { formatAnnouncement } from '../announce';

/** How long a table message stays before it goes by itself. */
export const NOTICE_MS = 3200;

/** The words of each notice, in English until the catalogs arrive. */
const TEXT: Readonly<Record<NoticeId, string>> = {
    'dead-end': formatAnnouncement({ type: 'deadEnd' }),
    'no-redeals': formatAnnouncement({ type: 'refused', reason: 'pass-limit' }),
    'storage-read': 'Saved data could not be read. A fresh start was made and the old data was kept as a backup.',
    'storage-read-only': 'Saved data could not be read or backed up, so this session will not save your progress.',
    'storage-write': 'Your progress could not be saved.',
};

/** Table messages disappear on their own; storage notices stay until the player dismisses them. */
const TRANSIENT: ReadonlySet<NoticeId> = new Set<NoticeId>(['dead-end', 'no-redeals']);

/**
 * A table message. Mounting starts the timer and unmounting (by expiry, or because the notice was dismissed some other
 * way) clears it, so a message raised again after it went gets its full time. It has no live region: the announcer
 * already speaks these two messages.
 */
function TransientNotice({ id }: { readonly id: NoticeId }) {
    const dispatch = useAppDispatch();
    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch(noticeDismissed(id));
        }, NOTICE_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [dispatch, id]);

    return <div className="notice">{TEXT[id]}</div>;
}

/** A storage notice: its own polite status, kept until the Dismiss button is used. */
function StorageNotice({ id }: { readonly id: NoticeId }) {
    const dispatch = useAppDispatch();
    return (
        <div role="status" className="notice notice--storage">
            <span>{TEXT[id]}</span>
            <button
                type="button"
                className="notice-dismiss"
                onClick={() => {
                    dispatch(noticeDismissed(id));
                }}
            >
                Dismiss
            </button>
        </div>
    );
}

/**
 * The transient notices host: every raised notice, one message per id, in a fixed region that never takes focus, never
 * blocks the board and never moves the frame (`layout.css` owns the placement and the slide-in).
 */
export function Notices() {
    const notices = useAppSelector(selectNotices);
    return (
        <div className="notices">
            {notices.map(({ id }) =>
                TRANSIENT.has(id) ? <TransientNotice key={id} id={id} /> : <StorageNotice key={id} id={id} />,
            )}
        </div>
    );
}
