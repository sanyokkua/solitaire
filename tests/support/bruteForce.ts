import { applyCommand } from '../../src/domain/engine';
import { positionKey } from '../../src/domain/position';
import { isWon } from '../../src/domain/rules';
import type { Command, GameState, PileRef, Suit, TableauCol } from '../../src/domain/types';

const SUITS: readonly Suit[] = [0, 1, 2, 3];
const COLUMNS: readonly TableauCol[] = [0, 1, 2, 3, 4, 5, 6];

/** Every place a move can land, whatever the rules say about it. */
const DESTINATIONS: readonly PileRef[] = [
    ...COLUMNS.map((col): PileRef => ({ pile: 'tableau', col })),
    ...SUITS.map((suit): PileRef => ({ pile: 'foundation', suit })),
];

/** Every command the engine could be offered: a draw, and each source card (or run) to each destination. */
function candidates(state: GameState): Command[] {
    const sources: { from: PileRef; index: number }[] = [];
    if (state.waste.length > 0) {
        sources.push({ from: { pile: 'waste' }, index: state.waste.length - 1 });
    }
    for (const suit of SUITS) {
        const height = state.foundations[suit].length;
        if (height > 0) {
            sources.push({ from: { pile: 'foundation', suit }, index: height - 1 });
        }
    }
    for (const col of COLUMNS) {
        const cards = state.tableau[col];
        cards.forEach((card, index) => {
            if (card.up) {
                sources.push({ from: { pile: 'tableau', col }, index });
            }
        });
    }
    const moves = sources.flatMap(({ from, index }) =>
        DESTINATIONS.map((to): Command => ({ type: 'move', from, index, to })),
    );
    return [{ type: 'draw' }, ...moves];
}

/**
 * Test-only exhaustive search (D5): does any sequence of engine-accepted commands win from `state`? It offers every
 * draw and recycle and every move the engine accepts, foundation-to-column included, and prunes nothing; it skips
 * only a position it has already seen. `applyCommand` is the oracle, so the search cannot drift from the rules the
 * player plays by. Two positions are the same when their piles are equal and, under a pass limit, so are the passes:
 * `positionKey` covers the piles alone, and the same piles with more passes left can win where fewer cannot.
 * Meant for endgames; the number of positions grows quickly with the cards off the foundations. `allow` narrows the
 * commands offered, to show that a win needs some kind of move: `bruteForceWins(state, (c, s) => !isPartialRun(c, s))`.
 */
/** The most positions the search will hold before giving up: a fixture that needs more is too big to check. */
const MAX_POSITIONS = 250_000;

export function bruteForceWins(
    state: GameState,
    allow: (command: Command, from: GameState) => boolean = () => true,
    maxPositions = MAX_POSITIONS,
): boolean {
    const limited = state.mode === 'vegas';
    const keyOf = (s: GameState): string => (limited ? `${positionKey(s)}#${String(s.passes)}` : positionKey(s));
    const seen = new Set<string>([keyOf(state)]);
    const pending: GameState[] = [state];
    for (let s = pending.pop(); s !== undefined; s = pending.pop()) {
        if (isWon(s)) {
            return true;
        }
        for (const command of candidates(s).filter((c) => allow(c, s))) {
            const result = applyCommand(s, command);
            if (result.events.some((event) => event.type === 'rejected')) {
                continue;
            }
            const key = keyOf(result.state);
            if (!seen.has(key)) {
                if (seen.size >= maxPositions) {
                    throw new RangeError(`the exhaustive search passed ${String(maxPositions)} positions`);
                }
                seen.add(key);
                pending.push(result.state);
            }
        }
    }
    return false;
}
