import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCurrentGame, selectDisplayedScore, selectGameControlsIdle } from '../../features/game/gameSlice';
import { pause } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { formatBank, formatMoves, formatScore, formatTime } from '../format';

interface StatProps {
    readonly kind: 'score' | 'moves';
    readonly label: string;
    readonly value: string;
}

function Stat({ kind, label, value }: StatProps) {
    return (
        <div className={`stat-display stat-display--${kind}`}>
            <span className="stat-display__label">{label}</span>
            <span className="stat-display__value">{value}</span>
        </div>
    );
}

/**
 * The read-only HUD: Score (Bank in Vegas) and Moves in one group, then Time. Score, Bank and Moves stay plain text
 * (GM "HUD values and the Time control"); Time is a button that pauses the game (`navigationThunks.pause`, D6) on
 * click or Enter/Space, its accessible name including the frozen-in-place value and the pause action
 * (`hud.timeButton`). It is disabled, keeping that name, on a won game or whenever `selectGameControlsIdle` is false
 * (a safe-card chain or Finish running, or a deal being prepared) — exactly when `pause()` would refuse. It returns a
 * fragment so the Game screen owns the frame that arranges the pieces.
 */
export function Hud() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const current = useAppSelector(selectCurrentGame);
    const displayedScore = useAppSelector(selectDisplayedScore);
    const idle = useAppSelector(selectGameControlsIdle);

    if (current === null) return null;

    const vegas = current.scoring === 'vegas';
    const time = formatTime(Math.floor(current.elapsedMs / 1000));
    const disabled = !idle || current.status === 'won';

    return (
        <>
            <div className="hud-group">
                <Stat
                    kind="score"
                    label={vegas ? t('hud.bank') : t('hud.score')}
                    value={vegas ? formatBank(displayedScore) : formatScore(displayedScore)}
                />
                <Stat kind="moves" label={t('hud.moves')} value={formatMoves(current.moves)} />
            </div>
            <button
                type="button"
                className="stat-display stat-display--timer"
                aria-label={t('hud.timeButton', { time })}
                disabled={disabled}
                onClick={() => {
                    dispatch(pause());
                }}
            >
                <span className="stat-display__label" aria-hidden="true">
                    {t('hud.time')}
                </span>
                <span className="stat-display__value" aria-hidden="true">
                    {time}
                </span>
            </button>
        </>
    );
}
