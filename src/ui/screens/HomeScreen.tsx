import { useAppDispatch } from '../../app/hooks';
import { setRoute } from '../../app/appSlice';

export function HomeScreen() {
    const dispatch = useAppDispatch();

    return (
        <div className="screen screen--home">
            <h1>Solitaire</h1>
            <button type="button" onClick={() => dispatch(setRoute('game'))}>
                Deal cards
            </button>
        </div>
    );
}
