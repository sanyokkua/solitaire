import { useEffect } from 'react';
import { useAppDispatch, useAppStore } from '../../app/hooks';
import { selectGameControlsIdle } from '../../features/game/gameSlice';
import { finish, play, redo, undo } from '../../features/game/gameThunks';
import { canPause, closeSheet, pause, requestNewDeal, resume } from '../../features/game/navigationThunks';
import { selectionCleared } from '../../features/interaction/interactionSlice';
import { requestHint } from '../../features/interaction/interactionThunks';
import { selectInputEnabled } from '../../features/interaction/selectors';
import { keyToAction, type KeyContext } from './keyboardController';

/** Where focus is, from the element a key press landed on: nowhere (the page itself), on the board, or elsewhere. */
function focusOf(target: EventTarget | null): KeyContext['focus'] {
    if (!(target instanceof Element) || target === document.body || target === document.documentElement) return 'none';
    return target.closest('.board') === null ? 'other' : 'board';
}

/**
 * The Game screen's global shortcuts (D3): while mounted, one `keydown` listener maps each key through `keyToAction`
 * and dispatches the command it stands for. Ctrl or Command with Z undoes, with Y or Shift+Z redoes; H asks for a hint,
 * A finishes (the thunk does nothing when Finish is unavailable), Space with nothing focused draws and Esc clears the
 * selection. The letters go by the layout's Latin letter, else by the physical key (`code`), so they work on a Ukrainian
 * layout. A held key acts once: an auto-repeated shortcut is prevented and dropped.
 *
 * N and P (5.7) both bypass the input gate (D3): each is handled before the sheet-open check and before
 * `selectInputEnabled`. N dispatches `requestNewDeal()`, exactly what the HUD New deal control does, whenever no
 * sheet is open and `selectGameControlsIdle` holds (no safe-card chain or Finish running, no deal being prepared), so
 * it still deals at once during the win cascade, before the Win sheet opens. P dispatches `pause()` under the same
 * `selectGameControlsIdle` gate, and only for a game that is not won (exactly `pause()`'s own refusal conditions,
 * checked here too so the key does nothing rather than dispatching a thunk that no-ops); with the Paused sheet
 * already open it dispatches `resume()` instead; with any other sheet open it does nothing. The board-move shortcuts
 * (undo, redo, hint, finish, draw, Esc on a selection) keep the input gate below, unchanged. With a sheet open only
 * Esc acts on the board-shortcut path, and closes the sheet. Enter, Space and Shift on a focused board element belong
 * to `useBoardKeyboard`, and an Escape that ends a drag to `useBoardPointer`: an event either of them has handled is
 * `defaultPrevented` and is skipped. The listener is on `window`, which sees the event after every `document`
 * listener, so that check holds whichever hook bound first. It binds once and reads the store when a key arrives.
 */
export function useGameShortcuts(): void {
    const store = useAppStore();
    const dispatch = useAppDispatch();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.defaultPrevented) return;
            const action = keyToAction(
                {
                    key: event.key,
                    code: event.code,
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                    shiftKey: event.shiftKey,
                    altKey: event.altKey,
                    target: event.target instanceof Element ? event.target : null,
                },
                { focus: focusOf(event.target) },
            );
            if (action === undefined || action === 'activate' || action === 'pickUp') return;

            if (event.repeat && (action === 'newDeal' || action === 'pause' || store.getState().app.sheet === null)) {
                // A held key acts once: the auto-repeat is swallowed (and Space does not scroll the page).
                event.preventDefault();
                return;
            }

            if (action === 'newDeal' || action === 'pause') {
                const state = store.getState();
                if (action === 'newDeal') {
                    if (state.app.sheet === null && selectGameControlsIdle(state)) {
                        event.preventDefault();
                        void dispatch(requestNewDeal());
                    }
                } else if (state.app.sheet === 'paused') {
                    event.preventDefault();
                    dispatch(resume());
                } else if (state.app.sheet === null && canPause(state)) {
                    event.preventDefault();
                    dispatch(pause());
                }
                return;
            }

            const state = store.getState();
            if (state.app.sheet !== null) {
                if (action === 'escape') {
                    event.preventDefault();
                    dispatch(closeSheet());
                }
                return;
            }
            if (!selectInputEnabled(state)) return;

            switch (action) {
                case 'undo':
                    dispatch(undo());
                    break;
                case 'redo':
                    dispatch(redo());
                    break;
                case 'hint':
                    void dispatch(requestHint());
                    break;
                case 'finish':
                    void dispatch(finish());
                    break;
                case 'draw':
                    void dispatch(play({ type: 'draw' }));
                    break;
                case 'escape':
                    if (state.interaction.selection === null) return;
                    dispatch(selectionCleared());
                    break;
            }
            event.preventDefault();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [store, dispatch]);
}
