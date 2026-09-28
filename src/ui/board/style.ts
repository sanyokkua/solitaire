import type { CSSProperties } from 'react';

/** Formats a number of board pixels as a CSS length, e.g. `px(12)` gives `'12px'`. */
export function px(value: number): string {
    return `${String(value)}px`;
}

/** CSS custom-property names (`--x`, `--stock-x`, …), each a plain string value. */
type CustomProperties = Record<`--${string}`, string>;

/**
 * A typed inline style mixing ordinary CSS properties with `--name` custom properties. The one place that needs an
 * unsafe cast (React's `CSSProperties` does not itself allow custom properties), instead of at every call site.
 */
export function boardStyle(vars: CustomProperties, standard: CSSProperties = {}): CSSProperties {
    return { ...standard, ...vars };
}

/** The `--x`/`--y` position every card, pile slot, ghost and the stock badge shares. */
export function positionStyle(x: number, y: number, standard: CSSProperties = {}): CSSProperties {
    return boardStyle({ '--x': px(x), '--y': px(y) }, standard);
}
