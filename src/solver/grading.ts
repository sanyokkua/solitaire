import { applyCommand } from '../domain/engine';
import { hintCandidates } from '../domain/hint';
import { mulberry32 } from '../domain/prng';
import { canRecycle, isWon } from '../domain/rules';
import type { Command, GameState, Grade, Mode } from '../domain/types';
import { search } from './search';

/** What a caller asks selection for: a specific grade, or whichever proven deal comes first. */
export type GradeTarget = 'any' | Grade;

/** Survival score that makes a deal Easy (at least `easyMin`) or Hard (at most `hardMax`); Medium lies between. */
interface Thresholds {
    readonly easyMin: number;
    readonly hardMax: number;
}

export interface GradingParams {
    /** Playouts per deal, M. */
    readonly playouts: number;
    /** The chance the player takes each candidate it reaches while walking the list. */
    readonly takeProbability: number;
    /** The chance the player draws or recycles although it has a productive move. */
    readonly unforcedDrawProbability: number;
    /** The most commands one playout may apply. */
    readonly stepCap: number;
    /** A playout's position is put to the solver after every this many commands. */
    readonly checkpointEvery: number;
    /** The most checkpoints one playout is asked about; surviving them all is the top score of a playout. */
    readonly maxCheckpoints: number;
    /** Nodes the solver may search at one checkpoint. */
    readonly checkpointBudget: number;
    /** Per mode, over the survival score (0 to `playouts * maxCheckpoints`); Daily reads the Draw 1 row. */
    readonly thresholds: Readonly<Record<Exclude<Mode, 'daily'>, Thresholds>>;
}

/**
 * Grading v1 (D6): how forgiving a proven-winnable deal is. Seeded human-like playouts (`playout`) walk the deal, and at
 * checkpoints the solver says whether the position is still provably winnable; the more checkpoints survive, the easier
 * the deal. The parameters, the playout rules and the thresholds together are one version: changing any of them is a
 * new grading version, made on purpose by updating the pinned grades in `tests/fixtures/gradingGolden.ts`.
 */
export const GRADING_V1: GradingParams = {
    playouts: 8,
    takeProbability: 0.6,
    unforcedDrawProbability: 0.05,
    stepCap: 1000,
    checkpointEvery: 10,
    maxCheckpoints: 10,
    checkpointBudget: 3000,
    thresholds: {
        draw1: { easyMin: 62, hardMax: 43 },
        draw3: { easyMin: 30, hardMax: 12 },
        vegas: { easyMin: 8, hardMax: 0 },
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

/** The grade that a survival `score` gives in `mode`. */
export function gradeOf(score: number, mode: Mode, params: GradingParams = GRADING_V1): Grade {
    const { easyMin, hardMax } = params.thresholds[mode === 'daily' ? 'draw1' : mode];
    if (score >= easyMin) return 'easy';
    return score <= hardMax ? 'hard' : 'medium';
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
 * last board move, so a full cycle played nothing), after `params.stepCap` commands, or when `onStep` returns `false`;
 * `onStep` sees each position that is not yet won, with the number of commands applied so far. Only a win counts.
 */
export function playout(
    start: GameState,
    rng: () => number,
    params: GradingParams = GRADING_V1,
    onStep?: (state: GameState, commands: number) => boolean,
): Playout {
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
        if (!isWon(state) && onStep?.(state, commands.length) === false) break;
    }
    return { won: isWon(state), commands };
}

/** What the solver says of a position within a node budget: the shape of `search(...).verdict`. */
export type Judge = (state: GameState, budget: number) => 'win' | 'loss' | 'unknown';

const solverJudge: Judge = (state, budget) => search(state, budget).verdict;

/**
 * How many checkpoints of playout `index` of `deal` still hold a proven-winnable position, from 0 to
 * `params.maxCheckpoints`. It stops asking at the first checkpoint the solver cannot prove (`loss` and `unknown` alike),
 * and a playout that wins survives every checkpoint it had left.
 */
export function survival(
    deal: GameState,
    index: number,
    params: GradingParams = GRADING_V1,
    judge: Judge = solverJudge,
): number {
    let survived = 0;
    const result = playout(deal, mulberry32(playoutSeed(deal.seed, index)), params, (state, commands) => {
        if (commands % params.checkpointEvery !== 0) return true;
        if (judge(state, params.checkpointBudget) !== 'win') return false;
        survived++;
        return survived < params.maxCheckpoints;
    });
    return result.won ? params.maxCheckpoints : survived;
}

export interface DealGrade {
    readonly grade: Grade;
    /** The checkpoints survived, summed over the playouts. */
    readonly score: number;
}

/** Grades the dealt position of a proven-winnable deal: the survival of each of `params.playouts` playouts, summed and read through the mode's row. */
export function gradeDeal(deal: GameState, params: GradingParams = GRADING_V1, judge: Judge = solverJudge): DealGrade {
    let score = 0;
    for (let index = 0; index < params.playouts; index++) {
        score += survival(deal, index, params, judge);
    }
    return { grade: gradeOf(score, deal.mode, params), score };
}
