import { memo } from 'react';
import type { CSSProperties } from 'react';
import { cardLabels, rankOf, suitOf } from '../../domain/cards';
import type { CardId } from '../../domain/types';
import { TEXT_PRESENTATION } from './constants';
import { cardName } from './names';

/** Ranks above this are court cards (J, Q, K): they show a boxed letter instead of a centre suit. */
const LAST_NUMBER_RANK = 10;

export interface CardViewProps {
    readonly id: CardId;
    /** Left offset of the card within the table, in px. */
    readonly x: number;
    /** Top offset of the card within the table, in px. */
    readonly y: number;
    /** Stacking order within the table. */
    readonly z: number;
    /** The key of the pile the card is in (`pileKey`), for the pointer to read back. */
    readonly pile: string;
    /** The card's position within that pile, lowest card first. */
    readonly index: number;
    readonly faceUp: boolean;
    /** A buried card sits under another card and casts no shadow. */
    readonly buried: boolean;
    /** A compact card omits its bottom-right corner index. */
    readonly compact: boolean;
    /** The card is part of the selected (or dragged) run and shows the selection ring. */
    readonly selected?: boolean;
    /** The card is part of the run a hint moves and pulses amber (a steady outline without motion). */
    readonly hinted?: boolean;
    /** The card can be picked up: it is a button rather than an image. */
    readonly movable: boolean;
    /** The card's tab stop; applied only when the card is movable. */
    readonly tabIndex?: number;
}

interface CornerProps {
    readonly rank: string;
    readonly glyph: string;
    readonly mirrored?: boolean;
}

function Corner({ rank, glyph, mirrored = false }: CornerProps) {
    return (
        <div className={mirrored ? 'corner corner--br' : 'corner'}>
            <span className="r">{rank}</span>
            <span className="s">{glyph}</span>
        </div>
    );
}

function classes(faceUp: boolean, buried: boolean, compact: boolean, selected: boolean, hinted: boolean): string {
    return [
        'card',
        faceUp ? 'is-up' : '',
        buried ? 'is-buried' : '',
        compact ? 'is-compact' : '',
        selected ? 'is-selected' : '',
        hinted ? 'is-hint' : '',
    ]
        .filter(Boolean)
        .join(' ');
}

/**
 * One playing card at a fixed position. Both sides are always in the DOM so a later flip can rotate them; the
 * card as a whole is one labelled element and both sides are hidden from assistive technology. A movable card is a
 * button that is pressed while selected; any other card is an image with no tab stop.
 */
function CardViewComponent({
    id,
    x,
    y,
    z,
    pile,
    index,
    faceUp,
    buried,
    compact,
    selected = false,
    hinted = false,
    movable,
    tabIndex,
}: CardViewProps) {
    const { rank, suitSymbol } = cardLabels(id);
    const glyph = `${suitSymbol}${TEXT_PRESENTATION}`;
    const isCourt = rankOf(id) > LAST_NUMBER_RANK;
    const style = { '--x': `${String(x)}px`, '--y': `${String(y)}px`, zIndex: z } as CSSProperties;

    return (
        <div
            className={classes(faceUp, buried, compact, selected, hinted)}
            data-card-id={id}
            data-suit={suitOf(id)}
            data-pile={pile}
            data-index={index}
            role={movable ? 'button' : 'img'}
            aria-pressed={movable ? selected : undefined}
            tabIndex={movable ? tabIndex : undefined}
            aria-label={cardName(id, faceUp)}
            style={style}
        >
            <div className="card-inner">
                <div className="card-side card-back" aria-hidden="true" />
                <div className="card-side card-face" aria-hidden="true">
                    <Corner rank={rank} glyph={glyph} />
                    {isCourt ? (
                        <div className="pip pip--face">
                            <b>{rank}</b>
                        </div>
                    ) : (
                        <div className="pip">{glyph}</div>
                    )}
                    {compact ? null : <Corner rank={rank} glyph={glyph} mirrored />}
                </div>
            </div>
        </div>
    );
}

export const CardView = memo(CardViewComponent);
