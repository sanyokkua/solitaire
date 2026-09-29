import { useId } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentGame } from '../../features/game/gameSlice';
import { useTranslate } from '../../i18n/useTranslate';
import { Icon } from './Icon';

const CHECK = 'm5 12.5 4.5 4.5L19 7';
const DICE =
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4ZM8.5 8.5h.01M15.5 15.5h.01M12 12h.01';

/**
 * The Game top bar's deal chip: "Winnable · <grade>" ("Winnable" when the deal is ungraded) with a check, or "Random
 * deal" with a dice. The icon is decorative. The shuffle count is not part of the chip's text or name: a proven deal
 * that needed more than one shuffle carries "found after N shuffles" as its accessible description (a hidden
 * `.sr-only` element, so it adds no width) and after the chip text in the `title`. The chip is a labelled group so that
 * the text, not the `title`, is its accessible name. At 460 px wide or narrower
 * `layout.css` shows the icon only by hiding the text visually (not removing it), so the text stays the accessible
 * name; the `title` is the hover text. Display only.
 */
export function DealChip() {
    const t = useTranslate();
    const textId = useId();
    const noteId = useId();
    const current = useAppSelector(selectCurrentGame);

    if (current === null) return null;

    const winnable = current.verdict === 'win';
    let text: string;
    if (!winnable) text = t('game.chip.deal.random');
    else if (current.grade !== null) {
        text = t('game.chip.deal.winnableGraded', { grade: t(`grade.${current.grade}`) });
    } else text = t('game.chip.deal.winnable');
    const note = winnable && current.attempts > 1 ? t('game.chip.deal.shuffleNote', { count: current.attempts }) : null;

    return (
        <span
            className={winnable ? 'deal-chip' : 'deal-chip is-random'}
            role="group"
            aria-labelledby={textId}
            title={note === null ? text : `${text} — ${note}`}
            aria-describedby={note === null ? undefined : noteId}
        >
            <Icon path={winnable ? CHECK : DICE} />
            <span id={textId} className="deal-chip__text">
                {text}
            </span>
            {note === null ? null : (
                <span id={noteId} className="sr-only">
                    {note}
                </span>
            )}
        </span>
    );
}
