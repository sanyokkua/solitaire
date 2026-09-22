import { useAppDispatch } from '../../app/hooks';
import { setRoute } from '../../app/appSlice';

export function GameScreen() {
    const dispatch = useAppDispatch();

    return (
        <div className="screen screen--game">
            <h1>Klondike</h1>
            <button type="button" onClick={() => dispatch(setRoute('home'))}>
                Back to Home
            </button>
        </div>
    );
}
