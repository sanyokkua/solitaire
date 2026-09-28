import { useId, useRef, useState } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { closeSheet, playDealCode } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { ModalSheet } from './ModalSheet';

/**
 * The Play a deal code sheet (5.9, D5, SH "Play a deal code sheet"): opened from Home's "Play a deal code" link.
 * A labelled input, focused on open (I5), and a Play button inside a `<form>` so Enter in the input also submits
 * (SH input coverage: tap/click or Enter; drag is not an input path). Submitting dispatches `playDealCode(code)`
 * (`features/game/navigationThunks.ts`), which trims whitespace and ignores case itself. That thunk breaks the
 * replaced game's streak, installs the deal and shows Game on success, but does not close the sheet, so this
 * component dispatches `closeSheet()` itself when `{ ok: true }` comes back. On `{ ok: false }` nothing else is
 * dispatched: an inline error is shown, tied to the input as its accessible description (`aria-describedby`), the
 * input is marked `aria-invalid`, and focus is put back in it (it never actually left, since Play is reached by
 * Enter or a click that returns focus to the page, not by tabbing away) so the player can correct the code at once.
 * `useGameShortcuts` never fires for this input regardless of which screen is behind the sheet: `keyToAction` treats
 * any `INPUT` target as a text field and returns no action.
 */
export function DealCodeSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const inputRef = useRef<HTMLInputElement>(null);
    const [code, setCode] = useState('');
    const [invalid, setInvalid] = useState(false);
    const inputId = useId();
    const errorId = useId();

    function dismiss(): void {
        dispatch(closeSheet());
    }

    return (
        <ModalSheet
            heading={t('dealCode.heading')}
            initialFocusRef={inputRef}
            onDismiss={dismiss}
            returnFocusFallback={() => {
                (
                    document.querySelector<HTMLElement>('.screen--game h1') ??
                    document.querySelector<HTMLElement>('.screen--home h1')
                )?.focus();
            }}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    const { ok } = dispatch(playDealCode(code));
                    if (ok) {
                        dispatch(closeSheet());
                        return;
                    }
                    setInvalid(true);
                    inputRef.current?.focus();
                }}
                noValidate
            >
                <label htmlFor={inputId}>{t('dealCode.label')}</label>
                <input
                    id={inputId}
                    ref={inputRef}
                    type="text"
                    value={code}
                    placeholder={t('dealCode.placeholder')}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? errorId : undefined}
                    onChange={(event) => {
                        setCode(event.target.value);
                        setInvalid(false);
                    }}
                />
                {invalid && (
                    <p id={errorId} role="alert">
                        {t('dealCode.error')}
                    </p>
                )}
                <div className="modal-sheet__actions">
                    <button type="submit" className="action-button action-button--filled">
                        {t('dealCode.play')}
                    </button>
                </div>
            </form>
        </ModalSheet>
    );
}
