export interface SwitchProps {
    /** The row's own name (SH "Settings sheet": switches expose the row's name and their on/off state). */
    readonly label: string;
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    /** A disabled switch reports `checked` as given and ignores clicks. */
    readonly disabled?: boolean;
    /** The id of the element that describes the switch (a caption). */
    readonly describedBy?: string;
}

/** A boolean setting control (`.switch`, D13): `role="switch"`, toggled by tap/click, Enter or Space (native button). */
export function Switch({ label, checked, onChange, disabled = false, describedBy }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            aria-describedby={describedBy}
            disabled={disabled}
            className="switch"
            onClick={() => {
                onChange(!checked);
            }}
        />
    );
}
