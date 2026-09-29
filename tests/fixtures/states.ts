import { cardId, type Rank } from '../../src/domain/cards';
import { shuffle } from '../../src/domain/deal';
import { mulberry32 } from '../../src/domain/prng';
import type { CardId, Column, Foundations, GameState, Pile, Suit, Tableau, TableauCard } from '../../src/domain/types';

/** A plain, empty game state; callers override the fields a test cares about. */
export function makeState(partial: Partial<GameState> = {}): GameState {
    const defaults: GameState = {
        seed: 0,
        mode: 'draw1',
        draw: 1,
        scoring: 'standard',
        verdict: 'random',
        attempts: 1,
        tableau: [[], [], [], [], [], [], []],
        stock: [],
        waste: [],
        foundations: [[], [], [], []],
        score: 0,
        moves: 0,
        passes: 1,
        elapsedMs: 0,
        undos: 0,
        started: false,
        status: 'playing',
    };
    return { ...defaults, ...partial };
}

/** A deep-frozen state, so any mutation by the code under test throws. */
export function frozenState(partial: Partial<GameState> = {}): GameState {
    return deepFreeze(makeState(partial));
}

/** A Vegas game at its pass limit (recycling refused) unless `partial` says otherwise. */
export function vegasAtLimit(partial: Partial<GameState> = {}): GameState {
    return frozenState({ mode: 'vegas', scoring: 'vegas', draw: 3, passes: 3, ...partial });
}

/** Recursively freezes objects and arrays, returning the same value. */
export function deepFreeze<T>(value: T): T {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}

/** Tableau cards, all face up, in the order given (bottom first). */
export function faceUp(...ids: CardId[]): TableauCard[] {
    return ids.map((id) => ({ id, up: true }));
}

/** Tableau cards, all face down, in the order given (bottom first). */
export function faceDown(...ids: CardId[]): TableauCard[] {
    return ids.map((id) => ({ id, up: false }));
}

/** A foundation holding ranks 1..`height` of `suit`. */
function built(suit: Suit, height: number): Pile {
    return Array.from({ length: height }, (_, i) => cardId(suit, (i + 1) as Rank));
}

/** Foundations with the given heights, indexed by suit (hearts, diamonds, clubs, spades). */
export function foundationsOf(hearts: number, diamonds: number, clubs: number, spades: number): Foundations {
    return [built(0, hearts), built(1, diamonds), built(2, clubs), built(3, spades)];
}

/** A tableau with the given columns from column 0 on; the remaining columns are empty. */
export function tableauOf(...columns: Column[]): Tableau {
    const [c0 = [], c1 = [], c2 = [], c3 = [], c4 = [], c5 = [], c6 = []] = columns;
    return [c0, c1, c2, c3, c4, c5, c6];
}

/**
 * `state` with its hidden cards exchanged: the face-down tableau cards and the stock cards are shuffled among their own
 * places by a seeded shuffle. Every pile size and every face-up card stays as it was, so the position looks the same
 * to a player until one of the exchanged cards is turned up or becomes the waste top.
 */
export function exchangeHidden(state: GameState, seed: number): GameState {
    const hidden = [
        ...state.tableau.flatMap((cards) => cards.filter((card) => !card.up).map((card) => card.id)),
        ...state.stock,
    ];
    const shuffled = shuffle(hidden, mulberry32(seed));
    let next = 0;
    const take = (): CardId => {
        const id = shuffled[next++];
        if (id === undefined) throw new RangeError('fewer hidden cards than hidden places');
        return id;
    };
    const tableau = state.tableau.map((cards) => cards.map((card) => (card.up ? card : { id: take(), up: false })));
    const stock = state.stock.map(take);
    return { ...state, tableau: tableauOf(...tableau), stock };
}
