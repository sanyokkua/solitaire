import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setRoute } from '../../app/appSlice';
import { selectDealing } from '../../app/selectors';
import { selectHint } from '../../features/interaction/selectors';
import { hintText } from '../announce';
import { Board } from '../board/Board';
import { useGameShortcuts } from '../board/useGameShortcuts';
import { Announcer } from '../components/Announcer';
import { BuildStamp } from '../components/BuildStamp';
import { Hud } from '../components/Hud';
import { Icon } from '../components/Icon';
import { Notices } from '../components/Notices';
import { Toolbar } from '../components/Toolbar';
import { useMediaQuery } from '../useMediaQuery';
import { RAILS_QUERY } from './profiles';

/**
 * The Game screen frame: a visually hidden screen name, the dealing status, the announcer (the one polite live
 * region for what happens at the table), the notices host (fixed, so it never moves the layout), then either the stacked profile (top bar, HUD, hint line, table, toolbar, footer) or the side-rails profile (HUD rail with Back, table, toolbar rail). The
 * profile is chosen by CSS, and by `useMediaQuery(RAILS_QUERY)` only to decide where the one Back control lives, so the
 * DOM never holds two. The chip slot and the New-deal slot are reserved, empty regions at their final size; the hint line is empty until a
 * hint shows and then reads its text (hidden from assistive technology: the announcer speaks it); `layout.css` owns every size. It also mounts the global keyboard shortcuts (`useGameShortcuts`).
 */
export function GameScreen() {
    const dispatch = useAppDispatch();
    const dealing = useAppSelector(selectDealing);
    const hint = useAppSelector(selectHint);
    const rails = useMediaQuery(RAILS_QUERY);
    useGameShortcuts();

    const back = (
        <button
            type="button"
            className="game-back"
            aria-label="Back to Home"
            onClick={() => {
                dispatch(setRoute('home'));
            }}
        >
            <Icon path="m15 5-7 7 7 7" />
        </button>
    );

    return (
        <div className="screen screen--game">
            <h1 className="sr-only">Klondike</h1>
            {/* Always mounted, so screen readers announce the text when it appears. */}
            <p role="status" className="sr-only">
                {dealing !== null && 'Dealing…'}
            </p>
            <Announcer />
            <Notices />
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
                <p className="game-hint" aria-hidden="true">
                    {hint !== null && hintText(hint)}
                </p>
                <Board />
                <Toolbar />
            </main>
            <div className="game-footer">
                <BuildStamp />
            </div>
        </div>
    );
}
