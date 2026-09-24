import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { dealFromSeed } from '../../../src/domain/deal';
import type { Command, GameState } from '../../../src/domain/types';
import { expandLine } from '../../../src/solver/line';
import { solve } from '../../../src/solver/solver';
import { MIDGAME_POSITIONS, midgameState, replayLine } from '../../fixtures/solverCorpus';
import { faceUp, foundationsOf, makeState, tableauOf } from '../../fixtures/states';

const BUDGET = 5000;
const SPADES = 3;

/** A move of the waste top to the spades foundation, grabbing the card at `index`. */
function wasteToSpades(index: number): Command {
    return { type: 'move', from: { pile: 'waste' }, index, to: { pile: 'foundation', suit: SPADES } };
}

function winLine(state: GameState, budget = BUDGET): readonly Command[] {
    const result = solve(state, budget);
    expect(result.verdict).toBe('win');
    return result.line ?? [];
}

function expectWon(state: GameState, line: readonly Command[]): ReturnType<typeof replayLine> {
    const replay = replayLine(state, line);
    expect(replay.events.filter((event) => event.type === 'rejected')).toEqual([]);
    expect(replay.state.status).toBe('won');
    expect(replay.commands.filter((command) => command.type === 'autoFoundation')).toEqual([]);
    return replay;
}

describe('expandLine on hand-built positions', () => {
    it('recycles the waste until a buried card is on top before moving it', () => {
        // Q and K of spades are the only cards left, both in the waste with the stock empty.
        const state = makeState({
            foundations: foundationsOf(13, 13, 13, 11),
            waste: [cardId(SPADES, 12), cardId(SPADES, 13)],
        });
        const line = winLine(state);
        expect(line).toEqual([
            { type: 'draw' },
            { type: 'draw' },
            wasteToSpades(0),
            { type: 'draw' },
            wasteToSpades(0),
        ]);
        const replay = expectWon(state, line);
        expect(replay.events).toContainEqual({ type: 'recycled', pass: 2 });
        // Q of spades is the waste top right before its move (after the recycle and one draw).
        expect(replayLine(state, line.slice(0, 2)).state.waste.at(-1)).toBe(cardId(SPADES, 12));
    });

    it('starts with the draws that expose an Ace buried in the stock, then moves it to its foundation', () => {
        // Stock top is the 2 of spades with the Ace below it: every send is safe at the root.
        const ranks = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 1, 2] as const;
        const state = makeState({
            foundations: foundationsOf(13, 13, 13, 0),
            stock: ranks.map((rank) => cardId(SPADES, rank)),
        });
        const line = winLine(state);
        expect(line.slice(0, 3)).toEqual([{ type: 'draw' }, { type: 'draw' }, wasteToSpades(1)]);
        expectWon(state, line);
    });
});

describe('expandLine on searched positions', () => {
    it.each(MIDGAME_POSITIONS)('replays the line of seed $seed after $k commands to a won game', (entry) => {
        const state = midgameState(entry);
        const line = winLine(state, entry.budget);
        expect(line.length).toBeGreaterThan(0);
        expectWon(state, line);
    });

    it('pins positions whose fresh line starts with a move and with a draw from a non-empty stock', () => {
        const starts = MIDGAME_POSITIONS.filter((entry) => entry.budget === 3000).map((entry) => {
            const state = midgameState(entry);
            return { first: winLine(state, entry.budget)[0]?.type, stock: state.stock.length };
        });
        expect(starts.some((start) => start.first === 'move')).toBe(true);
        expect(starts.some((start) => start.first === 'draw' && start.stock > 0)).toBe(true);
    });

    it('gives identical lines for two solves of the same position', () => {
        for (const seed of [19, 3]) {
            const state = dealFromSeed(seed, 'draw1');
            expect(solve(state, BUDGET).line).toEqual(solve(state, BUDGET).line);
        }
    });
});

describe('expandLine refusals', () => {
    it('throws for a talon move naming a card that is in neither stock nor waste', () => {
        const state = makeState({ stock: [cardId(0, 2)], waste: [cardId(0, 3)] });
        expect(() => expandLine(state, [{ t: 'tf', card: cardId(0, 9) }])).toThrow(Error);
        expect(() => expandLine(state, [{ t: 'tc', card: cardId(0, 9), to: 0 }])).toThrow(Error);
    });

    it('throws for a column-to-foundation move from an empty column', () => {
        expect(() => expandLine(makeState(), [{ t: 'cf', col: 0 }])).toThrow(Error);
    });

    it('throws when the engine refuses a command', () => {
        const state = makeState({ waste: [cardId(0, 5)], tableau: tableauOf([], faceUp(cardId(2, 9))) });
        expect(() => expandLine(state, [{ t: 'tc', card: cardId(0, 5), to: 0 }])).toThrow(Error);
        expect(() => expandLine(state, [{ t: 'cc', from: 0, index: 0, to: 1 }])).toThrow(Error);
    });
});
