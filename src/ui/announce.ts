import type { PileRef } from '../domain/types';
import type { Announcement } from '../features/interaction/announcements';
import type { Translate } from '../i18n/translate';
import { cardName } from './board/names';

/** A hint as the formatter needs it: what to move and where. `HintView` in the interaction slice has this shape. */
export type HintDescriptor = Omit<Extract<Announcement, { type: 'hinted' }>, 'type'>;

/** A pile in a sentence: "column 4", "the Hearts foundation", "the waste", "the stock" (localised). */
function place(t: Translate, ref: PileRef | 'stock'): string {
    const target: PileRef = ref === 'stock' ? { pile: 'stock' } : ref;
    switch (target.pile) {
        case 'tableau':
            return t('place.tableau', { n: target.col + 1 });
        case 'foundation':
            return t('place.foundation', { suit: t(`card.suit.${String(target.suit)}`) });
        case 'stock':
            return t('place.stock');
        case 'waste':
            return t('place.waste');
    }
}

/** The hint in words: "Hint: move the Four of Hearts onto column 6", "Hint: draw from the stock" (localised). */
export function hintText(t: Translate, hint: HintDescriptor): string {
    switch (hint.kind) {
        case 'draw':
            return t('hint.draw');
        case 'recycle':
            return t('hint.recycle');
        case 'move': {
            const [first] = hint.cards;
            const subject =
                first === undefined
                    ? t('hint.subject.none')
                    : hint.cards.length === 1
                      ? t('hint.subject.one', { card: cardName(t, first, true) })
                      : t('hint.subject.many', { card: cardName(t, first, true) });
            return t('hint.move', { subject, place: place(t, hint.target) });
        }
    }
}

/**
 * The wording of one announcement, for the screen-reader announcer (KS-A11Y-02), in the active language. The
 * descriptors carry no text.
 */
export function formatAnnouncement(t: Translate, item: Announcement): string {
    switch (item.type) {
        case 'moved': {
            const [first] = item.cards;
            return first !== undefined && item.cards.length === 1
                ? t('announce.moved.one', { card: cardName(t, first, true), place: place(t, item.to) })
                : t('announce.moved.many', {
                      count: t('pile.count', { count: item.cards.length }),
                      place: place(t, item.to),
                  });
        }
        case 'drew':
            return t('announce.drew', { count: t('pile.count', { count: item.count }) });
        case 'recycled':
            return t('announce.recycled');
        case 'undone':
            return t('announce.undone');
        case 'redone':
            return t('announce.redone');
        case 'hinted':
            return hintText(t, item);
        case 'refused':
            return item.reason === 'pass-limit' ? t('announce.refused.passLimit') : t('announce.refused.other');
        case 'deadEnd':
            return t('announce.deadEnd');
        case 'sentHome':
            return t('announce.sentHome', { count: t('pile.count', { count: item.count }) });
        case 'won':
            return t('announce.won');
        case 'codeCopied':
            return t('announce.codeCopied');
    }
}
