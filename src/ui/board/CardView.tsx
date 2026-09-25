import { memo } from 'react';
import type { CSSProperties } from 'react';
import { cardLabels, rankOf, suitOf } from '../../domain/cards';
import type { CardId } from '../../domain/types';
import { cardName } from './names';

/** Forces the text (monochrome) presentation of a suit glyph, so it is never drawn as a colour emoji. */
export const TEXT_PRESENTATION = '\uFE0E';

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
    readonly faceUp: boolean;
    /** A buried card sits under another card and casts no shadow. */
    readonly buried: boolean;
    /** A compact card omits its bottom-right corner index. */
    readonly compact: boolean;
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

function classes(faceUp: boolean, buried: boolean, compact: boolean): string {
    return ['card', faceUp ? 'is-up' : '', buried ? 'is-buried' : '', compact ? 'is-compact' : '']
        .filter(Boolean)
        .join(' ');
}

/**
 * One playing card at a fixed position. Both sides are always in the DOM so a later flip can rotate them; the
 * card as a whole is a single labelled image and both sides are hidden from assistive technology.
 */
function CardViewComponent({ id, x, y, z, faceUp, buried, compact }: CardViewProps) {
    const { rank, suitSymbol } = cardLabels(id);
    const glyph = `${suitSymbol}${TEXT_PRESENTATION}`;
    const isCourt = rankOf(id) > LAST_NUMBER_RANK;
    const style = { '--x': `${String(x)}px`, '--y': `${String(y)}px`, zIndex: z } as CSSProperties;

    return (
        <div
            className={classes(faceUp, buried, compact)}
            data-card-id={id}
            data-suit={suitOf(id)}
            role="img"
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
