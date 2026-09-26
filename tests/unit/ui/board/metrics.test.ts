import { describe, expect, it } from 'vitest';
import { measure, worstStrip, type Metrics } from '../../../../src/ui/board/metrics';
import { BASELINES, boardSizeFor } from '../../../fixtures/viewports';

/** The number of tableau-row columns the chosen geometry lays out: seven stacked, nine wide. */
function columnCount(metrics: Metrics): number {
    return metrics.wide ? 9 : 7;
}

function gridWidth(metrics: Metrics): number {
    const columns = columnCount(metrics);
    return metrics.cw * columns + metrics.gap * (columns - 1);
}

/** The stacked card width for a board, straight from the board-layout formula. */
function stackedCardWidth(width: number, height: number, pad: number, gap: number): number {
    return Math.max(30, Math.min(104, (width - 2 * pad - 6 * gap) / 7, (height - 2 * pad) / (1.4 * 3.1)));
}

describe('measure card size', () => {
    it('caps the card at 104 px on a desktop board and stays stacked and not compact', () => {
        const metrics = measure({ width: 1180, height: 690 }, { coarse: false });
        expect(metrics.cw).toBe(104);
        expect(metrics.compact).toBe(false);
        expect(metrics.wide).toBe(false);
        expect(metrics.coarse).toBe(false);
    });

    it('keeps the desktop worst-case stacked strip near 25.7 px, above the 9 px fine threshold', () => {
        const metrics = measure({ width: 1180, height: 690 }, { coarse: false });
        const tabTop = metrics.pad + metrics.ch + Math.max(1.4 * metrics.gap, 10);
        expect(worstStrip(metrics.cw, tabTop, 690, metrics.pad, false)).toBeCloseTo(25.7, 1);
    });

    it('makes a 360-wide portrait phone compact and at least 30 px', () => {
        const metrics = measure({ width: 360, height: 640 }, { coarse: true });
        expect(metrics.compact).toBe(true);
        expect(metrics.cw).toBeGreaterThanOrEqual(30);
        expect(metrics.cw).toBeLessThan(70);
        expect(metrics.wide).toBe(false);
    });

    it('floors the card at 30 px on a tiny board', () => {
        expect(measure({ width: 100, height: 100 }, { coarse: true }).cw).toBe(30);
    });

    it('makes the card height 1.4 times its width and echoes the inputs', () => {
        const metrics = measure({ width: 900, height: 600 }, { coarse: true });
        expect(metrics.ch).toBeCloseTo(1.4 * metrics.cw, 10);
        expect(metrics.width).toBe(900);
        expect(metrics.height).toBe(600);
        expect(metrics.coarse).toBe(true);
    });

    it('marks cards compact below 70 px only', () => {
        expect(measure({ width: 1180, height: 690 }, { coarse: false }).compact).toBe(false);
        expect(measure({ width: 360, height: 640 }, { coarse: false }).compact).toBe(true);
    });
});

describe('measure spacing', () => {
    it.each([519, 520])('follows pad = min(18, .022W) and gap = min(14, .016W) at width %i', (width) => {
        const metrics = measure({ width, height: 700 }, { coarse: false });
        expect(metrics.pad).toBeCloseTo(Math.max(width < 520 ? 4 : 8, Math.min(18, 0.022 * width)), 10);
        expect(metrics.gap).toBeCloseTo(Math.max(width < 520 ? 3 : 4, Math.min(14, 0.016 * width)), 10);
    });

    it('binds the small-board minimum of 4 px padding on a very narrow board, where the 30 px card floor takes the gap', () => {
        const metrics = measure({ width: 150, height: 400 }, { coarse: true });
        expect(metrics.pad).toBe(4);
        expect(metrics.gap).toBe(0);
    });

    it('caps padding at 18 px and the gap at 14 px on a very wide board', () => {
        const metrics = measure({ width: 2000, height: 900 }, { coarse: false });
        expect(metrics.pad).toBe(18);
        expect(metrics.gap).toBe(14);
    });

    it('never goes below the 8 px and 4 px minimums at or above 520 px', () => {
        for (const width of [520, 700, 1000]) {
            const metrics = measure({ width, height: 700 }, { coarse: false });
            expect(metrics.pad).toBeGreaterThanOrEqual(8);
            expect(metrics.gap).toBeGreaterThanOrEqual(4);
        }
    });
});

describe('measure card-floor gap shrink', () => {
    const baseline = (pointer: 'coarse' | 'fine') => {
        const screen = BASELINES.find((b) => b.label === '320x480 coarse');
        if (screen === undefined) {
            throw new Error('missing 320x480 baseline');
        }
        return measure(boardSizeFor(screen, pointer), { coarse: pointer === 'coarse' });
    };

    it('shrinks the gap on the 320x480 baseline with a coarse pointer so the wide grid fits the board', () => {
        const metrics = baseline('coarse');
        const unclamped = Math.max(3, Math.min(14, 0.016 * metrics.width));
        expect(metrics.wide).toBe(true);
        expect(metrics.cw).toBe(30);
        expect(metrics.ox).toBeGreaterThanOrEqual(0);
        expect(metrics.ox + gridWidth(metrics)).toBeLessThanOrEqual(metrics.width + 1e-9);
        expect(metrics.gap).toBeLessThan(unclamped);
        expect(metrics.gap).toBeGreaterThanOrEqual(3);
    });

    it('gives the 320x480 baseline a fine pointer the stacked table with cards above the 30 px floor', () => {
        // The measured frame leaves a mouse-driven 320x480 window a board tall enough for a 9 px strip when stacked.
        const metrics = baseline('fine');
        expect(metrics.wide).toBe(false);
        expect(metrics.cw).toBeGreaterThan(30);
        expect(metrics.ox).toBeGreaterThanOrEqual(0);
        expect(metrics.ox + gridWidth(metrics)).toBeLessThanOrEqual(metrics.width + 1e-9);
    });

    it.each([
        [1180, 690],
        [390, 660],
    ])('leaves the gap at the formula value on a %ix%i board', (width, height) => {
        const metrics = measure({ width, height }, { coarse: true });
        expect(metrics.gap).toBe(Math.max(width < 520 ? 3 : 4, Math.min(14, 0.016 * width)));
    });

    it('shrinks the gap without going below 0 on a very narrow board, and fits the grid where 30 px cards fit', () => {
        const fits = measure({ width: 235, height: 400 }, { coarse: true });
        expect(fits.cw).toBe(30);
        expect(fits.gap).toBeGreaterThan(0);
        expect(fits.gap).toBeLessThan(Math.max(3, 0.016 * 235));
        expect(fits.ox).toBeGreaterThanOrEqual(0);
        expect(fits.ox + gridWidth(fits)).toBeLessThanOrEqual(fits.width + 1e-9);
        const tooNarrow = measure({ width: 200, height: 400 }, { coarse: true });
        expect(tooNarrow.gap).toBe(0);
    });
});

describe('measure geometry choice', () => {
    it('chooses the wide table on a 700x280 landscape phone with a coarse pointer', () => {
        const metrics = measure({ width: 700, height: 280 }, { coarse: true });
        expect(metrics.wide).toBe(true);
    });

    it('gives the wide table a thicker worst-case strip (about 11.45 px) than the stacked one (about 4.45 px)', () => {
        const metrics = measure({ width: 700, height: 280 }, { coarse: true });
        const stackedCw = stackedCardWidth(700, 280, metrics.pad, metrics.gap);
        const stackedTabTop = metrics.pad + stackedCw * 1.4 + Math.max(1.4 * metrics.gap, 10);
        const stacked = worstStrip(stackedCw, stackedTabTop, 280, metrics.pad, true);
        const wide = worstStrip(metrics.cw, metrics.pad, 280, metrics.pad, true);
        expect(stacked).toBeCloseTo(4.45, 1);
        expect(wide).toBeCloseTo(11.45, 1);
        expect(wide).toBeGreaterThan(stacked);
        expect(stacked).toBeLessThan(14);
    });

    it('chooses the wide table at 700x280 with a fine pointer too, since the stacked strip is under 9 px', () => {
        expect(measure({ width: 700, height: 280 }, { coarse: false }).wide).toBe(true);
    });

    it('stays stacked on a tall board with a coarse pointer', () => {
        expect(measure({ width: 390, height: 700 }, { coarse: true }).wide).toBe(false);
    });
});

describe('worstStrip', () => {
    it('returns the full face-up step when nothing needs to squeeze', () => {
        // ch = 140; face-down step 15.4, face-up 37.8 (fine) or 42 (coarse); the column is 6*15.4 + 12*37.8 = 546.
        expect(worstStrip(100, 0, 1000, 0, false)).toBeCloseTo(37.8, 10);
        expect(worstStrip(100, 0, 1000, 0, true)).toBeCloseTo(42, 10);
    });

    it('squeezes face-down steps first, then face-up steps', () => {
        // avail = 500 - 140 = 360; 6 * 15.4 + 12 * 37.8 > 360, so face-down steps shrink to (360 - 453.6) / 6 < 0.04ch.
        // The floor 0.04 * 140 = 5.6 binds, so the face-up step is (360 - 6 * 5.6) / 12 = 27.2.
        expect(worstStrip(100, 0, 500, 0, false)).toBeCloseTo(27.2, 10);
    });

    it('stops squeezing face-down steps once face-up steps fit', () => {
        // avail = 600 - 140 = 460; face-up 12 * 37.8 = 453.6; face-down step becomes (460 - 453.6) / 6 = 1.07 -> floor 5.6.
        // 6 * 5.6 + 453.6 = 487.2 > 460, so the face-up step shrinks to (460 - 33.6) / 12 = 35.53.
        expect(worstStrip(100, 0, 600, 0, false)).toBeCloseTo(35.5333, 3);
    });

    it('never returns a negative strip when the column starts below the board', () => {
        expect(worstStrip(100, 900, 500, 10, false)).toBe(0);
    });
});

describe('measure placement of the rows', () => {
    it.each([
        ['desktop', { width: 1180, height: 690 }, false],
        ['portrait phone', { width: 360, height: 640 }, true],
        ['landscape phone', { width: 700, height: 280 }, true],
    ])('%s: top, bottom and the tableau row follow the pad and card height', (_name, size, coarse) => {
        const metrics = measure(size, { coarse });
        expect(metrics.top).toBe(metrics.pad);
        expect(metrics.bottom).toBe(size.height - metrics.pad);
        const expectedTabY = metrics.wide ? metrics.pad : metrics.pad + metrics.ch + Math.max(1.4 * metrics.gap, 10);
        expect(metrics.tabY).toBeCloseTo(expectedTabY, 10);
    });

    it('puts the stacked tableau below the top row and the wide tableau level with it', () => {
        const stacked = measure({ width: 1180, height: 690 }, { coarse: false });
        const wide = measure({ width: 700, height: 280 }, { coarse: true });
        expect(stacked.tabY).toBeGreaterThan(stacked.top + stacked.ch);
        expect(wide.tabY).toBe(wide.top);
    });
});

describe('measure centring', () => {
    it.each([
        ['stacked desktop', { width: 1180, height: 690 }, false],
        ['stacked phone', { width: 360, height: 640 }, true],
        ['stacked mid', { width: 800, height: 700 }, false],
        ['wide phone', { width: 700, height: 280 }, true],
        ['wide small', { width: 640, height: 300 }, true],
    ])('%s: the space left of the first column equals the space right of the last', (_name, size, coarse) => {
        const metrics = measure(size, { coarse });
        const left = metrics.ox;
        const right = size.width - (metrics.ox + gridWidth(metrics));
        expect(Math.abs(left - right)).toBeLessThanOrEqual(0.5);
    });

    it('covers both geometries and column counts', () => {
        expect(columnCount(measure({ width: 1180, height: 690 }, { coarse: false }))).toBe(7);
        expect(columnCount(measure({ width: 700, height: 280 }, { coarse: true }))).toBe(9);
    });
});

describe('measure determinism', () => {
    it('gives deeply equal metrics for the same inputs', () => {
        const first = measure({ width: 812, height: 375 }, { coarse: true });
        const second = measure({ width: 812, height: 375 }, { coarse: true });
        expect(second).toEqual(first);
    });
});
