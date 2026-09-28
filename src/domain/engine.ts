import { suitOf } from './cards';
import { canDrop, canRecycle, column, groupAt, isWon } from './rules';
import { applyDelta, commandDelta } from './scoring';
import type {
    CardId,
    Column,
    Command,
    Foundations,
    GameEvent,
    GameState,
    Pile,
    PileRef,
    RejectReason,
    Suit,
    Tableau,
    TableauCol,
} from './types';

export interface CommandResult {
    readonly state: GameState;
    readonly events: readonly GameEvent[];
}

/** A refusal hands back the very state it was given, so callers can detect it by reference. */
function reject(state: GameState, reason: RejectReason): CommandResult {
    return { state, events: [{ type: 'rejected', reason }] };
}

/** Finishes an accepted command: detects the win, scores the events and updates the engine-owned counters. */
function accept(before: GameState, after: GameState, events: readonly GameEvent[], counted: boolean): CommandResult {
    const won = isWon(after);
    const allEvents: readonly GameEvent[] = won ? [...events, { type: 'won' }] : events;
    return {
        state: {
            ...after,
            score: applyDelta(before.score, commandDelta(allEvents, before.scoring, before.draw), before.scoring),
            moves: counted ? before.moves + 1 : before.moves,
            started: true,
            status: won ? 'won' : before.status,
        },
        events: allEvents,
    };
}

// `map` on a fixed-arity tuple yields a plain array; the index never changes, so the arity is preserved.
function withColumn(state: GameState, col: TableauCol, next: Column): GameState {
    return { ...state, tableau: state.tableau.map((c, i) => (i === col ? next : c)) as unknown as Tableau };
}

function withFoundation(state: GameState, suit: Suit, next: Pile): GameState {
    return {
        ...state,
        foundations: state.foundations.map((f, i) => (i === suit ? next : f)) as unknown as Foundations,
    };
}

interface Lifted {
    readonly state: GameState;
    readonly flipped: CardId | undefined;
}

/** Removes the group grabbed at `index` from its source pile, turning up a newly exposed face-down card. */
function lift(state: GameState, from: PileRef, index: number): Lifted {
    switch (from.pile) {
        case 'waste':
            return { state: { ...state, waste: state.waste.slice(0, -1) }, flipped: undefined };
        case 'foundation':
            return {
                state: withFoundation(state, from.suit, state.foundations[from.suit].slice(0, -1)),
                flipped: undefined,
            };
        case 'tableau': {
            const kept = column(state, from.col).slice(0, index);
            const exposed = kept.at(-1);
            if (exposed === undefined || exposed.up) {
                return { state: withColumn(state, from.col, kept), flipped: undefined };
            }
            const turned = [...kept.slice(0, -1), { id: exposed.id, up: true }];
            return { state: withColumn(state, from.col, turned), flipped: exposed.id };
        }
        case 'stock':
            return { state, flipped: undefined }; // groupAt never grabs from the stock
    }
}

/** Adds `group` (already validated by `canDrop`) on top of the destination pile, all face up. */
function place(state: GameState, to: PileRef, group: readonly CardId[]): GameState {
    switch (to.pile) {
        case 'foundation':
            return withFoundation(state, to.suit, [...state.foundations[to.suit], ...group]);
        case 'tableau':
            return withColumn(state, to.col, [...column(state, to.col), ...group.map((id) => ({ id, up: true }))]);
        case 'stock':
        case 'waste':
            return state; // canDrop refuses both
    }
}

function applyMove(state: GameState, from: PileRef, index: number, to: PileRef, counted: boolean): CommandResult {
    const group = groupAt(state, from, index);
    if (group === undefined) return reject(state, 'not-movable');
    if (!canDrop(state, group, to)) return reject(state, 'illegal-target');
    const lifted = lift(state, from, index);
    const events: GameEvent[] = [{ type: 'moved', cards: group, from, to }];
    if (lifted.flipped !== undefined) events.push({ type: 'flipped', card: lifted.flipped });
    return accept(state, place(lifted.state, to, group), events, counted);
}

/** A system-initiated send of the top card of a tableau column or the waste to its foundation; never counted. */
function applyAutoFoundation(state: GameState, from: PileRef): CommandResult {
    if (from.pile !== 'tableau' && from.pile !== 'waste') return reject(state, 'not-movable');
    const index = (from.pile === 'tableau' ? column(state, from.col) : state.waste).length - 1;
    const card = groupAt(state, from, index)?.[0];
    if (card === undefined) return reject(state, 'not-movable');
    return applyMove(state, from, index, { pile: 'foundation', suit: suitOf(card) }, false);
}

function applyDraw(state: GameState): CommandResult {
    if (state.stock.length > 0) {
        const count = Math.min(state.draw, state.stock.length);
        const turned = state.stock.slice(-count).reverse();
        const after = { ...state, stock: state.stock.slice(0, -count), waste: [...state.waste, ...turned] };
        return accept(state, after, [{ type: 'drew', count }], true);
    }
    if (state.waste.length === 0) return reject(state, 'nothing-to-draw');
    if (!canRecycle(state)) return reject(state, 'pass-limit');
    const pass = state.passes + 1;
    const after = { ...state, stock: [...state.waste].reverse(), waste: [], passes: pass };
    return accept(state, after, [{ type: 'recycled', pass }], true);
}

/** Validates and applies one command. Pure and total: it never throws and never modifies `state`. */
export function applyCommand(state: GameState, command: Command): CommandResult {
    if (state.status === 'won') return reject(state, 'game-over');
    switch (command.type) {
        case 'move':
            return applyMove(state, command.from, command.index, command.to, true);
        case 'autoFoundation':
            return applyAutoFoundation(state, command.from);
        case 'draw':
            return applyDraw(state);
    }
}
