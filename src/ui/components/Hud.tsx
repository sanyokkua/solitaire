import { useAppSelector } from '../../app/hooks';
import { selectDisplayedScore } from '../../features/game/gameSlice';
import { formatBank, formatMoves, formatScore, formatTime } from '../format';

interface StatProps {
    readonly kind: 'score' | 'moves' | 'timer';
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
 * The read-only HUD: Score (Bank in Vegas) and Moves in one group, then Time. It returns a fragment so the Game
 * screen owns the frame that arranges the pieces.
 */
export function Hud() {
    const current = useAppSelector((state) => state.game.current);
    const displayedScore = useAppSelector(selectDisplayedScore);

    if (current === null) return null;

    const vegas = current.scoring === 'vegas';
    return (
        <>
            <div className="hud-group">
                <Stat
                    kind="score"
                    label={vegas ? 'Bank' : 'Score'}
                    value={vegas ? formatBank(displayedScore) : formatScore(displayedScore)}
                />
                <Stat kind="moves" label="Moves" value={formatMoves(current.moves)} />
            </div>
            <Stat kind="timer" label="Time" value={formatTime(Math.floor(current.elapsedMs / 1000))} />
        </>
    );
}
