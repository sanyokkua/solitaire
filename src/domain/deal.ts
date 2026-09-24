import { DECK_SIZE } from './cards';
import { mulberry32 } from './prng';
import { startingScore } from './scoring';
import type { CardId, Column, GameState, Mode, ScoringMode, TableauCol } from './types';

export interface ModeConfig {
    readonly draw: 1 | 3;
    readonly scoring: ScoringMode;
}

const MODE_CONFIG: Readonly<Record<Mode, ModeConfig>> = {
    draw1: { draw: 1, scoring: 'standard' },
    draw3: { draw: 3, scoring: 'standard' },
    vegas: { draw: 3, scoring: 'vegas' },
    daily: { draw: 1, scoring: 'standard' },
};

export function modeConfig(mode: Mode): ModeConfig {
    return MODE_CONFIG[mode];
}

export interface DealMeta {
    readonly verdict?: 'win' | 'random';
    readonly attempts?: number;
}

/** The 52 card ids in ascending order. */
export function orderedDeck(): CardId[] {
    return Array.from({ length: DECK_SIZE }, (_, id) => id);
}

/** Fisher–Yates (Durstenfeld): i from n-1 down to 1, j in [0, i]. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
}

/** Column `col` gets one card per row 0..col; deck index of (row, col) is 7*row - row*(row-1)/2 + (col-row). */
function dealColumn(deck: readonly CardId[], col: TableauCol): Column {
    return Array.from({ length: col + 1 }, (_, row) => {
        const index = 7 * row - (row * (row - 1)) / 2 + (col - row);
        const id = deck[index];
        if (id === undefined) {
            throw new RangeError(`deck has no card at index ${String(index)}`);
        }
        return { id, up: row === col };
    });
}

/**
 * Deals a fresh game row by row from a seeded shuffle; the stock keeps the remaining 24 cards. The seed is reduced to
 * an unsigned 32-bit integer first and recorded that way, so the deal's code can always be encoded.
 */
export function dealFromSeed(seed: number, mode: Mode, meta: DealMeta = {}): GameState {
    const canonicalSeed = seed >>> 0;
    const deck = shuffle(orderedDeck(), mulberry32(canonicalSeed));
    const { draw, scoring } = modeConfig(mode);
    return {
        seed: canonicalSeed,
        mode,
        draw,
        scoring,
        verdict: meta.verdict ?? 'random',
        attempts: meta.attempts ?? 1,
        tableau: [
            dealColumn(deck, 0),
            dealColumn(deck, 1),
            dealColumn(deck, 2),
            dealColumn(deck, 3),
            dealColumn(deck, 4),
            dealColumn(deck, 5),
            dealColumn(deck, 6),
        ],
        stock: deck.slice(28),
        waste: [],
        foundations: [[], [], [], []],
        score: startingScore(scoring),
        moves: 0,
        passes: 1,
        elapsedMs: 0,
        started: false,
        status: 'playing',
    };
}
