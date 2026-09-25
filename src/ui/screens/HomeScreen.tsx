import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setRoute } from '../../app/appSlice';
import { continueGame, startGame } from '../../features/game/gameThunks';
import { selectResumable } from '../../features/game/gameSlice';
import { selectPreference } from '../../features/preferences/preferencesSlice';

export function HomeScreen() {
    const dispatch = useAppDispatch();
    const selectedMode = useAppSelector((state) => selectPreference(state, 'selectedMode'));
    const resumable = useAppSelector(selectResumable);

    return (
        <div className="screen screen--home">
            <h1>Solitaire</h1>
            <button
                type="button"
                onClick={() => {
                    void dispatch(startGame({ mode: selectedMode }));
                    dispatch(setRoute('game'));
                }}
            >
                Deal cards
            </button>
            {resumable && (
                <button
                    type="button"
                    onClick={() => {
                        dispatch(continueGame());
                    }}
                >
                    Continue game
                </button>
            )}
        </div>
    );
}
