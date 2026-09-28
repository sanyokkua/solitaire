import type { ReactNode } from 'react';

export interface SettingRowProps {
    /** The row's visible label (`.setting-row strong`). */
    readonly label: string;
    /** The row's one-line explanation (`.setting-row p`); omitted for a row whose control needs no caption. */
    readonly description?: string;
    /** `.setting-row--inline`: label and description on the left, the control on the right (a `Switch`). */
    readonly inline?: boolean;
    readonly children?: ReactNode;
}

/** A labelled settings row (D13): a bold label, an optional one-line description, and the control that goes with it. */
export function SettingRow({ label, description, inline = false, children }: SettingRowProps) {
    return (
        <div className={inline ? 'setting-row setting-row--inline' : 'setting-row'}>
            <div>
                <strong>{label}</strong>
                {description !== undefined && <p>{description}</p>}
            </div>
            {children}
        </div>
    );
}
