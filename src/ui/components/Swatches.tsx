import { useRef, type CSSProperties, type KeyboardEvent } from 'react';

export interface SwatchOption<T extends string> {
    readonly value: T;
    /** The colour's own name (SH "Settings sheet": swatches are named by colour, not by colour alone). */
    readonly name: string;
    /** `--sa`, the swatch's base colour. */
    readonly primary: string;
    /** `--sb`, the swatch's chequer highlight. */
    readonly secondary: string;
}

export interface SwatchesProps<T extends string> {
    /** The group's own name (a labelled radiogroup, SH "Settings sheet"). */
    readonly label: string;
    readonly options: readonly SwatchOption<T>[];
    readonly value: T;
    readonly onChange: (value: T) => void;
}

/**
 * A named single-choice group of colour swatches (`.swatches`, D13): the same roving-tabindex radiogroup pattern as
 * `Segmented`, rendered as colour tiles instead of labelled buttons. Each swatch's accessible name is its colour's
 * own name.
 */
export function Swatches<T extends string>({ label, options, value, onChange }: SwatchesProps<T>) {
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
        <div className="swatches" role="radiogroup" aria-label={label}>
            {options.map((option, index) => (
                <button
                    key={option.value}
                    ref={(element) => {
                        buttons.current[index] = element;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    aria-label={option.name}
                    tabIndex={option.value === value ? 0 : -1}
                    className={option.value === value ? 'swatch is-active' : 'swatch'}
                    style={{ '--sa': option.primary, '--sb': option.secondary } as CSSProperties}
                    onClick={() => {
                        onChange(option.value);
                    }}
                    onKeyDown={(event) => {
                        onKeyDown(event, index);
                    }}
                />
            ))}
        </div>
    );
}
