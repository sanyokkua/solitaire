import { memo } from 'react';
import type { CSSProperties } from 'react';
import { SUIT_SYMBOLS } from '../../domain/cards';
import type { PileRef } from '../../domain/types';
import { TEXT_PRESENTATION } from './CardView';
import { pileName } from './names';

/** The recycle mark: two arrows chasing each other round a circle. */
const RECYCLE_PATH = 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4';

/** The piles that get a slot; the waste has none. */
export type SlotPile = Exclude<PileRef, { readonly pile: 'waste' }>;

export interface PileSlotProps {
    readonly pile: SlotPile;
    /** Cards currently in the pile, for its accessible name. */
    readonly count: number;
    /** Left offset of the slot within the table, in px. */
    readonly x: number;
    /** Top offset of the slot within the table, in px. */
    readonly y: number;
    /** A stock that is empty and cannot be recycled is dimmed. */
    readonly spent?: boolean;
}

function RecycleMark() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d={RECYCLE_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function Placeholder({ pile }: { readonly pile: SlotPile }) {
    switch (pile.pile) {
        case 'stock':
            return <RecycleMark />;
        case 'foundation':
            return (
                <>
                    <span className="r" aria-hidden="true">
                        A
                    </span>
                    <span aria-hidden="true">{`${SUIT_SYMBOLS[pile.suit]}${TEXT_PRESENTATION}`}</span>
                </>
            );
        case 'tableau':
            return (
                <span className="r" aria-hidden="true">
                    K
                </span>
            );
    }
}

const MODIFIERS = { stock: 'slot--stock', foundation: 'slot--found', tableau: 'slot--tab' } as const;

/**
 * The always-present slot beneath a stock, foundation or tableau pile, so an empty pile stays visible: a recycle
 * mark on the stock, "A" and the suit on a foundation, "K" on a column. Its children are hidden from assistive
 * technology; the slot as a whole is a group named by `pileName`.
 */
function PileSlotComponent({ pile, count, x, y, spent = false }: PileSlotProps) {
    const style = { '--x': `${String(x)}px`, '--y': `${String(y)}px` } as CSSProperties;
    const className = ['slot', MODIFIERS[pile.pile], spent ? 'is-spent' : ''].filter(Boolean).join(' ');

    return (
        <div className={className} role="group" aria-label={pileName(pile, count)} style={style}>
            <Placeholder pile={pile} />
        </div>
    );
}

export const PileSlot = memo(PileSlotComponent);
