/**
 * The pinned endgames of the ordered-talon search's cross-check (design D5): Draw 3 and Vegas positions with at most 14
 * cards off the foundations, small enough for the exhaustive search in `tests/support/bruteForce.ts` to settle.
 *
 * Most are seeded (`endgameFromSeed`, the arguments are the whole recipe); the rest are written out (`layout`). Each
 * entry pins what the exhaustive search finds, `wins`, and names what makes the position worth having in `covers`:
 *
 * - `talon-order`: the same cards win or lose depending on how the three-card draws group them.
 * - `pass-limit`: the same Vegas cards win with a recycle left and lose without one.
 * - `part-way-pass`: stock and waste both hold cards, so a recycle is not the only way the talon moves on.
 * - `loose-safe-rule`: sending cards up by the domain's looser `isSafe` would lose the win.
 * - `waste-send`: sending the safe waste top up without branching would lose the win.
 * - `column-emptying-run`: no win without moving a whole run off a column with nothing face down.
 * - `foundation-to-column`: no win without taking a card back off a foundation.
 */
import type { GameState } from '../../src/domain/types';
import { endgameFromSeed, layout } from '../support/endgames';

export type Cover =
    | 'talon-order'
    | 'pass-limit'
    | 'part-way-pass'
    | 'loose-safe-rule'
    | 'waste-send'
    | 'column-emptying-run'
    | 'foundation-to-column';

export interface Endgame {
    readonly name: string;
    readonly state: GameState;
    /** What the exhaustive search finds: a win, or no win at all. */
    readonly wins: boolean;
    readonly covers: readonly Cover[];
}

/**
 * Seven single hearts, 7 to King, fill every column. None can move (no black card to take a red one, no empty column
 * for a King or a card taken back off a foundation) and none is next for its foundation until the talon cards below
 * the 7 are home, so the talon alone decides these positions.
 */
const DEAD_COLUMNS = ['7h', '8h', '9h', 'Th', 'Jh', 'Qh', 'Kh'] as const;

export const ENDGAMES: readonly Endgame[] = [
    {
        name: 'the grouping puts the 4 of hearts on top',
        state: layout({ mode: 'draw3', columns: DEAD_COLUMNS, stock: '4h 5h 6h' }),
        wins: true,
        covers: ['talon-order'],
    },
    {
        name: 'the grouping buries the 4 of hearts in the middle',
        state: layout({ mode: 'draw3', columns: DEAD_COLUMNS, stock: '5h 4h 6h' }),
        wins: false,
        covers: ['talon-order'],
    },
    {
        name: 'Vegas, two recycles left',
        state: layout({ mode: 'vegas', columns: DEAD_COLUMNS, waste: '5h 4h 3h 6h', passes: 1 }),
        wins: true,
        covers: ['pass-limit'],
    },
    {
        name: 'Vegas, one recycle left',
        state: layout({ mode: 'vegas', columns: DEAD_COLUMNS, waste: '5h 4h 3h 6h', passes: 2 }),
        wins: true,
        covers: ['pass-limit'],
    },
    {
        name: 'Vegas, no recycle left',
        state: layout({ mode: 'vegas', columns: DEAD_COLUMNS, waste: '5h 4h 3h 6h', passes: 3 }),
        wins: false,
        covers: ['pass-limit'],
    },
    {
        name: 'Draw 3, seed 60013: the safe waste top is needed as a spacer',
        state: endgameFromSeed(60013, 'draw3', 8),
        wins: true,
        covers: ['part-way-pass', 'waste-send'],
    },
    {
        name: 'Vegas pass 2, seed 60013: the safe waste top is needed as a spacer',
        state: endgameFromSeed(60013, 'vegas', 8, 2),
        wins: true,
        covers: ['part-way-pass', 'waste-send'],
    },
    {
        name: 'Draw 3, seed 1523: the loose safe rule loses it',
        state: endgameFromSeed(1523, 'draw3', 12, 1, 3),
        wins: true,
        covers: ['loose-safe-rule'],
    },
    {
        name: 'Vegas, seed 1523: the loose safe rule loses it',
        state: endgameFromSeed(1523, 'vegas', 12, 1, 3),
        wins: true,
        covers: ['loose-safe-rule'],
    },
    {
        name: 'Draw 3, seed 453: the loose safe rule loses it',
        state: endgameFromSeed(453, 'draw3', 13, 1, 3),
        wins: true,
        covers: ['loose-safe-rule'],
    },
    {
        name: 'Draw 3, seed 2641: needs a whole run moved off a column',
        state: endgameFromSeed(2641, 'draw3', 11, 1, 3),
        wins: true,
        covers: ['column-emptying-run'],
    },
    {
        name: 'Draw 3, seed 133: needs a King taken back off a foundation',
        state: endgameFromSeed(133, 'draw3', 7),
        wins: true,
        covers: ['foundation-to-column'],
    },
    {
        name: 'Draw 3, seed 726: cannot be won',
        state: endgameFromSeed(726, 'draw3', 9),
        wins: false,
        covers: ['part-way-pass'],
    },
    {
        name: 'Vegas pass 2, seed 726: cannot be won',
        state: endgameFromSeed(726, 'vegas', 9, 2),
        wins: false,
        covers: ['part-way-pass'],
    },
    {
        name: 'Draw 3, seed 1790: cannot be won',
        state: endgameFromSeed(1790, 'draw3', 9),
        wins: false,
        covers: [],
    },
    {
        name: 'Vegas pass 2, seed 1790: cannot be won',
        state: endgameFromSeed(1790, 'vegas', 9, 2),
        wins: false,
        covers: [],
    },
];
