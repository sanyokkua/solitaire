import { memo } from 'react';
import { SUIT_SYMBOLS } from '../../domain/cards';
import type { PileRef } from '../../domain/types';
import { useTranslate } from '../../i18n/useTranslate';
import { Icon } from '../components/Icon';
import { TEXT_PRESENTATION } from './constants';
import { pileKey } from './locate';
import { pileName } from './names';
import { positionStyle } from './style';

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
    /** The slot is the target of a hint (a draw or recycle) and pulses amber. */
    readonly hinted?: boolean;
    /** The slot's tab stop; applied only when the slot is a button. */
    readonly tabIndex?: number;
}

function Placeholder({ pile }: { readonly pile: SlotPile }) {
    switch (pile.pile) {
        case 'stock':
            return <Icon path={RECYCLE_PATH} />;
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
 * technology. The slot as a whole is named by `pileName` and is a button when it is the stock or an empty pile (a
 * target for a placed card or a draw), and a group otherwise.
 */
function PileSlotComponent({ pile, count, x, y, spent = false, hinted = false, tabIndex }: PileSlotProps) {
    const t = useTranslate();
    const style = positionStyle(x, y);
    const className = ['slot', MODIFIERS[pile.pile], spent ? 'is-spent' : '', hinted ? 'is-hint' : '']
        .filter(Boolean)
        .join(' ');
    const isButton = pile.pile === 'stock' || count === 0;

    return (
        <div
            className={className}
            role={isButton ? 'button' : 'group'}
            tabIndex={isButton ? tabIndex : undefined}
            data-pile={pileKey(pile)}
            aria-label={pileName(t, pile, count)}
            style={style}
        >
            <Placeholder pile={pile} />
        </div>
    );
}

export const PileSlot = memo(PileSlotComponent);
