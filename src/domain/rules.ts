import { colorOf, rankOf, suitOf } from './cards';
import type { CardId, Column, GameState, Mode, PileRef, Suit, TableauCard, TableauCol } from './types';

/** `card` may be placed directly on `onto` in a tableau column: one rank lower, opposite colour. */
function fitsOnto(card: CardId, onto: CardId): boolean {
    return rankOf(card) === rankOf(onto) - 1 && colorOf(card) !== colorOf(onto);
}

export function column(state: GameState, col: TableauCol): Column {
    return state.tableau[col];
}

export function columnTop(state: GameState, col: TableauCol): TableauCard | undefined {
    return column(state, col).at(-1);
}

export function wasteTop(state: GameState): CardId | undefined {
    return state.waste.at(-1);
}

export function foundationTop(state: GameState, suit: Suit): CardId | undefined {
    return state.foundations[suit].at(-1);
}

/** A pile whose only grabbable card is its topmost (waste, foundation). */
function topOnly(pile: readonly CardId[], index: number): readonly CardId[] | undefined {
    const top = pile.at(-1);
    return top !== undefined && index === pile.length - 1 ? [top] : undefined;
}

/** The face-up card at `index` and everything above it, when those cards form a descending alternating run. */
function runFrom(cards: Column, index: number): readonly CardId[] | undefined {
    if (cards[index]?.up !== true) return undefined;
    const run = cards.slice(index);
    const isRun = run.every((card, i) => {
        const below = run[i - 1];
        return card.up && (below === undefined || fitsOnto(card.id, below.id));
    });
    return isRun ? run.map((card) => card.id) : undefined;
}

/** The cards that would move together when `index` of the `from` pile is grabbed, lowest card first. */
export function groupAt(state: GameState, from: PileRef, index: number): readonly CardId[] | undefined {
    switch (from.pile) {
        case 'stock':
            return undefined;
        case 'waste':
            return topOnly(state.waste, index);
        case 'foundation':
            return topOnly(state.foundations[from.suit], index);
        case 'tableau':
            return runFrom(column(state, from.col), index);
    }
}

export function isMovable(state: GameState, from: PileRef, index: number): boolean {
    return groupAt(state, from, index) !== undefined;
}

const KING_RANK = 13;

/** Foundations in suit-encoding order, then tableau columns 0→6 (canonical destination order). */
const DESTINATIONS: readonly PileRef[] = [
    { pile: 'foundation', suit: 0 },
    { pile: 'foundation', suit: 1 },
    { pile: 'foundation', suit: 2 },
    { pile: 'foundation', suit: 3 },
    { pile: 'tableau', col: 0 },
    { pile: 'tableau', col: 1 },
    { pile: 'tableau', col: 2 },
    { pile: 'tableau', col: 3 },
    { pile: 'tableau', col: 4 },
    { pile: 'tableau', col: 5 },
    { pile: 'tableau', col: 6 },
];

function samePile(a: PileRef, b: PileRef): boolean {
    if (a.pile === 'foundation' && b.pile === 'foundation') return a.suit === b.suit;
    if (a.pile === 'tableau' && b.pile === 'tableau') return a.col === b.col;
    return a.pile === b.pile;
}

/** Whether the pile `to` accepts `group` (lowest card first). Ignores where the group came from. */
export function canDrop(state: GameState, group: readonly CardId[], to: PileRef): boolean {
    const lowest = group[0];
    if (lowest === undefined) return false;
    switch (to.pile) {
        case 'stock':
        case 'waste':
            return false;
        case 'foundation':
            return (
                group.length === 1 &&
                suitOf(lowest) === to.suit &&
                rankOf(lowest) === state.foundations[to.suit].length + 1
            );
        case 'tableau': {
            const top = columnTop(state, to.col);
            return top === undefined ? rankOf(lowest) === KING_RANK : fitsOnto(lowest, top.id);
        }
    }
}

/** Every pile that accepts `group`, in canonical destination order, excluding its source pile `from`. */
export function legalTargets(state: GameState, group: readonly CardId[], from: PileRef): readonly PileRef[] {
    return DESTINATIONS.filter((to) => !samePile(to, from) && canDrop(state, group, to));
}

const VEGAS_PASS_LIMIT = 3;
const FOUNDATION_COMPLETE = 13;

/** Passes through the stock a mode allows: three for Vegas, unlimited otherwise. */
export function passLimit(mode: Mode): number {
    return mode === 'vegas' ? VEGAS_PASS_LIMIT : Number.POSITIVE_INFINITY;
}

/** Turning an exhausted stock over again begins the next pass, so it needs the pass in progress below the limit. */
export function canRecycle(state: GameState): boolean {
    return state.stock.length === 0 && state.waste.length > 0 && state.passes < passLimit(state.mode);
}

export function isWon(state: GameState): boolean {
    return state.foundations.every((foundation) => foundation.length === FOUNDATION_COMPLETE);
}
