import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import type { RejectReason } from '../../../src/domain/types';
import type { HintView } from '../../../src/features/interaction/interactionSlice';
import { formatAnnouncement, hintText } from '../../../src/ui/announce';

const SEVEN_OF_CLUBS = cardId(2, 7);
const FOUR_OF_HEARTS = cardId(0, 4);
const ACE_OF_SPADES = cardId(3, 1);

describe('formatAnnouncement', () => {
    it('names one moved card and the pile it landed on', () => {
        expect(
            formatAnnouncement({
                type: 'moved',
                cards: [SEVEN_OF_CLUBS],
                from: { pile: 'waste' },
                to: { pile: 'tableau', col: 3 },
            }),
        ).toBe('Seven of Clubs moved to column 4');
        expect(
            formatAnnouncement({
                type: 'moved',
                cards: [ACE_OF_SPADES],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'foundation', suit: 3 },
            }),
        ).toBe('Ace of Spades moved to the Spades foundation');
        expect(
            formatAnnouncement({
                type: 'moved',
                cards: [FOUR_OF_HEARTS],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'waste' },
            }),
        ).toBe('Four of Hearts moved to the waste');
    });

    it('counts the cards of a moved run', () => {
        expect(
            formatAnnouncement({
                type: 'moved',
                cards: [SEVEN_OF_CLUBS, FOUR_OF_HEARTS, ACE_OF_SPADES],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'tableau', col: 5 },
            }),
        ).toBe('Moved 3 cards to column 6');
    });

    it('says how many cards were drawn', () => {
        expect(formatAnnouncement({ type: 'drew', count: 3 })).toBe('Drew 3 cards');
        expect(formatAnnouncement({ type: 'drew', count: 1 })).toBe('Drew 1 card');
    });

    it('words a recycle, an undo and a redo', () => {
        expect(formatAnnouncement({ type: 'recycled' })).toBe('Turned the waste over');
        expect(formatAnnouncement({ type: 'undone' })).toBe('Undid the last move');
        expect(formatAnnouncement({ type: 'redone' })).toBe('Redid the move');
    });

    it('words each kind of hint', () => {
        expect(
            formatAnnouncement({
                type: 'hinted',
                kind: 'move',
                cards: [FOUR_OF_HEARTS],
                target: { pile: 'tableau', col: 5 },
            }),
        ).toBe('Hint: move the Four of Hearts onto column 6');
        expect(formatAnnouncement({ type: 'hinted', kind: 'draw', cards: [], target: 'stock' })).toBe(
            'Hint: draw from the stock',
        );
        expect(formatAnnouncement({ type: 'hinted', kind: 'recycle', cards: [], target: 'stock' })).toBe(
            'Hint: turn the waste back over',
        );
    });

    it('says a redeal limit in its own words and every other refusal generically', () => {
        expect(formatAnnouncement({ type: 'refused', reason: 'pass-limit' })).toBe('No redeals left');
        const others: RejectReason[] = ['game-over', 'not-movable', 'illegal-target', 'nothing-to-draw'];
        for (const reason of others) {
            expect(formatAnnouncement({ type: 'refused', reason })).toBe('That move is not possible');
        }
    });

    it('words a dead end', () => {
        expect(formatAnnouncement({ type: 'deadEnd' })).toBe('No moves left. Undo a few steps or deal again.');
    });

    it('counts the cards sent to the foundations', () => {
        expect(formatAnnouncement({ type: 'sentHome', count: 12 })).toBe('Moved 12 cards to the foundations');
        expect(formatAnnouncement({ type: 'sentHome', count: 1 })).toBe('Moved 1 card to the foundations');
    });

    it('words a win', () => {
        expect(formatAnnouncement({ type: 'won' })).toBe('You win');
    });
});

describe('hintText', () => {
    it('names the first card of a run and its target', () => {
        expect(hintText({ kind: 'move', cards: [FOUR_OF_HEARTS], target: { pile: 'tableau', col: 5 } })).toBe(
            'Hint: move the Four of Hearts onto column 6',
        );
        expect(
            hintText({ kind: 'move', cards: [FOUR_OF_HEARTS, SEVEN_OF_CLUBS], target: { pile: 'tableau', col: 5 } }),
        ).toBe('Hint: move the Four of Hearts and the cards on it onto column 6');
        expect(hintText({ kind: 'move', cards: [ACE_OF_SPADES], target: { pile: 'foundation', suit: 3 } })).toBe(
            'Hint: move the Ace of Spades onto the Spades foundation',
        );
    });

    it('accepts a HintView', () => {
        const view: HintView = { id: 1, kind: 'draw', cards: [], target: 'stock' };
        expect(hintText(view)).toBe('Hint: draw from the stock');
    });
});
