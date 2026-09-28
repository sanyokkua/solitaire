import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { Mode } from '../../domain/types';
import { closeSheet } from '../../features/game/navigationThunks';
import { resetStatistics } from '../../features/persistence/resetThunks';
import { selectDailyStreak, selectWinRate, type ModeStats, type StatsState } from '../../features/stats/statsSlice';
import { useTranslate } from '../../i18n/useTranslate';
import { useToday } from '../useToday';
import { ConfirmAction } from '../components/ConfirmAction';
import { formatBank, formatTime } from '../format';
import { ModalSheet } from './ModalSheet';

const MODES: readonly Mode[] = ['draw1', 'draw3', 'vegas', 'daily'];

/** Shown for a record that does not exist yet (SH "Statistics sheet"). */
const MISSING = '—';

interface Row {
    readonly labelKey:
        | 'stats.row.played'
        | 'stats.row.won'
        | 'stats.row.winRate'
        | 'stats.row.bestTime'
        | 'stats.row.bestScore'
        | 'stats.row.bestStreak';
    readonly format: (stats: ModeStats, mode: Mode, root: { readonly stats: StatsState }) => string;
}

const ROWS: readonly Row[] = [
    { labelKey: 'stats.row.played', format: (stats) => String(stats.played) },
    { labelKey: 'stats.row.won', format: (stats) => String(stats.won) },
    {
        labelKey: 'stats.row.winRate',
        format: (stats, mode, root) =>
            stats.played === 0 ? MISSING : `${String(Math.round(selectWinRate(root, mode) * 100))}%`,
    },
    {
        labelKey: 'stats.row.bestTime',
        format: (stats) => (stats.bestTimeMs === null ? MISSING : formatTime(Math.floor(stats.bestTimeMs / 1000))),
    },
    {
        labelKey: 'stats.row.bestScore',
        format: (stats, mode) =>
            stats.bestScore === null
                ? MISSING
                : mode === 'vegas'
                  ? formatBank(stats.bestScore)
                  : String(stats.bestScore),
    },
    {
        labelKey: 'stats.row.bestStreak',
        format: (stats) => (stats.bestStreak === 0 ? MISSING : String(stats.bestStreak)),
    },
];

/**
 * Statistics (5.4, D2, D8, D13): a `.stats-table` with one column per mode (Draw 1, Draw 3, Vegas, Daily) and rows
 * Played, Won, Win rate, Best time, Best score (Vegas shown as money through `formatBank`) and Best streak, mirroring
 * the mockup's `#sheet-stats` (SH "Statistics sheet"). A missing record shows "—". Below the table, the Daily
 * date-streak line combines the current streak (`selectDailyStreak`, read against `useToday()`'s injected-clock day
 * key) with the best streak kept in `state.stats.daily` — a separate concept from the Daily mode column's own Best
 * streak. Reset goes through `ConfirmAction` into `resetStatistics()`, same as Settings' Data group (5.2). Unlike
 * Help's single "Got it", this sheet has its own explicit Close action alongside Reset, so initial focus (I5) lands
 * on Close rather than on the destructive control; `ConfirmAction` already returns focus to Reset after Confirm or
 * Cancel.
 */
export function StatsSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const statsState = useAppSelector((state) => state.stats);
    const { modes } = statsState;
    const dailyBestStreak = useAppSelector((state) => state.stats.daily.bestStreak);
    const today = useToday();
    const dailyStreak = useAppSelector((state) => selectDailyStreak(state, today));
    const closeRef = useRef<HTMLButtonElement>(null);

    function dismiss(): void {
        dispatch(closeSheet());
    }

    return (
        <ModalSheet
            heading={t('stats.heading')}
            initialFocusRef={closeRef}
            onDismiss={dismiss}
            returnFocusFallback={dismiss}
            wide
        >
            <div className="scroll-x">
                <table className="stats-table">
                    <thead>
                        <tr>
                            <th scope="col" />
                            {MODES.map((mode) => (
                                <th scope="col" key={mode}>
                                    {t(`stats.mode.${mode}`)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS.map((row) => (
                            <tr key={row.labelKey}>
                                <th scope="row">{t(row.labelKey)}</th>
                                {MODES.map((mode) => (
                                    <td key={mode}>{row.format(modes[mode], mode, { stats: statsState })}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p>{t('stats.dailyStreak', { current: dailyStreak, best: dailyBestStreak })}</p>
            <p className="stats-note">{t('stats.note')}</p>

            <div className="modal-sheet__actions">
                <ConfirmAction
                    label={t('settings.resetStats.label')}
                    confirmLabel={t('confirmAction.confirm')}
                    cancelLabel={t('confirmAction.cancel')}
                    onConfirm={() => {
                        dispatch(resetStatistics());
                    }}
                />
                <button type="button" className="action-button action-button--filled" ref={closeRef} onClick={dismiss}>
                    {t('sheet.close')}
                </button>
            </div>
        </ModalSheet>
    );
}
