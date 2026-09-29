// covers: KS-A11Y-02

import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import type { RejectReason } from '../../../src/domain/types';
import type { HintView } from '../../../src/features/interaction/interactionSlice';
import { CATALOGS } from '../../../src/i18n/catalog';
import { createTranslator, type Translate } from '../../../src/i18n/translate';
import { formatAnnouncement, hintText } from '../../../src/ui/announce';

const en: Translate = createTranslator('en', CATALOGS.en.catalog, CATALOGS.en.catalog);
const uk: Translate = createTranslator('uk', CATALOGS.uk.catalog, CATALOGS.en.catalog);

const SEVEN_OF_CLUBS = cardId(2, 7);
const FOUR_OF_HEARTS = cardId(0, 4);
const ACE_OF_SPADES = cardId(3, 1);

describe('formatAnnouncement', () => {
    it('names one moved card and the pile it landed on, in English', () => {
        expect(
            formatAnnouncement(en, {
                type: 'moved',
                cards: [SEVEN_OF_CLUBS],
                from: { pile: 'waste' },
                to: { pile: 'tableau', col: 3 },
            }),
        ).toBe('Seven of Clubs moved to column 4');
        expect(
            formatAnnouncement(en, {
                type: 'moved',
                cards: [ACE_OF_SPADES],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'foundation', suit: 3 },
            }),
        ).toBe('Ace of Spades moved to the Spades foundation');
        expect(
            formatAnnouncement(en, {
                type: 'moved',
                cards: [FOUR_OF_HEARTS],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'waste' },
            }),
        ).toBe('Four of Hearts moved to the waste');
    });

    it('names one moved card and the pile it landed on, in Ukrainian', () => {
        expect(
            formatAnnouncement(uk, {
                type: 'moved',
                cards: [SEVEN_OF_CLUBS],
                from: { pile: 'waste' },
                to: { pile: 'tableau', col: 3 },
            }),
        ).toBe('Сімка треф → колонка 4');
        expect(
            formatAnnouncement(uk, {
                type: 'moved',
                cards: [ACE_OF_SPADES],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'foundation', suit: 3 },
            }),
        ).toBe('Туз пік → фундамент пік');
        expect(
            formatAnnouncement(uk, {
                type: 'moved',
                cards: [FOUR_OF_HEARTS],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'waste' },
            }),
        ).toBe('Четвірка червів → відбій');
    });

    it('counts the cards of a moved run', () => {
        expect(
            formatAnnouncement(en, {
                type: 'moved',
                cards: [SEVEN_OF_CLUBS, FOUR_OF_HEARTS, ACE_OF_SPADES],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'tableau', col: 5 },
            }),
        ).toBe('Moved 3 cards to column 6');
        expect(
            formatAnnouncement(uk, {
                type: 'moved',
                cards: [SEVEN_OF_CLUBS, FOUR_OF_HEARTS, ACE_OF_SPADES],
                from: { pile: 'tableau', col: 0 },
                to: { pile: 'tableau', col: 5 },
            }),
        ).toBe('3 карти → колонка 6');
    });

    it('says how many cards were drawn, at 1 and 3, in English and Ukrainian', () => {
        expect(formatAnnouncement(en, { type: 'drew', count: 3 })).toBe('Drew 3 cards');
        expect(formatAnnouncement(en, { type: 'drew', count: 1 })).toBe('Drew 1 card');
        expect(formatAnnouncement(uk, { type: 'drew', count: 3 })).toBe('Взято 3 карти');
        expect(formatAnnouncement(uk, { type: 'drew', count: 1 })).toBe('Взято 1 карта');
    });

    it('words a recycle, an undo and a redo', () => {
        expect(formatAnnouncement(en, { type: 'recycled' })).toBe('Turned the waste over');
        expect(formatAnnouncement(en, { type: 'undone' })).toBe('Undid the last move');
        expect(formatAnnouncement(en, { type: 'redone' })).toBe('Redid the move');
        expect(formatAnnouncement(uk, { type: 'recycled' })).toBe('Відбій перевернуто');
        expect(formatAnnouncement(uk, { type: 'undone' })).toBe('Останній хід скасовано');
        expect(formatAnnouncement(uk, { type: 'redone' })).toBe('Хід повторено');
    });

    it('words each kind of hint, in English', () => {
        expect(
            formatAnnouncement(en, {
                type: 'hinted',
                kind: 'move',
                cards: [FOUR_OF_HEARTS],
                target: { pile: 'tableau', col: 5 },
            }),
        ).toBe('Hint: move the Four of Hearts onto column 6');
        expect(formatAnnouncement(en, { type: 'hinted', kind: 'draw', cards: [], target: 'stock' })).toBe(
            'Hint: draw from the stock',
        );
        expect(formatAnnouncement(en, { type: 'hinted', kind: 'recycle', cards: [], target: 'stock' })).toBe(
            'Hint: turn the waste back over',
        );
    });

    it('words each kind of hint, in Ukrainian', () => {
        expect(
            formatAnnouncement(uk, {
                type: 'hinted',
                kind: 'move',
                cards: [FOUR_OF_HEARTS],
                target: { pile: 'tableau', col: 5 },
            }),
        ).toBe('Підказка: Четвірка червів → колонка 6');
        expect(formatAnnouncement(uk, { type: 'hinted', kind: 'draw', cards: [], target: 'stock' })).toBe(
            'Підказка: візьміть карту з колоди',
        );
        expect(formatAnnouncement(uk, { type: 'hinted', kind: 'recycle', cards: [], target: 'stock' })).toBe(
            'Підказка: переверніть відбій',
        );
    });

    it('says a redeal limit in its own words and every other refusal generically', () => {
        expect(formatAnnouncement(en, { type: 'refused', reason: 'pass-limit' })).toBe('No redeals left');
        expect(formatAnnouncement(uk, { type: 'refused', reason: 'pass-limit' })).toBe('Більше нема перерозподілів');
        const others: RejectReason[] = ['game-over', 'not-movable', 'illegal-target', 'nothing-to-draw'];
        for (const reason of others) {
            expect(formatAnnouncement(en, { type: 'refused', reason })).toBe('That move is not possible');
            expect(formatAnnouncement(uk, { type: 'refused', reason })).toBe('Цей хід неможливий');
        }
    });

    it('words a dead end', () => {
        expect(formatAnnouncement(en, { type: 'deadEnd' })).toBe('No moves left. Undo a few steps or deal again.');
        expect(formatAnnouncement(uk, { type: 'deadEnd' })).toBe(
            'Ходів не залишилось. Скасуйте кілька ходів або здайте нову гру.',
        );
    });

    it('counts the cards sent to the foundations, at 1 and 12, in English and Ukrainian', () => {
        expect(formatAnnouncement(en, { type: 'sentHome', count: 12 })).toBe('Moved 12 cards to the foundations');
        expect(formatAnnouncement(en, { type: 'sentHome', count: 1 })).toBe('Moved 1 card to the foundations');
        expect(formatAnnouncement(uk, { type: 'sentHome', count: 12 })).toBe('12 карт → фундаменти');
        expect(formatAnnouncement(uk, { type: 'sentHome', count: 1 })).toBe('1 карта → фундаменти');
    });

    it('words a win', () => {
        expect(formatAnnouncement(en, { type: 'won' })).toBe('You win');
        expect(formatAnnouncement(uk, { type: 'won' })).toBe('Перемога!');
    });
});

describe('hintText', () => {
    it('names the first card of a run and its target, in English', () => {
        expect(hintText(en, { kind: 'move', cards: [FOUR_OF_HEARTS], target: { pile: 'tableau', col: 5 } })).toBe(
            'Hint: move the Four of Hearts onto column 6',
        );
        expect(
            hintText(en, {
                kind: 'move',
                cards: [FOUR_OF_HEARTS, SEVEN_OF_CLUBS],
                target: { pile: 'tableau', col: 5 },
            }),
        ).toBe('Hint: move the Four of Hearts and the cards on it onto column 6');
        expect(hintText(en, { kind: 'move', cards: [ACE_OF_SPADES], target: { pile: 'foundation', suit: 3 } })).toBe(
            'Hint: move the Ace of Spades onto the Spades foundation',
        );
    });

    it('names the first card of a run and its target, in Ukrainian', () => {
        expect(hintText(uk, { kind: 'move', cards: [FOUR_OF_HEARTS], target: { pile: 'tableau', col: 5 } })).toBe(
            'Підказка: Четвірка червів → колонка 6',
        );
        expect(
            hintText(uk, {
                kind: 'move',
                cards: [FOUR_OF_HEARTS, SEVEN_OF_CLUBS],
                target: { pile: 'tableau', col: 5 },
            }),
        ).toBe('Підказка: Четвірка червів і карти на ній → колонка 6');
    });

    it('accepts a HintView', () => {
        const view: HintView = { id: 1, kind: 'draw', cards: [], target: 'stock' };
        expect(hintText(en, view)).toBe('Hint: draw from the stock');
    });
});
