import { rankOf, suitColor, suitOf } from './cards';
import { applyCommand } from './engine';
import { canDrop, canRecycle, column, groupAt, isWon, legalTargets } from './rules';
import type { CardId, Column, Command, GameEvent, GameState, PileRef, Suit, TableauCol } from './types';

const SUITS: readonly Suit[] = [0, 1, 2, 3];
const TABLEAU_COLS: readonly TableauCol[] = [0, 1, 2, 3, 4, 5, 6];
/** Ranks up to this are always safe to send: nothing can be built on an Ace or a Two that a foundation lacks. */
const ALWAYS_SAFE_RANK = 2;

/** Whether the next card of `card`'s suit is `card` itself. */
function isReady(state: GameState, card: CardId): boolean {
    return state.foundations[suitOf(card)].length === rankOf(card) - 1;
}

/**
 * Sending a ready card is safe when no tableau card could still need it as a resting place: that holds once both
 * opposite-colour foundations have reached at least one rank below it. Aces and Twos are always safe.
 */
export function isSafe(state: GameState, card: CardId): boolean {
    if (!isReady(state, card)) return false;
    const rank = rankOf(card);
    if (rank <= ALWAYS_SAFE_RANK) return true;
    const suit = suitOf(card);
    const oppositeHeights = SUITS.filter((other) => suitColor(other) !== suitColor(suit)).map(
        (other) => state.foundations[other].length,
    );
    return rank <= Math.min(...oppositeHeights) + 1;
}

interface Source {
    readonly from: PileRef;
    readonly index: number;
    readonly card: CardId;
}

/** Cards that can be grabbed from the tableau and waste, in canonical source order: columns 0→6, then the waste. */
function sourceCards(state: GameState): readonly Source[] {
    const candidates: readonly { readonly from: PileRef; readonly index: number }[] = [
        ...TABLEAU_COLS.map((col): { readonly from: PileRef; readonly index: number } => ({
            from: { pile: 'tableau', col },
            index: column(state, col).length - 1,
        })),
        { from: { pile: 'waste' }, index: state.waste.length - 1 },
    ];
    return candidates.flatMap(({ from, index }) => {
        const card = groupAt(state, from, index)?.[0];
        return card === undefined ? [] : [{ from, index, card }];
    });
}

/** The first safe card to send to a foundation, as a system-initiated command; `undefined` when none is safe. */
export function nextSafeMove(state: GameState): Extract<Command, { type: 'autoFoundation' }> | undefined {
    const source = sourceCards(state).find(({ card }) => isSafe(state, card));
    return source === undefined ? undefined : { type: 'autoFoundation', from: source.from };
}

export type MoveCommand = Extract<Command, { type: 'move' }>;
export type HintPriority = 1 | 2 | 3 | 4 | 5;

export interface MoveHint {
    readonly kind: 'move';
    readonly command: MoveCommand;
    /** The cards the move carries, lowest first. */
    readonly cards: readonly CardId[];
    readonly priority: HintPriority;
}

export type Hint = MoveHint | { readonly kind: 'draw' } | { readonly kind: 'recycle' };

function isTableau(to: PileRef): boolean {
    return to.pile === 'tableau';
}

function isEmptyColumn(state: GameState, to: PileRef): boolean {
    return to.pile === 'tableau' && column(state, to.col).length === 0;
}

/** The move of the group at `index` of `from` to the first legal target that `accepts`, if there is one. */
function moveHint(
    state: GameState,
    from: PileRef,
    index: number,
    priority: HintPriority,
    accepts: (to: PileRef) => boolean,
): MoveHint | undefined {
    const cards = groupAt(state, from, index);
    if (cards === undefined) return undefined;
    const to = legalTargets(state, cards, from).find(accepts);
    return to === undefined ? undefined : { kind: 'move', command: { type: 'move', from, index, to }, cards, priority };
}

/** The first of `hints` that is a move; every scan runs in canonical order. */
function firstMove(hints: readonly (MoveHint | undefined)[]): MoveHint | undefined {
    return hints.find((found) => found !== undefined);
}

/** Priority 1: a tableau top or the waste top onto its foundation. */
function sendHome(state: GameState): MoveHint | undefined {
    return firstMove(
        sourceCards(state).map(({ from, index }) => moveHint(state, from, index, 1, (to) => to.pile === 'foundation')),
    );
}

/** A whole face-up run sitting on a face-down card, moved to a column that `accepts` it (priorities 2 and 5). */
function revealingRun(
    state: GameState,
    priority: HintPriority,
    accepts: (to: PileRef) => boolean,
): MoveHint | undefined {
    return firstMove(
        TABLEAU_COLS.map((col) => {
            const base = column(state, col).findIndex((card) => card.up);
            return base > 0 ? moveHint(state, { pile: 'tableau', col }, base, priority, accepts) : undefined;
        }),
    );
}

/** Priority 3: the waste top onto any tableau column, empty ones included. */
function wasteToTableau(state: GameState): MoveHint | undefined {
    return moveHint(state, { pile: 'waste' }, state.waste.length - 1, 3, isTableau);
}

/**
 * Priority 4: a partial run onto a tableau column, exposing a card that its foundation is ready for. Only a King
 * fits an empty column, and a King never rests on a face-up card, so in play the target is always non-empty.
 */
function freeingSplit(state: GameState): MoveHint | undefined {
    return firstMove(
        TABLEAU_COLS.flatMap((col) => {
            const cards: Column = column(state, col);
            return cards.flatMap((card, index) => {
                const below = cards[index - 1];
                return card.up && below?.up === true && isReady(state, below.id)
                    ? [moveHint(state, { pile: 'tableau', col }, index, 4, isTableau)]
                    : [];
            });
        }),
    );
}

/** The first productive board move, by hint priority; `undefined` when there is none. */
function findMove(state: GameState): MoveHint | undefined {
    return (
        sendHome(state) ??
        revealingRun(state, 2, (to) => isTableau(to) && !isEmptyColumn(state, to)) ??
        wasteToTableau(state) ??
        freeingSplit(state) ??
        revealingRun(state, 5, (to) => isEmptyColumn(state, to))
    );
}

/** The suggested next step: the best board move, else a draw or recycle; `undefined` when none remains or won. */
export function hint(state: GameState): Hint | undefined {
    if (isWon(state)) return undefined;
    const move = findMove(state);
    if (move !== undefined) return move;
    if (state.stock.length > 0) return { kind: 'draw' };
    return canRecycle(state) ? { kind: 'recycle' } : undefined;
}

/** Whether some stock or waste card would be accepted, as a single card, by a foundation or a tableau column. */
function talonPlayable(state: GameState): boolean {
    // Neither talon pile is ever a destination, so the source pile does not affect the targets.
    return [...state.stock, ...state.waste].some((card) => legalTargets(state, [card], { pile: 'stock' }).length > 0);
}

/** No productive move remains, and the talon cannot help: nothing playable in it, or it cannot be turned over. */
export function isDeadEnd(state: GameState): boolean {
    return (
        !isWon(state) &&
        findMove(state) === undefined &&
        (!talonPlayable(state) || (state.stock.length === 0 && !canRecycle(state)))
    );
}

/** Column order of a smart tap's non-empty search: right of a tableau source, wrapping, skipping it; else 0→6. */
function relativeScan(from: PileRef): readonly TableauCol[] {
    if (from.pile !== 'tableau') return TABLEAU_COLS;
    const source = from.col;
    return [...TABLEAU_COLS.slice(source + 1), ...TABLEAU_COLS.slice(0, source)];
}

/**
 * The single destination a smart tap (or its keyboard and double-activation equivalents) sends the group at `index`
 * of `from` to, or `undefined` when nothing accepts it. The choice is, in order: the group's foundation (a single
 * card not already on a foundation), the first non-empty column that accepts it, then the first empty column for a
 * King that is not already at its column base. The non-empty search deliberately replaces the canonical destination
 * order: it scans from the column right of the source, wrapping around, or from column 0 for a waste or foundation
 * source. The empty-column search always counts from column 0.
 */
export function bestTarget(state: GameState, from: PileRef, index: number): PileRef | undefined {
    const group = groupAt(state, from, index);
    const lowest = group?.[0];
    if (group === undefined || lowest === undefined) return undefined;
    if (from.pile !== 'foundation') {
        const foundation: PileRef = { pile: 'foundation', suit: suitOf(lowest) };
        if (canDrop(state, group, foundation)) return foundation;
    }
    const occupied = relativeScan(from).find(
        (col) => column(state, col).length > 0 && canDrop(state, group, { pile: 'tableau', col }),
    );
    if (occupied !== undefined) return { pile: 'tableau', col: occupied };
    if (from.pile === 'tableau' && index === 0) return undefined; // already at the base of its column
    // An empty column accepts only a King, so `canDrop` doubles as the King test.
    const empty = TABLEAU_COLS.find(
        (col) => column(state, col).length === 0 && canDrop(state, group, { pile: 'tableau', col }),
    );
    return empty === undefined ? undefined : { pile: 'tableau', col: empty };
}

export interface FinishPlan {
    /** The settled, won position. */
    readonly state: GameState;
    /** Every event the plan produced, in order. */
    readonly events: readonly GameEvent[];
    /** The system-driven commands that lead from the original position to `state`. */
    readonly commands: readonly Command[];
}

/** The ready source card with the lowest rank; ties keep the earlier one in canonical source order. */
function lowestReady(state: GameState): Source | undefined {
    return sourceCards(state)
        .filter(({ card }) => isReady(state, card))
        .reduce<Source | undefined>(
            (best, source) => (best === undefined || rankOf(source.card) < rankOf(best.card) ? source : best),
            undefined,
        );
}

/**
 * The plan that finishes a game whose tableau is entirely face up, or `undefined` when there is none.
 *
 * Repeatedly: send the lowest-ranked card that is ready for its foundation (a tableau top or the waste top), else
 * draw (which recycles an exhausted stock). Every step is an ordinary engine command, so draws and recycles are
 * scored, counted and pass-limited as the player's would be, and sends are uncounted. The plan ends once won.
 *
 * It gives up when a step is refused, or when an exhausted stock would have to be recycled a second time with no card
 * sent since the first recycle. After that first recycle the stock holds every card that has not gone home, so the
 * draws up to the next exhaustion are one complete pass; with nothing sent, the stock and waste come back in the same
 * order, so every later pass repeats it exactly (in a draw-3 game too, waste tops included). If no card was playable
 * during that pass, none ever will be. Counting turned-over cards instead would stop a draw-3 pass short whenever the
 * pass in progress began with a non-empty waste. Each send resets the count and there are at most 52 sends, so the
 * loop always ends.
 */
export function finishPlan(state: GameState): FinishPlan | undefined {
    if (isWon(state) || state.tableau.some((cards) => cards.some((card) => !card.up))) return undefined;
    let current = state;
    let recycles = 0;
    const events: GameEvent[] = [];
    const commands: Command[] = [];
    while (!isWon(current)) {
        const send = lowestReady(current);
        if (send === undefined && current.stock.length === 0 && recycles > 0) return undefined;
        const command: Command = send === undefined ? { type: 'draw' } : { type: 'autoFoundation', from: send.from };
        const result = applyCommand(current, command);
        if (result.events.some((event) => event.type === 'rejected')) return undefined;
        current = result.state;
        events.push(...result.events);
        commands.push(command);
        recycles =
            send === undefined ? recycles + result.events.filter((event) => event.type === 'recycled').length : 0;
    }
    return { state: current, events, commands };
}
