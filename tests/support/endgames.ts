import { cardId, colorOf, rankOf, SUITS, suitOf, type Rank } from '../../src/domain/cards';
import { modeConfig, shuffle } from '../../src/domain/deal';
import { mulberry32 } from '../../src/domain/prng';
import type { CardId, Column, GameState, Mode, Suit, Tableau, TableauCard } from '../../src/domain/types';
import { isValidGameState } from '../../src/domain/validate';

/** Unwraps a value the generator's own arithmetic guarantees to exist. */
function required<T>(value: T | undefined): T {
    if (value === undefined) {
        throw new RangeError('missing element');
    }
    return value;
}

/** The trailing cards of a column that form a face-up run: each one rank below and the other colour to the one before. */
function runStart(ids: readonly CardId[]): number {
    let start = ids.length - 1;
    while (start > 0) {
        const parent = required(ids[start - 1]);
        const child = required(ids[start]);
        if (colorOf(parent) === colorOf(child) || rankOf(parent) !== rankOf(child) + 1) {
            break;
        }
        start--;
    }
    return start;
}

/**
 * A seeded endgame: `off` cards are not on their foundations, the other cards are. Each suit leaves its top ranks off,
 * the split between suits, the piles the cards go to and their order all come from `seed`. The cards that are off
 * go to the stock, the waste and the seven columns (one card each before any column gets a second); a column shows its trailing run face up and everything under it face
 * down, as a game in progress does. The same arguments always give the same position.
 */
export function endgameFromSeed(seed: number, mode: Mode, off: number, passes = 1, maxTalon = off): GameState {
    const rng = mulberry32(seed);
    const perSuit: [number, number, number, number] = [0, 0, 0, 0];
    for (let placed = 0; placed < off;) {
        const suit = Math.floor(rng() * 4) as Suit;
        if (perSuit[suit] < 13) {
            perSuit[suit]++;
            placed++;
        }
    }
    const foundations = SUITS.map((suit) =>
        Array.from({ length: 13 - perSuit[suit] }, (_, i) => cardId(suit, (i + 1) as Rank)),
    ) as unknown as GameState['foundations'];
    const loose: CardId[] = SUITS.flatMap((suit) =>
        Array.from({ length: perSuit[suit] }, (_, i) => cardId(suit, (13 - i) as Rank)),
    );
    const cards = shuffle(loose, rng);
    const talonSize = Math.floor(rng() * (Math.min(cards.length, maxTalon) + 1));
    const wasteSize = Math.floor(rng() * (Math.min(talonSize, 4) + 1));
    const stock = cards.slice(wasteSize, talonSize);
    const waste = cards.slice(0, wasteSize);
    const piles: CardId[][] = Array.from({ length: 7 }, () => []);
    // One card to each column first, so the columns are not all free for a King to wander into.
    cards.slice(talonSize).forEach((id, i) => {
        required(piles[i < 7 ? i : Math.floor(rng() * 7)]).push(id);
    });
    const tableau = piles.map((ids): Column => {
        const start = runStart(ids);
        return ids.map((id, i): TableauCard => ({ id, up: i >= start }));
    }) as unknown as Tableau;
    const config = modeConfig(mode);
    return {
        seed,
        mode,
        draw: config.draw,
        scoring: config.scoring,
        verdict: 'random',
        attempts: 1,
        tableau,
        stock,
        waste,
        foundations,
        score: 0,
        moves: 0,
        passes,
        elapsedMs: 0,
        undos: 0,
        started: false,
        status: 'playing',
    };
}

const RANK_OF_CHAR: Readonly<Record<string, Rank>> = {
    A: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    T: 10,
    J: 11,
    Q: 12,
    K: 13,
};
const SUIT_OF_CHAR: Readonly<Record<string, 0 | 1 | 2 | 3>> = { h: 0, d: 1, c: 2, s: 3 };

/** `Qs` is the queen of spades; ranks are A 2-9 T J Q K, suits h d c s. */
function parseCard(text: string): CardId {
    const rank = RANK_OF_CHAR[text.charAt(0)];
    const suit = SUIT_OF_CHAR[text.charAt(1)];
    if (rank === undefined || suit === undefined || text.length !== 2) {
        throw new RangeError(`not a card: ${text}`);
    }
    return cardId(suit, rank);
}

/** Cards separated by spaces, bottom first; a leading `_` marks a face-down tableau card. */
function parseCards(text: string): { id: CardId; up: boolean }[] {
    return text
        .split(' ')
        .filter((word) => word !== '')
        .map((word) =>
            word.startsWith('_') ? { id: parseCard(word.slice(1)), up: false } : { id: parseCard(word), up: true },
        );
}

export interface Layout {
    readonly mode: Mode;
    /** Up to seven columns, bottom card first; the rest are empty. */
    readonly columns: readonly string[];
    /** The stock, bottom first (a draw takes cards from its end). */
    readonly stock?: string;
    /** The waste, bottom first (its last card is the top). */
    readonly waste?: string;
    readonly passes?: number;
}

/**
 * A hand-written endgame. Every card not listed is on its foundation, so a suit's listed ranks must be its top ranks:
 * the foundation height is one below the lowest listed rank. Throws if the cards do not make up the deck.
 */
export function layout(spec: Layout): GameState {
    const columns = Array.from({ length: 7 }, (_, i) => parseCards(spec.columns[i] ?? ''));
    const stock = parseCards(spec.stock ?? '').map((card) => card.id);
    const waste = parseCards(spec.waste ?? '').map((card) => card.id);
    const loose = [...columns.flat().map((card) => card.id), ...stock, ...waste];
    const low: [number, number, number, number] = [14, 14, 14, 14];
    for (const id of loose) {
        low[suitOf(id)] = Math.min(low[suitOf(id)], rankOf(id));
    }
    const foundations = SUITS.map((suit) =>
        Array.from({ length: Math.min(13, low[suit] - 1) }, (_, i) => cardId(suit, (i + 1) as Rank)),
    ) as unknown as GameState['foundations'];
    const config = modeConfig(spec.mode);
    const state: GameState = {
        seed: 0,
        mode: spec.mode,
        draw: config.draw,
        scoring: config.scoring,
        verdict: 'random',
        attempts: 1,
        tableau: columns as unknown as Tableau,
        stock,
        waste,
        foundations,
        score: 0,
        moves: 0,
        passes: spec.passes ?? 1,
        elapsedMs: 0,
        undos: 0,
        started: false,
        status: 'playing',
    };
    if (!isValidGameState(state)) {
        throw new RangeError('the listed cards are not the cards missing from the foundations');
    }
    return state;
}
