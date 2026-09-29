import { applyCommand } from '../domain/engine';
import { hintCandidates } from '../domain/hint';
import { mulberry32 } from '../domain/prng';
import { canRecycle, isWon } from '../domain/rules';
import type { Command, GameState, Mode } from '../domain/types';

export type Grade = 'easy' | 'medium' | 'hard';

/** Easiest first: the distance between two grades is the difference of their positions. */
export const GRADES: readonly Grade[] = ['easy', 'medium', 'hard'];

/** What a caller asks selection for: a specific grade, or whichever proven deal comes first. */
export type GradeTarget = 'any' | Grade;

/** Winning playouts that make a deal Easy (at least `easyMin`) or Hard (at most `hardMax`); Medium lies between. */
interface Thresholds {
    readonly easyMin: number;
    readonly hardMax: number;
}

export interface GradingParams {
    /** Playouts per deal, N. */
    readonly playouts: number;
    /** The chance the player takes each candidate it reaches while walking the list. */
    readonly takeProbability: number;
    /** The chance the player draws or recycles although it has a productive move. */
    readonly unforcedDrawProbability: number;
    /** The most commands one playout may apply. */
    readonly stepCap: number;
    /** Per mode; a Daily deal is dealt and played like Draw 1, so it reads the Draw 1 row. */
    readonly thresholds: Readonly<Record<Exclude<Mode, 'daily'>, Thresholds>>;
}

/**
 * Grading v1 (D6): the parameters, the playout rules in `playout` and the thresholds together. Changing any of them is
 * a new grading version, made on purpose by updating the pinned grades in `tests/fixtures/gradingGolden.ts`.
 */
export const GRADING_V1: GradingParams = {
    playouts: 16,
    takeProbability: 0.6,
    unforcedDrawProbability: 0.05,
    stepCap: 1000,
    thresholds: {
        draw1: { easyMin: 10, hardMax: 2 },
        draw3: { easyMin: 10, hardMax: 2 },
        vegas: { easyMin: 10, hardMax: 2 },
    },
};

/** The MurmurHash3 32-bit finalizer: spreads every input bit over the whole output. */
export function fmix32(value: number): number {
    let h = value >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

/** The generator seed of playout `index` (from 0) of the deal with `seed`; it depends on these two numbers alone. */
export function playoutSeed(seed: number, index: number): number {
    return fmix32((seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0);
}

/** The grade that `wins` winning playouts give in `mode`. */
export function gradeOf(wins: number, mode: Mode, params: GradingParams = GRADING_V1): Grade {
    const { easyMin, hardMax } = params.thresholds[mode === 'daily' ? 'draw1' : mode];
    if (wins >= easyMin) return 'easy';
    return wins <= hardMax ? 'hard' : 'medium';
}

const DRAW: Command = { type: 'draw' };

/** The stock and waste arrangement; board moves are the only thing that makes a repeat of it progress. */
function talonKey(state: GameState): string {
    return `${state.stock.join(',')}|${state.waste.join(',')}`;
}

/**
 * The next command of the simulated player, or `undefined` when it has none. It decides from the productive moves
 * (`hintCandidates`, which see face-up cards only) and from whether the stock can be drawn from or recycled.
 */
function choose(state: GameState, rng: () => number, params: GradingParams): Command | undefined {
    const candidates = hintCandidates(state);
    const canDraw = state.stock.length > 0 || canRecycle(state);
    if (candidates.length === 0) return canDraw ? DRAW : undefined;
    if (canDraw && rng() < params.unforcedDrawProbability) return DRAW;
    // The last candidate is taken without a random value: reaching it leaves nothing to choose.
    const last = candidates.length - 1;
    return candidates[candidates.findIndex((_, i) => i === last || rng() < params.takeProbability)]?.command;
}

export interface Playout {
    readonly won: boolean;
    readonly commands: readonly Command[];
}

/**
 * Plays `start` as a human-like player that sees only face-up cards, drawing every random value from `rng`. It stops at
 * a win, when it has no move, draw or recycle left, at a stall (the talon returns to an arrangement it had since the
 * last board move, so a full cycle played nothing) or after `params.stepCap` commands; only a win counts.
 */
export function playout(start: GameState, rng: () => number, params: GradingParams = GRADING_V1): Playout {
    const commands: Command[] = [];
    let state = start;
    let seen = new Set([talonKey(state)]);
    while (!isWon(state) && commands.length < params.stepCap) {
        const command = choose(state, rng, params);
        if (command === undefined) break;
        state = applyCommand(state, command).state;
        commands.push(command);
        if (command.type === 'move') {
            seen = new Set([talonKey(state)]);
        } else {
            const key = talonKey(state);
            if (seen.has(key)) break;
            seen.add(key);
        }
    }
    return { won: isWon(state), commands };
}

export interface DealGrade {
    readonly grade: Grade;
    /** Winning playouts out of `params.playouts`. */
    readonly wins: number;
}

/** Grades the dealt position of a proven-winnable deal: `params.playouts` seeded playouts, read through the mode's row. */
export function gradeDeal(deal: GameState, params: GradingParams = GRADING_V1): DealGrade {
    let wins = 0;
    for (let index = 0; index < params.playouts; index++) {
        if (playout(deal, mulberry32(playoutSeed(deal.seed, index)), params).won) wins++;
    }
    return { grade: gradeOf(wins, deal.mode, params), wins };
}
