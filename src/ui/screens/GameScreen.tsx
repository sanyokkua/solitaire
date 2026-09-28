import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectDealing, selectSheet } from '../../app/selectors';
import { goHome } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { Board } from '../board/Board';
import { useGameShortcuts } from '../board/useGameShortcuts';
import { BuildStamp } from '../components/BuildStamp';
import { DealChip } from '../components/DealChip';
import { DealCode } from '../components/DealCode';
import { HintLine } from '../components/HintLine';
import { Hud } from '../components/Hud';
import { Icon } from '../components/Icon';
import { ModeChip } from '../components/ModeChip';
import { NewDealButton } from '../components/NewDealButton';
import { SettingsButton } from '../components/SettingsButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { Toolbar } from '../components/Toolbar';
import { useMediaQuery } from '../useMediaQuery';
import { RAILS_QUERY } from './profiles';

/**
 * The Game screen frame: a visually hidden screen name and the dealing status, then either the stacked profile (top
 * bar, HUD, hint line, table, toolbar, footer) or the side-rails profile (HUD rail with Back, table, toolbar rail).
 * The announcer and the notices host are mounted once by `App`, outside every screen (NT "Transient notices", "One
 * polite announcer"). The profile is chosen by CSS, and by `useMediaQuery(RAILS_QUERY)` only to decide where the one
 * Back control lives, so the DOM never holds two. The chip slot is a reserved region at its final size holding the
 * mode and deal chips (7.1; they truncate inside it and never grow it); after it the stacked top bar has the theme
 * toggle and Settings, and the rails put Settings beside Back in `div.rail-top` and show no theme toggle (D6a). The
 * New-deal slot (`.game-face`) holds the `NewDealButton`, pinned at that same final size; the hint line (`HintLine`, 7.2)
 * describes the tap setting until a hint shows and then reads its text (hidden from assistive technology); `layout.css`
 * owns every size. It also mounts the global keyboard shortcuts (`useGameShortcuts`). The root carries `data-paused`
 * while the Paused sheet is open (5.7, D6): `layout.css`'s `.screen--game[data-paused] .board-panel` rule hides the
 * table with `visibility: hidden`, which also removes it from the accessibility tree, with no animation either way.
 */
export function GameScreen() {
    const dispatch = useAppDispatch();
    const t = useTranslate();
    const dealing = useAppSelector(selectDealing);
    const sheet = useAppSelector(selectSheet);
    const rails = useMediaQuery(RAILS_QUERY);
    useGameShortcuts();

    const back = (
        <button
            type="button"
            className="game-back"
            aria-label={t('game.back')}
            onClick={() => {
                dispatch(goHome());
            }}
        >
            <Icon path="m15 5-7 7 7 7" />
        </button>
    );

    return (
        <div className="screen screen--game" data-paused={sheet === 'paused' || undefined}>
            <h1 className="sr-only" tabIndex={-1}>
                {t('game.heading')}
            </h1>
            {/* Always mounted, so screen readers announce the text when it appears. */}
            <p role="status" className="sr-only">
                {dealing !== null && t('game.dealing')}
            </p>
            {!rails && (
                <header className="game-topbar">
                    {back}
                    <div className="game-chips">
                        <ModeChip />
                        <DealChip />
                    </div>
                    <ThemeToggle />
                    <SettingsButton />
                </header>
            )}
            <main className="game-body">
                <div className="game-hud">
                    {rails && (
                        <div className="rail-top">
                            {back}
                            <SettingsButton />
                        </div>
                    )}
                    <Hud />
                    <NewDealButton />
                </div>
                <HintLine />
                <Board />
                <Toolbar />
            </main>
            <div className="game-footer">
                <DealCode />
                <BuildStamp />
            </div>
        </div>
    );
}
