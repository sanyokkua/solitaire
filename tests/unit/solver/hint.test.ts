import { describe, expect, it } from 'vitest';
import type { Hint } from '../../../src/domain/hint';
import { cardId } from '../../../src/domain/cards';
import { dealFromSeed } from '../../../src/domain/deal';
import { applyCommand } from '../../../src/domain/engine';
import { groupAt } from '../../../src/domain/rules';
import { solverHint, type SolverHint } from '../../../src/solver/hint';
import { search } from '../../../src/solver/search';
import { solve } from '../../../src/solver/solver';
import { corpusSeeds, MIDGAME_POSITIONS, midgameState } from '../../fixtures/solverCorpus';
import { foundationsOf, makeState } from '../../fixtures/states';
import { layout } from '../../support/endgames';

const BUDGET = 3000;
const SPADES = 3;

/** The pinned positions searched at `BUDGET`, each with its fresh solve's first command. */
const PINNED = MIDGAME_POSITIONS.filter((entry) => entry.budget === BUDGET).map((entry) => {
    const state = midgameState(entry);
    return { entry, state, first: solve(state, BUDGET).line?.[0] };
});

describe('solverHint on proven positions', () => {
    it('suggests the first move of the line, with its cards, and the engine accepts it', () => {
        const moves = PINNED.flatMap(({ state, first }) => (first?.type === 'move' ? [{ state, first }] : []));
        expect(moves.length).toBeGreaterThan(0);
        for (const { state, first } of moves) {
            expect(solverHint(state, BUDGET)).toEqual({
                kind: 'move',
                command: first,
                cards: groupAt(state, first.from, first.index),
            });
            const { events } = applyCommand(state, first);
            expect(events.filter((event) => event.type === 'rejected')).toEqual([]);
        }
    });

    it('suggests a draw when the line starts with a draw and the stock holds cards', () => {
        const draws = PINNED.filter(({ state, first }) => first?.type === 'draw' && state.stock.length > 0);
        expect(draws.length).toBeGreaterThan(0);
        for (const { state } of draws) {
            expect(solverHint(state, BUDGET)).toEqual({ kind: 'draw' });
        }
    });

    it('suggests a recycle when the line starts with a draw and the stock is empty', () => {
        // Q and K of spades are the only cards left, both in the waste with the stock empty.
        const state = makeState({
            foundations: foundationsOf(13, 13, 13, 11),
            waste: [cardId(SPADES, 12), cardId(SPADES, 13)],
        });
        expect(solve(state, BUDGET).line?.[0]).toEqual({ type: 'draw' });
        expect(solverHint(state, BUDGET)).toEqual({ kind: 'recycle' });
    });

    it('accepts every domain hint as a solver hint', () => {
        const widen = (hint: Hint): SolverHint => hint;
        expect(widen({ kind: 'draw' })).toEqual({ kind: 'draw' });
    });
});

describe('solverHint gives no suggestion', () => {
    it('for a loss or an unknown verdict', () => {
        const loss = dealFromSeed(91, 'draw1');
        expect(solve(loss, BUDGET).verdict).toBe('loss');
        expect(solverHint(loss, BUDGET)).toBeUndefined();

        const [seed] = corpusSeeds('unknown');
        const unknown = dealFromSeed(seed ?? 0, 'draw1');
        expect(solve(unknown, BUDGET).verdict).toBe('unknown');
        expect(solverHint(unknown, BUDGET)).toBeUndefined();
    });

    it('for a Draw 3 or Vegas deal the ordered search leaves unproven', () => {
        // Seed 1 is unknown at this budget in both modes; Draw 3 seed 10 and Vegas seed 9 are proven losses.
        expect(solverHint(dealFromSeed(1, 'draw3'), BUDGET)).toBeUndefined();
        expect(solverHint(dealFromSeed(1, 'vegas'), BUDGET)).toBeUndefined();
        expect(solverHint(dealFromSeed(10, 'draw3'), BUDGET)).toBeUndefined();
        expect(solverHint(dealFromSeed(9, 'vegas'), BUDGET)).toBeUndefined();
    });

    it('for a won position', () => {
        const won = makeState({ foundations: foundationsOf(13, 13, 13, 13), status: 'won' });
        expect(solverHint(won, BUDGET)).toBeUndefined();
    });
});

describe('solverHint on Draw 3 and Vegas positions', () => {
    it('suggests the first move of the ordered search line, with its cards', () => {
        for (const state of [dealFromSeed(8, 'draw3'), dealFromSeed(21, 'vegas')]) {
            const first = search(state, BUDGET).line?.[0];
            expect(first?.type).toBe('move');
            if (first?.type !== 'move') {
                continue;
            }
            expect(solverHint(state, BUDGET)).toEqual({
                kind: 'move',
                command: first,
                cards: groupAt(state, first.from, first.index),
            });
        }
    });

    it('suggests a draw when the line starts by drawing from a non-empty stock', () => {
        const state = dealFromSeed(11, 'draw3');
        expect(search(state, BUDGET).line?.[0]).toEqual({ type: 'draw' });
        expect(state.stock.length).toBeGreaterThan(0);
        expect(solverHint(state, BUDGET)).toEqual({ kind: 'draw' });
    });

    it('suggests a recycle when the line starts by drawing on an empty stock', () => {
        const state = layout({
            mode: 'vegas',
            columns: ['7h', '8h', '9h', 'Th', 'Jh', 'Qh', 'Kh'],
            waste: '5h 4h 3h 6h',
            passes: 2,
        });
        expect(state.stock).toEqual([]);
        expect(solverHint(state, BUDGET)).toEqual({ kind: 'recycle' });
    });

    it('offers nothing once the position has no recycle left to make', () => {
        const state = layout({
            mode: 'vegas',
            columns: ['7h', '8h', '9h', 'Th', 'Jh', 'Qh', 'Kh'],
            waste: '5h 4h 3h 6h',
            passes: 3,
        });
        expect(solverHint(state, BUDGET)).toBeUndefined();
    });
});
