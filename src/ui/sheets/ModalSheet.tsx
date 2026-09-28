import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { useTranslate } from '../../i18n/useTranslate';
import { Icon } from '../components/Icon';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(panel: HTMLElement): HTMLElement[] {
    return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

/** Whether `element` or an ancestor is hidden by the `hidden` attribute or an inline `display`/`visibility` style. */
function isHidden(element: HTMLElement): boolean {
    for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
        if (node.hidden || node.style.display === 'none' || node.style.visibility === 'hidden') return true;
    }
    return false;
}

/** An element still reachable by focus: attached to the page, not disabled, not hidden, and not the page itself. */
function isFocusable(element: Element | null): element is HTMLElement {
    return (
        element instanceof HTMLElement &&
        element !== document.body &&
        element !== document.documentElement &&
        element.isConnected &&
        !element.hasAttribute('disabled') &&
        !isHidden(element)
    );
}

export interface ModalSheetProps {
    /** The sheet's visible heading, read as its accessible name. */
    readonly heading: string;
    /** Focused once, when the sheet opens. */
    readonly initialFocusRef: RefObject<HTMLElement | null>;
    /** `false` for the Win sheet only: no close button, and Escape/the backdrop do nothing (SH "Escape and the backdrop close a sheet"). */
    readonly dismissable?: boolean;
    /** `.modal-sheet--wide`. */
    readonly wide?: boolean;
    /** Escape, the backdrop, or the close button; ignored while `dismissable` is `false`. */
    readonly onDismiss: () => void;
    /** Called once the sheet has closed, to move focus back: to the opener when it is still reachable, or as a fallback otherwise (SH "Sheet focus is trapped and returned"). */
    readonly returnFocusFallback: () => void;
    readonly children: ReactNode;
}

/**
 * The one generic dialog every sheet (`SheetHost`, section 5) wraps its content in (D2): a centred panel over a
 * dimmed, `inert`-adjacent backdrop, with a focus trap, Escape/backdrop dismissal, and focus return on close. Redux-
 * agnostic by design (constitution 3): the caller supplies `onDismiss` (typically `closeSheet()`) and decides what
 * "the opener" or "the screen heading" means through `returnFocusFallback`.
 */
export function ModalSheet({
    heading,
    initialFocusRef,
    dismissable = true,
    wide = false,
    onDismiss,
    returnFocusFallback,
    children,
}: ModalSheetProps) {
    const t = useTranslate();
    const headingId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<Element | null>(null);

    // Capture the opener and move focus in, once, when the sheet mounts.
    useEffect(() => {
        openerRef.current = document.activeElement;
        initialFocusRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount only.
    }, []);

    // Return focus on unmount: to the opener if it is still reachable, otherwise the caller's fallback.
    useEffect(
        () => () => {
            if (isFocusable(openerRef.current)) {
                openerRef.current.focus();
            } else {
                returnFocusFallback();
            }
        },
        [returnFocusFallback],
    );

    function attemptDismiss(): void {
        if (dismissable) onDismiss();
    }

    function onBackdropClick(event: MouseEvent<HTMLDivElement>): void {
        if (event.target === event.currentTarget) attemptDismiss();
    }

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            attemptDismiss();
            return;
        }
        if (event.key !== 'Tab' || panelRef.current === null) return;

        const focusable = focusableElements(panelRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    }

    return (
        <div className="modal-layer" data-testid="modal-backdrop" onClick={onBackdropClick}>
            <div
                ref={panelRef}
                className={wide ? 'modal-sheet modal-sheet--wide' : 'modal-sheet'}
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                onKeyDown={onKeyDown}
            >
                <div className="modal-sheet__header">
                    <h2 id={headingId}>{heading}</h2>
                    {dismissable && (
                        <button
                            type="button"
                            className="icon-action modal-sheet__close"
                            aria-label={t('sheet.close')}
                            onClick={attemptDismiss}
                        >
                            <Icon path="M6 6 18 18M18 6 6 18" />
                        </button>
                    )}
                </div>
                <div className="modal-sheet__body">{children}</div>
            </div>
        </div>
    );
}
