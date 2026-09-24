import type { CardId, Suit } from './types';

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type Color = 'red' | 'black';
export type SuitKey = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export const DECK_SIZE = 52;
const RANKS_PER_SUIT = 13;

export const RANK_LABELS: Readonly<Record<Rank, string>> = {
    1: 'A',
    2: '2',
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: 'J',
    12: 'Q',
    13: 'K',
};

export const SUIT_KEYS: Readonly<Record<Suit, SuitKey>> = { 0: 'hearts', 1: 'diamonds', 2: 'clubs', 3: 'spades' };

export const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = { 0: '♥', 1: '♦', 2: '♣', 3: '♠' };

/** Left-to-right foundation slots: hearts, clubs, diamonds, spades (alternating colours). */
export const FOUNDATION_DISPLAY_ORDER: readonly [Suit, Suit, Suit, Suit] = [0, 2, 1, 3];

export function isCardId(value: unknown): value is CardId {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < DECK_SIZE;
}

export function suitOf(id: CardId): Suit {
    return Math.floor(id / RANKS_PER_SUIT) as Suit;
}

export function rankOf(id: CardId): Rank {
    return ((id % RANKS_PER_SUIT) + 1) as Rank;
}

export function cardId(suit: Suit, rank: Rank): CardId {
    return suit * RANKS_PER_SUIT + rank - 1;
}

export function suitColor(suit: Suit): Color {
    return suit < 2 ? 'red' : 'black';
}

export function colorOf(id: CardId): Color {
    return suitColor(suitOf(id));
}

export function cardLabels(id: CardId): {
    readonly rank: string;
    readonly suitKey: SuitKey;
    readonly suitSymbol: string;
} {
    const suit = suitOf(id);
    return { rank: RANK_LABELS[rankOf(id)], suitKey: SUIT_KEYS[suit], suitSymbol: SUIT_SYMBOLS[suit] };
}
