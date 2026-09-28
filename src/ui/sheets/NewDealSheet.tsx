import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCurrentGame } from '../../features/game/gameSlice';
import { closeSheet, dealNewGame, restartDeal } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { ModalSheet } from './ModalSheet';

/**
 * New deal options (5.5, D2, D3, SH "New deal options sheet"): shown when the player asks for a new deal (the HUD
 * New deal control or N) during a started, unfinished game — `requestNewDeal()` decides that and opens `newDeal`;
 * an unstarted or won game deals at once without this sheet. Restart this deal replays the same seed through
 * `restartDeal()`; New deal dispatches `dealNewGame(mode)` for the game's own mode. Both thunks already close the
 * sheet and break the replaced game's streak through `breakStreakOf` (D3), so this component reads the mode but does
 * not repeat that logic. Cancel closes the sheet through `closeSheet()` and changes nothing. Initial focus lands on
 * Cancel, never the destructive Restart this deal or New deal (I5, D2).
 */
export function NewDealSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const current = useAppSelector(selectCurrentGame);
    const cancelRef = useRef<HTMLButtonElement>(null);

    function dismiss(): void {
        dispatch(closeSheet());
    }

    return (
        <ModalSheet
            heading={t('newDeal.heading')}
            initialFocusRef={cancelRef}
            onDismiss={dismiss}
            returnFocusFallback={dismiss}
        >
            <p>{t('newDeal.warning')}</p>

            <div className="modal-sheet__actions">
                <button
                    type="button"
                    className="action-button action-button--outline"
                    onClick={() => {
                        dispatch(restartDeal());
                    }}
                >
                    {t('newDeal.restart')}
                </button>
                <button
                    type="button"
                    className="action-button action-button--outline"
                    onClick={() => {
                        if (current !== null) void dispatch(dealNewGame(current.mode));
                    }}
                >
                    {t('newDeal.new')}
                </button>
                <button type="button" className="action-button action-button--filled" ref={cancelRef} onClick={dismiss}>
                    {t('newDeal.cancel')}
                </button>
            </div>
        </ModalSheet>
    );
}
