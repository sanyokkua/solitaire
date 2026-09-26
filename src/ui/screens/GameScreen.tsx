import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setRoute } from '../../app/appSlice';
import { Board } from '../board/Board';
import { BuildStamp } from '../components/BuildStamp';
import { Hud } from '../components/Hud';
import { Toolbar } from '../components/Toolbar';
import { useMediaQuery } from '../useMediaQuery';
import { RAILS_QUERY } from './profiles';

/**
 * The Game screen frame: a visually hidden screen name, the dealing status, then either the stacked profile (top bar,
 * HUD, hint line, table, toolbar, footer) or the side-rails profile (HUD rail with Back, table, toolbar rail). The
 * profile is chosen by CSS, and by `useMediaQuery(RAILS_QUERY)` only to decide where the one Back control lives, so the
 * DOM never holds two. The chip slot, the New-deal slot and the hint line are reserved, empty regions at their final
 * size; `layout.css` owns every size.
 */
export function GameScreen() {
    const dispatch = useAppDispatch();
    const dealing = useAppSelector((state) => state.app.dealing);
    const rails = useMediaQuery(RAILS_QUERY);

    const back = (
        <button
            type="button"
            className="game-back"
            aria-label="Back to Home"
            onClick={() => {
                dispatch(setRoute('home'));
            }}
        >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                    d="m15 5-7 7 7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    );

    return (
        <div className="screen screen--game">
            <h1 className="sr-only">Klondike</h1>
            {/* Always mounted, so screen readers announce the text when it appears. */}
            <p role="status" className="sr-only">
                {dealing !== null && 'Dealing…'}
            </p>
            {!rails && (
                <header className="game-topbar">
                    {back}
                    <div className="game-chips" aria-hidden="true" />
                </header>
            )}
            <main className="game-body">
                <div className="game-hud">
                    {rails && back}
                    <Hud />
                    <div className="game-face" aria-hidden="true" />
                </div>
                <p className="game-hint" aria-hidden="true" />
                <Board />
                <Toolbar />
            </main>
            <div className="game-footer">
                <BuildStamp />
            </div>
        </div>
    );
}
