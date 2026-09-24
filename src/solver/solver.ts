import { colorOf, DECK_SIZE, rankOf, suitOf } from '../domain/cards';
import { isWon, passLimit } from '../domain/rules';
import type { CardId, Command, GameState, Suit } from '../domain/types';
import { expandLine, type SolverMove } from './line';

export type SolveVerdict = 'win' | 'loss' | 'unknown';

export interface SolveResult {
    readonly verdict: SolveVerdict;
    /** Distinct not-won positions expanded; `budget + 1` when the budget stopped the search. */
    readonly nodes: number;
    /** A winning line of player commands; present only on a `win`. */
    readonly line?: readonly Command[];
}

/** A column: every card id, bottom first; the first `down` of them are face down. */
interface Col {
    cards: CardId[];
    down: number;
}

/** Foundation heights, indexed by suit. */
type Heights = [number, number, number, number];

/**
 * A search position. The talon is `[...stock, ...waste]` in the engine's array order and cards leave it by in-place
 * splice: with Draw 1 and unlimited passes every talon card is reachable, so only the canonical key treats it as a
 * set, while the array order fixes the exploration order (D1).
 */
interface Position {
    cols: Col[];
    talon: CardId[];
    f: Heights;
}

/**
 * The five move kinds. `pri` is the try order, lowest first (D1 table): 0 column to foundation, 1 talon to
 * foundation, 2 run with face-down cards below it, 3 talon to column, 4 partial run, 5 King-headed partial run
 * into the empty column, 6 run from a fully face-up column, 7 foundation to column.
 */
type Move =
    | { readonly t: 'cf'; readonly from: number; readonly pri: number }
    | { readonly t: 'tf'; readonly at: number; readonly pri: number }
    | { readonly t: 'cc'; readonly from: number; readonly to: number; readonly at: number; readonly pri: number }
    | { readonly t: 'tc'; readonly at: number; readonly to: number; readonly pri: number }
    | { readonly t: 'fc'; readonly suit: Suit; readonly to: number; readonly pri: number };

/**
 * An expanded node awaiting the rest of its moves; the explicit stack replaces the reference's recursion. `via` holds
 * the move that led here and the safe sends made on arrival (the root has only its safe sends), in the order played.
 */
interface Frame {
    readonly node: Position;
    readonly moves: readonly Move[];
    readonly via: readonly SolverMove[];
    next: number;
}

const KING = 13;
const SUITS: readonly Suit[] = [0, 1, 2, 3];

/** Unwraps a value the search's own invariants guarantee to exist. */
function required<T>(value: T | undefined): T {
    if (value === undefined) {
        throw new Error('solver invariant violated: missing element');
    }
    return value;
}

function canFoundation(id: CardId, f: Heights): boolean {
    return f[suitOf(id)] === rankOf(id) - 1;
}

/** A card fits a column when it is a King on an empty column, or one rank below the top in the other colour. */
function fits(id: CardId, col: Col): boolean {
    if (col.cards.length === 0) {
        return rankOf(id) === KING;
    }
    const top = required(col.cards[col.cards.length - 1]);
    return colorOf(top) !== colorOf(id) && rankOf(top) === rankOf(id) + 1;
}

/** Turning up the last face-down card of a column: nothing face up is left below it. */
function fix(col: Col): void {
    if (col.down > 0 && col.down === col.cards.length) {
        col.down--;
    }
}

function clone(node: Position): Position {
    return {
        cols: node.cols.map((col) => ({ cards: col.cards.slice(), down: col.down })),
        talon: node.talon.slice(),
        f: [...node.f],
    };
}

function toPosition(state: GameState): Position {
    return {
        cols: state.tableau.map((column) => {
            let down = 0;
            while (down < column.length && column[down]?.up === false) {
                down++;
            }
            return { cards: column.map((card) => card.id), down };
        }),
        talon: [...state.stock, ...state.waste],
        f: [
            state.foundations[0].length,
            state.foundations[1].length,
            state.foundations[2].length,
            state.foundations[3].length,
        ],
    };
}

/**
 * Sends every safe card to its foundation until nothing changes: face-up column tops 0 to 6, then the whole talon in
 * array order. The bound on the opposite-colour heights is read once at the start of each pass, the foundation
 * heights themselves are live (D1). Same rule as the domain's `isSafe`, evaluated on the search's own heights. Each
 * send is appended to `sends` as it happens.
 */
function safe(node: Position, sends: SolverMove[]): void {
    const { f, talon } = node;
    let changed = true;
    while (changed) {
        changed = false;
        const minRed = Math.min(f[0], f[1]);
        const minBlack = Math.min(f[2], f[3]);
        const isSafe = (id: CardId): boolean =>
            canFoundation(id, f) && (rankOf(id) <= 2 || rankOf(id) <= (colorOf(id) === 'red' ? minBlack : minRed) + 1);
        for (const [c, col] of node.cols.entries()) {
            if (col.cards.length > col.down) {
                const top = required(col.cards[col.cards.length - 1]);
                if (isSafe(top)) {
                    sends.push({ t: 'cf', col: c });
                    col.cards.pop();
                    f[suitOf(top)]++;
                    fix(col);
                    changed = true;
                }
            }
        }
        for (let i = 0; i < talon.length; i++) {
            const id = required(talon[i]);
            if (isSafe(id)) {
                sends.push({ t: 'tf', card: id });
                talon.splice(i, 1);
                f[suitOf(id)]++;
                changed = true;
                i--;
            }
        }
    }
}

/** Two nodes are the same when foundations match, columns match ignoring their order, and talons match as sets. */
function key(node: Position): string {
    const cols = node.cols.map((col) => `${String(col.down)}:${col.cards.join(',')}`).sort();
    const talon = node.talon.slice().sort((a, b) => a - b);
    return `${node.f.join('.')}|${cols.join('/')}|${talon.join(',')}`;
}

/**
 * Every move from a node, tried in priority order (stable sort: generation order breaks ties). Pruned: a King that
 * already starts a column with nothing face down, and any empty column but the first. A partial run is offered only
 * when the card it uncovers can go to its foundation.
 */
function gen(node: Position): Move[] {
    const { cols, talon, f } = node;
    const out: Move[] = [];
    const emptyIdx = cols.findIndex((col) => col.cards.length === 0);
    cols.forEach((col, from) => {
        if (col.cards.length > col.down && canFoundation(required(col.cards[col.cards.length - 1]), f)) {
            out.push({ t: 'cf', from, pri: 0 });
        }
    });
    talon.forEach((id, at) => {
        if (canFoundation(id, f)) {
            out.push({ t: 'tf', at, pri: 1 });
        }
    });
    cols.forEach((col, from) => {
        for (let at = col.down; at < col.cards.length; at++) {
            const id = required(col.cards[at]);
            const base = at === col.down;
            if (!base && !canFoundation(required(col.cards[at - 1]), f)) {
                continue;
            }
            if (base && col.down === 0 && rankOf(id) === KING) {
                continue;
            }
            cols.forEach((dest, to) => {
                if (from === to) {
                    return;
                }
                if (dest.cards.length === 0) {
                    if (rankOf(id) === KING && to === emptyIdx) {
                        out.push({ t: 'cc', from, to, at, pri: base && col.down > 0 ? 2 : 5 });
                    }
                } else if (fits(id, dest)) {
                    out.push({ t: 'cc', from, to, at, pri: base ? (col.down > 0 ? 2 : 6) : 4 });
                }
            });
        }
    });
    talon.forEach((id, at) => {
        cols.forEach((dest, to) => {
            if (dest.cards.length > 0 ? fits(id, dest) : rankOf(id) === KING && to === emptyIdx) {
                out.push({ t: 'tc', at, to, pri: 3 });
            }
        });
    });
    for (const suit of SUITS) {
        if (f[suit] === 0) {
            continue;
        }
        const id = suit * 13 + f[suit] - 1;
        cols.forEach((dest, to) => {
            if (dest.cards.length > 0 && fits(id, dest)) {
                out.push({ t: 'fc', suit, to, pri: 7 });
            }
        });
    }
    return out.sort((a, b) => a.pri - b.pri);
}

/** The move in replayable terms; read before `apply`, because talon positions shift once a card has left. */
function toSolverMove(node: Position, move: Move): SolverMove {
    switch (move.t) {
        case 'cf':
            return { t: 'cf', col: move.from };
        case 'tf':
            return { t: 'tf', card: required(node.talon[move.at]) };
        case 'cc':
            return { t: 'cc', from: move.from, index: move.at, to: move.to };
        case 'tc':
            return { t: 'tc', card: required(node.talon[move.at]), to: move.to };
        case 'fc':
            return { t: 'fc', suit: move.suit, to: move.to };
    }
}

function apply(node: Position, move: Move): void {
    switch (move.t) {
        case 'cf': {
            const col = required(node.cols[move.from]);
            node.f[suitOf(required(col.cards.pop()))]++;
            fix(col);
            break;
        }
        case 'tf':
            node.f[suitOf(required(node.talon.splice(move.at, 1)[0]))]++;
            break;
        case 'cc': {
            const source = required(node.cols[move.from]);
            required(node.cols[move.to]).cards.push(...source.cards.splice(move.at));
            fix(source);
            break;
        }
        case 'tc':
            required(node.cols[move.to]).cards.push(required(node.talon.splice(move.at, 1)[0]));
            break;
        case 'fc':
            node.f[move.suit]--;
            required(node.cols[move.to]).cards.push(move.suit * 13 + node.f[move.suit]);
            break;
    }
}

type Outcome = 'win' | 'unknown' | 'continue';

/**
 * Bounded depth-first search for a win from a Draw 1, unlimited-pass position: an iterative port of the mockup's
 * `solveDraw1` (D1) that visits nodes and counts them in the same order. A `loss` only means the search ran out of
 * moves to try. A `win` carries the line of player commands (draws and moves, never `autoFoundation`) that replays
 * through `applyCommand` to a won game; a won position gives an empty line. Positions it cannot search (Draw 3,
 * Vegas) give `unknown` with no nodes. The given state is never modified.
 */
export function solve(state: GameState, budget: number): SolveResult {
    if (state.draw !== 1 || Number.isFinite(passLimit(state.mode))) {
        return { verdict: 'unknown', nodes: 0 };
    }
    if (isWon(state)) {
        return { verdict: 'win', nodes: 0, line: [] };
    }
    const seen = new Set<string>();
    const stack: Frame[] = [];
    let nodes = 0;
    let path: SolverMove[] = [];

    /** Node counting order: safe moves, win check, visited check, record, then the budget. */
    const enter = (node: Position, branch: readonly SolverMove[]): Outcome => {
        const via = [...branch];
        safe(node, via);
        if (node.f[0] + node.f[1] + node.f[2] + node.f[3] === DECK_SIZE) {
            path = [...stack.flatMap((frame) => frame.via), ...via];
            return 'win';
        }
        const id = key(node);
        if (seen.has(id)) {
            return 'continue';
        }
        seen.add(id);
        if (++nodes > budget) {
            return 'unknown';
        }
        stack.push({ node, moves: gen(node), via, next: 0 });
        return 'continue';
    };

    let outcome = enter(toPosition(state), []);
    while (outcome === 'continue') {
        const frame = stack[stack.length - 1];
        if (frame === undefined) {
            return { verdict: 'loss', nodes };
        }
        const move = frame.moves[frame.next++];
        if (move === undefined) {
            stack.pop();
            continue;
        }
        const branch = toSolverMove(frame.node, move);
        const child = clone(frame.node);
        apply(child, move);
        outcome = enter(child, [branch]);
    }
    return outcome === 'win' ? { verdict: outcome, nodes, line: expandLine(state, path) } : { verdict: outcome, nodes };
}
