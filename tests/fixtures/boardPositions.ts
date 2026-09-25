import { cardId, DECK_SIZE, type Rank } from '../../src/domain/cards';
import type { CardId, Column, GameState, Suit, TableauCard } from '../../src/domain/types';
import { makeState, tableauOf } from './states';

/** Index of the column that holds the worst case. */
const WORST_COLUMN = 6;
/** Face-down cards under the run. */
const FACE_DOWN_COUNT = 6;
/** Highest rank of the run. */
const RUN_TOP = 13;
const HEARTS: Suit = 0;
const SPADES: Suit = 3;

/** The K to A run with alternating colours: K of spades, Q of hearts, J of spades, and so on down to the ace of spades. */
function worstRun(): TableauCard[] {
    return Array.from({ length: RUN_TOP }, (_, i): TableauCard => {
        const rank = (RUN_TOP - i) as Rank;
        return { id: cardId(i % 2 === 0 ? SPADES : HEARTS, rank), up: true };
    });
}

/**
 * The worst-case position for the layout: column 7 holds 6 face-down cards under a 13-card face-up run from king to
 * ace, alternating in colour. The other 33 cards are in the stock, so all 52 cards appear once. The game is started
 * and playing in Draw 1, which keeps it encodable.
 */
export function worstColumnState(): GameState {
    const run = worstRun();
    const used = new Set<CardId>(run.map((card) => card.id));
    const rest = Array.from({ length: DECK_SIZE }, (_, id) => id).filter((id) => !used.has(id));
    const faceDown = rest.slice(0, FACE_DOWN_COUNT).map((id): TableauCard => ({ id, up: false }));
    const emptyColumns = Array.from({ length: WORST_COLUMN }, (): Column => []);
    return makeState({
        started: true,
        status: 'playing',
        tableau: tableauOf(...emptyColumns, [...faceDown, ...run]),
        stock: rest.slice(FACE_DOWN_COUNT),
    });
}
