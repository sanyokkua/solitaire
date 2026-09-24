import type { Command, GameState, Mode, PileRef } from '../../src/domain/types';

export interface DealFixture {
    readonly name: string;
    readonly seed: number;
    readonly mode: Mode;
    /** Expected deal code, computed by hand (mode letter + seed in upper-case base 36, seven characters). */
    readonly code: string;
}

/** Covers all four modes and both extremes of the 32-bit seed range. */
export const DEAL_FIXTURES: readonly DealFixture[] = [
    { name: 'draw-one deal from seed 1', seed: 1, mode: 'draw1', code: '1-0000001' },
    { name: 'draw-three deal from seed 42', seed: 42, mode: 'draw3', code: '3-0000016' },
    { name: 'vegas deal from the maximum seed', seed: 4294967295, mode: 'vegas', code: 'V-1Z141Z3' },
    { name: 'daily deal from seed 0', seed: 0, mode: 'daily', code: 'D-0000000' },
];

/** Deck order recovered from a dealt state by the row-by-row rule, independent of the implementation. */
export function deckOrderOf(state: GameState): number[] {
    const order: number[] = [];
    for (let row = 0; row < 7; row++) {
        for (let col = row; col < 7; col++) {
            const card = state.tableau[col]?.[row];
            if (card === undefined) {
                throw new Error(`missing card at row ${String(row)}, column ${String(col)}`);
            }
            order.push(card.id);
        }
    }
    return [...order, ...state.stock];
}

export interface GoldenDeal {
    readonly seed: number;
    readonly mode: Mode;
    readonly permutation: readonly number[];
}

export const GOLDEN_DEAL: GoldenDeal = {
    seed: 1,
    mode: 'draw1',
    // Shuffled deck order for seed 1 (deal order: rows 0-6 across the columns, then the 24 stock cards
    // bottom-to-top). Computed by the mockup's mulberry32/shuffle/dealFrom reference functions, not by
    // the code under test (design D18).
    // prettier-ignore
    permutation: [
        24, 44, 23, 10, 43, 31, 50, 41, 6, 29, 35, 22, 40, 34, 11, 3, 49, 33, 8, 14, 4, 27, 45, 38, 30, 7, 21, 16,
        12, 1, 36, 37, 25, 47, 2, 17, 39, 9, 15, 5, 20, 19, 42, 18, 51, 28, 13, 46, 48, 26, 0, 32,
    ],
};

export interface WinningLine {
    readonly seed: number;
    readonly mode: Mode;
    /** Space-separated compact command tokens; see `parseLine`. */
    readonly line: string;
    readonly moves: number;
    readonly score: number;
    readonly passes: number;
}

// Recorded Draw 1 winning line (design D13). Seed 49: the shortest (117 commands) of the first five winning seeds, 3, 18, 19, 32 and 49.
// Generated once, locally, by driving Draw 1 games from seeds 1..2000 with `hint` as a greedy policy (a recycle
// advice is a plain draw) under a repeated-position guard: 265 of the 2000 seeds won. The generator is not
// committed. Every command is a counted move, so `moves` equals the token count.
export const WINNING_LINE: WinningLine = {
    seed: 49,
    mode: 'draw1',
    line:
        '3:3>2 d d d d W:3>4 2:2>4 2:1>F3 d d d d d W:7>F0 0:0>F0 1:1>0 d W:7>5 4:4>5 d W:7>5 d W:7>6 d ' +
        'W:7>1 5:5>1 d d W:8>F1 d W:8>5 4:3>5 4:2>F2 6:7>F2 1:8>F2 4:1>5 4:0>F3 6:6>5 3:2>4 3:1>F0 1:7>F0 ' +
        'W:7>3 5:4>3 5:3>6 5:2>F0 5:1>2 1:6>2 1:5>F0 d W:7>0 6:5>0 6:4>0 d W:7>F1 3:6>F1 d d W:8>F3 ' +
        '3:5>F3 2:2>F3 6:3>F3 2:1>1 2:0>F3 d W:8>5 d W:8>F2 d d W:9>4 d d d W:1>F2 d W:1>2 6:2>2 6:1>0 ' +
        '6:0>F1 3:4>F1 1:5>F1 3:3>F2 1:4>F2 0:5>F2 3:2>F0 1:3>F0 0:4>F0 1:2>F2 3:1>F3 W:0>F1 5:1>F1 ' +
        '3:0>F1 1:1>F1 5:0>F3 0:3>F3 0:2>F1 d W:0>F1 d W:0>F0 d W:0>3 d W:0>F3 4:1>F3 3:0>F3 0:1>4 0:0>F1 ' +
        'd W:0>F0 2:1>F0 d W:0>F2 1:0>F2 4:1>F2 2:0>F2 4:0>F0',
    moves: 117,
    score: 585,
    passes: 2,
};

const TABLEAU_COLS = [0, 1, 2, 3, 4, 5, 6] as const;
const SUITS = [0, 1, 2, 3] as const;

/** Reads a pile token: `W` (waste), `0`-`6` (tableau column) or `F0`-`F3` (foundation of that suit). */
function parsePile(token: string, whole: string, allowWaste: boolean): PileRef {
    if (allowWaste && token === 'W') return { pile: 'waste' };
    const col = TABLEAU_COLS.find((value) => String(value) === token);
    if (col !== undefined) return { pile: 'tableau', col };
    const suit = SUITS.find((value) => `F${String(value)}` === token);
    if (suit !== undefined) return { pile: 'foundation', suit };
    throw new Error(`malformed token "${whole}"`);
}

/**
 * Expands a compact line into commands. Tokens: `d` draws or recycles; `fW` / `f0`..`f6` send the waste or
 * that column's top card to its foundation; `SRC:INDEX>DST` moves the group at INDEX of SRC (`W`, `0`-`6`,
 * `F0`-`F3`) onto DST (`0`-`6`, `F0`-`F3`). Throws on any malformed token.
 */
export function parseLine(line: string): Command[] {
    return line
        .split(/\s+/)
        .filter((token) => token !== '')
        .map((token): Command => {
            if (token === 'd') return { type: 'draw' };
            if (/^f[W0-6]$/.test(token)) {
                return { type: 'autoFoundation', from: parsePile(token.slice(1), token, true) };
            }
            const match = /^([W0-6]|F[0-3]):(\d+)>([0-6]|F[0-3])$/.exec(token);
            if (match === null) throw new Error(`malformed token "${token}"`);
            const [, from = '', index = '', to = ''] = match;
            return {
                type: 'move',
                from: parsePile(from, token, true),
                index: Number(index),
                to: parsePile(to, token, false),
            };
        });
}
