import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectGameControlsIdle } from '../../features/game/gameSlice';
import { requestNewDeal } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { Icon } from './Icon';

/**
 * The HUD's New deal control (5.5, D3, GM "New deal control in the HUD"): fills the reserved `.game-face` slot with
 * an icon and the caption "New deal" beneath it, both the visible text and the accessible name. Activating it by
 * pointer or keyboard (Enter/Space when focused) dispatches `requestNewDeal()`, which itself decides between opening
 * the New deal options sheet (a started, unwon game) and dealing at once — this component repeats none of that
 * logic. Disabled, while keeping its accessible name, whenever `selectGameControlsIdle` is false (a safe-card chain
 * or Finish running, or a deal being prepared). The button sits centred over `.game-face`'s own reserved box and is
 * widened to 44×44 px on a coarse pointer in `layout.css`, without changing that box's own declared size.
 */
export function NewDealButton() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const idle = useAppSelector(selectGameControlsIdle);

    return (
        <div className="game-face">
            <button
                type="button"
                className="game-face__button"
                disabled={!idle}
                onClick={() => {
                    void dispatch(requestNewDeal());
                }}
            >
                <Icon path="M12 4v16m8-8H4" />
                {t('hud.newDeal')}
            </button>
        </div>
    );
}
