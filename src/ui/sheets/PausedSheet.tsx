import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCurrentGame } from '../../features/game/gameSlice';
import { resume } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { DealCode } from '../components/DealCode';
import { formatTime } from '../format';
import { ModalSheet } from './ModalSheet';

/**
 * The Paused sheet (5.7, D6, SH "Paused sheet"): opened by `pause()` (the HUD Time control or P). Shows the frozen
 * time, read the same way `Hud` reads it so it matches exactly (the game and its clock cannot advance while this
 * sheet is open, since `features/game-session`'s clock eligibility already excludes any open sheet), and the deal
 * code with its copy control (`DealCode`, 5.6, D14), reused as-is so its copy/notice/announce behaviour works here
 * for free, including where the Game footer that also renders it is hidden. Resume has initial focus (I5, D2) and
 * dispatches `resume()`; Escape, the backdrop and P (in `useGameShortcuts`) also resume, through the shared
 * `closeSheet()` dismiss path, which resolves to `resume()` for this sheet (SH "Escape and the backdrop close a
 * sheet"). `returnFocusFallback` moves focus to the Game screen's heading: `ModalSheet`'s opener capture already
 * returns focus to a card that was focused when the sheet opened (the board is shown again by the time it runs), so
 * this fallback only fires when nothing was focused, per `ModalSheet`'s own exclusion of `document.body`.
 */
export function PausedSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const current = useAppSelector(selectCurrentGame);
    const resumeRef = useRef<HTMLButtonElement>(null);

    function dismiss(): void {
        dispatch(resume());
    }

    const time = formatTime(Math.floor((current?.elapsedMs ?? 0) / 1000));

    return (
        <ModalSheet
            heading={t('paused.heading')}
            initialFocusRef={resumeRef}
            onDismiss={dismiss}
            returnFocusFallback={() => {
                document.querySelector<HTMLElement>('.screen--game h1')?.focus();
            }}
        >
            <div className="stat-display stat-display--timer">
                <span className="stat-display__label">{t('hud.time')}</span>
                <span className="stat-display__value">{time}</span>
            </div>

            <DealCode />

            <div className="modal-sheet__actions">
                <button type="button" className="action-button action-button--filled" ref={resumeRef} onClick={dismiss}>
                    {t('paused.resume')}
                </button>
            </div>
        </ModalSheet>
    );
}
