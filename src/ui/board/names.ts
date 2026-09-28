import { rankOf, suitOf } from '../../domain/cards';
import type { CardId, PileRef } from '../../domain/types';
import type { Translate } from '../../i18n/translate';

/** The accessible name of a card: "Queen of Spades" face up, "Face-down card" face down (localised). */
export function cardName(t: Translate, id: CardId, faceUp: boolean): string {
    if (!faceUp) {
        return t('card.faceDown');
    }
    const rank = t(`card.rank.${String(rankOf(id))}`);
    const suit = t(`card.suit.${String(suitOf(id))}`);
    return t('card.name', { rank, suit });
}

/** The bare name of a pile, without a count: "Stock", "Waste", "Hearts foundation" or "Column 4" (localised). */
export function pileLabel(t: Translate, ref: PileRef): string {
    switch (ref.pile) {
        case 'stock':
            return t('pile.stock');
        case 'waste':
            return t('pile.waste');
        case 'foundation':
            return t('pile.foundation', { suit: t(`card.suit.${String(ref.suit)}`) });
        case 'tableau':
            return t('pile.column', { n: ref.col + 1 });
    }
}

/** The accessible name of a pile with its card count, such as "Column 4, 1 card" or "Stock, empty" (localised). */
export function pileName(t: Translate, ref: PileRef, count: number): string {
    const countText = count === 0 ? t('pile.empty') : t('pile.count', { count });
    return t('pile.withCount', { label: pileLabel(t, ref), count: countText });
}
