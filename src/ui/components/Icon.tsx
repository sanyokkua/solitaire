/** A decorative 24-unit stroke icon drawn from one SVG path; the visible label or the control's name is the name. */
export function Icon({ path }: { readonly path: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
