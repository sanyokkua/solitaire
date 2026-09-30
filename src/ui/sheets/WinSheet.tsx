import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectWinSummary } from '../../features/interaction/selectors';
import { dealNewGame, goHome } from '../../features/game/navigationThunks';
import type { Grade } from '../../domain/types';
import type { MessageKey } from '../../i18n/locales/en';
import { useTranslate } from '../../i18n/useTranslate';
import { formatBank, formatMoves, formatScore, formatTime } from '../format';
import { ModalSheet } from './ModalSheet';

/** The catalog key of the deal-grade line, one full string per grade (word order and gender differ by language). */
const GRADE_TEXT = {
    easy: 'win.grade.easy',
    medium: 'win.grade.medium',
    hard: 'win.grade.hard',
} as const satisfies Record<Grade, MessageKey>;

/**
 * The Win sheet (D4, SH "Win sheet"), registered in `SheetHost` as `win`. Opened by `useWinSheet`, beside `useCascade`
 * in `Board`, 2,400 ms after the win (at once with reduced motion). Reads `selectWinSummary`; renders nothing if it is
 * `null` (a defensive fallback — `useWinSheet` only ever opens this sheet once a summary has been recorded, and it is
 * cleared only when a game is installed or cleared, both of which close this sheet along with every other). Shows
 * the pixel title, a one-line summary that names the Standard time bonus (Vegas has none), a "New best time" badge only on a new best, and Score (Bank in Vegas, formatted as the HUD formats it), Time
 * and Moves tiles. `dismissable={false}`: no close button, and Escape and the backdrop do nothing —
 * `ModalSheet` itself refuses to call `onDismiss` while `dismissable` is `false`, so the passed-in no-op is never
 * reached anyway; `closeSheet()` also guards `win` at the thunk level for `useGameShortcuts`'s Escape handling. Only
 * Menu (`goHome()`) and Deal again (`dealNewGame(mode)`, initial focus, I5) leave it. `returnFocusFallback` covers
 * both destinations Menu and Deal again can leave the sheet on: the Home screen's heading after Menu (SH "Invoker
 * gone"), or the Game screen's heading after Deal again if nothing else is reachable.
 */
export function WinSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const summary = useAppSelector(selectWinSummary);
    const dealAgainRef = useRef<HTMLButtonElement>(null);

    if (summary === null) return null;

    const vegas = summary.mode === 'vegas';
    const time = formatTime(Math.floor(summary.elapsedMs / 1000));

    return (
        <ModalSheet
            heading={t('win.heading')}
            headingClassName="modal-sheet__title--pixel"
            initialFocusRef={dealAgainRef}
            dismissable={false}
            onDismiss={() => undefined}
            returnFocusFallback={() => {
                document.querySelector<HTMLElement>('.screen--home h1, .screen--game h1')?.focus();
            }}
        >
            <div className="outcome-sheet">
                {summary.newBestTime && <span className="best-badge">{t('win.bestTime')}</span>}
                {summary.grade !== null && <p className="outcome-grade">{t(GRADE_TEXT[summary.grade])}</p>}
                <p className="outcome-description">
                    {vegas ? t('win.summary') : t('win.summaryBonus', { bonus: summary.timeBonus })}
                </p>
                <div className="outcome-stats">
                    <div className="outcome-stat">
                        <strong>{vegas ? formatBank(summary.score) : formatScore(summary.score)}</strong>
                        <span>{vegas ? t('hud.bank') : t('hud.score')}</span>
                    </div>
                    <div className="outcome-stat">
                        <strong>{time}</strong>
                        <span>{t('hud.time')}</span>
                    </div>
                    <div className="outcome-stat">
                        <strong>{formatMoves(summary.moves)}</strong>
                        <span>{t('hud.moves')}</span>
                    </div>
                </div>
                <div className="modal-sheet__actions">
                    <button
                        type="button"
                        className="action-button action-button--outline"
                        onClick={() => {
                            dispatch(goHome());
                        }}
                    >
                        {t('win.menu')}
                    </button>
                    <button
                        type="button"
                        className="action-button action-button--filled"
                        ref={dealAgainRef}
                        onClick={() => {
                            void dispatch(dealNewGame(summary.mode));
                        }}
                    >
                        {t('win.dealAgain')}
                    </button>
                </div>
            </div>
        </ModalSheet>
    );
}
