import { useAppSelector } from '../../app/hooks';
import { selectDealing } from '../../app/selectors';
import { useTranslate } from '../../i18n/useTranslate';

/**
 * The dealing overlay (7.3): once the deal service asks for it (a verified deal still pending after 160 ms) it covers
 * the table inside `.board-panel` with a decorative spinner, "Shuffling a winnable deal…" and the attempt counter, and
 * the previous table stays rendered underneath. It is purely visual: the one polite status in `GameScreen` already
 * announces "Dealing…", and the counter is not a live region, so attempts are not announced one by one.
 */
export function DealingOverlay() {
    const t = useTranslate();
    const dealing = useAppSelector(selectDealing);
    if (dealing?.overlay !== true) {
        return null;
    }
    return (
        <div className="deal-overlay">
            <div className="deal-overlay__box">
                <div className="spinner" aria-hidden="true" />
                <strong>{t('game.dealingOverlay.title')}</strong>
                <span>{t('game.dealingOverlay.attempt', { count: dealing.attempt })}</span>
            </div>
        </div>
    );
}
