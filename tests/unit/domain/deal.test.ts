// covers: KS-DEAL-01, KS-DEAL-02
import { describe, expect, it } from 'vitest';
import { GRADES, dealFromSeed, modeConfig } from '../../../src/domain/deal';
import { encodeDealCode } from '../../../src/domain/dealCode';
import type { Mode } from '../../../src/domain/types';
import { DEAL_FIXTURES, GOLDEN_DEAL, deckOrderOf } from '../../fixtures/deals';

describe('dealFromSeed', () => {
    describe.each(DEAL_FIXTURES)('$name', ({ seed, mode }) => {
        const state = dealFromSeed(seed, mode);

        it('deals n+1 cards to column n with only the last face up', () => {
            state.tableau.forEach((column, col) => {
                expect(column).toHaveLength(col + 1);
                column.forEach((card, row) => {
                    expect(card.up).toBe(row === col);
                });
            });
        });

        it('leaves 24 cards in the stock and nothing in waste or foundations', () => {
            expect(state.stock).toHaveLength(24);
            expect(state.waste).toEqual([]);
            expect(state.foundations).toEqual([[], [], [], []]);
        });

        it('holds every card id exactly once across tableau and stock', () => {
            const ids = [...state.tableau.flatMap((column) => column.map((card) => card.id)), ...state.stock];
            expect([...ids].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, id) => id));
        });

        it('records the seed and mode it was dealt from', () => {
            expect(state.seed).toBe(seed);
            expect(state.mode).toBe(mode);
        });

        it('starts with no undo charges', () => {
            expect(state.undos).toBe(0);
        });
    });

    it('is deterministic for the same seed and mode and varies across seeds', () => {
        const first = dealFromSeed(42, 'draw3');
        const other = dealFromSeed(43, 'draw3');
        expect(dealFromSeed(42, 'draw3')).toEqual(first);
        expect(deckOrderOf(other)).not.toEqual(deckOrderOf(first));
    });

    it('matches the golden shuffled deck order computed by the reference implementation', () => {
        const state = dealFromSeed(GOLDEN_DEAL.seed, GOLDEN_DEAL.mode);
        expect(deckOrderOf(state)).toEqual(GOLDEN_DEAL.permutation);
    });

    it('places the last shuffled card on top of the stock', () => {
        const state = dealFromSeed(GOLDEN_DEAL.seed, GOLDEN_DEAL.mode);
        expect(state.stock.at(-1)).toBe(GOLDEN_DEAL.permutation.at(-1));
        expect(state.stock[0]).toBe(GOLDEN_DEAL.permutation[28]);
    });

    it('starts a fresh game', () => {
        const state = dealFromSeed(1, 'draw1');
        expect(state.passes).toBe(1);
        expect(state.moves).toBe(0);
        expect(state.elapsedMs).toBe(0);
        expect(state.started).toBe(false);
        expect(state.status).toBe('playing');
        expect(state.verdict).toBe('random');
        expect(state.attempts).toBe(1);
        expect(state.grade).toBeNull();
    });

    it.each<Mode>(['draw1', 'draw3', 'vegas', 'daily'])(
        'records a seed outside the unsigned 32-bit range as its reduction (%s)',
        (mode) => {
            const state = dealFromSeed(-1, mode);
            expect(state.seed).toBe(4294967295);
            expect(state).toEqual(dealFromSeed(4294967295, mode));
            expect(dealFromSeed(2 ** 32 + 5, mode)).toEqual(dealFromSeed(5, mode));
        },
    );

    it('can always encode the recorded seed as a deal code', () => {
        expect(encodeDealCode(dealFromSeed(-1, 'draw1').seed, 'draw1')).toBe('1-1Z141Z3');
    });

    it('honours verdict and attempts overrides', () => {
        const state = dealFromSeed(7, 'daily', { verdict: 'win', attempts: 5 });
        expect(state.verdict).toBe('win');
        expect(state.attempts).toBe(5);
        expect(state.grade).toBeNull();
    });

    // covers: KS-DEAL-11
    it('records a grade with its verdict and attempts', () => {
        const state = dealFromSeed(7, 'draw3', { verdict: 'win', attempts: 2, grade: 'medium' });
        expect(state.verdict).toBe('win');
        expect(state.attempts).toBe(2);
        expect(state.grade).toBe('medium');
    });

    it('keeps an explicit null grade as null', () => {
        expect(dealFromSeed(7, 'draw1', { verdict: 'random', attempts: 1, grade: null }).grade).toBeNull();
    });

    it.each<Mode>(['draw1', 'draw3', 'vegas', 'daily'])(
        'never lets provenance change the layout or the deal code (%s)',
        (mode) => {
            const plain = dealFromSeed(99, mode);
            const graded = dealFromSeed(99, mode, { verdict: 'win', attempts: 4, grade: 'hard' });
            expect(graded.seed).toBe(plain.seed);
            expect(graded.tableau).toEqual(plain.tableau);
            expect(graded.stock).toEqual(plain.stock);
            expect(graded.waste).toEqual(plain.waste);
            expect(graded.foundations).toEqual(plain.foundations);
            expect(encodeDealCode(graded.seed, graded.mode)).toBe(encodeDealCode(plain.seed, plain.mode));
        },
    );

    it('lists the grades easiest first', () => {
        expect(GRADES).toEqual(['easy', 'medium', 'hard']);
    });

    it('does not let a partial override drop the other default', () => {
        expect(dealFromSeed(7, 'daily', { verdict: 'win' }).attempts).toBe(1);
        expect(dealFromSeed(7, 'daily', { attempts: 3 }).verdict).toBe('random');
    });

    it.each<readonly [Mode, 1 | 3, 'standard' | 'vegas', number]>([
        ['draw1', 1, 'standard', 0],
        ['draw3', 3, 'standard', 0],
        ['vegas', 3, 'vegas', -52],
        ['daily', 1, 'standard', 0],
    ])('maps %s to draw %i, %s scoring and starting score %i', (mode, draw, scoring, score) => {
        expect(modeConfig(mode)).toEqual({ draw, scoring });
        const state = dealFromSeed(1, mode);
        expect(state.draw).toBe(draw);
        expect(state.scoring).toBe(scoring);
        expect(state.score).toBe(score);
    });
});
