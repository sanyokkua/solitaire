import type { CSSProperties } from 'react';
import { BADGE_Z } from './layout';

export interface StockBadgeProps {
    /** Cards left in the stock. */
    readonly count: number;
    /** Left offset of the badge within the table, in px. */
    readonly x: number;
    /** Top offset of the badge within the table, in px. */
    readonly y: number;
}

/** The count of cards left in the stock, at the stock's top-right corner. Hidden while the stock is empty. */
export function StockBadge({ count, x, y }: StockBadgeProps) {
    if (count === 0) {
        return null;
    }
    const style = { '--x': `${String(x)}px`, '--y': `${String(y)}px`, zIndex: BADGE_Z } as CSSProperties;

    return (
        <div className="stock-count" aria-hidden="true" style={style}>
            {count}
        </div>
    );
}
