import { colorOf, DECK_SIZE, rankOf, suitOf } from '../domain/cards';
import { isWon, passLimit } from '../domain/rules';
import { stepTalon } from '../domain/talon';
import type { CardId, GameState, Pile, Suit } from '../domain/types';
import { isValidGameState } from '../domain/validate';
import { expandLine, type SolverMove } from './line';
import type { SolveResult } from './solver';

/** A column: every card id, bottom first; the first `down` of them are face down. */
interface Col {
    cards: CardId[];
    down: number;
}

/** Foundation heights, indexed by suit. */
type Heights = [number, number, number, number];

/**
 * A search position. The stock and the waste are the ordered piles the engine plays with (top last), because which
 * card a draw turns up depends on their exact order. `passes` is the pass in progress; it only matters, and only enters
 * the key, when the mode limits passes.
 */
interface Position {
    cols: Col[];
    stock: CardId[];
    waste: CardId[];
    f: Heights;
    passes: number;
}

/** A talon arrangement that drawing alone reaches, `draws` draws (recycles included) from the current one. */
interface Arrangement {
    readonly stock: readonly CardId[];
    readonly waste: readonly CardId[];
    readonly draws: number;
    readonly passes: number;
}

/**
 * The move kinds, `pri` being the try order, lowest first (D3): 0 column to foundation, 1 talon to foundation, 2 run
 * with face-down cards below it, 3 talon to column, 4 run from a fully face-up column, 5 partial run, 6 foundation to
 * column. A talon move is a macro: draw up to `at`, then play the waste top.
 */
type Move =
    | { readonly t: 'cf'; readonly from: number; readonly pri: number }
    | { readonly t: 'tf'; readonly at: Arrangement; readonly pri: number }
    | { readonly t: 'cc'; readonly from: number; readonly to: number; readonly index: number; readonly pri: number }
    | { readonly t: 'tc'; readonly at: Arrangement; readonly to: number; readonly pri: number }
    | { readonly t: 'fc'; readonly suit: Suit; readonly to: number; readonly pri: number };

/** An expanded node awaiting the rest of its moves; `via` is the steps that led here, safe sends included. */
interface Frame {
    readonly node: Position;
    readonly moves: readonly Move[];
    readonly via: readonly SolverMove[];
    next: number;
}

const KING = 13;

/** Unwraps a value the search's own invariants guarantee to exist. */
function required<T>(value: T | undefined): T {
    if (value === undefined) {
        throw new Error('ordered search invariant violated: missing element');
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
        stock: node.stock.slice(),
        waste: node.waste.slice(),
        f: [...node.f],
        passes: node.passes,
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
        stock: [...state.stock],
        waste: [...state.waste],
        f: [
            state.foundations[0].length,
            state.foundations[1].length,
            state.foundations[2].length,
            state.foundations[3].length,
        ],
        passes: state.passes,
    };
}

/**
 * The strict safe rule (D3): a card that can go up is sent without branching only when nothing can still need it as a
 * parent. That is a rank of at most 2, or both opposite-colour foundations at rank - 1 or more and the other
 * same-colour foundation at rank - 2 or more; the last clause is there because a foundation card may come back down
 * onto a column. Stricter than the domain's `isSafe`, which can discard a win.
 */
function isSafe(id: CardId, f: Heights): boolean {
    if (!canFoundation(id, f)) {
        return false;
    }
    const rank = rankOf(id);
    if (rank <= 2) {
        return true;
    }
    const suit = suitOf(id);
    const [first, second]: readonly [Suit, Suit] = suit < 2 ? [2, 3] : [0, 1];
    const partner: Suit = suit % 2 === 0 ? ((suit + 1) as Suit) : ((suit - 1) as Suit);
    return Math.min(f[first], f[second]) >= rank - 1 && f[partner] >= rank - 2;
}

/**
 * Sends every safe column top to its foundation until nothing changes, columns 0 to 6. The talon is left alone, the
 * waste top included: taking a card out of the waste moves every card behind it up a place in the next pass, and a
 * card that is safe as a parent may be the spacer that lets a needed card reach the waste top at all. The talon
 * send is a branch instead (priority 1). Each send is appended to `sends` as it happens.
 */
function safe(node: Position, sends: SolverMove[]): void {
    const { f } = node;
    let changed = true;
    while (changed) {
        changed = false;
        for (const [c, col] of node.cols.entries()) {
            if (col.cards.length > col.down) {
                const top = required(col.cards[col.cards.length - 1]);
                if (isSafe(top, f)) {
                    sends.push({ t: 'cf', col: c });
                    col.cards.pop();
                    f[suitOf(top)]++;
                    fix(col);
                    changed = true;
                }
            }
        }
    }
}

/**
 * Two nodes are the same when foundations match, columns match ignoring their order, and the stock and waste match
 * exactly, with the same passes left when passes are limited. Nothing coarser is safe: a part-way arrangement reaches
 * waste tops that the same cards after a recycle cannot.
 */
function key(node: Position, limited: boolean): string {
    const cols = node.cols.map((col) => `${String(col.down)}:${col.cards.join(',')}`).sort();
    const talon = `${node.stock.join(',')}|${node.waste.join(',')}`;
    return `${node.f.join('.')}|${cols.join('/')}|${talon}${limited ? `|${String(node.passes)}` : ''}`;
}

/**
 * Every talon arrangement drawing alone reaches, the current one first, built with the domain's `stepTalon`. It ends
 * when an arrangement repeats, or when a recycle is refused because the passes are used up.
 */
function arrangements(node: Position, draw: number, limit: number): Arrangement[] {
    const out: Arrangement[] = [];
    const seen = new Set<string>();
    let stock: Pile = node.stock;
    let waste: Pile = node.waste;
    let passes = node.passes;
    for (let draws = 0; ; draws++) {
        const id = `${stock.join(',')}|${waste.join(',')}`;
        if (seen.has(id)) {
            break;
        }
        seen.add(id);
        out.push({ stock, waste, draws, passes });
        const step = stepTalon(stock, waste, draw);
        if (step === undefined) {
            break;
        }
        if (step.recycled) {
            if (passes >= limit) {
                break;
            }
            passes++;
        }
        ({ stock, waste } = step);
    }
    return out;
}

/**
 * Every move from a node, tried in priority order (stable sort: generation order breaks ties). Pruned only where a
 * move can never be needed: a King already at the base of a column moving to an empty column, and any empty column
 * but the first. Partial runs, column-emptying runs and foundation-to-column moves are all offered, so `loss` proves
 * the position cannot be won.
 */
function gen(node: Position, draw: number, limit: number): Move[] {
    const { cols, f } = node;
    const out: Move[] = [];
    const emptyIdx = cols.findIndex((col) => col.cards.length === 0);
    const talon = arrangements(node, draw, limit).flatMap((at) => {
        const top = at.waste[at.waste.length - 1];
        return top === undefined ? [] : [{ at, top }];
    });
    cols.forEach((col, from) => {
        if (col.cards.length > col.down && canFoundation(required(col.cards[col.cards.length - 1]), f)) {
            out.push({ t: 'cf', from, pri: 0 });
        }
    });
    for (const { at, top } of talon) {
        if (canFoundation(top, f)) {
            out.push({ t: 'tf', at, pri: 1 });
        }
    }
    cols.forEach((col, from) => {
        for (let index = col.down; index < col.cards.length; index++) {
            const id = required(col.cards[index]);
            const whole = index === col.down;
            if (whole && col.down === 0 && rankOf(id) === KING) {
                continue;
            }
            cols.forEach((dest, to) => {
                if (from === to) {
                    return;
                }
                const wanted = dest.cards.length === 0 ? rankOf(id) === KING && to === emptyIdx : fits(id, dest);
                if (wanted) {
                    out.push({ t: 'cc', from, to, index, pri: !whole ? 5 : col.down > 0 ? 2 : 4 });
                }
            });
        }
    });
    for (const { at, top } of talon) {
        cols.forEach((dest, to) => {
            if (dest.cards.length > 0 ? fits(top, dest) : rankOf(top) === KING && to === emptyIdx) {
                out.push({ t: 'tc', at, to, pri: 3 });
            }
        });
    }
    for (const suit of [0, 1, 2, 3] as const) {
        if (f[suit] === 0) {
            continue;
        }
        const id = suit * 13 + f[suit] - 1;
        cols.forEach((dest, to) => {
            // A King from a finished foundation can take an empty column, to be a parent for a Queen.
            if (dest.cards.length > 0 ? fits(id, dest) : rankOf(id) === KING && to === emptyIdx) {
                out.push({ t: 'fc', suit, to, pri: 6 });
            }
        });
    }
    return out.sort((a, b) => a.pri - b.pri);
}

/** The steps that replay a move: for a talon move, its draws first, then the play of the card they turned up. */
function toSteps(move: Move): SolverMove[] {
    switch (move.t) {
        case 'cf':
            return [{ t: 'cf', col: move.from }];
        case 'tf':
            return [...drawSteps(move.at), { t: 'tf', card: wasteTopOf(move.at) }];
        case 'cc':
            return [{ t: 'cc', from: move.from, index: move.index, to: move.to }];
        case 'tc':
            return [...drawSteps(move.at), { t: 'tc', card: wasteTopOf(move.at), to: move.to }];
        case 'fc':
            return [{ t: 'fc', suit: move.suit, to: move.to }];
    }
}

function drawSteps(at: Arrangement): SolverMove[] {
    return Array.from({ length: at.draws }, (): SolverMove => ({ t: 'd' }));
}

function wasteTopOf(at: Arrangement): CardId {
    return required(at.waste[at.waste.length - 1]);
}

/** Moves the node to a talon arrangement, then takes the waste top off it. */
function takeTop(node: Position, at: Arrangement): CardId {
    node.stock = [...at.stock];
    node.waste = [...at.waste];
    node.passes = at.passes;
    return required(node.waste.pop());
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
            node.f[suitOf(takeTop(node, move.at))]++;
            break;
        case 'cc': {
            const source = required(node.cols[move.from]);
            required(node.cols[move.to]).cards.push(...source.cards.splice(move.index));
            fix(source);
            break;
        }
        case 'tc':
            required(node.cols[move.to]).cards.push(takeTop(node, move.at));
            break;
        case 'fc':
            node.f[move.suit]--;
            required(node.cols[move.to]).cards.push(move.suit * 13 + node.f[move.suit]);
            break;
    }
}

type Outcome = 'win' | 'unknown' | 'continue';

/**
 * Bounded depth-first search for a win from a Draw 3 or Vegas position, modelling the talon exactly: ordered stock and
 * waste, three-card draws, recycles, and in Vegas the passes left. Unlike the Draw 1 search a `loss` is a proof: every
 * reachable position was expanded, no move that could matter is pruned and no send that could discard a win is made
 * without branching. A `win` carries the line of player commands (draws, recycles included, and moves; never
 * `autoFoundation`) that replays through `applyCommand` to a won game; a won position gives an empty line. A position
 * that is invalid or draws one card gives `unknown` with no nodes. The given state is never modified.
 */
export function solveOrdered(state: GameState, budget: number): SolveResult {
    if (!isValidGameState(state) || state.draw !== 3) {
        return { verdict: 'unknown', nodes: 0 };
    }
    if (isWon(state)) {
        return { verdict: 'win', nodes: 0, line: [] };
    }
    const limit = passLimit(state.mode);
    const limited = Number.isFinite(limit);
    const seen = new Set<string>();
    const stack: Frame[] = [];
    let nodes = 0;
    let path: SolverMove[] = [];

    /** Node counting order: safe sends, win check, visited check, record, then the budget. */
    const enter = (node: Position, branch: readonly SolverMove[]): Outcome => {
        const via = [...branch];
        safe(node, via);
        if (node.f[0] + node.f[1] + node.f[2] + node.f[3] === DECK_SIZE) {
            path = [...stack.flatMap((frame) => frame.via), ...via];
            return 'win';
        }
        const id = key(node, limited);
        if (seen.has(id)) {
            return 'continue';
        }
        seen.add(id);
        if (++nodes > budget) {
            return 'unknown';
        }
        stack.push({ node, moves: gen(node, state.draw, limit), via, next: 0 });
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
        const child = clone(frame.node);
        apply(child, move);
        outcome = enter(child, toSteps(move));
    }
    return outcome === 'win' ? { verdict: outcome, nodes, line: expandLine(state, path) } : { verdict: outcome, nodes };
}
