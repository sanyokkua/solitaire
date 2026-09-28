import { describe, expect, it } from 'vitest';
import { displayedScore, timePenalty, undoCost, winBonus } from '../../../src/domain/scoring';
import type { ScoringMode } from '../../../src/domain/types';
import { deepFreeze, makeState } from '../../fixtures/states';

describe('timePenalty', () => {
    it.each<[number, number]>([
        [0, 0],
        [9_999, 0],
        [10_000, 2],
        [100_000, 20],
    ])('is %s ms → %s under Standard', (elapsedMs, expected) => {
        expect(timePenalty(elapsedMs, 'standard')).toBe(expected);
    });

    it.each<number>([0, 10_000, 600_000])('is 0 under Vegas at %s ms', (elapsedMs) => {
        expect(timePenalty(elapsedMs, 'vegas')).toBe(0);
    });
});

describe('winBonus', () => {
    it.each<[number, number]>([
        [30_000, 0],
        [30_999, 0],
        [31_000, Math.floor(700_000 / 31)],
        [31_999, Math.floor(700_000 / 31)],
    ])('is %s ms → %s under Standard', (elapsedMs, expected) => {
        expect(winBonus(elapsedMs, 'standard')).toBe(expected);
    });

    it.each<number>([31_000, 600_000])('is 0 under Vegas at %s ms', (elapsedMs) => {
        expect(winBonus(elapsedMs, 'vegas')).toBe(0);
    });
});

describe('undoCost', () => {
    it.each<[ScoringMode, number]>([
        ['standard', 2],
        ['vegas', 0],
    ])('is %s → %s', (scoring, expected) => {
        expect(undoCost(scoring)).toBe(expected);
    });
});

describe('displayedScore', () => {
    it('subtracts the time penalty', () => {
        const state = deepFreeze(makeState({ scoring: 'standard', score: 50, elapsedMs: 100_000 }));
        expect(displayedScore(state)).toBe(30);
    });

    it('floors at 0 under Standard', () => {
        const state = deepFreeze(makeState({ scoring: 'standard', score: 5, elapsedMs: 100_000 }));
        expect(displayedScore(state)).toBe(0);
    });

    it('is neither floored nor penalised under Vegas', () => {
        const state = deepFreeze(makeState({ scoring: 'vegas', score: -52, elapsedMs: 600_000 }));
        expect(displayedScore(state)).toBe(-52);
    });

    it('excludes the win bonus while still playing', () => {
        const state = deepFreeze(makeState({ scoring: 'standard', score: 100, elapsedMs: 31_000, status: 'playing' }));
        expect(displayedScore(state)).toBe(94);
    });

    it('adds the win bonus on top of the floored value once won', () => {
        const state = deepFreeze(makeState({ scoring: 'standard', score: 0, elapsedMs: 31_000, status: 'won' }));
        expect(displayedScore(state)).toBe(Math.floor(700_000 / 31));
    });

    it('adds no bonus under Vegas when won', () => {
        const state = deepFreeze(makeState({ scoring: 'vegas', score: 48, elapsedMs: 600_000, status: 'won' }));
        expect(displayedScore(state)).toBe(48);
    });

    it('is derived: repeat calls agree and the stored score is unchanged', () => {
        const state = deepFreeze(makeState({ scoring: 'standard', score: 50, elapsedMs: 100_000, status: 'won' }));
        expect(displayedScore(state)).toBe(7_030);
        expect(displayedScore(state)).toBe(7_030);
        expect(state.score).toBe(50);
    });

    it('subtracts undo charges from the displayed Standard score', () => {
        const state = deepFreeze(makeState({ scoring: 'standard', score: 50, elapsedMs: 5_000, undos: 3 }));
        expect(displayedScore(state)).toBe(44);
    });

    it('never takes the Standard score below zero for undo charges', () => {
        const state = deepFreeze(makeState({ scoring: 'standard', score: 4, undos: 3 }));
        expect(displayedScore(state)).toBe(0);
    });

    it('floors the undo charge before adding the win bonus on top', () => {
        const state = deepFreeze(
            makeState({ scoring: 'standard', score: 4, undos: 3, elapsedMs: 31_000, status: 'won' }),
        );
        expect(displayedScore(state)).toBe(Math.floor(700_000 / 31));
    });

    it('ignores undo charges under Vegas', () => {
        const state = deepFreeze(makeState({ scoring: 'vegas', score: -27, undos: 3 }));
        expect(displayedScore(state)).toBe(-27);
    });
});
