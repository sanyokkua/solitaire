// covers: KS-DEAL-11
import { describe, expect, it } from 'vitest';
import { dealFromSeed } from '../../../src/domain/deal';
import { GRADES } from '../../../src/domain/deal';
import { GRADING_V1, gradeDeal, gradeOf } from '../../../src/solver/grading';
import { CALIBRATION, GOLDEN, type GradedMode } from '../../fixtures/gradingGolden';

const MODES: readonly GradedMode[] = ['draw1', 'draw3', 'vegas'];
/** The smallest share of a mode's proven-winnable deals that each grade must hold (KS-DEAL-11). */
const MIN_SHARE = 0.15;

describe('grading v1 is pinned', () => {
    it.each(MODES)('regrades the golden %s deals to their pinned score and grade', (mode) => {
        for (const { seed, score, grade } of GOLDEN[mode]) {
            expect(gradeDeal(dealFromSeed(seed, mode)), `seed ${String(seed)}`).toEqual({ score, grade });
        }
    });

    it.each(MODES)('has golden %s deals of every grade', (mode) => {
        expect(new Set(GOLDEN[mode].map(({ grade }) => grade))).toEqual(new Set(GRADES));
    });

    it('keeps every golden deal inside its calibration sample, with the same score', () => {
        for (const mode of MODES) {
            const sample = new Map(CALIBRATION[mode]);
            for (const { seed, score } of GOLDEN[mode]) expect(sample.get(seed)).toBe(score);
        }
    });
});

describe('every grade is common enough', () => {
    it.each(MODES)('holds at least 15%% of the %s calibration sample under the pinned thresholds', (mode) => {
        const scores = CALIBRATION[mode].map(([, score]) => score);
        for (const grade of GRADES) {
            const share = scores.filter((score) => gradeOf(score, mode) === grade).length / scores.length;
            expect(share, `${mode} ${grade}`).toBeGreaterThanOrEqual(MIN_SHARE);
        }
    });

    it('keeps scores within the top score of the pinned parameters', () => {
        const top = GRADING_V1.playouts * GRADING_V1.maxCheckpoints;
        for (const mode of MODES) {
            for (const [, score] of CALIBRATION[mode]) expect(score).toBeLessThanOrEqual(top);
        }
    });
});
