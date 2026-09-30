import { useAppSelector } from '../../../app/hooks';
import { selectOverallStats } from '../../../features/stats/statsSlice';
import { useTranslate } from '../../../i18n/useTranslate';

const pad = (value: number) => String(value).padStart(3, '0');

/**
 * Home's LCD record strip (`.stat-strip`): played and won as three digits, the rounded
 * win rate (or `--` before any game) and the largest current streak, followed by `/best` once a best streak exists.
 * The colours and cell layout come from the shared `.stat-strip` rules in `controls.css`.
 */
export function RecordStrip() {
    const t = useTranslate();
    const { played, won, winRate, streak, bestStreak } = useAppSelector(selectOverallStats);
    const cells = [
        ['home.record.played', pad(played)],
        ['home.record.won', pad(won)],
        ['home.record.winRate', winRate === null ? '--' : `${String(winRate)}%`],
        ['home.record.streak', bestStreak > 0 ? `${String(streak)}/${String(bestStreak)}` : String(streak)],
    ] as const;

    return (
        <div className="stat-strip" role="group" aria-label={t('home.record.label')}>
            {cells.map(([key, value]) => (
                <div className="stat-strip__cell" key={key}>
                    <span>{t(key)}</span>
                    <b>{value}</b>
                </div>
            ))}
        </div>
    );
}
