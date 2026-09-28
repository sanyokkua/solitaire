import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCanFinish, selectCanRedo, selectCanUndo } from '../../features/game/gameSlice';
import { finish, redo, undo } from '../../features/game/gameThunks';
import { requestHint } from '../../features/interaction/interactionThunks';
import { selectInputEnabled } from '../../features/interaction/selectors';
import { useTranslate } from '../../i18n/useTranslate';
import { Icon } from './Icon';

/**
 * The game toolbar: Undo, Redo, Hint and Finish. Each control is disabled whenever its action would do nothing: Undo and
 * Redo through selectors that already fold in the finish-sequence `busy` flag, Hint through the input gate (route,
 * sheet, dealing, a game in play, no sequence running), and Finish through the gate and `selectCanFinish`, and it is
 * highlighted (`is-ready`) while it is on offer. Native buttons give Enter and Space activation and the global focus
 * ring; the Game frame owns size and layout.
 */
export function Toolbar() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const canUndo = useAppSelector(selectCanUndo);
    const canRedo = useAppSelector(selectCanRedo);
    const inputEnabled = useAppSelector(selectInputEnabled);
    const finishReady = useAppSelector(selectCanFinish) && inputEnabled;

    return (
        <nav className="toolbar" aria-label={t('toolbar.label')}>
            <button
                type="button"
                className="tool"
                disabled={!canUndo}
                onClick={() => {
                    dispatch(undo());
                }}
            >
                <Icon path="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                {t('toolbar.undo')}
            </button>
            <button
                type="button"
                className="tool"
                disabled={!canRedo}
                onClick={() => {
                    dispatch(redo());
                }}
            >
                <Icon path="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
                {t('toolbar.redo')}
            </button>
            <button
                type="button"
                className="tool"
                disabled={!inputEnabled}
                onClick={() => {
                    void dispatch(requestHint());
                }}
            >
                <Icon path="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />
                {t('toolbar.hint')}
            </button>
            <button
                type="button"
                className={finishReady ? 'tool is-ready' : 'tool'}
                disabled={!finishReady}
                onClick={() => {
                    void dispatch(finish());
                }}
            >
                <Icon path="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
                {t('toolbar.finish')}
            </button>
        </nav>
    );
}
