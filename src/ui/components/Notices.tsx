import { useEffect, useState } from 'react';
import { noticeDismissed, updateDeferred, type NoticeId } from '../../app/appSlice';
import { useAppDispatch, useAppSelector, useAppStore } from '../../app/hooks';
import { selectNotices } from '../../app/selectors';
import { useTranslate } from '../../i18n/useTranslate';
import type { Translate } from '../../i18n/translate';

/** How long a table message stays before it goes by itself. */
export const NOTICE_MS = 3200;

/**
 * The message key of each notice, looked up at render time so a locale change updates a raised notice in place.
 * `dead-end` and `no-redeals` reuse `formatAnnouncement`'s keys for the same events.
 */
const MESSAGE_KEY: Readonly<Record<NoticeId, string>> = {
    'dead-end': 'announce.deadEnd',
    'no-redeals': 'announce.refused.passLimit',
    'storage-read': 'notice.storageRead',
    'storage-read-only': 'notice.storageReadOnly',
    'storage-write': 'notice.storageWrite',
    'code-copied': 'notice.codeCopied',
    'update-ready': 'notice.updateReady',
};

function noticeText(t: Translate, id: NoticeId): string {
    return t(MESSAGE_KEY[id]);
}

/** Table messages disappear on their own; every other notice stays until the player dismisses or acts on it. */
const TRANSIENT: ReadonlySet<NoticeId> = new Set<NoticeId>(['dead-end', 'no-redeals', 'code-copied']);

/**
 * A table message. Mounting starts the timer and unmounting (by expiry, or because the notice was dismissed some other
 * way) clears it, so a message raised again after it went gets its full time. It has no live region: the announcer
 * already speaks these messages (`dead-end`, `no-redeals`; `code-copied` from the deal-code copy control, D14).
 */
function TransientNotice({ id }: { readonly id: NoticeId }) {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch(noticeDismissed(id));
        }, NOTICE_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [dispatch, id]);

    return <div className="notice">{noticeText(t, id)}</div>;
}

/** A storage notice: its own polite status, kept until the Dismiss button is used. */
function StorageNotice({ id }: { readonly id: NoticeId }) {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    return (
        <div role="status" className="notice notice--storage">
            <span>{noticeText(t, id)}</span>
            <button
                type="button"
                className="notice-dismiss"
                onClick={() => {
                    dispatch(noticeDismissed(id));
                }}
            >
                {t('notice.dismiss')}
            </button>
        </div>
    );
}

/**
 * The update-ready notice (NT "Update-ready notice", D7): its own polite status, kept until Update or Later. Update
 * calls `onUpdate`; Later dismisses it for the session. Its text warns that the current game will not be kept when
 * saving is read-only or the last save failed at the moment the notice appears (it does not change afterwards), since the update flow's own on-demand save cannot be relied on then.
 */
function UpdateReadyNotice({ onUpdate }: { readonly onUpdate: () => void }) {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const store = useAppStore();
    // Decided once, when the notice appears (it mounts only while raised), and fixed from then on.
    const [warn] = useState(() => {
        const { persistence } = store.getState();
        return persistence.readOnly || persistence.lastError === 'write';
    });
    return (
        <div role="status" className="notice notice--storage">
            <span>{t(warn ? 'notice.updateReadyWarning' : 'notice.updateReady')}</span>
            <button type="button" className="notice-dismiss" onClick={onUpdate}>
                {t('notice.update')}
            </button>
            <button
                type="button"
                className="notice-dismiss"
                onClick={() => {
                    dispatch(updateDeferred());
                }}
            >
                {t('notice.later')}
            </button>
        </div>
    );
}

export interface NoticesProps {
    /** Called when the player activates Update on the update-ready notice. */
    readonly onUpdate: () => void;
}

/**
 * The notices host: every raised notice, one message per id, in a fixed region that never takes focus, never blocks
 * the board and never moves the frame (`layout.css` owns the placement and the slide-in). Mounted once by `App`, so
 * every screen sees it (NT "Transient notices").
 */
export function Notices({ onUpdate }: NoticesProps) {
    const notices = useAppSelector(selectNotices);
    return (
        <div className="notices">
            {notices.map(({ id }) => {
                if (id === 'update-ready') return <UpdateReadyNotice key={id} onUpdate={onUpdate} />;
                return TRANSIENT.has(id) ? <TransientNotice key={id} id={id} /> : <StorageNotice key={id} id={id} />;
            })}
        </div>
    );
}
