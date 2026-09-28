import { useRef } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { closeSheet } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { BuildStamp } from '../components/BuildStamp';
import { ModalSheet } from './ModalSheet';

const SOURCE_URL = 'https://github.com/sanyokkua/solitaire';
const LICENCE_URL = 'https://github.com/sanyokkua/solitaire/blob/master/LICENSE';

/**
 * About (5.10, D2, SH "About sheet", AS "Build identification"): a static reference sheet, registered in `SheetHost`
 * as `about`. Shows the app name (`t('app.title')`), the running version (`__APP_VERSION__` behind the same
 * `typeof … === 'string'` guard `components/BuildStamp.tsx` uses for `__APP_BUILD_TIMESTAMP__`, falling back to
 * `t('about.versionDev')` under Vitest and any build that does not define it) and the reused `BuildStamp`, then a
 * source-repository link and a licence link (both `rel="noopener noreferrer"`, opening in the same tab — this is a
 * link to read, not a hand-off the player needs a new tab for), whose visible text is also their accessible name
 * ("View source on GitHub", "View the MIT licence"), and a one-line privacy statement. Like `HelpSheet`, this is a
 * reference sheet with nothing to change: the sole action, Close, is both the initial-focus target (I5) and
 * `onDismiss`.
 */
export function AboutSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const closeRef = useRef<HTMLButtonElement>(null);

    function dismiss(): void {
        dispatch(closeSheet());
    }

    const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : t('about.versionDev');

    return (
        <ModalSheet
            heading={t('about.heading')}
            initialFocusRef={closeRef}
            onDismiss={dismiss}
            returnFocusFallback={dismiss}
        >
            <p>{t('app.title')}</p>
            <p>{t('about.version', { value: version })}</p>
            <BuildStamp />
            <p>
                <a href={SOURCE_URL} rel="noopener noreferrer">
                    {t('about.source')}
                </a>
            </p>
            <p>
                <a href={LICENCE_URL} rel="noopener noreferrer">
                    {t('about.licence')}
                </a>
            </p>
            <p>{t('about.privacy')}</p>

            <div className="modal-sheet__actions">
                <button type="button" className="action-button action-button--filled" ref={closeRef} onClick={dismiss}>
                    {t('sheet.close')}
                </button>
            </div>
        </ModalSheet>
    );
}
