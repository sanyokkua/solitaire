import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { encodeDealCode } from '../../domain/dealCode';
import { selectCurrentGame } from '../../features/game/gameSlice';
import { dealCodeCopied } from '../../features/interaction/interactionThunks';
import { useTranslate } from '../../i18n/useTranslate';

/** Selects `node`'s text so the player can copy it themselves, when the Clipboard API is unavailable or refuses. */
function selectText(node: HTMLElement): void {
    const selection = window.getSelection();
    if (selection === null) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * The deal-code footer control (5.6, D14, GM "Deal code footer"): a button reading `t('game.dealCode', { code })`
 * ("Deal 1-K7Q29XD"), the current game's `encodeDealCode(seed, mode)`. Not draggable, and reused by the Paused sheet
 * (5.7) with the same behaviour. Activating it (click, or Enter/Space when focused, free on a real `<button>`) calls
 * `navigator.clipboard.writeText`; on success it dispatches `dealCodeCopied()`, which raises the `code-copied`
 * notice and announces it together. When the Clipboard API is unavailable, or the write is refused, nothing is
 * dispatched and the code text is selected instead so the player can copy it themselves. Renders nothing without a
 * game in play.
 */
export function DealCode() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const game = useAppSelector(selectCurrentGame);
    const ref = useRef<HTMLButtonElement>(null);

    if (game === null) return null;

    const code = encodeDealCode(game.seed, game.mode);
    const label = t('game.dealCode', { code });

    const copy = () => {
        // Cast at the boundary: the DOM types declare `navigator.clipboard` as always present, but it is absent on
        // browsers without the Clipboard API, which this feature check must still catch.
        const clipboard = (navigator as { readonly clipboard?: Clipboard }).clipboard;
        const fallback = () => {
            if (ref.current !== null) selectText(ref.current);
        };
        if (clipboard === undefined) {
            fallback();
            return;
        }
        void clipboard.writeText(code).then(() => {
            dispatch(dealCodeCopied());
        }, fallback);
    };

    return (
        <button type="button" ref={ref} className="deal-code" onClick={copy}>
            {label}
        </button>
    );
}
