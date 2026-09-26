import { describe, expect, it } from 'vitest';
import { formatBank, formatMoves, formatScore, formatTime } from '../../../src/ui/format';

describe('formatScore', () => {
    it('pads a Standard score to three digits', () => {
        expect(formatScore(5)).toBe('005');
        expect(formatScore(47)).toBe('047');
        expect(formatScore(0)).toBe('000');
    });

    it('does not truncate scores of four or more digits', () => {
        expect(formatScore(999)).toBe('999');
        expect(formatScore(1234)).toBe('1234');
    });
});

describe('formatMoves', () => {
    it('pads the move count to three digits like the score', () => {
        expect(formatMoves(0)).toBe('000');
        expect(formatMoves(7)).toBe('007');
        expect(formatMoves(123)).toBe('123');
        expect(formatMoves(1000)).toBe('1000');
    });
});

describe('formatBank', () => {
    it('shows whole dollars', () => {
        expect(formatBank(47)).toBe('$47');
        expect(formatBank(0)).toBe('$0');
    });

    it('puts the minus sign before the dollar sign when negative', () => {
        expect(formatBank(-52)).toBe('-$52');
    });
});

describe('formatTime', () => {
    it('shows m:ss below one hour', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(9)).toBe('0:09');
        expect(formatTime(59)).toBe('0:59');
        expect(formatTime(60)).toBe('1:00');
        expect(formatTime(3599)).toBe('59:59');
    });

    it('shows h:mm:ss from one hour', () => {
        expect(formatTime(3600)).toBe('1:00:00');
        expect(formatTime(3725)).toBe('1:02:05');
        expect(formatTime(36000)).toBe('10:00:00');
    });
});
