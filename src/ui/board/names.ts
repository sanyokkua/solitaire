import { rankOf, SUIT_KEYS, suitOf, type Rank } from '../../domain/cards';
import type { CardId, PileRef } from '../../domain/types';

/** The spelled-out name of each rank. */
const RANK_WORDS: Readonly<Record<Rank, string>> = {
    1: 'Ace',
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
    11: 'Jack',
    12: 'Queen',
    13: 'King',
};

function capitalised(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The accessible name of a card: "Queen of Spades" face up, "Face-down card" face down. */
export function cardName(id: CardId, faceUp: boolean): string {
    if (!faceUp) {
        return 'Face-down card';
    }
    return `${RANK_WORDS[rankOf(id)]} of ${capitalised(SUIT_KEYS[suitOf(id)])}`;
}

function countSuffix(count: number): string {
    if (count === 0) {
        return 'empty';
    }
    return count === 1 ? '1 card' : `${String(count)} cards`;
}

/** The bare name of a pile, without a count: "Stock", "Waste", "Hearts foundation" or "Column 4". */
export function pileLabel(ref: PileRef): string {
    switch (ref.pile) {
        case 'stock':
            return 'Stock';
        case 'waste':
            return 'Waste';
        case 'foundation':
            return `${capitalised(SUIT_KEYS[ref.suit])} foundation`;
        case 'tableau':
            return `Column ${String(ref.col + 1)}`;
    }
}

/** The accessible name of a pile with its card count, such as "Column 4, 1 card" or "Stock, empty". */
export function pileName(ref: PileRef, count: number): string {
    return `${pileLabel(ref)}, ${countSuffix(count)}`;
}
