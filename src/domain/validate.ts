import { DECK_SIZE, isCardId, rankOf, suitOf } from './cards';
import { modeConfig } from './deal';
import { isWon } from './rules';
import type { CardId, Column, GameState, Mode, Pile, Suit, TableauCard } from './types';

/** A plain, non-null, non-array object — the shape every other check assumes it can read fields from. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite integer that is zero or greater; excludes `NaN`, `Infinity` and fractions. */
function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** One of the four known game modes. */
function isMode(value: unknown): value is Mode {
    return value === 'draw1' || value === 'draw3' || value === 'vegas' || value === 'daily';
}

/**
 * An array of known card identifiers. `Array.from` visits every index including holes (a hole reads back
 * as `undefined`, which fails `isCardId`), so a sparse array is rejected rather than silently accepted.
 */
function isCardIdArray(value: unknown): value is readonly CardId[] {
    return Array.isArray(value) && Array.from(value).every(isCardId);
}

/** A single tableau card: a known card id paired with a face-up flag. */
function isTableauCard(value: unknown): value is TableauCard {
    return isPlainObject(value) && isCardId(value.id) && typeof value.up === 'boolean';
}

/** A tableau column, bottom (index 0) first: well-formed cards with no face-down card above a face-up one. */
function isColumn(value: unknown): value is Column {
    if (!Array.isArray(value)) return false;
    const cards = Array.from(value); // densified, so a missing (deleted) row is rejected rather than skipped
    if (!cards.every(isTableauCard)) return false;
    return cards.every((card, i) => {
        const above = cards[i + 1];
        return !card.up || above === undefined || above.up;
    });
}

/** A foundation for `suit`: its own suit, ascending rank starting from the ace; a 14th card fails on its own. */
function isFoundation(suit: Suit, value: unknown): value is Pile {
    if (!Array.isArray(value)) return false;
    return Array.from(value).every((id, i) => isCardId(id) && suitOf(id) === suit && rankOf(id) === i + 1);
}

/**
 * The shape of a well-formed `GameState`: every field, pile and column correctly typed and internally
 * consistent, and the 52 cards each appearing exactly once across stock, waste, foundations and tableau.
 * Does not check the won status against the foundations — `isValidGameState` does that separately.
 */
function hasGameStateShape(value: unknown): value is GameState {
    if (!isPlainObject(value)) return false;
    const { seed, mode, draw, scoring, verdict, attempts, tableau, stock, waste, foundations } = value;
    const { score, moves, passes, elapsedMs, undos, started, status } = value;

    if (!isNonNegativeInteger(seed) || seed > 0xffffffff) return false;
    if (!isMode(mode)) return false;
    const config = modeConfig(mode);
    if (draw !== config.draw || scoring !== config.scoring) return false;
    if (verdict !== 'win' && verdict !== 'random') return false;
    if (status !== 'playing' && status !== 'won') return false;
    if (typeof started !== 'boolean') return false;
    if (typeof score !== 'number' || !Number.isFinite(score)) return false;
    if (!isNonNegativeInteger(attempts)) return false;
    if (!isNonNegativeInteger(moves)) return false;
    if (!isNonNegativeInteger(passes) || passes < 1) return false;
    if (!isNonNegativeInteger(elapsedMs)) return false;
    if (!isNonNegativeInteger(undos)) return false;

    if (!Array.isArray(tableau) || tableau.length !== 7) return false;
    const columns = Array.from(tableau); // densified, so a missing column is rejected rather than skipped
    if (!columns.every(isColumn)) return false;

    if (!isCardIdArray(stock) || !isCardIdArray(waste)) return false;

    if (!Array.isArray(foundations) || foundations.length !== 4) return false;
    const piles = Array.from(foundations); // densified, so a missing foundation is rejected rather than skipped
    if (!piles.every((pile, suit) => isFoundation(suit as Suit, pile))) return false;

    const allIds = [...stock, ...waste, ...piles.flat(), ...columns.flatMap((col) => col.map((card) => card.id))];
    return allIds.length === DECK_SIZE && new Set(allIds).size === DECK_SIZE;
}

/**
 * Accepts `value` only as a well-formed, internally consistent `GameState` whose won status agrees with
 * whether every card sits on a foundation. Total and never throwing — an exotic input, such as a value
 * with a throwing getter, is caught and rejected rather than propagated.
 */
export function isValidGameState(value: unknown): value is GameState {
    try {
        return hasGameStateShape(value) && (value.status === 'won') === isWon(value);
    } catch {
        return false;
    }
}
