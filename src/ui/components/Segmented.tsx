import { useRef, type KeyboardEvent, type RefObject } from 'react';

export interface SegmentedOption<T extends string> {
    readonly value: T;
    readonly label: string;
}

export interface SegmentedProps<T extends string> {
    /** The group's own name (a labelled radiogroup, SH "Settings sheet"). */
    readonly label: string;
    readonly options: readonly SegmentedOption<T>[];
    readonly value: T;
    readonly onChange: (value: T) => void;
    /** Set on the first option's button, e.g. for a sheet's `ModalSheet.initialFocusRef` (I5). */
    readonly firstOptionRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * A named single-choice group of buttons (`.segmented`, D13): each option is a `role="radio"` with the group's
 * checked state. Left/right (and up/down) arrows move to and select the neighbouring option, wrapping at the ends,
 * and move focus there too — a roving-tabindex group, so only the checked option is in the Tab order.
 */
export function Segmented<T extends string>({ label, options, value, onChange, firstOptionRef }: SegmentedProps<T>) {
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    function focusAndSelect(index: number): void {
        const wrapped = (index + options.length) % options.length;
        const option = options[wrapped];
        if (option === undefined) return;
        onChange(option.value);
        buttons.current[wrapped]?.focus();
    }

    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            focusAndSelect(index + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusAndSelect(index - 1);
        }
    }

    return (
        <div className="segmented" role="radiogroup" aria-label={label}>
            {options.map((option, index) => (
                <button
                    key={option.value}
                    ref={(element) => {
                        buttons.current[index] = element;
                        if (index === 0 && firstOptionRef) firstOptionRef.current = element;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    tabIndex={option.value === value ? 0 : -1}
                    className={option.value === value ? 'is-active' : undefined}
                    onClick={() => {
                        onChange(option.value);
                    }}
                    onKeyDown={(event) => {
                        onKeyDown(event, index);
                    }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
