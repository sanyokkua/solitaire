import { useEffect, useRef, useState } from 'react';

export interface ConfirmActionProps {
    /** The action's own name (SH "Settings sheet": Reset actions); shown on the trigger and folded into the
     * Confirm/Cancel controls' own accessible names so a sheet with more than one reset stays unambiguous. */
    readonly label: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    /** Runs once, when Confirm is activated; the caller decides what "confirmed" does. */
    readonly onConfirm: () => void;
}

/**
 * An action that needs an explicit confirmation step before it does anything destructive (D13, SH "Settings sheet":
 * "Each Data action SHALL require an explicit confirmation step … a second, clearly labelled confirming control with
 * a Cancel"). Activating the trigger swaps it for an inline Confirm/Cancel pair; Confirm runs `onConfirm` and folds
 * back to the trigger, Cancel folds back without running it. Either one returns focus to the trigger (SH "Sheet focus
 * is trapped and returned": "Focus back to Reset after confirming"), unless `onConfirm` itself moves the app away
 * from the sheet (Reset all local data), in which case there is no trigger left to return to. Generic so both
 * Settings' Data group (5.2) and Statistics' own Reset control (5.4) reuse it.
 */
export function ConfirmAction({ label, confirmLabel, cancelLabel, onConfirm }: ConfirmActionProps) {
    const [confirming, setConfirming] = useState(false);
    const wasConfirming = useRef(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Return focus to the trigger only when folding back from the confirming state, never on first mount.
    useEffect(() => {
        if (wasConfirming.current && !confirming) {
            triggerRef.current?.focus();
        }
        wasConfirming.current = confirming;
    }, [confirming]);

    if (confirming) {
        return (
            <div className="confirm-action">
                <button
                    type="button"
                    className="action-button action-button--filled"
                    aria-label={`${confirmLabel} ${label}`}
                    onClick={() => {
                        onConfirm();
                        setConfirming(false);
                    }}
                >
                    {confirmLabel}
                </button>
                <button
                    type="button"
                    className="action-button action-button--outline"
                    aria-label={`${cancelLabel} ${label}`}
                    onClick={() => {
                        setConfirming(false);
                    }}
                >
                    {cancelLabel}
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            ref={triggerRef}
            className="action-button action-button--outline"
            onClick={() => {
                setConfirming(true);
            }}
        >
            {label}
        </button>
    );
}
