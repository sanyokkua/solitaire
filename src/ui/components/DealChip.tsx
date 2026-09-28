import { useAppSelector } from '../../app/hooks';
import { selectCurrentGame } from '../../features/game/gameSlice';
import { useTranslate } from '../../i18n/useTranslate';
import { Icon } from './Icon';

const CHECK = 'm5 12.5 4.5 4.5L19 7';
const DICE =
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4ZM8.5 8.5h.01M15.5 15.5h.01M12 12h.01';

/**
 * The Game top bar's deal chip: "Winnable" with a check, adding "· N shuffles" (plural-correct) when more than one
 * shuffle was needed, or "Random deal" with a dice. The icon is decorative. At 460 px wide or narrower `layout.css`
 * shows the icon only by hiding the text visually (not removing it), so the text stays the accessible name; the same
 * text is the `title`. Display only.
 */
export function DealChip() {
    const t = useTranslate();
    const current = useAppSelector(selectCurrentGame);

    if (current === null) return null;

    const winnable = current.verdict === 'win';
    let text: string;
    if (!winnable) text = t('game.chip.deal.random');
    else if (current.attempts > 1) text = t('game.chip.deal.winnableShuffles', { count: current.attempts });
    else text = t('game.chip.deal.winnable');

    return (
        <span className={winnable ? 'deal-chip' : 'deal-chip is-random'} title={text}>
            <Icon path={winnable ? CHECK : DICE} />
            <span className="deal-chip__text">{text}</span>
        </span>
    );
}
