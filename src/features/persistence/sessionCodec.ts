import type { Column, Foundations, GameState, Tableau } from '../../domain/types';
import { isValidGameState } from '../../domain/validate';
import { utcDayKey } from '../deal/daily';

/**
 * The stored form of the unfinished game (D5 and D13): the position in play in full, and its undo and redo steps as
 * compact positions that `decodeSession` rebuilds into full `GameState`s.
 */

/** How many undo steps (the newest) and how many redo steps (the nearest) a record keeps. */
export const MAX_STORED_STEPS = 200;

/** The game as the writer sees it; structurally a subset of the game slice, so this module needs no store import. */
export interface SessionInput {
    readonly current: GameState | null;
    readonly history: readonly GameState[];
    readonly future: readonly GameState[];
    readonly dailyKey: string | null;
    readonly counted: boolean;
}

/** A decoded, fully validated game: every step is a complete `GameState` of the same deal as `current`. */
export interface StoredSession {
    readonly current: GameState;
    readonly history: readonly GameState[];
    readonly future: readonly GameState[];
    readonly dailyKey: string | null;
    readonly counted: boolean;
}

const SESSION_KEYS = ['current', 'history', 'future', 'dailyKey', 'counted'] as const;

/** Every `GameState` field; a stored position must have exactly these keys. */
const GAME_KEYS = [
    'seed',
    'mode',
    'draw',
    'scoring',
    'verdict',
    'attempts',
    'tableau',
    'stock',
    'waste',
    'foundations',
    'score',
    'moves',
    'passes',
    'elapsedMs',
    'undos',
    'started',
    'status',
] as const;

const CARD_KEYS = ['id', 'up'] as const;

/**
 * A stored step holds only what can differ between two positions of one deal. `elapsedMs`, `undos` and `started` are
 * included because a snapshot keeps the values it had when it was captured, so they cannot be copied from `current`.
 * The constant fields (seed, mode, draw, scoring, verdict, attempts) are copied from `current`, which makes "every step
 * belongs to the same deal" true by construction; `status` is always `playing` for a stored step.
 */
const STEP_KEYS = [
    'tableau',
    'stock',
    'waste',
    'foundations',
    'score',
    'moves',
    'passes',
    'elapsedMs',
    'undos',
    'started',
] as const;

/** A plain, non-null, non-array object: the shape every key check assumes it can read. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether `value` has every key in `required` and no key outside `required` and `optional`. Unknown keys fail. */
export function hasExactKeys(
    value: Record<string, unknown>,
    required: readonly string[],
    optional: readonly string[] = [],
): boolean {
    const keys = Object.keys(value);
    return (
        required.every((key) => Object.hasOwn(value, key)) &&
        keys.every((key) => required.includes(key) || optional.includes(key))
    );
}

/** A real UTC calendar date written as `YYYY-MM-DD`; `2026-02-30` and `2026-13-01` are not dates. */
export function isDayKey(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    // `setUTCFullYear` rather than `Date.UTC`, which would read the years 0 to 99 as 1900 to 1999.
    const date = new Date(0);
    date.setUTCFullYear(year ?? 0, (month ?? 1) - 1, day ?? 1);
    return utcDayKey(date) === value;
}

const isDayKeyOrNull = (value: unknown): value is string | null => value === null || isDayKey(value);

/** Whether every card of a stored tableau is exactly `{ id, up }`; a non-array tableau or column fails. */
function hasExactCardKeys(tableau: unknown): boolean {
    return (
        Array.isArray(tableau) &&
        tableau.every(
            (column) =>
                Array.isArray(column) && column.every((card) => isRecord(card) && hasExactKeys(card, CARD_KEYS)),
        )
    );
}

const cloneColumn = (column: Column): Column => column.map((card) => ({ id: card.id, up: card.up }));

const cloneTableau = (t: Tableau): Tableau => [
    cloneColumn(t[0]),
    cloneColumn(t[1]),
    cloneColumn(t[2]),
    cloneColumn(t[3]),
    cloneColumn(t[4]),
    cloneColumn(t[5]),
    cloneColumn(t[6]),
];

const cloneFoundations = (f: Foundations): Foundations => [[...f[0]], [...f[1]], [...f[2]], [...f[3]]];

/** A copy holding exactly the known fields in a fixed order, so nothing stray is written or accepted. */
function cloneGame(state: GameState): GameState {
    return {
        seed: state.seed,
        mode: state.mode,
        draw: state.draw,
        scoring: state.scoring,
        verdict: state.verdict,
        attempts: state.attempts,
        tableau: cloneTableau(state.tableau),
        stock: [...state.stock],
        waste: [...state.waste],
        foundations: cloneFoundations(state.foundations),
        score: state.score,
        moves: state.moves,
        passes: state.passes,
        elapsedMs: state.elapsedMs,
        undos: state.undos,
        started: state.started,
        status: state.status,
    };
}

/** The compact step of a snapshot, keys in a fixed order. */
function encodeStep(state: GameState): Record<(typeof STEP_KEYS)[number], unknown> {
    const copy = cloneGame(state);
    return {
        tableau: copy.tableau,
        stock: copy.stock,
        waste: copy.waste,
        foundations: copy.foundations,
        score: copy.score,
        moves: copy.moves,
        passes: copy.passes,
        elapsedMs: copy.elapsedMs,
        undos: copy.undos,
        started: copy.started,
    };
}

/**
 * The stored session of `game`, or `undefined` when nothing is resumable: no game, a game not yet started, or a won
 * one. History is oldest first, so the newest steps are its tail; the next redo is the last future step, so the
 * nearest steps are its tail as well.
 */
export function encodeSession(game: SessionInput): Record<(typeof SESSION_KEYS)[number], unknown> | undefined {
    const { current } = game;
    if (current === null || !current.started || current.status !== 'playing') return undefined;
    return {
        current: cloneGame(current),
        history: game.history.slice(-MAX_STORED_STEPS).map(encodeStep),
        future: game.future.slice(-MAX_STORED_STEPS).map(encodeStep),
        dailyKey: game.dailyKey,
        counted: game.counted,
    };
}

/** Rebuilds one step into a full position of `current`'s deal; `null` unless it is exactly a step and a valid game. */
function decodeStep(value: unknown, current: GameState): GameState | null {
    if (!isRecord(value) || !hasExactKeys(value, STEP_KEYS) || !hasExactCardKeys(value.tableau)) return null;
    const candidate: unknown = {
        seed: current.seed,
        mode: current.mode,
        draw: current.draw,
        scoring: current.scoring,
        verdict: current.verdict,
        attempts: current.attempts,
        tableau: value.tableau,
        stock: value.stock,
        waste: value.waste,
        foundations: value.foundations,
        score: value.score,
        moves: value.moves,
        passes: value.passes,
        elapsedMs: value.elapsedMs,
        undos: value.undos,
        started: value.started,
        status: 'playing',
    };
    return isValidGameState(candidate) ? cloneGame(candidate) : null;
}

/** Rebuilds a list of at most `MAX_STORED_STEPS` steps; `null` when the list or any step is not valid. */
function decodeSteps(value: unknown, current: GameState): GameState[] | null {
    if (!Array.isArray(value) || value.length > MAX_STORED_STEPS) return null;
    const steps: GameState[] = [];
    for (const item of value) {
        const step = decodeStep(item, current);
        if (step === null) return null;
        steps.push(step);
    }
    return steps;
}

/**
 * Accepts `value` only as a stored session: exactly the five known keys, a valid started and still-playing `current`,
 * a Daily date (only for a Daily deal) or `null`, a boolean `counted`, and valid step lists. `current` and every step
 * card have exactly their known keys. Total: never throws, returns `null` on any fault.
 */
export function decodeSession(value: unknown): StoredSession | null {
    if (!isRecord(value) || !hasExactKeys(value, SESSION_KEYS)) return null;
    const { current, history, future, dailyKey, counted } = value;
    if (!isValidGameState(current) || !current.started || current.status !== 'playing') return null;
    if (!hasExactKeys(current as unknown as Record<string, unknown>, GAME_KEYS) || !hasExactCardKeys(current.tableau)) {
        return null;
    }
    if (typeof counted !== 'boolean' || !isDayKeyOrNull(dailyKey)) return null;
    if (dailyKey !== null && current.mode !== 'daily') return null;
    const stored = cloneGame(current);
    const undoSteps = decodeSteps(history, stored);
    const redoSteps = decodeSteps(future, stored);
    if (undoSteps === null || redoSteps === null) return null;
    return { current: stored, history: undoSteps, future: redoSteps, dailyKey, counted };
}
