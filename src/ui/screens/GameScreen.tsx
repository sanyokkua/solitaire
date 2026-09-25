import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setRoute } from '../../app/appSlice';
import { selectDisplayedScore } from '../../features/game/gameSlice';

export function GameScreen() {
    const dispatch = useAppDispatch();
    const current = useAppSelector((state) => state.game.current);
    const score = useAppSelector(selectDisplayedScore);
    const dealing = useAppSelector((state) => state.app.dealing);

    return (
        <div className="screen screen--game">
            <h1>Klondike</h1>
            {current !== null && (
                <p>
                    Mode: {current.mode} · Moves: {current.moves} · Score: {score}
                </p>
            )}
            {/* Always mounted, so screen readers announce the text when it appears. */}
            <p role="status">{dealing !== null && 'Dealing…'}</p>
            <button type="button" onClick={() => dispatch(setRoute('home'))}>
                Back to Home
            </button>
        </div>
    );
}
