import { describe, expect, it } from 'vitest';
import { cardId } from '../../../src/domain/cards';
import { applyCommand } from '../../../src/domain/engine';
import type { CardId, Command, GameState, RejectReason } from '../../../src/domain/types';
import { deepFreeze, faceUp, makeState } from '../../fixtures/states';

const DRAW: Command = { type: 'draw' };

const a = cardId(0, 1);
const b = cardId(0, 2);
const c = cardId(0, 3);
const d = cardId(0, 4);
const e = cardId(0, 5);
const w1 = cardId(1, 6);
const w2 = cardId(1, 7);
const w3 = cardId(1, 8);

const drawOf = (state: GameState) => applyCommand(state, DRAW);

describe('draw', () => {
    it('turns one card in one-card mode', () => {
        const state = deepFreeze(makeState({ draw: 1, stock: [a, b, c] }));
        const result = drawOf(state);

        expect(result.state.waste).toEqual([c]);
        expect(result.state.stock).toEqual([a, b]);
        expect(result.events).toEqual([{ type: 'drew', count: 1 }]);
    });

    it('turns three cards in three-card mode, leaving the deepest as the waste top', () => {
        const state = deepFreeze(makeState({ draw: 3, mode: 'draw3', stock: [a, b, c, d, e] }));
        const result = drawOf(state);

        expect(result.state.waste).toEqual([e, d, c]);
        expect(result.state.waste.at(-1)).toBe(c);
        expect(result.state.stock).toEqual([a, b]);
        expect(result.events).toEqual([{ type: 'drew', count: 3 }]);
    });

    it('turns what remains when the stock is short', () => {
        const state = deepFreeze(makeState({ draw: 3, mode: 'draw3', stock: [a, b] }));
        const result = drawOf(state);

        expect(result.state.waste).toEqual([b, a]);
        expect(result.state.waste.at(-1)).toBe(a);
        expect(result.state.stock).toEqual([]);
        expect(result.events).toEqual([{ type: 'drew', count: 2 }]);
    });

    it('adds the turned cards on top of the existing waste', () => {
        const state = deepFreeze(makeState({ draw: 1, stock: [a], waste: [w1] }));
        expect(drawOf(state).state.waste).toEqual([w1, a]);
    });

    it('counts one move, starts the game and leaves tableau and foundations untouched', () => {
        const state = deepFreeze(makeState({ moves: 7, stock: [a, b], tableau: [faceUp(w1), [], [], [], [], [], []] }));
        const { state: next } = drawOf(state);

        expect(next.moves).toBe(8);
        expect(next.started).toBe(true);
        expect(next.tableau).toBe(state.tableau);
        expect(next.foundations).toBe(state.foundations);
        expect(next.passes).toBe(1);
    });

    it('leaves the score unchanged', () => {
        const state = deepFreeze(makeState({ score: 40, stock: [a, b] }));
        expect(drawOf(state).state.score).toBe(40);
    });
});

describe('recycle', () => {
    const exhausted = (over: Partial<GameState> = {}): GameState =>
        deepFreeze(makeState({ stock: [], waste: [w1, w2, w3], passes: 1, ...over }));

    it('reverses the waste into the stock, reports the pass begun and increments passes', () => {
        const result = drawOf(exhausted());

        expect(result.state.stock).toEqual([w3, w2, w1]);
        expect(result.state.waste).toEqual([]);
        expect(result.state.passes).toBe(2);
        expect(result.events).toEqual([{ type: 'recycled', pass: 2 }]);
    });

    it('makes the first waste card the next one drawn', () => {
        const recycled = deepFreeze(drawOf(exhausted()).state);
        expect(drawOf(recycled).state.waste).toEqual([w1]);
    });

    it('counts one move, starts the game and leaves tableau and foundations untouched', () => {
        const state = exhausted({ moves: 7 });
        const { state: next } = drawOf(state);

        expect(next.moves).toBe(8);
        expect(next.started).toBe(true);
        expect(next.tableau).toBe(state.tableau);
        expect(next.foundations).toBe(state.foundations);
    });

    it('is allowed in Vegas on pass 2 and moves to pass 3', () => {
        const result = drawOf(exhausted({ mode: 'vegas', scoring: 'vegas', draw: 3, passes: 2 }));
        expect(result.state.passes).toBe(3);
        expect(result.events).toEqual([{ type: 'recycled', pass: 3 }]);
    });
});

describe('refusals', () => {
    const rows: readonly { name: string; state: GameState; reason: RejectReason }[] = [
        {
            name: 'a Vegas recycle on pass 3',
            state: deepFreeze(
                makeState({ mode: 'vegas', scoring: 'vegas', draw: 3, passes: 3, stock: [], waste: [w1, w2] }),
            ),
            reason: 'pass-limit',
        },
        { name: 'a draw with both piles empty', state: deepFreeze(makeState()), reason: 'nothing-to-draw' },
    ];

    it.each(rows.map((row) => [row.name, row] as const))(
        '%s returns the same state and one rejected event',
        (_name, row) => {
            const result = drawOf(row.state);
            expect(result.state).toBe(row.state);
            expect(result.events).toEqual([{ type: 'rejected', reason: row.reason }]);
        },
    );
});

describe('recycle scoring', () => {
    /** Runs recycle then draw `times` times from a one-card waste, returning each recycle's score change. */
    function recycleDeltas(over: Partial<GameState>, times: number): number[] {
        let state: GameState = deepFreeze(makeState({ stock: [], waste: [w1] as readonly CardId[], ...over }));
        const deltas: number[] = [];
        for (let i = 0; i < times; i++) {
            const recycled = deepFreeze(drawOf(state).state);
            deltas.push(recycled.score - state.score);
            state = deepFreeze(drawOf(recycled).state);
        }
        return deltas;
    }

    it('charges Draw 3 Standard recycles beginning passes 2 to 5 as 0, 0, -20, -20', () => {
        expect(recycleDeltas({ draw: 3, mode: 'draw3', score: 100 }, 4)).toEqual([0, 0, -20, -20]);
    });

    it('charges every Draw 1 Standard recycle -100', () => {
        expect(recycleDeltas({ draw: 1, score: 500 }, 3)).toEqual([-100, -100, -100]);
    });
});
