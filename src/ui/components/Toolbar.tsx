import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCanRedo, selectCanUndo } from '../../features/game/gameSlice';
import { redo, undo } from '../../features/game/gameThunks';

/** Decorative icon paths, taken from the mockup's sprite; the visible label names each button. */
function Icon({ path }: { readonly path: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * The Undo and Redo toolbar. The selectors already fold in the finish-sequence `busy` flag, so a control is disabled
 * whenever its action would do nothing. Native buttons give Enter and Space activation and the global focus ring; the
 * Game frame owns size and layout.
 */
export function Toolbar() {
    const dispatch = useAppDispatch();
    const canUndo = useAppSelector(selectCanUndo);
    const canRedo = useAppSelector(selectCanRedo);

    return (
        <nav className="toolbar" aria-label="Game actions">
            <button
                type="button"
                className="tool"
                disabled={!canUndo}
                onClick={() => {
                    dispatch(undo());
                }}
            >
                <Icon path="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                Undo
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
                Redo
            </button>
        </nav>
    );
}
