import type { PileRef } from '../domain/types';
import type { Announcement } from '../features/interaction/announcements';
import { cardName, pileLabel } from './board/names';

/** A hint as the formatter needs it: what to move and where. `HintView` in the interaction slice has this shape. */
export type HintDescriptor = Omit<Extract<Announcement, { type: 'hinted' }>, 'type'>;

function lowercased(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A pile in a sentence: "column 4", "the Hearts foundation", "the waste", "the stock". */
function place(ref: PileRef | 'stock'): string {
    const target: PileRef = ref === 'stock' ? { pile: 'stock' } : ref;
    const label = pileLabel(target);
    switch (target.pile) {
        case 'tableau':
            return lowercased(label);
        case 'foundation':
            return `the ${label}`;
        case 'stock':
        case 'waste':
            return `the ${lowercased(label)}`;
    }
}

function cardCount(count: number): string {
    return count === 1 ? '1 card' : `${String(count)} cards`;
}

/** The hint in words: "Hint: move the Four of Hearts onto column 6", "Hint: draw from the stock". */
export function hintText(hint: HintDescriptor): string {
    switch (hint.kind) {
        case 'draw':
            return 'Hint: draw from the stock';
        case 'recycle':
            return 'Hint: turn the waste back over';
        case 'move': {
            const [first] = hint.cards;
            const subject =
                first === undefined
                    ? 'the cards'
                    : hint.cards.length === 1
                      ? `the ${cardName(first, true)}`
                      : `the ${cardName(first, true)} and the cards on it`;
            return `Hint: move ${subject} onto ${place(hint.target)}`;
        }
    }
}

/**
 * The English wording of one announcement, for the screen-reader announcer (KS-A11Y-02). Phase 7 replaces only this
 * formatter; the descriptors carry no text.
 */
export function formatAnnouncement(item: Announcement): string {
    switch (item.type) {
        case 'moved': {
            const [first] = item.cards;
            return first !== undefined && item.cards.length === 1
                ? `${cardName(first, true)} moved to ${place(item.to)}`
                : `Moved ${cardCount(item.cards.length)} to ${place(item.to)}`;
        }
        case 'drew':
            return `Drew ${cardCount(item.count)}`;
        case 'recycled':
            return 'Turned the waste over';
        case 'undone':
            return 'Undid the last move';
        case 'redone':
            return 'Redid the move';
        case 'hinted':
            return hintText(item);
        case 'refused':
            return item.reason === 'pass-limit' ? 'No redeals left' : 'That move is not possible';
        case 'deadEnd':
            return 'No moves left. Undo a few steps or deal again.';
        case 'sentHome':
            return `Moved ${cardCount(item.count)} to the foundations`;
        case 'won':
            return 'You win';
    }
}
