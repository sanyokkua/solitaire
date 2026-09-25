import { cardLabels, SUIT_KEYS } from '../../domain/cards';
import type { CardId, PileRef } from '../../domain/types';

/** The spelled-out rank for each rank label `cardLabels` returns. */
const RANK_WORDS: Readonly<Record<string, string>> = {
    A: 'Ace',
    '2': 'Two',
    '3': 'Three',
    '4': 'Four',
    '5': 'Five',
    '6': 'Six',
    '7': 'Seven',
    '8': 'Eight',
    '9': 'Nine',
    '10': 'Ten',
    J: 'Jack',
    Q: 'Queen',
    K: 'King',
};

function capitalised(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The accessible name of a card: "Queen of Spades" face up, "Face-down card" face down. */
export function cardName(id: CardId, faceUp: boolean): string {
    if (!faceUp) {
        return 'Face-down card';
    }
    const { rank, suitKey } = cardLabels(id);
    return `${RANK_WORDS[rank] ?? rank} of ${capitalised(suitKey)}`;
}

function countSuffix(count: number): string {
    if (count === 0) {
        return 'empty';
    }
    return count === 1 ? '1 card' : `${String(count)} cards`;
}

function pileLabel(ref: PileRef): string {
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
