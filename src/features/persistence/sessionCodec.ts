import type { Column, Foundations, GameState, Tableau } from '../../domain/types';
import { isValidGameState } from '../../domain/validate';
import { hasExactKeys, isDayKey, isRecord } from './guards';

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

/** The record format a session was written in; it selects the key list of the stored game. */
export type RecordVersion = 1 | 2;

const SESSION_KEYS = ['current', 'history', 'future', 'dailyKey', 'counted'] as const;

/** Every `GameState` field of a version 1 record; a stored position must have exactly these keys. */
const GAME_KEYS_V1 = [
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

/** The stored game's keys in a version 2 record: the same as version 1 until the game gains a field. */
const GAME_KEYS_V2 = GAME_KEYS_V1;

const gameKeys = (version: RecordVersion): readonly string[] => (version === 1 ? GAME_KEYS_V1 : GAME_KEYS_V2);

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
 * Accepts `value` only as a stored session of the given record `version`: exactly the five known keys, a `current`
 * with exactly that version's game keys that is a valid started and still-playing game, a Daily date (only for a
 * Daily deal) or `null`, a boolean `counted`, and valid step lists. `current` and every step card have exactly their
 * known keys. The key check runs on the raw record, before any upgrade or validation. Total: never throws, returns
 * `null` on any fault.
 */
export function decodeSession(value: unknown, version: RecordVersion): StoredSession | null {
    if (!isRecord(value) || !hasExactKeys(value, SESSION_KEYS)) return null;
    const { current, history, future, dailyKey, counted } = value;
    if (!isRecord(current) || !hasExactKeys(current, gameKeys(version))) return null;
    if (!isValidGameState(current) || !current.started || current.status !== 'playing') return null;
    if (!hasExactCardKeys(current.tableau)) return null;
    if (typeof counted !== 'boolean' || !isDayKeyOrNull(dailyKey)) return null;
    if (dailyKey !== null && current.mode !== 'daily') return null;
    const stored = cloneGame(current);
    const undoSteps = decodeSteps(history, stored);
    const redoSteps = decodeSteps(future, stored);
    if (undoSteps === null || redoSteps === null) return null;
    return { current: stored, history: undoSteps, future: redoSteps, dailyKey, counted };
}
