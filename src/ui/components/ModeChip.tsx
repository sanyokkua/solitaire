import { useAppSelector } from '../../app/hooks';
import { selectCurrentGame } from '../../features/game/gameSlice';
import { formatDate } from '../../i18n/translate';
import { useTranslate } from '../../i18n/useTranslate';

/**
 * The Game top bar's mode chip: "Draw 1 · Standard", "Draw 3 · Standard", "Vegas", or "Daily · <date>" where the date
 * is the game's own Daily key (the UTC day the deal was selected for, formatted as Home's Daily tile does), never
 * today's; a Daily game without a key (started from a `D-…` code) reads plain "Daily". The text is stored and named in
 * normal case; `layout.css` capitalises it. It is display only, and its full text is also its `title` because it can
 * truncate with an ellipsis.
 */
export function ModeChip() {
    const t = useTranslate();
    const current = useAppSelector(selectCurrentGame);
    const dailyKey = useAppSelector((state) => state.game.dailyKey);
    const locale = useAppSelector((state) => state.preferences.locale);

    if (current === null) return null;

    let text: string;
    if (current.mode === 'daily') {
        text =
            dailyKey === null
                ? t('game.chip.mode.daily')
                : t('game.chip.mode.dailyOn', {
                      date: formatDate(locale, new Date(`${dailyKey}T00:00:00Z`), { month: 'short' }),
                  });
    } else {
        text = t(`game.chip.mode.${current.mode}`);
    }

    return (
        <span className="mode-chip" title={text}>
            {text}
        </span>
    );
}
