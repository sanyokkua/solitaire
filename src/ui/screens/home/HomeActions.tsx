import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectResumable } from '../../../features/game/gameSlice';
import { dealNewGame, openSheet } from '../../../features/game/navigationThunks';
import { continueGame } from '../../../features/game/sessionThunks';
import { selectPreference } from '../../../features/preferences/preferencesSlice';
import { useTranslate } from '../../../i18n/useTranslate';

/**
 * Home's action row (mockup `.cta-row`, HO "Home actions", AS "Continue game on Home"): Deal cards starts the selected
 * mode, Continue game (only while a game can be resumed) shows Game with the saved game as it was, How to play opens
 * its sheet. On phones and short screens `home.css` pins the row to the bottom of the viewport.
 */
export function HomeActions() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const selectedMode = useAppSelector((state) => selectPreference(state, 'selectedMode'));
    const resumable = useAppSelector(selectResumable);

    return (
        <div className="cta-row">
            <button
                type="button"
                className="action-button action-button--filled action-button--deal"
                onClick={() => {
                    void dispatch(dealNewGame(selectedMode));
                }}
            >
                {t('home.deal')}
            </button>
            {resumable && (
                <button
                    type="button"
                    className="action-button action-button--tonal"
                    onClick={() => {
                        dispatch(continueGame());
                    }}
                >
                    {t('home.continue')}
                </button>
            )}
            <button
                type="button"
                className="action-button action-button--outline"
                onClick={() => {
                    dispatch(openSheet('help'));
                }}
            >
                {t('home.actions.help')}
            </button>
        </div>
    );
}
